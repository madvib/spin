import { test } from "bun:test";
import { deepStrictEqual } from "node:assert/strict";
/**
 * The theme mapping the montage is built on.
 *
 * The montage's honesty rests on one thing: a column shows the theme it is
 * named after, in the renderings that theme actually serves. These are the
 * rules that decide which renderings those are.
 */
import { designLanguages, themeModes } from "@spinjs/theme";
import { renderingsFor } from "./themes.ts";

test("a theme renders its own face, and its dark restatement when it has one", () => {
  for (const [name, doc] of Object.entries(designLanguages)) {
    const serves = themeModes(doc);
    const both = serves.includes("light") && serves.includes("dark");
    const renderings = renderingsFor(name);
    deepStrictEqual(renderings.length, both ? 2 : 1, `${name} rendering count`);
    deepStrictEqual(
      renderings[0]?.mode,
      serves.includes("light") ? "light" : serves[0] ?? "base",
      `${name} first rendering`,
    );
    if (both) {
      deepStrictEqual(renderings[1]?.mode, "dark", `${name} dark rendering`);
    }
  }
});

test("a rendering is named by the mode the reader sees", () => {
  for (const name of ["minimal", "editorial", "material", "neobrutalist", "neumorphic", "glassmorphic"] as const) {
    deepStrictEqual(
      renderingsFor(name).map((r) => r.label),
      ["light", "dark"],
      `${name}'s labels`,
    );
  }
});

test("a theme that is not one of ours renders nothing", () => {
  deepStrictEqual(renderingsFor("acme"), [], "an unknown theme");
});
