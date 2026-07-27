import subprocess
import time

import modal

app = modal.App("askrepo-embed")


from fastapi import HTTPException, Request

image = (
    modal.Image.debian_slim()
    .apt_install("curl", "zstd")
    .pip_install("fastapi[standard]", "httpx")
    .run_commands(
        "curl -fsSL https://ollama.com/install.sh | sh",
        "ollama serve & server_pid=$! && sleep 5 && ollama pull embeddinggemma && kill $server_pid",
    )
)

EMBED_TOKEN = modal.Secret.from_name("askrepo-embed-token")


@app.cls(
    image=image,
    cpu=2.0,
    memory=2048,
    scaledown_window=120,  
    secrets=[EMBED_TOKEN],
)
class EmbedServer:
    @modal.enter()
    def start_ollama(self):
        self.proc = subprocess.Popen(["ollama", "serve"])
        time.sleep(3) 

    @modal.fastapi_endpoint(method="POST")
    def embed(self, payload: dict, request: Request):
        import os

        import httpx

        auth = request.headers.get("authorization", "")
        if auth != f"Bearer {os.environ['MODAL_EMBED_TOKEN']}":
            raise HTTPException(status_code=401, detail="Unauthorized")

        query = payload.get("query")
        if not query:
            raise HTTPException(status_code=400, detail="Missing 'query' field")

        
        prefixed_query = f"task: search result | query: {query}"

        response = httpx.post(
            "http://localhost:11434/api/embeddings",
            json={"model": "embeddinggemma", "prompt": prefixed_query},
            timeout=30.0,
        )
        response.raise_for_status()
        return {"embedding": response.json()["embedding"]}
