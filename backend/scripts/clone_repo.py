import os
import subprocess

def clone_repo(repo_url:str):
    result = subprocess.run(
    ["git", "clone", repo_url],
    cwd="repos",
    capture_output=True,
    text=True
)
    base_dir = "./repos/"
    os.makedirs(base_dir,exist_ok=True)

    if result.returncode==0:
        cloned_folder = repo_url.rstrip("/").split("/")[-1].replace(".git", "")
        relative_folder_path = os.path.join(base_dir, cloned_folder)

        print(relative_folder_path)
        return relative_folder_path
    else:
        print(result.stderr)
        return "error"

