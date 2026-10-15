import { assertEquals } from "@std/assert";
import { parseTokens } from "@spin/theme";
import type { TokenTree } from "@spin/theme";
import {
  durationUtility,
  elementSamples,
  faceSpecimens,
  paletteChips,
  spaceSteps,
  surfaceSteps,
  tokenValue,
} from "./overview.ts";

/**
 * A theme small enough to read, with the three cases the overview has to
 * get right: a value that varies by mode, a value that IS a reference, and a
 * reference written as a dark override.
 */
const DOC = {
  modes: ["light", "dark"],
  color: {
    $type: "color",
    primary: { $value: "#112233", $modes: { dark: "#445566" } },
    link: { $value: "{color.primary}" },
    neutral: {
      100: { $value: "#eeeeee" },
      800: { $value: "#1f1f1f" },
    },
    "surface-sunken": {
      $value: "{color.neutral.100}",
      $modes: { dark: "{color.neutral.800}" },
    },
    surface: { $value: "#fafafa" },
    "surface-raised": { $value: "#ffffff" },
  },
  font: {
    family: {
      $type: "fontFamily",
      heading: { $value: "Georgia, serif" },
      sans: { $value: "Inter, sans-serif" },
      mono: { $value: "ui-monospace, monospace" },
    },
  },
  spacing: {
    $type: "dimension",
    "0": { $value: "0px" },
    "1": { $value: "0.25rem" },
    "2": { $value: "0.5rem" },
    "4": { $value: "1rem" },
    "8": { $value: "2rem" },
    "16": { $value: "4rem" },
  },
  motion: {
    duration: {
      $type: "duration",
      fast: { $value: "150ms" },
      base: { $value: "300ms" },
    },
  },
};

const TEXT = JSON.stringify(DOC, null, 2);

function tree(): TokenTree {
  const parsed = parseTokens(JSON.parse(TEXT));
  if (!parsed.ok) throw new Error(`fixture does not parse: ${parsed.error}`);
  return parsed.tree;
}

Deno.test("tokenValue answers what a token is worth in the mode asked for", () => {
  assertEquals(tokenValue(tree(), "light", "color.primary"), "#112233");
  assertEquals(tokenValue(tree(), "dark", "color.primary"), "#445566");
});

Deno.test("tokenValue follows a reference to the value it points at", () => {
  assertEquals(tokenValue(tree(), "light", "color.link"), "#112233");
  assertEquals(tokenValue(tree(), "light", "color.surface-sunken"), "#eeeeee");
});

Deno.test("tokenValue follows a reference written as a dark override", () => {
  assertEquals(tokenValue(tree(), "dark", "color.surface-sunken"), "#1f1f1f");
});

Deno.test("tokenValue answers undefined for a path the theme does not declare", () => {
  assertEquals(tokenValue(tree(), "light", "color.accent"), undefined);
});

Deno.test("paletteChips shows the roles this theme declares, in palette order", () => {
  assertEquals(
    paletteChips(TEXT, "light").map((chip) => chip.path),
    ["color.primary", "color.link"],
  );
});

Deno.test("paletteChips paints each chip with a utility named after its token", () => {
  const chip = paletteChips(TEXT, "light").find((c) => c.path === "color.link");
  assertEquals(chip?.paint, "bg-link");
  assertEquals(chip?.label, "Link");
});

Deno.test("paletteChips reads the mode it is asked to show", () => {
  const dark = paletteChips(TEXT, "dark").find((c) =>
    c.path === "color.primary"
  );
  assertEquals(dark?.value, "#445566");
});

Deno.test("surfaceSteps reads the ladder from the page down", () => {
  assertEquals(
    surfaceSteps(TEXT, "light").map((step) => step.path),
    ["color.surface-sunken", "color.surface", "color.surface-raised"],
  );
});

Deno.test("surfaceSteps shows the dark value of a step that is a reference", () => {
  const dark = surfaceSteps(TEXT, "dark");
  assertEquals(dark.find((s) => s.path === "color.surface-sunken")?.value, "#1f1f1f");
  assertEquals(dark.find((s) => s.path === "color.surface")?.value, "#fafafa");
});

Deno.test("faceSpecimens shows the slots this theme declares, leading with the display face", () => {
  assertEquals(
    faceSpecimens(TEXT, "light").map((face) => face.slot),
    ["heading", "sans", "mono"],
  );
});

Deno.test("faceSpecimens carries the stack and the utility that draws it", () => {
  const heading = faceSpecimens(TEXT, "light").find((f) => f.slot === "heading");
  assertEquals(heading?.stack, "Georgia, serif");
  assertEquals(heading?.paint, "font-heading");
});

/**
 * The zero step is a real step, and it is also a bar of no width: showing it
 * as a specimen says nothing. The three that remain are the scale's ends and
 * its middle — the sample an overview gives of a scale too long to show whole.
 */
Deno.test("spaceSteps reads the ends and the middle of the scale", () => {
  assertEquals(
    spaceSteps(TEXT, "light").map((step) => step.path),
    ["spacing.1", "spacing.4", "spacing.16"],
  );
});

Deno.test("durationUtility names a duration the way the stylesheet spells it", () => {
  assertEquals(durationUtility("motion.duration.fast"), "duration-fast");
  assertEquals(durationUtility("motion.duration.base"), "duration-base");
});

/** What the RPC sends: components with examples, and components without. */
const LIBRARY = [
  {
    name: "button",
    examples: {
      note: "",
      rows: [
        { name: "default", html: "<button>Ok</button>" },
        { name: "secondary", html: '<button variant="secondary">Cancel</button>' },
      ],
    },
  },
  { name: "rule" },
  { name: "empty", examples: { note: "", rows: [] } },
  { name: "alert", examples: { note: "", rows: [{ name: "tone", html: "<alert>Saved</alert>" }] } },
  { name: "badge", examples: { note: "", rows: [{ name: "base", html: "<badge>3</badge>" }] } },
  { name: "card", examples: { note: "", rows: [{ name: "base", html: "<card></card>" }] } },
];

Deno.test("elementSamples samples the components that have examples", () => {
  const samples = elementSamples(LIBRARY);
  assertEquals(
    samples.map((sample) => sample.component),
    ["button", "alert", "badge"],
  );
  // One row per component: the card is a sample of the vocabulary, not a
  // second copy of the gallery's every variant.
  assertEquals(samples[0]?.row.name, "default");
  assertEquals(samples[0]?.row.html, "<button>Ok</button>");
});
