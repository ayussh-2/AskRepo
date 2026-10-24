import os
import httpx
import ollama
from concurrent.futures import ThreadPoolExecutor, as_completed
from sqlmodel import Session
from sqlalchemy import text
from db.db import engine
from db.models import RepoChunk
from utils.config import settings

client = ollama.Client(host=settings.ollama_base_url)

# embeddinggemma expects a task-specific prefix prepended to every input to
# hit its benchmarked quality. Documents use "title: none | text: " unless a
# real title is available (a file path could be passed here as a light-weight
# title if that turns out to help — worth testing).
DOCUMENT_PREFIX = "title: none | text: "

def embed_batch(batch_contents, batch_idx=0, total_batches=1):
    embed_provider = os.environ.get("EMBEDDING_PROVIDER", "local").lower().strip()
    modal_url = os.environ.get("MODAL_EMBED_URL")
    modal_token = os.environ.get("MODAL_EMBED_TOKEN")

    if embed_provider == "modal" and modal_url:
        print(f"[Modal GPU] 🚀 Sending batch {batch_idx + 1}/{total_batches} ({len(batch_contents)} chunks) to Modal...", flush=True)
        headers = {"Authorization": f"Bearer {modal_token}"} if modal_token else {}
        prefixed_texts = [f"{DOCUMENT_PREFIX}{t}" for t in batch_contents]
        embeddings = []
        with httpx.Client(timeout=60.0) as http_client:
            for text_item in prefixed_texts:
                resp = http_client.post(modal_url, json={"query": text_item}, headers=headers)
                resp.raise_for_status()
                embeddings.append(resp.json()["embedding"])
        print(f"[Modal GPU] ✅ Received embeddings for batch {batch_idx + 1}/{total_batches} from Modal.", flush=True)
        return embeddings
    else:
        print(f"[Ollama CPU] ⏳ Generating embeddings locally for batch {batch_idx + 1}/{total_batches} ({len(batch_contents)} chunks)...", flush=True)
        prefixed_texts = [f"{DOCUMENT_PREFIX}{t}" for t in batch_contents]
        response = client.embed(
            model=settings.embedding_model,
            input=prefixed_texts
        )
        print(f"[Ollama CPU] ✅ Local batch {batch_idx + 1}/{total_batches} complete.", flush=True)
        return response.embeddings

def generate_and_store_embeddings(all_chunks, repo_name, commit_sha):
    if not all_chunks:
        print("No chunks provided for embedding.", flush=True)
        return

    print(f"Preparing {len(all_chunks)} chunks for embedding...", flush=True)
    contents = [
        f"File: {chunk.metadata.get('file_path', '')} | Symbol: {chunk.metadata.get('symbol_name', '')}\n\n{chunk.text}"
        for chunk in all_chunks
    ]

    batch_size = 50
    batches = []
    for i in range(0, len(contents), batch_size):
        batches.append((i, contents[i:i + batch_size], all_chunks[i:i + batch_size]))

    valid_chunks = []
    all_embeddings = []
    total_batches = len(batches)
    
    print(f"Generating embeddings using parallel threads for {total_batches} batches...", flush=True)
    
    # Process batches concurrently using ThreadPoolExecutor
    results_map = {}
    with ThreadPoolExecutor(max_workers=6) as executor:
        future_to_batch = {
            executor.submit(embed_batch, b_contents, b_i, total_batches): (b_i, b_contents, b_chunks)
            for b_i, (_, b_contents, b_chunks) in enumerate(batches)
        }
        for future in as_completed(future_to_batch):
            b_i, b_contents, b_chunks = future_to_batch[future]
            try:
                embeddings = future.result()
                if embeddings and len(embeddings) == len(b_chunks):
                    results_map[b_i] = (b_chunks, embeddings)
            except Exception as e:
                print(f"[Embedding Error] Failed batch {b_i + 1}/{total_batches}: {e}", flush=True)

    # Reassemble results in order
    for idx in sorted(results_map.keys()):
        b_chunks, b_embeddings = results_map[idx]
        valid_chunks.extend(b_chunks)
        all_embeddings.extend(b_embeddings)

    print(f"Embedding completed. Successfully generated {len(all_embeddings)} embeddings.", flush=True)

    # Bulk DB Storage
    with Session(engine) as session:
        print(f"Cleaning up previous chunks for {repo_name}...", flush=True)
        session.execute(text("DELETE FROM repo_chunks WHERE LOWER(repo_name) = LOWER(:name)"), {"name": repo_name})
        session.commit()

        print(f"Bulk inserting {len(valid_chunks)} chunks into PostgreSQL pgvector...", flush=True)
        db_records = []
        for chunk, emb in zip(valid_chunks, all_embeddings):
            db_records.append({
                "repo_name": repo_name,
                "commit_sha": commit_sha,
                "file_path": chunk.metadata.get('file_path', ''),
                "symbol_name": chunk.metadata.get('symbol_name', ''),
                "chunk_text": chunk.text,
                "embedding": emb
            })

        db_batch_size = 500
        for i in range(0, len(db_records), db_batch_size):
            current_batch = db_records[i:i + db_batch_size]
            session.bulk_insert_mappings(RepoChunk, current_batch)
            session.commit()
            print(f"Stored chunks {i} to {i + len(current_batch)}", flush=True)

    print("Database ingestion complete!", flush=True)
