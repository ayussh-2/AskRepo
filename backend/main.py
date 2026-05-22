from fastapi import Body, FastAPI
from pathlib import Path
from scripts.clone_repo import clone_repo
# from scripts.test_ast import test_ast
from utils.response_handlers import success_response,error_response
from ast_parser import parse_directory,save_ast_results_to_json


app = FastAPI()

@app.get("/")
def health():
    # test_ast()
    return {"msg":"hello world!"}


@app.post("/clone")
def clone_handler(repo_url: str = Body(..., embed=True)):
    if(repo_url==""):
        return error_response(400,"No Repo Url given","Invalid URL")

    resolvedRepoURL = clone_repo(repo_url)
    results = parse_directory(resolvedRepoURL)
    save_ast_results_to_json(results,resolvedRepoURL)

    return success_response(200,"Repo cloned succssfull",{"repo_path": resolvedRepoURL, "files_parsed": len(results)})


