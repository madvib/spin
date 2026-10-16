import { scanRun } from "./scan.ts";

/**
 * One token of example markup, as the code viewer reads it.
 *
 * Self-contained on purpose: the reference demonstrates the styling surface,
 * so a syntax highlighter from a dependency would be a second stylesheet the
 * theme cannot reach. The tokenizer is a single pass over the string and
 * nothing else — no grammar, no recovery, no recursion.
 */
export type CodeTokenType =
  | "tag"
  | "attr"
  | "string"
  | "comment"
  | "punct"
  | "expr"
  | "text";

export interface CodeToken {
  readonly type: CodeTokenType;
  readonly value: string;
}

const WHITESPACE = /\s/;
const NAME_STOP = /[\s=/>]/;

/**
 * Example HTML, tokenized: tags, attribute names, string values, comments and
 * the text between them. Everything the markup spells is preserved exactly,
 * whitespace included, because the code view is the markup a consumer copies.
 */
export function tokenizeHtml(html: string): CodeToken[] {
  const out: CodeToken[] = [];
  const push = (type: CodeTokenType, value: string) => {
    if (value !== "") out.push({ type, value });
  };
  let i = 0;
  // Inline expressions read as code wherever they sit: `{row.label}`
  // between tags is not prose. Runs first so the tag scan below only
  // ever sees markup.
  const pushTextRuns = (from: number, to: number): void => {
    let j = from;
    while (j < to) {
      const open = html.indexOf("{", j);
      if (open === -1 || open >= to) {
        push("text", html.slice(j, to));
        return;
      }
      if (open > j) push("text", html.slice(j, open));
      const stop = scanRun(html, open);
      push("expr", html.slice(open, Math.min(stop, to)));
      j = Math.min(stop, to);
      if (stop >= to) return;
    }
  };
  while (i < html.length) {
    const lt = html.indexOf("<", i);
    if (lt === -1) {
      pushTextRuns(i, html.length);
      break;
    }
    if (lt > i) pushTextRuns(i, lt);
    // A comment runs to its close, or to the end of the document.
    if (html.startsWith("<!--", lt)) {
      const end = html.indexOf("-->", lt + 4);
      const stop = end === -1 ? html.length : end + 3;
      push("comment", html.slice(lt, stop));
      i = stop;
      continue;
    }
    // A declaration (`<!doctype html>`) is read as one opaque run.
    if (html.startsWith("<!", lt)) {
      const end = html.indexOf(">", lt);
      const stop = end === -1 ? html.length : end + 1;
      push("comment", html.slice(lt, stop));
      i = stop;
      continue;
    }
    // The opening bracket is a token of its own. Without it the view read
    // `div class=…>` — a tag with no bracket, and a closer with no bracket at
    // all — so every `<`, `/` and `>` the markup spells is spent as punct.
    push("punct", "<");
    i = lt + 1;
    if (html[i] === "/") {
      push("punct", "/");
      i += 1;
    }
    let end = i;
    while (
      end < html.length && !WHITESPACE.test(html[end]!) && html[end] !== ">" &&
      html[end] !== "/"
    ) {
      end += 1;
    }
    push("tag", html.slice(i, end));
    i = end;
    while (i < html.length) {
      const ch = html[i]!;
      if (ch === ">") {
        push("punct", ">");
        i += 1;
        break;
      }
      if (ch === "/" && html[i + 1] === ">") {
        push("punct", "/>");
        i += 2;
        break;
      }
      if (WHITESPACE.test(ch)) {
        let stop = i;
        while (stop < html.length && WHITESPACE.test(html[stop]!)) stop += 1;
        push("text", html.slice(i, stop));
        i = stop;
        continue;
      }
      if (ch === "/") {
        push("punct", "/");
        i += 1;
        continue;
      }
      // A spread or expression is code, not an attribute name: without
      // this `{...slider.getRootProps()}` reads as one long attr.
      if (ch === "{") {
        const stop = scanRun(html, i);
        push("expr", html.slice(i, stop));
        i = stop;
        continue;
      }
      let attrEnd = i;
      while (attrEnd < html.length && !NAME_STOP.test(html[attrEnd]!)) {
        attrEnd += 1;
      }
      push("attr", html.slice(i, attrEnd));
      i = attrEnd;
      if (html[i] === "=") {
        push("punct", "=");
        i += 1;
        if (html[i] === '"' || html[i] === "'") {
          const stop = scanRun(html, i);
          push("string", html.slice(i, stop));
          i = stop;
        } else {
          // An unquoted value runs to the whitespace or the bracket.
          let stop = i;
          while (
            stop < html.length && !WHITESPACE.test(html[stop]!) &&
            html[stop] !== ">"
          ) {
            stop += 1;
          }
          push("string", html.slice(i, stop));
          i = stop;
        }
      }
    }
  }
  return out;
}

/**
 * Example markup, formatted for the code view.
 *
 * The examples are data — written to be read beside a rule, not by a
 * formatter — so they arrive with the indentation of the template literals
 * they were pieced together in: ten spaces of air before every variant, a
 * closing tag at column eight. The code view is the markup a consumer copies,
 * so it shows that markup as a consumer would write it: nested tags indented
 * one step per depth, runs of blank lines collapsed to a single break, and a
 * tag with more than two attributes spelled one attribute per line, so the
 * parts are visible instead of a wall.
 *
 * It is FORMATTING, not rewriting. The only text replaced is whitespace the
 * markup does not need; every tag, attribute name, attribute value and word
 * of content survives exactly as authored. Content whose whitespace IS its
 * meaning — a `<pre>`, a `<textarea>` — is copied through untouched, and text
 * that spells anything never moves onto a line of its own.
 */
const FORMAT_INDENT = "  ";

/** Tags whose content is whitespace: never re-indented, never re-flowed. */
const VERBATIM_TAGS: Record<string, true> = {
  pre: true,
  textarea: true,
  listing: true,
};

/** Tags that never take a close. */
const VOID_TAGS: Record<string, true> = {
  area: true,
  base: true,
  br: true,
  col: true,
  embed: true,
  hr: true,
  img: true,
  input: true,
  link: true,
  meta: true,
  param: true,
  source: true,
  track: true,
  wbr: true,
};

interface FormatElement {
  readonly kind: "element";
  readonly tag: string;
  readonly attrs: readonly (readonly [string, string | undefined])[];
  readonly children: FormatNode[];
  readonly selfClose: boolean;
  /** The raw inside of a verbatim element, copied through as authored. */
  raw?: string;
}

interface FormatText {
  readonly kind: "text";
  readonly text: string;
}

interface FormatRaw {
  readonly kind: "raw";
  readonly text: string;
}

type FormatNode = FormatElement | FormatText | FormatRaw;

/**
 * Example HTML, parsed into a tree shallow enough to re-indent and no
 * deeper: an element, the text, and the two kinds of run that are copied
 * whole (comments and declarations). A close that matches nothing on the
 * stack is kept as raw text rather than guessed at.
 */
function parseForFormat(html: string): FormatNode[] {
  const roots: FormatNode[] = [];
  const stack: FormatElement[] = [];
  const parentChildren = (): FormatNode[] =>
    stack.length === 0 ? roots : stack[stack.length - 1]!.children;
  let i = 0;
  while (i < html.length) {
    const lt = html.indexOf("<", i);
    if (lt === -1) {
      parentChildren().push({ kind: "text", text: html.slice(i) });
      break;
    }
    if (lt > i) {
      parentChildren().push({ kind: "text", text: html.slice(i, lt) });
    }
    if (html.startsWith("<!--", lt)) {
      const end = html.indexOf("-->", lt + 4);
      const stop = end === -1 ? html.length : end + 3;
      parentChildren().push({ kind: "raw", text: html.slice(lt, stop) });
      i = stop;
      continue;
    }
    if (html.startsWith("<!", lt)) {
      const end = html.indexOf(">", lt);
      const stop = end === -1 ? html.length : end + 1;
      parentChildren().push({ kind: "raw", text: html.slice(lt, stop) });
      i = stop;
      continue;
    }
    if (html.startsWith("</", lt)) {
      const end = html.indexOf(">", lt);
      const stop = end === -1 ? html.length : end + 1;
      const name = html.slice(lt + 2, stop - 1).trim().toLowerCase();
      // The close matches the OPENEST copy on the stack from the top down:
      // a nested `<div>` closes itself, not its ancestor of the same name.
      let match = -1;
      for (let s = stack.length - 1; s >= 0; s--) {
        if (stack[s]!.tag.toLowerCase() === name) {
          match = s;
          break;
        }
      }
      if (match !== -1) {
        stack.length = match;
      } else {
        parentChildren().push({ kind: "raw", text: html.slice(lt, stop) });
      }
      i = stop;
      continue;
    }
    // An open tag: the name, then the attributes — quoted, unquoted, or bare.
    i = lt + 1;
    let nameEnd = i;
    while (
      nameEnd < html.length && !WHITESPACE.test(html[nameEnd]!) &&
      html[nameEnd] !== ">" && html[nameEnd] !== "/"
    ) {
      nameEnd += 1;
    }
    const tag = html.slice(i, nameEnd);
    i = nameEnd;
    const attrs: [string, string | undefined][] = [];
    let selfClose = false;
    while (i < html.length) {
      const ch = html[i]!;
      if (WHITESPACE.test(ch)) {
        i += 1;
        continue;
      }
      if (ch === ">") {
        i += 1;
        break;
      }
      if (ch === "/") {
        if (html[i + 1] === ">") {
          selfClose = true;
          i += 2;
          break;
        }
        i += 1;
        continue;
      }
      let attrEnd = i;
      while (attrEnd < html.length && !NAME_STOP.test(html[attrEnd]!)) {
        attrEnd += 1;
      }
      const name = html.slice(i, attrEnd);
      i = attrEnd;
      if (html[i] !== "=") {
        attrs.push([name, undefined]);
        continue;
      }
      i += 1;
      const quote = html[i];
      if (quote === '"' || quote === "'" || quote === "{") {
        const stop = scanRun(html, i);
        attrs.push([name, html.slice(i, stop)]);
        i = stop;
      } else {
        let stop = i;
        while (
          stop < html.length && !WHITESPACE.test(html[stop]!) &&
          html[stop] !== ">"
        ) {
          stop += 1;
        }
        attrs.push([name, stop > i ? `"${html.slice(i, stop)}"` : undefined]);
        i = stop;
      }
    }
    const element: FormatElement = {
      kind: "element",
      tag,
      attrs,
      children: [],
      selfClose,
    };
    parentChildren().push(element);
    const lower = tag.toLowerCase();
    if (!selfClose && VOID_TAGS[lower] !== true) {
      if (VERBATIM_TAGS[lower] === true) {
        const close = html.toLowerCase().indexOf(`</${lower}`, i);
        const stop = close === -1 ? html.length : close;
        element.raw = html.slice(i, stop);
        if (close !== -1) {
          const gt = html.indexOf(">", close);
          i = gt === -1 ? html.length : gt + 1;
        }
      } else {
        stack.push(element);
      }
    }
  }
  return roots;
}

/**
 * One open tag: the attributes on one line when there are two or fewer, one
 * per line — indented a step past the tag — when there are more, so a long
 * value has its own line instead of ploughing through its neighbours.
 */
function formatOpenTag(
  tag: string,
  attrs: readonly (readonly [string, string | undefined])[],
  depth: number,
): string {
  // A data blob (nodes JSON, a data URI) is content, not reading: elide
  // past a screen of characters so one attribute is not the whole page.
  // Copy writes the exact source, never this display text.
  const spelled = attrs.map(([name, value]) => {
    if (value === undefined) return name;
    const cut = value.lastIndexOf(" ", 160);
    const shown = value.length > 160
      ? `${value.slice(0, cut === -1 ? 160 : cut)}…(${value.length} chars)`
      : value;
    return `${name}=${shown}`;
  });
  if (spelled.length > 2 && spelled.every((s) => !s.includes("{"))) {
    const pad = FORMAT_INDENT.repeat(depth + 1);
    return `<${tag}\n${spelled.map((s) => `${pad}${s}`).join("\n")}\n${
      FORMAT_INDENT.repeat(depth)
    }`;
  }
  return `<${tag}${spelled.length === 0 ? "" : ` ${spelled.join(" ")}`}`;
}

function formatNode(node: FormatNode, depth: number): string {
  // Text carries data blobs too (a scope line is one text node): elide
  // the same way attributes do. Copy stays exact.
  if (node.kind === "text" || node.kind === "raw") {
    return node.text.length > 320
      ? `${node.text.slice(0, 320)}…(${node.text.length} chars)`
      : node.text;
  }
  const pad = FORMAT_INDENT.repeat(depth);
  const open = formatOpenTag(node.tag, node.attrs, depth);
  if (node.raw !== undefined) return `${pad}${open}>${node.raw}</${node.tag}>`;
  const close = node.selfClose ? "/>" : `</${node.tag}>`;
  if (node.children.length === 0) {
    return VOID_TAGS[node.tag.toLowerCase()] === true
      ? `${pad}${open}${node.selfClose ? "/>" : ">"}`
      : `${pad}${open}>${close}`;
  }
  // Text that spells anything keeps its element on one line: breaking
  // `Press <kbd>Enter</kbd> to submit.` across four lines would put the
  // formatter's indentation INSIDE the sentence.
  const inline = node.children.some(
    (c) => c.kind === "text" && !/^\s*$/.test(c.text),
  );
  if (inline) {
    const inner = node.children.map((c) => formatNode(c, 0)).join("");
    return `${pad}${open}>${inner}${close}`;
  }
  const body = node.children
    .filter((c) => c.kind !== "text" || !/^\s*$/.test(c.text))
    .map((c) => formatNode(c, depth + 1))
    .join("\n");
  return `${pad}${open}>\n${body}\n${pad}${close}`;
}

/**
 * Example HTML, formatted. Idempotent: formatting what was formatted
 * changes nothing, because it replaces whitespace-only runs and nothing
 * else.
 */
export function formatExampleHtml(html: string): string {
  // Roots that are only elements break between siblings; a root that spells
  // text keeps its neighbours on the same line, because a newline a
  // formatter adds beside text is text the markup did not have.
  const roots = parseForFormat(html).filter(
    (n) => n.kind !== "text" || !/^\s*$/.test(n.text),
  );
  const inline = roots.some((n) => n.kind === "text");
  return roots.map((n) => formatNode(n, 0)).join(inline ? "" : "\n");
}
