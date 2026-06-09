from ast_parser.parser import parse_directory
from utils import chunk_parse_result,generate_and_store_embeddings,delete_repo_folder,error_response,success_response

def check_ingestion_status(job_id: int = None):
    from sqlmodel import Session, select
    from db.db import engine
    from db.models import IngestionStatus

    try:
        with Session(engine) as session:
            if job_id is not None:
                db_status = session.get(IngestionStatus, job_id)
                if db_status:
                    return success_response(200, "Ingestion status retrieved", {
                        "job_id": db_status.id,
                        "repo_name": db_status.repo_name,
                        "commit_sha": db_status.commit_sha,
                        "status": db_status.status,
                        "error_message": db_status.error_message,
                        "updated_at": db_status.updated_at.isoformat() if db_status.updated_at else None
                    })
                else:
                    return error_response(404, f"Ingestion job with ID {job_id} not found")

            

            return error_response(400, "Job id is required!")
    except Exception as e:
        return error_response(500, f"Database error during status retrieval: {e}")


def create_ingestion_status(repo_name: str, commit_sha: str) -> int:
    from sqlmodel import Session
    from db.db import engine
    from db.models import IngestionStatus

    try:
        with Session(engine) as session:
            db_status = IngestionStatus(
                repo_name=repo_name,
                commit_sha=commit_sha,
                status="pending"
            )
            session.add(db_status)
            session.commit()
            session.refresh(db_status)
            return db_status.id
    except Exception as e:
        print(f"Failed to create ingestion status in database: {e}")
        raise e


def update_ingestion_status_by_id(job_id: int, status: str, error_message: str = None):
    from sqlmodel import Session
    from db.db import engine
    from db.models import IngestionStatus
    from datetime import datetime, timezone

    try:
        with Session(engine) as session:
            db_status = session.get(IngestionStatus, job_id)
            if db_status:
                db_status.status = status
                db_status.error_message = error_message
                db_status.updated_at = datetime.now(timezone.utc)
                session.add(db_status)
                session.commit()
    except Exception as e:
        print(f"Failed to update ingestion status for job {job_id}: {e}")


def start_ingesting(job_id: int, repo_path: str, repo_name: str, commit_sha: str):
    try:
        print(f"Parsing directory: {repo_path}")
        ast_results, text_results = parse_directory(repo_path)
        all_chunks = []

        for result in ast_results:
            all_chunks.extend(chunk_parse_result(result, repo_name, commit_sha))

        # for text_file in text_results:
        #     all_chunks.extend(chunk_text_file(
        #         content=text_file["content"],
        #         file_path=text_file["file_path"],
        #         repo_name=repo_name,
        #         commit_sha=commit_sha
        #     ))

        generate_and_store_embeddings(all_chunks, repo_name, commit_sha)
        delete_repo_folder(repo_path)
        
        update_ingestion_status_by_id(job_id, "completed")

    except Exception as e:
        print(f"Error in background task: {e}")
        update_ingestion_status_by_id(job_id, "failed", str(e))

