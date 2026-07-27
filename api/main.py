from typing import Optional
from fastapi import Body, FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session, select
from contextlib import asynccontextmanager
from fastapi.responses import StreamingResponse

from config import settings
from db.db import engine
from db.models import IngestionStatus
from services.gitlab import trigger_ingestion_pipeline
from services.rag import embed_query, search_chunk, chat_stream

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://github.com"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def success_response(status_code: int, message: str, data: Optional[dict] = None):
    return {"success": True, "message": message, "data": data}

def error_response(status_code: int, message: str, errors: Optional[str] = None):
    return {"success": False, "message": message, "errors": errors}

@app.get("/")
def health():
    return {"msg": "hello world!"}

@app.post("/ingest")
async def ingest_handler(repo_url: str = Body(..., embed=True)):
    if not repo_url:
        return error_response(400, "No Repo Url given", "Invalid URL")

    try:
      
        cleaned_url = repo_url.rstrip("/")
        if cleaned_url.endswith(".git"):
            cleaned_url = cleaned_url[:-4]
        parts = [p for p in cleaned_url.split("/") if p]
        repo_name = f"{parts[-2]}/{parts[-1]}" if len(parts) >= 2 else cleaned_url

        with Session(engine) as session:
            db_status = IngestionStatus(
                repo_name=repo_name,
                commit_sha="pending",
                status="pending"
            )
            session.add(db_status)
            session.commit()
            session.refresh(db_status)
            job_id = db_status.id

        pipeline_info = await trigger_ingestion_pipeline(repo_url)

        return success_response(202, f"GitLab ingestion pipeline triggered for {repo_name}", {
            "job_id": job_id,
            "pipeline_id": pipeline_info.get("id")
        })
    except Exception as e:
        return error_response(500, f"Failed to trigger ingestion pipeline: {e}")

@app.post("/query")
async def query_ask_handler(
    repo_name: str = Query(...),
    query: str = Body(..., embed=True),
    session_id: Optional[str] = Body(None, embed=True),
    top_k: int = 4
):
    if not query or not repo_name:
        return error_response(400, "query and repo_name are required")

    try:
        query_embedding = await embed_query(query)
        chunks = search_chunk(query_embedding, repo_name, top_k)

        if len(chunks) == 0:
            return error_response(400, "repo is not ingested!")

        return StreamingResponse(
            chat_stream(chunks, query, session_id),
            media_type="text/plain",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            }
        )
    except Exception as e:
        return error_response(500, f"Query execution failed: {e}")

@app.get("/status")
def get_ingestion_status_handler(job_id: Optional[int] = None, repo_name: Optional[str] = None):
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
                return error_response(404, f"Ingestion job with ID {job_id} not found")

            if repo_name is not None:
                db_status = session.exec(
                    select(IngestionStatus)
                    .where(IngestionStatus.repo_name == repo_name)
                    .order_by(IngestionStatus.updated_at.desc())
                    .limit(1)
                ).first()
                if db_status:
                    return success_response(200, "Ingestion status retrieved", {
                        "job_id": db_status.id,
                        "repo_name": db_status.repo_name,
                        "commit_sha": db_status.commit_sha,
                        "status": db_status.status,
                        "error_message": db_status.error_message,
                        "updated_at": db_status.updated_at.isoformat() if db_status.updated_at else None
                    })
                return error_response(404, f"Ingestion job for repo {repo_name} not found")

            return error_response(400, "job_id or repo_name is required!")
    except Exception as e:
        return error_response(500, f"Database error during status retrieval: {e}")

@app.get("/repos")
def get_repos_handler(page: int = 1, page_size: int = 10):
    if page < 1:
        page = 1
    if page_size < 1:
        page_size = 10

    try:
        import math
        from sqlalchemy import func
        with Session(engine) as session:
            stmt_ingestion = select(IngestionStatus.repo_name).distinct()
            subquery = stmt_ingestion.subquery()
            count_stmt = select(func.count()).select_from(subquery)
            total_count = session.exec(count_stmt).first() or 0

            paginate_stmt = select(subquery.c.repo_name).order_by(subquery.c.repo_name).offset((page - 1) * page_size).limit(page_size)
            repo_names = session.exec(paginate_stmt).all()

            repos_data = []
            for name in repo_names:
                latest_job = session.exec(
                    select(IngestionStatus)
                    .where(IngestionStatus.repo_name == name)
                    .order_by(IngestionStatus.updated_at.desc())
                    .limit(1)
                ).first()

                if latest_job:
                    repos_data.append({
                        "repo_name": latest_job.repo_name,
                        "latest_commit_sha": latest_job.commit_sha,
                        "status": latest_job.status,
                        "error_message": latest_job.error_message,
                        "updated_at": latest_job.updated_at.isoformat() if latest_job.updated_at else None
                    })

            total_pages = math.ceil(total_count / page_size) if total_count > 0 else 0

            return success_response(200, "Repositories listed successfully", {
                "repos": repos_data,
                "page": page,
                "page_size": page_size,
                "total_count": total_count,
                "total_pages": total_pages
            })
    except Exception as e:
        return error_response(500, f"Database error during repository listing: {e}")
