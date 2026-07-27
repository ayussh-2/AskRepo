import httpx
from config import settings

async def trigger_ingestion_pipeline(repo_url: str) -> dict:
    url = f"https://gitlab.com/api/v4/projects/{settings.gitlab_project_id}/trigger/pipeline"

    data = {
        "token": settings.gitlab_trigger_token,
        "ref": "main",  # default branch to run the pipeline
        "variables[TARGET_REPO_URL]": repo_url
    }

    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.post(url, data=data)
        if response.status_code >= 400:
            raise RuntimeError(f"GitLab API Error: {response.text}")
        return response.json()
