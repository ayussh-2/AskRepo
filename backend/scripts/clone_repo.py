import os
import subprocess
import sys

def clone_repo(repo_url:str):
    base_dir = os.path.abspath("./repos/")
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

    if result.returncode == 0:
        return relative_folder_path
    else:
        print(f"Clone error: {result.stderr}")
        return "error"

