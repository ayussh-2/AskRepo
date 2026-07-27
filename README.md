<p align="center">
  <img src="https://github.com/user-attachments/assets/2260376a-70fc-49cf-830f-5d488fa457e3" width="80%" alt="askRepo — chat with any GitHub repository" />
</p>

<h3 align="center">askRepo</h3>

<p align="center">An AI-powered repository assistant platform with a browser extension and Next.js web application for natural language code exploration.</p>

---

`askRepo` is a decoupled, production-ready repository intelligence platform. It combines a **WXT-based Chrome Browser Extension** (injected into GitHub pages) and a **Next.js 16 Web Dashboard** with a lightweight **FastAPI backend**, an **on-demand GitLab CI/CD ingestion pipeline**, and a **Modal.com serverless query-embedding service**.

Repositories are chunked by logical AST symbols (functions, classes, methods) via Tree-Sitter, embedded using `embeddinggemma`, stored in a **PostgreSQL + pgvector** database (Neon DB), and queried via Retrieval-Augmented Generation (RAG) powered by **Google Gemini**.

> [!NOTE]
> **Performance & Resource Note:** Full repository indexing and embedding can take time depending on the size of the codebase and available runner resources. When trying out `askRepo`, it is recommended to start with a smaller repository (such as this repository itself!).

---

## Features

- **Dual Interfaces:**
  - **Browser Extension (`frontend/extension`):** Injected directly into GitHub repository pages via Shadow DOM with a sleek floating chat panel. Automatically detects current repo URLs.
  - **Web Dashboard (`frontend/web`):** Full Next.js 16 application for managing indexed repositories, running sync checks, and chatting with codebases directly in the browser.
- **AST-Based Symbol Chunking:** Codebases are parsed using Tree-Sitter across supported languages to extract logical code structures (classes, functions, interfaces, structs, methods) rather than arbitrary line slices.
- **Decoupled Heavy Operations:**
  - **GitLab CI/CD Ingestion Worker (`worker/`):** Heavy repository cloning, Tree-Sitter AST parsing, and bulk vector embedding run on-demand inside GitLab CI runners, offloading heavy CPU/RAM work from the primary API server.
  - **Serverless Query Embedding (`embed-service/`):** Live user queries are embedded on demand via a Modal.com serverless endpoint running `embeddinggemma`, scaling to zero when idle to conserve resources.
- **Vector Similarity Search:** High-dimensional code symbol embeddings (768-dim `embeddinggemma`) stored and queried via PostgreSQL `pgvector` cosine similarity.
- **Session Management & Auto-Summarization:** Conversation histories are cached in Redis. When chat history approaches LLM context limits, older turns are automatically summarized by Gemini to maintain context without token truncation.
- **Live Commit Sync Check:** Automatically compares local indexed commit SHAs against remote GitHub `HEAD` commits to notify users when an index update is needed.
- **Streaming Responses:** Streams responses in real time using the Google GenAI SDK.

---

## Architecture

```mermaid
graph TD
    subgraph Clients ["Clients"]
        Extension["Browser Extension (WXT / React 19)"]
        Web["Web Application (Next.js 16)"]
    end

    subgraph Backend ["API Service (api/)"]
        API["FastAPI API Server (Docker)"]
    end

    subgraph Ingestion ["Ingestion Worker (worker/)"]
        GitLabRunner["GitLab CI/CD Pipeline"]
        TreeSitter["Tree-Sitter AST Parser"]
        WorkerOllama["Ollama (embeddinggemma)"]
    end

    subgraph EmbedService ["Query Embedder (embed-service/)"]
        ModalEndpoint["Modal Serverless (embeddinggemma)"]
    end

    subgraph Storage ["Storage & External AI Services"]
        Postgres[("Neon PostgreSQL + pgvector")]
        Redis[("Redis / Upstash")]
        Gemini["Google Gemini API"]
        GitRepo["GitHub Repositories"]
    end

    Extension -->|Ingest / Query / History| API
    Web -->|Ingest / Query / History| API

    API -->|POST /trigger/pipeline| GitLabRunner
    GitLabRunner -->|1. Clone Repo| GitRepo
    GitLabRunner -->|2. Parse AST| TreeSitter
    GitLabRunner -->|3. Embed Chunks| WorkerOllama
    GitLabRunner -->|4. Store Vectors| Postgres

    API -->|POST /embed| ModalEndpoint
    API -->|Cosine Search| Postgres
    API -->|Manage Chat Session| Redis
    API -->|Stream Prompt| Gemini
```

---

## Project Structure

```
repo-assistant/
├── api/                  # Lightweight FastAPI Backend Service
│   ├── main.py           # API endpoints (/health, /ingest, /query, /status, /repos, /chat-history, /check-sync)
│   ├── config.py         # App configuration & environment settings
│   ├── db/               # SQLModel schemas & Neon DB pgvector integration
│   ├── lib/              # Redis session history management
│   ├── services/         # RAG pipeline, GitLab CI trigger, Auth, and Rate limiting
│   └── Dockerfile        # Container build definition for production deployment
│
├── worker/               # Standalone Ingestion Engine (GitLab CI/CD Pipeline)
│   ├── cli.py            # CLI entrypoint for running ingestion jobs
│   ├── .gitlab-ci.yml    # GitLab CI/CD runner configuration
│   ├── lib/ast_parser/   # Tree-Sitter AST symbol extraction logic
│   └── utils/            # Ingestion, chunking, and Ollama embedding pipelines
│
├── embed-service/        # Serverless Query Embedding Service (Modal.com)
│   └── embed_app.py      # Modal app running Ollama + embeddinggemma on-demand
│
├── frontend/
│   ├── extension/        # Browser Extension (WXT, React 19, TypeScript, Tailwind 4, Shadcn)
│   └── web/              # Web Dashboard (Next.js 16, React 19, TypeScript, Tailwind 4)
│
├── scripts/              # Migration and maintenance scripts
└── Makefile              # Command shortcuts for development & deployment
```

---

## Supported Languages

Tree-Sitter AST parsing supports: **Python, JavaScript, TypeScript, Go, Rust, Java, and C/C++**, extracting classes, methods, functions, interfaces, structs, traits, enums, and constructors.

---

## Installation & Setup

### Prerequisites

| Dependency | Notes |
|---|---|
| Node.js v18+ & Bun | Required for building frontend extension & web app |
| Python 3.10+ | Required for running backend services |
| PostgreSQL + pgvector | Neon DB or hosted PostgreSQL instance with `vector` extension enabled |
| Redis | Upstash Redis or hosted instance for chat session caching |
| Gemini API Key | Available from [Google AI Studio](https://aistudio.google.com) |
| Modal Account | For deploying the query embedding serverless endpoint |
| GitLab Account & Runner | For executing repository ingestion pipelines |

---

### Environment Setup

#### 1. API Service (`api/.env`)

Create `api/.env`:

```env
GEMINI_API_KEY="your-gemini-api-key"
DATABASE_URL="postgresql://user:password@neon-host/dbname?sslmode=require"
REDIS_URL="rediss://default:password@upstash-host:6379"
SESSION_TTL=86400
GEMINI_LLM_MODEL="gemini-3.1-flash-lite"
MODAL_EMBED_URL="https://your-workspace--askrepo-embed-embedserver-embed.modal.run"
MODAL_EMBED_TOKEN="your-modal-shared-secret-token"
EMBEDDING_MODEL="embeddinggemma"
GITLAB_PROJECT_ID="your-gitlab-project-id"
GITLAB_TRIGGER_TOKEN="your-gitlab-trigger-token"
ENV="development"
```

#### 2. Serverless Query Embedding Service (`embed-service/.env`)

Deploy the Modal app:

```bash
cd embed-service
modal secret create askrepo-embed-token MODAL_EMBED_TOKEN="your-modal-shared-secret-token"
modal deploy embed_app.py
```

#### 3. Ingestion Worker (`worker/.env`)

Configured in GitLab CI/CD Variables or local `.env`:

```env
DATABASE_URL="postgresql://user:password@neon-host/dbname?sslmode=require"
OLLAMA_BASE_URL="http://localhost:11434"
EMBEDDING_MODEL="embeddinggemma"
```

#### 4. Browser Extension (`frontend/extension/.env`)

```env
VITE_API_URL="http://localhost:8000"
```

#### 5. Web App (`frontend/web/.env`)

```env
NEXT_PUBLIC_API_URL="http://localhost:8000"
```

---

## Local Development

Commands are available via the root `Makefile`:

```bash
# Start API development server (FastAPI at http://localhost:8000)
make dev-api

# Start Browser Extension in dev mode (WXT)
make dev-extension

# Start Web Application in dev mode (Next.js at http://localhost:3000)
make dev-web

# Test Worker Ingestion locally for a repo
make dev-worker repo=https://github.com/fastapi/fastapi

# Deploy Query Embedding service to Modal
make deploy-embed
```

---

## Production Deployment

### Docker Deployment for API

Build and run the API container:

```bash
# Build Docker image
make docker-build DOCKER_USER=your-username DOCKER_IMAGE=askrepo-api DOCKER_TAG=latest

# Push to Docker registry
make docker-push DOCKER_USER=your-username DOCKER_IMAGE=askrepo-api DOCKER_TAG=latest

# Run container locally or on server
make docker-run DOCKER_USER=your-username DOCKER_IMAGE=askrepo-api DOCKER_TAG=latest
```

---

## Loading the Browser Extension

1. Build or run the extension (`cd frontend/extension && bun run build`)
2. Open Chrome (or any Chromium browser) and go to `chrome://extensions/`
3. Enable **Developer mode** (top-right toggle)
4. Click **Load unpacked** and select `frontend/extension/.output/chrome-mv3`
5. The `askRepo` icon will appear in your browser toolbar and inject the floating chat interface on GitHub repository pages.

---

## Usage

1. **Via Browser Extension:**
   - Navigate to any public GitHub repository (e.g., `https://github.com/fastapi/fastapi`).
   - Click **Index Repository** in the extension popup.
   - The backend validates the remote HEAD commit SHA and triggers the GitLab ingestion pipeline.
   - Once indexed, a floating chat icon appears in the bottom right corner of the GitHub page.
2. **Via Web App:**
   - Open `http://localhost:3000` (or `https://askrepo.ayussh.me`).
   - Paste a GitHub URL to trigger ingestion or view previously indexed repositories.
   - Click on any indexed repository to start querying its codebase.

> [!TIP]
> Full repository ingestion requires cloning, AST parsing, and generating vector embeddings. Due to runner resource limits, large repositories may take longer to index. We recommend starting with a smaller repository (such as this project's repo) for initial testing.

---

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` or `/health` | API health check & dependency status probe |
| `POST` | `/ingest` | Validates commit hash & triggers remote GitLab CI ingestion pipeline |
| `POST` | `/query` | Streams natural language RAG answer for indexed repository |
| `GET` | `/status` | Retrieves status of ingestion job by `job_id` or `repo_name` |
| `GET` | `/repos` | Lists indexed repositories for authenticated user with pagination |
| `GET` | `/chat-history` | Retrieves persistent chat history for a repository |
| `DELETE` | `/chat-history` | Clears chat history for a repository |
| `GET` | `/check-sync` | Compares indexed commit SHA with remote GitHub `HEAD` SHA |

---
