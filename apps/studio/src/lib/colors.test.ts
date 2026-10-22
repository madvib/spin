import { assertEquals } from "@std/assert";
import { parseTokens } from "@spin/theme";
import type { TokenTree } from "@spin/theme";
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

Deno.test("a theme's colours fall into the three families", () => {
  const families = new Map(
    colorRoles(tree(), true).map((entry) => [entry.path, entry.family]),
  );
  assertEquals(families.get("color.primary"), "brand");
  assertEquals(families.get("color.link"), "brand");
  assertEquals(families.get("color.surface"), "neutral");
  assertEquals(families.get("color.text"), "neutral");
  assertEquals(families.get("color.semantic.success"), "status");
  assertEquals(families.get("color.on-semantic-success"), "status");
});

Deno.test("the ramp's steps are not roles: they are the ramp's own spelling", () => {
  const paths = colorRoles(tree(), true).map((entry) => entry.path);
  assertEquals(paths.includes("color.neutral.100"), false);
  assertEquals(neutralRamp(tree()).map((step) => step.step), ["100", "800"]);
});

Deno.test("a role's value says whether it is set or computed", () => {
  const set = role("color.primary");
  assertEquals(set.base.computed, false);
  assertEquals(set.base.reference, null);
  assertEquals(set.base.value, "#112233");

  const computed = role("color.link");
  assertEquals(computed.base.computed, true);
  assertEquals(computed.base.reference, "color.primary");
  // And what it resolves to: a reference is worth the colour it points at.
  assertEquals(computed.base.value, "#112233");
});

Deno.test("a colour is worth a hex, whatever the document wrote", () => {
  const accent = role("color.accent");
  assertEquals(accent.base.value, "oklch(60% 0.1 200)");
  assertEquals(accent.base.hex, "#0d9298");
});

Deno.test("a mode that restates a role says so, and a mode that does not falls back", () => {
  const primary = role("color.primary");
  assertEquals(primary.restated, true);
  assertEquals(primary.dark?.value, "#445566");

  const secondary = role("color.secondary");
  assertEquals(secondary.restated, false);
  // The dark slot falls back to the base, and says the base's value.
  assertEquals(secondary.dark?.value, "#334455");
});

Deno.test("a dark reference resolves against the dark values", () => {
  // The theme points its sunken surface at a step of the ramp, and the step
  // is restated for the dark mode: the surface follows the ramp.
  const sunken = role("color.surface-sunken");
  assertEquals(sunken.base.value, "#eeeeee");
  assertEquals(sunken.dark?.value, "#1f1f1f");
  assertEquals(sunken.dark?.computed, true);
  assertEquals(sunken.dark?.reference, "color.neutral.800");
});

Deno.test("a theme that serves no dark mode has no dark column", () => {
  const roles = colorRoles(tree(), false);
  assertEquals(roles.every((entry) => entry.dark === null), true);
});

Deno.test("the tokens a role can point at are the theme's own colours", () => {
  const targets = colorTargets(tree(), "light");
  const paths = targets.map((target) => target.path);
  assertEquals(paths.includes("color.neutral.100"), true);
  assertEquals(paths.includes("color.primary"), true);
  // The ramp's steps are offerable: pointing a surface at a step of the
  // ramp is how a theme keeps its greys in step.
  assertEquals(
    targets.find((target) => target.path === "color.neutral.100")?.ramp,
    true,
  );
  assertEquals(
    targets.find((target) => target.path === "color.primary")?.ramp,
    false,
  );
});
