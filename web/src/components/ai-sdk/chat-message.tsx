import * as React from "react";
import { useState } from "react";
import { Copy, Check, Terminal } from "lucide-react";
import { Message } from "./types";
import { TextShimmer } from "@/components/ui/text-shimmer";
import { tokenizeCode } from "@/lib/utils";
import { renderMarkdownBlock } from "./markdown-renderer";

export interface ChatMessageProps {
  message: Message;
  isLoading?: boolean;
  isLastMessage?: boolean;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({
  message,
  isLoading,
  isLastMessage,
}) => {
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
          <div
            key={index}
            className="my-2.5 rounded-xl bg-[#131416] border border-[#23252a] overflow-hidden font-mono text-xs w-full"
          >
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
                  return (
                    <span key={i} className={cls}>
                      {token.text}
                    </span>
                  );
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
        {!isUser && message.switchedModel && (
          <div className="mb-1.5 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-700 dark:text-amber-400 text-xs font-medium animate-in fade-in duration-200">
            <span className="flex size-1.5 rounded-full bg-amber-500 shrink-0 animate-pulse" />
            <span>
              The requested model was unavailable. Automatically switched to{" "}
              <strong className="font-semibold text-zinc-900 dark:text-[#f7f8f8]">
                {message.switchedModel.model.split("/").pop()?.replace(/-/g, " ")}
              </strong>{" "}
              ({message.switchedModel.provider}).
            </span>
          </div>
        )}

        <div
          className={`p-3 rounded-2xl border text-sm leading-relaxed ${
            isUser
              ? "bg-[#5e6ad2] text-white border-transparent rounded-br-none"
              : "bg-zinc-100 dark:bg-[#131416] text-zinc-800 dark:text-[#d0d6e0] border-zinc-200 dark:border-[#23252a] rounded-bl-none shadow-sm dark:shadow-none"
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
