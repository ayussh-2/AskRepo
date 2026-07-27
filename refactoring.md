# Implementation Plan: Codebase Reorganization & Decoupling

This plan outlines the steps to refactor and decouple the `repo-assistant` codebase into three distinct components:

1. `api/`: A lightweight FastAPI service that processes requests, schedules ingestion via GitLab triggers, and handles RAG queries using pgvector database similarity.
2. `worker/`: A standalone ingestion engine executed by GitLab CI/CD pipelines to clone code, parse AST structures, generate embeddings locally using Ollama, and save vector records to Neon DB. **Unchanged from before** — bulk/ingestion embedding stays on GitLab CI.
3. `embed-service/`: A Modal.com serverless function that runs Ollama + `embeddinggemma` on demand, used **only** to embed the user's live query text. This replaces the previous plan of calling a locally-hosted Ollama instance from `api/`, since the 1GB VM can't run Ollama without risking OOM. Modal scales to zero between requests, so there's no idle cost, and it stays within the free monthly credit for this workload.

> [!NOTE]
> **Embedding model changed from `nomic-embed-text` to `embeddinggemma`.** Nothing has been ingested yet, so this is a clean swap rather than a migration. `embeddinggemma` scores better on code-retrieval benchmarks than the general-purpose `nomic-embed-text`, while still being small enough (300M params, ~622MB at default quant) to run comfortably on GitLab CI runners and a Modal CPU container. It also outputs 768-dim embeddings by default (with optional truncation to 512/256/128 via Matryoshka Representation Learning), so `RepoChunk.embedding`'s `Vector(768)` column doesn't need to change.

---

## Reorganization & Separation of Concerns

We will reorganize the codebase from the current `backend/` directory into two clean, self-contained Python packages under `/repo-assistant/api` and `/repo-assistant/worker`.

### Proposed Directory Layout

```
/repo-assistant
├── api/                             # Lightweight API server
│   ├── main.py                      # FastAPI endpoints (/ingest, /query, /health, /status, /repos)
│   ├── config.py                    # Environment settings (Gemini, DB, GitLab Trigger, Ollama URL)
│   ├── db/
│   │   ├── db.py                    # Neon DB connection & pgvector read models
│   │   └── models.py                # SQLModel schemas shared with DB (RepoChunk, IngestionStatus)
│   ├── lib/
│   │   └── redis.py                 # Redis connection client for chat history management
│   ├── services/
│   │   ├── gitlab.py                # Service to trigger GitLab CI/CD Pipeline API via HTTP POST
│   │   └── rag.py                   # Chat and vector retrieval logic (HTTP Ollama Embeddings + Gemini RAG)
│   ├── requirements.txt             # Minimal dependencies (FastAPI, uvicorn, sqlmodel, google-genai, tiktoken, redis, pgvector, psycopg)
│   └── .env.example
│
├── worker/                          # Standalone Ingestion Engine (To be hosted on GitLab)
│   ├── cli.py                       # CLI Entrypoint for GitLab Runner
│   ├── db/
│   │   ├── db.py                    # Neon DB connection
│   │   └── models.py                # SQLModel schemas for writing vector chunks
│   ├── lib/
│   │   └── ast_parser/              # AST tree-sitter parsing logic (cloned from backend/lib)
│   ├── utils/
│   │   ├── chunker.py               # Token-based text and AST symbol chunker
│   │   ├── config.py                # DB settings loader
│   │   ├── constants.py             # Parser & token constants (encoder models, overlaps, skip lists)
│   │   ├── embedding.py             # Ollama API local integration (model pull + chunk vector gen)
│   │   ├── ingestion.py             # Full ingestion pipeline orchestrator
│   │   └── manage_repo.py           # Git clone and teardown utilities
│   ├── requirements.txt             # Heavy dependencies (tree-sitter, ollama, tiktoken, sqlmodel, psycopg, etc.)
│   ├── .gitlab-ci.yml               # GitLab pipeline definition runner
│   └── .env.example
│
├── embed-service/                   # Modal.com serverless query-embedding function
│   ├── embed_app.py                 # Modal App: runs Ollama + embeddinggemma, exposes a web endpoint
│   ├── requirements.txt             # modal
│   └── .env.example                 # MODAL_EMBED_TOKEN (shared secret for the endpoint)
```

---

## User Review Required

> [!IMPORTANT]
> **API Portability & Dependencies**:
>
> - We have added `google-genai`, `tiktoken`, and `redis` to `api/requirements.txt`. These are required to handle RAG response generation and chat session history.
> - The `api/` service does **not** import or depend on `tree-sitter`, `tree-sitter-languages`, or `ollama` SDK.

> [!NOTE]
> **Query Embeddings**:
>
> - The query embedding generation in the API will be performed using a raw HTTP POST request to the **Modal-hosted embedding endpoint** (`{MODAL_EMBED_URL}`) via `httpx`, instead of a locally-hosted Ollama instance.
> - The `api/` VM has only 1GB RAM and cannot run Ollama itself without risking OOM, so query embedding is offloaded entirely to Modal, which scales to zero and runs `embeddinggemma` — the same model the worker uses — so query vectors and stored vectors stay in the same embedding space.
> - The request includes a bearer token (`MODAL_EMBED_TOKEN`) to prevent the public Modal endpoint from being called by anyone else.
> - This keeps the API lightweight without installing the heavy local Ollama Python SDK, and also removes the need to run Ollama on the API's VM at all.
> - `embeddinggemma` requires task-specific prompt prefixes to hit its benchmarked quality — queries must be prefixed with `task: search result | query: ` before embedding, and documents with `title: none | text: `. Both `embed-service/embed_app.py` and `worker/utils/embedding.py` apply these below. Google's model card also lists a "Code Query" task variant meant specifically for retrieving code via natural-language queries — worth checking the current model card for its exact prompt string and A/B testing it against the default `search result` prefix, since it may outperform the default for this use case.

---

## Open Questions

We have agreed to keep the route endpoint as `/query`, to host the database model logic independently in each folder, and to split query embedding into a third `embed-service/` component on Modal rather than hosting Ollama on the API's 1GB VM. Bulk/ingestion embedding remains on GitLab CI, unchanged.

One item to decide before deploying: whether to keep containers warm on Modal (avoids cold-start latency on `/query` but consumes free credit faster) or let them scale to zero between requests (default choice for a personal project, small latency hit on the first query after idle).

---

## Proposed Changes

### 1. API Component (api/)

#### [NEW] `api/requirements.txt`

Minimal requirements file to execute the API.

```requirements
fastapi==0.136.1
uvicorn==0.47.0
sqlmodel==0.0.38
google-genai==2.8.0
tiktoken==0.13.0
redis==8.0.0
pgvector==0.4.2
psycopg-binary==3.3.4
pydantic-settings==2.14.1
httpx==0.28.1
```

#### [NEW] `api/config.py`

Settings configuration using `pydantic-settings`.

```python
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    gemini_api_key: str = ""
    database_url: str = "postgresql://user:password@localhost/dbname"
    redis_url: str = "redis://localhost:6379/0"
    session_ttl: int = 86400
    gemini_llm_model: str = "gemini-3.1-flash-lite"
    modal_embed_url: str = "https://your-workspace--askrepo-embed-embed.modal.run"
    modal_embed_token: str = ""
    embedding_model: str = "embeddinggemma"

    # GitLab Trigger settings
    gitlab_project_id: str = ""
    gitlab_trigger_token: str = ""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

settings = Settings()
```

#### [NEW] `api/db/db.py`

Database connections for the API.

```python
from sqlmodel import create_engine, Session
from config import settings

engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,
    pool_recycle=300,
    connect_args={"connect_timeout": 30}
)

def get_session():
    with Session(engine) as session:
        yield session
```

#### [NEW] `api/db/models.py`

SQLModel schemas for the API (read-only for chunks, read-write for status).

```python
from sqlmodel import SQLModel, Field
from pgvector.sqlalchemy import Vector
from sqlalchemy import Column, DateTime, func
from typing import Optional
from datetime import datetime, timezone

class RepoChunk(SQLModel, table=True):
    __tablename__ = "repo_chunks"

    id: Optional[int] = Field(default=None, primary_key=True)
    repo_name: str = Field(index=True)
    commit_sha: str
    file_path: str
    symbol_name: Optional[str] = None
    chunk_text: str
    embedding: Optional[list[float]] = Field(
        default=None, sa_column=Column(Vector(768))
    )

class IngestionStatus(SQLModel, table=True):
    __tablename__ = "ingestion_statuses"

    id: Optional[int] = Field(default=None, primary_key=True)
    repo_name: str = Field(index=True)
    commit_sha: str = Field(index=True)
    status: str = Field(default="pending")  # "pending", "completed", "failed"
    error_message: Optional[str] = Field(default=None, nullable=True)
    created_at: Optional[datetime] = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column=Column(DateTime(timezone=True), server_default=func.now())
    )
    updated_at: Optional[datetime] = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column=Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    )
```

#### [NEW] `api/lib/redis.py`

Redis client code moved from `backend/lib/redis.py`.

```python
import redis
import json
from typing import List, Dict
from config import settings

redis_client = redis.from_url(
    settings.redis_url,
    decode_responses=True
)

SESSION_TTL = settings.session_ttl

def get_session_key(session_id: str) -> str:
    return f"chat_session:{session_id}"

def get_chat_history(session_id: str) -> List[Dict[str, str]]:
    key = get_session_key(session_id)
    messages_json = redis_client.lrange(key, 0, -1)
    return [json.loads(m) for m in messages_json]

def add_chat_message(session_id: str, role: str, content: str):
    key = get_session_key(session_id)
    message_data = {"role": role, "content": content}
    redis_client.rpush(key, json.dumps(message_data))
    redis_client.expire(key, SESSION_TTL)

def save_all_history(session_id: str, history: List[Dict[str, str]]):
    key = get_session_key(session_id)
    redis_client.delete(key)
    if history:
        redis_client.rpush(key, *[json.dumps(m) for m in history])
        redis_client.expire(key, SESSION_TTL)
```

#### [NEW] `api/services/gitlab.py`

Asynchronous logic to trigger the GitLab Pipeline trigger API.

```python
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
```

#### [NEW] `api/services/rag.py`

Encapsulates embedding generation via raw HTTP and RAG querying / generation from Gemini.

```python
import httpx
from collections import defaultdict
from typing import List, Dict
from google import genai
from google.genai import types
import tiktoken
from config import settings
from db.db import engine
from db.models import RepoChunk
from sqlmodel import Session, select
from lib.redis import get_chat_history, add_chat_message, save_all_history

client = genai.Client(api_key=settings.gemini_api_key)

async def embed_query(query: str) -> List[float]:
    headers = {"Authorization": f"Bearer {settings.modal_embed_token}"}
    payload = {"query": query}

    # Modal cold starts (container spin-up + Ollama serve) can take several
    # seconds if the endpoint hasn't been hit recently, so this timeout is
    # generous compared to a typical local call.
    async with httpx.AsyncClient(timeout=30.0) as http_client:
        response = await http_client.post(
            settings.modal_embed_url, json=payload, headers=headers
        )
        response.raise_for_status()
        data = response.json()
        return data["embedding"]

def search_chunk(query_embedding: List[float], repo_name: str, top_k: int = 4) -> List[RepoChunk]:
    with Session(engine) as session:
        results = session.exec(
            select(RepoChunk)
            .where(RepoChunk.repo_name == repo_name)
            .order_by(RepoChunk.embedding.cosine_distance(query_embedding))
            .limit(top_k)
        ).all()

        file_paths = list(set(r.file_path for r in results))

        imports = session.exec(
            select(RepoChunk)
            .where(RepoChunk.repo_name == repo_name)
            .where(RepoChunk.file_path.in_(file_paths))
            .where(RepoChunk.symbol_name == "")
        ).all()

    seen_ids = {r.id for r in results}
    extra = [i for i in imports if i.id not in seen_ids]
    return results + extra

def sanitize_context(chunks, max_chars: int = 12000) -> str:
    seen = set()
    unique_chunks = []

    for chunk in chunks:
        key = (chunk.file_path, chunk.symbol_name, chunk.chunk_text)
        if key not in seen:
            seen.add(key)
            unique_chunks.append(chunk)

    files = defaultdict(lambda: {"symbols": set(), "snippets": []})
    for chunk in unique_chunks:
        symbol_name = chunk.symbol_name.strip() if chunk.symbol_name else ""
        chunk_text = chunk.chunk_text.strip() if chunk.chunk_text else ""

        if symbol_name:
            files[chunk.file_path]["symbols"].add(symbol_name)
        if chunk_text:
            files[chunk.file_path]["snippets"].append(chunk_text)

    context_parts = []
    current_size = 0

    for file_path, data in files.items():
        section = [f"[FILE] {file_path}"]
        if data["symbols"]:
            section.append(f"[SYMBOLS] {', '.join(sorted(data['symbols']))}")
        section.append("")

        seen_snippets = set()
        for snippet in data["snippets"]:
            if snippet not in seen_snippets:
                seen_snippets.add(snippet)
                section.append(snippet)
                section.append("")

        section.append("---")
        section_text = "\n".join(section)

        if current_size + len(section_text) > max_chars:
            break

        context_parts.append(section_text)
        current_size += len(section_text)

    return "\n\n".join(context_parts)

def estimate_tokens(text: str) -> int:
    encoding = tiktoken.get_encoding("cl100k_base")
    return len(encoding.encode(text))

def summarize_old_messages(old_messages: List[Dict[str, str]]) -> str:
    formatted_text = "\n".join([f"{msg['role']}: {msg['content']}" for msg in old_messages])
    prompt = f"Summarize the key information and questions discussed in this conversation context in 2-3 sentences:\n{formatted_text}"
    response = client.models.generate_content(
        model=settings.gemini_llm_model,
        contents=prompt
    )
    return response.text.strip()

def process_history_and_summarize(session_id: str, new_query: str) -> List[Dict[str, str]]:
    history = get_chat_history(session_id)
    total_tokens = sum(estimate_tokens(m["content"]) for m in history) + estimate_tokens(new_query)

    if total_tokens > 6000:
        keep_count = 4
        if len(history) > keep_count:
            to_summarize = history[:-keep_count]
            to_keep = history[-keep_count:]
            summary_text = summarize_old_messages(to_summarize)
            summary_message = {
                "role": "model",
                "content": f"[Summary of previous conversation: {summary_text}]"
            }
            history = [summary_message] + to_keep
            save_all_history(session_id, history)

    return history

async def chat_stream(chunks: List[RepoChunk], query: str, session_id: str):
    history = []
    if session_id:
        history = process_history_and_summarize(session_id, query)
        add_chat_message(session_id, "user", query)

    context = sanitize_context(chunks)
    system_instruction = f"""
    You are a chatbot called askRepo.
    Rules:
    - Answer ONLY using the repository context.
    - Mention relevant file paths when possible.
    - If the answer is not contained in the context, say:
      "I could not find that information in the retrieved repository context."
    - Do not invent code or architecture details.
    - When showing code, use markdown code blocks with the correct language.
    - You do not need to add "Based on the repository context", just keep the conversation friendly.
    Repository Context:
    {context}
    """.strip()

    contents = []
    for msg in history:
        contents.append(
            types.Content(
                role=msg["role"],
                parts=[types.Part.from_text(text=msg["content"])]
            )
        )
    contents.append(
        types.Content(
            role="user",
            parts=[types.Part.from_text(text=query)]
        )
    )

    config = types.GenerateContentConfig(system_instruction=system_instruction)
    response = await client.aio.models.generate_content_stream(
        model=settings.gemini_llm_model,
        contents=contents,
        config=config
    )

    full_response = ""
    async for chunk in response:
        full_response += chunk.text
        yield chunk.text

    if session_id:
        add_chat_message(session_id, "model", full_response)
```

#### [NEW] `api/main.py`

FastAPI router. Direct replacement of `backend/main.py`.

```python
from typing import Optional
from fastapi import Body, FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session, select
from contextlib import asynccontextmanager
from fastapi.responses import StreamingResponse, JSONEncoder

from config import settings
from db.db import engine
from db.models import IngestionStatus
from services.gitlab import trigger_ingestion_pipeline
from services.rag import embed_query, search_chunk, chat_stream

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://github.com"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def success_response(status_code: int, message: str, data: Optional[dict] = None):
    return {"success": True, "message": message, "data": data}

def error_response(status_code: int, message: str, errors: Optional[str] = None):
    return {"success": False, "message": message, "errors": errors}

@app.get("/")
def health():
    return {"msg": "hello world!"}

@app.post("/ingest")
async def ingest_handler(repo_url: str = Body(..., embed=True)):
    if not repo_url:
        return error_response(400, "No Repo Url given", "Invalid URL")

    # Reorganize Git trigger logic to fire off GitLab pipeline
    try:
        # Create pipeline run status entry in Neon DB
        # extract repo name from url
        cleaned_url = repo_url.rstrip("/")
        if cleaned_url.endswith(".git"):
            cleaned_url = cleaned_url[:-4]
        parts = [p for p in cleaned_url.split("/") if p]
        repo_name = f"{parts[-2]}/{parts[-1]}" if len(parts) >= 2 else cleaned_url

        with Session(engine) as session:
            db_status = IngestionStatus(
                repo_name=repo_name,
                commit_sha="pending",
                status="pending"
            )
            session.add(db_status)
            session.commit()
            session.refresh(db_status)
            job_id = db_status.id

        # Trigger Pipeline
        pipeline_info = await trigger_ingestion_pipeline(repo_url)

        return success_response(202, f"GitLab ingestion pipeline triggered for {repo_name}", {
            "job_id": job_id,
            "pipeline_id": pipeline_info.get("id")
        })
    except Exception as e:
        return error_response(500, f"Failed to trigger ingestion pipeline: {e}")

@app.post("/query")
async def query_ask_handler(
    repo_name: str = Query(...),
    query: str = Body(..., embed=True),
    session_id: Optional[str] = Body(None, embed=True),
    top_k: int = 4
):
    if not query or not repo_name:
        return error_response(400, "query and repo_name are required")

    try:
        query_embedding = await embed_query(query)
        chunks = search_chunk(query_embedding, repo_name, top_k)

        if len(chunks) == 0:
            return error_response(400, "repo is not ingested!")

        return StreamingResponse(
            chat_stream(chunks, query, session_id),
            media_type="text/plain",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            }
        )
    except Exception as e:
        return error_response(500, f"Query execution failed: {e}")

@app.get("/status")
def get_ingestion_status_handler(job_id: Optional[int] = None, repo_name: Optional[str] = None):
    try:
        with Session(engine) as session:
            if job_id is not None:
                db_status = session.get(IngestionStatus, job_id)
                if db_status:
                    return success_response(200, "Ingestion status retrieved", {
                        "job_id": db_status.id,
                        "repo_name": db_status.repo_name,
                        "commit_sha": db_status.commit_sha,
                        "status": db_status.status,
                        "error_message": db_status.error_message,
                        "updated_at": db_status.updated_at.isoformat() if db_status.updated_at else None
                    })
                return error_response(404, f"Ingestion job with ID {job_id} not found")

            if repo_name is not None:
                db_status = session.exec(
                    select(IngestionStatus)
                    .where(IngestionStatus.repo_name == repo_name)
                    .order_by(IngestionStatus.updated_at.desc())
                    .limit(1)
                ).first()
                if db_status:
                    return success_response(200, "Ingestion status retrieved", {
                        "job_id": db_status.id,
                        "repo_name": db_status.repo_name,
                        "commit_sha": db_status.commit_sha,
                        "status": db_status.status,
                        "error_message": db_status.error_message,
                        "updated_at": db_status.updated_at.isoformat() if db_status.updated_at else None
                    })
                return error_response(404, f"Ingestion job for repo {repo_name} not found")

            return error_response(400, "job_id or repo_name is required!")
    except Exception as e:
        return error_response(500, f"Database error during status retrieval: {e}")

@app.get("/repos")
def get_repos_handler(page: int = 1, page_size: int = 10):
    if page < 1:
        page = 1
    if page_size < 1:
        page_size = 10

    try:
        import math
        from sqlalchemy import func
        with Session(engine) as session:
            stmt_ingestion = select(IngestionStatus.repo_name).distinct()
            subquery = stmt_ingestion.subquery()
            count_stmt = select(func.count()).select_from(subquery)
            total_count = session.exec(count_stmt).first() or 0

            paginate_stmt = select(subquery.c.repo_name).order_by(subquery.c.repo_name).offset((page - 1) * page_size).limit(page_size)
            repo_names = session.exec(paginate_stmt).all()

            repos_data = []
            for name in repo_names:
                latest_job = session.exec(
                    select(IngestionStatus)
                    .where(IngestionStatus.repo_name == name)
                    .order_by(IngestionStatus.updated_at.desc())
                    .limit(1)
                ).first()

                if latest_job:
                    repos_data.append({
                        "repo_name": latest_job.repo_name,
                        "latest_commit_sha": latest_job.commit_sha,
                        "status": latest_job.status,
                        "error_message": latest_job.error_message,
                        "updated_at": latest_job.updated_at.isoformat() if latest_job.updated_at else None
                    })

            total_pages = math.ceil(total_count / page_size) if total_count > 0 else 0

            return success_response(200, "Repositories listed successfully", {
                "repos": repos_data,
                "page": page,
                "page_size": page_size,
                "total_count": total_count,
                "total_pages": total_pages
            })
    except Exception as e:
        return error_response(500, f"Database error during repository listing: {e}")
```

#### [NEW] `api/.env.example`

```env
DATABASE_URL=postgresql://user:password@localhost/dbname
GEMINI_API_KEY=AIzaSy...
REDIS_URL=redis://localhost:6379/0
MODAL_EMBED_URL=https://your-workspace--askrepo-embed-embed.modal.run
MODAL_EMBED_TOKEN=your_shared_secret_token
GITLAB_PROJECT_ID=your_gitlab_project_id
GITLAB_TRIGGER_TOKEN=your_gitlab_trigger_token
```

---

### 2. Ingestion Worker Component (worker/)

#### [NEW] `worker/requirements.txt`

```requirements
sqlmodel==0.0.38
pgvector==0.4.2
psycopg-binary==3.3.4
pydantic-settings==2.14.1
ollama==0.6.2
tree-sitter==0.21.3
tree-sitter-languages==1.10.2
tiktoken==0.13.0
python-dotenv==1.2.2
```

#### [NEW] `worker/utils/config.py`

```python
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    database_url: str = "postgresql://user:password@localhost/dbname"
    ollama_base_url: str = "http://localhost:11434"
    embedding_model: str = "embeddinggemma"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

settings = Settings()
```

#### [NEW] `worker/db/db.py`

```python
from sqlmodel import create_engine, Session, SQLModel
from utils.config import settings

engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,
    pool_recycle=300,
    connect_args={"connect_timeout": 30}
)

def create_db():
    SQLModel.metadata.create_all(engine)
```

#### [NEW] `worker/db/models.py`

```python
from sqlmodel import SQLModel, Field
from pgvector.sqlalchemy import Vector
from sqlalchemy import Column, DateTime, func
from typing import Optional
from datetime import datetime, timezone

class RepoChunk(SQLModel, table=True):
    __tablename__ = "repo_chunks"

    id: Optional[int] = Field(default=None, primary_key=True)
    repo_name: str = Field(index=True)
    commit_sha: str
    file_path: str
    symbol_name: Optional[str] = None
    chunk_text: str
    embedding: Optional[list[float]] = Field(
        default=None, sa_column=Column(Vector(768))
    )

class IngestionStatus(SQLModel, table=True):
    __tablename__ = "ingestion_statuses"

    id: Optional[int] = Field(default=None, primary_key=True)
    repo_name: str = Field(index=True)
    commit_sha: str = Field(index=True)
    status: str = Field(default="pending")
    error_message: Optional[str] = Field(default=None, nullable=True)
    created_at: Optional[datetime] = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column=Column(DateTime(timezone=True), server_default=func.now())
    )
    updated_at: Optional[datetime] = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column=Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    )
```

#### [NEW] `worker/utils/embedding.py`

Ollama embedding generator.

```python
import ollama
from sqlmodel import Session
from db.db import engine
from db.models import RepoChunk
from utils.config import settings

client = ollama.Client(host=settings.ollama_base_url)

# embeddinggemma expects a task-specific prefix prepended to every input to
# hit its benchmarked quality. Documents use "title: none | text: " unless a
# real title is available (a file path could be passed here as a light-weight
# title if that turns out to help — worth testing).
DOCUMENT_PREFIX = "title: none | text: "

def embed(contents):
    if isinstance(contents, str):
        texts = [contents]
    else:
        texts = list(contents)

    prefixed_texts = [f"{DOCUMENT_PREFIX}{t}" for t in texts]

    response = client.embed(
        model=settings.embedding_model,
        input=prefixed_texts
    )
    return response.embeddings

def generate_and_store_embeddings(all_chunks, repo_name, commit_sha):
    if not all_chunks:
        print("No chunks provided for embedding.")
        return

    print(f"Preparing {len(all_chunks)} chunks for embedding...")
    contents = [chunk.text for chunk in all_chunks]

    valid_chunks = []
    all_embeddings = []
    batch_size = 100

    print("Generating embeddings...")
    for i in range(0, len(contents), batch_size):
        batch_contents = contents[i:i + batch_size]
        batch_chunks = all_chunks[i:i + batch_size]

        try:
            result = embed(batch_contents)
            if result:
                all_embeddings.extend(result)
                valid_chunks.extend(batch_chunks)
        except Exception as e:
            print(f"Error on batch {i} to {i + len(batch_contents)}: {e}")

    with Session(engine) as session:
        for i in range(0, len(valid_chunks), batch_size):
            batch_chunks = valid_chunks[i:i + batch_size]
            batch_embeddings = all_embeddings[i:i + batch_size]

            for chunk, emb in zip(batch_chunks, batch_embeddings):
                session.add(RepoChunk(
                    repo_name=repo_name,
                    commit_sha=commit_sha,
                    file_path=chunk.metadata.get('file_path', ''),
                    symbol_name=chunk.metadata.get('symbol_name', ''),
                    chunk_text=chunk.text,
                    embedding=emb
                ))
            session.commit()
            print(f"Stored chunks {i} to {i + len(batch_chunks)}")

    print("Database ingestion complete!")
```

#### [NEW] `worker/utils/ingestion.py`

Ingestion Orchestration logic.

```python
from lib.ast_parser.parser import parse_directory
from utils.chunker import chunk_parse_result
from utils.embedding import generate_and_store_embeddings
from utils.manage_repo import delete_repo_folder
from sqlmodel import Session, select
from db.db import engine
from db.models import IngestionStatus
from datetime import datetime, timezone

def update_ingestion_status(repo_name: str, commit_sha: str, status: str, error_message: str = None):
    try:
        with Session(engine) as session:
            db_status = session.exec(
                select(IngestionStatus)
                .where(IngestionStatus.repo_name == repo_name)
                .order_by(IngestionStatus.created_at.desc())
                .limit(1)
            ).first()
            if db_status:
                db_status.status = status
                db_status.commit_sha = commit_sha
                db_status.error_message = error_message
                db_status.updated_at = datetime.now(timezone.utc)
                session.add(db_status)
                session.commit()
    except Exception as e:
        print(f"Failed to update ingestion status for {repo_name}: {e}")

def run_ingestion(repo_path: str, repo_name: str, commit_sha: str):
    try:
        print(f"Parsing directory: {repo_path}")
        ast_results, text_results = parse_directory(repo_path)
        all_chunks = []

        for result in ast_results:
            all_chunks.extend(chunk_parse_result(result, repo_name, commit_sha))

        generate_and_store_embeddings(all_chunks, repo_name, commit_sha)
        delete_repo_folder(repo_path)

        update_ingestion_status(repo_name, commit_sha, "completed")
        print(f"Successfully completed ingestion for {repo_name} at commit {commit_sha}")
    except Exception as e:
        print(f"Error in ingestion pipeline: {e}")
        update_ingestion_status(repo_name, commit_sha, "failed", str(e))
```

#### [NEW] `worker/cli.py`

The script run by GitLab CI/CD.

```python
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
```

#### [NEW] `worker/.gitlab-ci.yml`

Definition for GitLab CI. Starts Ollama, pulls model, starts script.

```yaml
stages:
  - ingest

ingest_job:
  stage: ingest
  image: python:3.11-slim
  rules:
    - if: $TARGET_REPO_URL
  before_script:
    # Install git and system build tools required for tree-sitter C bindings
    - apt-get update && apt-get install -y git build-essential curl

    # Install and start Ollama in the background
    - curl -fsSL https://ollama.com/install.sh | sh
    - ollama serve > /dev/null 2>&1 &

    # Wait for Ollama service to start up (up to 15s)
    - sleep 10

    # Pull embedding model
    - ollama pull embeddinggemma

    # Install Python project dependencies
    - pip install -r requirements.txt
  script:
    - python cli.py
```

#### [NEW] `worker/.env.example`

```env
DATABASE_URL=postgresql://user:password@localhost/dbname
OLLAMA_BASE_URL=http://localhost:11434
```

---

### 3. Query Embedding Component (embed-service/)

A separate Modal.com app, deployed independently from `api/` and `worker/`. It exists solely to embed the user's live query text on demand — bulk/ingestion embedding still runs on GitLab CI as before.

**Why a separate component and not part of `api/`:** the API's VM has 1GB RAM and cannot run Ollama itself. Modal runs the model in its own container, on demand, and scales to zero between requests — so there's no persistent memory cost on the VM and no idle cost on Modal.

**Why Ollama + `embeddinggemma` again, instead of a lighter runtime:** query embeddings must live in the exact same vector space as the embeddings the worker generates for the codebase. Reusing the identical model/runtime (Ollama's `embeddinggemma`) removes any risk of subtle mismatches (different quantization, tokenizer, or normalization) that a different embedding runtime could introduce.

#### [NEW] `embed-service/embed_app.py`

```python
import subprocess
import time

import modal

app = modal.App("askrepo-embed")

# Model weights are pulled once at image build time and baked into the
# image layer, so container cold starts don't need to re-download them —
# only `ollama serve` needs to start fresh per container.
image = (
    modal.Image.debian_slim()
    .apt_install("curl")
    .run_commands(
        "curl -fsSL https://ollama.com/install.sh | sh",
        "ollama serve & sleep 5 && ollama pull embeddinggemma && kill %1",
    )
)

EMBED_TOKEN = modal.Secret.from_name("askrepo-embed-token")  # holds MODAL_EMBED_TOKEN


@app.cls(
    image=image,
    cpu=2.0,
    memory=2048,
    scaledown_window=120,  # seconds a container stays warm after the last request
    secrets=[EMBED_TOKEN],
)
class EmbedServer:
    @modal.enter()
    def start_ollama(self):
        self.proc = subprocess.Popen(["ollama", "serve"])
        time.sleep(3)  # give the server a moment to bind before accepting requests

    @modal.fastapi_endpoint(method="POST")
    def embed(self, payload: dict, request):
        import os

        import httpx
        from fastapi import HTTPException

        auth = request.headers.get("authorization", "")
        if auth != f"Bearer {os.environ['MODAL_EMBED_TOKEN']}":
            raise HTTPException(status_code=401, detail="Unauthorized")

        query = payload.get("query")
        if not query:
            raise HTTPException(status_code=400, detail="Missing 'query' field")

        # embeddinggemma expects a task-specific prefix on queries — must match
        # the prefix convention (default task description "search result")
        # used for the corpus, or retrieval quality drops noticeably.
        prefixed_query = f"task: search result | query: {query}"

        response = httpx.post(
            "http://localhost:11434/api/embeddings",
            json={"model": "embeddinggemma", "prompt": prefixed_query},
            timeout=30.0,
        )
        response.raise_for_status()
        return {"embedding": response.json()["embedding"]}
```

> [!IMPORTANT]
> **Untested against Modal's current API surface.** Modal's decorator names and image-build helpers (`modal.fastapi_endpoint`, `modal.enter`, secret handling) change between SDK versions, so this should be treated as a starting structure to run and adjust locally — not copy-pasted blind. Check `modal --version` and the current docs at deploy time.

#### [NEW] `embed-service/requirements.txt`

```requirements
modal
```

#### [NEW] `embed-service/.env.example`

```env
# Set with: modal secret create askrepo-embed-token MODAL_EMBED_TOKEN=<random-value>
MODAL_EMBED_TOKEN=your_shared_secret_token
```

#### Deployment

```bash
cd embed-service
modal deploy embed_app.py
```

This prints the endpoint URL (e.g. `https://your-workspace--askrepo-embed-embed.modal.run`) — copy that into `api/.env` as `MODAL_EMBED_URL`, and set the same token value in both `embed-service`'s Modal secret and `api/.env`'s `MODAL_EMBED_TOKEN`.

---

### 4. Cleanup of Original Backend Component

We will move files into their correct locations and clean up the redundant folders in the root `backend/` directory:

#### [DELETE] `backend/main.py`

#### [DELETE] `backend/requirements.txt`

#### [DELETE] `backend/.env` (will transfer values to `api/.env`)

#### [DELETE] `backend/db/`

#### [DELETE] `backend/lib/`

#### [DELETE] `backend/utils/`

---

## Verification Plan

### Automated Verification

Since there are no pre-existing unit test suites configured, we will verify correctness using manual endpoint checks and script dry runs:

1. **Verify API compiles & runs**:
   Start the FastAPI development server:

   ```bash
   cd api
   uvicorn main:app --reload --port 8000
   ```

   Check the `/health` endpoint to ensure the application starts without import errors.

2. **Verify Worker CLI Execution**:
   Run the worker CLI locally as a dry run to verify parsing and db interactions:
   ```bash
   cd worker
   python cli.py --repo-url https://github.com/ayussh-2/repo-assistant
   ```

3. **Verify Modal embed-service directly**:
   Call the deployed endpoint with `curl` before wiring it into `api/`, to confirm the vector it returns is 768-dimensional and matches what the worker produces for the same string:
   ```bash
   curl -X POST "$MODAL_EMBED_URL" \
     -H "Authorization: Bearer $MODAL_EMBED_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"query": "how does the auth middleware work"}'
   ```
   Also worth checking cold-start latency here (first call after idle vs. a call right after) so you know what to expect in `/query` response times.

### Manual Verification

1. **Triggering Pipeline API**: Call `POST /ingest` from Postman/cURL and verify it completes with `202 Accepted` and responds with the new database `job_id`.
2. **Streaming Chat Query**: Call `POST /query?repo_name=ayussh-2/repo-assistant` and verify the server outputs streaming RAG text correctly.