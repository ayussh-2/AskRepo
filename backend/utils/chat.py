from collections import defaultdict
from google import genai
from .config import settings


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

client = genai.Client(api_key=settings.gemini_api_key)

def chat(chunks,question: str):
    prompt = build_prompt(chunks,question)
    response = client.models.generate_content(
        model=settings.gemini_llm_model,
        contents=prompt
    )
    return response.text


def chat_stream(chunks,question: str):
    prompt = build_prompt(chunks,question)
    response = client.models.generate_content_stream(
    model=settings.gemini_llm_model,
    contents=prompt
)
    for chunk in response:
        # print(chunk.text)
        yield chunk.text


