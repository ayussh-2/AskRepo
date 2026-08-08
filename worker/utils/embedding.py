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
DOCUMENT_PREFIX = "title: none | text: "

def embed_batch(batch_contents):
    embed_provider = os.environ.get("EMBEDDING_PROVIDER", "local").lower().strip()
    modal_url = os.environ.get("MODAL_EMBED_URL")
    modal_token = os.environ.get("MODAL_EMBED_TOKEN")

    # Use Modal GPU serverless embedding if EMBEDDING_PROVIDER=modal
    if embed_provider == "modal" and modal_url:
        headers = {"Authorization": f"Bearer {modal_token}"} if modal_token else {}
        prefixed_texts = [f"{DOCUMENT_PREFIX}{t}" for t in batch_contents]
        embeddings = []
        with httpx.Client(timeout=60.0) as http_client:
            for text_item in prefixed_texts:
                resp = http_client.post(modal_url, json={"query": text_item}, headers=headers)
                resp.raise_for_status()
                embeddings.append(resp.json()["embedding"])
        return embeddings
    else:
        # Default to 0-cost Local Ollama CPU embedding
        prefixed_texts = [f"{DOCUMENT_PREFIX}{t}" for t in batch_contents]
        response = client.embed(
            model=settings.embedding_model,
            input=prefixed_texts
        )
        return response.embeddings


def generate_and_store_embeddings(all_chunks, repo_name, commit_sha):
    if not all_chunks:
        print("No chunks provided for embedding.")
        return

    print(f"Preparing {len(all_chunks)} chunks for embedding...")
    contents = [chunk.text for chunk in all_chunks]

    batch_size = 50
    batches = []
    for i in range(0, len(contents), batch_size):
        batches.append((i, contents[i:i + batch_size], all_chunks[i:i + batch_size]))

    valid_chunks = []
    all_embeddings = []
    
    print(f"Generating embeddings using parallel threads for {len(batches)} batches...")
    
    # Process batches concurrently using ThreadPoolExecutor
    results_map = {}
    with ThreadPoolExecutor(max_workers=6) as executor:
        future_to_batch = {
            executor.submit(embed_batch, b_contents): (idx, b_contents, b_chunks)
            for idx, b_contents, b_chunks in batches
        }
        for future in as_completed(future_to_batch):
            idx, b_contents, b_chunks = future_to_batch[future]
            try:
                embeddings = future.result()
                if embeddings and len(embeddings) == len(b_chunks):
                    results_map[idx] = (b_chunks, embeddings)
            except Exception as e:
                print(f"Error on batch starting at index {idx}: {e}")

    # Reassemble results in order
    for idx in sorted(results_map.keys()):
        b_chunks, b_embeddings = results_map[idx]
        valid_chunks.extend(b_chunks)
        all_embeddings.extend(b_embeddings)

    print(f"Embedding completed. Successfully generated {len(all_embeddings)} embeddings.")

    # Bulk DB Storage
    with Session(engine) as session:
        print(f"Cleaning up previous chunks for {repo_name}...")
        session.execute(text("DELETE FROM repo_chunks WHERE LOWER(repo_name) = LOWER(:name)"), {"name": repo_name})
        session.commit()

        print(f"Bulk inserting {len(valid_chunks)} chunks into PostgreSQL pgvector...")
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
            session.bulk_insert_mappings(RepoChunk, db_records[i:i + db_batch_size])
            session.commit()
            print(f"Stored chunks {i} to {i + len(db_records[i:i + db_batch_size])}")

    print("Database ingestion complete!")
