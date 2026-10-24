export interface CodeToken {
  type: "text" | "keyword" | "string" | "comment" | "number";
  text: string;
}

const KEYWORDS = new Set([
  "class",
  "const",
  "function",
  "return",
  "import",
  "export",
  "default",
  "from",
  "if",
  "else",
  "for",
  "while",
  "break",
  "continue",
  "switch",
  "case",
  "try",
  "catch",
  "finally",
  "throw",
  "new",
  "true",
  "false",
  "null",
  "undefined",
  "var",
  "let",
  "def",
  "as",
  "in",
  "is",
  "and",
  "or",
  "not",
  "package",
  "struct",
  "interface",
  "impl",
  "fn",
  "type",
  "public",
  "private",
  "protected",
  "static",
  "async",
  "await",
  "nil",
  "func",
  "go",
  "select",
  "chan",
  "map",
  "range",
  "pub",
  "self",
  "Self",
  "where",
  "trait",
  "enum",
  "match",
  "mut",
  "ref",
]);

export function tokenizeCode(code: string): CodeToken[] {
  const tokens: CodeToken[] = [];
  let index = 0;

  while (index < code.length) {
    const remaining = code.slice(index);

    if (remaining.startsWith("//") || remaining.startsWith("#")) {
      const endOfLine = remaining.indexOf("\n");
      const length = endOfLine === -1 ? remaining.length : endOfLine;
      tokens.push({ type: "comment", text: remaining.slice(0, length) });
      index += length;
      continue;
    }
    if (remaining.startsWith("/*")) {
      const endComment = remaining.indexOf("*/");
      const length = endComment === -1 ? remaining.length : endComment + 2;
      tokens.push({ type: "comment", text: remaining.slice(0, length) });
      index += length;
      continue;
    }

    const firstChar = remaining[0];
    if (firstChar === '"' || firstChar === "'" || firstChar === "`") {
      let len = 1;
      let escaped = false;
      while (len < remaining.length) {
        const char = remaining[len];
        if (escaped) {
          escaped = false;
        } else if (char === "\\") {
          escaped = true;
        } else if (char === firstChar) {
          len++;
          break;
        }
        len++;
      }
      tokens.push({ type: "string", text: remaining.slice(0, len) });
      index += len;
      continue;
    }

    const numberMatch = remaining.match(/^\b\d+(?:\.\d+)?\b/);
    if (numberMatch) {
      tokens.push({ type: "number", text: numberMatch[0] });
      index += numberMatch[0].length;
      continue;
    }

    const identifierMatch = remaining.match(/^[a-zA-Z_$][a-zA-Z0-9_$]*/);
    if (identifierMatch) {
      const word = identifierMatch[0];
      const type: CodeToken["type"] = KEYWORDS.has(word) ? "keyword" : "text";
      tokens.push({ type, text: word });
      index += word.length;
      continue;
    }

    tokens.push({ type: "text", text: firstChar });
    index++;
  }

  return tokens;
}
