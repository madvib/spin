/**
 * Derive a rule component's contract from its rules.
 *
 * A rule component has no stylesheet — its behaviour is a set of preset rules
 * that read theme tokens and emit selectors. The contract (variants and reads)
 * is derived by running those rules with a probe context:
 *
 * - `variants` are the class-bearing selectors the rules emit.
 * - `reads` are the theme tokens the rules access, observed via a recording
 *   proxy on `ctx.theme`.
 *
 * The proxy approach observes real behaviour rather than inferring it from
 * source text, so a token a rule reads conditionally is still captured.
 */

import type { Rule } from "@unocss/core";
import { indexTree, parseTokens, REF_SPECS, resolveAliases } from "@spin/theme";
import type { ThemeCssVar } from "@spin/theme/theme-types";
import type { State, Surface } from "../../reference/surface.ts";
import type { ThemeDocument } from "@spin/theme";
import { a11yRules } from "./a11y.ts";
import { alertRules } from "./alert.ts";
import { badgeRules } from "./badge.ts";
import { breadcrumbsRules } from "./breadcrumbs.ts";
import { buttonRules } from "./button.ts";
import { cardRules } from "./card.ts";
import { controlRules } from "./control.ts";
import { dialogRules } from "./dialog.ts";
import { accordionRules } from "./accordion.ts";
import { disclosureRules } from "./disclosure.ts";
import { avatarGroupRules } from "./avatar-group.ts";
import { avatarRules } from "./avatar.ts";
import { fieldBox } from "./field.ts";
import { fieldsetRules } from "./fieldset.ts";
import { groupRules } from "./group.ts";
import { hrRules } from "./hr.ts";
import { kbdRules } from "./kbd.ts";
import { labelRules } from "./label.ts";
import { iconRules } from "./icon.ts";
import { joinRules } from "./join.ts";
import { meterRules } from "./meter.ts";
import { modeRules } from "./mode.ts";
import { popoverRules } from "./popover.ts";
import { rangeRules } from "./range.ts";
import { ratingRules } from "./rating.ts";
import { progressRules } from "./progress.ts";
import { proseRules } from "./prose.ts";
import { radioRules } from "./radio.ts";
import { selectRules } from "./select.ts";
import { skeletonRules } from "./skeleton.ts";
import { statRules } from "./stat.ts";
import { tableRules } from "./table.ts";
import { tabsRules } from "./tabs.ts";
import { textareaRules } from "./textarea.ts";

/**
 * Convert a theme-object path to a CSS variable name.
 *
 * The theme object has keys like `colors`, `spacing`, `fontSize`, etc.
 * These map to token paths via REF_SPECS. For component roots (e.g. `button`),
 * the path is the token path directly.
 */
function themePathToCssVar(path: string): string {
  const segments = path.split(".");
  const spec = REF_SPECS.find((s) => s.key === segments[0]);
  if (spec === undefined) {
    // Component root: the path is the token path.
    return `--${segments.join("-")}`;
  }
  if (spec.depth === 0) {
    // The name is the last prefix segment.
    return `--${spec.prefix.join("-")}`;
  }
  // Token path = prefix + remaining segments.
  const tokenPath = [...spec.prefix, ...segments.slice(1)];
  return `--${tokenPath.join("-")}`;
}

/**
 * Create a recording theme proxy.
 *
 * The proxy records every property access path. A path is a leaf if no other
 * recorded path starts with it (i.e., it's not a prefix of another path).
 */
function createProbeTheme(): { theme: unknown; paths: Set<string> } {
  const paths = new Set<string>();
  // The value handed back for a read. It has to be a PRIMITIVE: a proxy
  // records correctly but cannot be interpolated, lowercased or compared, and
  // a rule that does any of those throws before its first yield — which is
  // how a component derives an empty contract while rendering perfectly.
  //
  // A plausible literal rather than a sentinel, so a rule's own logic runs to
  // completion and the derivation sees the code path a real theme would take.
  // `#000000` reads as a colour, is truthy, and satisfies `!== undefined`.
  // A Proxy needs an object target, so the target is an object that CLAIMS to
  // be the value: `valueOf` and `toPrimitive` are what a template literal, a
  // numeric comparison or `.toLowerCase()` actually call, so intercepting them
  // is what makes the value behave like the literal it stands for.
  const PROBE_VALUE = "#000000";
  const makeProxy = (path: string[]): unknown =>
    new Proxy(
      {
        valueOf: () => PROBE_VALUE,
        toString: () => PROBE_VALUE,
        [Symbol.toPrimitive]: () => PROBE_VALUE,
      },
      {
        get(target, prop) {
          if (typeof prop === "symbol") return target[prop as never];
          const newPath = [...path, String(prop)];
          paths.add(newPath.join("."));
          return makeProxy(newPath);
        },
      },
    );
  return { theme: makeProxy([]), paths };
}

/**
 * Extract leaf paths from all recorded paths.
 *
 * A path is a leaf if no other recorded path starts with it (i.e., it's not a
 * prefix of another path). Spurious reads from JavaScript's implicit
 * conversions (`toString`, `valueOf`, `Symbol.toPrimitive`) are filtered out.
 */
function leafPaths(paths: Set<string>): string[] {
  const spurious = new Set(["toString", "valueOf", "toPrimitive"]);
  const filtered = new Set<string>();
  for (const p of paths) {
    const lastSegment = p.split(".").pop()!;
    if (!spurious.has(lastSegment)) filtered.add(p);
  }
  const sorted = [...filtered].sort();
  const leaves: string[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const path = sorted[i]!;
    const next = sorted[i + 1];
    if (next !== undefined && next.startsWith(path + ".")) {
      continue;
    }
    leaves.push(path);
  }
  return leaves;
}

/**
 * Extract selectors from rule yields.
 *
 * A yield is either:
 * - An array: first element is `[symbol, selectorFunction]`
 * - An object: has a symbol key mapping to a selector function
 */
function extractSelectors(yields: unknown[]): string[] {
  const selectors: string[] = [];
  for (const y of yields) {
    if (y === null || y === undefined) continue;
    if (Array.isArray(y)) {
      // Array yield: first element is [symbol, selectorFunction]
      const first = y[0];
      if (Array.isArray(first) && typeof first[1] === "function") {
        selectors.push((first[1] as () => string)());
      }
    } else if (typeof y === "object") {
      // Object yield: selector function is under a Symbol key. Spreads of
      // `ctx.symbols` — which several rules use, so a computed key lands on a
      // SYMBOL, not a string — keep that key, so both are checked.
      for (
        const sym of [
          ...Object.getOwnPropertySymbols(y),
          ...(Object.keys(y) as (string | symbol)[]).filter((k) =>
            typeof k === "symbol"
          ),
        ]
      ) {
        const value = (y as Record<symbol, unknown>)[sym];
        if (typeof value === "function") {
          selectors.push((value as () => string)());
        }
      }
    }
  }
  return selectors;
}

/**
 * Extract variants from selectors.
 *
 * A variant is a class name in a selector. A bare tag is not a variant.
 */
function extractVariants(selectors: string[]): string[] {
  const variants = new Set<string>();
  for (const selector of selectors) {
    for (const m of selector.matchAll(/\.([a-z][a-z0-9-]*)/gi)) {
      variants.add((m[1] as string).toLowerCase());
    }
  }
  return [...variants].sort();
}

/**
 * Extract element tag names from selectors.
 *
 * A tag name is a bare element name in a selector — `button` in
 * `:is(button, [type="submit"])`, `input` in `input[type="checkbox"]`.
 * Pseudo-classes (`:hover`), pseudo-elements (`::before`), class selectors
 * (`.foo`), and ID selectors (`#bar`) are not tags.
 *
 * `:is()` is DESCENDED into, not treated as an unknown compound. Splitting a
 * selector on combinators alone leaves `:is(checkbox, input[type="checkbox"])`
 * as one fragment beginning with `:is(`, which matches no bare-tag pattern —
 * so every control that claims its own tag through `:is()` derived an EMPTY
 * tag list and claimed nothing. That is invisible until something asks what a
 * component styles, which is exactly the kind of wrong answer a derivation
 * exists to make impossible.
 * Only the SUBJECT of a selector is styled: `fieldset[disabled] *` styles the
 * descendant, not the fieldset. Claiming every compound made ancestors into
 * tags — how `fieldset` came to be listed as an element the a11y component
 * styles when its rule only ever styles what sits inside a disabled one.
 */
function extractTags(selectors: string[]): string[] {
  const tags = new Set<string>();
  for (const selector of selectors) {
    for (const group of flattenIs(selector)) {
      const compounds = group.split(/[\s>+~]+/);
      const subject = compounds[compounds.length - 1];
      if (subject === undefined) continue;
      const m = /^([a-z][a-z0-9-]*)/i.exec(subject);
      if (m !== null) tags.add((m[1] as string).toLowerCase());
    }
  }
  return [...tags].sort();
}

/**
 * A selector split into its alternatives, descending through `:is()`.
 *
 * `:where()` and `:not()` are NOT descended: `:not([disabled])` contains no
 * element, and descending into a negation would claim every element the author
 * is excluding. `:has()` likewise describes a relationship rather than the
 * element it is written on.
 *
 * The parentheses are counted rather than matched by a regex, because the
 * content of an `:is()` routinely CONTAINS them:
 * `:is(checkbox, input[type="checkbox"]:not([role]))` has three nesting
 * levels, and a `[^()]*` pattern does not match it at all — which is how every
 * control came to claim no tags while looking correct everywhere.
 */
function flattenIs(selector: string): string[] {
  const out: string[] = [];
  let cursor = 0;
  for (;;) {
    const open = selector.indexOf(":is(", cursor);
    if (open === -1) break;

    // Find the `)` that closes THIS `:is(`, counting nested parens. The scan
    // starts ON the opening paren with depth 1 already entered, or the first
    // `(` it meets is counted as a nest and the matching `)` for the `:is(`
    // itself is mistaken for a closer one level in.
    let depth = 1;
    let close = open + 4;
    for (; close < selector.length; close++) {
      const ch = selector[close];
      if (ch === "(") depth++;
      else if (ch === ")") {
        depth--;
        if (depth === 0) break;
      }
    }
    if (close >= selector.length) break;

    // Everything before the `:is(` is its own alternative — a selector like
    // `nav :is(a, b)` still claims `nav`.
    out.push(selector.slice(cursor, open));
    const inner = selector.slice(open + 4, close);
    // Split the alternatives at top level only: a comma inside a nested
    // `:not(...)` separates nothing.
    for (const part of splitTopLevel(inner)) {
      out.push(...flattenIs(part.trim()));
    }
    cursor = close + 1;
  }
  out.push(selector.slice(cursor));
  return out.filter((part) => part.trim().length > 0);
}

/** Split on commas that are not inside parentheses. */
export function splitTopLevel(text: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    else if (ch === "," && depth === 0) {
      out.push(text.slice(start, i));
      start = i + 1;
    }
  }
  out.push(text.slice(start));
  return out;
}

/**
 * Run a rule's generator with a probe ctx.
 */
function runRule(
  rule: Rule,
  probe: { theme: unknown; paths: Set<string> },
  label?: string,
): unknown[] {
  const handler = rule[1];
  if (typeof handler !== "function") return [];

  const selectorSymbol = Symbol("selector");
  const parentSymbol = Symbol("parent");

  const ctx = {
    theme: probe.theme,
    symbols: {
      selector: selectorSymbol,
      parent: parentSymbol,
    },
  };

  const yields: unknown[] = [];
  try {
    const gen = handler([""], ctx as Parameters<typeof handler>[1]);
    if (gen !== null && typeof gen === "object" && Symbol.iterator in gen) {
      for (const y of gen) {
        yields.push(y);
      }
    } else if (gen !== null && typeof gen === "object") {
      // Non-generator return
      yields.push(gen);
    }
  } catch (error) {
    // A rule that throws is skipped, which is right for GENERATION and wrong
    // for derivation: a crash here means the contract is silently incomplete,
    // and a silent skip is how a component ends up claiming no tags. So the
    // reason is reported rather than swallowed.
    console.error(
      `derive: ${label ?? "rule"} threw:`,
      String(error).slice(0, 120),
    );
  }
  return yields;
}

/**
 * The rule functions for each component, with the roots that enable them.
 */
const RULE_SOURCES: Record<string, () => Rule[]> = {
  a11y: () => a11yRules(["a11y"]),
  alert: () => alertRules(["alert"], { classless: true }),
  "avatar-group": () =>
    avatarGroupRules(["avatar-group"], { classless: false }),
  badge: () => badgeRules(["badge"], { classless: true }),
  breadcrumbs: () => breadcrumbsRules(["breadcrumbs"], { classless: false }),
  button: () => buttonRules(["button"]),
  join: () => joinRules(["join"], { classless: false }),
  skeleton: () => skeletonRules(["skeleton"], { classless: false }),
  card: () => cardRules(["card"], { classless: true }),
  checkbox: () => controlRules(["checkbox"]),
  switch: () => controlRules(["switch"]),
  dialog: () => dialogRules(["dialog"], { classless: true }),
  accordion: () => accordionRules(["accordion"], { classless: true }),
  details: () => disclosureRules(["details"], { classless: true }),
  progress: () => progressRules(["progress"], { classless: true }),
  table: () => tableRules(["table"], { classless: true }),
  tabs: () => tabsRules(["tabs"], { classless: true }),
  popover: () => popoverRules(["popover"], { classless: true }),
  prose: () => proseRules(["prose"], { classless: true }),
  group: () => groupRules(["group"]),
  radio: () => radioRules(["radio"]),
  icon: () => iconRules(["icon"]),
  meter: () => meterRules(["meter"], { classless: true }),
  mode: () => modeRules(["mode"], { classless: false }),
  field:
    () => [fieldBox(), ...selectRules(["field"]), ...textareaRules(["field"])],
  range: () => rangeRules(["range"], { classless: true }),
  rating: () => ratingRules(["rating"], { classless: false }),
  avatar: () => avatarRules(["avatar"], { classless: false }),
  hr: () => hrRules(["hr"], { classless: true }),
  kbd: () => kbdRules(["kbd"], { classless: true }),
  stat: () => statRules(["stat"], { classless: false }),
  label: () => labelRules(["label"], { classless: true }),
  fieldset: () => fieldsetRules(["fieldset"], { classless: true }),
};

/** The custom properties the default theme actually declares. */
export const declaredVars: ReadonlySet<string> = (() => {
  try {
    const doc = JSON.parse(
      Deno.readTextFileSync(
        new URL("../../../../theme/src/themes/default.json", import.meta.url),
      ),
    ) as ThemeDocument;
    const parsed = parseTokens(doc);
    if (!parsed.ok) throw new Error(parsed.error);
    const vars = indexTree(resolveAliases(parsed.tree).tree).vars;
    return new Set(Object.keys(vars).map((k) => `--${k}`));
  } catch (error) {
    // NOT a silent fallback. A derivation that cannot see the theme cannot
    // tell a real token from one a rule merely hoped for, and allowing
    // everything would produce a manifest that lists tokens no theme declares
    // — the exact failure this was built to prevent, wearing the costume of a
    // check that passed.
    throw new Error(
      `derive: cannot read the default theme, so reads cannot be filtered: ${
        String(error).slice(0, 160)
      }`,
    );
  }
})();

/**
 * Derive the contract for a rule component.
 */
export function deriveRuleContract(
  name: string,
): { variants: string[]; reads: ThemeCssVar[]; tags: string[] } {
  const source = RULE_SOURCES[name];
  if (source === undefined) {
    throw new Error(`no rule source for component: ${name}`);
  }
  const rules = source();
  const probe = createProbeTheme();
  const allYields: unknown[] = [];
  for (const rule of rules) {
    const yields = runRule(rule, probe, name);
    allYields.push(...yields);
  }
  const selectors = extractSelectors(allYields);
  const variants = extractVariants(selectors);
  // Only paths the DEFAULT THEME declares count as reads.
  //
  // The probe records every access a rule MAKES, including ones it guards: a
  // rule that tries `font.family.heading` and falls back if absent records
  // that path even though no theme has it. Listing it would put a token in the
  // manifest that nothing declares — which is the exact failure this
  // derivation exists to prevent, reintroduced through the back door.
  //
  // Filtering against the theme rather than hardcoding a list is also what
  // keeps the manifest honest when a token is RENAMED: the read stops being
  // declared, and the type rejects it at the next compile.
  const reads = leafPaths(probe.paths)
    .map(themePathToCssVar)
    .filter((name): name is ThemeCssVar => declaredVars.has(name))
    .sort();
  const tags = extractTags(selectors);
  return { variants, reads, tags };
}

/* ------------------------------------------------------------- the manifest -- */

/**
 * The one authored part of a component's entry.
 *
 * `character` is a token the THEME owns, declared so a scaffold can write a
 * placeholder for it. It is hand knowledge rather than an observation, which
 * is why it survives a regeneration and everything else does not.
 */
interface Authored {
  readonly comment: string;
  readonly header: string;
  readonly character: string;
}

/**
 * Write the checked-in manifest from what the rules actually do.
 *
 * The manifest is a GENERATED report, not a contract anyone maintains:
 * `tags`, `variants` and `reads` are read off the rules, so they cannot drift
 * from them. `character` is the one authored field, because a theme-owned
 * token is a decision and a decision is not something you can observe by
 * running code.
 *
 * Idempotent by construction: running it twice produces the same file, since
 * nothing in the output depends on what was there before except that one
 * authored field.
 */

/** A manifest key, quoted when the name carries a character JS cannot bare. */
function quoted(name: string): string {
  return /^\w+$/.test(name) ? name : JSON.stringify(name);
}

function renderArray(key: string, values: readonly string[]): string {
  if (values.length === 0) return `    ${key}: [],`;
  const inline = values.map((v) => JSON.stringify(v)).join(", ");
  if (`    ${key}: [${inline}],`.length <= 80) {
    return `    ${key}: [${inline}],`;
  }
  return [
    `    ${key}: [`,
    ...values.map((v) => `      ${JSON.stringify(v)},`),
    "    ],",
  ].join("\n");
}

/** The values inside a `[...]` array literal, as data. */

const NO_AUTHORED: Authored = {
  header: "",
  character: "    character: [],",
  comment: "",
};

/**
 * Pull the authored fields out of the checked-in manifest. Codegen rewrites
 * `variants` and `reads` for the components it owns; tags, character and the
 * preserved fields are hand knowledge the CSS cannot speak to.
 */
function parseAuthored(text: string): Map<string, Authored> {
  const out = new Map<string, Authored>();
  const block = /export const primitiveContracts[^=]*= \{([\s\S]*?)\n\};/.exec(
    text,
  );
  if (!block) return out;
  const body = block[1] as string;
  const parts = body.split(/\n(?= {2}[\w-]+: \{)/).slice(1);
  for (const part of parts) {
    const name = /^ {2}([\w-]+): \{/.exec(part)?.[1];
    if (!name) continue;
    const header = /\/\*[\s\S]*?\*\/\n(?= {2}[\w-]+: \{)/.exec(part)?.[0] ?? "";
    const comment = / {2}\/\*[\s\S]*?\*\/\n(?= {2}[\w-]+:)/.exec(part)?.[0] ??
      "";
    out.set(name, {
      header: header.replace(/\n+$/, ""),
      character: /^ {4}character: \[[\s\S]*?\],/m.exec(part)?.[0] ??
        "    character: [],",
      comment: comment.replace(/\n+$/, ""),
    });
  }
  return out;
}

const DECL =
  "export const primitiveContracts: Record<string, PrimitiveContract> = {";

const DEFAULT_HEADER = `/**
 * Primitives manifest — each component's contract with the theme: \`tags\`,
 * \`variants\` and \`reads\` are derived from its rules by probing rule
 * execution (\`deno task codegen\`), \`character\` is authored, and
 * \`tests/manifest.test.ts\` fails when the checked-in file goes stale.
 */`;

export async function writeManifest(): Promise<void> {
  const existing = await readIfPresent(MANIFEST_OUT);
  const authored = parseAuthored(existing);

  // Refuse to write over authored fields this cannot read back: silently
  // emitting `character: []` would lose the one piece of hand knowledge in the
  // file, and it would look like a successful run.
  if (existing.length > 0 && authored.size === 0) {
    throw new Error(
      "could not read the authored fields out of the checked-in manifest",
    );
  }

  const headerEnd = existing.indexOf(DECL);
  const header = existing.slice(0, headerEnd).trimEnd() ||
    DEFAULT_HEADER.trimEnd();
  // Everything below the declaration is hand-maintained — the readers the
  // studio and the lint join on — so it is carried over verbatim.
  const close = existing.indexOf("\n};", headerEnd);
  const tail = close === -1 ? "" : existing.slice(close + 3);
  // The names come from the rules themselves, so a component cannot exist in
  // the manifest without rules behind it, or be missing from it while having
  // them.
  const names = Object.keys(RULE_SOURCES).sort();
  const blocks = names.map((name) => {
    const derived = deriveRuleContract(name);
    const mine = authored.get(name) ?? NO_AUTHORED;
    return [
      mine.comment,
      `  ${quoted(name)}: {`,
      mine.header ? mine.header + "\n" : "",
      renderArray("tags", derived.tags),
      renderArray("variants", derived.variants),
      renderArray("reads", derived.reads),
      mine.character,
      "  },",
    ].filter((line) => line !== "").join("\n");
  });

  await Deno.writeTextFile(
    MANIFEST_OUT,
    [header, "", DECL, ...blocks, "};", tail].join("\n"),
  );
  console.log(`manifest.ts written (${names.length} components)`);
}

const MANIFEST_OUT = new URL("./manifest.ts", import.meta.url);

async function readIfPresent(url: URL): Promise<string> {
  try {
    return await Deno.readTextFile(url);
  } catch {
    // First run: no checked-in manifest yet.
    return "";
  }
}

if (import.meta.main) {
  await writeManifest();
}
/* ------------------------------------------------------------------- states -- */

/** A pseudo-element suffix, so it is not mistaken for a pseudo-CLASS. */
const PSEUDO_ELEMENT = /::[a-z-]+/gi;

/**
 * Every state a component's rules emit, read off the selectors.
 *
 * A state is a pseudo-CLASS or an attribute condition in a selector the rule
 * actually produces, which means the list cannot drift from the CSS: a state
 * not in a selector cannot happen, and one that is in a selector cannot be
 * forgotten by whoever draws the reference.
 *
 * PSEUDO-ELEMENTS are excluded. A `::before` is a rendering OF its element, not
 * a state an author can ask for, and listing it would put rows in the matrix
 * that nobody can inspect or click.
 *
 * Order is first appearance, which is roughly base-then-interaction and so
 * reads in the order a person would try them. Sorted alphabetically, a matrix
 * reads `:checked, :disabled, :focus` and the sequence is gone.
 */
export function deriveStates(name: string): State[] {
  const source = RULE_SOURCES[name];
  if (source === undefined) return [];

  const probe = createProbeTheme();
  const selectors: string[] = [];
  for (const rule of source()) {
    selectors.push(...extractSelectors(runRule(rule, probe, name)));
  }

  const out: State[] = [];
  const seen = new Set<string>();

  const add = (state: State) => {
    if (seen.has(state.when)) return;
    seen.add(state.when);
    out.push(state);
  };

  // `:is()` and `:not()` are COMBINERS, not states: they say which element a
  // rule applies to, and listing "is" as a state would put a row nobody can
  // ask for into every matrix. Nor is `:hover` on a child a state of the
  // control — so anything inside a functional pseudo-class is skipped.
  const COMBINERS = new Set(["is", "not", "where", "has", "matches"]);
  // STRUCTURAL pseudo-classes position an element inside its parent. A matrix
  // row for them is a row nobody asked for — you do not write `:first-child`,
  // it is a consequence of order — so they are listed apart from the states.
  const STRUCTURAL = new Set([
    "first-child",
    "last-child",
    "only-child",
    "nth-child",
    "first-of-type",
    "last-of-type",
    "only-of-type",
    "nth-of-type",
    "first-letter",
    "first-line",
    "root",
    "empty",
  ]);

  for (const selector of selectors) {
    const bare = selector.replace(PSEUDO_ELEMENT, "");
    // Drop the contents of a functional pseudo-class: `:is(button, [type="x"])`
    // contributes a STATE only if something outside it does.
    const outside = bare.replace(
      /:(is|not|where|has|matches)\([^()]*(\([^()]*\)[^()]*)*\)/g,
      "",
    );
    for (const m of outside.matchAll(/:([a-z-]+)/g)) {
      const name = m[1] as string;
      if (COMBINERS.has(name) || STRUCTURAL.has(name)) continue;
      add({ name: name.replace(/-/g, " "), when: `:${name}` });
    }
    for (
      const m of outside.matchAll(
        /\[([a-z][a-z-]*)(?:([~|^$*]?)=(?:"([^"]*)"|'([^']*)'|([^\]]*)))?\]/g,
      )
    ) {
      const [, name, , dq, sq, bareValue] = m;
      const value = dq ?? sq ?? bareValue;
      // A plain attribute selector is a STATE only when it has a value — the
      // four of them without one are capabilities rather than conditions.
      if (name === undefined) continue;
      // A CAPABILITY selector is not a state: `input[type="text"]` says which
      // elements the rule reaches, and `role="group"` names a container. Only
      // an attribute a person would SET on an element is a state, and those are
      // the ARIA ones — which is not a coincidence: they are the states a
      // component already exposes to assistive technology.
      if (value === undefined) continue;
      if (!name.startsWith("aria-") && !name.startsWith("data-")) continue;
      add({
        name: `${name.replace(/-/g, " ")} ${value}`,
        when: `[${name}="${value}"]`,
        attrs: { [name]: value },
      });
    }
  }
  return out;
}

/** A component's full surface: what it claims, offers, spends, and how. */
export function deriveSurface(name: string): Surface {
  const contract = deriveRuleContract(name);
  const tags = contract.tags;
  return {
    name,
    tags,
    // A variant is a class the component defines; a tag is an element it
    // claims. Deriving one from the other would put `button` in the variant
    // list, which is exactly the confusion the vocabulary split exists to stop.
    variants: contract.variants.filter((v) => !tags.includes(v)),
    reads: contract.reads,
    // A component owns a token group when it declares character tokens under
    // it — which is the only place a component makes a decision of its own.
    claims: (manifestAuthored()[name] ?? []).length > 0 ? [name] : [],
  };
}

/** The `character` steps the checked-in manifest records for a component. */
function manifestAuthored(): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  const src = Deno.readTextFileSync(new URL("./manifest.ts", import.meta.url));
  for (
    const m of src.matchAll(
      /^ {2}([\w-]+): \{[\s\S]*?character: \[([\s\S]*?)\],/gm,
    )
  ) {
    const name = m[1] as string;
    const body = m[2] ?? "";
    out[name] = [...body.matchAll(/"([\w-]+\.[\w-]+)"/g)].map((p) =>
      p[1] as string
    );
  }
  return out;
}
