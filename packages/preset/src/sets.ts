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

export function buildSets(tree: TokenTree): SpinSets {
  const sets: SpinSets = {
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
  const index = indexTree(tree);
  for (const leaf of Object.values(index.leaves)) {
    const [root, ...rest] = leaf.path;
    if (root === "color" && rest.length > 0) {
      sets.colors.set(rest.join("-").toLowerCase(), [...leaf.path]);
    } else if (root === "spacing" && rest.length === 1) {
      sets.spacing.set(rest[0] as string, [...leaf.path]);
    } else if (root === "font" && rest[0] === "size" && rest.length === 2) {
      sets.fontSize.set(rest[1] as string, [...leaf.path]);
    } else if (root === "font" && rest[0] === "family" && rest.length === 2) {
      sets.fontFamily.set(rest[1] as string, [...leaf.path]);
    } else if (root === "font" && rest[0] === "weight" && rest.length === 2) {
      sets.fontWeight.set(rest[1] as string, [...leaf.path]);
    } else if (root === "radius" && rest.length === 1) {
      sets.radius.set(rest[0] as string, [...leaf.path]);
    } else if (root === "shadow" && rest.length === 1) {
      sets.shadow.set(rest[0] as string, [...leaf.path]);
    } else if (root === "breakpoint" && rest.length === 1) {
      sets.breakpoint.set(rest[0] as string, [...leaf.path]);
    } else if (root === "z-index" && rest.length === 1) {
      sets.zIndex.set(rest[0] as string, [...leaf.path]);
    } else if (
      root === "motion" && rest[0] === "duration" && rest.length === 2
    ) {
      sets.motionDuration.set(rest[1] as string, [...leaf.path]);
    } else if (root === "motion" && rest[0] === "easing" && rest.length === 2) {
      sets.motionEasing.set(rest[1] as string, [...leaf.path]);
    }
  }
  return sets;
}
