import { assert, assertEquals, assertStringIncludes } from "@std/assert";
import { renderToString } from "solid-js/web";
import { Logo, Mark } from "../src/index.ts";

/**
 * The brand mark: two pieces, and the contract each of them keeps.
 *
 * The hero is the spinnaker — a picture, and the one piece that moves. The
 * corner mark is the same creature at the size a corner mark actually
 * appears: a filled silhouette in one ink, so it wears any surface and holds
 * its edge at sixteen pixels.
 *
 * These are rendered, not described: the assertions read the markup a
 * browser would paint, because that is the only thing a reader ever sees.
 */

/** The `d` of every path in a rendered mark, in order. */
function paths(html: string): readonly string[] {
  return [...html.matchAll(/ d="([^"]*)"/g)].map((match) => match[1] ?? "");
}

/** The hero, rendered as the reader's system asks for it. */
async function hero(reduced: boolean): Promise<string> {
  const original = globalThis.matchMedia;
  globalThis.matchMedia = ((query: string) => ({
    matches: reduced,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof globalThis.matchMedia;
  try {
    return await renderToString(() => <Mark class="w-full" />);
  } finally {
    globalThis.matchMedia = original;
  }
}

Deno.test("the kit's entry point carries both marks", () => {
  assertEquals(typeof Mark, "function");
  assertEquals(typeof Logo, "function");
  assert(Mark !== Logo, "the hero and the corner mark are two pieces");
});

Deno.test("the corner mark draws at the size it is given", async () => {
  // A rail, a header, a page: the sizes a corner mark actually appears at.
  const rail = await renderToString(() => <Logo size="sm" />);
  assertStringIncludes(rail, 'width="20"');
  assertStringIncludes(rail, 'height="20"');
  assertStringIncludes(rail, "h-5 w-5");

  const header = await renderToString(() => <Logo size="md" />);
  assertStringIncludes(header, 'width="32"');
  assertStringIncludes(header, 'height="32"');
  assertStringIncludes(header, "h-8 w-8");
});

Deno.test("the corner mark is one drawing at every size", async () => {
  // A mark that is redrawn per size is two marks to keep true.
  const rail = await renderToString(() => <Logo size="sm" />);
  const header = await renderToString(() => <Logo size="md" />);
  assertEquals(paths(rail), paths(header));
});

Deno.test("the corner mark is painted in the ink it inherits", async () => {
  // One ink, so the mark wears whatever surface it lands on: the web is one
  // filled path, painted in the colour it inherits.
  const html = await renderToString(() => <Logo size="sm" />);
  assertStringIncludes(html, 'fill="currentColor"');
});

Deno.test("the corner mark carries the wordmark in the brand face", async () => {
  // The mark carries the picture; the word carries the name.
  const html = await renderToString(() => <Logo size="sm" />);
  assertStringIncludes(html, "font-brand");
  assertStringIncludes(html, ">spin<");
});

Deno.test("the hero is whole and still when motion is not wanted", async () => {
  // Every thread drawn, the spider where it hangs: the drawing, finished.
  const html = await hero(true);
  assertStringIncludes(html, 'stroke-dashoffset="0"');
  assertStringIncludes(html, 'opacity="1"');
});

Deno.test("the hero draws itself in when motion is welcome", async () => {
  // The spokes start hidden and are drawn out from the hub.
  const html = await hero(false);
  assertStringIncludes(html, 'stroke-dashoffset="1"');
});
