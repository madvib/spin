import { assert, assertEquals } from "@std/assert";
import { TREE_VIEW_VARIANTS } from "./tree-view.variants.ts";

/**
 * Variants are copy-paste: each one names the element it needs, spreads
 * only this machine's bags, and iterates rows this machine provides. A
 * variant referencing another component's api is not self-contained and
 * fails here, not in a user's project.
 */
Deno.test("tree-view variants are self-contained", () => {
  assert(TREE_VIEW_VARIANTS.length > 0, "the machine ships at least one variant");
  const names = new Set<string>();
  for (const variant of TREE_VIEW_VARIANTS) {
    assert(variant.name.length > 0, "every variant is named");
    assert(!names.has(variant.name), `duplicate variant ${variant.name}`);
    names.add(variant.name);
    assert(
      variant.html.includes("<spin-tree-view"),
      `${variant.name} renders the element`,
    );
    const spreads = [...variant.html.matchAll(/\{\.\.\.([a-zA-Z]+)\./g)]
      .map((m) => m[1]);
    for (const api of spreads) {
      assertEquals(api, "treeView", `${variant.name} spreads only its own bags`);
    }
  }
});
