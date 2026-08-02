import httpx
from collections import defaultdict
from typing import List, Dict, Optional
import tiktoken
from config import settings
from db.db import engine
from db.models import RepoChunk
from sqlmodel import Session, select
from lib.redis import get_chat_history, add_chat_message, save_all_history
from sqlalchemy import func
from services.llm import generate_text_with_fallback, generate_stream_with_fallback

try:
    from flashrank import Ranker, RerankRequest
    ranker = Ranker(model_name="ms-marco-TinyBERT-L-2-v2")
    HAS_FLASHRANK = True
    print("[Reranker] FlashRank ONNX Reranker initialized successfully (model: ms-marco-TinyBERT-L-2-v2).")
except Exception as e:
    print(f"[Reranker Warning] FlashRank initialization failed: {e}. Falling back to standard vector search.")
    ranker = None
    HAS_FLASHRANK = False

async def embed_query(query: str) -> List[float]:
    provider = (settings.embedding_provider or "local").lower().strip()

    if provider == "modal" and settings.modal_embed_url:
        headers = {"Authorization": f"Bearer {settings.modal_embed_token}"} if settings.modal_embed_token else {}
        payload = {"query": query}
        async with httpx.AsyncClient(timeout=60.0) as http_client:
            response = await http_client.post(
                settings.modal_embed_url, json=payload, headers=headers
            )
            response.raise_for_status()
            data = response.json()
            return data["embedding"]

    # Local Ollama embedding fallback (0-cost local CPU embedding for dev)
    async with httpx.AsyncClient(timeout=60.0) as http_client:
        url = f"{settings.ollama_base_url.rstrip('/')}/api/embeddings"
        payload = {
            "model": settings.embedding_model,
            "prompt": f"title: none | text: {query}"
        }
        response = await http_client.post(url, json=payload)
        response.raise_for_status()
        data = response.json()
        return data["embedding"]


def search_chunk(query_embedding: List[float], repo_name: str, candidate_k: int = 15) -> List[RepoChunk]:
    with Session(engine) as session:
        results = session.exec(
            select(RepoChunk)
            .where(func.lower(RepoChunk.repo_name) == repo_name.lower())
            .order_by(RepoChunk.embedding.cosine_distance(query_embedding))
            .limit(candidate_k)
        ).all()

        file_paths = list(set(r.file_path for r in results))

        imports = session.exec(
            select(RepoChunk)
            .where(func.lower(RepoChunk.repo_name) == repo_name.lower())
            .where(RepoChunk.file_path.in_(file_paths))
            .where(RepoChunk.symbol_name == "")
        ).all()

    seen_ids = {r.id for r in results}
    extra = [i for i in imports if i.id not in seen_ids]
    return list(results) + extra

def rerank_chunks(query: str, candidate_chunks: List[RepoChunk], top_k: int = 4) -> List[RepoChunk]:
    if not candidate_chunks:
        return []

    if not HAS_FLASHRANK or ranker is None:
        return candidate_chunks[:top_k]

    try:
        passages = [
            {"id": idx, "text": f"[File: {chunk.file_path} | Symbol: {chunk.symbol_name}]\n{chunk.chunk_text}"}
            for idx, chunk in enumerate(candidate_chunks)
        ]
        rerank_req = RerankRequest(query=query, passages=passages)
        results = ranker.rerank(rerank_req)

        top_indices = [item["id"] for item in results[:top_k]]
        reranked_chunks = [candidate_chunks[idx] for idx in top_indices if idx < len(candidate_chunks)]
        print(f"[Reranker] FlashRank reranked {len(candidate_chunks)} candidates -> selected top {len(reranked_chunks)} chunks for query: '{query[:40]}...'")
        return reranked_chunks
    except Exception as e:
        print(f"[Reranker Warning] Reranking failed: {e}. Returning raw vector results.")
        return candidate_chunks[:top_k]

def sanitize_context(chunks: List[RepoChunk], max_chars: int = 12000) -> str:
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

async def summarize_old_messages(old_messages: List[Dict[str, str]]) -> str:
    formatted_text = "\n".join([f"{msg['role']}: {msg['content']}" for msg in old_messages])
    prompt = f"Summarize the key information and questions discussed in this conversation context in 2-3 sentences:\n{formatted_text}"
    return await generate_text_with_fallback(prompt)

async def process_history_and_summarize(user_id: str, repo_name: str, new_query: str) -> List[Dict[str, str]]:
    history = get_chat_history(user_id, repo_name)
    total_tokens = sum(estimate_tokens(m["content"]) for m in history) + estimate_tokens(new_query)

    if total_tokens > 6000:
        keep_count = 4
        if len(history) > keep_count:
            to_summarize = history[:-keep_count]
            to_keep = history[-keep_count:]
            summary_text = await summarize_old_messages(to_summarize)
            summary_message = {
                "role": "model",
                "content": f"[Summary of previous conversation: {summary_text}]"
            }
            history = [summary_message] + to_keep
            save_all_history(user_id, repo_name, history)

    return history

async def chat_stream_handler(
    user_id: str,
    repo_name: str,
    query: str,
    top_k: int = 4,
    provider: Optional[str] = None,
    model: Optional[str] = None
):
    try:
        # 1. First-stage: Vector similarity search (retrieve 15 candidate chunks)
        query_embedding = await embed_query(query)
        candidate_chunks = search_chunk(query_embedding, repo_name, candidate_k=15)

        if len(candidate_chunks) == 0:
            yield "I could not find any indexed code chunks for this repository. Please make sure the repository is ingested."
            return

        # 2. Second-stage: FlashRank Cross-Encoder Reranking (select top_k best chunks)
        chunks = rerank_chunks(query, candidate_chunks, top_k=top_k)

        # 3. Async conversation history processing (scoped by user_id & repo_name)
        history = await process_history_and_summarize(user_id, repo_name, query)
        add_chat_message(user_id, repo_name, "user", query)

        context = sanitize_context(chunks)
        system_instruction = f"""
        You are a chatbot called askRepo.
        Rules:
        1. Use the provided Repository Context to answer questions about this codebase.
        2. CITATION RULE: Whenever answering a codebase question using the context, ALWAYS append a section titled `### Sources & Citations` at the bottom of your answer. List the exact file paths (and symbol names if applicable) referenced, e.g.:

        - `lib/response.js` (`res.send`)
        - `lib/router/index.js` (`Router.prototype.handle`)
        3. OUT-OF-CONTEXT / UNKNOWN RULE: If the user asks a question about this repository's codebase, features, or internal functions and the information is NOT present in the retrieved Repository Context, respond strictly with:
        "I could not find that information in the retrieved repository context."
        4. GENERAL KNOWLEDGE RULE: If the user asks a general programming or conceptual question unrelated to this specific repository codebase (e.g. "What is HTTP?"), answer it clearly using your general knowledge.
        5. Do not invent code, files, or architecture details that are not present in the context.
        6. When showing code, use markdown code blocks with the correct language.

        Repository Context:
        {context}
        """.strip()


        full_response = ""
        async for chunk in generate_stream_with_fallback(
            history,
            query,
            system_instruction,
            preferred_provider=provider,
            preferred_model=model
        ):
            full_response += chunk
            yield chunk

        if full_response and not full_response.startswith("[Error:"):
            add_chat_message(user_id, repo_name, "model", full_response)

    except Exception as e:
        print(f"Error in chat_stream_handler: {e}")
        yield f"\n[Error: {str(e)}]"



