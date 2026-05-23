from fastapi import Body, FastAPI, BackgroundTasks
from utils import chunk_parse_result, clone_repo, success_response, error_response,output_to_txt,chunk_text_file
from ast_parser import parse_directory


app = FastAPI()

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

        for text_file in text_results:
            all_chunks.extend(chunk_text_file(
                content=text_file["content"],
                file_path=text_file["file_path"],
                repo_name=repo_name,
                commit_sha=commit_sha
            ))

        print(f"Total chunks generated: {len(all_chunks)}")
        output_to_txt(all_chunks)
        print("Background ingestion complete!")

    except Exception as e:
        print(f"Error in background task: {e}")






@app.post("/ingest")
def ingest_handler(background_tasks: BackgroundTasks, repo_url: str = Body(..., embed=True)):
    if(repo_url==""):
        return error_response(400,"No Repo Url given","Invalid URL")

    repo_path,commit_sha,repo_name = clone_repo(repo_url)
    background_tasks.add_task(start_ingesting, repo_path, repo_name, commit_sha)

    return success_response(200, "Repo cloned, processing started", {
        "repo_path": repo_path,
        "commit_sha": commit_sha,
        "repo_name": repo_name,
    })


