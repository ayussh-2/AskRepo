import os
import argparse
import sys
from utils.manage_repo import clone_repo
from utils.ingestion import run_ingestion, update_ingestion_status
from db.db import create_db

def main():
    parser = argparse.ArgumentParser(description="GitLab Standalone Ingestion Worker CLI")
    parser.add_argument("--repo-url", type=str, help="Repository URL to ingest")
    args = parser.parse_args()

    repo_url = args.repo_url or os.environ.get("TARGET_REPO_URL")
    if not repo_url:
        print("Error: --repo-url or TARGET_REPO_URL environment variable is required.")
        sys.exit(1)

    print(f"Initializing Ingestion for: {repo_url}")
    create_db()

    # Determine temporary folder directory name
    cleaned_url = repo_url.rstrip("/")
    if cleaned_url.endswith(".git"):
        cleaned_url = cleaned_url[:-4]
    parts = [p for p in cleaned_url.split("/") if p]
    repo_name = f"{parts[-2]}/{parts[-1]}" if len(parts) >= 2 else cleaned_url

    try:
        # Update status to processing
        update_ingestion_status(repo_name, "cloning", "processing")

        repo_path, commit_sha, _ = clone_repo(repo_url)
        run_ingestion(repo_path, repo_name, commit_sha)
    except Exception as e:
        print(f"Pipeline Execution Failed: {e}")
        update_ingestion_status(repo_name, "error", "failed", str(e))
        sys.exit(1)

if __name__ == "__main__":
    main()
