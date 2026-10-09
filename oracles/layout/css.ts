/**
 * The sheet, parsed and resolved. The oracle never hand-copies a token: it
 * asks the preset for the CSS the reference app itself would generate for the
 * fixture, then resolves that sheet the way a browser would — variables
 * against the chosen theme, calc() arithmetic, the cascade, inheritance.
 *
 * Deliberate scope, matching what the fixtures exercise: type/tag/class/id
 * selectors, the combinators, :is/:not, structural (:first-child,
 * :last-child, :nth-of-type), attribute presence and operators. State
 * selectors (:hover, :disabled, …), pseudo-elements and @media blocks are
 * screened out rather than modelled — a base-state layout does not include
 * them.
 */

import { createGenerator } from "@unocss/core";
import { spinPreset } from "@spin/preset";
import { starterThemes } from "@spin/theme/themes";
import type { DomNode } from "./dom.ts";
import { elementChildren } from "./dom.ts";

/** The viewport of record: the defect reports are all at 1024 wide. */
export const VIEWPORT = { width: 1024, height: 800 };
/** Root font size. The themes state their dimensions in rem. */
export const ROOT_FONT_PX = 16;
/**
 * `line-height: normal`, measured against the reference in Chromium: a 16px
 * body line boxes at 24px and a 14px header line at 21px — exactly 1.5×.
 */
export const NORMAL_LINE_FACTOR = 1.5;

export type Length =
  | { readonly kind: "px"; readonly px: number }
  | { readonly kind: "percent"; readonly fraction: number }
  | { readonly kind: "auto" }
  | { readonly kind: "none" }
  | { readonly kind: "keyword"; readonly keyword: string };

export const PX_ZERO: Length = { kind: "px", px: 0 };

/* ------------------------------------------------------------------ sheet -- */

interface Declaration {
  readonly prop: string;
  readonly value: string;
}

interface Rule {
  readonly selectors: readonly ParsedSelector[];
  readonly declarations: readonly Declaration[];
  /** Position in the sheet, the cascade's tie-break. */
  readonly order: number;
}

interface AttrMatch {
  readonly name: string;
  readonly op: "=" | "~=" | "|=" | "^=" | "$=" | "*=" | "exists";
  readonly value: string;
}

interface Compound {
  tag: string | null;
  id: string | null;
  classes: string[];
  attrs: AttrMatch[];
  /** first-child, last-child, nth-of-type(…) — matched against the DOM. */
  structural: string[];
  /** Anything stateful (:hover, ::before) — such a rule never matches. */
  states: string[];
  is: (readonly Compound[])[];
  not: (readonly Compound[])[];
}

interface SelectorPart {
  readonly combinator: " " | ">" | "+" | "~";
  readonly compound: Compound;
}

interface ParsedSelector {
  /** Leftmost first; the last part is the subject. */
  readonly parts: readonly SelectorPart[];
  readonly specificity: readonly [number, number, number];
}

export interface Sheet {
  readonly themes: readonly string[];
  /** theme name → custom property → declared value. */
  readonly vars: Readonly<Record<string, Record<string, string>>>;
  readonly rules: readonly Rule[];
}

export async function buildSheet(fixtureHtml: string): Promise<Sheet> {
  const uno = await createGenerator({
    presets: [spinPreset({ themes: starterThemes })],
  });
  const { css } = await uno.generate(fixtureHtml, { preflights: true });
  return parseSheet(css);
}

function parseSheet(css: string): Sheet {
  const body = stripComments(css);
  const rules: Rule[] = [];
  const themeBlocks: Record<string, Record<string, string>> = {};
  scanTopLevel(body, (chunk) => {
    const brace = chunk.indexOf("{");
    const inner = chunk.slice(brace + 1, chunk.lastIndexOf("}"));
    const head = chunk.slice(0, brace).trim();
    if (head.startsWith("@")) return; // @media and friends: not modelled
    const theme = themeNameOf(head);
    const declarations = parseDeclarations(inner);
    if (theme !== null) {
      const bucket = themeBlocks[theme] ??= {};
      for (const d of declarations) {
        if (d.prop.startsWith("--")) bucket[d.prop] = d.value;
      }
      return;
    }
    const selectors = splitTopLevel(head, ",")
      .map((s) => parseSelector(s.trim()))
      .filter((s): s is ParsedSelector => s !== null);
    if (selectors.length === 0) return;
    rules.push({
      selectors,
      declarations: expandDeclarations(declarations),
      order: rules.length,
    });
  });
  return { themes: Object.keys(themeBlocks), vars: themeBlocks, rules };
}

function themeNameOf(head: string): string | null {
  const m = head.match(/^\[data-theme="([^"]+)"\]$/);
  return m ? m[1] : null;
}

/** Splits a stylesheet into whole `selector { decls }` chunks. */
function scanTopLevel(css: string, visit: (chunk: string) => void): void {
  let depth = 0;
  let ruleStart = 0;
  let i = 0;
  while (i < css.length) {
    const ch = css[i];
    if (ch === "{") {
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0) {
        visit(css.slice(ruleStart, i + 1));
        ruleStart = i + 1;
      }
    }
    i++;
  }
}

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

function parseDeclarations(block: string): Declaration[] {
  const out: Declaration[] = [];
  for (const piece of splitTopLevel(block, ";")) {
    const colon = piece.indexOf(":");
    if (colon <= 0) continue;
    out.push({
      prop: piece.slice(0, colon).trim().toLowerCase(),
      value: piece.slice(colon + 1).trim(),
    });
  }
  return out;
}

/** Splits on a separator that is not nested in (), [] or quotes. */
function splitTopLevel(text: string, sep: string): string[] {
  const out: string[] = [];
  let depthParen = 0;
  let depthBracket = 0;
  let quote = "";
  let current = "";
  for (const ch of text) {
    if (quote !== "") {
      current += ch;
      if (ch === quote) quote = "";
      continue;
    }
    if (ch === '"' || ch === "'") quote = ch;
    else if (ch === "(") depthParen++;
    else if (ch === ")") depthParen--;
    else if (ch === "[") depthBracket++;
    else if (ch === "]") depthBracket--;
    else if (ch === sep && depthParen === 0 && depthBracket === 0) {
      out.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  out.push(current);
  return out.filter((s) => s.trim() !== "");
}

function parseSelector(text: string): ParsedSelector | null {
  const normalized = text.replace(/\\(.)/g, "$1").trim();
  const tokens: string[] = [];
  let current = "";
  let depth = 0;
  for (const ch of normalized) {
    if (ch === "(" || ch === "[") depth++;
    else if (ch === ")" || ch === "]") depth--;
    if (
      depth === 0 &&
      (ch === " " || ch === "\t" || ch === "\n" || ch === ">" || ch === "+" ||
        ch === "~")
    ) {
      if (current !== "") {
        tokens.push(current);
        current = "";
      }
      if (ch !== " " && ch !== "\t" && ch !== "\n") tokens.push(ch);
      continue;
    }
    current += ch;
  }
  if (current !== "") tokens.push(current);
  if (tokens.length === 0) return null;
  const parts: SelectorPart[] = [];
  let combinator: SelectorPart["combinator"] = " ";
  for (const token of tokens) {
    if (token === ">" || token === "+" || token === "~") {
      combinator = token;
      continue;
    }
    const compound = parseCompound(token);
    if (compound === null) return null;
    parts.push({ combinator, compound });
    combinator = " ";
  }
  return { parts, specificity: specificityOf(parts) };
}

function parseCompound(token: string): Compound | null {
  const compound: Compound = {
    tag: null,
    id: null,
    classes: [],
    attrs: [],
    structural: [],
    states: [],
    is: [],
    not: [],
  };
  let rest = token;
  const tag = rest.match(/^[a-zA-Z][-a-zA-Z0-9]*|\*/);
  if (tag) {
    if (tag[0] !== "*") compound.tag = tag[0].toLowerCase();
    rest = rest.slice(tag[0].length);
  }
  while (rest !== "") {
    if (rest.startsWith(".")) {
      const m = rest.slice(1).match(/^[-a-zA-Z0-9_%/]+/);
      if (!m) return null;
      compound.classes.push(m[0]);
      rest = rest.slice(1 + m[0].length);
    } else if (rest.startsWith("#")) {
      const m = rest.slice(1).match(/^[-a-zA-Z0-9_]+/);
      if (!m) return null;
      compound.id = m[0];
      rest = rest.slice(1 + m[0].length);
    } else if (rest.startsWith("[")) {
      const end = rest.indexOf("]");
      if (end < 0) return null;
      compound.attrs.push(parseAttr(rest.slice(1, end)));
      rest = rest.slice(end + 1);
    } else if (rest.startsWith("::")) {
      compound.states.push(rest); // a pseudo-element box is not modelled
      rest = "";
    } else if (rest.startsWith(":is(") || rest.startsWith(":not(")) {
      const is = rest.startsWith(":is");
      const close = matchingParen(rest);
      if (close < 0) return null;
      const inner = splitTopLevel(rest.slice(4, close), ",").map((s) =>
        parseSelector(s.trim())
      ).filter((s): s is ParsedSelector => s !== null)
        .map((s) => s.parts[s.parts.length - 1].compound);
      (is ? compound.is : compound.not).push(inner);
      rest = rest.slice(close + 1);
    } else if (rest.startsWith(":")) {
      const m = rest.slice(1).match(/^[a-zA-Z-]+(\([^)]*\))?/);
      if (!m) return null;
      const name = `:${m[0]}`;
      if (
        name === ":first-child" || name === ":last-child" ||
        name === ":only-child" || name.startsWith(":nth-")
      ) {
        compound.structural.push(name);
      } else {
        compound.states.push(name);
      }
      rest = rest.slice(1 + m[0].length);
    } else {
      return null;
    }
  }
  return compound;
}

function parseAttr(text: string): AttrMatch {
  const m = text.match(/^\s*([^\s~|^$*=]+)\s*(?:([~|^$*]?=)\s*(.*?)\s*)?$/);
  if (!m) return { name: text.trim(), op: "exists", value: "" };
  if (!m[2]) return { name: m[1], op: "exists", value: "" };
  return {
    name: m[1],
    op: m[2] as AttrMatch["op"],
    value: m[3].replace(/^["']|["']$/g, ""),
  };
}

function matchingParen(text: string): number {
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "(") depth++;
    else if (text[i] === ")") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function specificityGreater(
  left: readonly [number, number, number],
  right: readonly [number, number, number],
): boolean {
  return left[0] !== right[0]
    ? left[0] > right[0]
    : left[1] !== right[1]
    ? left[1] > right[1]
    : left[2] > right[2];
}

function specificityOf(
  parts: readonly SelectorPart[],
): [number, number, number] {
  let a = 0;
  let b = 0;
  let c = 0;
  for (const part of parts) {
    const cmp = part.compound;
    if (cmp.id) a += 1;
    b += cmp.classes.length + cmp.attrs.length + cmp.structural.length +
      cmp.states.length;
    if (cmp.tag) c += 1;
    for (const group of [...cmp.is, ...cmp.not]) {
      const inner = group.reduce<[number, number, number]>(
        (best, sel) => {
          const s = specificityOf([{ combinator: " ", compound: sel }]);
          return specificityGreater(s, best) ? s : best;
        },
        [0, 0, 0],
      );
      a += inner[0];
      b += inner[1];
      c += inner[2];
    }
  }
  return [a, b, c];
}

/**
 * Shorthands become the longhands a browser cascades, so `border` and
 * `border-width` from different rules compete on the same four properties
 * instead of whichever happens to be read first.
 */
function expandDeclarations(
  declarations: readonly Declaration[],
): Declaration[] {
  const out: Declaration[] = [];
  for (const declaration of declarations) {
    out.push(
      declaration,
      ...expandShorthand(declaration.prop, declaration.value),
    );
  }
  return out;
}

/** The 1-to-4 value box shorthand, as CSS reads it. */
function boxFour(parts: readonly string[]): string[] {
  return [
    parts[0],
    parts[1] ?? parts[0],
    parts[2] ?? parts[0],
    parts[3] ?? parts[1] ?? parts[0],
  ];
}

function expandShorthand(prop: string, value: string): Declaration[] {
  const parts = value.split(" ");
  switch (prop) {
    case "padding":
    case "margin":
      return ["top", "right", "bottom", "left"].map((edge, i) => ({
        prop: `${prop}-${edge}`,
        value: boxFour(parts)[i],
      }));
    case "padding-inline":
    case "margin-inline":
      return [
        { prop: `${prop}-start`, value: parts[0] },
        { prop: `${prop}-end`, value: parts[1] ?? parts[0] },
      ];
    case "padding-block":
    case "margin-block":
      return [
        { prop: `${prop}-start`, value: parts[0] },
        { prop: `${prop}-end`, value: parts[1] ?? parts[0] },
      ];
    case "gap":
      return [
        { prop: "row-gap", value: parts[0] },
        { prop: "column-gap", value: parts[1] ?? parts[0] },
      ];
    case "overflow":
      return [
        { prop: "overflow-x", value: parts[0] },
        { prop: "overflow-y", value: parts[1] ?? parts[0] },
      ];
    case "flex": {
      const [grow = "1", shrink = "1", basis = "0%"] = parts;
      return [
        { prop: "flex-grow", value: grow },
        { prop: "flex-shrink", value: shrink },
        { prop: "flex-basis", value: basis },
      ];
    }
    case "font":
      // Only `font: inherit` appears in the sheet; inheritance covers it.
      return [];
    case "border":
    case "border-top":
    case "border-right":
    case "border-bottom":
    case "border-left":
    case "border-inline-start":
    case "border-inline-end":
    case "border-block-start":
    case "border-block-end": {
      const [width = "medium", style = "none", ...rest] = parts;
      const color = rest.join(" ");
      const side = prop === "border" ? ["top", "right", "bottom", "left"] : [
        prop.replace("border-", "").replace("inline-start", "left").replace(
          "inline-end",
          "right",
        ).replace("block-start", "top").replace("block-end", "bottom"),
      ];
      return side.flatMap((edge) => [
        { prop: `border-${edge}-width`, value: width },
        { prop: `border-${edge}-style`, value: style },
        ...(color === ""
          ? []
          : [{ prop: `border-${edge}-color`, value: color }]),
      ]);
    }
    case "border-width":
    case "border-style":
    case "border-color": {
      const suffix = prop.replace("border-", "");
      const sides = boxFour(parts);
      return ["top", "right", "bottom", "left"].map((edge, i) => ({
        prop: `border-${edge}-${suffix}`,
        value: sides[i],
      }));
    }
    default:
      return [];
  }
}

/* --------------------------------------------------------------- matching -- */

function compoundMatches(
  compound: Compound,
  node: DomNode,
): boolean {
  if (compound.tag !== null && compound.tag !== node.tag) return false;
  if (compound.id !== null && node.attrs["id"] !== compound.id) return false;
  for (const cls of compound.classes) {
    if (!node.classes.includes(cls)) return false;
  }
  for (const attr of compound.attrs) {
    if (!attrMatches(attr, node)) return false;
  }
  for (const structural of compound.structural) {
    if (!structuralMatches(structural, node)) return false;
  }
  if (compound.states.length > 0) return false;
  if (
    compound.is.length > 0 &&
    !compound.is.some((g) => g.some((c) => compoundMatches(c, node)))
  ) {
    return false;
  }
  if (compound.not.some((g) => g.some((c) => compoundMatches(c, node)))) {
    return false;
  }
  return true;
}

function attrMatches(attr: AttrMatch, node: DomNode): boolean {
  const actual = node.attrs[attr.name];
  if (actual === undefined) return false;
  switch (attr.op) {
    case "exists":
      return true;
    case "=":
      return actual === attr.value;
    case "~=":
      return actual.split(/\s+/).includes(attr.value);
    case "|=":
      return actual === attr.value || actual.startsWith(`${attr.value}-`);
    case "^=":
      return attr.value !== "" && actual.startsWith(attr.value);
    case "$=":
      return attr.value !== "" && actual.endsWith(attr.value);
    case "*=":
      return attr.value !== "" && actual.includes(attr.value);
  }
}

function structuralMatches(name: string, node: DomNode): boolean {
  const parent = node.parent;
  if (parent === null) return true;
  const siblings = elementChildren(parent);
  const index = siblings.indexOf(node);
  if (name === ":first-child") return index === 0;
  if (name === ":last-child") return index === siblings.length - 1;
  if (name === ":only-child") return siblings.length === 1;
  const nth = name.match(/^:nth-of-type\(([^)]*)\)$/);
  if (!nth) return false;
  const sameType = siblings.filter((s) => s.tag === node.tag);
  return nthOfType(nth[1], sameType.indexOf(node) + 1);
}

function nthOfType(formula: string, position: number): boolean {
  const spec = formula.trim().toLowerCase();
  if (spec === "odd") return position % 2 === 1;
  if (spec === "even") return position % 2 === 0;
  const m = spec.match(/^([+-]?\d*)n\s*([+-]\s*\d+)?$/);
  if (!m) return false;
  const step = m[1] === "" || m[1] === "+"
    ? 1
    : m[1] === "-"
    ? -1
    : Number(m[1]);
  const offset = m[2] ? Number(m[2].replace(/\s+/g, "")) : 0;
  if (step === 0) return position === offset;
  return (position - offset) % step === 0 && (position - offset) / step >= 0;
}

function selectorMatches(
  selector: ParsedSelector,
  node: DomNode,
): boolean {
  const parts = selector.parts;
  if (!compoundMatches(parts[parts.length - 1].compound, node)) return false;
  // Each part carries the combinator connecting it to the part on its right,
  // so the subject's combinator is the one that selects ITS candidates.
  const walk = (index: number, current: DomNode): boolean => {
    if (index < 0) return true;
    const part = parts[index];
    const combinator = parts[index + 1].combinator;
    const candidates = combinator === " "
      ? ancestorsOf(current)
      : combinator === ">"
      ? parentOf(current)
      : combinator === "+"
      ? elementSiblingBefore(current, true)
      : elementSiblingBefore(current, false);
    return candidates.some((candidate) =>
      compoundMatches(part.compound, candidate) && walk(index - 1, candidate)
    );
  };
  return walk(parts.length - 2, node);
}

function ancestorsOf(node: DomNode): DomNode[] {
  const out: DomNode[] = [];
  let current = node.parent;
  while (current !== null) {
    out.push(current);
    current = current.parent;
  }
  return out;
}

function parentOf(node: DomNode): DomNode[] {
  return node.parent === null ? [] : [node.parent];
}

function elementSiblingBefore(
  node: DomNode,
  adjacentOnly: boolean,
): DomNode[] {
  const parent = node.parent;
  if (parent === null) return [];
  const siblings = elementChildren(parent);
  const index = siblings.indexOf(node);
  if (index < 0) return [];
  return adjacentOnly
    ? siblings.slice(Math.max(0, index - 1), index)
    : siblings.slice(0, index);
}

/* --------------------------------------------------------------- cascade --- */

/**
 * The declarations that style each node, after the cascade and inheritance.
 * Values keep var() reads resolved against the theme; lengths stay strings
 * until the engine asks for px.
 */
export function resolveStyles(
  root: DomNode,
  sheet: Sheet,
  theme: string,
): Map<DomNode, Record<string, string>> {
  const vars = themeVars(sheet, theme);
  const out = new Map<DomNode, Record<string, string>>();
  const visit = (node: DomNode, inherited: Record<string, string>): void => {
    const own = cascadeFor(node, sheet);
    const resolved: Record<string, string> = { ...inherited };
    for (const [prop, value] of Object.entries(own)) {
      const substituted = substituteVars(value, vars);
      if (substituted !== null) resolved[prop] = substituted;
    }
    out.set(node, resolved);
    for (const child of node.children) visit(child, inheritOnly(resolved));
  };
  visit(root, INITIAL_STYLES);
  return out;
}

function themeVars(sheet: Sheet, theme: string): Record<string, string> {
  const vars = sheet.vars[theme];
  if (vars === undefined) {
    throw new Error(`layout oracle: no such theme "${theme}"`);
  }
  return vars;
}

/** A custom property that cannot be resolved voids the declaration, as CSS does. */
function substituteVars(
  value: string,
  vars: Record<string, string>,
): string | null {
  let out = value;
  for (let depth = 0; depth < 8; depth++) {
    const next = out.replace(
      /var\(\s*(--[\w-]+)\s*(?:,\s*([^()]*))?\)/g,
      (_m, name: string, fallback: string | undefined) => {
        const declared = vars[name];
        if (declared !== undefined) return declared;
        return fallback?.trim() ?? "\u0000";
      },
    );
    if (next === out) return out.includes("\u0000") ? null : out;
    out = next;
  }
  return out.includes("\u0000") ? null : out;
}

const INHERITED_PROPS: readonly string[] = [
  "font-size",
  "font-family",
  "font-weight",
  "line-height",
  "color",
  "text-align",
  "font-variant-numeric",
  "letter-spacing",
  "text-transform",
];

const INITIAL_STYLES: Readonly<Record<string, string>> = {
  "font-size": `${ROOT_FONT_PX}px`,
  "line-height": "normal",
  color: "canvastext",
};

function inheritOnly(styles: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const prop of INHERITED_PROPS) {
    const value = styles[prop];
    if (value !== undefined) out[prop] = value;
  }
  return out;
}

function cascadeFor(node: DomNode, sheet: Sheet): Record<string, string> {
  const candidates: Array<
    {
      spec: readonly [number, number, number];
      order: number;
      declarations: readonly Declaration[];
    }
  > = [];
  for (const rule of sheet.rules) {
    for (const selector of rule.selectors) {
      if (selectorMatches(selector, node)) {
        candidates.push({
          spec: selector.specificity,
          order: rule.order,
          declarations: rule.declarations,
        });
        break;
      }
    }
  }
  candidates.sort((a, b) =>
    a.spec[0] - b.spec[0] || a.spec[1] - b.spec[1] || a.spec[2] - b.spec[2] ||
    a.order - b.order
  );
  const out: Record<string, string> = {};
  for (const candidate of candidates) {
    for (const d of candidate.declarations) out[d.prop] = d.value;
  }
  return out;
}

/* ----------------------------------------------------------------- values -- */

/** A used length in px, percent, or a keyword the engine must interpret. */
export function evalLength(
  value: string,
  vars: Record<string, string>,
  fontSizePx = ROOT_FONT_PX,
): Length {
  const resolved = substituteVars(value.trim(), vars);
  if (resolved === null) return { kind: "auto" };
  const text = resolved.trim();
  if (
    text === "" || text === "auto" || text === "max-content" ||
    text === "min-content" || text === "fit-content"
  ) {
    return text === "" ? { kind: "auto" } : { kind: "keyword", keyword: text };
  }
  if (text === "none") return { kind: "none" };
  if (text.startsWith("calc(")) {
    const calc = evalCalc(text, vars, fontSizePx);
    return calc ?? { kind: "auto" };
  }
  const m = text.match(/^(-?[\d.]+)(px|rem|em|%|vw|vh)?$/);
  if (!m) return { kind: "keyword", keyword: text };
  const n = Number(m[1]);
  switch (m[2]) {
    case undefined:
    case "px":
      return { kind: "px", px: n };
    case "rem":
      return { kind: "px", px: n * ROOT_FONT_PX };
    case "em":
      return { kind: "px", px: n * fontSizePx };
    case "%":
      return { kind: "percent", fraction: n / 100 };
    case "vh":
      return { kind: "px", px: (n * VIEWPORT.height) / 100 };
    default:
      return { kind: "px", px: (n * VIEWPORT.width) / 100 };
  }
}

/** A resolved declaration read as a raw string, or null when voided. */
export function evalString(
  value: string,
  vars: Record<string, string>,
): string | null {
  return substituteVars(value, vars);
}

export function evalUnitless(
  value: string,
  vars: Record<string, string>,
): number | null {
  const resolved = substituteVars(value.trim(), vars);
  if (resolved === null) return null;
  if (resolved.trim() === "normal") return null;
  const n = Number(resolved.trim());
  return Number.isFinite(n) ? n : null;
}

/** calc() over px-like terms; the sheet's arithmetic is flat addition of products. */
function evalCalc(
  text: string,
  vars: Record<string, string>,
  fontSizePx: number,
): Length | null {
  const inner = substituteVars(
    text.slice(text.indexOf("(") + 1, text.lastIndexOf(")")),
    vars,
  );
  if (inner === null) return null;
  const tokens = inner.match(/-?\d*\.?\d+(?:px|rem|em|%)?|[-+*/()]|\S/g);
  if (tokens === null) return null;
  let pos = 0;
  const peek = (): string => tokens[pos] ?? "";
  const eat = (): string => tokens[pos++];
  const unit = (token: string): { n: number; unit: string } => {
    const m = token.match(/^(-?[\d.]+)(px|rem|em|%)?$/);
    if (!m) throw new Error(`calc: bad term ${token}`);
    const unitName = m[2] ?? "px";
    const scale = unitName === "rem"
      ? ROOT_FONT_PX
      : unitName === "em"
      ? fontSizePx
      : 1;
    return { n: Number(m[1]) * scale, unit: unitName === "%" ? "%" : "px" };
  };
  const parseExpr = (): { n: number; unit: string } => {
    let left = parseTerm();
    while (peek() === "+" || peek() === "-") {
      const op = eat();
      const right = parseTerm();
      if (left.unit !== right.unit) throw new Error("calc: mixed units");
      left = {
        n: op === "+" ? left.n + right.n : left.n - right.n,
        unit: left.unit,
      };
    }
    return left;
  };
  const parseTerm = (): { n: number; unit: string } => {
    let left = parseFactor();
    while (peek() === "*" || peek() === "/") {
      const op = eat();
      const right = parseFactor();
      if (right.unit !== "px" || left.unit !== "px") {
        throw new Error("calc: product of non-scalars");
      }
      left = {
        n: op === "*" ? left.n * right.n : left.n / right.n,
        unit: "px",
      };
    }
    return left;
  };
  const parseFactor = (): { n: number; unit: string } => {
    const token = peek();
    if (token === "(") {
      eat();
      const value = parseExpr();
      if (eat() !== ")") throw new Error("calc: unbalanced");
      return value;
    }
    if (token === "-") {
      eat();
      const value = parseFactor();
      return { n: -value.n, unit: value.unit };
    }
    if (token === "+") {
      eat();
      return parseFactor();
    }
    eat();
    return unit(token);
  };
  try {
    const result = parseExpr();
    if (pos !== tokens.length) return null;
    return result.unit === "%"
      ? { kind: "percent", fraction: result.n / 100 }
      : { kind: "px", px: result.n };
  } catch {
    return null;
  }
}
