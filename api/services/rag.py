import httpx
from collections import defaultdict
from typing import List, Dict, Optional
from google import genai
from google.genai import types
import tiktoken
from config import settings
from db.db import engine
from db.models import RepoChunk
from sqlmodel import Session, select
from lib.redis import get_chat_history, add_chat_message, save_all_history
from sqlalchemy import func

client = genai.Client(api_key=settings.gemini_api_key)

async def embed_query(query: str) -> List[float]:
    headers = {"Authorization": f"Bearer {settings.modal_embed_token}"}
    payload = {"query": query}

    async with httpx.AsyncClient(timeout=60.0) as http_client:
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
            .where(func.lower(RepoChunk.repo_name) == repo_name.lower())
            .order_by(RepoChunk.embedding.cosine_distance(query_embedding))
            .limit(top_k)
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
    return results + extra

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
    response = await client.aio.models.generate_content(
        model=settings.gemini_llm_model,
        contents=prompt
    )
    return response.text.strip() if response.text else ""

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

async def chat_stream_handler(user_id: str, repo_name: str, query: str, top_k: int = 4):
    try:
        # 1. Async embedding vector search
        query_embedding = await embed_query(query)
        chunks = search_chunk(query_embedding, repo_name, top_k)

        if len(chunks) == 0:
            yield "I could not find any indexed code chunks for this repository. Please make sure the repository is ingested."
            return

        # 2. Async conversation history processing (scoped by user_id & repo_name)
        history = await process_history_and_summarize(user_id, repo_name, query)
        add_chat_message(user_id, repo_name, "user", query)

        context = sanitize_context(chunks)
        system_instruction = f"""
You are a chatbot called askRepo.
Rules:
- Use the repository context to answer repository-specific questions. Mention relevant file paths when possible.
- If the user asks a general programming, technical, or conceptual question not specific to this repository, answer it using your general knowledge.
- If a repository-specific question is asked and the context does not contain the answer, say:
  "I could not find that information in the retrieved repository context."
- Do not invent code, files, or architecture details that are not present in the context.
- When showing code, use markdown code blocks with the correct language.
- Keep the conversation friendly and helpful.
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
            if chunk.text:
                full_response += chunk.text
                yield chunk.text

        if full_response:
            add_chat_message(user_id, repo_name, "model", full_response)

    except Exception as e:
        print(f"Error in chat_stream_handler: {e}")
        yield f"\n[Error: {str(e)}]"
