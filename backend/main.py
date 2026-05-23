from fastapi import Body, FastAPI, BackgroundTasks
from utils import chunk_parse_result, clone_repo, success_response, error_response,output_to_txt
from ast_parser import parse_directory, save_ast_results_to_json


app = FastAPI()

@app.get("/")
def health():
    return {"msg":"hello world!"}



def start_ingesting(repo_path,repo_name,commit_sha):
    results = parse_directory(repo_path)
    all_chunks = []
    for result in results:
        all_chunks.extend(chunk_parse_result(result, repo_name, commit_sha))

    output_to_txt(all_chunks)






@app.post("/ingest")
def ingest_handler(background_tasks: BackgroundTasks, repo_url: str = Body(..., embed=True)):
    if(repo_url==""):
        return error_response(400,"No Repo Url given","Invalid URL")

    repo = clone_repo(repo_url)
    repo_path = repo[0]
    commit_sha = repo[1]
    repo_name = repo[2]

    background_tasks.add_task(start_ingesting, repo_path, repo_name, commit_sha)

    return success_response(200, "Repo cloned, processing started", {
        "repo_path": repo_path,
        "commit_sha": commit_sha,
        "repo_name": repo_name,
    })


