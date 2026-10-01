/**
 * Token tree -> `ValidationReport`.
 *
 * Validation is the gate a design system puts in front of a token file, so it
 * answers questions a type checker cannot: is the system COMPLETE (does it
 * still define what it promised), and does every value mean something a
 * browser will accept.
 *
 * It reports rather than throws, and it reports every problem it finds rather
 * than the first: a token file is edited by a human, and one error per
 * round-trip turns a six-line fix into six round-trips.
 */

import { isColor } from "./color.ts";
import {
  aliasTarget,
  detectCycles,
  indexTree,
  type TokenIndex,
} from "./resolve.ts";
import {
  TOKEN_TYPES,
  type TokenLeaf,
  type TokenNode,
  type TokenTree,
  type TokenType,
  type ValidateOptions,
  type ValidationIssue,
  type ValidationReport,
} from "./types.ts";

const TYPE_SET: Record<string, true> = Object.fromEntries(
  TOKEN_TYPES.map((type) => [type, true]),
);

/** A CSS color function we accept without parsing, e.g. `oklch(…)`. */
const COLOR_FUNCTION = /^-?[a-z][a-z0-9-]*\(/i;

/** A dimension is a number with a unit, or a bare `0`. */
const DIMENSION = /^-?\d*\.?\d+(px|rem|em|%|vh|vw|ch|ex|pt|pc|cm|mm|in|q)$/;

/** The only `text-transform` values a theme may declare. */
const TEXT_TRANSFORM = new Set([
  "none",
  "capitalize",
  "uppercase",
  "lowercase",
  "full-width",
]);

/** A color we can parse, or a color function we deliberately do not parse. */
function isAcceptableColor(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const text = value.trim();
  return isColor(text) || COLOR_FUNCTION.test(text);
}

/** A dimension is a number with a unit, a bare `0`, or a finite number. */
function isAcceptableDimension(value: unknown): boolean {
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "string") return false;
  const text = value.trim();
  return text === "0" || DIMENSION.test(text);
}

/**
 * What makes a value sound, per type.
 *
 * Split deliberately in two. `VALUE_RULES` holds the types with a rule;
 * `UNCHECKED` holds the types that accept any value. Together they must cover
 * `TOKEN_TYPES` exactly — a test asserts it. A bare `Partial<Record<…>>`
 * would let a new token type arrive with no rule and no complaint, which is
 * the failure this split exists to make impossible: adding a type is a
 * decision to check it or a decision not to, never an oversight.
 */
type ValueRule = (value: unknown) => string | undefined;

const VALUE_RULES: Partial<Record<TokenType, ValueRule>> = {
  color: (value) =>
    isAcceptableColor(value)
      ? undefined
      : `invalid color value ${JSON.stringify(value)}`,
  dimension: (value) =>
    isAcceptableDimension(value)
      ? undefined
      : `dimension needs a CSS unit, got ${JSON.stringify(value)}`,
  number: (value) =>
    typeof value === "number" && Number.isFinite(value)
      ? undefined
      : `number token must be a finite number, got ${JSON.stringify(value)}`,
  textTransform: (value) =>
    TEXT_TRANSFORM.has(String(value))
      ? undefined
      : `text-transform must be one of ${[...TEXT_TRANSFORM].join(", ")}, got ${
        JSON.stringify(value)
      }`,
};

/**
 * Types that accept any non-empty value.
 *
 * Each entry is a deliberate statement: the type carries no syntax a theme can
 * get wrong at the token level. `gradient` and `border` are checked when the CSS
 * consumes them, not here, because their valid shapes are wider than a token
 * validator should judge.
 */
const UNCHECKED: ReadonlySet<TokenType> = new Set<TokenType>([
  "border",
  "cubicBezier",
  "duration",
  "fontFamily",
  "fontWeight",
  "gradient",
  "shadow",
  "strokeStyle",
  "transition",
  "typography",
]);

/** Every type the vocabulary declares has been given a decision. */
export function everyTokenTypeIsDecided(): boolean {
  const decided = new Set<TokenType>([
    ...(Object.keys(VALUE_RULES) as TokenType[]),
    ...UNCHECKED,
  ]);
  return decided.size === TOKEN_TYPES.length &&
    TOKEN_TYPES.every((type) => decided.has(type));
}

function leafIssues(leaf: TokenLeaf, index: TokenIndex): ValidationIssue[] {
  const path = leaf.path.join(".");
  const issues: ValidationIssue[] = [];

  if (!Object.hasOwn(TYPE_SET, leaf.type)) {
    issues.push({
      path,
      message: `unknown token type ${JSON.stringify(leaf.type)}`,
    });
    // Nothing below can be judged sound if the type itself is not in the
    // closed vocabulary, so stop at this leaf.
    return issues;
  }

  if (leaf.value === undefined || leaf.value === null || leaf.value === "") {
    issues.push({ path, message: "token has no value" });
    return issues;
  }

  const target = aliasTarget(leaf.value);
  if (target !== null) {
    if (index.nodes[target] === undefined && index.vars[target] === undefined) {
      issues.push({
        path,
        message: `alias "{${target}}" does not resolve to a token`,
      });
    }
    // Everything downstream of a reference is checked at the referenced token.
    return issues;
  }

  const rule = VALUE_RULES[leaf.type];
  const message = rule?.(leaf.value);
  if (message !== undefined) issues.push({ path, message });

  return issues;
}

/** Duplicate custom property names silently drop a token, so they are an issue. */
function duplicateVarIssues(leaves: TokenLeaf[]): ValidationIssue[] {
  const byVar: Record<string, string[]> = {};
  for (const leaf of leaves) {
    const name = leaf.path.join("-").toLowerCase();
    const paths = byVar[name] ??= [];
    paths.push(leaf.path.join("."));
  }

  const issues: ValidationIssue[] = [];
  for (const name of Object.keys(byVar)) {
    const paths = byVar[name] as string[];
    if (paths.length > 1) {
      issues.push({
        path: paths[0] as string,
        message: `tokens ${paths.join(", ")} all emit --${name}`,
      });
    }
  }
  return issues;
}

/**
 * Check a token tree for missing required tokens, unresolvable references,
 * alias cycles, unknown types, and values a browser will not accept.
 *
 * `opts.required` lists DTCG dotted paths that must exist. An entry is
 * satisfied by a group OR a token at exactly that path, so `color` and
 * `color.brand` are both meaningful; matching is always on the full path.
 */
export function validateTokens(
  tree: TokenTree,
  opts: ValidateOptions = {},
): ValidationReport {
  const issues: ValidationIssue[] = [];
  const index = indexTree(tree);
  const leaves = Object.values(index.leaves);

  if (tree.length === 0) {
    issues.push({ path: "", message: "token tree is empty" });
  }

  for (const required of opts.required ?? []) {
    if (index.nodes[required] === undefined) {
      issues.push({
        path: required,
        message: `missing required token "${required}"`,
      });
    }
  }

  for (const node of walk(tree)) {
    if (node.kind === "group") {
      if (node.children.length === 0) {
        issues.push({
          path: node.path.join("."),
          message: "group has no tokens",
        });
      }
      continue;
    }
    issues.push(...leafIssues(node, index));
  }

  for (const cycle of detectCycles(tree)) {
    issues.push({
      path: cycle[0] as string,
      message: `alias cycle: ${[...cycle, cycle[0] as string].join(" -> ")}`,
    });
  }

  issues.push(...duplicateVarIssues(leaves));

  return { valid: issues.length === 0, issues };
}

/** Every node of a tree, groups included, in document order. */
function* walk(nodes: TokenNode[]): Generator<TokenNode> {
  for (const node of nodes) {
    yield node;
    if (node.kind === "group") yield* walk(node.children);
  }
}
