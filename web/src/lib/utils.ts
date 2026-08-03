export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(" ");
}

export const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "https://askrepo-api.ayussh.me";

export async function apiCall(
  path: string,
  method: string = "GET",
  body?: unknown,
  token?: string | null,
  onUnauthorized?: () => void
) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && onUnauthorized) {
    onUnauthorized();
  }

  return res;
}

export function getUserName(token: string): string {
  try {
    const payload = token.split(".")[1];
    const decoded = JSON.parse(atob(payload));
    return decoded.name || decoded.email.split("@")[0] || "User";
  } catch {
    return "User";
  }
}

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;

  if (window.location.hash) {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const idToken = params.get("id_token");
    if (idToken) {
      localStorage.setItem("google_auth_token", idToken);
      setTimeout(() => {
        if (
          typeof window !== "undefined" &&
          window.location.hash.includes("id_token")
        ) {
          window.history.replaceState(
            null,
            "",
            window.location.pathname + window.location.search,
          );
        }
      }, 0);
      return idToken;
    }
  }

  if (window.location.search) {
    const params = new URLSearchParams(window.location.search);
    const qToken = params.get("token");
    if (qToken) {
      localStorage.setItem("google_auth_token", qToken);
      return qToken;
    }
  }

  return localStorage.getItem("google_auth_token");
}

export function clearUserSession(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem("google_auth_token");
  localStorage.removeItem("active_ingest_job_id");
  localStorage.removeItem("active_ingest_repo_name");
  localStorage.removeItem("pending_repo_url");
}

export function isValidRepoUrl(input: string): boolean {
  if (!input || !input.trim()) return false;
  const str = input.trim();
  const fullUrlPattern = /^(https?:\/\/)?(www\.)?(github\.com|gitlab\.com)\/[\w.-]+\/[\w.-]+\/?$/i;
  const shorthandPattern = /^[\w.-]+\/[\w.-]+$/;
  return fullUrlPattern.test(str) || shorthandPattern.test(str);
}

export function normalizeRepoUrl(input: string): string {
  let str = input.trim();
  if (str.endsWith(".git")) {
    str = str.slice(0, -4);
  }
  if (!str.startsWith("http://") && !str.startsWith("https://")) {
    if (str.startsWith("github.com/") || str.startsWith("gitlab.com/")) {
      return `https://${str}`;
    }
    return `https://github.com/${str}`;
  }
  return str;
}

export interface CodeToken {
  type: "text" | "keyword" | "string" | "comment" | "number";
  text: string;
}

export function tokenizeCode(code: string): CodeToken[] {
  const tokens: CodeToken[] = [];
  let index = 0;

  const keywords = new Set([
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
      const type: CodeToken["type"] = keywords.has(word) ? "keyword" : "text";
      tokens.push({ type, text: word });
      index += word.length;
      continue;
    }

    tokens.push({ type: "text", text: firstChar });
    index++;
  }

  return tokens;
}
