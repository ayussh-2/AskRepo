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


def _token_split(text: str, max_tokens: int = MAX_TOKENS, overlap: int = OVERLAP) -> List[tuple]:
    """Split text into token windows with overlap. Returns list of (text, token_count)."""
    token_ids = enc.encode(text)
    if len(token_ids) <= max_tokens:
        return [(text, len(token_ids))]

    chunks = []
    start = 0
    while start < len(token_ids):
        end = min(start + max_tokens, len(token_ids))
        chunk_tokens = token_ids[start:end]
        chunk_text = enc.decode(chunk_tokens)
        chunks.append((chunk_text, len(chunk_tokens)))
        if end == len(token_ids):
            break
        start += max_tokens - overlap
    return chunks


def chunk_symbol(symbol: Symbol, file_path: str, repo_name: str, commit_sha: str) -> List[Chunk]:
    """Turn one Symbol into one or more Chunks."""
    splits = _token_split(symbol.source)
    total = len(splits)
    chunks = []

    for i, (text, token_count) in enumerate(splits):
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
                "start_line": symbol.start_line,
                "end_line": symbol.end_line,
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

    for i, (text, token_count) in enumerate(splits):
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
                "start_line": 0,
                "end_line": 0,
                "token_count": token_count,
                "symbol_name": "",
                "symbol_type": "module_context",
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