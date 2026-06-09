"""
Symbol extraction utilities for AST nodes.
"""

def _find_node_by_type(node, target_type: str):
    """Recursively traverses a subtree to find the first match of a specific node type."""
    if node.type == target_type:
        return node
    for child in node.children:
        found = _find_node_by_type(child, target_type)
        if found:
            return found
    return None

def extract_go_receiver(node) -> str:
    """Extracts the struct name from a Go method receiver."""
    if node.type != "method_declaration":
        return ""

    # Tree-sitter Go AST: method_declaration -> parameter_list -> parameter_declaration
    for child in node.children:
        if child.type == "parameter_list": # This is the receiver block
            for param in child.children:
                if param.type == "parameter_declaration":
                    for t_node in param.children:
                        if t_node.type == "type_identifier":
                            return t_node.text.decode("utf-8", errors="replace")
                        elif t_node.type == "pointer_type": # Handle e.g., (s *Server)
                            for ptr_child in t_node.children:
                                if ptr_child.type == "type_identifier":
                                    return ptr_child.text.decode("utf-8", errors="replace")
    return ""

def extract_basic_name(node) -> str:
    """
    Universal fallback for languages that use direct child identifiers.
    Works for Python, Java, Rust, and basic C/C++/Go/JS/TS declarations.
    """
    for child in node.children:
        if child.type in ("identifier", "field_identifier", "type_identifier"):
            return child.text.decode("utf-8", errors="replace")
    return "unknown"


def extract_go_name(node) -> str:
    """Extract symbol name for Go."""
    if node.type == "type_declaration":
        tspec = _find_node_by_type(node, "type_spec")
        if tspec:
            tident = _find_node_by_type(tspec, "type_identifier")
            if tident:
                return tident.text.decode("utf-8", errors="replace")
    elif node.type == "method_declaration":
        for child in node.children:
            if child.type == "field_identifier":
                return child.text.decode("utf-8", errors="replace")

    return extract_basic_name(node)


def extract_js_ts_name(node) -> str:
    """Extract symbol name for JavaScript and TypeScript."""
    if node.type == "lexical_declaration":
        vdecl = _find_node_by_type(node, "variable_declarator")
        if vdecl and vdecl.children:
            first_child = vdecl.children[0]
            if first_child.type in ("identifier", "object_pattern", "array_pattern"):
                return first_child.text.decode("utf-8", errors="replace")
    elif node.type == "export_statement":
        for child in node.children:
            if child.type in ("function_declaration", "class_declaration",
                              "lexical_declaration", "interface_declaration",
                              "abstract_class_declaration", "type_alias_declaration"):
                return extract_js_ts_name(child)
        return "default_export"
    elif node.type == "method_definition":
        for child in node.children:
            if child.type in ("property_identifier", "private_property_identifier"):
                return child.text.decode("utf-8", errors="replace")

    return extract_basic_name(node)


def extract_c_cpp_name(node) -> str:
    """Extract symbol name for C and C++."""
    if node.type == "function_definition":
        fdecl = _find_node_by_type(node, "function_declarator")
        if fdecl:
            ident = _find_node_by_type(fdecl, "identifier") or _find_node_by_type(fdecl, "field_identifier")
            if ident:
                return ident.text.decode("utf-8", errors="replace")

    elif node.type == "namespace_definition":
        nident = _find_node_by_type(node, "namespace_identifier")
        if nident:
            return nident.text.decode("utf-8", errors="replace")

    return extract_basic_name(node)


def get_name(node, language: str) -> str:
    """
    Main entry point to extract the symbol's identifier name.
    Routes to the language-specific extractor.
    """
    if language == "go":
        return extract_go_name(node)
    elif language in ("javascript", "typescript"):
        return extract_js_ts_name(node)
    elif language in ("c", "cpp"):
        return extract_c_cpp_name(node)
    elif language in ("python", "java", "rust"):
        return extract_basic_name(node)
    else:
        return extract_basic_name(node)


# ── Docstring / Comment Extraction ───────────────────────────────────────────

def extract_python_comment(node) -> str:
    """Python-style: first statement in a block that's a string literal."""
    for child in node.children:
        if child.type in ("block", "body"):
            for stmt in child.children:
                if stmt.type == "expression_statement":
                    for sub in stmt.children:
                        if sub.type == "string":
                            raw = sub.text.decode("utf-8", errors="replace")
                            clean = raw.strip()
                            for quote in ('"""', "'''", '"', "'"):
                                if clean.startswith(quote) and clean.endswith(quote):
                                    clean = clean[len(quote):-len(quote)]
                                    break
                            return clean.strip()[:500]
    return ""


def extract_go_comment(node, source_lines: list[str]) -> str:
    """Go-style: consecutive // comment lines immediately above a declaration."""
    start_row = node.start_point[0]
    comments = []

    i = start_row - 1
    while i >= 0:
        line = source_lines[i].strip()
        if line.startswith("//"):
            comments.insert(0, line.lstrip("/").strip())
            i -= 1
        else:
            break

    return " ".join(comments)[:500]


def extract_leading_comment(node, source_lines: list[str]) -> str:
    """C, C++, Java, JS, TS, Rust: /** */, /// or // block comments above a node."""
    start_row = node.start_point[0]
    i = start_row - 1
    comment_lines = []

    if i >= 0 and source_lines[i].strip() == "*/":
        i -= 1
        while i >= 0:
            line = source_lines[i].strip()
            if line.startswith("/*"):
                break
            clean = line.lstrip("* ").strip()
            if clean:
                comment_lines.insert(0, clean)
            i -= 1
    else:
        while i >= 0:
            line = source_lines[i].strip()
            if line.startswith("///"):  # Handle Rust documentation items
                comment_lines.insert(0, line.lstrip("/").strip())
                i -= 1
            elif line.startswith("//"):
                comment_lines.insert(0, line.lstrip("/").strip())
                i -= 1
            else:
                break

    return " ".join(comment_lines)[:500]


def extract_docstring(node, lang: str, source_lines: list[str]) -> str:
    """
    Main entry point for extracting docstrings and comments.
    Routes to the appropriate language extractor using a match/case statement.
    """
    match lang:
        case "python":
            return extract_python_comment(node)
        case "go":
            return extract_go_comment(node, source_lines)
        case "java" | "cpp" | "c" | "javascript" | "typescript" | "rust":
            return extract_leading_comment(node, source_lines)
        case _:
            return ""