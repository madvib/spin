import { test } from "bun:test";
import { deepStrictEqual } from "node:assert/strict";
import { parseTokens } from "@spinjs/theme";
import type { TokenTree } from "@spinjs/theme";
import { colorRoles, colorTargets, neutralRamp } from "./colors.ts";

/**
 * A theme small enough to read, with the cases the colours page has to get
 * right: a value that varies by mode, a value that IS a reference, a
 * reference written as a dark override, a colour written in a space that is
 * not hex, and the ramp's own steps.
 */
const DOC = {
  modes: ["light", "dark"],
  color: {
    $type: "color",
    primary: { $value: "#112233", $modes: { dark: "#445566" } },
    secondary: { $value: "#334455" },
    accent: { $value: "oklch(60% 0.1 200)" },
    link: { $value: "{color.primary}" },
    neutral: {
      100: { $value: "#eeeeee" },
      800: { $value: "#1f1f1f" },
    },
    semantic: {
      success: { $value: "#0b5c22" },
      error: { $value: "#a6312b" },
    },
    "on-semantic-success": { $value: "#ffffff" },
    surface: { $value: "{color.neutral.100}" },
    "surface-raised": { $value: "#ffffff" },
    "surface-sunken": {
      $value: "{color.neutral.100}",
      $modes: { dark: "{color.neutral.800}" },
    },
    text: { $value: "{color.neutral.800}" },
  },
};

/** The tree the fixture parses to. */
function tree(): TokenTree {
  const parsed = parseTokens(JSON.stringify(DOC));
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.tree;
}

/** The role the page names by its path. */
function role(path: string) {
  const found = colorRoles(tree(), true).find((entry) => entry.path === path);
  if (found === undefined) throw new Error(`no role at ${path}`);
  return found;
}

test("a theme's colours fall into the three families", () => {
  const families = new Map(
    colorRoles(tree(), true).map((entry) => [entry.path, entry.family]),
  );
  deepStrictEqual(families.get("color.primary"), "brand");
  deepStrictEqual(families.get("color.link"), "brand");
  deepStrictEqual(families.get("color.surface"), "neutral");
  deepStrictEqual(families.get("color.text"), "neutral");
  deepStrictEqual(families.get("color.semantic.success"), "status");
  deepStrictEqual(families.get("color.on-semantic-success"), "status");
});

test("the ramp's steps are not roles: they are the ramp's own spelling", () => {
  const paths = colorRoles(tree(), true).map((entry) => entry.path);
  deepStrictEqual(paths.includes("color.neutral.100"), false);
  deepStrictEqual(neutralRamp(tree()).map((step) => step.step), ["100", "800"]);
});

test("a role's value says whether it is set or computed", () => {
  const set = role("color.primary");
  deepStrictEqual(set.base.computed, false);
  deepStrictEqual(set.base.reference, null);
  deepStrictEqual(set.base.value, "#112233");

  const computed = role("color.link");
  deepStrictEqual(computed.base.computed, true);
  deepStrictEqual(computed.base.reference, "color.primary");
  // And what it resolves to: a reference is worth the colour it points at.
  deepStrictEqual(computed.base.value, "#112233");
});

test("a colour is worth a hex, whatever the document wrote", () => {
  const accent = role("color.accent");
  deepStrictEqual(accent.base.value, "oklch(60% 0.1 200)");
  deepStrictEqual(accent.base.hex, "#0d9298");
});

test("a mode that restates a role says so, and a mode that does not falls back", () => {
  const primary = role("color.primary");
  deepStrictEqual(primary.restated, true);
  deepStrictEqual(primary.dark?.value, "#445566");

  const secondary = role("color.secondary");
  deepStrictEqual(secondary.restated, false);
  // The dark slot falls back to the base, and says the base's value.
  deepStrictEqual(secondary.dark?.value, "#334455");
});

test("a dark reference resolves against the dark values", () => {
  // The theme points its sunken surface at a step of the ramp, and the step
  // is restated for the dark mode: the surface follows the ramp.
  const sunken = role("color.surface-sunken");
  deepStrictEqual(sunken.base.value, "#eeeeee");
  deepStrictEqual(sunken.dark?.value, "#1f1f1f");
  deepStrictEqual(sunken.dark?.computed, true);
  deepStrictEqual(sunken.dark?.reference, "color.neutral.800");
});

test("a theme that serves no dark mode has no dark column", () => {
  const roles = colorRoles(tree(), false);
  deepStrictEqual(roles.every((entry) => entry.dark === null), true);
});

test("the tokens a role can point at are the theme's own colours", () => {
  const targets = colorTargets(tree(), "light");
  const paths = targets.map((target) => target.path);
  deepStrictEqual(paths.includes("color.neutral.100"), true);
  deepStrictEqual(paths.includes("color.primary"), true);
  // The ramp's steps are offerable: pointing a surface at a step of the
  // ramp is how a theme keeps its greys in step.
  deepStrictEqual(
    targets.find((target) => target.path === "color.neutral.100")?.ramp,
    true,
  );
  deepStrictEqual(
    targets.find((target) => target.path === "color.primary")?.ramp,
    false,
  );
});
