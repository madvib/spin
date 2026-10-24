/**
 * Example markup and code, formatted and tokenized for the code view.
 */

export function formatExampleHtml(html: string): string {
  const collapsed = html.replace(
    /src=(["'])data:[^"']*/g,
    (_match, quote: string) => `src=${quote}data:…`,
  );
  const lines = collapsed.replace(/\t/g, "  ").split("\n");
  const indents = lines
    .filter((line) => line.trim() !== "")
    .map((line) => line.match(/^\s*/)?.[0].length ?? 0);
  const strip = indents.length === 0 ? 0 : Math.min(...indents);
  const out: string[] = [];
  let blank = 0;
  for (const line of lines) {
    const text = line.slice(strip).replace(/\s+$/, "");
    if (text === "") {
      blank++;
      continue;
    }
    if (blank > 0 && out.length > 0) out.push("");
    blank = 0;
    out.push(text);
  }
  return out.join("\n");
}

export type CodeTokenType =
  | "tag"
  | "attr"
  | "string"
  | "comment"
  | "punct"
  | "text"
  | "keyword"
  | "code-string"
  | "number"
  | "plain";

export interface CodeToken {
  readonly type: CodeTokenType;
  readonly value: string;
}

const WHITESPACE = /\s/;
const NAME_STOP = /[\s=/>]/;

const TS_KEYWORDS = new Set([
  "import",
  "export",
  "from",
  "default",
  "const",
  "let",
  "var",
  "function",
  "return",
  "require",
  "module",
  "type",
  "interface",
  "extends",
  "new",
  "await",
  "async",
  "as",
  "with",
  "if",
  "else",
  "for",
  "while",
]);

export function tokenizeCode(
  source: string,
  lang: string,
): readonly CodeToken[] {
  if (lang === "html") return tokenizeHtml(source);
  if (
    lang === "ts" || lang === "tsx" || lang === "js" ||
    lang === "javascript" || lang === "json" || lang === "bash" ||
    lang === "sh"
  ) {
    return lang === "json" ? tokenizeJson(source) : tokenizeTs(source);
  }
  return [{ type: "plain", value: source }];
}

function tokenizeJson(source: string): readonly CodeToken[] {
  const out: CodeToken[] = [];
  let i = 0;
  const push = (type: CodeTokenType, value: string) => {
    if (value !== "") out.push({ type, value });
  };
  while (i < source.length) {
    const ch = source[i]!;
    if (ch === '"') {
      let j = i + 1;
      while (j < source.length && source[j] !== '"') {
        if (source[j] === "\\") j += 1;
        j += 1;
      }
      const stop = j < source.length ? j + 1 : j;
      let k = stop;
      while (k < source.length && /[\s]/.test(source[k]!)) k += 1;
      push(source[k] === ":" ? "attr" : "code-string", source.slice(i, stop));
      i = stop;
      continue;
    }
    if (ch === "/" && source[i + 1] === "/") {
      let j = i + 2;
      while (j < source.length && source[j] !== "\n") j += 1;
      push("comment", source.slice(i, j));
      i = j;
      continue;
    }
    if (/[-0-9]/.test(ch)) {
      let j = i + 1;
      while (j < source.length && /[0-9.eE+-]/.test(source[j]!)) j += 1;
      push("number", source.slice(i, j));
      i = j;
      continue;
    }
    if (/[A-Za-z_$]/.test(ch)) {
      let j = i + 1;
      while (j < source.length && /[\w$]/.test(source[j]!)) j += 1;
      const word = source.slice(i, j);
      push(
        word === "true" || word === "false" || word === "null"
          ? "number"
          : TS_KEYWORDS.has(word)
          ? "keyword"
          : "plain",
        word,
      );
      i = j;
      continue;
    }
    push("punct", ch);
    i += 1;
  }
  return out;
}

function tokenizeTs(source: string): readonly CodeToken[] {
  const out: CodeToken[] = [];
  let i = 0;
  const push = (type: CodeTokenType, value: string) => {
    if (value !== "") out.push({ type, value });
  };
  while (i < source.length) {
    const ch = source[i]!;
    const two = source.slice(i, i + 2);
    if (two === "//") {
      let j = i + 2;
      while (j < source.length && source[j] !== "\n") j += 1;
      push("comment", source.slice(i, j));
      i = j;
      continue;
    }
    if (two === "/*") {
      const end = source.indexOf("*/", i + 2);
      const stop = end === -1 ? source.length : end + 2;
      push("comment", source.slice(i, stop));
      i = stop;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      let j = i + 1;
      while (j < source.length && source[j] !== ch) {
        if (source[j] === "\\") j += 1;
        j += 1;
      }
      push("code-string", source.slice(i, j < source.length ? j + 1 : j));
      i = j < source.length ? j + 1 : j;
      continue;
    }
    if (/[0-9]/.test(ch)) {
      let j = i + 1;
      while (j < source.length && /[0-9.eE_xa-fA-F]/.test(source[j]!)) j += 1;
      push("number", source.slice(i, j));
      i = j;
      continue;
    }
    if (/[A-Za-z_$]/.test(ch)) {
      let j = i + 1;
      while (j < source.length && /[\w$]/.test(source[j]!)) j += 1;
      const word = source.slice(i, j);
      push(TS_KEYWORDS.has(word) ? "keyword" : "plain", word);
      i = j;
      continue;
    }
    push(ch.trim() === "" ? "plain" : "punct", ch);
    i += 1;
  }
  return out;
}

export function tokenizeHtml(html: string): readonly CodeToken[] {
  const out: CodeToken[] = [];
  const push = (type: CodeTokenType, value: string) => {
    if (value !== "") out.push({ type, value });
  };
  let i = 0;
  while (i < html.length) {
    const lt = html.indexOf("<", i);
    if (lt === -1) {
      push("text", html.slice(i));
      break;
    }
    if (lt > i) push("text", html.slice(i, lt));
    if (html.startsWith("<!--", lt)) {
      const end = html.indexOf("-->", lt + 4);
      const stop = end === -1 ? html.length : end + 3;
      push("comment", html.slice(lt, stop));
      i = stop;
      continue;
    }
    if (html.startsWith("<!", lt)) {
      const end = html.indexOf(">", lt);
      const stop = end === -1 ? html.length : end + 1;
      push("comment", html.slice(lt, stop));
      i = stop;
      continue;
    }
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
      let attrEnd = i;
      while (attrEnd < html.length && !NAME_STOP.test(html[attrEnd]!)) {
        attrEnd += 1;
      }
      push("attr", html.slice(i, attrEnd));
      i = attrEnd;
      if (html[i] === "=") {
        push("punct", "=");
        i += 1;
        const quote = html[i];
        if (quote === '"' || quote === "'") {
          const close = html.indexOf(quote, i + 1);
          const stop = close === -1 ? html.length : close + 1;
          push("string", html.slice(i, stop));
          i = stop;
        } else {
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

export const CODE_INK: Readonly<Record<CodeTokenType, string>> = {
  tag: "text-semantic-error",
  attr: "text-link",
  string: "text-semantic-warning",
  comment: "text-text-muted",
  punct: "text-text-muted",
  text: "text-text",
  keyword: "text-semantic-error",
  "code-string": "text-semantic-warning",
  number: "text-link",
  plain: "text-text",
};
