import { assert, assertEquals } from "@std/assert";
import type { UnoGenerator } from "@unocss/core";
import { createGenerator } from "@unocss/core";
import { parseTokens } from "@spin/theme";
import { describeCatalog, spinPreset } from "@spin/preset";
import { wind4Exclusions } from "../src/wind4.ts";
import { claims, claimedClasses, selectorFor } from "../src/utils/claimed.ts";
import { BORDER_NAMES } from "../src/rules/border.ts";
import { BORDER_STYLE_NAMES } from "../src/rules/border.ts";
import { DISPLAY_NAMES } from "../src/rules/display.ts";
import { DIVIDE_NAMES } from "../src/rules/divide.ts";
import { GRID_NAMES } from "../src/rules/grid.ts";
import { INTERACTIVITY_NAMES } from "../src/rules/interactivity.ts";
import { LAYOUT_NAMES } from "../src/rules/layout.ts";
import { OPACITY_NAMES } from "../src/rules/opacity.ts";
import { OVERFLOW_NAMES } from "../src/rules/overflow.ts";
import { POSITION_NAMES } from "../src/rules/position.ts";
import { SHADOW_NAMES } from "../src/rules/shadow.ts";
import { SIZING_NAMES } from "../src/rules/sizing.ts";
import { STACKING_NAMES } from "../src/rules/stacking.ts";
import { TEXT_NAMES } from "../src/rules/text.ts";
import { TRANSITION_NAMES } from "../src/rules/transitions.ts";
import { TYPOGRAPHY_NAMES } from "../src/rules/typography.ts";
import {
  claimedGroups,
  SECTIONS,
  sectionFor,
  utilitiesFor,
} from "../src/organization.ts";
import { readFileSync } from "node:fs";

/**
 * The organization is the ONE declaration of how the surface is divided, so
 * these tests guard the properties it must have rather than the contents it
 * happens to have. A section added, renamed or regrouped needs no change here.
 *
 * The failure these catch is the real one: a utility group that ships rules
 * and appears in no section, so it is in the reference's data and not in the
 * reference. That is how `gap-gutter` and `m-auto` came to be produced by the
 * system and unknown to the docs.
 */

const theme = JSON.parse(
  readFileSync(
    new URL("../../theme/src/themes/default.json", import.meta.url),
    "utf8",
  ),
);
const parsed = parseTokens(theme);
if (!parsed.ok) throw new Error(parsed.error);
const catalog = describeCatalog(parsed.tree);

/**
 * Every name the RULES claim — the `*_NAMES` each rule file exports, which is
 * where the catalog gets its names from too.
 */
const CLAIMED_BY_RULES: readonly string[] = [
  ...BORDER_NAMES, ...DISPLAY_NAMES, ...DIVIDE_NAMES, ...GRID_NAMES,
  ...INTERACTIVITY_NAMES, ...LAYOUT_NAMES, ...OPACITY_NAMES, ...OVERFLOW_NAMES,
  ...POSITION_NAMES, ...TEXT_NAMES, ...TRANSITION_NAMES, ...BORDER_STYLE_NAMES,
  ...TYPOGRAPHY_NAMES, ...SHADOW_NAMES, ...SIZING_NAMES,
  ...STACKING_NAMES,
];

Deno.test("every catalog group belongs to a section", () => {
  // The property that matters: nothing the system produces may be absent from
  // the reference, and nothing may be listed twice.
  const orphans = catalog
    .map((g) => g.id)
    .filter((id) => sectionFor(id) === undefined);
  assertEquals(
    orphans,
    [],
    `these groups ship rules but no section claims them: ${orphans.join(", ")}`,
  );
});

Deno.test("no group is claimed twice", () => {
  const seen = new Map<string, string>();
  const doubles: string[] = [];
  for (const section of SECTIONS) {
    for (const group of section.groups) {
      const owner = seen.get(group);
      if (owner !== undefined) doubles.push(`${group} (${owner} and ${section.id})`);
      seen.set(group, section.id);
    }
  }
  assertEquals(doubles, [], `a group in two sections: ${doubles.join(", ")}`);
});

Deno.test("every section names a group the catalog has", () => {
  // The reverse direction. Without this, a typo in a section's `groups` is a
  // section that silently renders empty, which looks exactly like a section
  // with nothing in it.
  const ids = new Set(catalog.map((g) => g.id));
  const missing = SECTIONS.flatMap((s) =>
    s.groups.filter((g) => !ids.has(g)).map((g) => `${s.id} -> ${g}`)
  );
  assertEquals(missing, [], `sections naming groups that do not exist: ${missing.join(", ")}`);
});

Deno.test("every section has utilities to show", () => {
  // A section whose groups are all empty renders as a heading and nothing
  // else — a reference entry that promises something and delivers a blank.
  const empty = SECTIONS
    .map((s) => ({ id: s.id, n: utilitiesFor(s, catalog).length }))
    .filter((s) => s.n === 0)
    .map((s) => s.id);
  assertEquals(empty, [], `sections with no utilities: ${empty.join(", ")}`);
});

Deno.test("section ids are URL-safe and unique", () => {
  // They are links. A duplicate would make one section unreachable and an id
  // with a slash or a space would break the route.
  const ids = SECTIONS.map((s) => s.id);
  const bad = ids.filter((id) => !/^[a-z0-9-]+$/.test(id));
  assertEquals(bad, [], `section ids that are not URL-safe: ${bad.join(", ")}`);
  assertEquals(
    ids.length,
    new Set(ids).size,
    `duplicate section ids: ${ids.join(", ")}`,
  );
});

Deno.test("the organization covers most of what the system produces", () => {
  // Not "all" — a section may legitimately hold nothing yet. But if the
  // reference is showing a fraction of the surface, that is worth seeing fail
  // rather than discover.
  const claimed = claimedGroups();
  const total = catalog.reduce((n, g) => n + g.utilities.length, 0);
  const covered = catalog
    .filter((g) => claimed.has(g.id))
    .reduce((n, g) => n + g.utilities.length, 0);
  assertEquals(
    covered,
    total,
    `only ${covered} of ${total} utilities are in a section`,
  );
});
Deno.test("the showcase stylesheet in server/chrome.ts carries no backticks in its CSS comments", () => {
  // The showcase's stylesheet is ONE template literal, so a backtick in a CSS
  // comment inside it ends the string and the file stops parsing. That has
  // happened eight times in one session, always as a comment about a CSS
  // property — so it is checked rather than remembered.
  // Lives in server/chrome.ts since the serve.ts split; the literal is the same.
  const src = readFileSync(new URL("../../../server/chrome.ts", import.meta.url), "utf8");
  const start = src.indexOf("const STYLE = `");
  assertEquals(start !== -1, true, "the server/chrome.ts stylesheet literal was renamed");
  const body = src.slice(start + "const STYLE = `".length);
  const end = body.indexOf("\n`;");
  assertEquals(end !== -1, true, "the server/chrome.ts stylesheet literal is unterminated");
  const css = body.slice(0, end);
  // Backticks inside the literal, other than the one that closes it.
  const stray = css
    .split("\n")
    .map((line, i) => ({ n: i + 1, line }))
    .filter((r) => r.line.includes("`"));
  assertEquals(
    stray,
    [],
    `a backtick inside the stylesheet literal breaks the file: ${stray
      .map((r) => `${r.n}: ${r.line.trim().slice(0, 50)}`)
      .join("; ")}`,
  );
});

/**
 * A utility must DO something, not merely produce a rule.
 *
 * The catalog test proves a name generates. It cannot prove the rule has an
 * EFFECT, and that gap is where `ring-2` lived for an hour: it generated a
 * rule, the catalog named it, both tests passed — and it set
 * `--tw-ring-width`, a custom property nothing in the system read, so the
 * control rendered nothing at all.
 *
 * So this asserts the thing a caller would notice: the declaration the
 * utility produces is one the browser acts on. A body consisting only of
 * custom properties is inert — it is a comment written in CSS — and a theme
 * group that does not exist makes a rule return nothing at all, which looks
 * exactly the same from the outside.
 */
/**
 * Every name a rule CLAIMS must produce a rule.
 *
 * A dynamic rule returns `undefined` when a lookup comes back empty — a theme
 * group spelled wrong, a colour the theme does not declare — and that is
 * invisible from outside: no rule, no error, and the catalog simply does not
 * name it, so every other test stays green while the utility does nothing.
 *
 * `ring-2` was exactly this: the theme ref calls the group `borderWidth`, the
 * rule asked for `border`, and for an hour the utility generated nothing and
 * every assertion in the suite passed. The catalog cannot catch it, because the
 * catalog is derived from what works.
 */
Deno.test("every name a rule claims produces a rule", async () => {
  const { createGenerator } = await import("@unocss/core");
  const uno = await createGenerator({
    presets: [spinPreset({ themes: { default: theme } })],
  });
  const missing: string[] = [];
  for (const name of CLAIMED_BY_RULES) {
    const { css } = await uno.generate(name);
    if (!claims(css, name)) missing.push(name);
  }
  assertEquals(
    missing,
    [],
    `rules claim these, and none produces a rule: ${missing.join(", ")}`,
  );
});

Deno.test("no utility sets only custom properties nothing consumes", async () => {
  const { createGenerator } = await import("@unocss/core");
  const uno = await createGenerator({
    presets: [spinPreset({ themes: { default: theme } })],
  });
  const inert: string[] = [];
  for (const name of catalog.flatMap((g) => g.utilities)) {
    if (name.endsWith(":") || !name.includes("-") && !name.includes(".")) continue;
    const { css } = await uno.generate(name);
    const rule = [...css.split("}")]
      .map((r) => r.slice(0, r.indexOf("{")).trim())
      .filter((head) => head.includes(`.${name.replace(/([:/])/g, "\\$1")}`))
      .pop();
    if (rule === undefined) continue;
    const open = css.indexOf("{", css.indexOf(rule));
    const body = css.slice(open + 1, css.indexOf("}", open));
    // Everything the rule declares that is NOT a custom property.
    const effective = body
      .split(";")
      .map((d) => d.trim())
      .filter((d) => d !== "" && !d.startsWith("--"))
      .filter((d) => {
        // A rule that only SETS one of ours is still inert unless something
        // reads it. The ring family is the known consumer, via the base.
        const prop = d.split(":")[0]?.trim() ?? "";
        return !prop.startsWith("--spin-ring");
      });
    if (effective.length === 0) inert.push(name);
  }
  assertEquals(
    inert,
    [],
    `these set properties nothing acts on: ${inert.join(", ")}`,
  );
});

/**
 * Every declaration a utility emits must be VALID CSS.
 *
 * `rotate-45` emitted `rotate: rotate(45deg)` — `rotate` is an individual
 * transform property in CSS, so the declaration is `rotate: 45deg` and the
 * function form is not a value at all. The browser dropped it silently: the
 * rule was in the sheet, the catalog named it, every assertion passed, and the
 * control did not move.
 *
 * A property that is set to something the property cannot hold is the failure
 * mode nothing else catches, because the rule EXISTS. So it is checked here
 * rather than by looking.
 */
Deno.test("no utility emits a declaration its property cannot hold", async () => {
  const { createGenerator } = await import("@unocss/core");
  const uno = await createGenerator({
    presets: [spinPreset({ themes: { default: theme } })],
  });
  const bad: string[] = [];
  for (const group of catalog) {
    for (const name of group.utilities) {
      if (name.endsWith(":")) continue;
      const { css } = await uno.generate(name);
      const selector = selectorFor(name);
      const open = css.indexOf(selector + "{");
      if (open === -1) continue;
      const body = css.slice(open + selector.length + 1, css.indexOf("}", open));
      for (const decl of body.split(";")) {
        const property = decl.split(":")[0]?.trim();
        const value = decl.slice(decl.indexOf(":") + 1).trim();
        if (!property || value === "") continue;
        // A function that REPEATS the property's own name is the shape of
        // this bug: `rotate: rotate(45deg)`, `scale: scale(2)`.
        const call = /^([a-z-]+)\(/.exec(value);
        if (call !== null && call[1] === property) {
          bad.push(`${name} -> ${property}: ${value}`);
        }
      }
    }
  }
  assertEquals(
    bad,
    [],
    `these declare a function named after the property, which CSS drops: ${bad.join(", ")}`,
  );
});

/* ---------------------------------------------------------------------------
 * The four properties below.
 *
 * Each one exists because a defect shipped THROUGH the whole suite: a rule
 * that existed, parsed cleanly, computed to nothing in the browser, and was
 * named in the catalog. `deno check` cannot see that, and neither can any
 * assertion about the source — these read the GENERATED sheet, which is the
 * only place the failure is visible.
 *
 * One generator, built once, reused by every property. The sweep is memoized
 * for the same reason: 763 names is 763 generate calls, and paying for them
 * per property would triple a cost that buys nothing.
 * ------------------------------------------------------------------------- */

/**
 * Every utility the catalog NAMES.
 *
 * The `variants` group is excluded and nothing else is: its entries are
 * PREFIXES (`hover:`, `focus:`), not utilities a caller can generate on
 * their own, so demanding a rule for one would fail on a category error. Every
 * other group lists class names, and those are swept whole — no skipping a
 * name that looks awkward, because "looks awkward" is how `border-b` stayed in
 * the catalog while matching nothing.
 */
const UTILITIES: readonly string[] = catalog.flatMap((group) =>
  group.id === "variants" ? [] : group.utilities
);

/**
 * A floor under the sweep, so an EMPTY catalog fails rather than passing
 * vacuously. Both properties below are quantified over `UTILITIES`, and both
 * would report `[]` — success — on a catalog that had emptied out. A floor
 * turns that silence into a failure.
 */
const UTILITY_FLOOR = 700;

/** The sheet every property reads: every utility, plus the preflight layers. */
let sheet: Promise<string> | undefined;
function fullSheet(): Promise<string> {
  return sheet ??= (async () => {
    const uno = await layered();
    const { css } = await uno.generate(UTILITIES.join(" "), {
      preflights: true,
    });
    return css;
  })();
}

/**
 * ONE generator, built once, reused by every property below.
 *
 * Building is not free — the preset resolves the whole token tree and every
 * primitive before it will answer a single class — and four properties each
 * building their own would pay that four times to learn the same thing.
 */
let layeredGenerator: Promise<UnoGenerator> | undefined;

function layered(): Promise<UnoGenerator> {
  return layeredGenerator ??= createGenerator({
    presets: [spinPreset({ themes: { default: theme } })],
  });
}

/**
 * A generator WITHOUT wind4, which answers a question the layered one cannot:
 * is this utility OURS?
 *
 * Ownership is decided by ASKING, not by re-deriving it from rule sources.
 * `claimsOf` in `wind4.ts` is what decides ownership at build time, and a test
 * that copied it would only prove the copy agrees with itself — and would go
 * on agreeing with itself after `claimsOf` broke, which is the entire failure.
 * The question worth asking is whether OUR rules produce this utility on their
 * own, and that is answerable without reading a single pattern.
 */
let spinOnlyGenerator: Promise<UnoGenerator> | undefined;

function spinOnly(): Promise<UnoGenerator> {
  return spinOnlyGenerator ??= createGenerator({
    presets: [spinPreset({ themes: { default: theme }, wind4: false })],
  });
}

/** One utility's own rules — the unit every sweep below iterates. */
interface Generated {
  readonly name: string;
  readonly css: string;
}

/**
 * Every utility's own rules, generated once.
 *
 * `preflights: false` matters more than it looks: with preflights on, the
 * theme layer's `body` rule rides along in every result, and its
 * `var(--font-family-body)` would be attributed to all 763 utilities at once.
 * Off, the only rules in a result are the ones that utility produced, so every
 * read in it is a read that utility made.
 */
let swept: Promise<readonly Generated[]> | undefined;

function sweep(): Promise<readonly Generated[]> {
  return swept ??= (async () => {
    const uno = await layered();
    const out: Generated[] = [];
    for (const name of UTILITIES) {
      const { css } = await uno.generate(name, { preflights: false });
      out.push({ name, css });
    }
    return out;
  })();
}

/** Every custom property a stylesheet DECLARES, at any scope. */
function declaredProperties(css: string): ReadonlySet<string> {
  const declared = new Set<string>();
  for (const match of css.matchAll(/(--[\w-]+)\s*:/g)) declared.add(match[1]);
  // `@property --un-ring-offset-width` is a declaration too, and reading one is
  // legitimate: the registration gives it a type and, with an initial value, a
  // value. Excluding registrations from "declared" would flag every wind4
  // utility that reads its own `--un-*` chain.
  for (const match of css.matchAll(/@property\s+(--[\w-]+)/g)) {
    declared.add(match[1]);
  }
  return declared;
}

/**
 * A bare `var()` read — one with NO fallback behind it.
 *
 * This is the shape of the theft. A read WITH a fallback resolves to that
 * fallback when the variable is absent, which is a well-formed way of saying
 * "use this if it exists, otherwise carry on". A bare read of a variable
 * nothing defines resolves to NOTHING: the declaration is valid at parse
 * time, invalid at computed-value time, and the browser drops it silently.
 *
 * Nesting still counts. A read placed bare inside another's fallback is itself
 * bare, and an undefined name there invalidates the whole declaration exactly
 * as an undefined name in the outer read would.
 */
const BARE_READ = /\bvar\(\s*(--[\w-]+)\s*\)/g;

/** The bare `var()` reads in a stylesheet, in the order they appear. */
function bareReads(css: string): string[] {
  return [...css.matchAll(BARE_READ)].map((match) => match[1]);
}

/**
 * The one variable the spin sheet does not define, on purpose.
 *
 * `spacing.ts` and `grid.ts` both spend `--grid-gutter`, and the CONSUMER sets
 * it on the container — a gutter is a property of the layout it sits in, not
 * of the theme. It is named here rather than allowed through by a wildcard so
 * that a SECOND undefined variable cannot join it unnoticed: the set is
 * asserted, not assumed.
 */
const CONSUMER_SUPPLIED: readonly string[] = ["--grid-gutter"];

/**
 * Every catalog utility produces a rule.
 *
 * The catalog is derived from the rules, so it cannot name a utility the
 * system does not produce — which is precisely why it could not catch
 * `border-b`. That name came from `BORDER_STYLE_NAMES`, the catalog believed
 * it, and the rule's character class had an omitted `b` so nothing matched it.
 * One rule, one catalog entry, no error, and `deno check` green throughout.
 *
 * The catalog proves a name is ADVERTISED. This proves it WORKS.
 */
Deno.test("every catalog utility produces a rule", async () => {
  assert(
    UTILITIES.length >= UTILITY_FLOOR,
    `the catalog names ${UTILITIES.length} utilities, below the floor of ${UTILITY_FLOOR} — the sweep below would pass on an empty set`,
  );
  const missing: string[] = [];
  for (const { name, css } of await sweep()) {
    if (!claims(css, name)) missing.push(name);
  }
  assertEquals(
    missing,
    [],
    `the catalog advertises these and the sheet has no rule for them: ${missing.join(", ")}`,
  );
});

/**
 * A utility we own never answers with a variable no spin sheet declares.
 *
 * This is the check the suite was missing, and the one whose absence cost a
 * week. wind4 answers fourteen of our families — `p-4`, `m-4`, `inset-4`,
 * `w-4`, `translate-x-2` and their relatives — and answers them with
 * `calc(var(--spacing) * N)`. Our sheet declares `--spacing-4` and
 * `--spacing-16`; it declares no `--spacing`. So the declaration PARSED, the
 * catalog named the utility, every assertion in the suite passed, and the
 * browser computed padding to nothing at all.
 *
 * The general form of the property: every custom property a value READS must
 * be defined by the sheet we ship or registered with `@property`. A read with a
 * fallback is exempt, because a fallback is the read answering its own
 * question, and a bare read is not — which is why the reads checked are the
 * bare ones, and why `wind4.ts` drew the same line when it decided a rule was
 * inert.
 *
 * The utilities are narrowed to the ones WE OWN, decided by asking a
 * generator built without wind4. Narrowing matters: a wind4 utility is allowed
 * to read wind4's variables, and holding it to our sheet would report the
 * layering working as designed.
 */
Deno.test("no utility we own reads a variable the sheet does not declare", async () => {
  const declared = declaredProperties(await fullSheet());
  const solo = await spinOnly();
  const offenders: string[] = [];
  for (const { name, css } of await sweep()) {
    // Ownership, asked rather than reimplemented: our rules alone produce it.
    const { css: ours } = await solo.generate(name, { preflights: false });
    if (!claimedClasses(ours).has(selectorFor(name))) continue;
    // `@property` registrations ship with the rule that needs them, so a name
    // registered HERE is defined for this utility even though the broad sheet
    // may never have triggered it.
    const known = new Set(declared);
    for (const match of css.matchAll(/@property\s+(--[\w-]+)/g)) {
      known.add(match[1]);
    }
    for (const read of bareReads(css)) {
      if (known.has(read) || CONSUMER_SUPPLIED.includes(read)) continue;
      offenders.push(`${name} reads ${read}`);
    }
  }
  assertEquals(
    offenders,
    [],
    `these read a variable no spin sheet declares, so they compute to nothing: ${offenders.join("; ")}`,
  );
});

/**
 * No custom property is defined in terms of itself.
 *
 * `--spacing-2: var(--spacing-2)` is not a tautology, it is a cycle: the
 * variable resolves to itself, which the CSS specification resolves as the
 * guaranteed-invalid value, and everything that spends the scale silently
 * computes to nothing. It is the most expensive bug in this history because it
 * looks like progress — the reference IS there, it is just empty.
 *
 * It arrived with wind4's preflights, whose theme block re-emits a spin token
 * as a variable of the same name. The preflights are not layered for exactly
 * this reason; nothing about excluding them guarantees nobody re-adds them, so
 * the sheet is checked for the shape directly rather than for the absence of a
 * particular import.
 */
Deno.test("no custom property is defined in terms of itself", async () => {
  const css = await fullSheet();
  const selfReferential: string[] = [];
  for (const match of css.matchAll(/(--[\w-]+):\s*var\(\s*\1\s*\)/g)) {
    selfReferential.push(match[0]);
  }
  assertEquals(
    selfReferential,
    [],
    `these variables are defined as themselves, which resolves to nothing: ${[...new Set(selfReferential)].join("; ")}`,
  );
});

/**
 * wind4's inert rules stay out, and no new ones wander in.
 *
 * `wind4Exclusions()` is where a rule that cannot work in a spin build is
 * recorded rather than silently dropped. Three static `transform-*` rules read
 * `--un-rotate-x` that nothing in the tree defines; the `blur` family is a
 * different shape of the same defect — its handler reads a `backdropBlur`
 * table a spin theme does not carry and throws inside `generate()` — so the
 * guarded wrapper reports it inert the first time anything asks for it, and
 * `backdrop-blur` quietly matches nothing instead of failing the build.
 * `from-primary`, whose values read variables nothing defines, completes the
 * family and is asserted for its consequence below.
 *
 * The inert SET is pinned, not just the names. A new exclusion is a
 * decision — wind4 grew a rule we cannot use — and it should be one somebody
 * makes on purpose. Pinning the set turns "wind4 added a rule and the sheet
 * quietly lost a utility" into a failing test with the rule's name in it.
 *
 * One wrinkle: the blur report is LAZY — it only exists after something
 * generates a blur utility — so this test asks for one first. An exclusion
 * list that grows with usage is honest about what happened, but only a test
 * that forces the read can pin it.
 */
Deno.test("wind4's inert rules stay out of the layer", async () => {
  const uno = await layered();
  // Force the lazy report: the guarded wrapper only learns the blur handler
  // cannot run when something actually asks for a blur utility.
  await uno.generate("backdrop-blur", { preflights: false });
  const KNOWN_INERT: readonly string[] = [
    "transform",
    "transform-cpu",
    "transform-gpu",
    "^(?:(backdrop-)|filter-)?blur(?:-(.+))?$",
  ];
  const inert = wind4Exclusions()
    .filter((exclusion) => exclusion.reason === "inert")
    .map((exclusion) => exclusion.rule);
  assertEquals(
    inert,
    [...KNOWN_INERT],
    `wind4's inert rules changed — a new one means a utility quietly left the layer: ${inert.join(", ")}`,
  );
  // And the consequence, which is the part a caller would notice: each of them
  // generates no rule at all. `from-primary` is not in the exclusion list — it
  // is not ours and wind4 does not claim it — but it is a member of this
  // family of defects, so it is asserted here too. The blur PATTERN is not a
  // utility and generates nothing by itself, so it is excluded from the loop.
  const leaked: string[] = [];
  for (const name of ["transform", "transform-cpu", "transform-gpu", "from-primary", "backdrop-blur"]) {
    const { css } = await uno.generate(name, { preflights: false });
    if (claims(css, name)) leaked.push(name);
  }
  assertEquals(
    leaked,
    [],
    `these generate a rule that computes to nothing: ${leaked.join(", ")}`,
  );
});
