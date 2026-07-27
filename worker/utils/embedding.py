import ollama
from sqlmodel import Session
from db.db import engine
from db.models import RepoChunk
from utils.config import settings

client = ollama.Client(host=settings.ollama_base_url)

# embeddinggemma expects a task-specific prefix prepended to every input to
# hit its benchmarked quality. Documents use "title: none | text: " unless a
# real title is available (a file path could be passed here as a light-weight
# title if that turns out to help — worth testing).
DOCUMENT_PREFIX = "title: none | text: "

def embed(contents):
    if isinstance(contents, str):
        texts = [contents]
    else:
        texts = list(contents)

    prefixed_texts = [f"{DOCUMENT_PREFIX}{t}" for t in texts]

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

    valid_chunks = []
    all_embeddings = []
    batch_size = 100

    print("Generating embeddings...")
    for i in range(0, len(contents), batch_size):
        batch_contents = contents[i:i + batch_size]
        batch_chunks = all_chunks[i:i + batch_size]

        try:
            result = embed(batch_contents)
            if result:
                all_embeddings.extend(result)
                valid_chunks.extend(batch_chunks)
        except Exception as e:
            print(f"Error on batch {i} to {i + len(batch_contents)}: {e}")

    with Session(engine) as session:
        # Delete previous chunks to prevent duplicates
        from sqlalchemy import text
        print(f"Cleaning up previous chunks for {repo_name}...")
        session.execute(text("DELETE FROM repo_chunks WHERE repo_name = :name"), {"name": repo_name})
        session.commit()

        for i in range(0, len(valid_chunks), batch_size):
            batch_chunks = valid_chunks[i:i + batch_size]
            batch_embeddings = all_embeddings[i:i + batch_size]

            for chunk, emb in zip(batch_chunks, batch_embeddings):
                session.add(RepoChunk(
                    repo_name=repo_name,
                    commit_sha=commit_sha,
                    file_path=chunk.metadata.get('file_path', ''),
                    symbol_name=chunk.metadata.get('symbol_name', ''),
                    chunk_text=chunk.text,
                    embedding=emb
                ))
            session.commit()
            print(f"Stored chunks {i} to {i + len(batch_chunks)}")

    print("Database ingestion complete!")
