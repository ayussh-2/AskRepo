import os
import sys
from dotenv import load_dotenv

utils_dir = os.path.dirname(os.path.abspath(__file__))
env_path = os.path.abspath(os.path.join(utils_dir, "..", "api", ".env"))
load_dotenv(dotenv_path=env_path)

from sqlmodel import create_engine, SQLModel

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
    engine = create_engine(db_url, echo=True)
    
    from sqlalchemy import text
    with engine.connect() as conn:
        print("Enabling pgvector extension...")
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
        conn.commit()
    
    print("Creating tables if they do not exist...")
    SQLModel.metadata.create_all(engine)
    print("Migrations completed successfully!")

if __name__ == "__main__":
    run_migrations()
