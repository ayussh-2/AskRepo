"""
API for tree-sitter AST parsing.
"""

from __future__ import annotations
from pathlib import Path
from typing import Optional
import warnings
import json
import tiktoken
from tree_sitter_languages import get_parser as ts_get_parser

from utils.constants import ENCODER_MODEL, IGNORED_DIRS, TEXT_EXTENSIONS, IGNORED_EXTENSIONS
from .data_models import ParseResult
from .language_config import EXTENSION_TO_LANGUAGE, SYMBOL_NODE_TYPES
from .ast_walker import walk, flatten, find_orphan_lines

warnings.filterwarnings("ignore", category=FutureWarning)

import mimetypes

def is_text_file(file_path: Path) -> bool:
    ext = file_path.suffix.lower()
    if ext in TEXT_EXTENSIONS:
        return True
    
    # Dynamically detect text files without hardcoding names like "README"
    mime_type, _ = mimetypes.guess_type(str(file_path))
    if mime_type is not None and mime_type.startswith('text/'):
        return True

    # Fallback for extensionless text files (e.g. README, LICENSE, Dockerfile)
    if not ext:
        try:
            with open(file_path, "rb") as f:
                sample = f.read(1024)
                if sample and b"\x00" not in sample:
                    return True
        except Exception:
            pass

    return False

def generate_repo_tree_summary(root_path: str, max_depth: int = 3) -> str:
    """Generates a clean text representation of the top-level directory structure."""
    root = Path(root_path).resolve()
    lines = [f"Repository Structure for {root.name}:"]
    
    for path in sorted(root.rglob("*")):
        if any(skip in path.parts for skip in IGNORED_DIRS):
            continue
        rel = path.relative_to(root)
        depth = len(rel.parts)
        if depth <= max_depth:
            prefix = "  " * (depth - 1) + "├── "
            lines.append(f"{prefix}{rel.name}{'/' if path.is_dir() else ''}")
            
    return "\n".join(lines[:150])

def detect_language(file_path: str) -> Optional[str]:
    ext = Path(file_path).suffix.lower()
    return EXTENSION_TO_LANGUAGE.get(ext)

def parse_file(file_path: str) -> Optional[ParseResult]:
    """
    Parse a source file into symbols using tree-sitter.
    """
    try:
        source = Path(file_path).read_text(encoding="utf-8", errors="ignore")
    except Exception:
        return None

    if not source:
        return None
    language = detect_language(file_path)
    if language is None:
        return None

    target_types = SYMBOL_NODE_TYPES.get(language, set())
    if not target_types:
        return None

    # parse source into AST
    parser = ts_get_parser(language)
    tree   = parser.parse(bytes(source, "utf-8"))

    source_lines = source.splitlines()

    # walk the AST and extract symbols
    nested_symbols = walk(
        node         = tree.root_node,
        source_lines = source_lines,
        language     = language,
        target_types = target_types,
    )

    # flatten to a list (top-level + nested methods)
    flat_symbols = flatten(nested_symbols)

    # find lines not covered by any symbol
    orphan_src = find_orphan_lines(source_lines, flat_symbols)

    return ParseResult(
        file_path  = file_path,
        language   = language,
        symbols    = flat_symbols,
        orphan_src = orphan_src,
    )

def parse_directory(
    root_path: str,
    skip_dirs: set[str] | None = None,
) -> tuple[list[ParseResult], list[dict]]:
    """
    Recursively parse all supported files in a directory.
    Returns a tuple: (ast_results, text_results)
    """
    if skip_dirs is None:
        skip_dirs = IGNORED_DIRS

    ast_results = []
    text_results = []
    root = Path(root_path).resolve()

    for file_path in root.rglob("*"):
        if not file_path.is_file():
            continue

        if any(skip in file_path.parts for skip in skip_dirs):
            continue

        ext = file_path.suffix.lower()
        if ext in IGNORED_EXTENSIONS:
            continue

        rel_path = str(file_path.relative_to(root)).replace("\\", "/")

        if is_text_file(file_path):
            try:
                content = file_path.read_text(encoding="utf-8", errors="ignore")
                text_results.append({
                    "file_path": rel_path,
                    "content": content
                })
            except Exception:
                pass
            continue

        if detect_language(str(file_path)) is None:
            continue

        result = parse_file(str(file_path))
        if result:
            result.file_path = rel_path
            ast_results.append(result)

    return ast_results, text_results

def save_ast_results_to_json(results: list, dir: str | Path) -> None:
    ast_output_dir = Path(dir) / "tree_sitter_results"
    ast_output_dir.mkdir(parents=True, exist_ok=True)
    encoder = tiktoken.get_encoding(ENCODER_MODEL)
    for result in results:
        safe_name = result.file_path.replace("/", "_").replace("\\", "_") + ".json"
        output_file = ast_output_dir / safe_name

        symbols_data = [
            {
                "name": s.name,
                "type": s.symbol_type,
                "start_line": s.start_line,
                "end_line": s.end_line,
                "language": s.language,
                "parent": s.parent_name,
                "docstring": s.docstring,
                "source": s.source,
                "token_count": len(encoder.encode(s.source))
            }
            for s in result.symbols
        ]

        output_data = {
            "file_path": result.file_path.replace("\\", "/"),
            "language": result.language,
            "symbols": symbols_data,
            "orphan_lines_count": len(result.orphan_src.splitlines()) if result.orphan_src else 0,
        }

        with open(output_file, "w", encoding="utf-8") as f:
            json.dump(output_data, f, indent=2)
