import { assertEquals } from "@std/assert";
import { indexTree, parseTokens, resolveAliases } from "@spin/theme";
import {
  primitiveComponents,
  primitiveModules,
  primitiveVariants,
} from "@spin/primitives";
import { deriveReads, deriveVariants } from "../codegen.ts";

/**
 * The primitives and the theme are two halves of one contract, and nothing
 * in the type system joins them: the CSS is a string of `var(--token)` names
 * and the theme is a tree of tokens. A rename on either side breaks the join
 * silently, and the browser quietly drops the declaration.
 *
 * That is not hypothetical. A shipped bug had the button asking for
 * `--color-white`, a token no theme ever declared, so `color` fell through to
 * its inherited value and every filled button rendered with invisible text.
 *
 * The per-component versions of this live beside each component's own tests
 * (`button.test.ts` and friends) so a failure names the component that broke.
 * What remains here is the layer-wide invariant: no component may read a token
 * outside the vocabulary, in any theme.
 *
 * Note this checks the *library's own* consistency. Whether authored markup is
 * allowed to use these classes is a lint, not a test — see `packages/lint`.
 */

const EXAMPLES = new URL("../../theme/examples/", import.meta.url);
const THEMES = ["default/light.json", "neobrut.json", "console.json"] as const;

function varsOf(name: string): Set<string> {
  const parsed = parseTokens(
    JSON.parse(Deno.readTextFileSync(new URL(name, EXAMPLES))),
  );
  if (!parsed.ok) throw new Error(`${name}: ${parsed.error}`);
  return new Set(Object.keys(indexTree(resolveAliases(parsed.tree).tree).vars));
}
/**
 * The manifest is generated, so staleness is the failure mode: an edit to the
 * CSS that adds a read or a variant and no `deno task codegen` leaves the file
 * claiming a contract the stylesheets no longer match. These guards re-derive
 * from the CSS with the same scans codegen uses and compare against what is
 * checked in.
 */
Deno.test("the checked-in reads match a fresh derive", () => {
  for (const [name, component] of Object.entries(primitiveComponents)) {
    assertEquals(
      [...component.reads].sort(),
      [...deriveReads(component.css)].sort(),
      `${name}'s checked-in reads are stale; run \`deno task codegen\``,
    );
  }
});

Deno.test("the checked-in variants match a fresh derive", () => {
  for (const [name, component] of Object.entries(primitiveComponents)) {
    assertEquals(
      [...component.variants].sort(),
      [...deriveVariants(component.css)].sort(),
      `${name}'s checked-in variants are stale; run \`deno task codegen\``,
    );
  }
});

/** Token names without the leading `--`, which is how the index keys them. */
const bare = (token: string) => token.replace(/^--/, "");

/**
 * Custom properties a component declares itself. These are geometry — a
 * switch's travel distance, a group's gutter — rather than design decisions,
 * so no theme has to state them and no theme may.
 */
function componentLocals(component: { css: string }): Set<string> {
  return new Set(
    [...component.css.matchAll(/^\s*--([a-z0-9-]+)\s*:/gim)].map((m) => m[1]),
  );
}

/** Reads of a component that a theme is expected to satisfy. */
function themeProvidedReads(
  component: { reads: readonly string[]; css: string },
): string[] {
  const locals = componentLocals(component);
  return component.reads.filter((token) => !locals.has(bare(token)));
}

Deno.test("every complete theme satisfies every component's reads", () => {
  // A theme missing a token a component reads renders a control with half its
  // styling silently gone, so completeness has to hold per theme.
  for (const theme of THEMES) {
    const declared = varsOf(theme);
    const missing: string[] = [];
    for (const [name, component] of Object.entries(primitiveComponents)) {
      for (const token of themeProvidedReads(component)) {
        if (!declared.has(bare(token))) missing.push(`${name}:${token}`);
      }
    }
    assertEquals(missing, [], `${theme} cannot satisfy: ${missing.join(", ")}`);
  }
});

Deno.test("the dark override satisfies every component once merged with its base", () => {
  // The dark side is an override set, judged on the merged result: it restates
  // the colors that flip and inherits the metrics. Merging is the browser's
  // job, so the check has to merge too or it would demand a second theme.
  const merged = new Set([
    ...varsOf("default/light.json"),
    ...varsOf("default/dark.json"),
  ]);
  const missing: string[] = [];
  for (const [name, component] of Object.entries(primitiveComponents)) {
    for (const token of themeProvidedReads(component)) {
      if (!merged.has(bare(token))) missing.push(`${name}:${token}`);
    }
  }
  assertEquals(
    missing,
    [],
    `dark cannot satisfy even merged: ${missing.join(", ")}`,
  );
});

Deno.test("no component hardcodes a color", () => {
  // A literal color in the layer is a design decision made outside the theme,
  // which is the exact failure the token layer exists to prevent.
  const offenders: string[] = [];
  for (const [component, css] of Object.entries(primitiveModules)) {
    for (
      const m of css.matchAll(
        /:\s*(#[0-9a-f]{3,8}|rgba?\([^)]*\)|\bblack\b|\bwhite\b)/gi,
      )
    ) {
      offenders.push(`${component}: ${m[0].trim()}`);
    }
  }
  assertEquals(
    offenders,
    [],
    `the layer must not hardcode colors: ${offenders.join(", ")}`,
  );
});

Deno.test("no component hardcodes a theme-owned absolute length", () => {
  // `px` and `rem` are absolute metrics a theme should own: a hardcoded one
  // means a theme cannot rescale the control. `em` and `%` are relative by
  // construction and are allowed — the icon and spinner are sized in `em` so
  // they track the button's font-size across all three sizes.
  //
  // The one absolute length a component may state is the single pixel a
  // visually-hidden element collapses to, because that value is what keeps it
  // in the accessibility tree. It is a fixed recipe rather than a metric, and
  // naming it here means a second one has to be argued for.
  const FIXED_RECIPE = new Set(["1px"]);
  const offenders: string[] = [];
  for (const [name, component] of Object.entries(primitiveComponents)) {
    for (const m of component.css.matchAll(/:\s*([\d.]+(?:px|rem))\s*[;}]/g)) {
      if (FIXED_RECIPE.has(m[1])) continue;
      offenders.push(`${name}: ${m[1]}`);
    }
  }
  assertEquals(
    offenders,
    [],
    `hardcoded absolute metrics: ${offenders.join(", ")}`,
  );
});

Deno.test("a compound selector contributes both its element and its class", () => {
  // `table.striped` claims the table *and* defines a variant. Reading only
  // the element loses the class, and the lint then reports a class the theme
  // itself defines as unknown — which is how a legitimate `striped` table gets
  // flagged as slop.
  const striped = primitiveComponents["content"]?.variants ?? [];
  assertEquals(
    striped.includes("striped"),
    true,
    "the content layer defines .striped, so it must be a known variant",
  );
});

Deno.test("variants are reachable from the global set the lint uses", () => {
  // The lint reads `primitiveVariants()`, so a variant that only exists on one
  // component has to survive into the union or authored code is rejected for
  // using a class the theme ships.
  for (const variant of ["striped", "container", "secondary", "contrast"]) {
    assertEquals(
      primitiveVariants().has(variant),
      true,
      `--${variant} is defined by a component but missing from the lint vocabulary`,
    );
  }
});

Deno.test("no component reads another component's tokens", () => {
  // A shared value belongs in a scale group that several components may read.
  // A value that belongs to exactly one component belongs in that component's
  // group, because when component A reads `var(--button-…)` a theme can no
  // longer restyle the button without silently restyling A.
  const owners = new Map<string, Set<string>>();
  for (const [name, component] of Object.entries(primitiveComponents)) {
    for (const token of component.reads) {
      const group = token.split("-")[0];
      if (!owners.has(group)) owners.set(group, new Set());
      owners.get(group)?.add(name);
    }
  }
  // A group owned by exactly one component is that component's; anything read
  // by more than one is a shared scale and is fine.
  const componentGroups = new Set(
    Object.keys(primitiveComponents),
  );
  for (const [group, readers] of owners) {
    if (readers.size < 2) continue;
    assertEquals(
      componentGroups.has(group),
      false,
      `token group "${group}" is read by ${[...readers].join(" and ")}; ` +
        `a value more than one component needs belongs in a shared scale`,
    );
  }
});

Deno.test("every component token a component reads is declared by a theme", () => {
  // A component may declare its own custom properties — a switch's travel
  // distance is geometry, not a design decision — so those are excluded. What
  // must hold is that everything left over resolves in a real theme, because a
  // read that resolves to nothing is a declaration the browser silently drops.
  const vars = varsOf("default/light.json");
  for (const [name, component] of Object.entries(primitiveComponents)) {
    const unresolved = themeProvidedReads(component).filter(
      (token) => !vars.has(bare(token)),
    );
    assertEquals(
      unresolved,
      [],
      `${name} reads tokens no theme declares and the component does not define: ${
        unresolved.join(", ")
      }`,
    );
  }
});
