import ollama
from sqlmodel import Session, select
from db.models import RepoChunk
from google.genai import types
import time
from .config import settings


client = ollama.Client(host=settings.ollama_base_url)

def embed(contents):
    if isinstance(contents, str):
        texts = [contents]
    
    elif isinstance(contents, list):
        texts = []
        for c in contents:
            if isinstance(c, types.Content):
                texts.append(c.parts[0].text)
            else:
                texts.append(c)
    
    response = client.embed(
        model=settings.embedding_model,
        input=texts
    )
    
    return response.embeddings 

def generate_and_store_embeddings(all_chunks, repo_name, commit_sha):
    from db.db import engine

    if not all_chunks:
        print("No chunks provided for embedding.")
        return

    print(f"Preparing {len(all_chunks)} chunks for embedding...")

    contents = []
    for chunk in all_chunks:
        contents.append(chunk.text)

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


def search_chunk(query, repo_name, top_k):
    from db.db import engine

    query_embedding = embed(query)[0]

    with Session(engine) as session:
        results = session.exec(
            select(RepoChunk)
            .where(RepoChunk.repo_name == repo_name)
            .order_by(RepoChunk.embedding.cosine_distance(query_embedding))
            .limit(top_k)
        ).all()

        file_paths = list(set(r.file_path for r in results))

        imports = session.exec(
            select(RepoChunk)
            .where(RepoChunk.repo_name == repo_name)
            .where(RepoChunk.file_path.in_(file_paths))
            .where(RepoChunk.symbol_name == "")
        ).all()

    seen_ids = {r.id for r in results}
    extra = [i for i in imports if i.id not in seen_ids]

    return results + extra