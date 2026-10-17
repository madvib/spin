/**
 * The uno theme object, built once from a tree.
 *
 * A token's name is derived from its path, once, here — and everywhere else a
 * name is a *value*. Rules read `theme.colors.primary`; nothing spells
 * `var(--color-primary)` by hand, because there is nowhere to spell it.
 *
 * The values are references rather than literals, which is what makes a theme
 * live: the rule emits `var(--color-primary)` and the browser resolves it
 * against whatever the stylesheet declared. `generateCss` joins paths with the
 * same `cssVarName`, so the engine and the stylesheet cannot disagree about a
 * name.
 */

import { indexTree } from "./pipeline/resolve.ts";
import { cssVarName } from "./pipeline/resolve.ts";
import type { TokenTree } from "./pipeline/types.ts";

/** A group of token names to the reference each resolves to. */
export type ThemeRefGroup = Record<string, string>;

/**
 * A binding between a token-family prefix and the uno theme key it publishes
 * under.
 *
 * This is the one authored surface in the bridge, and it exists because it
 * joins two independently-fixed vocabularies: DTCG token paths, which themes
 * author, and the uno theme keys, which rules read by ecosystem convention —
 * `theme.colors`, `theme.fontSize`, and so on, including wind4's rules, which
 * are composed into every build and read this exact object. Neither side can
 * be derived from the other.
 *
 * Because it cannot be derived, it is audited instead, in both directions:
 * every leaf of a shipped theme must be bound by a family here or owned by a
 * component root, and every family here must bind at least one leaf. One test
 * on each side, so a theme can neither grow a group no rule can see, nor keep
 * a binding that answers nothing. Both directions have failed for real: the
 * opacity and letter-spacing groups were unreachable from every rule, and a
 * `fontElement` binding answered a consumer that spelled its reads another
 * way and no theme ever declared.
 *
 * The name of a leaf is its path below the prefix, joined — `color.neutral.500`
 * is `neutral-500`. An `exact` binding addresses the prefix's own token, so
 * the name falls back to the prefix's last segment and `focus.width`
 * publishes as `focusWidth.width`.
 */
interface RefSpec {
  /** The uno theme key the family is published under. */
  readonly key: string;
  /** The DTCG token path prefix the key is bound to. */
  readonly prefix: readonly string[];
  /**
   * Whether the key addresses the prefix's own token rather than the leaves
   * below it. `focusWidth` is `focus.width` itself; `spacing` is every leaf
   * below `spacing`.
   */
  readonly exact?: boolean;
}

export const REF_SPECS: readonly RefSpec[] = [
  { key: "colors", prefix: ["color"] },
  { key: "spacing", prefix: ["spacing"] },
  { key: "fontSize", prefix: ["font", "size"] },
  { key: "fontFamily", prefix: ["font", "family"] },
  { key: "fontWeight", prefix: ["font", "weight"] },
  { key: "radius", prefix: ["radius"] },
  { key: "shadow", prefix: ["shadow"] },
  { key: "breakpoint", prefix: ["breakpoint"] },
  { key: "zIndex", prefix: ["z-index"] },
  { key: "opacity", prefix: ["opacity"] },
  { key: "letterSpacing", prefix: ["font", "letter-spacing"] },
  { key: "motionDuration", prefix: ["motion", "duration"] },
  { key: "motionEasing", prefix: ["motion", "easing"] },
  // The component-edge tokens. `border.width` and `focus.*` are dimensions a
  // component spends (a button's own border, the ring offset), and they are
  // theme values like any other scale.
  { key: "borderWidth", prefix: ["border"] },
  { key: "focusWidth", prefix: ["focus", "width"], exact: true },
  { key: "focusOffset", prefix: ["focus", "offset"], exact: true },
];

/** A uno theme whose every value is the reference it came from. */
export interface ThemeRef {
  [key: string]: ThemeRefGroup;
}

/** The spec a token path matches, or null when it belongs to none. */
function specFor(path: readonly string[]): RefSpec | null {
  for (const spec of REF_SPECS) {
    if (spec.prefix.length > path.length) continue;
    if (!spec.prefix.every((segment, i) => segment === path[i])) continue;
    if (spec.exact === true && path.length !== spec.prefix.length) continue;
    return spec;
  }
  return null;
}

/**
 * The family a token path is bound to, named by its binding's prefix, or null
 * when no binding claims it.
 *
 * The forward half of the audit reads this: a leaf with no family here is a
 * token no rule can reach, unless a component root owns it.
 */
export function refFamilyFor(path: readonly string[]): string | null {
  const spec = specFor(path);
  return spec === null ? null : spec.prefix.join(".");
}

/**
 * The theme object uno resolves against, values as references.
 *
 * A token in no group contributes nothing, which is how a token stays out of
 * the utility layer: component character tokens are spent by the primitives
 * rather than given a class.
 *
 * `componentRoots` adds one group per component root — the keys a caller
 * declares, typically the primitives manifest — so a component's character
 * tokens are reachable as `theme[root][step]`. A root's tokens are addressed
 * by the root plus the step below it, the same shape the scale groups have.
 */
export function themeRef(
  tree: TokenTree,
  componentRoots?: readonly string[],
): ThemeRef {
  const out: ThemeRef = {};
  for (const spec of REF_SPECS) out[spec.key] = {};

  const leaves = Object.values(indexTree(tree).leaves);
  for (const leaf of leaves) {
    const spec = specFor(leaf.path);
    if (spec === null) continue;
    const rest = leaf.path.slice(spec.prefix.length);
    const name = rest.length > 0
      ? rest.join("-")
      : spec.prefix[spec.prefix.length - 1] ?? "";
    (out[spec.key] as ThemeRefGroup)[name.toLowerCase()] = `var(${
      cssVarName(leaf.path)
    })`;
  }

  // Component character tokens: one group per declared root, keyed by the
  // root. A root's tokens are addressed by the root plus the step below it,
  // so `button.weight` becomes `theme.button.weight` — the same shape the
  // scale groups have, and the only place a component's tokens are reachable.
  for (const root of componentRoots ?? []) {
    if (out[root] === undefined) out[root] = {};
    const group = out[root] as ThemeRefGroup;
    for (const leaf of leaves) {
      if (leaf.path[0] !== root || leaf.path.length < 2) continue;
      group[leaf.path.slice(1).join("-").toLowerCase()] = `var(${
        cssVarName(leaf.path)
      })`;
    }
  }
  return out;
}

/** The token groups that map to a utility family, for documentation. */
export function refFamilies(): string[] {
  return [...new Set(REF_SPECS.map((spec) => spec.prefix.join(".")))];
}
