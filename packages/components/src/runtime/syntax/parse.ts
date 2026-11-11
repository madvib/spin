import { ParseError, type ComponentIr, type Diagnostic, type Node } from "./ir.ts";
import { matchBrace } from "./braces.ts";

const VOID = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "source",
  "track",
  "wbr",
]);

interface Parser {
  src: string;
  pos: number;
  errors: Diagnostic[];
}

const span = (start: number, end: number) => ({ start, end });

function fail(p: Parser, code: string, message: string, start: number, end: number): void {
  p.errors.push({ code, message, span: span(start, end) });
}

function skipWs(p: Parser): void {
  while (p.pos < p.src.length && /\s/.test(p.src[p.pos]!)) p.pos++;
}

function readTagName(p: Parser): string {
  const start = p.pos;
  while (p.pos < p.src.length && /[A-Za-z0-9\-\._:]/.test(p.src[p.pos]!)) p.pos++;
  return p.src.slice(start, p.pos);
}

function readAttrValue(p: Parser): { value: string; start: number; end: number } {
  const quote = p.src[p.pos];
  if (quote === '"' || quote === "'") {
    const qStart = p.pos;
    p.pos++;
    const start = p.pos;
    let value = "";
    for (;;) {
      // An unterminated quote ends at EOF: the value runs to the end.
      if (p.pos >= p.src.length) break;
      const ch = p.src[p.pos]!;
      if (ch === quote) {
        p.pos++;
        break;
      }
      if (ch === "{") {
        const close = matchBrace(p.src, p.pos, p.src.length);
        value += p.src.slice(p.pos, close + 1);
        p.pos = close + 1;
        continue;
      }
      value += ch;
      p.pos++;
    }
    void qStart;
    return { value, start, end: p.pos };
  }
  const start = p.pos;
  if (p.src[p.pos] === "{") {
    const close = matchBrace(p.src, p.pos, p.src.length);
    const value = p.src.slice(p.pos, close + 1);
    p.pos = close + 1;
    return { value, start, end: p.pos };
  }
  while (p.pos < p.src.length && !/[\s/>]/.test(p.src[p.pos]!)) p.pos++;
  return { value: p.src.slice(start, p.pos), start, end: p.pos };
}

function attrValue(raw: string, start: number, end: number) {
  const t = raw.trim();
  if (t.startsWith("{") && t.endsWith("}")) {
    return {
      kind: "expr" as const,
      expr: t.slice(1, -1).trim(),
      span: span(start, end),
    };
  }
  return { kind: "static" as const, value: raw };
}


function parseText(p: Parser): Node {
  const start = p.pos;
  while (p.pos < p.src.length && p.src[p.pos] !== "<") p.pos++;
  const raw = p.src.slice(start, p.pos);
  const mixed: { kind: "static"; value: string }[] & { kind: "expr"; expr: string; span: { start: number; end: number } }[] = [];
  let last = 0;
  let i = 0;
  while (i < raw.length) {
    const open = raw.indexOf("{", i);
    if (open === -1) break;
    const close = matchBrace(raw, open, raw.length);
    if (close >= raw.length) break;
    if (open > last) {
      const seg = raw.slice(last, open);
      mixed.push({ kind: "static", value: seg.includes("&") ? seg.replace(/&(#[xX]?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g, (m, body: string) => {
        if (body[0] === "#") {
          const isHex = body[1] === "x" || body[1] === "X";
          const code = parseInt(body.slice(isHex ? 2 : 1), isHex ? 16 : 10);
          if (Number.isNaN(code) || code < 0 || code > 0x10ffff) return m;
          try { return String.fromCodePoint(code); } catch { return m; }
        }
        return ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", times: "\u00d7", mdash: "\u2014", ndash: "\u2013", hellip: "\u2026", copy: "\u00a9" } as Record<string, string>)[body] ?? m;
      }) : seg } as never);
    }
    mixed.push({ kind: "expr", expr: raw.slice(open + 1, close).trim(), span: span(start + open, start + close + 1) } as never);
    last = close + 1;
    i = close + 1;
  }
  if (last < raw.length) {
    const seg = raw.slice(last);
    mixed.push({ kind: "static", value: seg.includes("&") ? seg.replace(/&(#[xX]?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g, (m, body: string) => {
      if (body[0] === "#") {
        const isHex = body[1] === "x" || body[1] === "X";
        const code = parseInt(body.slice(isHex ? 2 : 1), isHex ? 16 : 10);
        if (Number.isNaN(code) || code < 0 || code > 0x10ffff) return m;
        try { return String.fromCodePoint(code); } catch { return m; }
      }
      return ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", times: "\u00d7", mdash: "\u2014", ndash: "\u2013", hellip: "\u2026", copy: "\u00a9" } as Record<string, string>)[body] ?? m;
    }) : seg } as never);
  }
  return { kind: "text", parts: mixed as unknown as TextNode["parts"], span: span(start, p.pos) };
}

import type { TextNode } from "./ir.ts";

function parseElement(p: Parser): Node {
  const start = p.pos;
  p.pos++;
  if (p.src[p.pos] === "/") {
    fail(p, "stray-close", "closing tag without an opener", start, p.pos + 1);
    while (p.pos < p.src.length && p.src[p.pos] !== ">") p.pos++;
    p.pos++;
    return { kind: "text", parts: [], span: span(start, p.pos) };
  }
  const tag = readTagName(p);
  const attrs: ElementAttr[] = [];
  const events: EventBinding[] = [];
  const actions: ActionUse[] = [];
  const spreads: SpreadUse[] = [];
  for (;;) {
    skipWs(p);
    if (p.pos >= p.src.length) break;
    const aStart = p.pos;
    const ch = p.src[p.pos];
    if (ch === ">") {
      p.pos++;
      break;
    }
    if (ch === "/" && p.src[p.pos + 1] === ">") {
      p.pos += 2;
      return finishElement(p, tag, attrs, events, actions, spreads, [], start, p.pos);
    }
    if (ch === "/") {
      // A `/` that closes nothing (`<input / disabled>`): the name reader
      // below stops at `/`, so without this the loop spins on the same
      // position forever. HTML drops the stray slash; so do we.
      fail(p, "stray-slash", "a `/` that closes nothing is dropped", p.pos, p.pos + 1);
      p.pos++;
      continue;
    }
    let name = "";
    if (p.src[p.pos] === "{" && p.src.slice(p.pos, p.pos + 4) === "{...") {
      // A spread owns its braces: `{...api.f({ index: i })}` nests `{}` and
      // carries spaces, so the name runs to the BALANCED close, not to the
      // first whitespace. Quotes inside are respected, not counted. Every
      // iteration advances, and EOF exits with an unbalanced name.
      let depth = 0;
      let quote: string | undefined;
      while (p.pos < p.src.length) {
        const c = p.src[p.pos]!;
        if (quote !== undefined) {
          name += c;
          if (c === quote) quote = undefined;
        } else if (c === '"' || c === "'") {
          quote = c;
          name += c;
        } else if (c === "{") {
          depth++;
          name += c;
        } else if (c === "}") {
          depth--;
          name += c;
          if (depth === 0) {
            p.pos++;
            break;
          }
        } else {
          name += c;
        }
        p.pos++;
      }
    } else {
      while (p.pos < p.src.length && !/[\s=/>]/.test(p.src[p.pos]!)) {
        name += p.src[p.pos];
        p.pos++;
      }
    }
    skipWs(p);
    let raw = "";
    let vStart = p.pos;
    let vEnd = p.pos;
    if (p.src[p.pos] === "=") {
      p.pos++;
      skipWs(p);
      const v = readAttrValue(p);
      raw = v.value;
      vStart = v.start;
      vEnd = v.end;
    }
    const aSpan = span(aStart, p.pos);
    if (name.startsWith("{...") && name.endsWith("}")) {
      spreads.push({ expr: name.slice(4, -1).trim(), span: aSpan });
    } else if (name.startsWith("on:")) {
      const body = raw.trim();
      const handler = body.startsWith("{") && body.endsWith("}") ? body.slice(1, -1).trim() : body;
      events.push({ event: name.slice(3), handler, span: aSpan });
    } else if (name.startsWith("use:")) {
      const body = raw.trim();
      const param = body.startsWith("{") && body.endsWith("}")
        ? body.slice(1, -1).trim()
        : body.length > 0
        ? JSON.stringify(body)
        : undefined;
      actions.push({ name: name.slice(4), param, span: aSpan });
    } else if (name === "for" || name === "as" || name === "key") {
      attrs.push({ name, value: attrValue(raw, vStart, vEnd), span: aSpan });
    } else {
      attrs.push({ name, value: attrValue(raw, vStart, vEnd), span: aSpan });
    }
    void vStart;
    void vEnd;
  }
  if (VOID.has(tag)) {
    return finishElement(p, tag, attrs, events, actions, spreads, [], start, p.pos);
  }
  if (tag === "template") {
    return parseTemplate(p, attrs, events, actions, start);
  }
  const children: Node[] = [];
  for (;;) {
    skipWs(p);
    if (p.pos >= p.src.length) {
      fail(p, "unclosed", `element <${tag}> is never closed`, start, p.pos);
      break;
    }
    if (p.src[p.pos] === "<" && p.src[p.pos + 1] === "/") {
      p.pos += 2;
      const close = readTagName(p);
      skipWs(p);
      if (p.src[p.pos] === ">") p.pos++;
      if (close !== tag) {
        fail(p, "mismatch", `expected </${tag}> but found </${close}>`, start, p.pos);
      }
      break;
    }
    if (p.src[p.pos] === "<") {
      children.push(parseElement(p));
    } else {
      const t = parseText(p);
      if (t.kind === "text" && t.parts.length > 0) children.push(t);
    }
  }
  return finishElement(p, tag, attrs, events, actions, spreads, children, start, p.pos);
}

import type { ActionUse, Attr as ElementAttr, EventBinding, SpreadUse } from "./ir.ts";

function finishElement(
  p: Parser,
  tag: string,
  attrs: ElementAttr[],
  events: EventBinding[],
  actions: ActionUse[],
  spreads: SpreadUse[],
  children: Node[],
  start: number,
  end: number,
): Node {
  // `show={expr}` is structural, not an attribute: it never reaches the DOM.
  const at = attrs.findIndex((a) => a.name === "show");
  let show: string | undefined;
  if (at !== -1) {
    const found = attrs[at]!;
    if (found.value.kind !== "expr") {
      fail(p, "show-static", "`show` needs an expression: show={cond}", found.span.start, found.span.end);
    } else {
      show = found.value.expr;
    }
    attrs.splice(at, 1);
  }
  return { kind: "element", tag, attrs, events, actions, spreads, children, ...(show !== undefined ? { show } : {}), span: span(start, end) };
}

function templateAttr(attrs: ElementAttr[], name: string): string | undefined {
  const found = attrs.find((a) => a.name === name);
  if (!found) return undefined;
  const v = found.value;
  if (v.kind === "static") return v.value;
  return `{${v.expr}}`;
}

function parseTemplate(
  p: Parser,
  attrs: ElementAttr[],
  events: EventBinding[],
  actions: ActionUse[],
  start: number,
): Node {
  void events;
  void actions;
  const rawFor = templateAttr(attrs, "for");
  const rawAs = templateAttr(attrs, "as");
  const rawKey = templateAttr(attrs, "key");
  if (rawFor === undefined) {
    fail(p, "template-for", "<template> needs a for={items} attribute", start, p.pos);
  }
  const source = rawFor !== undefined && rawFor.startsWith("{") && rawFor.endsWith("}")
    ? rawFor.slice(1, -1).trim()
    : (rawFor ?? "");
  const binding = rawAs !== undefined && rawAs.startsWith("{") && rawAs.endsWith("}")
    ? rawAs.slice(1, -1).trim()
    : (rawAs ?? "item");
  const key = rawKey !== undefined && rawKey.startsWith("{") && rawKey.endsWith("}")
    ? rawKey.slice(1, -1).trim()
    : rawKey;
  const body: Node[] = [];
  for (;;) {
    skipWs(p);
    if (p.pos >= p.src.length) {
      fail(p, "unclosed", "<template> is never closed", start, p.pos);
      break;
    }
    if (p.src[p.pos] === "<" && p.src[p.pos + 1] === "/") {
      p.pos += 2;
      const close = readTagName(p);
      skipWs(p);
      if (p.src[p.pos] === ">") p.pos++;
      if (close !== "template") {
        fail(p, "mismatch", `expected </template> but found </${close}>`, start, p.pos);
      }
      break;
    }
    if (p.src[p.pos] === "<") {
      body.push(parseElement(p));
    } else {
      const t = parseText(p);
      if (t.kind === "text" && t.parts.length > 0) body.push(t);
    }
  }
  return { kind: "for", source, binding, key, body, span: span(start, p.pos) };
}

export function parse(source: string): ComponentIr {
  const p: Parser = { src: source, pos: 0, errors: [] };
  const nodes: Node[] = [];
  for (;;) {
    skipWs(p);
    if (p.pos >= p.src.length) break;
    if (p.src[p.pos] === "<") {
      const n = parseElement(p);
      if (n.kind === "text" && n.parts.length === 0) continue;
      nodes.push(n);
    } else {
      const t = parseText(p);
      if (t.kind === "text" && t.parts.length > 0) nodes.push(t);
    }
  }
  if (p.errors.length > 0) throw new ParseError(p.errors);
  return { nodes };
}
