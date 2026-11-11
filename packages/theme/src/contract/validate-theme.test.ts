import { test } from "bun:test";
import assert, { deepStrictEqual } from "node:assert/strict";
import { minimalTheme } from "../themes/index.ts";
import {
  validatePaletteFacet,
  validateSpacingFacet,
  validateTheme,
} from "./validate-theme.ts";
import type { ThemeReport } from "./validate-theme.ts";

/**
 * The operation that judges a theme document.
 *
 * The fixtures are minimal vendored — a document that declares every role a theme
 * owes and meets every floor — so each test changes exactly one fact about
 * it and reads the answer the module gives.
 */

/** A document that owes nothing, as text: minimal, vendored whole. */
function complete(): string {
  return JSON.stringify(minimalTheme, null, 2);
}

/** The document as text, with the token at a path taken out of it. */
function without(text: string, path: string): string {
  const doc = JSON.parse(text) as Record<string, unknown>;
  const segments = path.split(".");
  let node = doc;
  for (const segment of segments.slice(0, -1)) {
    node = node[segment] as Record<string, unknown>;
  }
  delete node[segments[segments.length - 1] as string];
  return JSON.stringify(doc, null, 2);
}

/** The document as text, with one token's base value changed. */
function withValue(text: string, path: string, value: unknown): string {
  const doc = JSON.parse(text) as Record<string, unknown>;
  const segments = path.split(".");
  let node = doc;
  for (const segment of segments.slice(0, -1)) {
    node = node[segment] as Record<string, unknown>;
  }
  const leaf = node[segments[segments.length - 1] as string] as Record<
    string,
    unknown
  >;
  leaf["$value"] = value;
  return JSON.stringify(doc, null, 2);
}

/** The document as text, with one token's value in one mode. */
function inMode(
  text: string,
  path: string,
  mode: string,
  value: unknown,
): string {
  const doc = JSON.parse(text) as Record<string, unknown>;
  const segments = path.split(".");
  let node = doc;
  for (const segment of segments.slice(0, -1)) {
    node = node[segment] as Record<string, unknown>;
  }
  const leaf = node[segments[segments.length - 1] as string] as Record<
    string,
    unknown
  >;
  leaf["$modes"] = {
    ...(leaf["$modes"] as Record<string, unknown> | undefined),
    [mode]: value,
  };
  return JSON.stringify(doc, null, 2);
}

/** The issue reported for a token, failing loudly when none was. */
function issueAt(report: ThemeReport, path: string) {
  const found = report.issues.find((issue) => issue.path === path);
  if (!found) {
    throw new Error(
      `expected an issue at "${path}", got: ${JSON.stringify(report.issues)}`,
    );
  }
  return found;
}

test("a theme that declares every role it owes is valid", () => {
  // Silk is a complete theme that satisfies the contract, so it is
  // the document the module says nothing is wrong with — the answer every
  // consumer reads.
  const report = validateTheme(complete());

  deepStrictEqual(report.valid, true);
  deepStrictEqual(report.issues, []);
  deepStrictEqual(report.error, undefined);
});

test("a theme missing a role it owes is reported at that role", () => {
  // The preview refuses to build a theme that is missing a role, so the
  // judgement that says a theme is fine cannot be the one the build makes:
  // the two would answer the same question differently.
  const report = validateTheme(without(complete(), "color.text"));

  deepStrictEqual(report.valid, false);
  assert(issueAt(report, "color.text").message.includes("color.text"));
});
test("a theme missing a scale step the baseline states is reported at that step", () => {
  // A step the baseline states is spendable by any utility: `h-60` with no
  // `spacing.60` emits no rule, and the specimen collapses — in that theme
  // only, with nothing saying why. The missing step is incomplete, not
  // minimal, and the judgement names it.
  const report = validateTheme(without(complete(), "spacing.60"));

  deepStrictEqual(report.valid, false);
  assert(issueAt(report, "spacing.60").message.includes("spacing.60"));
});

test("a theme with a value a browser will not take is reported at that token", () => {
  // The value is judged where it sits: a colour that is not a colour is a
  // mistake an author can find, and a path that says where is what lets them.
  const report = validateTheme(withValue(complete(), "color.primary", "#zzz"));

  deepStrictEqual(report.valid, false);
  assert(issueAt(report, "color.primary").message.length > 0);
});

test("a document that is not JSON is reported as such", () => {
  // A file an author is halfway through writing is not a theme yet, and the
  // studio has to say why rather than show nothing.
  const report = validateTheme("{ not json at all\n");

  deepStrictEqual(report.valid, false);
  assert(
    (report.error ?? "").includes("invalid JSON"),
    `the reason is not the parse's own: ${report.error}`,
  );
});

test("the floors are measured in the mode the theme is judged in", () => {
  // A palette is re-picked in dark, and a pair that reads on white can vanish
  // on charcoal. Judged in dark, the theme is judged as it reads there.
  const dark = validateTheme(
    inMode(complete(), "color.primary", "dark", "#111111"),
    { mode: "dark" },
  );

  deepStrictEqual(dark.valid, false);
  assert(
    issueAt(dark, "color.on-primary").message.includes(
      "text needs 4.5:1",
    ),
  );

  // And the base document still passes: the light pair is untouched by the
  // dark override, and a theme is judged in the mode it is read.
  const light = validateTheme(
    inMode(complete(), "color.primary", "dark", "#111111"),
  );
  deepStrictEqual(light.valid, true);
});

test("the modes a caller states are the modes the theme serves", () => {
  // A value written for a mode the theme does not serve is never shown, so
  // the claim is the caller's to make — and the module judges the claim.
  const doc = inMode(complete(), "color.primary", "dark", "#222222");
  const unserved = validateTheme(doc, { modes: ["light"] });

  deepStrictEqual(unserved.valid, false);
  assert(issueAt(unserved, "color.primary").message.includes("does not serve"));

  // The same document, judged by a caller that says the theme serves dark:
  // the override is shown, and the theme owes nothing.
  const served = validateTheme(doc, { modes: ["light", "dark"] });

  deepStrictEqual(served.valid, true);
  deepStrictEqual(served.issues, []);
});

test("the roles a caller states are the roles the document owes", () => {
  // The base roles are the module's own list, so a caller that judges a
  // theme against more than the base surface states the extra paths itself.
  const report = validateTheme(complete(), {
    required: ["color.never-declared"],
  });

  deepStrictEqual(report.valid, false);
  assert(issueAt(report, "color.never-declared").message.length > 0);
});

test("a theme object is judged, and a broken scale, loop, and restated spacing are reported", () => {
  // `validateTheme` takes the document, not just its text: a caller holding
  // the parsed object hands it over directly.
  const parsed = JSON.parse(complete()) as Record<string, unknown>;
  const valid = validateTheme(parsed);
  deepStrictEqual(valid.valid, true);
  deepStrictEqual(valid.issues, []);

  // A ladder that descends, a loop under the strobe floor, and a dark mode
  // with its own spacing: the full battery, not just the roles and floors.
  const doc = JSON.parse(complete()) as Record<string, unknown>;
  const spacing = doc["spacing"] as Record<string, unknown>;
  spacing["4"] = { $type: "dimension", $value: "0.125rem" };
  const motion = (doc["motion"] as Record<string, unknown>)["duration"] as Record<string, unknown>;
  motion["loop"] = { $type: "duration", $value: "120ms" };
  (spacing["8"] as Record<string, unknown>)["$modes"] = { dark: "9rem" };
  const report = validateTheme(doc);

  deepStrictEqual(report.valid, false);
  assert(issueAt(report, "spacing.4").message.includes("descends"));
  assert(issueAt(report, "motion.duration.loop").message.includes("strobe"));
  assert(issueAt(report, "spacing.8").message.includes("ink and focus"));
});

test("a palette facet carrying ink and modes is valid", () => {
  // A palette facet states ink alone; the base it composes with states the
  // rest, so the floors are measured where the facet is worn.
  const report = validatePaletteFacet({
    color: {
      $type: "color",
      primary: { $value: "#2563eb", $modes: { dark: "#8db9fa" } },
    },
  });

  deepStrictEqual(report.valid, true);
  deepStrictEqual(report.issues, []);
});

test("a palette facet carrying spacing is reported at that token", () => {
  const report = validatePaletteFacet({
    spacing: { $type: "dimension", 4: { $value: "1rem" } },
  });

  deepStrictEqual(report.valid, false);
  assert(issueAt(report, "spacing.4").message.includes("not a palette token"));
  assert(issueAt(report, "spacing.4").message.includes("not spacing"));
});

test("a palette facet carrying a non-palette token with modes is reported", () => {
  const report = validatePaletteFacet({
    spacing: {
      $type: "dimension",
      8: { $value: "2rem", $modes: { dark: "9rem" } },
    },
  });

  deepStrictEqual(report.valid, false);
  assert(issueAt(report, "spacing.8").message.includes("not a palette token"));
});

test("a spacing facet carrying space is valid", () => {
  const report = validateSpacingFacet({
    spacing: { $type: "dimension", 4: { $value: "1rem" } },
  });

  deepStrictEqual(report.valid, true);
  deepStrictEqual(report.issues, []);
});

test("a spacing facet carrying color is reported at that token", () => {
  const report = validateSpacingFacet({
    color: { $type: "color", primary: { $value: "#2563eb" } },
  });

  deepStrictEqual(report.valid, false);
  assert(
    issueAt(report, "color.primary").message.includes("not a spacing token"),
  );
});

test("a spacing facet carrying $modes is reported at that token", () => {
  const report = validateSpacingFacet({
    spacing: {
      $type: "dimension",
      8: { $value: "2rem", $modes: { dark: "9rem" } },
    },
  });

  deepStrictEqual(report.valid, false);
  assert(issueAt(report, "spacing.8").message.includes("$modes"));
});
