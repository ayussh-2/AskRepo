from fastapi import Body, FastAPI, BackgroundTasks
from db.db import create_db
from utils import chunk_parse_result, clone_repo, delete_repo_folder, success_response, error_response,generate_and_store_embeddings,search_chunk,chat_stream
from ast_parser import parse_directory
from contextlib import asynccontextmanager
from fastapi.responses import StreamingResponse



app = FastAPI()

@asynccontextmanager
async def lifespan(app: FastAPI):
    create_db()    




@app.get("/")
def health():
    return {"msg":"hello world!"}

def start_ingesting(repo_path, repo_name, commit_sha):
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

    except Exception as e:
        print(f"Error in background task: {e}")


@app.post("/ingest")
def ingest_handler(background_tasks: BackgroundTasks, repo_url: str = Body(..., embed=True)):
    if repo_url == "":
        return error_response(400, "No Repo Url given", "Invalid URL")

    repo_path, commit_sha, repo_name = clone_repo(repo_url)

    background_tasks.add_task(start_ingesting, repo_path, repo_name, commit_sha)

    return success_response(200, "Repo cloned, processing started", {
        "repo_path": repo_path,
        "commit_sha": commit_sha,
        "repo_name": repo_name,
    })

@app.post("/query")
def query_ask_handler(
    repo_name: str,
    query: str = Body(..., embed=True),
    top_k: int = 5
):
    if not query or not repo_name:
        return error_response(400, "query and repo_name is required")
    
    chunks = search_chunk(query, repo_name, top_k)


    # response = chat(chunks,query)

    
    
    return StreamingResponse(
        chat_stream(chunks,query),
        media_type="text/plain"

    )