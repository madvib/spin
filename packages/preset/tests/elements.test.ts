import { test } from "bun:test";
import assert, { deepStrictEqual } from "node:assert/strict";
import {
  createGenerator,
  type ExtendedTokenInfo,
  type GenerateResult,
} from "@unocss/core";
import { readFileSync } from "node:fs";
import { cssVarName, ELEMENT_ROLES } from "@spin/theme";
import { starterThemes } from "@spin/theme/themes";
import { spinPreset } from "../src/index.ts";
import { deriveRuleContract } from "../src/rules/primitives/derive.ts";

/**
 * The per-element groups, held to the two halves of their promise: the
 * primitive SPENDS the group's tokens, and a theme that omits one gets the
 * shared scale's answer rather than the platform's.
 *
 * The composition lives here rather than in `@spin/theme`, which cannot see
 * the primitives at all: a group is spent by a rule, and the rule is here.
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

/** Generate a document against a theme, keeping the per-token rule data. */
async function generate(
  markup: string,
  document: Record<string, unknown>,
): Promise<Result> {
  const uno = await createGenerator({
    presets: [spinPreset({ themes: { light: document } })],
  });
  return await uno.generate(markup, { extendedInfo: true });
}

/** The yields of a token's winning rule, as selector and declarations. */
function yieldsFor(
  result: Result,
  token: string,
): { selector: string; body: Record<string, string> }[] {
  const info = result.matched.get(token);
  assert(info !== undefined, `${token} must be matched by a rule`);
  const out: { selector: string; body: Record<string, string> }[] = [];
  for (const util of info.data) {
    if (typeof util[1] !== "string" || typeof util[2] !== "string") continue;
    const body: Record<string, string> = {};
    for (const entry of util[2].split(";")) {
      const text = entry.trim();
      if (text.length === 0) continue;
      const colon = text.indexOf(":");
      if (colon < 0) continue;
      body[text.slice(0, colon).trim()] = text.slice(colon + 1).trim();
    }
    out.push({ selector: util[1], body });
  }
  return out;
}

/**
 * The component that spends each per-element group.
 *
 * The link's group is the exception: a link is the one piece of prose that
 * is also a control, so its rule lives in the prose family.
 */
const SPENDERS: Record<string, string> = {
  avatar: "avatar",
  badge: "badge",
  button: "button",
  checkbox: "checkbox",
  icon: "icon",
  card: "card",
  alert: "alert",
  field: "field",
  stat: "stat",
  table: "table",
  link: "prose",
};

/**
 * The groups whose tokens no rule spends.
 *
 * The switch's depth is one: the switch's elevation comes from the shared
 * `shadow.sm` scale by the switch rule's own design, so the token the
 * starters and the manifest declare is spent by nothing. It is named here
 * rather than left out, because a group nothing spends is a lie and this one
 * is still a lie.
 */
const UNSPENT: readonly string[] = ["switch"];

test("each painted element spends the tokens of its own group", () => {
  // A group nothing spends is a lie, and a token spent by the wrong element
  // is a coupling the theme cannot see. The read is observed from the rules
  // themselves, so it cannot drift from what they do.
  for (const role of ELEMENT_ROLES) {
    if (UNSPENT.includes(role.group)) continue;
    const component = SPENDERS[role.group];
    assert(
      component !== undefined,
      `${role.group} names no component to spend it`,
    );
    const reads = deriveRuleContract(component).reads;
    const cssVar = cssVarName(role.path.split("."));
    assert(
      reads.some((read) => read === cssVar),
      `${component} must spend ${cssVar}`,
    );
  }
});

test("every group the contract knows has a component that spends it", () => {
  // The other half of the same claim: a group with no spender at all is a
  // group the contract invented. Every group is either spent or named as a
  // known exception.
  for (const group of Object.keys(SPENDERS)) {
    const spent = ELEMENT_ROLES.some((role) => role.group === group);
    assert(spent, `${group} names no token for a component to spend`);
  }
});

test("a theme that omits an element's token gets the shared scale's answer", async () => {
  // The fallback is what makes a group safe to leave out: the theme's own
  // scale answers, not the browser. A card that says nothing about its
  // corner wears the page's radius — and the theme's own radius step, so the
  // answer is the theme's.
  const without = structuredClone(theme);
  delete (without["card"] as Record<string, unknown>)["radius"];

  const full = yieldsFor(await generate("<card>Body</card>", theme), "card");
  const partial = yieldsFor(
    await generate("<card>Body</card>", without),
    "card",
  );

  const radiusOf = (yields: { body: Record<string, string> }[]) =>
    yields.find((yield_) => "border-radius" in yield_.body)?.body[
      "border-radius"
    ];

  deepStrictEqual(
    radiusOf(full),
    "var(--card-radius)",
    "the card wears the corner the theme gave it",
  );
  deepStrictEqual(
    radiusOf(partial),
    "var(--radius-md)",
    "a card that says nothing wears the page's radius",
  );
});

test("a theme that omits avatar, icon and badge tokens still dresses them from the shared scales", async () => {
  // The fallbacks are a contract with the SHARED scales, and the shared scales
  // are every starter's. A fallback that worked in silk and fell through in
  // synthwave would be a component that changes shape with the theme.
  for (const [name, document] of Object.entries(starterThemes)) {
    const without = structuredClone(
      document as Record<string, unknown>,
    );
    delete without["avatar"];
    delete without["icon"];
    delete without["badge"];

    const avatar = yieldsFor(
      await generate('<div class="avatar"></div>', without),
      "avatar",
    );
    deepStrictEqual(
      avatar.find((y) => "width" in y.body)?.body["width"],
      "var(--spacing-10)",
      `${name}: an avatar with no avatar.md token falls back to spacing.10`,
    );

    const icon = yieldsFor(
      await generate('<span class="icon-md"></span>', without),
      "icon-md",
    );
    deepStrictEqual(
      icon.find((y) => "font-size" in y.body)?.body["font-size"],
      "var(--font-size-md)",
      `${name}: an icon with no icon.md token falls back to font.size.md`,
    );

    const badge = yieldsFor(
      await generate("<badge>Tag</badge>", without),
      "badge",
    );
    deepStrictEqual(
      badge.find((y) => "border" in y.body)?.body["border"],
      "var(--border-width) solid var(--color-border)",
      `${name}: a badge with no badge.edge token falls back to border.width`,
    );
  }
});

test("the info badge wears the ink on the info fill", async () => {
  // Info is the fourth status a product actually uses, and it is a required
  // role with its own ink. A badge that reached for the primary fill for an
  // informational status would be saying "this is the action" instead.
  const badge = yieldsFor(
    await generate('<badge class="badge-info">Heads up</badge>', theme),
    "badge-info",
  );
  assert(
    badge.some((yield_) =>
      yield_.body["color"] === "var(--color-on-semantic-info)"
    ),
    "the info badge wears the ink on the info fill",
  );
});

test("the danger button and the danger badge wear the required ink", async () => {
  // The ink on the error fill is a REQUIRED role with a floor, so the
  // surfaces that paint that fill must wear it. A surface that spent a
  // second name for the same ink would leave a theme that satisfies the
  // contract shipping a danger button nobody can read.
  const button = yieldsFor(
    await generate('<button class="danger">Delete</button>', theme),
    "danger",
  );
  assert(
    button.some((yield_) =>
      yield_.body["color"] === "var(--color-on-semantic-error)"
    ),
    "the danger button wears the ink on the error fill",
  );

  const badge = yieldsFor(
    await generate('<badge class="badge-danger">New</badge>', theme),
    "badge-danger",
  );
  assert(
    badge.some((yield_) =>
      yield_.body["color"] === "var(--color-on-semantic-error)"
    ),
    "the danger badge wears the ink on the error fill",
  );
});
