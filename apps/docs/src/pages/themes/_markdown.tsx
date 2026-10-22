/**
 * The markdown the style references are written in, rendered.
 *
 * The subset is small on purpose: headings, paragraphs, lists, and the three
 * inline marks the references use. Rendering the file's own text is what
 * keeps the page and the file the same thing, so a reference that is
 * revised is revised once.
 */
import { For } from "solid-js";
import type { JSX } from "solid-js";

/** One block of a markdown document. */
type Block =
  | { readonly kind: "heading"; readonly level: number; readonly text: string }
  | { readonly kind: "paragraph"; readonly text: string }
  | {
    readonly kind: "list";
    readonly ordered: boolean;
    readonly items: readonly string[];
  };

/** A line that starts a block, rather than continuing a paragraph. */
function startsBlock(line: string): boolean {
  return /^#{1,6}\s/.test(line) || /^[-*]\s/.test(line) ||
    /^\d+\.\s/.test(line);
}

/** The blocks of a document. */
function blocks(text: string): Block[] {
  const out: Block[] = [];
  const lines = text.split("\n");
  let index = 0;
  while (index < lines.length) {
    const line = lines[index] ?? "";
    if (line.trim() === "") {
      index++;
      continue;
    }
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading !== null) {
      out.push({
        kind: "heading",
        level: heading[1].length,
        text: (heading[2] ?? "").trim(),
      });
      index++;
      continue;
    }
    if (/^[-*]\s/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^[-*]\s/.test(lines[index] ?? "")) {
        items.push((lines[index] ?? "").slice(2).trim());
        index++;
      }
      out.push({ kind: "list", ordered: false, items });
      continue;
    }
    if (/^\d+\.\s/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\d+\.\s/.test(lines[index] ?? "")) {
        items.push((lines[index] ?? "").replace(/^\d+\.\s*/, "").trim());
        index++;
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

/** The inline marks the references use: code, strong, and a link. */
const INLINE = /`([^`]+)`|\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)]+)\)/g;

/** One line, as the pieces it is made of. */
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
      out.push(<strong class="text-text">{strong}</strong>);
    } else if (label !== undefined && href !== undefined) {
      out.push(
        <a href={href} class="hover:underline">{label}</a>,
      );
    } else {
      out.push(whole);
    }
    at = start + whole.length;
  }
  if (at < text.length) out.push(text.slice(at));
  return out;
}

/** The heading a level of the source becomes. */
function heading(level: number, text: string): JSX.Element {
  const children = inline(text);
  if (level <= 2) return <h3 class="text-text">{children}</h3>;
  if (level === 3) return <h4 class="text-text">{children}</h4>;
  return <h5 class="text-text">{children}</h5>;
}

/** A markdown document, rendered. */
export function Markdown(props: { text: string }): JSX.Element {
  return (
    <For each={blocks(props.text)}>
      {(block) => {
        if (block.kind === "heading") {
          return heading(block.level, block.text);
        }
        if (block.kind === "paragraph") {
          return <p class="text-sm">{inline(block.text)}</p>;
        }
        const items = (
          <For each={block.items}>
            {(item) => <li class="text-sm">{inline(item)}</li>}
          </For>
        );
        return block.ordered
          ? (
            <ol class="grid gap-1 list-decimal">
              {items}
            </ol>
          )
          : (
            <ul class="grid gap-1 list-disc">
              {items}
            </ul>
          );
      }}
    </For>
  );
}
