import hashlib
import json
import os
import tiktoken
from dataclasses import dataclass
from typing import List
from ast_parser.data_models import ParseResult, Symbol
from utils.constants import ENCODER_MODEL,MAX_TOKENS,OVERLAP

enc = tiktoken.get_encoding(ENCODER_MODEL)

@dataclass
class Chunk:
    id: str
    text: str
    metadata: dict


def _make_id(repo_name: str, file_path: str, chunk_index: int, text: str) -> str:
    raw = f"{repo_name}:{file_path}:{chunk_index}:{text[:100]}"
    return hashlib.sha256(raw.encode()).hexdigest()


def _token_split(text, max_tokens=MAX_TOKENS, overlap=OVERLAP):
    """Split text into token windows with overlap. Returns (text, token_count, relative_start_line, relative_end_line)."""
    token_ids = enc.encode(text)
    if len(token_ids) <= max_tokens:
        return [(text, len(token_ids), 0, text.count('\n'))]

    chunks = []
    start = 0
    while start < len(token_ids):
        end = min(start + max_tokens, len(token_ids))
        chunk_tokens = token_ids[start:end]
        chunk_text = enc.decode(chunk_tokens)

        prefix_text = enc.decode(token_ids[:start])
        relative_start_line = prefix_text.count('\n')
        relative_end_line = relative_start_line + chunk_text.count('\n')

        chunks.append((chunk_text, len(chunk_tokens), relative_start_line, relative_end_line))

        if end == len(token_ids):
            break
        start += max_tokens - overlap

    return chunks

def chunk_symbol(symbol: Symbol, file_path: str, repo_name: str, commit_sha: str) -> List[Chunk]:
    """Turn one Symbol into one or more Chunks."""
    splits = _token_split(symbol.source)
    total = len(splits)
    chunks = []

    # FIX: Unpack all 4 values
    for i, (text, token_count, rel_start, rel_end) in enumerate(splits):
        chunk_id = _make_id(repo_name, file_path, i, text)
        chunks.append(Chunk(
            id=chunk_id,
            text=text,
            metadata={
                "repo_name": repo_name,
                "commit_sha": commit_sha,
                "file_path": file_path,
                "language": symbol.language,
                "chunk_index": i,
                "total_chunks": total,
                "start_line": symbol.start_line + rel_start,
                "end_line": symbol.start_line + rel_end,
                "token_count": token_count,
                "symbol_name": symbol.name,
                "symbol_type": symbol.symbol_type,
                "docstring": symbol.docstring or "",
            }
        ))
    return chunks


def chunk_orphans(orphan_src: str, file_path: str, language: str,
                  repo_name: str, commit_sha: str) -> List[Chunk]:
    """Turn orphan lines into module_context chunks."""
    if not orphan_src.strip():
        return []

    splits = _token_split(orphan_src)
    total = len(splits)
    chunks = []

    for i, (text, token_count, rel_start, rel_end) in enumerate(splits):
        chunk_id = _make_id(repo_name, f"{file_path}::orphan", i, text)
        chunks.append(Chunk(
            id=chunk_id,
            text=text,
            metadata={
                "repo_name": repo_name,
                "commit_sha": commit_sha,
                "file_path": file_path,
                "language": language,
                "chunk_index": i,
                "total_chunks": total,
                "start_line": rel_start + 1,
                "end_line": rel_end + 1,
                "token_count": token_count,
                "symbol_name": "",
                "symbol_type": "module_context",
                "docstring": "",
            }
        ))
    return chunks


def chunk_text_file(content: str, file_path: str, repo_name: str, commit_sha: str) -> List[Chunk]:
    """Chunks a plain text or markdown file using the sliding window."""
    if not content.strip():
        return []

    splits = _token_split(content)
    total = len(splits)
    chunks = []

    ext = file_path.lower().split('.')[-1]
    language = "markdown" if ext in ["md", "mdx"] else "text"
    filename = file_path.replace("\\", "/").split("/")[-1]

    for i, (text, token_count, rel_start, rel_end) in enumerate(splits):
        chunk_id = _make_id(repo_name, file_path, i, text)
        chunks.append(Chunk(
            id=chunk_id,
            text=text,
            metadata={
                "repo_name": repo_name,
                "commit_sha": commit_sha,
                "file_path": file_path.replace("\\", "/"),
                "language": language,
                "chunk_index": i,
                "total_chunks": total,
                "start_line": rel_start + 1,
                "end_line": rel_end + 1,
                "token_count": token_count,
                "symbol_name": filename,
                "symbol_type": "document",
                "docstring": "",
            }
        ))
    return chunks

def chunk_parse_result(result: ParseResult, repo_name: str, commit_sha: str) -> List[Chunk]:
    """Main entry point. Takes a full ParseResult, returns all chunks."""
    all_chunks = []
    for symbol in result.symbols:
        all_chunks.extend(chunk_symbol(symbol, result.file_path, repo_name, commit_sha))
    all_chunks.extend(
        chunk_orphans(result.orphan_src, result.file_path, result.language, repo_name, commit_sha)
    )
    return all_chunks

def output_to_txt(all_chunks):
    try:
        base_dir = os.path.dirname(__file__)
        temp_path = os.path.join(base_dir, "temp.txt")
        with open(temp_path, "w", encoding="utf-8") as f:
            json.dump(all_chunks, f, ensure_ascii=False, indent=2, default=str)
    except Exception:
        pass

