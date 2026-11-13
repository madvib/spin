/**
 * The rules, in the shape every linter agrees on.
 *
 * A linter is a delivery mechanism; the decisions live in `./core.ts`. What
 * is left here is what a linter is handed: the message each finding is
 * reported under, the dials the options turn, and the visitor that turns a
 * node into the facts the core reads.
 *
 * The node and the context are declared structurally rather than imported,
 * so the very same rule object serves oxlint's plugin API, ESLint's rule
 * API, and the CLI's own walk. None of the three is named here, and none of
 * them can drift from the others: the rules are shared, not copied.
 */

import { checkClosedVocabulary } from "./closed-vocabulary.ts";
import { THEME_STYLE_PROPERTIES } from "./vocabulary.ts";
import {
  DEFAULT_SEMANTIC_OPTIONS,
  type Facts,
  type Finding,
  type SemanticOptions,
  type SemanticTags,
  type Strictness,
} from "./core.ts";
import { checkNoHandwrittenTokens, checkNoUnpairedInk } from "./pairing.ts";
import { checkNoRedundantClass } from "./no-redundant-class.ts";
import { checkPreferElement } from "./prefer-element.ts";
import { checkPreferThemeValue, checkTypeStyleClashes } from "./prefer-theme-value.ts";
import type { EngineAnswers } from "./engine-types.ts";
import { factsForFile } from "./provider.ts";
import { ancestorsOf } from "./scope.ts";
/* ------------------------------------------------------------ the shapes -- */

/**
 * The subset of the AST these rules touch.
 *
 * Declared structurally so the rules stay typed without claiming more of
 * the tree than they actually read. Every linter that speaks ESTree — and
 * oxlint's plugin API does — satisfies it.
 */
export interface GateNode {
  type: string;
  name?: { name?: string } | null;
  /**
   * What the node holds.
   *
   * A JSX attribute holds the node its value is — a literal, an
   * expression — while a literal holds the value itself. The rules read
   * both, so both shapes are here.
   */
  value?: unknown;
  parent?: GateNode | null;
  loc?: { start: { line: number; column: number } } | null;
  /** The node's own range in the source, when the linter gives one. */
  range?: readonly [number, number];
}

/** What a linter hands a rule. */
export interface GateContext {
  /** The file being linted, absolute. */
  filename?: string;
  /** What the style engine answers. The linter host fills it once per run. */
  answers?: EngineAnswers;
  /** The rule's options, as the configuration gave them. */
  options?: unknown[];
  /**
   * The file's source, when the linter hands it over.
   *
   * ESLint does; the engine's own walk does not need to. The one service
   * the rules read is the vue parser's template traversal: without it a
   * template visitor never fires, because ESLint core does not know the
   * template's keys.
   */
  sourceCode?: {
    readonly text?: string;
    parserServices?: {
      defineTemplateBodyVisitor?: (
        template: Record<string, (node: GateNode) => void>,
      ) => Record<string, (node: GateNode) => void>;
    };
  };
  report(descriptor: {
    node: GateNode;
    messageId: string;
    data?: Record<string, string>;
    /** The edit that settles the finding, when it has one. */
    fix?: GateFix;
    /** What to do about the finding, in the rule's own words. */
    remedy?: string;
    /**
     * How bad the finding is, when the finding knows better than the rule.
     *
     * The rule's stance is the default — a problem is an error, a
     * suggestion a warning — and a finding that carries its own stance
     * overrides it.
     */
    severity?: "error" | "warning";
  }): void;
}

/**
 * A text edit, in the shape every linter's fixer speaks.
 *
 * The range is in the source's own offsets and the text is what replaces
 * it. The edit is a FUNCTION because that is what a linter's fixer is: ESLint
 * hands the rule a fixer and takes back `{ range, text }`, and oxlint takes
 * the same pair. So one rule object can offer the same edit to both.
 */
export type GateFix = () => {
  readonly range: readonly [number, number];
  readonly text: string;
};

/**
 * The JSON Schema a rule's options are validated against.
 *
 * Written out rather than imported so the package carries no dependency on
 * a linter it does not run. The shape is what ESLint's own schema type
 * accepts, and `tests/eslint.test.ts` holds the plugin to that.
 */
export interface GateSchema {
  type?: "object";
  properties?: { [key: string]: GateSchema };
  enum?: string[];
  additionalProperties?: boolean;
  description?: string;
}

/** What a rule says about itself. */
export interface GateMeta {
  /**
   * What the rule is: a problem, or a suggestion.
   *
   * The same words ESLint uses, and the same distinction: a problem is
   * something that is wrong, and a suggestion is another way of doing it.
   * The lint's stance is a stance about this: an override of a decision the
   * system made is wrong, and the wrong element is merely another way.
   */
  type: "problem" | "suggestion";
  /**
   * Whether the rule offers edits.
   *
   * A linter that is told a rule fixes nothing will not apply the edits it
   * is given, so the flag travels with the rule rather than with the
   * finding.
   */
  fixable?: "code";
  docs: { description: string };
  schema: GateSchema[];
  messages: Record<string, string>;
}

/** A rule, as a linter sees it. */
export interface GateRule {
  meta: GateMeta;
  create(context: GateContext): Record<string, (node: GateNode) => void>;
}

/* --------------------------------------------------------------- the AST -- */

const classTokens = (raw: string) => raw.split(/\s+/).filter(Boolean);

/** The tag name of the element an attribute belongs to. */
function tagOf(node: GateNode): string | undefined {
  return elementName(elementOf(node));
}

/** The element an attribute belongs to, across parsers. */
function elementOf(node: GateNode): GateNode | undefined {
  const parent = node.parent;
  if (parent === undefined || parent === null) return undefined;
  if (parent.type === "VStartTag" || parent.type === "SvelteStartTag") {
    const element = parent.parent;
    return element === null ? undefined : element;
  }
  return parent;
}

/** The tag name an element node carries, in any parser's shape. */
function elementName(element: GateNode | undefined): string | undefined {
  if (element === undefined) return undefined;
  const name = element.name as unknown;
  if (typeof name === "string") return name;
  if (typeof name === "object" && name !== null && "name" in name) {
    return typeof name.name === "string" ? name.name : undefined;
  }
  return undefined;
}

function isClassAttribute(node: GateNode): boolean {
  const name = attrName(node);
  return (
    name === "class" ||
    name === "className" ||
    name === "classList" ||
    name === ":class" ||
    name === "v-bind:class"
  );
}

/** The attribute name an attribute node carries, in any parser's shape. */
function attrName(sibling: unknown): string | undefined {
  if (typeof sibling !== "object" || sibling === null) return undefined;
  const node = sibling as {
    readonly type?: unknown;
    readonly name?: unknown;
    readonly kind?: unknown;
    readonly key?: unknown;
  };
  if (node.type === "SvelteDirective") {
    if (node.kind === "Class") return "class";
    if (node.kind === "StyleDirective") return "style";
    return undefined;
  }
  if (node.name !== undefined) {
    if (typeof node.name === "string") return node.name;
    if (typeof node.name === "object" && node.name !== null && "name" in node.name) {
      const name = (node.name as { name?: unknown }).name;
      if (typeof name === "string") return name;
    }
  }
  return keyName(node.key);
}

/** The attribute name a foreign key node carries. */
function keyName(key: unknown): string | undefined {
  if (typeof key !== "object" || key === null) return undefined;
  const node = key as {
    readonly name?: unknown;
    readonly value?: unknown;
    readonly argument?: unknown;
  };
  if (typeof node.value === "string") return node.value;
  if (typeof node.name === "string") return node.name;
  if (typeof node.name === "object" && node.name !== null && "name" in node.name) {
    const name = (node.name as { name?: unknown }).name;
    if (name !== "bind") return undefined;
    const argument = node.argument as { name?: unknown } | null | undefined;
    if (typeof argument?.name === "string") return argument.name;
    return undefined;
  }
  return undefined;
}

/**
 * The string an attribute carries.
 *
 * An attribute holds a node, and the string it carries is that node's own
 * value — `<div className="flex">` holds a literal, and the literal holds
 * the classes. A svelte attribute holds a list of parts; a single literal
 * part is the same string, and anything mixed with an expression is not a
 * string at all.
 */
function attributeValue(node: GateNode): string | undefined {
  const holder = node.value;
  if (Array.isArray(holder)) {
    if (holder.length !== 1) return undefined;
    const part = holder[0] as { type?: unknown; value?: unknown } | undefined;
    if (part?.type !== "SvelteLiteral") return undefined;
    return typeof part.value === "string" ? part.value : undefined;
  }
  if (typeof holder !== "object" || holder === null) return undefined;
  const value = (holder as { value?: unknown }).value;
  return typeof value === "string" ? value : undefined;
}

/** A node in a `class={...}` expression, read structurally. */
interface ExpressionNode {
  readonly type?: string;
  readonly value?: unknown;
  readonly key?: unknown;
  readonly name?: unknown;
  readonly expression?: unknown;
  readonly properties?: readonly unknown[];
  readonly elements?: readonly unknown[];
  readonly test?: unknown;
  readonly consequent?: unknown;
  readonly alternate?: unknown;
  readonly operator?: unknown;
  readonly left?: unknown;
  readonly right?: unknown;
  readonly argument?: unknown;
  readonly object?: unknown;
  readonly property?: unknown;
  readonly computed?: unknown;
  readonly optional?: unknown;
  readonly callee?: unknown;
  readonly arguments?: readonly unknown[];
  readonly quasis?: readonly {
    readonly value?: { readonly cooked?: unknown };
  }[];
  readonly expressions?: readonly unknown[];
}


/** The cooked text of a template literal's static parts. */
function expressionTemplateText(node: ExpressionNode): string {
  const quasis = node.quasis ?? [];
  return quasis
    .map((quasi, index) => {
      const cooked = quasi.value?.cooked;
      if (typeof cooked !== "string") return "";
      // A non-tail quasi ending in `-` is a prefix awaiting its suffix:
      // `` `bg-${tone}` `` names no class until the tone arrives, and the
      // `bg-` it leaves behind is a fragment, not a utility. Drop it.
      if (index < quasis.length - 1 && cooked.endsWith("-")) return "";
      return cooked;
    })
    .join(" ");
}


/**
 * The static class tokens a class attribute names, however it spells them.
 *
 * A plain `class="..."` is its own string. A `class={[...]}` array, a
 * `class={{ ... }}` object, a conditional or a template names its utilities
 * in the literals it holds — so those are read too.
 */
function expressionClasses(node: GateNode): string[] {
  return expressionBranches(node).all;
}

/**
 * The classes a class attribute names, split into resting and conditional.
 *
 * Top-level strings and array elements are resting; object keys (unless
 * guarded by a literal `true`) and ternary arms are each their own branch.
 * The closed-vocabulary check reads `all`; the semantic checks read resting
 * (conditional states are the `focus:`-style prefixes' JSX analogue —
 * mutually exclusive with resting, never colliding with it).
 */
function expressionBranches(
  node: GateNode,
): { resting: string[]; conditional: string[][]; all: string[] } {
  const direct = attributeValue(node);
  if (direct !== undefined) {
    const resting = classTokens(direct);
    return { resting, conditional: [], all: [...resting] };
  }
  const resting: string[] = [];
  const conditional: string[][] = [];
  branchClasses(node, resting, conditional);
  const seen = new Set<string>();
  const all: string[] = [];
  for (const cls of [...resting, ...conditional.flat()]) {
    if (seen.has(cls)) continue;
    seen.add(cls);
    all.push(cls);
  }
  return { resting, conditional, all };
}

/**
 * The classes a non-string attribute value names.
 *
 * A svelte `class:foo` directive names its class conditionally — the class
 * is worn exactly when the condition holds. A svelte value list mixes
 * literal parts (resting) with mustache expressions (read as branches).
 * A vue `:class` holds the same ESTree expression a JSX container holds,
 * under its own container name.
 */
function branchClasses(
  node: GateNode,
  resting: string[],
  conditional: string[][],
): void {
  if (node.type === "SvelteDirective") {
    const name = directiveClass(node);
    if (name !== undefined) conditional.push([name]);
    return;
  }
  const holder = node.value;
  if (Array.isArray(holder)) {
    for (const part of holder) {
      if (typeof part !== "object" || part === null) continue;
      const node = part as ExpressionNode & { value?: unknown };
      if (node.type === "SvelteLiteral" && typeof node.value === "string") {
        resting.push(...classTokens(node.value));
        continue;
      }
      if (node.type === "SvelteMustacheTag") {
        collectExpressionBranches(node.expression, resting, conditional, false);
      }
    }
    return;
  }
  if (typeof holder !== "object" || holder === null) return;
  const container = holder as ExpressionNode;
  if (
    container.type !== "JSXExpressionContainer" &&
    container.type !== "VExpressionContainer"
  ) {
    return;
  }
  collectExpressionBranches(container.expression, resting, conditional, true);
}

/** The class a svelte `class:foo` directive toggles. */
function directiveClass(node: GateNode): string | undefined {
  const key = (node as GateNode & { key?: unknown }).key as
    | { name?: unknown }
    | undefined;
  const name = key?.name;
  if (typeof name === "string") return name;
  if (typeof name === "object" && name !== null && "name" in name) {
    const inner = (name as { name?: unknown }).name;
    return typeof inner === "string" ? inner : undefined;
  }
  return undefined;
}

/** Structural identity of a pure guard expression so co-guarded branches merge. */
function guardKeyOf(node: unknown): string | undefined {
  if (typeof node !== "object" || node === null) return undefined;
  const v = node as ExpressionNode;
  switch (v.type) {
    case "Identifier":
      return typeof v.name === "string" ? `id:${v.name}` : undefined;
    case "Literal":
      return typeof v.value === "string" || typeof v.value === "number" || typeof v.value === "boolean"
        ? `lit:${typeof v.value}:${String(v.value)}`
        : undefined;
    case "UnaryExpression": {
      if (typeof v.operator !== "string") return undefined;
      const arg = guardKeyOf(v.argument);
      if (arg === undefined) return undefined;
      return v.operator === "!" ? negateGuardKey(arg) : `un:${v.operator}:${arg}`;
    }
    case "BinaryExpression":
    case "LogicalExpression": {
      if (typeof v.operator !== "string") return undefined;
      const left = guardKeyOf(v.left);
      const right = guardKeyOf(v.right);
      if (left === undefined || right === undefined) return undefined;
      return `bin:${v.operator}:(${left},${right})`;
    }
    case "MemberExpression": {
      const obj = guardKeyOf(v.object);
      const prop = guardKeyOf(v.property);
      if (obj === undefined || prop === undefined) return undefined;
      const sep = v.optional === true ? "?." : ".";
      return v.computed === true ? `mem:${obj}${sep}[${prop}]` : `mem:${obj}${sep}${prop}`;
    }
    case "CallExpression": {
      const callee = guardKeyOf(v.callee);
      if (callee === undefined) return undefined;
      const args: string[] = [];
      for (const arg of v.arguments ?? []) {
        const k = guardKeyOf(arg);
        if (k === undefined) return undefined;
        args.push(k);
      }
      return `call:${callee}(${args.join(",")})`;
    }
    case "ChainExpression":
    case "ParenthesizedExpression":
    case "TSAsExpression":
    case "TSSatisfiesExpression":
    case "TSNonNullExpression":
      return guardKeyOf(v.expression);
    default:
      return undefined;
  }
}

function negateGuardKey(key: string | undefined): string | undefined {
  if (key === undefined) return undefined;
  return key.startsWith("un:!:") ? key.slice(5) : `un:!:${key}`;
}

function pushGuardedBranch(
  conditional: string[][],
  guarded: Map<string, string[]>,
  key: string | undefined,
  branch: string[],
): void {
  if (branch.length === 0) return;
  if (key === undefined) {
    conditional.push(branch);
    return;
  }
  const existing = guarded.get(key);
  if (existing !== undefined) {
    existing.push(...branch);
    return;
  }
  conditional.push(branch);
  guarded.set(key, branch);
}

/**
 * A `class={...}` expression's branches.
 *
 * Structural, the way `expressionTokens` reads: string positions name
 * resting classes, object keys and ternary arms name branches. `top` only
 * decides whether a bare `{...}` unwraps (an attribute holding an object
 * directly) — nested objects are always branches.
 */
export function collectExpressionBranches(
  node: unknown,
  resting: string[],
  conditional: string[][],
  top: boolean,
  guarded = new Map<string, string[]>(),
): void {
  if (typeof node !== "object" || node === null) return;
  const value = node as ExpressionNode;
  switch (value.type) {
    case "Literal": {
      if (typeof value.value === "string") {
        for (const cls of classTokens(value.value)) resting.push(cls);
      }
      return;
    }
    case "TemplateLiteral": {
      for (const cls of classTokens(expressionTemplateText(value))) {
        resting.push(cls);
      }
      for (const expr of value.expressions ?? []) {
        collectExpressionBranches(expr, resting, conditional, false, guarded);
      }
      return;
    }
    case "ArrayExpression": {
      for (const element of value.elements ?? []) {
        collectExpressionBranches(element, resting, conditional, false, guarded);
      }
      return;
    }
    case "ObjectExpression": {
      for (const property of value.properties ?? []) {
        if (typeof property !== "object" || property === null) continue;
        const prop = property as ExpressionNode;
        if (prop.type === "SpreadElement") continue;
        const branch: string[] = [];
        collectExpressionInto(prop.key, branch);
        if (branch.length === 0) continue;
        if (
          typeof prop.value === "object" && prop.value !== null &&
          (prop.value as ExpressionNode).type === "Literal" &&
          (prop.value as ExpressionNode).value === true
        ) {
          resting.push(...branch);
        } else {
          pushGuardedBranch(conditional, guarded, guardKeyOf(prop.value), branch);
        }
      }
      return;
    }
    case "Property": {
      if (top) {
        collectExpressionBranches(value.value, resting, conditional, false, guarded);
        return;
      }
      const branch: string[] = [];
      collectExpressionInto(value.key, branch);
      pushGuardedBranch(conditional, guarded, guardKeyOf(value.value), branch);
      return;
    }
    case "ConditionalExpression": {
      const testKey = guardKeyOf(value.test);
      const consequent: string[] = [];
      collectExpressionInto(value.consequent, consequent);
      pushGuardedBranch(conditional, guarded, testKey, consequent);
      const alternate: string[] = [];
      collectExpressionInto(value.alternate, alternate);
      pushGuardedBranch(conditional, guarded, negateGuardKey(testKey), alternate);
      return;
    }
    case "LogicalExpression": {
      collectExpressionBranches(value.left, resting, conditional, top, guarded);
      collectExpressionBranches(value.right, resting, conditional, top, guarded);
      return;
    }
    case "ParenthesizedExpression":
    case "TSAsExpression":
    case "TSSatisfiesExpression":
    case "TSNonNullExpression": {
      collectExpressionBranches(value.expression, resting, conditional, top, guarded);
      return;
    }
    default:
      return;
  }
}

/** The classes an arm or value position names, without branch splitting. */
function collectExpressionInto(node: unknown, out: string[]): void {
  if (typeof node !== "object" || node === null) return;
  const value = node as ExpressionNode;
  switch (value.type) {
    case "Literal": {
      if (typeof value.value === "string") {
        for (const cls of classTokens(value.value)) out.push(cls);
      }
      return;
    }
    case "TemplateLiteral": {
      for (const cls of classTokens(expressionTemplateText(value))) {
        out.push(cls);
      }
      return;
    }
    case "ArrayExpression": {
      for (const element of value.elements ?? []) {
        collectExpressionInto(element, out);
      }
      return;
    }
    case "ObjectExpression": {
      for (const property of value.properties ?? []) {
        collectExpressionInto(property, out);
      }
      return;
    }
    case "Property": {
      collectExpressionInto(value.key, out);
      return;
    }
    case "ConditionalExpression": {
      collectExpressionInto(value.consequent, out);
      collectExpressionInto(value.alternate, out);
      return;
    }
    case "LogicalExpression": {
      collectExpressionInto(value.left, out);
      collectExpressionInto(value.right, out);
      return;
    }
    case "ParenthesizedExpression":
    case "TSAsExpression":
    case "TSSatisfiesExpression":
    case "TSNonNullExpression": {
      collectExpressionInto(value.expression, out);
      return;
    }
    default:
      return;
  }
}

/**
 * The string a literal carries, and where its content starts.
 *
 * A fix has to say WHICH text to remove, and the offsets are the only thing
 * that says so. A JSX or vue literal's range covers its quotes, so the
 * content starts one character after the literal does; an html or svelte
 * literal's range covers the content itself.
 */
function literalOf(
  node: GateNode,
): { text: string; start: number } | undefined {
  const raw = node.value;
  if (Array.isArray(raw)) return svelteLiteralOf(raw);
  const holder = raw as
    | {
      type?: string;
      value?: unknown;
      range?: readonly [number, number];
      expression?: unknown;
    }
    | undefined;
  if (holder === undefined || holder === null) return undefined;
  let literal = holder;
  if (
    holder.type === "JSXExpressionContainer" ||
    holder.type === "VExpressionContainer"
  ) {
    const expression = holder.expression as
      | { type?: string; value?: unknown; range?: readonly [number, number] }
      | undefined;
    if (expression === undefined || expression.type !== "Literal") {
      return undefined;
    }
    literal = expression;
  }
  if (
    literal.type !== "Literal" &&
    literal.type !== "VLiteral" &&
    literal.type !== "AttributeValue"
  ) {
    return undefined;
  }
  if (typeof literal.value !== "string") return undefined;
  const range = literal.range;
  if (range === undefined) return undefined;
  const start = literal.type === "AttributeValue" ? range[0] : range[0] + 1;
  return { text: literal.value, start };
}

/** The string a lone svelte literal part carries, and where its content starts. */
function svelteLiteralOf(
  parts: readonly unknown[],
): { text: string; start: number } | undefined {
  if (parts.length !== 1) return undefined;
  const part = parts[0] as
    | { type?: string; value?: unknown; range?: readonly [number, number] }
    | undefined;
  if (part?.type !== "SvelteLiteral") return undefined;
  if (typeof part.value !== "string") return undefined;
  const range = part.range;
  if (range === undefined) return undefined;
  return { text: part.value, start: range[0] };
}

/**
 * The classes of an element, and where each one sits.
 *
 * The offsets are the class's own text in the source, and the spaces say
 * whether the class is touched by one — which is what a fix needs to leave
 * the list reading as it did.
 */
function tokensOf(
  text: string,
  start: number,
): {
  name: string;
  range: [number, number];
  spaceBefore: boolean;
  spaceAfter: boolean;
}[] {
  const out: {
    name: string;
    range: [number, number];
    spaceBefore: boolean;
    spaceAfter: boolean;
  }[] = [];
  for (const match of text.matchAll(/\S+/g)) {
    const from = match.index;
    const to = from + match[0].length;
    out.push({
      name: match[0],
      range: [start + from, start + to],
      spaceBefore: from > 0 && /\s/.test(text[from - 1] as string),
      spaceAfter: to < text.length && /\s/.test(text[to] as string),
    });
  }
  return out;
}

/** Where a node sits, for the finding that names it. */
function positionOf(node: GateNode) {
  return {
    line: node.loc?.start.line ?? 0,
    column: node.loc?.start.column ?? 0,
  };
}

/** Static tokens carried by sibling `variant` (and `class` when on `classList`). */
function siblingContextClasses(node: GateNode, facts?: Facts): string[] {
  const holder = node.parent;
  if (holder === undefined || holder === null) return [];
  const siblings: unknown = (holder as GateNode & { attributes?: unknown }).attributes;
  if (!Array.isArray(siblings)) return [];
  const selfName = attrName(node);
  const tag = tagOf(node);
  const out: string[] = [];
  for (const sibling of siblings) {
    if (sibling === node) continue;
    const name = attrName(sibling);
    if (name === "variant") {
      const val = attributeValue(sibling as GateNode);
      if (val === undefined) continue;
      for (const token of classTokens(val)) {
        if (facts === undefined || facts.variants.has(token)) {
          out.push(token);
        } else if (tag !== undefined && facts.variants.has(`${tag}-${token}`)) {
          out.push(`${tag}-${token}`);
        }
      }
      continue;
    }
    if (selfName === "classList" && (name === "class" || name === "className")) {
      const sibBranches = expressionBranches(sibling as GateNode);
      out.push(...sibBranches.resting);
    }
  }
  return out;
}

/** Dynamic class prefix interpolations (e.g. ``class={`bg-${tone}`}``). */
function dynamicPrefixInterpolations(node: GateNode): string[] {
  const out: string[] = [];
  const visit = (cur: unknown): void => {
    if (Array.isArray(cur)) {
      for (const part of cur) visit(part);
      return;
    }
    if (typeof cur !== "object" || cur === null) return;
    const expr = cur as ExpressionNode;
    if (
      expr.type === "JSXExpressionContainer" ||
      expr.type === "VExpressionContainer" ||
      expr.type === "SvelteMustacheTag"
    ) {
      visit(expr.expression);
      return;
    }
    if (expr.type === "TemplateLiteral") {
      const quasis = expr.quasis ?? [];
      for (let i = 0; i < quasis.length - 1; i++) {
        const cooked = quasis[i]?.value?.cooked;
        if (typeof cooked !== "string") continue;
        const m = /([a-zA-Z0-9_:-]+-)$/.exec(cooked);
        if (m !== null) out.push(`${m[1] as string}\${…}`);
      }
      for (const sub of expr.expressions ?? []) visit(sub);
      return;
    }
    for (const sub of [
      expr.expression,
      expr.consequent,
      expr.alternate,
      expr.left,
      expr.right,
      ...(expr.elements ?? []),
      ...(expr.properties ?? []),
    ]) {
      visit(sub);
    }
  };
  visit(node.value);
  return out;
}

/** The classes of an element, as the core reads them. */
function classFacts(node: GateNode, facts?: Facts, sourceText?: string) {
  const literal = literalOf(node);
  const branches = expressionBranches(node);
  const siblingResting = siblingContextClasses(node, facts);
  let attributeRange: readonly [number, number] | undefined;
  if (literal !== undefined && node.range !== undefined) {
    const [attrStart, attrEnd] = node.range;
    const leadingSpace = attrStart > 0 && sourceText !== undefined &&
      /\s/.test(sourceText[attrStart - 1] ?? "");
    attributeRange = [leadingSpace ? attrStart - 1 : attrStart, attrEnd];
  }
  return {
    tag: tagOf(node),
    classes: branches.all,
    ownClasses: new Set(branches.all),
    resting: [...siblingResting, ...branches.resting],
    conditional: branches.conditional,
    tokens: literal === undefined
      ? undefined
      : tokensOf(literal.text, literal.start),
    attributeRange,
    ancestors: ancestorsOf(node),
    position: positionOf(node),
  };
}

type FactsNode = ReturnType<typeof classFacts>;

/** The core's view of an element wearing its resting classes (including sibling `variant` and `class`). */
function restingFacts(base: FactsNode): FactsNode {
  return { ...base, classes: base.resting };
}

/** Filter findings to classes owned by this attribute node. */
function filterOwnFindings(base: FactsNode, findings: readonly Finding[]): Finding[] {
  return findings.filter((finding) => {
    const cls = finding.data["cls"];
    return cls === undefined || base.ownClasses.has(cls);
  });
}

/** Run a check across resting and each conditional branch, deduplicated. */
function checkAcrossBranches(
  base: FactsNode,
  check: (node: FactsNode) => Finding[],
): Finding[] {
  const seen = new Set<string>();
  const out: Finding[] = [];
  const branches = [
    base.resting,
    ...base.conditional.map((branch) => [...base.resting, ...branch]),
  ];
  for (const branch of branches) {
    for (const finding of filterOwnFindings(base, check({ ...base, classes: branch }))) {
      const key = `${finding.messageId}:${JSON.stringify(finding.data)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(finding);
    }
  }
  return out;
}

function carriesClasses(node: GateNode): boolean {
  return (
    isClassAttribute(node) &&
    (expressionClasses(node).length > 0 || dynamicPrefixInterpolations(node).length > 0)
  );
}

/**
 * The class list an attribute carries, and where its own text sits.
 *
 * The range is what a formatter needs: to write the classes in another
 * order, it has to say WHICH text it replaces. A class list the author
 * computed is not one — the text is theirs, and rewriting it would rewrite
 * their arithmetic.
 */
export function classListOf(
  node: GateNode,
): { classes: string[]; range: [number, number] } | undefined {
  if (!carriesClasses(node)) return undefined;
  const literal = literalOf(node);
  if (literal === undefined) return undefined;
  return {
    classes: classTokens(literal.text),
    range: [literal.start, literal.start + literal.text.length],
  };
}

/* ------------------------------------------------------------ the markup -- */

/**
 * The attributes whose value the document reads as markup.
 *
 * `class` and `className` carry the utilities, `style` carries the
 * declarations, and the raw-HTML attributes carry markup as markup. What
 * the four share is that the browser reads their value as the document's
 * own text — so a custom property written into one of them is authored
 * markup, and the rule has something to say about it.
 *
 * An attribute that carries data — `title`, `aria-label`, `id` — is not one
 * of these: a word in it is a word, not a decision about how the element
 * looks, and a rule that read it as one would report the author's prose.
 */
const MARKUP_ATTRIBUTES: ReadonlySet<string> = new Set([
  "class",
  "className",
  "style",
  "innerHTML",
  "dangerouslySetInnerHTML",
]);

/**
 * Whether an attribute's value is markup.
 *
 * The attribute's name is what decides it: the same string in two
 * attributes is two different things, and only one of them reaches the
 * document as markup.
 */
function carriesMarkup(node: GateNode): boolean {
  const name = attrName(node);
  return name !== undefined && MARKUP_ATTRIBUTES.has(name);
}

/**
 * A node, with the fields the markup walk reads.
 *
 * The walk reads the value positions of an expression — what a value is
 * made of — and nothing else, so the fields are named one by one rather
 * than the node being typed as `any`.
 */
interface MarkupNode extends GateNode {
  readonly expression?: unknown;
  readonly expressions?: readonly unknown[];
  readonly quasis?: readonly {
    readonly value?: { readonly cooked?: unknown };
  }[];
  readonly properties?: readonly unknown[];
  readonly elements?: readonly unknown[];
  readonly consequent?: unknown;
  readonly alternate?: unknown;
  readonly left?: unknown;
  readonly right?: unknown;
  readonly argument?: unknown;
}

/** A string in a markup position, and the node that holds it. */
interface MarkupText {
  readonly node: GateNode;
  readonly text: string;
}

/**
 * The text a template literal spells.
 *
 * The quasis are the parts the author wrote; the expressions are the parts
 * they computed. Reading the quasis alone is what tells a hand-written
 * token from a computed one: `var(--color-text)` is written out, and
 * `var(${name})` is not — it names whatever the expression turns out to be.
 */
function templateText(node: MarkupNode): string {
  return (node.quasis ?? [])
    .map((quasi) => {
      const cooked = quasi.value?.cooked;
      return typeof cooked === "string" ? cooked : "";
    })
    .join("");
}

/**
 * The strings a markup value carries.
 *
 * A value position is a place where a string IS the markup: the
 * expression of an attribute, a property of an object, an element of an
 * array, a branch of a conditional. A call's arguments are not one — they
 * are code, and what a call does with a string is the call's own business,
 * so a token named in an argument is not markup the rule has read.
 */
function markupStrings(node: unknown, out: MarkupText[]): void {
  if (Array.isArray(node)) {
    for (const part of node) markupStrings(part, out);
    return;
  }
  if (typeof node !== "object" || node === null) return;
  const value = node as MarkupNode;
  switch (value.type) {
    case "Literal":
    case "VLiteral":
    case "SvelteLiteral":
    case "AttributeValue": {
      const text = literalValue(value);
      if (text !== undefined) out.push({ node: value, text });
      return;
    }
    case "TemplateLiteral": {
      out.push({ node: value, text: templateText(value) });
      for (const expression of value.expressions ?? []) {
        markupStrings(expression, out);
      }
      return;
    }
    case "JSXExpressionContainer":
    case "VExpressionContainer":
    case "SvelteMustacheTag":
      markupStrings(value.expression, out);
      return;
    case "ObjectExpression":
      for (const property of value.properties ?? []) {
        markupStrings(property, out);
      }
      return;
    case "Property":
      markupStrings(value.value, out);
      return;
    case "ArrayExpression":
      for (const element of value.elements ?? []) {
        markupStrings(element, out);
      }
      return;
    case "ConditionalExpression":
      markupStrings(value.consequent, out);
      markupStrings(value.alternate, out);
      return;
    case "LogicalExpression":
      markupStrings(value.left, out);
      markupStrings(value.right, out);
      return;
    case "SpreadElement":
      markupStrings(value.argument, out);
      return;
    default:
      return;
  }
}

/** The string a literal carries, when it is one. */
function literalValue(node: GateNode): string | undefined {
  return typeof node.value === "string" ? node.value : undefined;
}

/** Report what the core found, at the node that caused it. */
function report(
  context: GateContext,
  node: GateNode,
  findings: readonly (Finding & { severity?: "error" | "warning" })[],
): void {
  for (const finding of findings) {
    const edit = finding.fix;
    context.report({
      node,
      messageId: finding.messageId,
      data: finding.data,
      ...(finding.remedy === undefined ? {} : { remedy: finding.remedy }),
      ...(finding.severity === undefined ? {} : { severity: finding.severity }),
      ...(edit === undefined ? {} : {
        fix: () => ({ range: edit.range, text: edit.text }),
      }),
    });
  }
}

/* ------------------------------------------------------------ the options -- */

const STRICTNESS: readonly Strictness[] = ["strict", "balanced", "lenient"];
const SEMANTIC_TAGS: readonly SemanticTags[] = [
  "all",
  "native",
  "spin",
  "none",
];

/** The one of `allowed` a value is, if it is one of them. */
function oneOf<T extends string>(
  value: unknown,
  allowed: readonly T[],
): T | undefined {
  return allowed.find((candidate) => candidate === value);
}

/**
 * The dial the semantic rules read, from the configuration.
 *
 * The options arrive the way every linter delivers them: as the rule's
 * first option, in `context.options`. The first option is the object the
 * dials live in, so `{ strictness, semanticTags }` is what a
 * configuration writes.
 */
export function semanticOptions(context: GateContext): SemanticOptions {
  const raw = (context.options?.[0] ?? {}) as {
    strictness?: unknown;
    semanticTags?: unknown;
  };
  return {
    strictness: oneOf(raw.strictness, STRICTNESS) ??
      DEFAULT_SEMANTIC_OPTIONS.strictness,
    semanticTags: oneOf(raw.semanticTags, SEMANTIC_TAGS) ??
      DEFAULT_SEMANTIC_OPTIONS.semanticTags,
  };
}

/** The options the semantic rules accept. */
const SEMANTIC_SCHEMA: GateSchema[] = [
  {
    type: "object",
    properties: {
      strictness: {
        enum: [...STRICTNESS],
        description:
          "Which tiers count as painting over the element's own decision.",
      },
      semanticTags: {
        enum: [...SEMANTIC_TAGS],
        description:
          "Which tags the rules treat as semantic: native elements, spin's own, both, or neither.",
      },
    },
    additionalProperties: false,
  },
];

/* -------------------------------------------------------------- the rules -- */

/**
 * The attribute visitor, under every parser's node type.
 *
 * One handler reads class attributes however they are spelled: JSX, vue
 * (`VAttribute`, bound or plain), svelte (`SvelteAttribute` and the
 * `class:` directive), and html-eslint (`Attribute`). A parser only walks
 * the types it emits, so each rule answers under its own parser and stays
 * silent under the rest.
 */
function classAttributeVisitors(
  visit: (node: GateNode) => void,
): Record<string, (node: GateNode) => void> {
  const out: Record<string, (node: GateNode) => void> = {};
  for (
    const type of [
      "JSXAttribute",
      "VAttribute",
      "SvelteAttribute",
      "SvelteDirective",
      "Attribute",
    ]
  ) {
    out[type] = visit;
  }
  return out;
}

/**
 * The visitors, routed through the template traversal when one owns the file.
 *
 * The vue parser keeps its template off the keys ESLint core walks, so a
 * template visitor registered plainly never fires. Its parser service
 * hands back a visitor that walks the template instead; every other host
 * — oxlint, the engine's own walk, any other parser — reads the visitors
 * as they are.
 */
function routedVisitors(
  context: GateContext,
  visitors: Record<string, (node: GateNode) => void>,
): Record<string, (node: GateNode) => void> {
  const define = context.sourceCode?.parserServices?.defineTemplateBodyVisitor;
  if (typeof define !== "function") return visitors;
  return define(visitors);
}

/**
 * Disallow a class that says what the element already says.
 *
 * Dead weight: the class sets a property the element sets too, and it sets
 * it to the value the element already has. It changes nothing, so it can be
 * dropped — and the rule drops it.
 */
const noRedundantClass: GateRule = {
  meta: {
    type: "problem",
    fixable: "code",
    docs: {
      description:
        "Disallow a class that sets what the element already sets, and drop it.",
    },
    schema: SEMANTIC_SCHEMA,
    messages: {
      redundant:
        "`{{cls}}` sets `{{properties}}` to what `<{{tag}}>` already sets. Drop the class.",
    },
  },
  create(context) {
    const options = semanticOptions(context);
    const visit = (node: GateNode) => {
      if (!carriesClasses(node)) return;
      const facts = factsForFile(context.filename ?? "", context.answers);
      const base = classFacts(node, facts, context.sourceCode?.text);
      report(
        context,
        node,
        filterOwnFindings(base, checkNoRedundantClass(facts, restingFacts(base), options)),
      );
    };
    return routedVisitors(context, classAttributeVisitors(visit));
  },
};

/**
 * Disallow a class that says something else where the theme has already
 * said.
 *
 * The element owns the decision — the theme's own answer for how it looks —
 * and the class says a different one. That is a second opinion about a
 * decision the system owns, and a one-off override is banned: the theme is
 * where decisions recur, so a class that fights it is a decision that will
 * not. There is no edit for it: what the author meant is a question only
 * the author can answer.
 *
 * The message says who owns the decision and what to write instead — the
 * theme's value, or the variant the element declares. It does not hedge: a
 * second opinion is not a question.
 */
const preferThemeValue: GateRule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow a class that overrides a decision the theme already made for the element.",
    },
    schema: SEMANTIC_SCHEMA,
    messages: {
      override: "{{claim}}; `{{cls}}` fights it. {{remedy}}",
    },
  },
  create(context) {
    const options = semanticOptions(context);
    const visit = (node: GateNode) => {
      if (!carriesClasses(node)) return;
      const facts = factsForFile(context.filename ?? "", context.answers);
      const base = classFacts(node, facts, context.sourceCode?.text);
      const restingFindings = filterOwnFindings(
        base,
        checkPreferThemeValue(facts, restingFacts(base), options),
      );
      const clashFindings = checkAcrossBranches(base, (probe) =>
        checkTypeStyleClashes(facts, probe, base.resting),
      );
      const seen = new Set(
        restingFindings.map((f) => `${f.messageId}:${JSON.stringify(f.data)}`),
      );
      for (const clash of clashFindings) {
        const key = `${clash.messageId}:${JSON.stringify(clash.data)}`;
        if (!seen.has(key)) restingFindings.push(clash);
      }
      report(context, node, restingFindings);
    };
    return routedVisitors(context, classAttributeVisitors(visit));
  },
};

/**
 * Disallow a class that reaches for a decision the theme gave another
 * element.
 *
 * The theme gave the size to the heading and the fill to the button; a
 * class that carries that decision on an element the theme does not type is
 * the markup asking for something the theme already answered elsewhere.
 *
 * Advisory throughout: a single typographic carrier names the element
 * directly (`single`); multi-carrier or ink matches offer the element or
 * dropping the class (`element`). Inline text stays silent: a span inside
 * prose is already typed by the column, so there is no reach.
 */
const preferElement: GateRule = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow a class that reaches for a decision the theme gave another element.",
    },
    schema: SEMANTIC_SCHEMA,
    messages: {
      single:
        "the theme gives `<{{element}}>` that {{decision}}; `<{{tag}}>` is not the element that carries it. Put the class on `<{{element}}>`.",
      element:
        "the theme gives `<{{element}}>` that {{decision}}; `<{{tag}}>` is not the element that carries it.",
    },
  },
  create(context) {
    const options = semanticOptions(context);
    const visit = (node: GateNode) => {
      if (!carriesClasses(node)) return;
      const facts = factsForFile(context.filename ?? "", context.answers);
      const base = classFacts(node, facts, context.sourceCode?.text);
      report(
        context,
        node,
        filterOwnFindings(base, checkPreferElement(facts, restingFacts(base), options)),
      );
    };
    return routedVisitors(context, classAttributeVisitors(visit));
  },
};

/**
 * Disallow classes the project's own theme cannot produce.
 *
  * The vocabulary is the project's theme, catalogued, unioned with the
  * languages — so a class the theme can produce is known, and a class nothing
 * produces is not. A class nothing produces styles nothing, so dropping it
 * changes nothing: the rule drops it.
 */
const closedVocabulary: GateRule = {
  meta: {
    type: "problem",
    fixable: "code",
    docs: {
      description:
        "Disallow classes the project's theme cannot generate, and drop them.",
    },
    schema: [],
    messages: {
      unknown:
        "`{{cls}}` is not in the spin vocabulary and generates no CSS. Use a token, or drop it.",
      shortcut:
        "`{{shortcut}}` expands to `{{cls}}`, which the theme cannot produce. The shortcut would style nothing.",
    },
  },
  create(context) {
    const visit = (node: GateNode) => {
      if (!carriesClasses(node)) return;
      const facts = factsForFile(context.filename ?? "", context.answers);
      const base = classFacts(node, facts, context.sourceCode?.text);
      const findings = checkClosedVocabulary(facts, base);
      for (const interpolated of dynamicPrefixInterpolations(node)) {
        findings.push({
          messageId: "unknown",
          data: { cls: interpolated },
          position: base.position,
          remedy:
            "Spell full class names in static branches (`cond ? \"bg-primary\" : \"bg-surface\"`) so UnoCSS can extract them.",
        });
      }
      report(context, node, findings);
    };
    return routedVisitors(context, classAttributeVisitors(visit));
  },
};

/**
 * Disallow a component naming a token by hand.
 *
 * A custom property is generated output, never an interface. When a
 * component spends a token it reads the theme the generator already
 * injected, so a renamed token cannot leave it pointing at nothing and a
 * literal string cannot sit in the source where nothing checks it.
 *
 * The rule reads AUTHORED MARKUP, and only that: the attributes the
 * document reads as markup — a class list, a style declaration — and the
 * strings they hold. A stylesheet a package generates is not authored
 * markup: the theme's own CSS, the preset's rules and the animation
 * layer's keyframes all name the custom properties they spend, because
 * that is what generated output looks like. Reporting those would report
 * the system's own plumbing, and the finding would be about the generator
 * rather than about the author.
 */
const noHandwrittenTokens: GateRule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow a custom property written by hand in authored markup; spend the theme instead.",
    },
    schema: [],
    messages: {
      handwritten:
        "`var(--{{token}})` is generated output, not an API. Read the theme's token `{{path}}`, not its variable.",
      styleTag:
        "`<style>` blocks bypass the theme. Declare tokens in `spin/<brand>/` and apply utilities instead.",
      inlineStyle:
        "Inline `style` property `{{property}}` bypasses the theme. Spend a theme utility instead.",
    },
  },
  create(context) {
    // The theme-owned properties, in the oracle's one kebab-case spelling:
    // a camelCase key decamelizes at the boundary, so `backgroundColor`
    // reads as `background-color`.
    const hasThemeProp = (propName: string): boolean =>
      THEME_STYLE_PROPERTIES.has(propName.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`));
    const onElement = (node: GateNode) => {
      if (elementName(node) !== "style") return;
      const holder = node as GateNode & { attributes?: unknown; startTag?: unknown };
      const start = holder.startTag as GateNode & { attributes?: unknown } | undefined;
      const siblings: unknown = holder.attributes ?? start?.attributes;
      if (
        Array.isArray(siblings) &&
        siblings.some((s) => attrName(s) === "id")
      ) {
        return;
      }
      report(context, node, [
        {
          messageId: "styleTag",
          data: {},
          position: positionOf(node),
          remedy: "Move styles into theme tokens or utility classes.",
        },
      ]);
    };
    const onAttribute = (node: GateNode) => {
      if (!carriesMarkup(node)) return;
      if (attrName(node) === "style") {
        const holder = node.value as ExpressionNode | undefined;
        const expr =
          holder?.type === "JSXExpressionContainer" ||
            holder?.type === "VExpressionContainer"
            ? (holder.expression as ExpressionNode | undefined)
            : undefined;
        if (expr?.type === "ObjectExpression") {
          for (const prop of expr.properties ?? []) {
            if (typeof prop !== "object" || prop === null) continue;
            const p = prop as ExpressionNode;
            if (p.type !== "Property") continue;
            const keyNode = p.key as { name?: unknown; value?: unknown } | undefined;
            const propName =
              typeof keyNode?.name === "string"
                ? keyNode.name
                : typeof keyNode?.value === "string"
                  ? keyNode.value
                  : undefined;
            const valNode = p.value as ExpressionNode | undefined;
            if (
              propName !== undefined &&
              hasThemeProp(propName) &&
              valNode?.type === "Literal" &&
              (typeof valNode.value === "string" || typeof valNode.value === "number")
            ) {
              report(context, node, [
                {
                  messageId: "inlineStyle",
                  data: { property: propName },
                  position: positionOf(node),
                  remedy: "Replace inline theme values with Spin utility classes.",
                },
              ]);
            }
          }
        }
      }
      const found: MarkupText[] = [];
      markupStrings(node.value, found);
      if (node.type === "SvelteDirective") {
        markupStrings((node as GateNode & { expression?: unknown }).expression, found);
      }
      if (found.length === 0) return;
      const facts = factsForFile(context.filename ?? "", context.answers);
      for (const { node: at, text } of found) {
        report(
          context,
          at,
          checkNoHandwrittenTokens(facts, {
            text,
            position: positionOf(at),
          }),
        );
      }
    };
    return routedVisitors(context, {
      ...classAttributeVisitors(onAttribute),
      JSXOpeningElement: onElement,
      VElement: onElement,
      SvelteElement: onElement,
      Tag: onElement,
    });
  },
};

/**
 * Disallow an ink the palette does not pair with the fill underneath it.
 *
  * A fill's foreground is a fact of the palette, not a convention a call site
  * invents: the languages pair `bg-primary` with `text-on-primary`. A stated
 * ink against a declared pairing contradicts; a missing ink inherits, which
 * may be exactly right, and a fill the palette gives no ink to is the
 * theme's gap, not the author's. An explicitly unpainted box
 * (`bg-transparent` in the same state) opts out; a surface is the page, not
 * a fill, and stays exempt.
 */
const noUnpairedInk: GateRule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow text ink on a fill the palette pairs with a different ink.",
    },
    schema: [],
    messages: {
      mismatch:
        "`bg-{{fill}}` is paired with `{{expected}}`; `{{ink}}` is a different ink on the same fill.",
    },
  },
  create(context) {
    const visit = (node: GateNode) => {
      if (!carriesClasses(node)) return;
      const facts = factsForFile(context.filename ?? "", context.answers);
      const base = classFacts(node, facts, context.sourceCode?.text);
      report(
        context,
        node,
        checkAcrossBranches(base, (probe) => checkNoUnpairedInk(facts, probe)),
      );
    };
    return routedVisitors(context, classAttributeVisitors(visit));
  },
};

/* ------------------------------------------------------------ the plugin -- */

/**
 * The rules, by name.
 *
 * The names are the rules' public vocabulary: `spin/<name>` in a
 * configuration, whatever the linter calls it.
 */
export const RULES = {
  "no-redundant-class": noRedundantClass,
  "prefer-theme-value": preferThemeValue,
  "prefer-element": preferElement,
  "closed-vocabulary": closedVocabulary,
  "no-handwritten-tokens": noHandwrittenTokens,
  "no-unpaired-ink": noUnpairedInk,
} satisfies Record<string, GateRule>;

/** The name of a rule. */
export type RuleName = keyof typeof RULES;

/** Every rule's name, in the order the plugin declares them. */
export const RULE_NAMES = Object.keys(RULES) as RuleName[];

/**
 * The sentence a finding is reported under.
 *
 * The message is a template; the finding carries the values it
 * interpolates. A linter renders the sentence itself — ESLint does, oxlint
 * does — and so does the CLI, which is why the wording lives here and
 * nowhere else.
 */
export function renderMessage(meta: GateMeta, finding: Finding): string {
  const template = meta.messages[finding.messageId];
  if (template === undefined) return finding.messageId;
  return template.replace(/\{\{([^{}]+?)\}\}/g, (whole, term: string) => {
    const value = finding.data[term.trim()];
    return value ?? whole;
  });
}
