/**
 * Brand composition: sparse layers over a named parent, judged as one document.
 *
 * A brand is authored as fragments — a starter name plus the tokens the
 * brand owns — and the build serves one document. Fragments judge
 * permissively on their own terms (soundness, no required-set claim), while
 * the composed document owes everything a theme owes. This module is where
 * the two meet: it merges the layers over the parent, judges each layer as
 * a fragment so an authoring typo names its layer, then judges the composed
 * document against the full contract. It sits beside `extends.ts` (merge)
 * rather than in `contract/` because composition is assembly, not judgement
 * — the judgement stays `validateTheme`'s and the battery's.
 */

import type {
  ThemeDocument,
  TokenTree,
  ValidationIssue,
} from "./pipeline/types.ts";
import { parseTokens } from "./pipeline/parse.ts";
import { requiredPaths } from "./contract/roles.ts";
import { validateLegibility } from "./contract/schema.ts";
import { validateTokens } from "./pipeline/validate.ts";
import { themeGates } from "./contract/battery.ts";
import { expandExtends, mergeThemeDocuments } from "./extends.ts";

/** One problem in one layer of a composition, located by layer. */
export interface CompositionIssue {
  /** Which layer the problem is in: `parent`, `layer[<index>]`, or `composed`. */
  readonly layer: string;
  /** The token path, or `''` for the layer as a whole. */
  readonly path: string;
  /** What is wrong, in the judge's own words. */
  readonly message: string;
}

/** What composition produced: the document the build serves, and its debts. */
export interface Composition {
  /** The merged document: parent, then layers in order. */
  readonly document: ThemeDocument;
  /** The parsed tree of the merged document, when it parses. */
  readonly tree: TokenTree | undefined;
  /** Every problem, located by layer — empty when the composition holds. */
  readonly issues: readonly CompositionIssue[];
  /** Whether the composition holds: parses and owes nothing. */
  readonly valid: boolean;
}

/**
 * Merge layers over a parent and judge the result.
 *
 * `parent` is the document the brand extends (or undefined for a parentless
 * merge). Each layer is judged as a fragment — parse plus soundness, with no
 * required set — so a value a layer misspells names the layer that carries
 * it. The composed document is judged against the full contract: every
 * required path, the contrast floors, and the battery. A sound fragment can
 * still break the composition (a removed leaf leaves a dangling alias), and
 * that break is reported under `composed`, where the build reads it.
 */
export function compose(
  layers: readonly ThemeDocument[],
  parent?: ThemeDocument,
): Composition {
  const issues: CompositionIssue[] = [];

  // A layer judges against the floor it composes over — the parent plus the
  // layers before it — not alone: a layer that re-points an alias the
  // starter declares is sound only beside that parent, and judging it alone
  // would cry dangling where composition resolves.
  let floor: ThemeDocument = {};
  if (parent !== undefined) {
    const parsed = parseTokens(parent);
    if (!parsed.ok) {
      issues.push({ layer: "parent", path: "", message: parsed.error });
    } else {
      for (const issue of fragmentIssues(parsed.tree)) {
        issues.push({ layer: "parent", path: issue.path, message: issue.message });
      }
    }
    floor = mergeThemeDocuments(floor, parent);
  }

  layers.forEach((layer, index) => {
    const stripped = stripExtends(layer);
    // A layer is a diff, never a standalone document: typeless leaves inherit
    // their type from the parent's group, so the layer parses only in
    // composition. Merge first; judge the merged tree filtered to paths the
    // layer itself states.
    const alone = parseTokens(stripped);
    const own = alone.ok ? declaredPaths(alone.tree) : declaredKeys(stripped);
    const merged = parseTokens(mergeThemeDocuments(floor, stripped));
    if (!merged.ok) {
      issues.push({ layer: `layer[${index}]`, path: "", message: merged.error });
    } else {
      for (const issue of fragmentIssues(merged.tree)) {
        if (issue.path === "" || ownsPath(own, issue.path)) {
          issues.push({ layer: `layer[${index}]`, path: issue.path, message: issue.message });
        }
      }
    }
    floor = mergeThemeDocuments(floor, stripped);
  });

  let document: ThemeDocument = {};
  if (parent !== undefined) document = mergeThemeDocuments(document, parent);
  for (const layer of layers) document = mergeThemeDocuments(document, layer);

  const parsed = parseTokens(document);
  if (!parsed.ok) {
    issues.push({ layer: "composed", path: "", message: parsed.error });
    return { document, tree: undefined, issues, valid: false };
  }

  const tree = parsed.tree;
  const complete = validateTokens(tree, { required: [...requiredPaths()] });
  for (const issue of complete.issues) {
    issues.push({ layer: "composed", path: issue.path, message: issue.message });
  }
  for (const issue of validateLegibility(tree)) {
    issues.push({ layer: "composed", path: issue.path, message: issue.message });
  }
  const battery = themeGates(JSON.stringify(document));
  const seen = new Set(issues.map((issue) => `${issue.path}|${issue.message}`));
  for (const gate of battery.gates) {
    if (gate.gate === "completeness" || gate.gate === "legibility") continue;
    for (const extra of gate.issues) {
      const key = `${extra.path}|${extra.message}`;
      if (!seen.has(key)) {
        issues.push({ layer: "composed", path: extra.path, message: extra.message });
        seen.add(key);
      }
    }
  }

  return { document, tree, issues, valid: issues.length === 0 };
}

/** A fragment's own debts: soundness, never completeness. */
function fragmentIssues(tree: TokenTree): readonly ValidationIssue[] {
  const report = validateTokens(tree, { required: [] });
  const floors = validateLegibility(tree);
  return [...report.issues, ...floors];
}

/** Every node path a tree declares, leaf or group. */
function declaredPaths(tree: TokenTree): Set<string> {
  const out = new Set<string>();
  const walk = (nodes: TokenTree): void => {
    for (const node of nodes) {
      out.add(node.path.join("."));
      if (node.kind === "group") walk(node.children as TokenTree);
    }
  };
  walk(tree);
  return out;
}

/** The paths a raw layer states, by key walk — for layers that parse only in composition. */
function declaredKeys(layer: ThemeDocument, prefix: string[] = []): Set<string> {
  const out = new Set<string>();
  for (const [key, value] of Object.entries(layer)) {
    if (key.startsWith("$")) continue;
    const path = [...prefix, key];
    out.add(path.join("."));
    if (typeof value === "object" && value !== null && !("$value" in (value as Record<string, unknown>))) {
      for (const sub of declaredKeys(value as ThemeDocument, path)) out.add(sub);
    }
  }
  return out;
}

/** Whether a debt sits at or under a path the layer itself states. */
function ownsPath(own: Set<string>, path: string): boolean {
  if (own.has(path)) return true;
  for (const prefix of own) {
    if (path.startsWith(`${prefix}.`)) return true;
  }
  return false;
}

/** A layer read on its own terms: its `$extends` names composition, not content. */
function stripExtends(layer: ThemeDocument): ThemeDocument {
  if (!Object.hasOwn(layer, "$extends")) return layer;
  const { $extends: _ignored, ...rest } = layer as ThemeDocument & { $extends?: unknown };
  return rest as ThemeDocument;
}

export { expandExtends };
