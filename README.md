<p align="center">
  <img src="https://github.com/user-attachments/assets/2260376a-70fc-49cf-830f-5d488fa457e3" width="80%" alt="askRepo — chat with any GitHub repository" />
</p>

<h1 align="center">askRepo</h1>

<p align="center">
  <strong>Decoupled, High-Performance Repository Intelligence Platform</strong><br />
  Chat with any GitHub repository using AST Symbol Parsing, Two-Stage Vector Retrieval, FlashRank Reranking, and Multi-LLM Failover.
</p>

<p align="center">
  <a href="#key-features">Key Features</a> •
  <a href="#architecture--system-design">Architecture</a> •
  <a href="#rag-evaluation-suite">RAG Evals</a> •
  <a href="#getting-started">Getting Started</a> •
  <a href="#environment-variables">Environment Variables</a> •
  <a href="#makefile-commands">Makefile Commands</a>
</p>

---

## What is askRepo?

`askRepo` is an AI-powered codebase exploration and QA engine. It allows developers to index any public GitHub repository and converse with it in real-time. 

Unlike naive RAG systems that slice code by arbitrary line numbers, `askRepo` parses repositories at the **Abstract Syntax Tree (AST)** level using **Tree-Sitter** to extract logical code symbols (functions, classes, interfaces, and methods). It evaluates code context using **Two-Stage Vector Retrieval + FlashRank Reranking** and generates streaming responses with automatic multi-provider failover (**Google Gemini, Groq / Meta Llama 3.3, and Mistral AI**).

> **Note on Query Embedding & Modal:**
> Live user queries are converted into vector embeddings before searching PostgreSQL. By default, setting `EMBEDDING_PROVIDER=local` in `api/.env` uses your local Ollama CPU instance (`embeddinggemma`) with zero external cloud dependencies. Optionally, setting `EMBEDDING_PROVIDER=modal` routes embedding requests to Modal.com (a serverless Python cloud runner that runs `embed-service/embed_app.py` on demand and scales to zero when idle).

---

## Key Features

### 1. AST-Based Symbol Chunking (Tree-Sitter)
Codebases are parsed structurally across supported languages (JavaScript, TypeScript, Python, Go, Java, C++, Rust). Functions, classes, and methods are extracted as intact logical symbols rather than arbitrary text chunks. Slided token windows (`MAX_TOKENS = 500`, `OVERLAP = 50`) act as fallback for non-code assets and lockfiles (`package-lock.json`, `yarn.lock`).

### 2. Two-Stage Retrieval (pgvector + FlashRank ONNX Reranking)
- **First Stage (Vector Search)**: Queries PostgreSQL `pgvector` using 768-dimensional embeddings to fetch top 15 candidate code chunks.
- **Second Stage (Cross-Encoder Reranking)**: Runs **FlashRank** (`ms-marco-TinyBERT-L-2-v2` ONNX model) to score cross-attention relevance in **~10ms**, filtering candidates down to the top 4 most relevant chunks.
- **Low Footprint**: Consumes only **~60 MB RAM**, making it 100% compatible with 1 GB Azure VMs.

### 3. Multi-LLM Engine with Live Failover & UI Selection
- **Providers Supported**: Google Gemini (`gemini-3.1-flash-lite`), Groq (`llama-3.3-70b-versatile`), and Mistral AI (`mistral-small-latest`).
- **Automatic Fallback**: If a primary LLM hits a `429 Rate Limit` or API error, the backend seamlessly routes the request to the next configured provider without interrupting the user's streaming session.
- **Interactive UI Selector**: Web Dashboard features an inline model selector dropdown with provider logos and auto-inversion filters.

### 4. Flexible Embedding Provider Switch (`local` vs `modal`)
Toggle between 0-cost local CPU embedding for development and serverless GPU acceleration for production via `EMBEDDING_PROVIDER`:
- `EMBEDDING_PROVIDER=local` $\rightarrow$ Uses local **Ollama** (`embeddinggemma`) on CPU. Zero external cloud dependencies required for local dev.
- `EMBEDDING_PROVIDER=modal` $\rightarrow$ Uses **Modal.com** serverless GPU endpoint.

### 5. High-Speed Ingestion Pipeline
- **Decoupled Heavy Operations**: Heavy cloning, AST parsing, and vector embedding execute inside **GitLab CI/CD runners** (`worker/`), keeping the main API server lightweight.
- **Parallel Workers**: Generates embeddings concurrently using `ThreadPoolExecutor` (6 parallel workers).
- **Bulk Database Writes**: Inserts chunks into PostgreSQL in **bulk batches of 500 records**.
- **Runner Model Caching**: Caches `.ollama/` model binaries in GitLab CI, reducing ingestion setup time from 20 minutes to **1–2 minutes**.

### 6. Mandatory Citations & Grounded Fallbacks
Every codebase response includes a structured `### Sources & Citations` section detailing exact file paths and symbol names. Out-of-context or unindexed feature queries return strict fallback responses (*"I could not find that information in the retrieved repository context."*) to prevent hallucinations.

### 7. Offline RAG Evaluation Suite
Includes a built-in RAG evaluation runner (`evals/run_eval.py`) with **LLM-as-a-Judge** scoring (`faithfulness`, `relevancy`, `overall_score`) and sample benchmark datasets (`evals/dataset.json`).

---

## Architecture & System Design

```mermaid
graph TD
    subgraph Clients ["Clients"]
        Web["Next.js 16 Web Dashboard (web/)"]
    end

    subgraph Backend ["API Service (api/)"]
        API["FastAPI API Server (Docker)"]
        LLMEngine["Multi-LLM Failover Engine (Gemini / Groq / Mistral)"]
        Reranker["FlashRank ONNX Reranker"]
    end

    subgraph Ingestion ["Ingestion Worker (worker/)"]
        GitLabRunner["GitLab CI/CD Pipeline"]
        TreeSitter["Tree-Sitter AST Parser"]
        WorkerEmbed["Ollama / Modal Embedding Engine"]
    end

    subgraph EmbedService ["Query Embedder (embed-service/)"]
        ModalEndpoint["Modal Serverless GPU (embeddinggemma)"]
    end

    subgraph Storage ["Storage & Database"]
        Postgres[("Neon PostgreSQL + pgvector")]
        Redis[("Redis / Upstash Session Cache")]
        GitRepo["GitHub Repositories"]
    end

    Web -->|Ingest / Query / History| API
    API -->|POST /trigger/pipeline| GitLabRunner
    GitLabRunner -->|1. Clone Repo| GitRepo
    GitLabRunner -->|2. Parse AST| TreeSitter
    GitLabRunner -->|3. Parallel Embed| WorkerEmbed
    GitLabRunner -->|4. Bulk Insert| Postgres

    API -->|1. Query Embedding| ModalEndpoint
    API -->|2. Cosine Candidate Search| Postgres
    API -->|3. Cross-Encoder Rerank| Reranker
    API -->|4. Session Management| Redis
    API -->|5. Streaming Response| LLMEngine
```

---

## RAG Evaluation Suite

`askRepo` includes an offline RAG evaluation framework ([`evals/run_eval.py`](file:///D:/Projects/Personal/repo-assistant/evals/run_eval.py)) to test retrieval accuracy and generation quality.

### Evaluation Metrics Calculated
- **Faithfulness Score (0.0 to 1.0)**: Checks if 100% of statements in the answer are grounded in context without hallucinating non-existent files or functions.
- **Answer Relevancy Score (0.0 to 1.0)**: Evaluates whether the generated response directly answers the user query.
- **Overall Benchmark Percentage**: Aggregates test performance across benchmark datasets.

### Running the Evaluation Suite
```bash
make eval
# OR
python evals/run_eval.py
```

Detailed evaluation benchmark reports are saved to [`evals/eval_report.json`](file:///D:/Projects/Personal/repo-assistant/evals/eval_report.json).

---

## Project Structure

```
repo-assistant/
├── api/                  # FastAPI Backend Application
│   ├── main.py           # API endpoints (/health, /ingest, /query, /status, /repos, /chat-history)
│   ├── config.py         # Application settings & environment variables
│   ├── db/               # SQLModel schemas & pgvector integration
│   ├── lib/              # Redis session & history management
│   ├── services/         # RAG pipeline, FlashRank reranker, LLM fallback engine
│   └── Dockerfile        # Production Docker build definition
│
├── web/                  # Next.js 16 Web Dashboard Application
│   ├── src/app/          # Next.js App Router (Home, Ingest, Chat, Workspace)
│   ├── src/components/   # UI components (Model selector, Sidebar, Sample Repos)
│   └── public/models/    # Provider SVG logo assets (Gemini, Llama, Mistral, Auto)
│
├── worker/               # Standalone Ingestion Engine (GitLab CI/CD Worker)
│   ├── cli.py            # Ingestion CLI entrypoint
│   ├── .gitlab-ci.yml    # GitLab runner job & model caching definition
│   ├── lib/ast_parser/   # Tree-Sitter AST symbol extractor
│   └── utils/            # Parallel embeddings & bulk DB insertion
│
├── embed-service/        # Serverless Query Embedding Service (Modal.com)
│   └── embed_app.py      # Modal GPU serverless function
│
├── evals/                # Offline RAG Evaluation Suite
│   ├── dataset.json      # Benchmark test cases across 4 categories
│   ├── run_eval.py       # LLM-as-a-Judge benchmark runner script
│   └── eval_report.json  # Output evaluation benchmark report
│
└── Makefile              # Development & deployment command targets
```

---

## Getting Started

### Prerequisites
- Python 3.11+
- Node.js 18+ or Bun
- PostgreSQL with `pgvector` extension enabled (e.g. Neon DB)
- Redis server (local or Upstash)
- Ollama (if using `EMBEDDING_PROVIDER=local`)

### Step 1: Install Ollama & Embedding Model (For Local Dev)

If you are using local embeddings (`EMBEDDING_PROVIDER=local`):

1. **Install Ollama**:
   - Linux / macOS: `curl -fsSL https://ollama.com/install.sh | sh`
   - Windows: Download installer from [ollama.com/download](https://ollama.com/download)

2. **Pull the `embeddinggemma` Model**:
   ```bash
   ollama pull embeddinggemma
   ```

3. **Start Ollama Service**:
   ```bash
   ollama serve
   # Ollama will start listening at http://localhost:11434
   ```

---

### Step 2: Clone Repository & Create Virtual Environment


```bash
git clone https://github.com/ayussh-2/AskRepo.git
cd AskRepo

# Create and activate Python virtual environment
python -m venv .venv
# On Windows:
.venv\Scripts\activate
# On Linux/macOS:
source .venv/bin/activate
```

---

### Step 3: Install Dependencies

#### Install Backend Python Dependencies
```bash
pip install -r api/requirements.txt
```

#### Install Web Application Dependencies
```bash
cd web
bun install   # Or: npm install
cd ..
```

---

### Step 4: Configure Environment Variables


Create `.env` inside `api/.env`:

```env
# API Keys (Provide at least one)
GEMINI_API_KEY="your_gemini_api_key"
GROQ_API_KEY="your_groq_api_key"
MISTRAL_API_KEY="your_mistral_api_key"

# LLM Failover Configuration
LLM_PROVIDER_ORDER="gemini,groq,mistral"

# Embedding Provider Selection ("local" or "modal")
EMBEDDING_PROVIDER="local"
OLLAMA_BASE_URL="http://localhost:11434"
EMBEDDING_MODEL="embeddinggemma"

# Optional Modal GPU Settings (Only if EMBEDDING_PROVIDER=modal)
MODAL_EMBED_URL="https://your-workspace--askrepo-embed-embedserver-embed.modal.run"
MODAL_EMBED_TOKEN=""

# Database & Redis Credentials
DATABASE_URL="postgresql://user:password@localhost/dbname"
REDIS_URL="redis://localhost:6379/0"
```

Create `.env.local` inside `web/.env.local`:

```env
NEXT_PUBLIC_API_URL="http://localhost:8000"
NEXT_PUBLIC_GOOGLE_CLIENT_ID="your_google_oauth_client_id"
```

---

### Step 5: Run Locally


#### 1. Start FastAPI Backend Server
```bash
make dev-api
# API will start at http://localhost:8000
```

#### 2. Start Next.js Web Dashboard
```bash
make dev-web
# Web UI will start at http://localhost:3000
```

#### 3. Test Worker Ingestion Locally
```bash
make dev-worker repo=https://github.com/expressjs/express
```

---

## Makefile Commands

```bash
make dev-api         # Start FastAPI API development server
make dev-web         # Start Next.js Web application
make dev-worker      # Test Worker Ingestion locally for a repo
make eval            # Run offline RAG evaluation benchmark
make deploy-embed    # Deploy Modal GPU serverless embedding service
make docker-build    # Build production API Docker image
make docker-run      # Run production API Docker container
```

---

## Docker Production Deployment

```bash
# 1. Build Docker container image
docker build -t ayush91101/askrepo-api:latest ./api

# 2. Push to Docker Hub
docker push ayush91101/askrepo-api:latest

# 3. Run container on Azure / Cloud VM
docker run -d \
  --name askrepo-api-container \
  -p 8000:8000 \
  --restart unless-stopped \
  --env-file api/.env \
  ayush91101/askrepo-api:latest
```
