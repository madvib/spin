import { test } from "bun:test";
import { deepStrictEqual } from "node:assert/strict";
import { parseTokens } from "@spin/theme";
import type { TokenTree } from "@spin/theme";
import {
  durationUtility,
  elementSamples,
  faceSpecimens,
  paletteChips,
  spaceSteps,
  summarySwatches,
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

test("tokenValue answers what a token is worth in the mode asked for", () => {
  deepStrictEqual(tokenValue(tree(), "light", "color.primary"), "#112233");
  deepStrictEqual(tokenValue(tree(), "dark", "color.primary"), "#445566");
});

test("tokenValue follows a reference to the value it points at", () => {
  deepStrictEqual(tokenValue(tree(), "light", "color.link"), "#112233");
  deepStrictEqual(tokenValue(tree(), "light", "color.surface-sunken"), "#eeeeee");
});

test("tokenValue follows a reference written as a dark override", () => {
  deepStrictEqual(tokenValue(tree(), "dark", "color.surface-sunken"), "#1f1f1f");
});

test("tokenValue answers undefined for a path the theme does not declare", () => {
  deepStrictEqual(tokenValue(tree(), "light", "color.accent"), undefined);
});

test("paletteChips shows the roles this theme declares, in palette order", () => {
  deepStrictEqual(
    paletteChips(TEXT, "light").map((chip) => chip.path),
    ["color.primary", "color.link"],
  );
});

test("paletteChips paints each chip with a utility named after its token", () => {
  const chip = paletteChips(TEXT, "light").find((c) => c.path === "color.link");
  deepStrictEqual(chip?.paint, "bg-link");
  deepStrictEqual(chip?.label, "Link");
});

test("paletteChips reads the mode it is asked to show", () => {
  const dark = paletteChips(TEXT, "dark").find((c) =>
    c.path === "color.primary"
  );
  deepStrictEqual(dark?.value, "#445566");
});

test("summarySwatches reads one palette per mode the theme declares", () => {
  const groups = summarySwatches(TEXT);
  deepStrictEqual(
    groups.map((group) => group.mode),
    ["light", "dark"],
  );
  const primary = (mode: string) =>
    groups.find((group) => group.mode === mode)?.chips.find((chip) =>
      chip.path === "color.primary"
    )?.value;
  deepStrictEqual(primary("light"), "#112233");
  deepStrictEqual(primary("dark"), "#445566");
});

test("summarySwatches reads a theme that declares one mode as one palette", () => {
  const solo = summarySwatches(JSON.stringify({
    modes: ["light"],
    color: { $type: "color", primary: { $value: "#0f1115" } },
  }));
  deepStrictEqual(
    solo.map((group) => group.mode),
    ["light"],
  );
  deepStrictEqual(
    solo[0]?.chips.find((chip) => chip.path === "color.primary")?.value,
    "#0f1115",
  );
});

test("summarySwatches answers a document that does not parse with nothing", () => {
  // The overview keeps rendering while an author is mid-edit: a summary of a
  // half-typed document is empty, not a crash.
  deepStrictEqual(summarySwatches("{not json"), []);
});

test("surfaceSteps reads the ladder from the page down", () => {
  deepStrictEqual(
    surfaceSteps(TEXT, "light").map((step) => step.path),
    ["color.surface-sunken", "color.surface", "color.surface-raised"],
  );
});

test("surfaceSteps shows the dark value of a step that is a reference", () => {
  const dark = surfaceSteps(TEXT, "dark");
  deepStrictEqual(
    dark.find((s) => s.path === "color.surface-sunken")?.value,
    "#1f1f1f",
  );
  deepStrictEqual(dark.find((s) => s.path === "color.surface")?.value, "#fafafa");
});

test("faceSpecimens shows the slots this theme declares, leading with the display face", () => {
  deepStrictEqual(
    faceSpecimens(TEXT, "light").map((face) => face.slot),
    ["heading", "sans", "mono"],
  );
});

test("faceSpecimens carries the stack and the utility that draws it", () => {
  const heading = faceSpecimens(TEXT, "light").find((f) =>
    f.slot === "heading"
  );
  deepStrictEqual(heading?.stack, "Georgia, serif");
  deepStrictEqual(heading?.paint, "font-heading");
});

/**
 * The zero step is a real step, and it is also a bar of no width: showing it
 * as a specimen says nothing. The three that remain are the scale's ends and
 * its middle — the sample an overview gives of a scale too long to show whole.
 */
test("spaceSteps reads the ends and the middle of the scale", () => {
  deepStrictEqual(
    spaceSteps(TEXT, "light").map((step) => step.path),
    ["spacing.1", "spacing.4", "spacing.16"],
  );
});

test("durationUtility names a duration the way the stylesheet spells it", () => {
  deepStrictEqual(durationUtility("motion.duration.fast"), "duration-fast");
  deepStrictEqual(durationUtility("motion.duration.base"), "duration-base");
});

/** What the RPC sends: components with examples, and components without. */
const LIBRARY = [
  {
    name: "button",
    examples: {
      note: "",
      rows: [
        { name: "default", html: "<button>Ok</button>" },
        {
          name: "secondary",
          html: '<button variant="secondary">Cancel</button>',
        },
      ],
    },
  },
  { name: "rule" },
  { name: "empty", examples: { note: "", rows: [] } },
  {
    name: "alert",
    examples: {
      note: "",
      rows: [{ name: "tone", html: "<alert>Saved</alert>" }],
    },
  },
  {
    name: "badge",
    examples: { note: "", rows: [{ name: "base", html: "<badge>3</badge>" }] },
  },
  {
    name: "card",
    examples: { note: "", rows: [{ name: "base", html: "<card></card>" }] },
  },
];

test("elementSamples samples the components that have examples", () => {
  const samples = elementSamples(LIBRARY);
  deepStrictEqual(
    samples.map((sample) => sample.component),
    ["button", "alert", "badge"],
  );
  // One row per component: the card is a sample of the vocabulary, not a
  // second copy of the gallery's every variant.
  deepStrictEqual(samples[0]?.row.name, "default");
  deepStrictEqual(samples[0]?.row.html, "<button>Ok</button>");
});
