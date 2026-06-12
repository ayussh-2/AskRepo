import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Terminal } from "lucide-react";

export interface MessageProps extends React.HTMLAttributes<HTMLDivElement> {
  from: "user" | "assistant" | "system" | string;
}

export const Message = React.forwardRef<HTMLDivElement, MessageProps>(
  ({ className, from, children, ...props }, ref) => {
    const isUser = from === "user";
    return (
      <div
        ref={ref}
        className={cn(
          "flex flex-col max-w-[85%] group mb-4",
          isUser ? "ml-auto items-end is-user" : "mr-auto items-start is-assistant",
          className
        )}
        data-from={from}
        {...props}
      >
        {children}
      </div>
    );
  }
);
Message.displayName = "Message";

export interface MessageContentProps extends React.HTMLAttributes<HTMLDivElement> {}

export const MessageContent = React.forwardRef<HTMLDivElement, MessageContentProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "p-3 rounded-2xl border text-sm",
          "group-[.is-user]:bg-primary group-[.is-user]:text-primary-foreground group-[.is-user]:border-transparent group-[.is-user]:rounded-br-none",
          "group-[.is-assistant]:bg-secondary group-[.is-assistant]:text-foreground group-[.is-assistant]:border-border group-[.is-assistant]:rounded-bl-none",
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
MessageContent.displayName = "MessageContent";

export interface MessageResponseProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: string;
}

interface Token {
  type: "text" | "keyword" | "string" | "comment" | "number" | "tag" | "attr" | "builtin";
  text: string;
}

function tokenizeCode(code: string, lang: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;

  const keywords = new Set([
    "class", "const", "function", "return", "import", "export", "default",
    "from", "if", "else", "for", "while", "break", "continue", "switch", "case",
    "try", "catch", "finally", "throw", "new", "true", "false", "null", "undefined",
    "var", "let", "def", "as", "in", "is", "and", "or", "not", "package", "struct",
    "interface", "impl", "fn", "type", "public", "private", "protected", "static",
    "async", "await", "nil", "func", "go", "select", "chan", "map",
    "range", "extern", "mod", "use", "pub", "self", "Self", "where", "trait",
    "enum", "match", "mut", "ref"
  ]);

  while (index < code.length) {
    const remaining = code.slice(index);

    if (remaining.startsWith("//")) {
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
    if (remaining.startsWith("#")) {
      const endOfLine = remaining.indexOf("\n");
      const length = endOfLine === -1 ? remaining.length : endOfLine;
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
      const type: Token["type"] = keywords.has(word) ? "keyword" : "text";
      tokens.push({ type, text: word });
      index += word.length;
      continue;
    }

    tokens.push({ type: "text", text: firstChar });
    index++;
  }

  return tokens;
}

function tokenizeHtml(code: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;
  while (index < code.length) {
    const remaining = code.slice(index);

    if (remaining.startsWith("<!--")) {
      const endComment = remaining.indexOf("-->");
      const length = endComment === -1 ? remaining.length : endComment + 3;
      tokens.push({ type: "comment", text: remaining.slice(0, length) });
      index += length;
      continue;
    }

    if (remaining.startsWith("<")) {
      const closingBracket = remaining.indexOf(">");
      const length = closingBracket === -1 ? remaining.length : closingBracket + 1;
      tokens.push({ type: "tag", text: remaining.slice(0, length) });
      index += length;
      continue;
    }

    const nextBracket = remaining.indexOf("<");
    const length = nextBracket === -1 ? remaining.length : nextBracket;
    tokens.push({ type: "text", text: remaining.slice(0, length) });
    index += length;
  }
  return tokens;
}

const renderHtmlTag = (tagContent: string, key: number) => {
  let index = 0;
  const parts: React.ReactNode[] = [];

  if (tagContent.startsWith("</")) {
    parts.push(<span key="open" className="text-[#ff7b72]">&lt;/</span>);
    index = 2;
  } else if (tagContent.startsWith("<")) {
    parts.push(<span key="open" className="text-[#ff7b72]">&lt;</span>);
    index = 1;
  }

  const rest = tagContent.slice(index);
  const tagNameMatch = rest.match(/^[a-zA-Z0-9:-]+/);
  if (tagNameMatch) {
    const tagName = tagNameMatch[0];
    parts.push(<span key="tagname" className="text-[#7ee787]">{tagName}</span>);
    const remaining = rest.slice(tagName.length);
    let lastIndex = 0;
    const attrRegex = /\s+([a-zA-Z0-9:-]+)(?:=(["'])(.*?)\2)?/g;
    let match;
    while ((match = attrRegex.exec(remaining)) !== null) {
      const textBefore = remaining.slice(lastIndex, match.index);
      if (textBefore) parts.push(<span key={`text-${lastIndex}`}>{textBefore}</span>);
      parts.push(<span key={`attr-${match.index}`} className="text-[#79c0ff]">{match[1]}</span>);
      if (match[2]) {
        parts.push(<span key={`eq-${match.index}`}>=</span>);
        parts.push(<span key={`val-${match.index}`} className="text-[#a5d6ff]">{match[2]}{match[3]}{match[2]}</span>);
      }
      lastIndex = attrRegex.lastIndex;
    }
    const textAfter = remaining.slice(lastIndex);
    if (textAfter) parts.push(<span key="text-after" className="text-foreground">{textAfter}</span>);
  } else {
    parts.push(<span key="rest">{rest}</span>);
  }

  return <span key={key}>{parts}</span>;
};

/** Renders inline markdown: **bold**, *italic*, `code` */
function renderInlineMarkdown(text: string): React.ReactNode[] {
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`\n]+`)/g;
  const parts = text.split(pattern);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**"))
      return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>;
    if (part.startsWith("*") && part.endsWith("*"))
      return <em key={i}>{part.slice(1, -1)}</em>;
    if (part.startsWith("`") && part.endsWith("`"))
      return (
        <code key={i} className="px-1.5 py-0.5 mx-0.5 rounded bg-surface-3 border border-hairline font-mono text-[13px] text-primary">
          {part.slice(1, -1)}
        </code>
      );
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
}

/** Parse and render a block of non-code markdown text */
function renderMarkdownBlock(text: string, blockKey: number): React.ReactNode {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    const h1Match = line.match(/^# (.+)/);
    const h2Match = line.match(/^## (.+)/);
    const h3Match = line.match(/^### (.+)/);

    if (h1Match) {
      elements.push(<h1 key={`${blockKey}-h1-${i}`} className="text-xl font-semibold mt-4 mb-1">{renderInlineMarkdown(h1Match[1])}</h1>);
      i++; continue;
    }
    if (h2Match) {
      elements.push(<h2 key={`${blockKey}-h2-${i}`} className="text-base font-semibold mt-4 mb-1">{renderInlineMarkdown(h2Match[1])}</h2>);
      i++; continue;
    }
    if (h3Match) {
      elements.push(<h3 key={`${blockKey}-h3-${i}`} className="text-sm font-semibold mt-3 mb-0.5">{renderInlineMarkdown(h3Match[1])}</h3>);
      i++; continue;
    }

    if (/^---+$/.test(line.trim())) {
      elements.push(<hr key={`${blockKey}-hr-${i}`} className="border-border my-2" />);
      i++; continue;
    }

    if (/^\s*[*\-+] /.test(line)) {
      const listItems: React.ReactNode[] = [];
      while (i < lines.length && /^\s*[*\-+] /.test(lines[i])) {
        const itemText = lines[i].replace(/^\s*[*\-+] /, "");
        const indent = lines[i].match(/^(\s*)/)?.[1].length ?? 0;
        listItems.push(
          <li key={i} style={{ marginLeft: indent > 0 ? `${indent * 4}px` : undefined }} className="leading-relaxed">
            {renderInlineMarkdown(itemText)}
          </li>
        );
        i++;
      }
      elements.push(<ul key={`${blockKey}-ul-${i}`} className="list-disc list-outside pl-4 my-1 space-y-0.5 text-[14px]">{listItems}</ul>);
      continue;
    }

    if (/^\d+\. /.test(line)) {
      const listItems: React.ReactNode[] = [];
      while (i < lines.length && /^\d+\. /.test(lines[i])) {
        const itemText = lines[i].replace(/^\d+\. /, "");
        listItems.push(<li key={i} className="leading-relaxed">{renderInlineMarkdown(itemText)}</li>);
        i++;
      }
      elements.push(<ol key={`${blockKey}-ol-${i}`} className="list-decimal list-outside pl-4 my-1 space-y-0.5 text-[14px]">{listItems}</ol>);
      continue;
    }

    if (line.trim() === "") { i++; continue; }

    elements.push(
      <p key={`${blockKey}-p-${i}`} className="leading-relaxed text-[14px] whitespace-pre-wrap">
        {renderInlineMarkdown(line)}
      </p>
    );
    i++;
  }

  return <React.Fragment key={blockKey}>{elements}</React.Fragment>;
}

export const MessageResponse = React.forwardRef<HTMLDivElement, MessageResponseProps>(
  ({ className, children, ...props }, ref) => {
    if (!children) return null;

    const parts = children.split(/(```[\s\S]*?```)/g);

    return (
      <div ref={ref} className={cn("space-y-1", className)} {...props}>
        {parts.map((part, index) => {
          if (part.startsWith("```") && part.endsWith("```")) {
            const match = part.match(/```(\w*)\n([\s\S]*?)```/);
            const language = match ? match[1] : "";
            const code = match ? match[2] : part.slice(3, -3);
            const lang = language.toLowerCase();

            let highlightedTokens: React.ReactNode;
            if (lang === "html" || lang === "xml") {
              const tokens = tokenizeHtml(code);
              highlightedTokens = tokens.map((token, i) => {
                if (token.type === "tag") return renderHtmlTag(token.text, i);
                if (token.type === "comment") return <span key={i} className="text-[#8b949e] italic">{token.text}</span>;
                return <span key={i} className="text-[#c9d1d9]">{token.text}</span>;
              });
            } else {
              const tokens = tokenizeCode(code, lang);
              highlightedTokens = tokens.map((token, i) => {
                let tokenClass = "text-[#c9d1d9]";
                if (token.type === "keyword") tokenClass = "text-[#ff7b72] font-semibold";
                else if (token.type === "string") tokenClass = "text-[#a5d6ff]";
                else if (token.type === "comment") tokenClass = "text-[#8b949e] italic";
                else if (token.type === "number") tokenClass = "text-[#ff5555]";
                return <span key={i} className={tokenClass}>{token.text}</span>;
              });
            }

            return (
              <div key={index} className="my-2 rounded-lg bg-surface-2 border border-hairline overflow-hidden font-mono text-xs text-foreground w-full">
                {language && (
                  <div className="bg-surface-3 px-3 py-1.5 border-b border-hairline text-[10px] text-ink-subtle uppercase tracking-wider font-semibold flex items-center gap-1.5">
                    <Terminal className="size-3" />
                    {language}
                  </div>
                )}
                <pre className="p-3 overflow-x-auto text-ink-muted leading-relaxed select-all">
                  <code>{highlightedTokens}</code>
                </pre>
              </div>
            );
          }

          return renderMarkdownBlock(part, index);
        })}
      </div>
    );
  }
);
MessageResponse.displayName = "MessageResponse";

export interface MessageActionsProps extends React.HTMLAttributes<HTMLDivElement> {}

export const MessageActions = React.forwardRef<HTMLDivElement, MessageActionsProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "flex items-center gap-1.5 mt-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150",
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
MessageActions.displayName = "MessageActions";

export interface MessageActionProps extends React.ComponentProps<typeof Button> {
  label: string;
}

export const MessageAction = React.forwardRef<HTMLButtonElement, MessageActionProps>(
  ({ className, label, children, ...props }, ref) => {
    return (
      <Button
        ref={ref}
        variant="ghost"
        size="icon-xs"
        className={cn("text-muted-foreground hover:text-foreground size-6 [&_svg]:size-3", className)}
        title={label}
        aria-label={label}
        {...props}
      >
        {children}
      </Button>
    );
  }
);
MessageAction.displayName = "MessageAction";