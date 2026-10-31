import { test } from "bun:test";
import { deepStrictEqual } from "node:assert/strict";
/**
 * The theme mapping the montage is built on.
 *
 * The montage's honesty rests on one thing: a column shows the theme it is
 * named after, in the renderings that theme actually serves. These are the
 * rules that decide which renderings those are.
 */
import { starterThemes, themeModes } from "@spinjs/spin/theme/themes";
import { renderingsFor } from "./themes.ts";

test("a theme renders its own face, and its dark restatement when it has one", () => {
  for (const name of Object.keys(starterThemes)) {
    const serves = themeModes(
      starterThemes[name as keyof typeof starterThemes],
    );
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
  // console's base IS its dark face: it has no light rendering to show, and
  // showing its base twice would be a theme pretending to have a second one.
  deepStrictEqual(
    renderingsFor("console").map((r) => r.label),
    ["dark"],
    "console's label",
  );
  deepStrictEqual(
    renderingsFor("neobrut").map((r) => r.label),
    ["light"],
    "neobrut's label",
  );
  deepStrictEqual(
    renderingsFor("silk").map((r) => r.label),
    ["light", "dark"],
    "silk's labels",
  );
});

test("a theme that is not one of ours renders nothing", () => {
  deepStrictEqual(renderingsFor("acme"), [], "an unknown theme");
});
