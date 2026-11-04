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
import {
  DEFAULT_SEMANTIC_OPTIONS,
  type Finding,
  type SemanticOptions,
  type SemanticTags,
  type Strictness,
} from "./core.ts";
import { checkNoHandwrittenTokens, checkNoUnpairedInk } from "./pairing.ts";
import { checkNoRedundantClass } from "./no-redundant-class.ts";
import { checkPreferElement } from "./prefer-element.ts";
import { checkPreferThemeValue } from "./prefer-theme-value.ts";
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
  /** The rule's options, as the configuration gave them. */
  options?: unknown[];
  /** Report a finding, at the node that caused it. */
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
     * overrides it. `prefer-element` is the one rule that needs this: a
     * single owner is an error, several owners a suggestion.
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
  const name = node.parent?.name?.name;
  return typeof name === "string" ? name : undefined;
}

function isClassAttribute(node: GateNode): boolean {
  const name = node.name?.name;
  return name === "class" || name === "className";
}

/**
 * The string a JSX attribute carries.
 *
 * An attribute holds a node, and the string it carries is that node's own
 * value — `<div className="flex">` holds a literal, and the literal holds
 * the classes.
 */
function attributeValue(node: GateNode): string | undefined {
  const holder = node.value;
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
  readonly consequent?: unknown;
  readonly alternate?: unknown;
  readonly left?: unknown;
  readonly right?: unknown;
  readonly argument?: unknown;
  readonly quasis?: readonly {
    readonly value?: { readonly cooked?: unknown };
  }[];
  readonly expressions?: readonly unknown[];
}

/**
 * The key text of an object property: the class a `{ "cls": cond }` entry
 * names. Only string literal and identifier keys name classes — a computed
 * key names whatever the expression turns out to be, so it is skipped.
 */
function keyText(key: unknown): string {
  if (typeof key === "object" && key !== null) {
    const node = key as ExpressionNode;
    if (node.type === "Literal" && typeof node.value === "string") {
      return node.value;
    }
    if (node.type === "Identifier" && typeof node.name === "string") {
      return node.name;
    }
  }
  return "";
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
 * The static class tokens a `class={...}` expression names.
 *
 * A dynamic list names its utilities in string literals — the strings, and
 * the object keys whose conditions guard them. A value position is the only
 * thing read: the string of a `Literal`, the static parts of a
 * `TemplateLiteral`, each element of an array, each key of an object, each
 * branch of a conditional. A computed key, a spread, a call's arguments are
 * arithmetic, not classes, so they are skipped.
 */
function expressionTokens(node: unknown, out: string[]): void {
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
      // A template's expressions are conditions, not classes — but a nested
      // object or array inside one still names its own keys and strings.
      for (const expression of value.expressions ?? []) {
        if (
          typeof expression === "object" && expression !== null &&
          ((expression as ExpressionNode).type === "ObjectExpression" ||
            (expression as ExpressionNode).type === "ArrayExpression")
        ) {
          expressionTokens(expression, out);
        }
      }
      return;
    }
    case "ArrayExpression": {
      for (const element of value.elements ?? []) {
        expressionTokens(element, out);
      }
      return;
    }
    case "ObjectExpression": {
      for (const property of value.properties ?? []) {
        if (typeof property !== "object" || property === null) continue;
        const prop = property as ExpressionNode;
        if (prop.type === "SpreadElement") continue;
        const key = keyText(prop.key);
        // The KEY names the class; the value is the boolean condition.
        for (const cls of classTokens(key)) out.push(cls);
      }
      return;
    }
    case "ConditionalExpression": {
      expressionTokens(value.consequent, out);
      expressionTokens(value.alternate, out);
      return;
    }
    case "LogicalExpression": {
      expressionTokens(value.left, out);
      expressionTokens(value.right, out);
      return;
    }
    default:
      return;
  }
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
  const holder = node.value as ExpressionNode | undefined;
  if (holder === undefined || holder === null) {
    return { resting: [], conditional: [], all: [] };
  }
  if (holder.type !== "JSXExpressionContainer") {
    return { resting: [], conditional: [], all: [] };
  }
  const resting: string[] = [];
  const conditional: string[][] = [];
  collectExpressionBranches(holder.expression, resting, conditional, true);
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
 * A `class={...}` expression's branches.
 *
 * Structural, the way `expressionTokens` reads: string positions name
 * resting classes, object keys and ternary arms name branches. `top` only
 * decides whether a bare `{...}` unwraps (an attribute holding an object
 * directly) — nested objects are always branches.
 */
function collectExpressionBranches(
  node: unknown,
  resting: string[],
  conditional: string[][],
  top: boolean,
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
      return;
    }
    case "ArrayExpression": {
      for (const element of value.elements ?? []) {
        collectExpressionBranches(element, resting, conditional, false);
      }
      return;
    }
    case "ObjectExpression": {
      if (top) {
        for (const property of value.properties ?? []) {
          collectExpressionBranches(property, resting, conditional, false);
        }
        return;
      }
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
          conditional.push(branch);
        }
      }
      return;
    }
    case "Property": {
      if (top) {
        collectExpressionBranches(value.value, resting, conditional, false);
        return;
      }
      const branch: string[] = [];
      collectExpressionInto(value.key, branch);
      if (branch.length > 0) conditional.push(branch);
      return;
    }
    case "ConditionalExpression": {
      for (const arm of [value.consequent, value.alternate]) {
        const branch: string[] = [];
        collectExpressionInto(arm, branch);
        if (branch.length > 0) conditional.push(branch);
      }
      return;
    }
    case "LogicalExpression": {
      collectExpressionBranches(value.left, resting, conditional, top);
      collectExpressionBranches(value.right, resting, conditional, top);
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
    default:
      return;
  }
}

/**
 * The string a literal carries, and where its content starts.
 *
 * A fix has to say WHICH text to remove, and the offsets are the only thing
 * that says so. The content of a literal starts one character after the
 * literal does: the quote is not part of the class list.
 */
function literalOf(
  node: GateNode,
): { text: string; start: number } | undefined {
  const holder = node.value as
    | {
      type?: string;
      value?: unknown;
      range?: readonly [number, number];
      expression?: unknown;
    }
    | undefined;
  if (holder === undefined || holder === null) return undefined;
  let literal = holder;
  if (holder.type === "JSXExpressionContainer") {
    const expression = holder.expression as
      | { type?: string; value?: unknown; range?: readonly [number, number] }
      | undefined;
    if (expression === undefined || expression.type !== "Literal") {
      return undefined;
    }
    literal = expression;
  }
  if (literal.type !== "Literal") return undefined;
  if (typeof literal.value !== "string") return undefined;
  const range = literal.range;
  if (range === undefined) return undefined;
  return { text: literal.value, start: range[0] + 1 };
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

/** The classes of an element, as the core reads them. */
function classFacts(node: GateNode) {
  const literal = literalOf(node);
  const branches = expressionBranches(node);
  return {
    tag: tagOf(node),
    classes: branches.all,
    resting: branches.resting,
    conditional: branches.conditional,
    // Where each class sits, so a finding that drops one can say which text
    // to remove. A linter that does not give offsets gets the finding
    // without the edit.
    tokens: literal === undefined
      ? undefined
      : tokensOf(literal.text, literal.start),
    // The chain of elements above this one: a primitive that paints a
    // *descendant* (prose's document treatment) only owns what is inside
    // it, and the core cannot know that without the ancestors.
    ancestors: ancestorsOf(node),
    position: positionOf(node),
  };
}

type FactsNode = ReturnType<typeof classFacts>;

/** The core's view of an element wearing only its resting classes. */
function restingFacts(node: FactsNode): FactsNode {
  return { ...node, classes: node.resting };
}

/**
 * Whether an attribute carries classes.
 *
 * Only `class` and `className` do. Every other attribute — `aria-label`,
 * `fill`, `stroke` — is somebody else's vocabulary, and reading it as a
 * class list would report words that were never classes. An attribute that
 * names no static class (a computed key, a bare identifier) carries no
 * list, so it is skipped the same way.
 */
function carriesClasses(node: GateNode): boolean {
  return isClassAttribute(node) && expressionClasses(node).length > 0;
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
  const name = node.name?.name;
  return typeof name === "string" && MARKUP_ATTRIBUTES.has(name);
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
  if (typeof node !== "object" || node === null) return;
  const value = node as MarkupNode;
  switch (value.type) {
    case "Literal": {
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
    return {
      JSXAttribute(node) {
        if (!carriesClasses(node)) return;
        report(
          context,
          node,
          checkNoRedundantClass(
            factsForFile(context.filename ?? ""),
            restingFacts(classFacts(node)),
            options,
          ),
        );
      },
    };
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
    return {
      JSXAttribute(node) {
        if (!carriesClasses(node)) return;
        report(
          context,
          node,
          checkPreferThemeValue(
            factsForFile(context.filename ?? ""),
            restingFacts(classFacts(node)),
            options,
          ),
        );
      },
    };
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
 * The stance is split, and the line is drawn by ownership: exactly one
 * element carrying the value for the text's own decisions (size, typeface,
 * tracking, ink) is an error naming that element; several elements carrying
 * it stay advisory, because which one the author meant is a question the
 * lint cannot answer. Inline text stays silent: a span inside prose is
 * already typed by the column, so there is no reach.
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
      error:
        "the theme gives `<{{element}}>` that {{decision}}; `<{{tag}}>` is not the element that carries it. Put the class on `<{{element}}>`.",
      element:
        "the theme gives `<{{element}}>` that {{decision}}; `<{{tag}}>` is not the element that carries it.",
    },
  },
  create(context) {
    const options = semanticOptions(context);
    return {
      JSXAttribute(node) {
        if (!carriesClasses(node)) return;
        report(
          context,
          node,
          checkPreferElement(
            factsForFile(context.filename ?? ""),
            restingFacts(classFacts(node)),
            options,
          ),
        );
      },
    };
  },
};

/**
 * Disallow classes the project's own theme cannot produce.
 *
 * The vocabulary is the project's theme, catalogued, unioned with the
 * starters — so a class the theme can produce is known, and a class nothing
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
    return {
      JSXAttribute(node) {
        if (!carriesClasses(node)) return;
        report(
          context,
          node,
          checkClosedVocabulary(
            factsForFile(context.filename ?? ""),
            classFacts(node),
          ),
        );
      },
    };
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
    },
  },
  create(context) {
    return {
      JSXAttribute(node) {
        if (!carriesMarkup(node)) return;
        const found: MarkupText[] = [];
        markupStrings(node.value, found);
        if (found.length === 0) return;
        const facts = factsForFile(context.filename ?? "");
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
      },
    };
  },
};

/**
 * Disallow a fill whose ink the palette never named.
 *
 * A fill's foreground is a fact of the palette, not a convention a call site
 * invents: the starters pair `bg-primary` with `text-on-primary` and give a
 * ramp step no foreground at all, because a step does not flip with the mode
 * while body ink does. A filled element with NO ink inherits whatever the
 * page says — legible in one theme and a dark-on-dark box in the next — and
 * it is a non-event to write, which is why a gate has to read it. An
 * explicitly unpainted box (`bg-transparent` in the same state) opts out;
 * a surface is the page, not a fill, and stays exempt.
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
      absence:
        "`bg-{{fill}}` is paired with `{{expected}}`, and no ink on this element names it. Pair `bg-{{fill}}` with `{{expected}}`.",
      undeclared:
        "`bg-{{fill}}` declares no ink, so an element filled with it needs its ink named by hand. Paint a paired fill, or declare the pairing in the theme.",
    },
  },
  create(context) {
    return {
      JSXAttribute(node) {
        if (!carriesClasses(node)) return;
        const facts = factsForFile(context.filename ?? "");
        const seen = new Set<string>();
        const base = classFacts(node);
        const resting = restingFacts(base);
        // A conditional branch is a state the element can be in, not a state
        // it is in beside resting: an object key that only renders under a
        // machine state is read WITH the resting classes, because the fill
        // and the ink arrive together in that state.
        const branches = [
          resting.classes,
          ...base.conditional.map((branch) => [...resting.classes, ...branch]),
        ];
        for (const branch of branches) {
          const probe = { ...resting, classes: branch };
          for (const finding of checkNoUnpairedInk(facts, probe)) {
            const key = `${finding.messageId}:${JSON.stringify(finding.data)}`;
            if (seen.has(key)) continue;
            seen.add(key);
            report(context, node, [finding]);
          }
        }
      },
    };
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
