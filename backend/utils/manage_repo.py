import os
import subprocess
import sys

def get_commit_sha(repo_path: str) -> str:
    return subprocess.check_output(
        ["git", "rev-parse", "HEAD"], cwd=repo_path
    ).decode().strip()

def clone_repo(repo_url: str) -> list[str] | str:
    repo_name = repo_url.rstrip("/").split("/")[-1]
    utils_dir = os.path.dirname(os.path.abspath(__file__))
    base_dir = os.path.abspath(os.path.join(utils_dir, "..", "..", "repos"))
    os.makedirs(base_dir, exist_ok=True)

    cloned_folder = repo_url.rstrip("/").split("/")[-1].replace(".git", "")
    relative_folder_path = os.path.join(base_dir, cloned_folder)

    if os.path.exists(relative_folder_path):
        if sys.platform == "win32":
            subprocess.run(["rmdir", "/s", "/q", relative_folder_path], shell=True)
        else:
            subprocess.run(["rm", "-rf", relative_folder_path])

    result = subprocess.run(
        ["git", "clone", repo_url, relative_folder_path],
        capture_output=True,
        text=True
    )

    commit_sha = get_commit_sha(relative_folder_path)

    if result.returncode == 0:
        normalized_path = relative_folder_path.replace("\\", "/")
        return [normalized_path, commit_sha, repo_name]
    else:
        print(f"Clone error: {result.stderr}")
        return "error"

