import httpx
from config import settings

async def trigger_ingestion_pipeline(repo_url: str) -> dict:
    url = f"https://gitlab.com/api/v4/projects/{settings.gitlab_project_id}/trigger/pipeline"

    data = {
        "token": settings.gitlab_trigger_token,
        "ref": "main",
        "variables[TARGET_REPO_URL]": repo_url,
        "variables[EMBEDDING_PROVIDER]": settings.embedding_provider or "modal",
        "variables[MODAL_EMBED_URL]": settings.modal_embed_url or "",
        "variables[MODAL_EMBED_TOKEN]": settings.modal_embed_token or "",
        "variables[PYTHONUNBUFFERED]": "1",
    }

    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.post(url, data=data)
        if response.status_code >= 400:
            raise RuntimeError(f"GitLab API Error: {response.text}")
        return response.json()
