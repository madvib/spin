/**
 * Markdown renderer for documentation copy modules and style references.
 */
import { For } from "solid-js";
import type { JSX } from "solid-js";
import { A } from "@solidjs/router";
import { CodeFrame } from "./ui/code-frame.tsx";

type Block =
  | {
    readonly kind: "heading";
    readonly level: number;
    readonly id: string;
    readonly text: string;
  }
  | { readonly kind: "paragraph"; readonly text: string }
  | {
    readonly kind: "list";
    readonly ordered: boolean;
    readonly items: readonly string[];
  }
  | {
    readonly kind: "code";
    readonly lang: string;
    readonly code: string;
  }
  | {
    readonly kind: "table";
    readonly headers: readonly string[];
    readonly rows: readonly (readonly string[])[];
  }
  | {
    readonly kind: "callout";
    readonly variant: "info" | "warning" | "quote";
    readonly text: string;
  };

export function slugOf(text: string): string {
  return text
    .toLowerCase()
    .replace(/`([^`]+)`/g, "$1")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function isComment(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.startsWith("<!--") && trimmed.endsWith("-->");
}

function isTableDivider(line: string): boolean {
  const trimmed = line.trim();
  return /^\|?[\s:-]+\|[\s|:-]*$/.test(trimmed);
}

function splitTableRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return trimmed.split("|").map((cell) => cell.trim());
}

function startsBlock(line: string): boolean {
  const trimmed = line.trim();
  return (
    trimmed.startsWith("<!--") ||
    /^#{1,6}\s/.test(trimmed) ||
    trimmed.startsWith("```") ||
    trimmed.startsWith(">") ||
    /^[-*]\s/.test(trimmed) ||
    /^\d+\.\s/.test(trimmed) ||
    /^\|.+\|$/.test(trimmed)
  );
}

function blocks(text: string): Block[] {
  const out: Block[] = [];
  const lines = text.split("\n");
  let index = 0;
  while (index < lines.length) {
    const raw = lines[index] ?? "";
    const trimmed = raw.trim();
    if (trimmed === "" || isComment(trimmed)) {
      index++;
      continue;
    }

    if (trimmed.startsWith("<!--")) {
      while (index < lines.length && !(lines[index] ?? "").includes("-->")) {
        index++;
      }
      index++;
      continue;
    }

    const fence = /^```(\S*)\s*$/.exec(trimmed);
    if (fence !== null) {
      const lang = fence[1] ?? "";
      index++;
      const body: string[] = [];
      while (
        index < lines.length &&
        !(lines[index] ?? "").trim().startsWith("```")
      ) {
        body.push(lines[index] ?? "");
        index++;
      }
      if (index < lines.length) index++;
      out.push({ kind: "code", lang, code: body.join("\n") });
      continue;
    }

    const headingMatch = /^(#{1,6})\s+(.*)$/.exec(trimmed);
    if (headingMatch !== null) {
      const headingText = (headingMatch[2] ?? "").trim();
      out.push({
        kind: "heading",
        level: headingMatch[1]!.length,
        id: slugOf(headingText),
        text: headingText,
      });
      index++;
      continue;
    }

    if (
      trimmed.startsWith("|") &&
      index + 1 < lines.length &&
      isTableDivider(lines[index + 1] ?? "")
    ) {
      const headers = splitTableRow(trimmed);
      index += 2;
      const rows: string[][] = [];
      while (
        index < lines.length &&
        (lines[index] ?? "").trim().startsWith("|")
      ) {
        rows.push(splitTableRow(lines[index] ?? ""));
        index++;
      }
      out.push({ kind: "table", headers, rows });
      continue;
    }

    if (/^>\s?/.test(trimmed)) {
      const quoteLines: string[] = [];
      while (
        index < lines.length &&
        /^>\s?/.test((lines[index] ?? "").trim())
      ) {
        quoteLines.push((lines[index] ?? "").trim().replace(/^>\s?/, ""));
        index++;
      }
      const joined = quoteLines.join(" ").trim();
      const variant = /^\*\*(Edge|Warning|Caution):?\*\*/i.test(joined)
        ? "warning"
        : /^\*\*(Note|Tip|Rule):?\*\*/i.test(joined)
        ? "info"
        : "quote";
      out.push({ kind: "callout", variant, text: joined });
      continue;
    }

    if (/^[-*]\s/.test(trimmed)) {
      const items: string[] = [];
      while (
        index < lines.length &&
        /^[-*]\s/.test((lines[index] ?? "").trim())
      ) {
        const parts = [(lines[index] ?? "").trim().slice(2).trim()];
        index++;
        while (
          index < lines.length &&
          (lines[index] ?? "").trim() !== "" &&
          !isComment((lines[index] ?? "").trim()) &&
          !startsBlock(lines[index] ?? "")
        ) {
          parts.push((lines[index] ?? "").trim());
          index++;
        }
        items.push(parts.join(" "));
      }
      out.push({ kind: "list", ordered: false, items });
      continue;
    }

    if (/^\d+\.\s/.test(trimmed)) {
      const items: string[] = [];
      while (
        index < lines.length &&
        /^\d+\.\s/.test((lines[index] ?? "").trim())
      ) {
        const parts = [
          (lines[index] ?? "").trim().replace(/^\d+\.\s*/, "").trim(),
        ];
        index++;
        while (
          index < lines.length &&
          (lines[index] ?? "").trim() !== "" &&
          !isComment((lines[index] ?? "").trim()) &&
          !startsBlock(lines[index] ?? "")
        ) {
          parts.push((lines[index] ?? "").trim());
          index++;
        }
        items.push(parts.join(" "));
      }
      out.push({ kind: "list", ordered: true, items });
      continue;
    }

    const paragraph: string[] = [];
    while (
      index < lines.length &&
      (lines[index] ?? "").trim() !== "" &&
      !startsBlock(lines[index] ?? "")
    ) {
      paragraph.push((lines[index] ?? "").trim());
      index++;
    }
    if (paragraph.length > 0) {
      out.push({ kind: "paragraph", text: paragraph.join(" ") });
    }
  }
  return out;
}

const INLINE = /`([^`]+)`|\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)]+)\)/g;

function inline(text: string): JSX.Element[] {
  const out: JSX.Element[] = [];
  let at = 0;
  for (const match of text.matchAll(INLINE)) {
    const start = match.index ?? 0;
    if (start > at) out.push(text.slice(at, start));
    const [whole, code, strong, label, href] = match;
    if (code !== undefined) {
      out.push(<code>{code}</code>);
    } else if (strong !== undefined) {
      out.push(<strong>{inline(strong)}</strong>);
    } else if (label !== undefined && href !== undefined) {
      if (href.startsWith("/") && !href.startsWith("/skill/")) {
        out.push(<A href={href}>{label}</A>);
      } else {
        out.push(
          <a
            href={href}
            target={href.startsWith("http") ? "_blank" : undefined}
            rel={href.startsWith("http") ? "noreferrer" : undefined}
          >
            {label}
          </a>,
        );
      }
    } else {
      out.push(whole);
    }
    at = start + whole.length;
  }
  if (at < text.length) out.push(text.slice(at));
  return out;
}

function renderHeading(
  level: number,
  id: string,
  text: string,
): JSX.Element {
  const children = inline(text);
  if (level <= 2) return <h2 id={id} class="scroll-mt-20">{children}</h2>;
  if (level === 3) return <h3 id={id} class="scroll-mt-20">{children}</h3>;
  return <h4 id={id} class="scroll-mt-20">{children}</h4>;
}

export function Markdown(
  props: { text: string; class?: string },
): JSX.Element {
  return (
    <prose class={`w-full ${props.class ?? ""}`}>
      <For each={blocks(props.text)}>
        {(block) => {
          if (block.kind === "heading") {
            return renderHeading(block.level, block.id, block.text);
          }
          if (block.kind === "paragraph") {
            return <p class="max-w-prose">{inline(block.text)}</p>;
          }
          if (block.kind === "code") {
            return (
              <div class="my-4">
                <CodeFrame
                  code={block.code}
                  lang={block.lang === "" ? undefined : block.lang}
                />
              </div>
            );
          }
          if (block.kind === "callout") {
            if (block.variant === "warning" || block.variant === "info") {
              return (
                <alert variant={block.variant}>
                  <p>{inline(block.text)}</p>
                </alert>
              );
            }
            return (
              <blockquote class="max-w-prose">
                <p>{inline(block.text)}</p>
              </blockquote>
            );
          }
          if (block.kind === "table") {
            return (
              <div class="my-4 overflow-x-auto rounded-lg border">
                <table class="wrap">
                  <thead>
                    <tr>
                      <For each={block.headers}>
                        {(header) => <th>{inline(header)}</th>}
                      </For>
                    </tr>
                  </thead>
                  <tbody>
                    <For each={block.rows}>
                      {(row) => (
                        <tr>
                          <For each={row}>
                            {(cell) => <td>{inline(cell)}</td>}
                          </For>
                        </tr>
                      )}
                    </For>
                  </tbody>
                </table>
              </div>
            );
          }
          const items = (
            <For each={block.items}>
              {(item) => <li>{inline(item)}</li>}
            </For>
          );
          return block.ordered
            ? <ol class="max-w-prose">{items}</ol>
            : <ul class="max-w-prose">{items}</ul>;
        }}
      </For>
    </prose>
  );
}
