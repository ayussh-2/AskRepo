from typing import Optional
from pydantic import BaseModel
from fastapi import Body, FastAPI, Query, Depends

from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session, select
from contextlib import asynccontextmanager
from fastapi.responses import StreamingResponse

from sqlalchemy import func
from config import settings
from db.db import engine
from db.models import IngestionStatus
from services.gitlab import trigger_ingestion_pipeline
from services.rag import chat_stream_handler
from services.limiter import rate_limit, ingest_rate_limit
from services.auth import get_current_user
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("api")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://askrepo.ayussh.me",
        "https://github.com",
        "http://localhost:3000",
        "http://localhost:5173"
    ],
    allow_origin_regex=r"https://.*\.ayussh\.me",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def success_response(status_code: int, message: str, data: Optional[dict] = None):
    return {"success": True, "message": message, "data": data}

def error_response(status_code: int, message: str, errors: Optional[str] = None):
    return {"success": False, "message": message, "errors": errors}

from services.health import get_health_status

@app.get("/health")
@app.get("/")
def health_handler():
    return get_health_status()

import subprocess

def get_remote_commit_sha(repo_url: str) -> str:
    try:
        # Runs git ls-remote to query the HEAD commit SHA of the remote repo
        result = subprocess.run(
            ["git", "ls-remote", repo_url, "HEAD"],
            capture_output=True,
            text=True,
            check=True,
            timeout=10.0
        )
        output = result.stdout.strip()
        if output:
            return output.split()[0]
    except Exception as e:
        print(f"Error fetching remote commit SHA for {repo_url}: {e}")
    return ""

@app.post("/ingest", dependencies=[Depends(ingest_rate_limit)])
async def ingest_handler(
    repo_url: str = Body(..., embed=True),
    current_user: dict = Depends(get_current_user)
):
    if not repo_url:
        return error_response(400, "No Repo Url given", "Invalid URL")

    try:
        cleaned_url = repo_url.rstrip("/")
        if cleaned_url.endswith(".git"):
            cleaned_url = cleaned_url[:-4]
        parts = [p for p in cleaned_url.split("/") if p]
        repo_name = f"{parts[-2]}/{parts[-1]}" if len(parts) >= 2 else cleaned_url
        user_id = current_user.get("sub")

        logger.info(f"[Ingest] User '{user_id}' requested ingestion for repo '{repo_name}' ({repo_url})")

        remote_commit_sha = get_remote_commit_sha(repo_url)
        if not remote_commit_sha:
            logger.warning(f"[Ingest] Could not fetch remote commit SHA for '{repo_url}'")
            return error_response(400, "Could not fetch remote commit hash. Verify the repository URL is public and correct.")

        logger.info(f"[Ingest] Remote commit SHA for '{repo_name}': {remote_commit_sha}")

        with Session(engine) as session:
            latest_job = session.exec(
                select(IngestionStatus)
                .where(func.lower(IngestionStatus.repo_name) == repo_name.lower())
                .where(IngestionStatus.status == "completed")
                .order_by(IngestionStatus.updated_at.desc())
                .limit(1)
            ).first()

            if latest_job and latest_job.commit_sha == remote_commit_sha:
                logger.info(f"[Ingest] Repo '{repo_name}' is already indexed at commit {remote_commit_sha}. Reusing existing index for user '{user_id}'.")
                user_job = session.exec(
                    select(IngestionStatus)
                    .where(func.lower(IngestionStatus.repo_name) == repo_name.lower())
                    .where(IngestionStatus.user_id == user_id)
                    .where(IngestionStatus.status == "completed")
                    .where(IngestionStatus.commit_sha == remote_commit_sha)
                ).first()

                if not user_job:
                    logger.info(f"[Ingest] Creating repository association for user '{user_id}' on repo '{repo_name}'")
                    new_user_job = IngestionStatus(
                        repo_name=repo_name,
                        commit_sha=remote_commit_sha,
                        status="completed",
                        user_id=user_id
                    )
                    session.add(new_user_job)
                    session.commit()
                    session.refresh(new_user_job)
                    job_id = new_user_job.id
                else:
                    job_id = user_job.id

                return success_response(200, f"Repository is already up to date at commit {remote_commit_sha}", {
                    "job_id": job_id,
                    "repo_name": repo_name,
                    "commit_sha": remote_commit_sha,
                    "status": "completed",
                    "already_indexed": True
                })

            logger.info(f"[Ingest] Repo '{repo_name}' needs indexing. Creating new pending job for user '{user_id}'...")
            db_status = IngestionStatus(
                repo_name=repo_name,
                commit_sha=remote_commit_sha,
                status="pending",
                user_id=user_id
            )
            session.add(db_status)
            session.commit()
            session.refresh(db_status)
            job_id = db_status.id

        pipeline_info = await trigger_ingestion_pipeline(repo_url)
        logger.info(f"[Ingest] Pipeline triggered for '{repo_name}'. Pipeline ID: {pipeline_info.get('id')}")

        return success_response(202, f"GitLab ingestion pipeline triggered for {repo_name}", {
            "job_id": job_id,
            "pipeline_id": pipeline_info.get("id"),
            "already_indexed": False
        })
    except Exception as e:
        logger.error(f"[Ingest] Error during ingestion trigger for '{repo_url}': {e}", exc_info=True)
        return error_response(500, f"Failed to trigger ingestion pipeline: {e}")

from lib.redis import get_chat_history, clear_chat_history

class QueryRequest(BaseModel):
    query: str
    repo_name: Optional[str] = None
    top_k: Optional[int] = 4
    provider: Optional[str] = None
    model: Optional[str] = None

@app.post("/query", dependencies=[Depends(rate_limit)])
async def query_ask_handler(
    request_body: Optional[QueryRequest] = Body(None),
    repo_name: Optional[str] = Query(None),
    query: Optional[str] = Query(None),
    top_k: int = 4,
    provider: Optional[str] = Query(None),
    model: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user)
):
    final_query = (request_body.query if request_body and request_body.query else query) or ""
    final_repo = (request_body.repo_name if request_body and request_body.repo_name else repo_name) or ""
    final_top_k = request_body.top_k if (request_body and request_body.top_k) else top_k
    final_provider = request_body.provider if (request_body and request_body.provider) else provider
    final_model = request_body.model if (request_body and request_body.model) else model

    if not final_query or not final_repo:
        return error_response(400, "query and repo_name are required")

    user_id = current_user.get("sub", "anonymous")

    return StreamingResponse(
        chat_stream_handler(
            user_id,
            final_repo,
            final_query,
            final_top_k,
            provider=final_provider,
            model=final_model
        ),
        media_type="text/plain",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )



@app.get("/chat-history", dependencies=[Depends(rate_limit)])
def get_chat_history_handler(
    repo_name: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    user_id = current_user.get("sub", "anonymous")
    history = get_chat_history(user_id, repo_name)
    return success_response(200, "Chat history retrieved successfully", {
        "repo_name": repo_name,
        "history": history
    })

@app.delete("/chat-history", dependencies=[Depends(rate_limit)])
def clear_chat_history_handler(
    repo_name: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    user_id = current_user.get("sub", "anonymous")
    clear_chat_history(user_id, repo_name)
    return success_response(200, f"Chat history cleared for {repo_name}", None)

@app.get("/status", dependencies=[Depends(rate_limit)])
def get_ingestion_status_handler(job_id: Optional[int] = None, repo_name: Optional[str] = None):
    print(f"[DEBUG status] Query parameters: job_id={job_id}, repo_name={repo_name}")
    try:
        with Session(engine) as session:
            if job_id is not None:
                db_status = session.get(IngestionStatus, job_id)
                print(f"[DEBUG status] Querying by job_id={job_id}. Found: {db_status}")
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
                all_records = session.exec(
                    select(IngestionStatus).where(func.lower(IngestionStatus.repo_name) == repo_name.lower())
                ).all()
                print(f"[DEBUG status] All records for repo_name='{repo_name}': {[dict(id=r.id, repo_name=r.repo_name, status=r.status) for r in all_records]}")
                
                db_status = session.exec(
                    select(IngestionStatus)
                    .where(func.lower(IngestionStatus.repo_name) == repo_name.lower())
                    .order_by(IngestionStatus.updated_at.desc())
                    .limit(1)
                ).first()
                print(f"[DEBUG status] Querying by repo_name='{repo_name}'. Selected latest: {db_status}")
                
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
        print(f"[DEBUG status] Exception: {e}")
        return error_response(500, f"Database error during status retrieval: {e}")

@app.get("/repos", dependencies=[Depends(rate_limit)])
def get_repos_handler(
    page: int = 1,
    page_size: int = 10,
    current_user: dict = Depends(get_current_user)
):
    if page < 1:
        page = 1
    if page_size < 1:
        page_size = 10

    try:
        import math
        from sqlalchemy import func
        user_id = current_user.get("sub")
        with Session(engine) as session:
            stmt_ingestion = select(IngestionStatus.repo_name).where(IngestionStatus.user_id == user_id).distinct()
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

@app.get("/check-sync", dependencies=[Depends(rate_limit)])
def check_sync_handler(repo_name: str = Query(...)):
    try:
        with Session(engine) as session:
            latest_job = session.exec(
                select(IngestionStatus)
                .where(func.lower(IngestionStatus.repo_name) == repo_name.lower())
                .where(IngestionStatus.status == "completed")
                .order_by(IngestionStatus.updated_at.desc())
                .limit(1)
            ).first()
            
            if not latest_job:
                return error_response(404, f"Repository {repo_name} not found in database.")
                
            # Construct the GitHub URL from the repo_name
            repo_url = f"https://github.com/{latest_job.repo_name}"
            
            remote_commit_sha = get_remote_commit_sha(repo_url)
            if not remote_commit_sha:
                return error_response(400, "Could not fetch remote commit hash.")
                
            up_to_date = (latest_job.commit_sha == remote_commit_sha)
            return success_response(200, "Sync check complete", {
                "repo_name": latest_job.repo_name,
                "indexed_commit_sha": latest_job.commit_sha,
                "latest_commit_sha": remote_commit_sha,
                "up_to_date": up_to_date
            })
    except Exception as e:
        return error_response(500, f"Error checking repository synchronization status: {e}")
