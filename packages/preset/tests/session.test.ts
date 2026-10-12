import { assert, assertEquals } from "@std/assert";
import {
  clearOverlay,
  hasOverlay,
  overlayThemes,
  resolveThemes,
  setOverlay,
} from "../src/session.ts";
import type { ThemeDocument } from "@spin/theme";

const disk = { acme: { primary: "#0369a1" } } as unknown as Record<
  string,
  ThemeDocument
>;
const editing = { acme: { primary: "#b91c1c" } } as unknown as Record<
  string,
  ThemeDocument
>;

function reset() {
  clearOverlay();
}

Deno.test("with no overlay open the caller's documents are the source", () => {
  reset();
  assertEquals(resolveThemes(disk), disk);
  assert(!hasOverlay());
});

Deno.test("an overlay wins over disk while it is set", () => {
  reset();
  setOverlay(editing);
  const resolved = resolveThemes(disk);
  assertEquals(resolved.acme.primary, "#b91c1c");
});

Deno.test("clearing the overlay restores disk as the source", () => {
  reset();
  setOverlay(editing);
  clearOverlay();
  assertEquals(resolveThemes(disk), disk);
  assert(!hasOverlay());
});

Deno.test("an overlay can name a document disk does not have", () => {
  reset();
  setOverlay({ brand: { primary: "#b91c1c" } } as unknown as Record<
    string,
    ThemeDocument
  >);
  assertEquals(Object.keys(resolveThemes(disk)), ["brand"]);
  reset();
});

Deno.test("the overlay is stored as a copy, so the caller cannot edit through it", () => {
  reset();
  const live = { acme: { primary: "#b91c1c" } } as unknown as Record<
    string,
    ThemeDocument
  >;
  setOverlay(live);
  live.acme.primary = "#000000";
  assertEquals(overlayThemes().acme.primary, "#b91c1c");
  reset();
});

Deno.test("reading the overlay hands back a copy too", () => {
  reset();
  setOverlay(editing);
  const read = overlayThemes();
  read.acme.primary = "#000000";
  assertEquals(resolveThemes(disk).acme.primary, "#b91c1c");
  reset();
});
