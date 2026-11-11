import { test } from "bun:test";
import { deepStrictEqual } from "node:assert/strict";
import { catalogRuleNames } from "../src/catalog.ts";
// Every rule module that exports a static `*_NAMES` inventory: the test must
// see a static export the day it is added, and a glob would see fixtures and
// tests too. `primitives/` carries no `*_NAMES` exports, so it is absent.
import * as display from "../src/rules/display.ts";
import * as grid from "../src/rules/grid.ts";
import * as interactivity from "../src/rules/interactivity.ts";
import * as layout from "../src/rules/layout.ts";
import * as overflow from "../src/rules/overflow.ts";
import * as position from "../src/rules/position.ts";
import * as sizing from "../src/rules/sizing.ts";
import * as spacing from "../src/rules/spacing.ts";
import * as text from "../src/rules/text.ts";
import * as transitions from "../src/rules/transitions.ts";
import * as shadow from "../src/rules/shadow.ts";
import * as stacking from "../src/rules/stacking.ts";
import * as typography from "../src/rules/typography.ts";

/**
 * The catalog joint, pinned from both sides.
 *
 * A static name exported by a rule module and missing from
 * `catalogRuleNames()` is a utility the system produces and the reference
 * never names; a name in the set no rule module exports is a reference entry
 * that generates nothing. Both lists are exact: there are no tolerated
 * orphans, so a rule added without its section fails the suite.
 */

const MODULES: ReadonlyArray<
  { path: string; namespace: Record<string, unknown> }
> = [
  { path: "rules/display.ts", namespace: display },
  { path: "rules/grid.ts", namespace: grid },
  { path: "rules/interactivity.ts", namespace: interactivity },
  { path: "rules/layout.ts", namespace: layout },
  { path: "rules/overflow.ts", namespace: overflow },
  { path: "rules/position.ts", namespace: position },
  { path: "rules/sizing.ts", namespace: sizing },
  { path: "rules/spacing.ts", namespace: spacing },
  { path: "rules/text.ts", namespace: text },
  { path: "rules/shadow.ts", namespace: shadow },
  { path: "rules/stacking.ts", namespace: stacking },
  { path: "rules/transitions.ts", namespace: transitions },
  { path: "rules/typography.ts", namespace: typography },
];

/** Every static name a rule module exports, with the module that owns it. */
function staticNames(): Array<{ path: string; name: string }> {
  const out: Array<{ path: string; name: string }> = [];
  for (const { path, namespace } of MODULES) {
    for (const [key, value] of Object.entries(namespace)) {
      if (!key.endsWith("_NAMES") || !Array.isArray(value)) continue;
      for (const name of value) out.push({ path, name: String(name) });
    }
  }
  return out;
}

test("every static name a rule module exports reaches catalogRuleNames", () => {
  const rules = catalogRuleNames();
  const missing = staticNames()
    .filter(({ name }) => !rules.has(name))
    .map(({ path, name }) => `${path}: ${name}`)
    .sort();
  deepStrictEqual(
    missing,
    [],
    "rule modules export these static names and the catalog names none of them",
  );
});

test("catalogRuleNames holds nothing no rule module exports", () => {
  const known = new Set(staticNames().map(({ name }) => name));
  const extra = [...catalogRuleNames()].filter((name) => !known.has(name));
  deepStrictEqual(
    extra,
    [],
    "catalogRuleNames() names these and no rule module exports them",
  );
});
