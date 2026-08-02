import * as React from "react";
import { useState } from "react";
import { Copy, Check, Terminal } from "lucide-react";
import { Message } from "./types";
import { TextShimmer } from "@/components/ui/text-shimmer";
import { tokenizeCode } from "@/lib/utils";

// Inline markdown helper: **bold**, *italic*, `code`
function renderInlineMarkdown(text: string): React.ReactNode[] {
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`\n]+`)/g;
  const parts = text.split(pattern);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**"))
      return <strong key={i} className="font-semibold text-[#f7f8f8]">{part.slice(2, -2)}</strong>;
    if (part.startsWith("*") && part.endsWith("*"))
      return <em key={i}>{part.slice(1, -1)}</em>;
    if (part.startsWith("`") && part.endsWith("`"))
      return (
        <code key={i} className="px-1.5 py-0.5 mx-0.5 rounded bg-[#202020] border border-[#23252a] font-mono text-[12.5px] text-[#5e6ad2]">
          {part.slice(1, -1)}
        </code>
      );
    return <span key={i}>{part}</span>;
  });
}

// Block markdown renderer matching Extension message.tsx
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
      elements.push(<h1 key={`${blockKey}-h1-${i}`} className="text-lg font-semibold text-[#f7f8f8] mt-3 mb-1">{renderInlineMarkdown(h1Match[1])}</h1>);
      i++; continue;
    }
    if (h2Match) {
      elements.push(<h2 key={`${blockKey}-h2-${i}`} className="text-base font-semibold text-[#f7f8f8] mt-3 mb-1">{renderInlineMarkdown(h2Match[1])}</h2>);
      i++; continue;
    }
    if (h3Match) {
      elements.push(<h3 key={`${blockKey}-h3-${i}`} className="text-sm font-semibold text-[#f7f8f8] mt-2 mb-0.5">{renderInlineMarkdown(h3Match[1])}</h3>);
      i++; continue;
    }

    if (/^---+$/.test(line.trim())) {
      elements.push(<hr key={`${blockKey}-hr-${i}`} className="border-[#23252a] my-2" />);
      i++; continue;
    }

    if (/^\s*[*\-+] /.test(line)) {
      const listItems: React.ReactNode[] = [];
      while (i < lines.length && /^\s*[*\-+] /.test(lines[i])) {
        const itemText = lines[i].replace(/^\s*[*\-+] /, "");
        const indent = lines[i].match(/^(\s*)/)?.[1].length ?? 0;
        listItems.push(
          <li key={i} style={{ marginLeft: indent > 0 ? `${indent * 4}px` : undefined }} className="leading-relaxed text-[#d0d6e0]">
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
        listItems.push(<li key={i} className="leading-relaxed text-[#d0d6e0]">{renderInlineMarkdown(itemText)}</li>);
        i++;
      }
      elements.push(<ol key={`${blockKey}-ol-${i}`} className="list-decimal list-outside pl-4 my-1 space-y-0.5 text-[14px]">{listItems}</ol>);
      continue;
    }

    if (line.trim() === "") { i++; continue; }

    elements.push(
      <p key={`${blockKey}-p-${i}`} className="leading-relaxed text-[14px] text-[#d0d6e0] my-0.5 whitespace-pre-wrap">
        {renderInlineMarkdown(line)}
      </p>
    );
    i++;
  }

  return <div key={blockKey} className="space-y-1">{elements}</div>;
}

export interface ChatMessageProps {
  message: Message;
  isLoading?: boolean;
  isLastMessage?: boolean;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message, isLoading, isLastMessage }) => {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === "user";

  const renderContent = (text: string) => {
    const parts = text.split(/(```[\s\S]*?```)/g);

    return parts.map((part, index) => {
      if (part.startsWith("```") && part.endsWith("```")) {
        const match = part.match(/```(\w*)\n([\s\S]*?)```/);
        const language = match ? match[1] : "";
        const code = match ? match[2] : part.slice(3, -3);

        const tokens = tokenizeCode(code);

        return (
          <div key={index} className="my-2.5 rounded-xl bg-[#131416] border border-[#23252a] overflow-hidden font-mono text-xs w-full">
            {language && (
              <div className="bg-[#202020] px-3.5 py-1.5 border-b border-[#23252a] text-[10px] text-[#8a8f98] uppercase tracking-wider font-mono font-semibold flex items-center gap-1.5">
                <Terminal size={12} className="text-[#8a8f98]" />
                <span>{language}</span>
              </div>
            )}
            <pre className="p-3.5 overflow-x-auto text-[#d0d6e0] leading-relaxed select-all">
              <code>
                {tokens.map((token, i) => {
                  let cls = "text-[#d0d6e0]";
                  if (token.type === "keyword") cls = "text-[#ff7b72] font-semibold";
                  else if (token.type === "string") cls = "text-[#a5d6ff]";
                  else if (token.type === "comment") cls = "text-[#8b949e] italic";
                  else if (token.type === "number") cls = "text-[#ff5555]";
                  return <span key={i} className={cls}>{token.text}</span>;
                })}
              </code>
            </pre>
          </div>
        );
      }

      return renderMarkdownBlock(part, index);
    });
  };

  return (
    <div className="group flex flex-col w-full">
      <div
        className={`flex flex-col max-w-[85%] ${
          isUser ? "ml-auto items-end" : "mr-auto items-start"
        }`}
      >
        <div
          className={`p-3 rounded-2xl border text-sm leading-relaxed ${
            isUser
              ? "bg-[#5e6ad2] text-white border-transparent rounded-br-none"
              : "bg-[#131416] text-[#d0d6e0] border-[#23252a] rounded-bl-none"
          }`}
        >
          {message.content === "" && isLoading && isLastMessage ? (
            <div className="flex items-center gap-1.5 py-0.5 px-1">
              <TextShimmer className="font-sans text-sm">
                Thinking...
              </TextShimmer>
            </div>
          ) : (
            renderContent(message.content)
          )}
        </div>
      </div>

      {!isUser && message.content !== "" && !message.isError && (
        <div className="flex items-center gap-1.5 mt-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150 pl-1">
          <button
            onClick={async () => {
              await navigator.clipboard.writeText(message.content);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            className="text-[#8a8f98] hover:text-[#f7f8f8] p-1 rounded hover:bg-[#202020] transition-colors cursor-pointer flex items-center gap-1 text-xs"
            title="Copy response"
          >
            {copied ? (
              <>
                <Check size={12} className="text-[#27a644]" />
                <span className="text-[#27a644]">Copied!</span>
              </>
            ) : (
              <>
                <Copy size={12} />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};
