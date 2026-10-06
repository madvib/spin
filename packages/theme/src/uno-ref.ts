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
 * Which token groups map to which uno theme key, and how deep within the group
 * a name is taken from.
 *
 * `depth` is how many segments after the prefix form the name. Colors take any
 * depth and join it — a theme may name colours as deeply as it likes — while
 * the scales take one, so `spacing.4` is `4` and not `semantic.gutter`.
 */
interface RefSpec {
  readonly key: string;
  readonly prefix: readonly string[];
  readonly depth: number | null;
}

export const REF_SPECS: readonly RefSpec[] = [
  { key: "colors", prefix: ["color"], depth: null },
  { key: "spacing", prefix: ["spacing"], depth: 1 },
  { key: "fontSize", prefix: ["font", "size"], depth: 1 },
  { key: "fontFamily", prefix: ["font", "family"], depth: 1 },
  { key: "fontWeight", prefix: ["font", "weight"], depth: 1 },
  { key: "radius", prefix: ["radius"], depth: 1 },
  { key: "shadow", prefix: ["shadow"], depth: 1 },
  { key: "breakpoint", prefix: ["breakpoint"], depth: 1 },
  { key: "zIndex", prefix: ["z-index"], depth: 1 },
  { key: "motionDuration", prefix: ["motion", "duration"], depth: 1 },
  { key: "motionEasing", prefix: ["motion", "easing"], depth: 1 },
  // The component-edge tokens. `border.width` and `focus.*` are dimensions a
  // component spends (a button's own border, the ring offset), and they are
  // theme values like any other scale. Without a row here they were silently
  // dropped from the uno theme, so button emitted no border and no focus
  // ring at all.
  { key: "borderWidth", prefix: ["border"], depth: 1 },
  // `focus.width` and `focus.offset` are two dimensions, each its own group.
  // Depth 0 addresses the path exactly: the prefix is the whole path, so
  // the name is the prefix's own last segment — `focus.width` is `width`.
  { key: "focusWidth", prefix: ["focus", "width"], depth: 0 },
  { key: "focusOffset", prefix: ["focus", "offset"], depth: 0 },
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
    const rest = path.length - spec.prefix.length;
    if (rest !== 0 && spec.depth !== null && rest !== spec.depth) continue;
    return spec;
  }
  return null;
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
    // A spec with depth 0 addresses the path exactly, so there is no trailing
    // segment left to name it by: the last segment of the prefix is the name.
    const name = spec.depth === null
      ? rest.join("-")
      : rest[rest.length - 1] ?? spec.prefix[spec.prefix.length - 1] ?? "";
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
