import { Fragment, type ReactNode } from "react";

// Minimal markdown for AI answers (SPEC §4.6: AI messages in a distinct style).
// Covers what Gemini actually sends in a short chat reply: paragraphs, "-"/"*"
// and numbered lists, "#" headings, ``` code blocks, **bold**, *italic* and
// `code`. Builds React nodes only — never HTML strings — so model output can't
// inject markup.

const INLINE_RE = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*|_[^_\s][^_]*_)/g;

function renderInline(text: string): ReactNode[] {
  return text.split(INLINE_RE).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      return (
        <code key={i} className="rounded bg-white/70 px-1 py-0.5 font-mono text-[0.9em]" dir="ltr">
          {part.slice(1, -1)}
        </code>
      );
    }
    if (
      part.length > 2 &&
      ((part.startsWith("*") && part.endsWith("*")) || (part.startsWith("_") && part.endsWith("_")))
    ) {
      return <em key={i}>{part.slice(1, -1)}</em>;
    }
    return <Fragment key={i}>{part}</Fragment>;
  });
}

type Block =
  | { kind: "p"; lines: string[] }
  | { kind: "ul" | "ol"; items: string[] }
  | { kind: "h"; text: string }
  | { kind: "code"; text: string };

function parseBlocks(source: string): Block[] {
  const blocks: Block[] = [];
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim().startsWith("```")) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) body.push(lines[i++]);
      i++; // closing fence (or end of text)
      blocks.push({ kind: "code", text: body.join("\n") });
      continue;
    }
    if (line.trim() === "") {
      i++;
      continue;
    }
    const heading = line.match(/^\s*#{1,6}\s+(.*)$/);
    if (heading) {
      blocks.push({ kind: "h", text: heading[1] });
      i++;
      continue;
    }
    const listKind = /^\s*[-*•]\s+/.test(line) ? "ul" : /^\s*\d+[.)]\s+/.test(line) ? "ol" : null;
    if (listKind) {
      const re = listKind === "ul" ? /^\s*[-*•]\s+/ : /^\s*\d+[.)]\s+/;
      const items: string[] = [];
      while (i < lines.length && re.test(lines[i])) items.push(lines[i++].replace(re, ""));
      blocks.push({ kind: listKind, items });
      continue;
    }
    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !/^\s*([-*•]|\d+[.)]|#{1,6})\s+/.test(lines[i]) &&
      !lines[i].trim().startsWith("```")
    ) {
      para.push(lines[i++]);
    }
    blocks.push({ kind: "p", lines: para });
  }
  return blocks;
}

export function AiMarkdown({ text }: { text: string }) {
  return (
    <div className="flex flex-col gap-2">
      {parseBlocks(text).map((block, i) => {
        switch (block.kind) {
          case "h":
            return (
              <p key={i} className="font-bold">
                {renderInline(block.text)}
              </p>
            );
          case "code":
            return (
              <pre
                key={i}
                dir="ltr"
                className="overflow-x-auto rounded-lg bg-white/70 p-2.5 text-start font-mono text-xs"
              >
                {block.text}
              </pre>
            );
          case "ul":
          case "ol": {
            const List = block.kind;
            return (
              <List
                key={i}
                className={
                  block.kind === "ul" ? "list-disc space-y-1 ps-5" : "list-decimal space-y-1 ps-5"
                }
              >
                {block.items.map((item, j) => (
                  <li key={j}>{renderInline(item)}</li>
                ))}
              </List>
            );
          }
          default:
            return (
              <p key={i}>
                {block.lines.map((l, j) => (
                  <Fragment key={j}>
                    {j > 0 && <br />}
                    {renderInline(l)}
                  </Fragment>
                ))}
              </p>
            );
        }
      })}
    </div>
  );
}
