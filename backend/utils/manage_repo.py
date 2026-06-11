import os
import subprocess
import sys
import httpx


def get_commit_sha(repo_path: str) -> str:
    return subprocess.check_output(
        ["git", "rev-parse", "HEAD"], cwd=repo_path
    ).decode().strip()

def clone_repo(repo_url: str) -> tuple[str, str, str]:
    cleaned_url = repo_url.rstrip("/")
    if cleaned_url.endswith(".git"):
        cleaned_url = cleaned_url[:-4]
    
    cleaned_url = cleaned_url.replace(":", "/")
    parts = [p for p in cleaned_url.split("/") if p]
    
    if len(parts) >= 2:
        repo_name = f"{parts[-2]}/{parts[-1]}"
    elif len(parts) == 1:
        repo_name = parts[0]
    else:
        repo_name = "unknown"

    utils_dir = os.path.dirname(os.path.abspath(__file__))
    base_dir = os.path.abspath(os.path.join(utils_dir, "..", "..", "repos"))
    
    relative_folder_path = os.path.normpath(os.path.join(base_dir, repo_name))
    os.makedirs(os.path.dirname(relative_folder_path), exist_ok=True)


    if os.path.exists(relative_folder_path):
        if sys.platform == "win32":
            normalized_path = os.path.normpath(relative_folder_path)
            subprocess.run(f'rmdir /s /q "{normalized_path}"', shell=True)
        else:
            subprocess.run(["rm", "-rf", relative_folder_path])

    result = subprocess.run(
        ["git", "clone", repo_url, relative_folder_path],
        capture_output=True,
        text=True
    )

    if result.returncode == 0:
        commit_sha = get_commit_sha(relative_folder_path)
        normalized_path = relative_folder_path.replace("\\", "/")

        return normalized_path, commit_sha, repo_name
    else:
        print(f"Clone error: {result.stderr}")
        raise RuntimeError(f"Failed to clone repository: {result.stderr}")

def delete_repo_folder(repo_path: str):
    if os.path.exists(repo_path):
        if sys.platform == "win32":
            normalized_path = os.path.normpath(repo_path)
            subprocess.run(f'rmdir /s /q "{normalized_path}"', shell=True)
        else:
            subprocess.run(["rm", "-rf", repo_path])
        print(f"Deleted repository folder: {repo_path}")


async def validate_repo_url(repo_url: str) -> bool:
    try:
        async with httpx.AsyncClient(follow_redirects=True) as client:
            response = await client.get(repo_url)
            return response.status_code == 200
    except Exception:
        return False