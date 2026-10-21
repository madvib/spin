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
 * API, and the CLI's own walk. None of the three is named here, and none
 * of them can drift from the others: the rules are shared, not copied.
 */

import {
  checkClosedVocabulary,
  checkNoHandwrittenTokens,
  checkNoRawColors,
  checkNoUnpairedInk,
  checkNoUtilitiesOnSemantic,
  DEFAULT_SEMANTIC_OPTIONS,
  type Finding,
  type SemanticOptions,
  type SemanticTags,
  type Strictness,
} from "./core.ts";
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
  }): void;
}

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
  type: "problem";
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

/** The string a literal carries, when it is one. */
function literalValue(node: GateNode): string | undefined {
  return typeof node.value === "string" ? node.value : undefined;
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
  return {
    tag: tagOf(node),
    classes: classTokens(attributeValue(node) ?? ""),
    // The chain of elements above this one: a primitive that paints a
    // *descendant* (prose's document treatment) only owns what is inside
    // it, and the core cannot know that without the ancestors.
    ancestors: ancestorsOf(node),
    position: positionOf(node),
  };
}

/**
 * Whether an attribute carries classes.
 *
 * Only `class` and `className` do. Every other attribute — `aria-label`,
 * `fill`, `stroke` — is somebody else's vocabulary, and reading it as a
 * class list would report words that were never classes.
 */
function carriesClasses(node: GateNode): boolean {
  return isClassAttribute(node) && attributeValue(node) !== undefined;
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

/** Report what the core found, at the node that caused it. */
function report(
  context: GateContext,
  node: GateNode,
  findings: readonly Finding[],
): void {
  for (const finding of findings) {
    context.report({
      node,
      messageId: finding.messageId,
      data: finding.data,
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
 * The dial the semantic rule reads, from the configuration.
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

/** The options the semantic rule accepts. */
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
          "Which tags the rule treats as semantic: native elements, spin's own, both, or neither.",
      },
    },
    additionalProperties: false,
  },
];

/* -------------------------------------------------------------- the rules -- */

/**
 * Disallow a utility that paints over an element's own decision.
 *
 * A utility on a raw element is fine. A utility that overwrites how the
 * element looks is not: the element already decided, and the class is a
 * second opinion. Layout is free — where a box sits is the author's call.
 */
const semanticOwnership: GateRule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow utility classes that paint over an element the theme styles itself.",
    },
    schema: SEMANTIC_SCHEMA,
    messages: {
      utility:
        "`<{{tag}}>` already sets its own {{decision}}; drop `{{cls}}`; add a variant to the primitive or move it to the parent.",
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
          checkNoUtilitiesOnSemantic(
            factsForFile(context.filename ?? ""),
            classFacts(node),
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
 * produces is not.
 */
const closedVocabulary: GateRule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow classes the project's theme cannot generate, including raw color utilities.",
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

const noRawColors: GateRule = {
  meta: {
    type: "problem",
    docs: { description: "Disallow raw color literals in class attributes." },
    schema: [],
    messages: {
      raw:
        "`{{cls}}` hardcodes a color. Use a semantic token (`text-text`, `bg-surface`, `border-border`) so the theme can change it.",
    },
  },
  create(context) {
    return {
      JSXAttribute(node) {
        if (!carriesClasses(node)) return;
        report(
          context,
          node,
          checkNoRawColors(
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
        '`var(--{{token}})` is generated output, not an API. Read the theme: `groupOf(ctx, "{{group}}")["{{step}}"]`.',
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
 * Disallow ink that the fill underneath never declared.
 *
 * A fill's foreground is a fact of the palette, not a convention a call site
 * invents: the starters pair `bg-primary` with `text-on-primary` and give a
 * ramp step no foreground at all, because a step does not flip with the mode
 * while `text-text` does. Body ink on a filled control is legible in one
 * theme and a dark-on-dark box in the next — and it is a non-event to write,
 * which is why a gate has to read it.
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
      undeclared:
        "`bg-{{fill}}` declares no ink, so nothing says `{{ink}}` reads on it. Paint a paired fill, or declare the pairing in the theme.",
    },
  },
  create(context) {
    return {
      JSXAttribute(node) {
        if (!carriesClasses(node)) return;
        report(
          context,
          node,
          checkNoUnpairedInk(
            factsForFile(context.filename ?? ""),
            classFacts(node),
          ),
        );
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
  "no-utilities-on-semantic": semanticOwnership,
  "closed-vocabulary": closedVocabulary,
  "no-raw-colors": noRawColors,
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
