import os
import psycopg
import time
from pgvector.psycopg import register_vector
from google import genai
from google.genai import types
from .config import settings

client = genai.Client(api_key=settings.gemini_api_key)

def generate_and_store_embeddings(all_chunks, repo_name, commit_sha):
    if not all_chunks:
        print("No chunks provided for embedding.")
        return

    print(f"Preparing {len(all_chunks)} chunks for embedding...")

    contents = []
    for chunk in all_chunks:
        file_path = chunk.metadata.get('file_path', 'unknown')
        formatted_text = f"title: {file_path} | text: {chunk.text}"
        contents.append(types.Content(parts=[types.Part.from_text(text=formatted_text)]))

    valid_chunks = []
    all_embeddings = []
    batch_size = 100

    print("Generating embeddings via Gemini API...")

    for i in range(0, len(contents), batch_size):
        batch_contents = contents[i:i + batch_size]
        batch_chunks = all_chunks[i:i + batch_size]

        try:
            result = client.models.embed_content(
                model='gemini-embedding-2',
                contents=batch_contents,
                config=types.EmbedContentConfig(output_dimensionality=768)
            )

            if result and result.embeddings:
                all_embeddings.extend([e.values for e in result.embeddings])
                valid_chunks.extend(batch_chunks) # Only save chunks that worked
                print(f"Processed chunks {i} to {i + len(batch_contents)}...")
            else:
                print(f"⚠️ Skipped batch {i} to {i + len(batch_contents)}: API returned None (likely safety filter).")

        except Exception as e:
            print(f"❌ Error on batch {i} to {i + len(batch_contents)}: {e}")

        time.sleep(4)

    print(f"Successfully generated {len(all_embeddings)} embeddings. Inserting into database...")

    with psycopg.connect(settings.database_url, autocommit=True) as conn:
        register_vector(conn)

        with conn.cursor() as cur:
            for chunk, embedding_vector in zip(valid_chunks, all_embeddings):
                cur.execute("""
                    INSERT INTO repo_chunks
                    (repo_name, commit_sha, file_path, symbol_name, chunk_text, embedding)
                    VALUES (%s, %s, %s, %s, %s, %s)
                """, (
                    repo_name,
                    commit_sha,
                    chunk.metadata.get('file_path', ''),
                    chunk.metadata.get('symbol_name', ''),
                    chunk.text,
                    embedding_vector
                ))

    print("Database ingestion complete!")