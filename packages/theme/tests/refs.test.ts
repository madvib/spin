import { assertEquals } from "@std/assert";
import { indexTree, parseTokens, themeKey, themeRef } from "@spin/theme";
import { starterThemes } from "@spin/theme/themes";

/**
 * The projection's contract: total, and named by the property itself.
 *
 * `themeRef` carries every leaf of a tree under its custom property name, so
 * there is no exposure table and no row to forget; what is worth testing is
 * that the projection is total, and that the two spellings a caller might
 * have — the DTCG path and the dashes — address the same entry.
 */

function refOf(name: keyof typeof starterThemes) {
  const parsed = parseTokens(starterThemes[name]);
  if (!parsed.ok) throw new Error(`${name}: ${parsed.error}`);
  return { tree: parsed.tree, ref: themeRef(parsed.tree) };
}

Deno.test("the projection carries every token of a theme", () => {
  const { tree, ref } = refOf("silk");
  for (const leaf of Object.values(indexTree(tree).leaves)) {
    const name = themeKey(leaf.path.join("."));
    assertEquals(
      ref[name],
      `var(--${name})`,
      `${leaf.path.join(".")} must be in the map under its property name`,
    );
  }
});

Deno.test("a dotted path and its dashes name one entry", () => {
  const { ref } = refOf("silk");
  assertEquals(ref[themeKey("font.family.sans")], "var(--font-family-sans)");
  assertEquals(ref[themeKey("color.neutral.500")], "var(--color-neutral-500)");
  assertEquals(
    ref[themeKey("font.family.sans")],
    ref["font-family-sans"],
  );
});
