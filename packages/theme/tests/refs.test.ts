import { assert, assertEquals } from "@std/assert";
import {
  cssVarName,
  indexTree,
  parseTokens,
  REF_SPECS,
  refFamilies,
  refFamilyFor,
  themeRef,
} from "@spin/theme";
import { starterThemes } from "@spin/theme/themes";
import type { TokenTree } from "@spin/theme";

/**
 * The binding's own contract.
 *
 * `REF_SPECS` joins two vocabularies that cannot be derived from one another —
 * DTCG paths and the uno theme keys rules read — so it is the one authored
 * surface in the bridge. These tests are its audit, in the directions the
 * theme package can see: every family must bind real leaves, composition must
 * follow the one naming rule, and no family may shadow another. The other
 * direction — every leaf of a theme must be bound or owned by a component
 * root — lives in `@spin/preset`, the only package that knows the component
 * roots.
 */

function treeOf(name: keyof typeof starterThemes): TokenTree {
  const parsed = parseTokens(starterThemes[name]);
  if (!parsed.ok) throw new Error(`${name}: ${parsed.error}`);
  return parsed.tree;
}

Deno.test("every binding in the table answers with a leaf of the default theme", () => {
  // A binding that matches nothing is a key the rules read undefined from —
  // the shape the opacity and letter-spacing groups were absent of, and the
  // shape a typo in a prefix produces.
  const bound = new Set<string>();
  for (const leaf of Object.values(indexTree(treeOf("default")).leaves)) {
    const family = refFamilyFor(leaf.path);
    if (family !== null) bound.add(family);
  }
  const dead = refFamilies().filter((family) => !bound.has(family));
  assertEquals(dead, [], "these bindings answer no leaf of the default theme");
});

Deno.test("a leaf is named by its path below the binding's prefix, joined", () => {
  const ref = themeRef(treeOf("default"));

  assertEquals(
    ref.colors["neutral-500"],
    `var(${cssVarName(["color", "neutral", "500"])})`,
  );
  assertEquals(
    ref.colors["on-semantic-error"],
    `var(${cssVarName(["color", "on-semantic-error"])})`,
  );
  assertEquals(ref.spacing["4"], `var(${cssVarName(["spacing", "4"])})`);
  assertEquals(
    ref.letterSpacing["wide"],
    `var(${cssVarName(["font", "letter-spacing", "wide"])})`,
  );
  // An exact binding addresses the prefix's own token: the name is the
  // prefix's last segment, and the variable is the prefix's path.
  assertEquals(
    ref.focusWidth["width"],
    `var(${cssVarName(["focus", "width"])})`,
  );
  assert(
    refFamilyFor(["focus", "width"]) === "focus.width",
    "an exact binding names itself for its own path",
  );
});

Deno.test("no binding shadows another", () => {
  // A prefix that is a strict prefix of another would win for the other's
  // leaves by table order — a silent priority nobody declared. The table is
  // small and flat on purpose; this fails the moment that stops being true.
  const shadowed: string[] = [];
  for (const a of REF_SPECS) {
    for (const b of REF_SPECS) {
      if (a === b || a.prefix.length >= b.prefix.length) continue;
      if (a.prefix.every((segment, i) => segment === b.prefix[i])) {
        shadowed.push(`${a.key} shadows ${b.key}`);
      }
    }
  }
  assertEquals(shadowed, []);
});
