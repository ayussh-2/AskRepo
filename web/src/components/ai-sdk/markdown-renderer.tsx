import * as React from "react";
import { ExternalLink } from "lucide-react";

export function renderInlineMarkdown(text: string): React.ReactNode[] {
  const pattern =
    /(\[[^\]]+\]\([^\s)]+\)|https?:\/\/[^\s<>)\]"]+|\*\*[^*]+\*\*|\*[^*]+\*|`[^`\n]+`)/g;
  const parts = text.split(pattern);

  return parts.map((part, i) => {
    // 1. Markdown Links: [text](url)
    const linkMatch = part.match(/^\[([^\]]+)\]\(([^\s)]+)\)$/);
    if (linkMatch) {
      const linkText = linkMatch[1];
      const linkUrl = linkMatch[2];
      return (
        <a
          key={i}
          href={linkUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#5e6ad2] dark:text-[#7e8ce0] hover:underline underline-offset-2 break-all font-medium inline-flex items-center gap-0.5 hover:opacity-85 transition-opacity"
        >
          <span>{linkText}</span>
          <ExternalLink size={11} className="inline opacity-70 shrink-0" />
        </a>
      );
    }

    // 2. Bare URLs: https://... or http://...
    if (/^https?:\/\//.test(part)) {
      let url = part;
      let trailing = "";
      const trailMatch = url.match(/([.,;:!?]+)$/);
      if (trailMatch) {
        trailing = trailMatch[1];
        url = url.slice(0, -trailing.length);
      }
      return (
        <React.Fragment key={i}>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#5e6ad2] dark:text-[#7e8ce0] hover:underline underline-offset-2 break-all font-medium inline-flex items-center gap-0.5 hover:opacity-85 transition-opacity"
          >
            <span>{url}</span>
            <ExternalLink size={11} className="inline opacity-70 shrink-0" />
          </a>
          {trailing && <span>{trailing}</span>}
        </React.Fragment>
      );
    }

    // 3. Bold: **text**
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong
          key={i}
          className="font-semibold text-zinc-900 dark:text-[#f7f8f8]"
        >
          {part.slice(2, -2)}
        </strong>
      );
    }

    // 4. Italic: *text*
    if (part.startsWith("*") && part.endsWith("*")) {
      return <em key={i}>{part.slice(1, -1)}</em>;
    }

    // 5. Code: `code`
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={i}
          className="px-1.5 py-0.5 mx-0.5 rounded bg-zinc-200/60 dark:bg-[#202020] border border-zinc-300 dark:border-[#23252a] font-mono text-[12.5px] text-[#5e6ad2] dark:text-[#7e8ce0]"
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    // 6. Regular text
    return <span key={i}>{part}</span>;
  });
}

export function renderMarkdownBlock(
  text: string,
  blockKey: number,
): React.ReactNode {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    const h1Match = line.match(/^# (.+)/);
    const h2Match = line.match(/^## (.+)/);
    const h3Match = line.match(/^### (.+)/);

    if (h1Match) {
      elements.push(
        <h1
          key={`${blockKey}-h1-${i}`}
          className="text-lg font-semibold text-[#f7f8f8] mt-3 mb-1"
        >
          {renderInlineMarkdown(h1Match[1])}
        </h1>,
      );
      i++;
      continue;
    }
    if (h2Match) {
      elements.push(
        <h2
          key={`${blockKey}-h2-${i}`}
          className="text-base font-semibold text-[#f7f8f8] mt-3 mb-1"
        >
          {renderInlineMarkdown(h2Match[1])}
        </h2>,
      );
      i++;
      continue;
    }
    if (h3Match) {
      elements.push(
        <h3
          key={`${blockKey}-h3-${i}`}
          className="text-sm font-semibold text-[#f7f8f8] mt-2 mb-0.5"
        >
          {renderInlineMarkdown(h3Match[1])}
        </h3>,
      );
      i++;
      continue;
    }

    if (/^---+$/.test(line.trim())) {
      elements.push(
        <hr key={`${blockKey}-hr-${i}`} className="border-[#23252a] my-2" />,
      );
      i++;
      continue;
    }

    if (/^\s*[*\-+] /.test(line)) {
      const listItems: React.ReactNode[] = [];
      while (i < lines.length && /^\s*[*\-+] /.test(lines[i])) {
        const itemText = lines[i].replace(/^\s*[*\-+] /, "");
        const indent = lines[i].match(/^(\s*)/)?.[1].length ?? 0;
        listItems.push(
          <li
            key={i}
            style={{ marginLeft: indent > 0 ? `${indent * 4}px` : undefined }}
            className="leading-relaxed text-zinc-800 dark:text-[#d0d6e0]"
          >
            {renderInlineMarkdown(itemText)}
          </li>,
        );
        i++;
      }
      elements.push(
        <ul
          key={`${blockKey}-ul-${i}`}
          className="list-disc list-outside pl-4 my-1 space-y-0.5 text-[14px]"
        >
          {listItems}
        </ul>,
      );
      continue;
    }

    if (/^\d+\. /.test(line)) {
      const listItems: React.ReactNode[] = [];
      while (i < lines.length && /^\d+\. /.test(lines[i])) {
        const itemText = lines[i].replace(/^\d+\. /, "");
        listItems.push(
          <li
            key={i}
            className="leading-relaxed text-zinc-800 dark:text-[#d0d6e0]"
          >
            {renderInlineMarkdown(itemText)}
          </li>,
        );
        i++;
      }
      elements.push(
        <ol
          key={`${blockKey}-ol-${i}`}
          className="list-decimal list-outside pl-4 my-1 space-y-0.5 text-[14px]"
        >
          {listItems}
        </ol>,
      );
      continue;
    }

    if (line.trim() === "") {
      i++;
      continue;
    }

    elements.push(
      <p
        key={`${blockKey}-p-${i}`}
        className="leading-relaxed text-[14px] text-zinc-800 dark:text-[#d0d6e0] my-0.5 whitespace-pre-wrap"
      >
        {renderInlineMarkdown(line)}
      </p>,
    );
    i++;
  }

  return (
    <div key={blockKey} className="space-y-1">
      {elements}
    </div>
  );
}
