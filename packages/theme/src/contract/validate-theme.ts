/**
 * A theme document, judged.
 *
 * The module owns the token language, the documents, and the rules a document
 * must obey — so the question "what is wrong with this theme?" belongs here
 * and not in a client that would otherwise have to know the required roles,
 * the value rules and the contrast floors all at once. Two clients that each
 * knew them would be two answers, and a studio that said a theme was fine
 * while the daemon refused to build it would be one of them lying.
 *
 * `validateTheme` asks the question of a document's text and answers with
 * everything a caller needs: the tree (when the document parses), the
 * problems, and the verdict. It never throws and never refuses a document: a
 * theme that does not parse is reported, because the studio's job is to say
 * what is wrong, and a theme it refuses to load is one it cannot help fix.
 */

import { mergeThemeDocuments } from "../extends.ts";
import { parseTokens } from "../pipeline/parse.ts";
import type {
  ThemeDocument,
  TokenLeaf,
  TokenNode,
  TokenTree,
  ValidationIssue,
} from "../pipeline/types.ts";
import { indexTree, resolveAliases } from "../pipeline/resolve.ts";
import type { TokenIndex } from "../pipeline/resolve.ts";
import { validateTokens } from "../pipeline/validate.ts";
import { type Mode, treeInMode } from "../modes.ts";
import { themeGates } from "./battery.ts";
import { isPaletteTokenPath, requiredPaths } from "./roles.ts";
import { validateLegibility } from "./schema.ts";
import { minimalTheme } from "../themes/index.ts";

/** What a caller may state about the document it is judging. */
export interface ValidateThemeOptions {
  /**
   * The DTCG dotted paths the document must declare.
   *
   * Absent: the base roles — the palette, the contrast floors that make the
   * palette usable, and the focus ring every interactive element shares. A
   * caller that judges a theme against more than the base surface (the
   * component tokens, say) states them; the module owns the base list, and
   * nothing else. Fragments are judged with `required: []` — a layer owes
   * soundness, never the parent's declarations.
   */
  readonly required?: readonly string[];

  /**
   * The modes the document SERVES.
   *
   * A claim, and only a claim: existence cannot say what is served, so a
   * caller that states nothing has made no claim, and no override is judged
   * dead. A caller that states the modes gets the check that follows — a
   * value written for a mode the theme does not serve is never shown, so the
   * declaration is a promise nothing keeps.
   */
  readonly modes?: readonly Mode[];

  /**
   * The mode the document is judged IN.
   *
   * A mode is a variant of a token, so a theme is a different document in
   * dark: the values it carries there are the ones a reader sees. Judged in
   * a mode, the document is judged as it reads there — the dark palette's
   * floors and the dark values' soundness. Absent: the base document's own
   * values.
   */
  readonly mode?: Mode;
}

/** What a theme document is, once it has been judged. */
export interface ThemeReport {
  /** The parsed tree, when the document parses. */
  readonly tree: TokenTree | undefined;
  /** Why the document did not parse, when it did not. */
  readonly error: string | undefined;
  /** Every problem the document has, in the module's own words. */
  readonly issues: readonly ValidationIssue[];
  /** Whether the document parses and owes nothing. */
  readonly valid: boolean;
}

/**
 * Judge a theme document, and say what is wrong with it.
 *
 * The one operation over a document: it parses the text, checks the tree
 * against the roles the document owes, and measures the contrast floors. The
 * answer is the same whoever asks — a studio's issues panel, the daemon's
 * analysis procedure, an agent's report — because there is one judge.
 *
 * The problems come back in the module's own words, and they come back all
 * at once: a token file is edited by a human, and one error per round trip
 * turns a six-line fix into six round trips.
 */
export function validateTheme(
  input: string | Record<string, unknown>,
  options: ValidateThemeOptions = {},
): ThemeReport {
  const text = typeof input === "string" ? input : JSON.stringify(input);
  const parsed = parseTokens(text);
  if (!parsed.ok) {
    return { tree: undefined, error: parsed.error, issues: [], valid: false };
  }

  // The tree the judgement reads: the document as it reads in the mode asked
  // for, and the document's own values otherwise. The tree the caller gets
  // back is the document either way — the shape is the document's, and the
  // modes ride on it.
  const judged = options.mode === undefined
    ? parsed.tree
    : treeInMode(parsed.tree, options.mode);

  const report = validateTokens(judged, {
    required: options.required ?? requiredPaths(),
    // The claim is the caller's: without one, no override is judged dead.
    ...(options.modes !== undefined ? { modes: options.modes } : {}),
  });
  const issues = [...report.issues, ...validateLegibility(judged)];

  // A full theme owes the whole battery: the ladders, the loop, and the
  // modes' restraint, on top of the roles and the floors. A caller that
  // states what the document owes (or the mode it is read in) judges a
  // fragment, so only the stated judgement runs there.
  if (options.required === undefined && options.mode === undefined) {
    const battery = themeGates(text, {
      ...(options.modes !== undefined ? { modes: options.modes } : {}),
    });
    const seen = new Set(issues.map((issue) => `${issue.path}|${issue.message}`));
    for (const gate of battery.gates) {
      if (gate.gate === "completeness" || gate.gate === "legibility") continue;
      for (const extra of gate.issues) {
        const key = `${extra.path}|${extra.message}`;
        if (!seen.has(key)) {
          issues.push(extra);
          seen.add(key);
        }
      }
    }
  }

  return {
    tree: parsed.tree,
    error: undefined,
    issues,
    valid: issues.length === 0,
  };
}

/**
 * Judge a palette facet: the ink a `[data-palette]` subtree wears.
 *
 * A facet is judged twice: on its own — every path it states must be a
 * palette token and every value must be sound — and merged over the base it
 * composes with, where the contrast floors are measured. A facet that
 * carries spacing is not a stricter palette; it is a document in the wrong
 * file, and the message says which root it belongs to.
 */
export function validatePaletteFacet(
  input: string | unknown,
  baseDoc: ThemeDocument = minimalTheme,
): ThemeReport {
  const decoded = decodeFacet(input);
  if (!decoded.ok) {
    return { tree: undefined, error: decoded.error, issues: [], valid: false };
  }
  const parsed = parseTokens(decoded.doc);
  if (!parsed.ok) {
    return { tree: undefined, error: parsed.error, issues: [], valid: false };
  }
  const issues: ValidationIssue[] = [];
  for (const leaf of facetLeaves(parsed.tree)) {
    const path = leaf.path.join(".");
    if (!isPaletteTokenPath(path)) {
      issues.push({
        path,
        message:
          `${path} is not a palette token — palette facets carry ink, not ${leaf.path[0]}`,
      });
    }
  }
  // A facet owes no roles of its own: the base it composes with owes them.
  // What it owes is sound values, so only the values are judged here.
  issues.push(...validateTokens(parsed.tree, { required: [] }).issues);
  // The floors are measured where the facet is worn: over the base, where
  // every fill the ink reads against is present.
  const merged = parseTokens(mergeThemeDocuments(baseDoc, decoded.doc));
  if (merged.ok) issues.push(...validateLegibility(merged.tree));
  return {
    tree: parsed.tree,
    error: undefined,
    issues,
    valid: issues.length === 0,
  };
}

/**
 * Judge a spacing facet: the ruler a `[data-spacing]` subtree spends.
 *
 * A facet is judged twice: on its own — every path under `spacing.*` or a
 * padding element token, and no `$modes` anywhere, because space does not
 * vary by mode — and merged over the base it composes with, where the
 * spacing ladder must still climb.
 */
export function validateSpacingFacet(
  input: string | unknown,
  baseDoc: ThemeDocument = minimalTheme,
): ThemeReport {
  const decoded = decodeFacet(input);
  if (!decoded.ok) {
    return { tree: undefined, error: decoded.error, issues: [], valid: false };
  }
  const parsed = parseTokens(decoded.doc);
  if (!parsed.ok) {
    return { tree: undefined, error: parsed.error, issues: [], valid: false };
  }
  const issues: ValidationIssue[] = [];
  for (const leaf of facetLeaves(parsed.tree)) {
    const path = leaf.path.join(".");
    const root = leaf.path[0] as string;
    if (
      root !== "spacing" && path !== "card.padding" &&
      path !== "alert.padding"
    ) {
      issues.push({
        path,
        message:
          `${path} is not a spacing token — spacing facets carry space, not ${root}`,
      });
      continue;
    }
    if (leaf.modes !== undefined && Object.keys(leaf.modes).length > 0) {
      issues.push({
        path,
        message:
          `${path} declares $modes, and a spacing facet varies nothing by mode`,
      });
    }
  }
  issues.push(...validateTokens(parsed.tree, { required: [] }).issues);
  // The ladder is read where the facet is worn: over the base, where the
  // steps the facet omits are still present.
  const merged = parseTokens(mergeThemeDocuments(baseDoc, decoded.doc));
  if (merged.ok) {
    issues.push(
      ...spacingLadderIssues(indexTree(resolveAliases(merged.tree).tree)),
    );
  }
  return {
    tree: parsed.tree,
    error: undefined,
    issues,
    valid: issues.length === 0,
  };
}

/** A facet document as decoded JSON, or why it is not one. */
function decodeFacet(
  input: string | unknown,
): { ok: true; doc: ThemeDocument } | { ok: false; error: string } {
  let doc: unknown = input;
  if (typeof input === "string") {
    try {
      doc = JSON.parse(input);
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      return { ok: false, error: `invalid JSON: ${detail}` };
    }
  }
  if (
    typeof doc !== "object" || doc === null || Array.isArray(doc)
  ) {
    return { ok: false, error: "facet document must be a JSON object" };
  }
  return { ok: true, doc: doc as ThemeDocument };
}

/** Every token leaf in a tree, depth-first. */
function facetLeaves(tree: TokenTree): TokenLeaf[] {
  const out: TokenLeaf[] = [];
  const walk = (nodes: readonly TokenNode[]): void => {
    for (const node of nodes) {
      if (node.kind === "token") out.push(node);
      else walk(node.children);
    }
  };
  walk(tree);
  return out;
}

/**
 * The spacing ladder, over one resolved index: the steps climb.
 *
 * The battery's scales gate, duplicated for a facet merged over its base
 * rather than a whole theme. The battery is not refactored to share it: a
 * facet is judged where it is worn, and the gate's other ladders do not
 * apply to a document that carries space alone.
 */
function spacingLadderIssues(index: TokenIndex): ValidationIssue[] {
  const steps = Object.keys(index.leaves)
    .filter((path) => path.startsWith("spacing."))
    .map((path) => path.slice("spacing.".length))
    .filter((step) => /^\d+$/.test(step))
    .sort((a, b) => Number(a) - Number(b));
  const issues: ValidationIssue[] = [];
  let previous: { step: string; value: number; text: string } | undefined;
  for (const step of steps) {
    const leaf = index.leaves[`spacing.${step}`];
    if (leaf === undefined) continue;
    const value = facetLengthOf(leaf.value);
    if (value === undefined) continue;
    if (previous !== undefined && value < previous.value) {
      issues.push({
        path: `spacing.${step}`,
        message:
          `the spacing ladder descends: spacing.${previous.step} is ${previous.text} and spacing.${step} is ${leaf.value}`,
      });
    }
    previous = { step, value, text: String(leaf.value) };
  }
  return issues;
}

/**
 * A length as a number of pixels, so two steps of one ladder can be
 * compared. `rem` and `em` read at the root's sixteen pixels.
 */
function facetLengthOf(value: unknown): number | undefined {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value !== "string") return undefined;
  const match = /^(-?\d*\.?\d+)(rem|px|em)?$/.exec(value.trim());
  if (match === null) return undefined;
  const amount = Number(match[1]);
  const unit = match[2] ?? "px";
  return unit === "px" ? amount : amount * 16;
}
