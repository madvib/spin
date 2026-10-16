import { assert, assertEquals } from "@std/assert";

/**
 * Variants are copy-paste: each file names the element it needs and
 * spreads only this machine's bags. A variant referencing another
 * component's api is not self-contained and fails here, not in a user's
 * project. Files are discovered, not listed: `examples/*.html`, stem is
 * the name.
 */
Deno.test("tree-view examples are self-contained", async () => {
  const dir = new URL("./examples/", import.meta.url);
  const stems: string[] = [];
  for await (const entry of Deno.readDir(dir)) {
    if (!entry.isFile || !entry.name.endsWith(".html")) continue;
    stems.push(entry.name.slice(0, -".html".length));
    const html = await Deno.readTextFile(new URL(`./examples/${entry.name}`, import.meta.url));
    assert(
      html.includes("<spin-tree-view"),
      `${entry.name} renders the element`,
    );
    const spreads = [...html.matchAll(/\.\.\.([a-zA-Z]+)\./g)]
      .map((m) => m[1]);
    for (const api of spreads) {
      assertEquals(api, "treeView", `${entry.name} spreads only its own bags`);
    }
  }
  assert(stems.length > 0, "the machine ships at least one variant");
});
