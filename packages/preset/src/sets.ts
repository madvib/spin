import { indexTree } from "@spin/theme";
import type { TokenTree } from "@spin/theme";

/** Utility name -> token path, e.g. `neutral-50` -> `["color","neutral","50"]`. */
export type NameMap = Map<string, string[]>;

export interface SpinSets {
  colors: NameMap;
  spacing: NameMap;
  fontSize: NameMap;
  fontFamily: NameMap;
  fontWeight: NameMap;
  radius: NameMap;
  shadow: NameMap;
  breakpoint: NameMap;
  zIndex: NameMap;
  motionDuration: NameMap;
  motionEasing: NameMap;
}

/**
 * Which token paths a utility family is derived from.
 *
 * A token reaches the utility layer by matching one of these, so adding a token
 * group is a row here rather than another branch in a walk. Three shapes:
 *
 * - `depth` is how many segments follow the matched prefix. `color` takes any
 *   depth and joins them, because a theme may name colours as deeply as it
 *   likes — `color.brand.coral` and `color.coral` are both colours. The scales
 *   are `depth: 1`, because a spacing step is a step in one scale and a second
 *   segment would be a different thing with a misleadingly similar utility.
 * - `name` is how the remaining segments become the utility suffix.
 */
interface SetSpec {
  /** The set this row fills. */
  readonly set: keyof SpinSets;
  /** Token path prefix, e.g. `["font","size"]`. */
  readonly prefix: readonly string[];
  /** Segments required after the prefix, or `null` for any. */
  readonly depth: number | null;
  /** How to build the suffix from the remaining segments. */
  readonly name: "join" | "last";
}

/**
 * The derivation, declared.
 *
 * Nothing here names a token: a theme that declares `radius.pill` gets
 * `rounded-pill` without anyone writing `pill` down.
 */
const SET_SPECS: readonly SetSpec[] = [
  { set: "colors", prefix: ["color"], depth: null, name: "join" },
  { set: "spacing", prefix: ["spacing"], depth: 1, name: "last" },
  { set: "fontSize", prefix: ["font", "size"], depth: 1, name: "last" },
  { set: "fontFamily", prefix: ["font", "family"], depth: 1, name: "last" },
  { set: "fontWeight", prefix: ["font", "weight"], depth: 1, name: "last" },
  { set: "radius", prefix: ["radius"], depth: 1, name: "last" },
  { set: "shadow", prefix: ["shadow"], depth: 1, name: "last" },
  { set: "breakpoint", prefix: ["breakpoint"], depth: 1, name: "last" },
  { set: "zIndex", prefix: ["z-index"], depth: 1, name: "last" },
  {
    set: "motionDuration",
    prefix: ["motion", "duration"],
    depth: 1,
    name: "last",
  },
  { set: "motionEasing", prefix: ["motion", "easing"], depth: 1, name: "last" },
];

function emptySets(): SpinSets {
  return {
    colors: new Map(),
    spacing: new Map(),
    fontSize: new Map(),
    fontFamily: new Map(),
    fontWeight: new Map(),
    radius: new Map(),
    shadow: new Map(),
    breakpoint: new Map(),
    zIndex: new Map(),
    motionDuration: new Map(),
    motionEasing: new Map(),
  };
}

/** The set spec a token path matches, or null when it belongs to none. */
function specFor(path: readonly string[]): SetSpec | null {
  for (const spec of SET_SPECS) {
    if (spec.prefix.length > path.length) continue;
    if (
      !spec.prefix.every((segment, i) => segment === path[i])
    ) {
      continue;
    }
    const rest = path.slice(spec.prefix.length);
    if (rest.length === 0) continue;
    if (spec.depth !== null && rest.length !== spec.depth) continue;
    return spec;
  }
  return null;
}

/**
 * The utility names a token tree produces.
 *
 * Pure in the tree, so a token added to a theme is in here on the next build
 * and the catalog — which enumerates the same sets — reports it. A group with no
 * row in `SET_SPECS` yields no utilities, which is the one deliberate way a
 * token stays out of the utility layer.
 */
export function buildSets(tree: TokenTree): SpinSets {
  const sets = emptySets();
  const index = indexTree(tree);
  for (const leaf of Object.values(index.leaves)) {
    const spec = specFor(leaf.path);
    if (spec === null) continue;
    const rest = leaf.path.slice(spec.prefix.length);
    const suffix = spec.name === "join"
      ? rest.join("-")
      : rest[rest.length - 1];
    if (suffix === undefined) continue;
    sets[spec.set].set(suffix.toLowerCase(), [...leaf.path]);
  }
  return sets;
}

/** The token groups a theme may put in a utility family, for documentation. */
export function utilityFamilies(): string[] {
  return [...new Set(SET_SPECS.map((spec) => spec.prefix.join(".")))];
}
