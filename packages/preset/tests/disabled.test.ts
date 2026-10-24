import { test } from "bun:test";
import assert, { deepStrictEqual } from "node:assert/strict";
import {
  createGenerator,
  type ExtendedTokenInfo,
  type GenerateResult,
} from "@unocss/core";
import { readFileSync } from "node:fs";
import { cssVarName } from "@spin/theme";
import { spinPreset } from "../src/index.ts";

/**
 * The posture of a dead control.
 *
 * A disabled control is not a dimmer control. Dimming spends opacity on the
 * WHOLE element, so the ink dims with the fill: a white label on a blue
 * button at half strength measures 1.56:1 — a button nobody can read, in the
 * one state a reader is most likely to reach for by mistake.
 *
 * The posture is a PAIR the theme states, so a dead control is muted and
 * still legible. These tests are about that pair reaching every control that
 * can be dead, and about the dim that replaced it being gone.
 */

const DEFAULT = new URL(
  "../../theme/src/themes/silk.json",
  import.meta.url,
);
const theme = JSON.parse(readFileSync(DEFAULT, "utf8")) as Record<
  string,
  unknown
>;

type Result = GenerateResult<Map<string, ExtendedTokenInfo>>;

/** Generate a document, keeping the per-token rule data for inspection. */
async function generate(markup: string): Promise<Result> {
  const uno = await createGenerator({
    presets: [spinPreset({ themes: { light: theme } })],
  });
  return await uno.generate(markup, { extendedInfo: true });
}

/** A body's declarations as a property -> value table. */
function declarations(body: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const entry of body.split(";")) {
    const text = entry.trim();
    if (text.length === 0) continue;
    const colon = text.indexOf(":");
    if (colon < 0) continue;
    out[text.slice(0, colon).trim()] = text.slice(colon + 1).trim();
  }
  return out;
}

/**
 * The declarations one state of a token emits.
 *
 * A state is found by what its selector says — `:disabled,` for the dead
 * state, `:hover` for the pointed-at one — because that is the only thing
 * that tells two rules of the same component apart.
 */
function state(
  result: Result,
  token: string,
  marker: string,
): Record<string, string> {
  const info = result.matched.get(token);
  assert(info !== undefined, `${token} must be matched by a rule`);
  const found = info.data.find((util) => {
    const selector = util[1];
    return typeof selector === "string" && selector.includes(marker);
  });
  assert(found !== undefined, `${token} must emit a rule for ${marker}`);
  return declarations(found[2]);
}

/** The theme's own name for a role, as the sheet spells it. */
function role(path: string[]): string {
  return `var(${cssVarName(path)})`;
}

const FILL = role(["color", "disabled"]);
const INK = role(["color", "on-disabled"]);

test("a dead control wears the theme's disabled fill and the ink on it", async () => {
  const result = await generate("<button disabled>Deploy</button>");
  const dead = state(result, "button", ":disabled,");

  // The fill and the ink are PAINTED, and they are the theme's own: the
  // fill a dead control wears, and the ink that reads on it.
  deepStrictEqual(dead["background-color"], FILL);
  deepStrictEqual(dead["color"], INK);
  deepStrictEqual(dead["border-color"], INK);
  // And the control is not dimmed. A dim spends opacity on the whole
  // element, so the ink dims with the fill — which is how the white label
  // on a blue button measured 1.56:1.
  deepStrictEqual(dead["opacity"], undefined);
});

test("a dead control casts no shadow and answers no pointer", async () => {
  // A shadow is the shape of a control that can be pressed, and a lift is
  // the movement of one. A dead control wears neither.
  const result = await generate("<button disabled>Deploy</button>");
  const dead = state(result, "button", ":disabled,");
  deepStrictEqual(dead["box-shadow"], "none");
  deepStrictEqual(dead["transform"], "none");

  // And the hover is not for it: the pointed-at state leaves a dead
  // control alone, so a control that cannot be pressed cannot say it can
  // be by being pointed at.
  const hovered = state(result, "button", ":hover");
  deepStrictEqual(
    hovered["box-shadow"],
    "var(--button-shadow-hover)",
    "the hover spends the theme's lift",
  );
  const hover = result.matched.get("button")?.data.find((util) => {
    const selector = util[1];
    return typeof selector === "string" && selector.includes(":hover");
  })?.[1];
  assert(
    typeof hover === "string" &&
      hover.includes(":not(:disabled)") &&
      hover.includes(':not([aria-disabled="true"])'),
    "the hover must not reach a control that says it is dead",
  );
});

test("a dead variant wears the posture whatever it was", async () => {
  // A variant states its own ink, and that ink is as specific as the base's
  // dead rule — so a variant has to say what a dead version of itself
  // wears. A dead outline button that kept its accent ink would be the
  // illegibility the posture exists to remove.
  const result = await generate(
    '<button class="secondary" disabled>Deploy</button>' +
      '<button class="outline" disabled>Deploy</button>',
  );
  for (const variant of ["secondary", "outline"]) {
    const dead = state(result, variant, ":disabled,");
    deepStrictEqual(dead["background-color"], FILL, `${variant} wears the fill`);
    deepStrictEqual(dead["color"], INK, `${variant} wears the ink`);
    deepStrictEqual(dead["opacity"], undefined, `${variant} is not dimmed`);
  }
});

test("a dead field and a dead control wear the posture too", async () => {
  // A field is a control like any other, and a dimmed one dims the text a
  // reader is meant to transcribe. The checkbox and the switch draw
  // themselves, so their fill and their ink are the theme's to paint.
  const result = await generate(
    '<input disabled><input type="checkbox" disabled>' +
      '<input type="checkbox" role="switch" disabled>',
  );
  const field = state(result, "input", ":disabled,");
  deepStrictEqual(field["background-color"], FILL);
  deepStrictEqual(field["color"], INK);
  deepStrictEqual(field["opacity"], undefined);

  const checkbox = state(result, "checkbox", ":disabled,");
  deepStrictEqual(checkbox["background-color"], FILL);
  deepStrictEqual(checkbox["color"], INK);
  deepStrictEqual(checkbox["opacity"], undefined);

  const switcher = state(result, "switch", ":disabled,");
  deepStrictEqual(switcher["background-color"], FILL);
  deepStrictEqual(switcher["color"], INK);
  deepStrictEqual(switcher["opacity"], undefined);
});
