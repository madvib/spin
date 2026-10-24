import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "bun:test";
import assert from "node:assert/strict";
import { deepStrictEqual } from "node:assert/strict";
import { indexTree, parseTokens, resolveAliases } from "@spin/theme";
import {
  primitiveComponents,
  primitiveContracts,
  primitiveVariants,
} from "@spin/preset";
import { starterThemes } from "@spin/theme/themes";
import {
  deriveRuleContract,
  deriveScope,
} from "../src/rules/primitives/derive.ts";

/**
 * The manifest is DERIVED from the rules, so "is it stale?" is answered by
 * regenerating and comparing — not by reading the checked-in file and hoping.
 *
 * And because the primitives and the theme are two halves of one contract with
 * nothing in the type system joining them, the join is checked per theme. That
 * is not hypothetical: a shipped bug had a button asking for `--color-white`, a
 * token no theme declared, so `color` fell through to its inherited value and
 * every filled button rendered with invisible text.
 */

const THEMES_DIR = new URL("../../theme/src/themes/", import.meta.url);
// The registry, not a list: a starter added to the package is silently
// subject to every gate below, the day it is added.
const THEMES = Object.keys(starterThemes).map((name) => `${name}.json`);

function varsOf(name: string): Set<string> {
  const text = readFileSync(new URL(name, THEMES_DIR));
  const parsed = parseTokens(JSON.parse(text));
  if (!parsed.ok) throw new Error(`${name}: ${parsed.error}`);
  return new Set(Object.keys(indexTree(resolveAliases(parsed.tree).tree).vars));
}

const bare = (token: string) => token.replace(/^--/, "");

/** The tokens a component names are all the tokens a theme must provide. */
function readsOf(component: { reads: readonly string[] }): string[] {
  return [...component.reads];
}

test("the checked-in manifest matches what the rules do now", () => {
  // Every rule component compared field by field. A component added without
  // regenerating, or a rule changed without regenerating, fails here — which is
  // the whole reason the manifest is derived rather than maintained.
  const stale: string[] = [];
  const patch: string[] = [];
  for (const name of Object.keys(primitiveContracts)) {
    const derived = deriveRuleContract(name);
    const checked = primitiveContracts[name];
    if (!checked) {
      stale.push(`${name} is missing entirely`);
      continue;
    }
    for (const field of ["tags", "variants", "reads"] as const) {
      const a = [...derived[field]].sort().join(",");
      const b = [...checked[field]].sort().join(",");
      if (a !== b) {
        stale.push(`${name}.${field}`);
        patch.push(
          `${name}.${field} = ${JSON.stringify([...derived[field]].sort())}`,
        );
      }
    }
    // The scope is derived too: what the component paints, where each of
    // those elements has to sit, and what it decides for it. A scope in the
    // manifest that the rules do not match is a claim the code does not
    // back.
    const scope = JSON.stringify(derived.scope);
    const checkedScope = JSON.stringify(checked.scope);
    if (scope !== checkedScope) {
      stale.push(`${name}.scope`);
      patch.push(`${name}.scope = ${scope}`);
    }
    // The taxonomy is derived too: a group or a glyph that moved in the
    // authoring module and not in the manifest is a rail that files an
    // element one way and draws it another.
    for (const field of ["category", "icon"] as const) {
      if (derived[field] !== checked[field]) {
        stale.push(`${name}.${field}`);
        patch.push(`${name}.${field} = ${JSON.stringify(derived[field])}`);
      }
    }
  }
  deepStrictEqual(
    stale,
    [],
    `stale: ${stale.join(", ")}\ncopy into manifest.ts:\n${patch.join("\n")}`,
  );
});

test("a rule that reaches outside its primitive's scope is a failure", () => {
  // The claim is what the rules are held to. A claim that does not cover
  // what a rule reaches is rejected — the failure is the point, because a
  // primitive that paints outside its scope paints elements nobody declared
  // it paints.
  assert.throws(
    () =>
      deriveScope("button", {
        self: "button",
        paints: [{ tag: "button", where: "global" }],
      }),
    Error,
    "span",
  );
});

test("a scope says where the painting lands", () => {
  // Typography belongs to the whole application: a paragraph is a paragraph
  // and a heading is a heading, wherever they are written, so both are
  // painted globally. The document's FURNITURE — the quotation's inset, the
  // code block's chrome, the highlight — belongs inside the column, so it is
  // painted as a descendant of the prose.
  const prose = primitiveContracts["prose"]?.scope;
  deepStrictEqual(prose?.self, "prose");
  const where = (tag: string) =>
    prose?.paints.filter((paint) => paint.tag === tag).map((paint) =>
      paint.where
    );
  deepStrictEqual(where("p"), ["global"]);
  deepStrictEqual(where("h1"), ["global"]);
  // The list's items breathe a step apart wherever the list is written: the
  // rule reaches them through a SIBLING, and a sibling is not an ancestor.
  deepStrictEqual(where("li"), ["global"]);
  // A quotation has both: the voice it reads in is the theme's, and the
  // inset it is set in is the document's.
  deepStrictEqual(where("blockquote"), ["global", "descendant"]);
  // The highlight is the document's alone.
  deepStrictEqual(where("mark"), ["descendant"]);
});

test("what a primitive owns is what its rules decide", () => {
  // The button draws itself: it owns its fill, its edge, its face and its
  // type. The group container it joins is LAYED OUT, not painted — nothing
  // decides how it looks — so it owns nothing.
  const button = primitiveContracts["button"]?.scope;
  const owns = (tag: string) =>
    button?.paints
      .filter((paint) => paint.tag === tag && paint.where === "global")
      .flatMap((paint) => paint.owns);
  deepStrictEqual(owns("button")?.includes("background"), true);
  deepStrictEqual(owns("button")?.includes("size"), true);
  deepStrictEqual(owns("span"), []);
});

test("every shipped theme satisfies every component's reads", () => {
  // A theme missing a token a component spends renders a control with half its
  // styling silently gone — a border that resolves to nothing, a colour that
  // falls through to whatever it inherited. Completeness holds per theme.
  for (const theme of THEMES) {
    const declared = varsOf(theme);
    const missing: string[] = [];
    for (const [name, component] of Object.entries(primitiveComponents)) {
      for (const token of readsOf(component)) {
        if (!declared.has(bare(token))) missing.push(`${name}:${token}`);
      }
    }
    deepStrictEqual(missing, [], `${theme} cannot satisfy: ${missing.join(", ")}`);
  }
});

test("variants a component defines reach the lint's vocabulary", () => {
  // The lint reads `primitiveVariants()`, so a class only one component
  // defines has to survive into the union — otherwise authored code is
  // rejected for using a class the theme itself ships.
  const all = primitiveVariants();
  for (const variant of ["striped", "secondary", "contrast", "card-narrow"]) {
    if (!all.has(variant)) {
      throw new Error(
        `--${variant} is defined by a component but missing from the lint vocabulary`,
      );
    }
  }
});

test("no component reads another component's tokens", () => {
  // A component reaching into another's group couples two surfaces that are
  // meant to change independently, and the coupling is invisible in the rules.
  for (const [name, component] of Object.entries(primitiveComponents)) {
    for (const token of component.reads) {
      const owner = Object.keys(primitiveContracts).find((other) =>
        other !== name && token.startsWith(`--${other}.`)
      );
      deepStrictEqual(
        owner,
        undefined,
        `${name} reads ${token}, which belongs to ${owner}`,
      );
    }
  }
});

test("the elevation ladder is spent by height", () => {
  // A surface resting ON the page spends the resting step; what floats above
  // the page spends the floating one. Breaks if a call site reaches for a
  // bigger step instead of the theme stating a louder one — a card on the
  // overlay's step is a card levitating over a page it sits on — or if an
  // overlay sinks to the resting step.
  deepStrictEqual(
    primitiveContracts["card"]?.reads.includes("--shadow-md"),
    true,
    "a card rests on the page's step",
  );
  deepStrictEqual(
    primitiveContracts["dialog"]?.reads.includes("--shadow-lg"),
    true,
    "a dialog floats above it",
  );
  deepStrictEqual(
    primitiveContracts["popover"]?.reads.includes("--shadow-lg"),
    true,
    "and a popover floats above it too",
  );
});
