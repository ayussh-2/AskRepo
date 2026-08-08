from lib.ast_parser.parser import parse_directory, generate_repo_tree_summary
from utils.chunker import chunk_parse_result, chunk_text_file, create_repo_summary_chunk
from utils.embedding import generate_and_store_embeddings
from utils.manage_repo import delete_repo_folder
from sqlmodel import Session, select, func
from db.db import engine
from db.models import IngestionStatus
from datetime import datetime, timezone

def update_ingestion_status(repo_name: str, commit_sha: str, status: str, error_message: str = None):
    try:
        with Session(engine) as session:
            db_status = session.exec(
                select(IngestionStatus)
                .where(func.lower(IngestionStatus.repo_name) == repo_name.lower())
                .order_by(IngestionStatus.created_at.desc())
                .limit(1)
            ).first()
            if db_status:
                db_status.status = status
                db_status.commit_sha = commit_sha
                db_status.error_message = error_message
                db_status.updated_at = datetime.now(timezone.utc)
                session.add(db_status)
                session.commit()
            else:
                new_status = IngestionStatus(
                    repo_name=repo_name,
                    commit_sha=commit_sha,
                    status=status,
                    error_message=error_message
                )
                session.add(new_status)
                session.commit()
    except Exception as e:
        print(f"Failed to update ingestion status for {repo_name}: {e}")

def run_ingestion(repo_path: str, repo_name: str, commit_sha: str):
    try:
        print(f"Parsing directory: {repo_path}")
        ast_results, text_results = parse_directory(repo_path)
        all_chunks = []

        for result in ast_results:
            all_chunks.extend(chunk_parse_result(result, repo_name, commit_sha))

        readme_text = ""
        for txt in text_results:
            if "readme" in txt["file_path"].lower():
                readme_text = txt["content"]
            all_chunks.extend(chunk_text_file(
                content=txt["content"], 
                file_path=txt["file_path"], 
                repo_name=repo_name, 
                commit_sha=commit_sha
            ))

        # Generate repository context summary chunk
        file_tree = generate_repo_tree_summary(repo_path)
        summary_chunk = create_repo_summary_chunk(repo_name, commit_sha, file_tree, readme_text)
        all_chunks.append(summary_chunk)

        generate_and_store_embeddings(all_chunks, repo_name, commit_sha)
        delete_repo_folder(repo_path)

        update_ingestion_status(repo_name, commit_sha, "completed")
        print(f"Successfully completed ingestion for {repo_name} at commit {commit_sha}")
    except Exception as e:
        print(f"Error in ingestion pipeline: {e}")
        update_ingestion_status(repo_name, commit_sha, "failed", str(e))

