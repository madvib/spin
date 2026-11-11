/**
 * The uno theme object, built once from a tree.
 *
 * A token's name is derived from its path, once, here — and everywhere else a
 * name is a *value*. The name IS the custom property's own name, minus the
 * leading `--`: the variable namespace is flat, so the property is the token's
 * identity, and there is no second vocabulary to keep in step.
 *
 * The values are references rather than literals, which is what makes a theme
 * live: the map holds `var(--color-primary)` and the browser resolves it
 * against whatever stylesheet declared it. `generateCss` builds the same name
 * with the same `cssVarName`, so the engine and the stylesheet cannot disagree.
 *
 * What this module deliberately does NOT have: a table of which token groups
 * are "exposed". The projection is total — every leaf of the tree is in the
 * map — so there is no row to forget, and the readers that once kept such a
 * table (and the audits that grew around it) are gone.
 */
import { cssVarName, indexTree } from "@spinjs/theme";
import type { TokenLeaf, TokenTree } from "@spinjs/theme";

/** The CSS properties one typography tuple spends, in declaration order. */
const TYPE_PROPERTIES: ReadonlyArray<readonly [field: string, property: string]> = [
  ["family", "font-family"],
  ["size", "font-size"],
  ["weight", "font-weight"],
  ["tracking", "letter-spacing"],
  ["leading", "line-height"],
];

/** The CSS properties one border tuple spends, in declaration order. */
const BORDER_PROPERTIES: ReadonlyArray<readonly [field: string, property: string]> = [
  ["width", "border-width"],
  ["style", "border-style"],
  ["color", "border-color"],
];

/**
 * Every token of a tree, keyed by its custom property name without the
 * leading `--`, each value the `var()` reference to it — and under the same
 * object, every token by its nested DTCG path.
 *
 * The flat keys are the dynamic surface: `named()` pastes a class suffix
 * onto a family prefix and lands on one entry. The nested paths are the
 * static surface: `theme.color.primary` reads as `var(--color-primary)`
 * with a compile error when the path is misspelled. Both spell the same
 * references, so the two surfaces cannot disagree.
 *
 * A `$type: "typography"` group reads as its five CSS declarations: the
 * property keys are enumerable own properties, so `...theme.button.type`
 * spreads the declarations into a rule object, while the five field names
 * stay readable as single `var()` references through non-enumerable getters.
 */
export type ThemeRef = Record<string, string> & {
  readonly [group: string]: unknown;
};

/**
 * The map key a dotted token path addresses.
 *
 * Dotted and dashed spellings name the same property — `font.family.sans`
 * and `font-family-sans` are `--font-family-sans` either way — so a caller
 * can write the path the document uses and a caller that only has a class
 * name can paste its dashes; both land on the same entry.
 */
export function themeKey(path: string): string {
  return path.split(".").join("-");
}

function refOf(leaf: TokenLeaf): string {
  return `var(${cssVarName(leaf.path)})`;
}

/** The leaf at a dotted path, when the tree declares one there. */
function leafAt(
  leaves: Record<string, TokenLeaf>,
  path: string[],
): TokenLeaf | undefined {
  return leaves[path.join(".")];
}

/**
 * The typography tuple at `path`, when its five leaves are all declared:
 * the five CSS declarations as enumerable properties, the five field
 * references behind getters. Absent when any field is undeclared — a rule
 * spreading the tuple spends what the theme decided and nothing else.
 */
function typeTuple(
  leaves: Record<string, TokenLeaf>,
  path: string[],
): Record<string, string> | undefined {
  const refs: string[] = [];
  for (const [field] of TYPE_PROPERTIES) {
    const leaf = leafAt(leaves, [...path, field]);
    if (leaf === undefined) return undefined;
    refs.push(refOf(leaf));
  }
  const tuple: Record<string, string> = {};
  TYPE_PROPERTIES.forEach(([field, property], i) => {
    const ref = refs[i] as string;
    tuple[property] = ref;
    Object.defineProperty(tuple, field, {
      enumerable: false,
      configurable: true,
      get: () => ref,
    });
  });
  return tuple;
}

/**
 * The border tuple at `path`, when its three leaves are all declared:
 * the three CSS declarations as enumerable properties, the three field
 * references behind getters. Absent when any field is undeclared — a rule
 * spreading the tuple spends what the theme decided and nothing else.
 */
function borderTuple(
  leaves: Record<string, TokenLeaf>,
  path: string[],
): Record<string, string> | undefined {
  const refs: string[] = [];
  for (const [field] of BORDER_PROPERTIES) {
    const leaf = leafAt(leaves, [...path, field]);
    if (leaf === undefined) return undefined;
    refs.push(refOf(leaf));
  }
  const tuple: Record<string, string> = {};
  BORDER_PROPERTIES.forEach(([field, property], i) => {
    const ref = refs[i] as string;
    tuple[property] = ref;
    Object.defineProperty(tuple, field, {
      enumerable: false,
      configurable: true,
      get: () => ref,
    });
  });
  return tuple;
}

export function themeRef(tree: TokenTree): ThemeRef {
  const out: Record<string, unknown> = {};
  const leaves = indexTree(tree).leaves;
  for (const leaf of Object.values(leaves)) {
    const name = cssVarName(leaf.path);
    out[name.slice(2)] = `var(${name})`;
  }
  // The nested paths, built over the same object: a group becomes the
  // object its children hang under, a typography group the tuple above, a
  // scalar leaf the reference. A group whose name collides with a leaf's —
  // `button` the tunnel beside `button` the token — keeps both: the leaf's
  // reference stays on the flat key, the tunnel on the nested path.
  for (const node of tree) nest(node, leaves, out);
  return out as ThemeRef;
}

/**
 * The opacity steps the theme declares, as the suffixes an `opacity-*`
 * utility spells — the flat keys under `opacity-`, stripped to the name a
 * class would write. Factory spends it to register one rule per step; the
 * `opacity-` prefix lives here, nowhere else.
 */
export function opacitySteps(theme: ThemeRef): string[] {
  const prefix = "opacity-";
  return Object.keys(theme)
    .filter((key) => key.startsWith(prefix))
    .map((key) => key.slice(prefix.length));
}
function nest(
  node: { kind: string; name: string; path: string[]; children?: unknown[] },
  leaves: Record<string, TokenLeaf>,
  into: Record<string, unknown>,
): void {
  if (node.kind === "token") {
    const leaf = leafAt(leaves, node.path);
    if (leaf !== undefined) into[node.name] = refOf(leaf);
    return;
  }
  const tuple = typeTuple(leaves, node.path) ?? borderTuple(leaves, node.path);
  if (tuple !== undefined) {
    into[node.name] = tuple;
    return;
  }
  const group: Record<string, unknown> = {};
  for (
    const child of (node.children ?? []) as {
      kind: string;
      name: string;
      path: string[];
      children?: unknown[];
    }[]
  ) nest(child, leaves, group);
  into[node.name] = group;
}
