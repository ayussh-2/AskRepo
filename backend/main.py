from typing import Optional

from fastapi import Body, FastAPI, BackgroundTasks
from db.db import create_db
from utils import clone_repo, success_response, error_response,search_chunk,chat_stream,start_ingesting,check_ingestion_status,create_ingestion_status,list_repos,validate_repo_url
from contextlib import asynccontextmanager
from fastapi.responses import StreamingResponse

app = FastAPI()

@asynccontextmanager
async def lifespan(app: FastAPI):
    create_db()    

@app.get("/")
def health():
    return {"msg":"hello world!"}

@app.post("/ingest")
async def ingest_handler(background_tasks: BackgroundTasks, repo_url: str = Body(..., embed=True)):
    if repo_url == "":
        return error_response(400, "No Repo Url given", "Invalid URL")

    if not await validate_repo_url(repo_url):
        return error_response(400, "Invalid repository URL or repository is not accessible")

    repo_path, commit_sha, repo_name = clone_repo(repo_url)

    print(repo_url)

    job_id = create_ingestion_status(repo_name, commit_sha)

    background_tasks.add_task(start_ingesting, job_id, repo_path, repo_name, commit_sha)

    return success_response(200, "Repo cloned, processing started", {
        "job_id": job_id,
    })

@app.post("/query")
def query_ask_handler(
    repo_name: str,
    query: str = Body(..., embed=True),
    session_id: Optional[str] = Body(None, embed=True),
    top_k: int = 4
):
    if not query or not repo_name:
        return error_response(400, "query and repo_name is required")
    
    chunks = search_chunk(query, repo_name, top_k)
    if(len(chunks)==0):
        return error_response(400,"repo is not ingested!")
    
    return StreamingResponse(
        chat_stream(chunks,query,session_id),
        media_type="text/plain"

    )

@app.get("/status")
def get_ingestion_status_handler(job_id: Optional[int] = None, repo_name: Optional[str] = None):
    return check_ingestion_status(job_id, repo_name)

@app.get("/repos")
def get_repos_handler(page: int = 1, page_size: int = 10):
    return list_repos(page, page_size)
