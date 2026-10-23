/**
 * The markup, read for display.
 *
 * The component pages render sourced markup with `innerHTML` — the daemon is
 * the only thing that writes it — so the code view shows the same string a
 * consumer would copy. Two jobs: lay the markup out so a nested fixture
 * reads as structure rather than as one run, and split the run into tokens
 * so an element reads differently from the attribute it carries.
 *
 * The split is structural. It asks only which position inside a tag the
 * scanner is in, so a component's vocabulary can change without a list here
 * chasing it.
 */

/** Where a run of characters sits in the markup. */
export type CodeKind = "tag" | "attr" | "value" | "text";

/** One run of characters, and what position it is in. */
export interface CodeToken {
  readonly kind: CodeKind;
  readonly text: string;
}

/**
 * Split markup into runs by position in a tag.
 *
 * An attribute value stays one run however many words it holds, so
 * `class="flex gap-2"` reads as the class list a consumer copies rather than
 * as three fragments.
 */
export function tokenizeHtml(html: string): CodeToken[] {
  const tokens: CodeToken[] = [];
  let i = 0;

  while (i < html.length) {
    const open = html.indexOf("<", i);
    if (open === -1) {
      tokens.push({ kind: "text", text: html.slice(i) });
      break;
    }
    if (open > i) tokens.push({ kind: "text", text: html.slice(i, open) });

    const closing = html.startsWith("</", open);
    tokens.push({ kind: "tag", text: closing ? "</" : "<" });
    i = open + (closing ? 2 : 1);

    const nameStart = i;
    while (i < html.length && !/[\s>/]/.test(html[i])) i++;
    if (i > nameStart) {
      tokens.push({ kind: "tag", text: html.slice(nameStart, i) });
    }

    while (i < html.length) {
      if (/\s/.test(html[i])) {
        const gap = i;
        while (i < html.length && /\s/.test(html[i])) i++;
        // Character data, not markup: an attribute's leading space belongs to
        // the run the code view already shows as the gap it is.
        tokens.push({ kind: "text", text: html.slice(gap, i) });
        continue;
      }
      if (html[i] === ">") {
        tokens.push({ kind: "tag", text: ">" });
        i++;
        break;
      }
      if (html[i] === "/") {
        tokens.push({ kind: "tag", text: "/" });
        i++;
        continue;
      }

      const attributeStart = i;
      while (i < html.length && !/[\s=>/]/.test(html[i])) i++;
      tokens.push({ kind: "attr", text: html.slice(attributeStart, i) });
      if (html[i] !== "=") continue;

      // The `=` is part of the value's syntax, so a reader copying the run
      // gets `class="danger"` and not a bare string that will not parse.
      const equals = i;
      i++;
      while (i < html.length && /\s/.test(html[i])) i++;

      const quote = html[i];
      if (quote === '"' || quote === "'") {
        const close = html.indexOf(quote, i + 1);
        const stop = close === -1 ? html.length : close + 1;
        tokens.push({ kind: "value", text: html.slice(equals, stop) });
        i = stop;
        continue;
      }
      while (i < html.length && !/[\s>]/.test(html[i])) i++;
      tokens.push({ kind: "value", text: html.slice(equals, i) });
    }
  }

  return tokens;
}

/** One level of the formatter's indentation. */
const FORMAT_INDENT = "  ";

const WHITESPACE = /\s/;
const NAME_STOP = /[\s=/>]/;

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
      const name = html.slice(i, attrEnd).toLowerCase();
      i = attrEnd;
      if (html[i] !== "=") {
        attrs.push([name, undefined]);
        continue;
      }
      i += 1;
      const quote = html[i];
      if (quote === '"' || quote === "'") {
        const close = html.indexOf(quote, i + 1);
        const stop = close === -1 ? html.length : close + 1;
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
  const spelled = attrs.map(([name, value]) =>
    value === undefined ? name : `${name}=${value}`
  );
  if (spelled.length > 2) {
    const pad = FORMAT_INDENT.repeat(depth + 1);
    return `<${tag}\n${spelled.map((s) => `${pad}${s}`).join("\n")}\n${
      FORMAT_INDENT.repeat(depth)
    }`;
  }
  return `<${tag}${spelled.length === 0 ? "" : ` ${spelled.join(" ")}`}`;
}

function formatNode(node: FormatNode, depth: number): string {
  if (node.kind === "text" || node.kind === "raw") return node.text;
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
 * Example HTML, formatted for the code view.
 *
 * It is FORMATTING, not rewriting. The only text replaced is whitespace the
 * markup does not need — which subsumes the template indentation a fixture is
 * authored with — and every tag, attribute name, attribute value and word of
 * content survives exactly as authored. Content whose whitespace IS its
 * meaning — a `<pre>`, a `<textarea>` — is copied through untouched, and text
 * that spells anything never moves onto a line of its own.
 *
 * Idempotent: formatting what was formatted changes nothing, because it
 * replaces whitespace-only runs and nothing else.
 */
export function formatExampleHtml(html: string): string {
  // A base64 data URI is an image compressed into an attribute, and a code
  // panel is where the example's markup is READ. Thousands of bytes of
  // base64 only eat the page and say nothing, so the panel carries the
  // shape, not the payload — the bytes still live in the markup the preview
  // registers as stylesheet content.
  const collapsed = html.replace(
    /src=(["'])data:[^"']*/g,
    (_match, quote: string) => `src=${quote}data:…`,
  );
  // Roots that are only elements break between siblings; a root that spells
  // text keeps its neighbours on the same line, because a newline a
  // formatter adds beside text is text the markup did not have.
  const roots = parseForFormat(collapsed).filter(
    (n) => n.kind !== "text" || !/^\s*$/.test(n.text),
  );
  const inline = roots.some((n) => n.kind === "text");
  return roots.map((n) => formatNode(n, 0)).join(inline ? "" : "\n");
}
