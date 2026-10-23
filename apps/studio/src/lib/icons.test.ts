import { assert, assertEquals } from "@std/assert";

/**
 * The studio's client reads the page's address when it loads, so the module
 * that talks to the daemon cannot be imported in a runtime that has no
 * page. The stub stands in for the one thing it reads: an address with no
 * query on it.
 */
globalThis.location = { search: "" } as unknown as Location;

const { attributionText, iconMarkup } = await import("./icons.ts");

Deno.test("a saved icon's markup carries the box it was drawn in", () => {
  const markup = iconMarkup({
    body: '<path d="M5 12h14"/>',
    width: 24,
    height: 24,
  });

  assert(
    markup.includes('viewBox="0 0 24 24"'),
    `the box is in the markup: ${markup}`,
  );
  assert(
    markup.includes('<path d="M5 12h14"/>'),
    `the glyph is in the markup: ${markup}`,
  );
});

Deno.test("the attribution names the source it was given", () => {
  const text = attributionText({
    collection: "lucide",
    author: "Lucide Contributors",
    license: "ISC",
  });

  assert(text.includes("lucide"), `the collection is named: ${text}`);
  assert(text.includes("ISC"), `the licence is named: ${text}`);
});

Deno.test("an icon with no source recorded says so", () => {
  const text = attributionText({
    collection: null,
    author: null,
    license: null,
  });

  assert(text.includes("no source"), `the absence is said: ${text}`);
});

Deno.test("an attribution with only a collection names only that", () => {
  assertEquals(
    attributionText({
      collection: "carbon",
      author: null,
      license: null,
    }),
    "carbon",
  );
});
