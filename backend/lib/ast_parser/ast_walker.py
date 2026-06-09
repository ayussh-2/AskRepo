"""
Core AST walking and symbol extraction logic.
Handles recursive traversal of tree-sitter AST and building symbol trees.
"""

from .data_models import Symbol
from .extractors import extract_docstring, extract_go_receiver, get_name


# tree-sitter node has:
#   node.type        → string like "function_definition" or "class_declaration"
#   node.children    → list of child nodes
#   node.start_point → (row, col) tuple, 0-indexed
#   node.end_point   → (row, col) tuple, 0-indexed
#   node.text        → raw bytes of that node's source (if using node.text)

# recursively walk down as tree
def walk(
    node,
    source_lines: list[str],
    language: str,
    target_types: set[str],
    parent_name: str = "",
    depth: int = 0,
) -> list[Symbol]:
    symbols = []

    if node.type in target_types:
        start = node.start_point[0]
        end   = node.end_point[0]

        name      = get_name(node, language)
        docstring = extract_docstring(node, language, source_lines)
        source    = "\n".join(source_lines[start : end + 1])

        if language == "go" and node.type == "method_declaration":
            parent_name = extract_go_receiver(node)

        symbol = Symbol(
            name        = name,
            symbol_type = node.type,
            start_line  = start + 1,     # convert to 1-indexed
            end_line    = end + 1,
            source      = source,
            docstring   = docstring,
            language    = language,
            parent_name = parent_name,
        )


        for child in node.children:
            nested = walk(
                child,
                source_lines,
                language,
                target_types,
                parent_name = name,     # this symbol is the parent now
                depth       = depth + 1,
            )
            symbol.children.extend(nested)

        symbols.append(symbol)

    else:
        for child in node.children:
            symbols.extend(
                walk(child, source_lines, language, target_types, parent_name, depth)
            )

    return symbols

# for better recall
def flatten(symbols: list[Symbol]) -> list[Symbol]:
    result = []
    for sym in symbols:
        result.append(sym)
        if sym.children:
            result.extend(flatten(sym.children))
    return result

# for non function/class defn lines
def find_orphan_lines(
    source_lines: list[str],
    symbols: list[Symbol],
) -> str:

    covered: set[int] = set()

    flat_symbols = flatten(symbols)

    for sym in flat_symbols:
        for line_no in range(sym.start_line, sym.end_line + 1):
            covered.add(line_no)

    orphan_lines = [
        line
        for i, line in enumerate(source_lines, start=1)
        if i not in covered
    ]

    return "\n".join(orphan_lines).strip()