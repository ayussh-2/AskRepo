"""
Data models for AST parsing results.
"""

from __future__ import annotations
from dataclasses import dataclass, field


@dataclass
class Symbol:
    """
    This is the output of parsing. One Symbol = one potential chunk.
    """
    name:        str
    symbol_type: str        # tree-sitter node type e.g. "class_definition"
    start_line:  int        # 1-indexed line number where this symbol starts
    end_line:    int        # 1-indexed line number where this symbol ends
    source:      str
    docstring:   str      = ""  # extracted doc comment / docstring (empty if none)
    language:    str      = "" # if this is a method, the name of its class (or empty)
    parent_name: str      = ""
    children:    list[Symbol] = field(default_factory=list)

    @property
    def line_count(self) -> int:
        return self.end_line - self.start_line + 1

    def __repr__(self):
        return (
            f"Symbol({self.symbol_type} {self.name!r} "
            f"L{self.start_line}-{self.end_line}"
            f"{' parent=' + self.parent_name if self.parent_name else ''})"
        )


@dataclass
class ParseResult:
    """
    The full output of parsing one file.
    """
    file_path:  str             # relative path of the parsed file
    language:   str
    symbols:    list[Symbol]    # flat list of all extracted symbols (top-level + nested)
    orphan_src: str   = ""      # source lines that don't belong to any symbol
