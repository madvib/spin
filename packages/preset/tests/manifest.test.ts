import { assert, assertEquals } from "@std/assert";
import {
  indexTree,
  parseTokens,
  resolveAliases,
} from "@spin/theme";
import {
  primitiveComponents,
  primitiveContracts,
  primitiveVariants,
} from "@spin/preset";
import { deriveRuleContract } from "../src/rules/primitives/derive.ts";

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
const THEMES = ["default.json", "neobrut.json", "console.json"] as const;

function varsOf(name: string): Set<string> {
  const text = Deno.readTextFileSync(new URL(name, THEMES_DIR));
  const parsed = parseTokens(JSON.parse(text));
  if (!parsed.ok) throw new Error(`${name}: ${parsed.error}`);
  return new Set(Object.keys(indexTree(resolveAliases(parsed.tree).tree).vars));
}

const bare = (token: string) => token.replace(/^--/, "");

/** The tokens a component names are all the tokens a theme must provide. */
function readsOf(component: { reads: readonly string[] }): string[] {
  return [...component.reads];
}

Deno.test("the checked-in manifest matches what the rules do now", () => {
  // Every rule component compared field by field. A component added without
  // regenerating, or a rule changed without regenerating, fails here — which is
  // the whole reason the manifest is derived rather than maintained.
  const stale: string[] = [];
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
      if (a !== b) stale.push(`${name}.${field}`);
    }
  }
  assertEquals(
    stale,
    [],
    `run \`deno task codegen\`; stale: ${stale.join(", ")}`,
  );
});

Deno.test("every shipped theme satisfies every component's reads", () => {
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
    assertEquals(missing, [], `${theme} cannot satisfy: ${missing.join(", ")}`);
  }
});

Deno.test("variants a component defines reach the lint's vocabulary", () => {
  // The lint reads `primitiveVariants()`, so a class only one component
  // defines has to survive into the union — otherwise authored code is
  // rejected for using a class the theme itself ships.
  const all = primitiveVariants();
  for (const variant of ["striped", "secondary", "contrast", "card-narrow"]) {
    if (!all.has(variant)) throw new Error(
      `--${variant} is defined by a component but missing from the lint vocabulary`,
    );
  }
});

Deno.test("no component reads another component's tokens", () => {
  // A component reaching into another's group couples two surfaces that are
  // meant to change independently, and the coupling is invisible in the CSS.
  for (const [name, component] of Object.entries(primitiveComponents)) {
    for (const token of component.reads) {
      const owner = Object.keys(primitiveContracts).find((other) =>
        other !== name && token.startsWith(`--${other}.`)
      );
      assertEquals(
        owner,
        undefined,
        `${name} reads ${token}, which belongs to ${owner}`,
      );
    }
  }
});
