from fastapi import Body, FastAPI
from scripts.clone_repo import clone_repo
from utils.response_handlers import success_response,error_response
app = FastAPI()

@app.get("/")
def health():
    return {"msg":"hello world!"}


@app.post("/clone")
def clone_handler(repo_url: str = Body(..., embed=True)):
    if(repo_url==""):
        return error_response(400,"No Repo Url given","Invalid URL")

    resolvedRepoURL = clone_repo(repo_url)
    # start an async process for vectorizing the cloned repo
    return success_response(200,"Repo cloned succssfull",resolvedRepoURL)
