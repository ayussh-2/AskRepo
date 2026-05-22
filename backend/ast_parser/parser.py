"""
API for tree-sitter AST parsing.
"""

from __future__ import annotations
from pathlib import Path
from typing import Optional
import warnings
import json

warnings.filterwarnings("ignore", category=FutureWarning)

import tiktoken
from tree_sitter_languages import get_parser as ts_get_parser

from .data_models import ParseResult
from .language_config import EXTENSION_TO_LANGUAGE, SYMBOL_NODE_TYPES
from .ast_walker import walk, flatten, find_orphan_lines


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
) -> list[ParseResult]:
    """
    Recursively parse all supported files in a directory.
    """
    if skip_dirs is None:
        skip_dirs = {
            ".git", "node_modules", "__pycache__", ".venv",
            "venv", "dist", "build", ".next", "coverage",
            "vendor", "target",
        }

    results = []
    root = Path(root_path).resolve()

    for file_path in root.rglob("*"):
        if not file_path.is_file():
            continue
        if any(skip in file_path.parts for skip in skip_dirs):
            continue
        if detect_language(str(file_path)) is None:
            continue

        result = parse_file(str(file_path))
        if result:
            result.file_path = str(file_path.relative_to(root))
            results.append(result)

    return results

def save_ast_results_to_json(results: list, dir: str | Path) -> None:
    """
    Saves a list of AST extraction results to individual JSON files.
    Creates an 'ast' subdirectory inside the provided repository path.
    """
    ast_output_dir = Path(dir) / "tree_sitter_results"
    ast_output_dir.mkdir(parents=True, exist_ok=True)
    # cl100k_base is the standard for OpenAI embeddings
    encoder = tiktoken.get_encoding("cl100k_base")
    for result in results:
        # Create a safe filename by replacing path separators with underscores
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
            "file_path": result.file_path,
            "language": result.language,
            "symbols": symbols_data,
            "orphan_lines_count": len(result.orphan_src.splitlines()) if result.orphan_src else 0,
        }

        with open(output_file, "w", encoding="utf-8") as f:
            json.dump(output_data, f, indent=2)