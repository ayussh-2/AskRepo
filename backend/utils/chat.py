from collections import defaultdict
from typing import Dict, List
from google import genai
import tiktoken

from lib.redis import add_chat_message, get_chat_history, save_all_history
from .config import settings
from .constants import ENCODER_MODEL


def sanitaize_context(chunks,max_chars: int = 12000):
    seen = set()
    unique_chunks = []

    for chunk in chunks:
        file_path = getattr(chunk, "file_path", "")
        symbol_name = getattr(chunk, "symbol_name", "")
        chunk_text = getattr(chunk, "chunk_text", "")

        key = (
            file_path,
            symbol_name,
            chunk_text,
        )

        if key not in seen:
            seen.add(key)
            unique_chunks.append(chunk)

    files = defaultdict(lambda: {"symbols": set(), "snippets": []})

    for chunk in unique_chunks:
        if isinstance(chunk, dict):
            file_path = chunk.get("file_path", "unknown")
            symbol_name = chunk.get("symbol_name", "")
            chunk_text = chunk.get("chunk_text", "")
        else:
            file_path = getattr(chunk, "file_path", "unknown")
            symbol_name = getattr(chunk, "symbol_name", "")
            chunk_text = getattr(chunk, "chunk_text", "")

        symbol_name = symbol_name.strip() if symbol_name else ""
        chunk_text = chunk_text.strip() if chunk_text else ""

        if symbol_name:
            files[file_path]["symbols"].add(symbol_name)

        if chunk_text:
            files[file_path]["snippets"].append(chunk_text)

    context_parts = []
    current_size = 0

    for file_path, data in files.items():
        section = [f"[FILE] {file_path}"]

        if data["symbols"]:
            section.append(
                f"[SYMBOLS] {', '.join(sorted(data['symbols']))}"
            )

        section.append("")

        # Remove duplicate snippets within same file
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
    

def build_prompt(
    chunks,
    question: str,
) -> str:
    context = sanitaize_context(chunks)
    prompt = f"""
            You are a chatbot called askRepo.

            Rules:
            - Answer ONLY using the repository context.
            - Mention relevant file paths when possible.
            - If the answer is not contained in the context, say:
            "I could not find that information in the retrieved repository context."
            - Do not invent code or architecture details.
            - When showing code, use markdown code blocks with the correct language.

            Repository Context:

            {context}

            User Question:
            {question}

            Answer:
            """.strip()

    return prompt


def estimate_tokens(text: str) -> int:
        encoding = tiktoken.get_encoding(ENCODER_MODEL)
        return len(encoding.encode(text))


def summarize_old_messages(old_messages: List[Dict[str, str]], client) -> str:
    formatted_text = "\n".join([f"{msg['role']}: {msg['content']}" for msg in old_messages])
    
    prompt = f"""
    Summarize the key information and questions discussed in this conversation context in 2-3 sentences:
    {formatted_text}
    """
    
    response = client.models.generate_content(
        model=settings.gemini_llm_model,
        contents=prompt
    )
    return response.text.strip()

def process_history_and_summarize(session_id: str, new_query: str, client) -> List[Dict[str, str]]:
    history = get_chat_history(session_id)
    
    total_tokens = sum(estimate_tokens(m["content"]) for m in history) + estimate_tokens(new_query)
    # print(f"total_tokens: {total_tokens}")
    if total_tokens > 6000:
        print("summarizing")
        keep_count = 4
        if len(history) > keep_count:
            to_summarize = history[:-keep_count]
            to_keep = history[-keep_count:]
            
            summary_text = summarize_old_messages(to_summarize, client)
            
            summary_message = {
                "role": "model",
                "content": f"[Summary of previous conversation: {summary_text}]"
            }

            # print(summary_message)
            history = [summary_message] + to_keep
            
            save_all_history(session_id, history)
            
    return history



client = genai.Client(api_key=settings.gemini_api_key)
def chat(chunks,question: str):
    prompt = build_prompt(chunks,question)
    response = client.models.generate_content(
        model=settings.gemini_llm_model,
        contents=prompt
    )
    return response.text


def chat_stream(chunks,query: str,session_id:str):
    from google.genai import types

    history = []
    if session_id:
        history = process_history_and_summarize(session_id, query, client)
        add_chat_message(session_id, "user", query)

    context = sanitaize_context(chunks)
    
    system_instruction = f"""
            You are a chatbot called askRepo.
            Rules:
            - Answer ONLY using the repository context.
            - Mention relevant file paths when possible.
            - If the answer is not contained in the context, say:
              "I could not find that information in the retrieved repository context."
            - Do not invent code or architecture details.
            - When showing code, use markdown code blocks with the correct language.
            - You do not need to add the Based on the repository context just keep the conversation friendly
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

    # print(contents)

    config = types.GenerateContentConfig(system_instruction=system_instruction)
    
    response = client.models.generate_content_stream(
        model=settings.gemini_llm_model,
        contents=contents,
        config=config
    )
    
    full_response = ""
    for chunk in response:
        full_response += chunk.text
        yield chunk.text

    if session_id:
        add_chat_message(session_id, "model", full_response)




