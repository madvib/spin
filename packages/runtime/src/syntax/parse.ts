import { ParseError, type ComponentIr, type Diagnostic, type Node, type ObjectField, type PropDecl, type ScopeBlock } from "./ir.ts";
import { matchBrace } from "./braces.ts";
import { isValidJsonDefault } from "../props.ts";

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
  scope?: ScopeBlock;
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
    const ch = p.src[p.pos];
    if (ch === ">") {
      p.pos++;
      break;
    }
    if (ch === "/" && p.src[p.pos + 1] === ">") {
      p.pos += 2;
      return finishElement(p, tag, attrs, events, actions, spreads, [], start, p.pos);
    }
    const aStart = p.pos;
    let name = "";
    if (p.src[p.pos] === "{" && p.src.slice(p.pos, p.pos + 4) === "{...") {
      // A spread owns its braces: `{...api.f({ index: i })}` nests `{}` and
      // carries spaces, so the name runs to the BALANCED close, not to the
      // first whitespace. Quotes inside are respected, not counted.
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

function peekTagName(p: Parser): string {
  let i = p.pos + 1;
  if (i < p.src.length && p.src[i] === "/") i++;
  const start = i;
  while (i < p.src.length && /[A-Za-z0-9\-\._:]/.test(p.src[i]!)) i++;
  return p.src.slice(start, i);
}

function findScopeStart(src: string): number {
  let idx = src.indexOf("<scope");
  while (idx !== -1) {
    const after = src[idx + 6];
    if (after === undefined || /\s|>/.test(after)) return idx;
    idx = src.indexOf("<scope", idx + 6);
  }
  return -1;
}

function parseScopeElement(p: Parser, start: number): ScopeBlock {
  p.pos++;
  readTagName(p);
  for (;;) {
    skipWs(p);
    if (p.pos >= p.src.length) {
      fail(p, "unclosed", "<scope> is never closed", start, p.pos);
      return { props: [], consume: [] };
    }
    if (p.src[p.pos] === ">") {
      p.pos++;
      break;
    }
    p.pos++;
  }
  const bodyStart = p.pos;
  const closeIdx = p.src.indexOf("</scope", p.pos);
  if (closeIdx === -1) {
    fail(p, "unclosed", "<scope> is never closed", start, p.src.length);
    p.pos = p.src.length;
    return { props: [], consume: [] };
  }
  const body = p.src.slice(bodyStart, closeIdx);
  p.pos = closeIdx + "</scope".length;
  skipWs(p);
  if (p.src[p.pos] === ">") p.pos++;
  return parseScopeBody(p, body, bodyStart);
}

function parseScopeBody(p: Parser, body: string, bodyStart: number): ScopeBlock {
  const props: PropDecl[] = [];
  const consume: string[] = [];

  let i = 0;
  while (i < body.length && /\s/.test(body[i]!)) i++;
  if (i >= body.length) return { props, consume };

  // Reject flat form: "props:" not followed by "={"
  if (/^props\s*:/.test(body.slice(i))) {
    fail(p, "scope-props", "flat 'props:' form is no longer supported; use 'props={ name: type = default, ... }' instead", bodyStart + i, bodyStart + body.length);
    return { props, consume };
  }

  // New form: props={...}
  const propsMatch = /^props\s*=\s*\{/.exec(body.slice(i));
  if (!propsMatch) {
    fail(p, "scope-props", "<scope> body must start with 'props={...}'", bodyStart + i, bodyStart + body.length);
    return { props, consume };
  }

  const braceStart = i + propsMatch[0].length - 1;
  const closeIdx = matchBrace(body, braceStart, body.length);
  if (closeIdx >= body.length) {
    fail(p, "scope-props", "'props={' is never closed", bodyStart + braceStart, bodyStart + body.length);
    return { props, consume };
  }

  const inner = body.slice(braceStart + 1, closeIdx);
  const innerAbsStart = bodyStart + braceStart + 1;
  for (const part of splitTopLevel(inner, ",")) {
    const entry = part.text.trim();
    if (entry.length === 0) continue;
    parseScopeEntry(p, entry, innerAbsStart + part.start, innerAbsStart + part.end, props);
  }

  // After props brace: optional consume={...}. A trailing comma between the
  // two blocks is tolerated (authors write `}, consume={` naturally).
  let j = closeIdx + 1;
  while (j < body.length && /\s/.test(body[j]!)) j++;
  if (body[j] === ",") j++;
  while (j < body.length && /\s/.test(body[j]!)) j++;
  if (j < body.length) {
    const rest = body.slice(j);
    const consumeMatch = /^consume\s*=\s*\{/.exec(rest);
    if (!consumeMatch) {
      fail(p, "scope-consume", `unexpected content after props: '${rest.trim()}'`, bodyStart + j, bodyStart + body.length);
    } else {
      const cBraceStart = j + consumeMatch[0].length - 1;
      const cCloseIdx = matchBrace(body, cBraceStart, body.length);
      if (cCloseIdx >= body.length) {
        fail(p, "scope-consume", "'consume={' is never closed", bodyStart + cBraceStart, bodyStart + body.length);
      } else {
        const cInner = body.slice(cBraceStart + 1, cCloseIdx);
        const cInnerAbsStart = bodyStart + cBraceStart + 1;
        for (const part of splitTopLevel(cInner, ",")) {
          const name = part.text.trim();
          if (name.length === 0) continue;
          if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name)) {
            fail(p, "scope-name", `invalid consume name '${name}'`, cInnerAbsStart + part.start, cInnerAbsStart + part.end);
            continue;
          }
          consume.push(name);
        }
        let k = cCloseIdx + 1;
        while (k < body.length && /\s/.test(body[k]!)) k++;
        if (k < body.length) {
          fail(p, "scope-consume", `unexpected content after consume: '${body.slice(k).trim()}'`, bodyStart + k, bodyStart + body.length);
        }
      }
    }
  }

  return { props, consume };
}

function splitTopLevel(s: string, sep: string): { text: string; start: number; end: number }[] {
  const parts: { text: string; start: number; end: number }[] = [];
  let depth = 0;
  let segStart = 0;
  let i = 0;
  while (i < s.length) {
    const c = s[i]!;
    if (c === '"' || c === "'" || c === "`") {
      i = skipQuoted(s, i);
      continue;
    }
    if (c === "{" || c === "[") depth++;
    else if (c === "}" || c === "]") depth--;
    else if (c === sep && depth === 0) {
      parts.push({ text: s.slice(segStart, i), start: segStart, end: i });
      segStart = i + 1;
    }
    i++;
  }
  parts.push({ text: s.slice(segStart), start: segStart, end: s.length });
  return parts;
}

function skipQuoted(s: string, i: number): number {
  const q = s[i]!;
  let j = i + 1;
  while (j < s.length) {
    if (s[j] === "\\") { j += 2; continue; }
    if (s[j] === q) return j + 1;
    j++;
  }
  return s.length;
}

function parseScopeEntry(p: Parser, entry: string, start: number, end: number, props: PropDecl[]): void {
  if (entry.length === 0) return;
  const colon = entry.indexOf(":");
  if (colon === -1) {
    fail(p, "scope-entry", `malformed scope entry '${entry}' (expected 'name: type = default')`, start, end);
    return;
  }
  const name = entry.slice(0, colon).trim();
  let typeStr = entry.slice(colon + 1).trim();
  let def: string | undefined;
  const eq = typeStr.indexOf("=");
  if (eq !== -1) {
    def = typeStr.slice(eq + 1).trim();
    typeStr = typeStr.slice(0, eq).trim();
  }
  // A string default is source text, quotes included (`= "horizontal"` parses
  // as `"horizontal"` with the quotes). Attribute values arrive unquoted from
  // the DOM, so this strips only here: stripping in coerceByType would eat a
  // live value's literal quotes. bool/int defaults are bare by construction.
  if ((typeStr === "string" || typeStr === "string[]") && def !== undefined) {
    const q = def[0];
    if (def.length >= 2 && (q === '"' || q === "'" || q === "`") && def[def.length - 1] === q) {
      def = def.slice(1, -1);
    }
  }
  if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name)) {
    fail(p, "scope-name", `invalid scope prop name '${name}'`, start, end);
    return;
  }

  // Object-array type: { field: type, ... }[] — strip "{" and "}[]".
  if (typeStr.startsWith("{") && typeStr.endsWith("}[]")) {
    const fields = parseObjectFields(typeStr.slice(1, -3).trim(), start, end, p);
    if (!fields) return;
    if (def !== undefined && !isValidJsonDefault(def)) {
      fail(p, "scope-default", `invalid JSON default for object-array '${name}'`, start, end);
      return;
    }
    props.push({ name, type: "object-array", fields, ...(def !== undefined ? { default: def } : {}) });
    return;
  }

  if (typeStr !== "bool" && typeStr !== "string" && typeStr !== "string[]" && typeStr !== "int") {
    fail(p, "scope-type", `invalid scope prop type '${typeStr}' for '${name}' (expected bool|string|string[]|int|{ fields }[])`, start, end);
    return;
  }
  props.push({ name, type: typeStr, ...(def !== undefined ? { default: def } : {}) });
}

function parseObjectFields(inner: string, start: number, end: number, p: Parser): ObjectField[] | null {
  const fields: ObjectField[] = [];
  if (inner.length === 0) {
    fail(p, "scope-type", "object-array type must declare at least one field", start, end);
    return null;
  }
  for (const part of splitTopLevel(inner, ",")) {
    const text = part.text.trim();
    if (text.length === 0) continue;
    const colon = text.indexOf(":");
    if (colon === -1) {
      fail(p, "scope-entry", `malformed object field '${text}' (expected 'name: type')`, start, end);
      return null;
    }
    const fname = text.slice(0, colon).trim();
    const ftype = text.slice(colon + 1).trim();
    if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(fname)) {
      fail(p, "scope-name", `invalid object field name '${fname}'`, start, end);
      return null;
    }
    if (ftype !== "string" && ftype !== "int" && ftype !== "bool") {
      fail(p, "scope-type", `invalid object field type '${ftype}' for '${fname}' (expected string|int|bool)`, start, end);
      return null;
    }
    fields.push({ name: fname, type: ftype });
  }
  if (fields.length === 0) {
    fail(p, "scope-type", "object-array type must declare at least one field", start, end);
    return null;
  }
  return fields;
}

export { coerceProps } from "../props.ts";

export function parse(source: string): ComponentIr {
  const p: Parser = { src: source, pos: 0, errors: [] };
  const nodes: Node[] = [];
  for (;;) {
    skipWs(p);
    if (p.pos >= p.src.length) break;
    if (p.src[p.pos] === "<") {
      if (peekTagName(p) === "scope") {
        p.scope = parseScopeElement(p, p.pos);
        continue;
      }
      const n = parseElement(p);
      if (n.kind === "text" && n.parts.length === 0) continue;
      nodes.push(n);
    } else {
      const t = parseText(p);
      if (t.kind === "text" && t.parts.length > 0) nodes.push(t);
    }
  }
  if (p.errors.length > 0) throw new ParseError(p.errors);
  const ir: ComponentIr = { nodes, ...(p.scope !== undefined ? { scope: p.scope } : {}) };
  return ir;
}

export function parseScope(source: string): ScopeBlock {
  const p: Parser = { src: source, pos: 0, errors: [] };
  const idx = findScopeStart(source);
  if (idx === -1) return { props: [], consume: [] };
  p.pos = idx;
  const block = parseScopeElement(p, idx);
  if (p.errors.length > 0) throw new ParseError(p.errors);
  return block;
}
