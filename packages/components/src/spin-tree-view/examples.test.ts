import { assert, assertEquals } from "@std/assert";

/**
 * Examples are copy-paste own-elements: each file carries its scope
 * (data + consume) and spreads only this machine's bags. An example
 * referencing another component's api is not self-contained and fails
 * here, not in a user's project. Files are discovered, not listed:
 * `examples/*.html`, stem is the name.
 */
Deno.test("tree-view examples are self-contained", async () => {
  const dir = new URL("./examples/", import.meta.url);
  const stems: string[] = [];
  for await (const entry of Deno.readDir(dir)) {
    if (!entry.isFile || !entry.name.endsWith(".html")) continue;
    stems.push(entry.name.slice(0, -".html".length));
    const html = await Deno.readTextFile(new URL(`./examples/${entry.name}`, import.meta.url));
    assert(
      html.includes("<scope>") && html.includes("consume={ treeView }"),
      `${entry.name} consumes this machine`,
    );
    const spreads = [...html.matchAll(/\.\.\.([a-zA-Z]+)\./g)]
      .map((m) => m[1]);
    assert(spreads.length > 0, `${entry.name} spreads bags`);
    for (const api of spreads) {
      assertEquals(api, "treeView", `${entry.name} spreads only its own bags`);
    }
  }
  assert(stems.length > 0, "the machine ships at least one example");
});
