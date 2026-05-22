"""
Language configuration for tree-sitter parsing.
"""

from pathlib import Path

EXTENSION_TO_LANGUAGE: dict[str, str] = {
    ".py":   "python",
    ".js":   "javascript",
    ".mjs":  "javascript",
    ".cjs":  "javascript",
    ".jsx":  "javascript",
    ".ts":   "typescript",
    ".tsx":  "typescript",
    ".java": "java",
    ".go":   "go",
    ".rs":   "rust",
    ".cpp":  "cpp",
    ".cc":   "cpp",
    ".cxx":  "cpp",
    ".c":    "c",
    ".h":    "c",
}

# AST node types we extract as symbols per language.
SYMBOL_NODE_TYPES: dict[str, set[str]] = {
    "python": {
        "function_definition",
        "class_definition",
    },

    "javascript": {
        "function_declaration",
        "class_declaration",
        "method_definition",
        "lexical_declaration",
        "export_statement",
    },

    "typescript": {
        "function_declaration",
        "class_declaration",
        "method_definition",
        "lexical_declaration",
        "export_statement",
        "abstract_class_declaration",
        "interface_declaration",
        "type_alias_declaration",
    },

    "java": {
        "class_declaration",
        "method_declaration",
        "interface_declaration",
        "enum_declaration",
        "constructor_declaration",
    },

    "go": {
        "function_declaration",
        "method_declaration",
        "type_declaration",
    },

    "rust": {
        "function_item",
        "impl_item",
        "struct_item",
        "trait_item",
        "enum_item",
    },

    "cpp": {
        "function_definition",
        "class_specifier",
        "struct_specifier",
        "namespace_definition",
    },

    "c": {
        "function_definition",
        "struct_specifier",
    },
}


def detect_language(file_path: str) -> str | None:
    """Return tree-sitter language name for a file, or None if unsupported."""
    ext = Path(file_path).suffix.lower()
    return EXTENSION_TO_LANGUAGE.get(ext)