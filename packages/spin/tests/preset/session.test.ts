import { afterEach, test } from "bun:test";
import assert, { deepStrictEqual } from "node:assert/strict";
import {
  clearOverlay,
  hasOverlay,
  noteDiskDocuments,
  overlayDirty,
  overlayThemes,
  resolveThemes,
  setOverlay,
} from "../../src/plugin/session.ts";
import type { ThemeDocument } from "../../src/theme/index.ts";

// Bun runs test files in one process, so module state leaks across files:
// an overlay left set here merges into every preset generation after it
// (resolveThemes). Deno ran files in isolation and never saw this.
afterEach(() => {
  clearOverlay();
});

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

test("with no overlay open the caller's documents are the source", () => {
  reset();
  deepStrictEqual(resolveThemes(disk), disk);
  assert(!hasOverlay());
});

test("an overlay wins over disk while it is set", () => {
  reset();
  setOverlay(editing);
  const resolved = resolveThemes(disk);
  deepStrictEqual(resolved.acme.primary, "#b91c1c");
});

test("a theme the overlay does not name still resolves from disk", () => {
  reset();
  setOverlay(editing);
  const both = {
    acme: { primary: "#0369a1" },
    other: { primary: "#15803d" },
  } as unknown as Record<string, ThemeDocument>;
  const resolved = resolveThemes(both);
  deepStrictEqual(resolved.acme.primary, "#b91c1c");
  deepStrictEqual(resolved.other.primary, "#15803d");
});

test("clearing the overlay restores disk as the source", () => {
  reset();
  setOverlay(editing);
  clearOverlay();
  deepStrictEqual(resolveThemes(disk), disk);
  assert(!hasOverlay());
});

test("an overlay can name a document disk does not have", () => {
  reset();
  setOverlay({ brand: { primary: "#b91c1c" } } as unknown as Record<
    string,
    ThemeDocument
  >);
  deepStrictEqual(Object.keys(resolveThemes(disk)).sort(), ["acme", "brand"]);
  reset();
});

test("the overlay is stored as a copy, so the caller cannot edit through it", () => {
  reset();
  const live = { acme: { primary: "#b91c1c" } } as unknown as Record<
    string,
    ThemeDocument
  >;
  setOverlay(live);
  live.acme.primary = "#000000";
  deepStrictEqual(overlayThemes().acme.primary, "#b91c1c");
  reset();
});

test("reading the overlay hands back a copy too", () => {
  reset();
  setOverlay(editing);
  const read = overlayThemes();
  read.acme.primary = "#000000";
  deepStrictEqual(resolveThemes(disk).acme.primary, "#b91c1c");
  reset();
});

test("a theme matching disk reads clean", () => {
  reset();
  const doc = { primary: "#0369a1" } as unknown as ThemeDocument;
  noteDiskDocuments({ acme: doc });
  setOverlay({ acme: { primary: "#0369a1" } } as unknown as Record<
    string,
    ThemeDocument
  >);
  deepStrictEqual(overlayDirty(), []);
});

test("a theme differing from disk reads dirty", () => {
  reset();
  noteDiskDocuments({
    acme: { primary: "#0369a1" },
  } as unknown as Record<string, ThemeDocument>);
  setOverlay({ acme: { primary: "#b91c1c" } } as unknown as Record<
    string,
    ThemeDocument
  >);
  deepStrictEqual(overlayDirty(), ["acme"]);
});

test("an overlaid theme disk never had reads dirty", () => {
  reset();
  noteDiskDocuments({});
  setOverlay({ brand: { primary: "#b91c1c" } } as unknown as Record<
    string,
    ThemeDocument
  >);
  deepStrictEqual(overlayDirty(), ["brand"]);
});
