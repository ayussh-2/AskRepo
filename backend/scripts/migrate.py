import os
import sys
from dotenv import load_dotenv

utils_dir = os.path.dirname(os.path.abspath(__file__))
env_path = os.path.abspath(os.path.join(utils_dir, "..", "api", ".env"))
load_dotenv(dotenv_path=env_path)

from sqlmodel import create_engine, SQLModel
from sqlalchemy import text

# Force import models to register them in metadata
sys.path.insert(0, os.path.abspath(os.path.join(utils_dir, "..", "api")))
from db.models import RepoChunk, IngestionStatus

def run_migrations():
    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        print("Error: DATABASE_URL environment variable is not set.")
        sys.exit(1)

    if db_url.startswith("postgresql://"):
        db_url = db_url.replace("postgresql://", "postgresql+psycopg://", 1)

    print(f"Connecting to database...")
    engine = create_engine(db_url, echo=False, connect_args={"prepare_threshold": 0})

    with engine.connect() as conn:
        db_info = conn.execute(text("SELECT current_database(), current_user, inet_server_addr(), inet_server_port();")).first()
        if db_info:
            print(f"--- Connected to Database ---")
            print(f"  Database: {db_info[0]}")
            print(f"  User:     {db_info[1]}")
            print(f"  Host:     {db_info[2]}:{db_info[3]}")
            print(f"-----------------------------")

        print("\n1. Enabling pgvector extension...")
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
        conn.commit()

    print("2. Creating tables if they do not exist...")
    SQLModel.metadata.create_all(engine)

    with engine.connect() as conn:
        print("3. Altering ingestion_statuses table (user_id column)...")
        conn.execute(text("ALTER TABLE ingestion_statuses ADD COLUMN IF NOT EXISTS user_id VARCHAR;"))
        conn.commit()

        print("4. Creating index on repo_chunks (LOWER(repo_name))...")
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_repo_chunks_repo_name_lower 
            ON repo_chunks (LOWER(repo_name));
        """))
        conn.commit()

        print("5. Creating index on repo_chunks (LOWER(repo_name), LOWER(symbol_name))...")
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_repo_chunks_symbol_name_lower 
            ON repo_chunks (LOWER(repo_name), LOWER(symbol_name))
            WHERE symbol_name != '';
        """))
        conn.commit()

        print("6. Ensuring HNSW vector index on repo_chunks (embedding vector_cosine_ops)...")
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS repo_chunks_embedding_idx 
            ON repo_chunks USING hnsw (embedding vector_cosine_ops);
        """))
        conn.commit()

        print("7. Configuring HNSW iterative scan for pgvector 0.8+...")
        try:
            curr_db = db_info[0] if db_info else "askrepo"
            conn.execute(text(f"ALTER DATABASE {curr_db} SET hnsw.iterative_scan = 'relaxed_order';"))
            conn.commit()
            print(f"   Successfully set hnsw.iterative_scan = 'relaxed_order' on database '{curr_db}'.")
        except Exception as e:
            print(f"   Note: Could not alter database setting automatically ({e}). You can set it per session.")

    print("\nAll migrations and index optimizations completed successfully!")

if __name__ == "__main__":
    run_migrations()
