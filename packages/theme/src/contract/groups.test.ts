import { test } from "bun:test";
import assert, { deepStrictEqual } from "node:assert/strict";
import { contractGroups, documentGroups, themeGroups } from "./groups.ts";
import { starterThemes } from "../themes/index.ts";

/**
 * The group list is what the house skill's checklist walks and what the
 * schema page shows, so it has to be the theme's own groups: the ones a
 * document declares, in the order the document reads them, plus the ones the
 * contract knows and no document states.
 */

test("the groups a theme declares come in the order the document reads them", () => {
  const document = {
    spacing: { "4": { $value: "1rem" } },
    color: { primary: { $value: "#000000" } },
  };
  deepStrictEqual(documentGroups(document), ["spacing", "color"]);
  const groups = themeGroups([document]);
  deepStrictEqual(
    groups.slice(0, 2),
    ["spacing", "color"],
    "the document's groups lead the list, in the document's order",
  );
});

test("the list names every group the contract declares", () => {
  const groups = new Set(themeGroups([]));
  for (const group of contractGroups()) {
    assert(groups.has(group), `the contract's ${group} group is missing`);
  }
});

test("a group a document declares is in the list", () => {
  // A theme may state something the contract does not know: the document is
  // the theme's own, and the list is what a theme contains.
  const groups = new Set(
    themeGroups([{ gradient: { brand: { $value: "#000000" } } }]),
  );
  assert(groups.has("gradient"), "the document's own group is missing");
});

test("a mode a document spells as a group is not one of its groups", () => {
  // `dark` is a variant of a token, not a group beside one: a document that
  // restates its dark side at the top level has declared a mode, and the
  // groups it owns are the ones it spends.
  deepStrictEqual(documentGroups({ color: {}, dark: {} }), ["color"]);
});

test("every group the contract declares is one the starters state", () => {
  // The contract is the owned set and the starters are its expression, so the two
  // have to agree: a group the contract requires that no starter states is a
  // group the product cannot spend.
  const stated = new Set(
    Object.values(starterThemes).flatMap((doc) => documentGroups(doc)),
  );
  for (const group of contractGroups()) {
    assert(stated.has(group), `no starter states the ${group} group`);
  }
});
