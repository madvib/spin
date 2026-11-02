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

import { readFileSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { Rule } from "@unocss/core";
import { indexTree, parseTokens, resolveAliases } from "../../../theme/index.ts";
import type { ThemeCssVar } from "../../../theme/theme-types.d.ts";
import type { ThemeDocument } from "../../../theme/index.ts";
import { a11yRules } from "./a11y.ts";
import { alertRules } from "./alert.ts";
import { badgeRules } from "./badge.ts";
import { breadcrumbsRules } from "./breadcrumbs.ts";
import { buttonRules } from "./button.ts";
import { cardRules } from "./card.ts";
import {
  elementNamed,
  PRIMITIVE_CATEGORIES,
  PRIMITIVE_ELEMENTS,
} from "./categories.ts";
import { controlRules } from "./control.ts";
import { dialogRules } from "./dialog.ts";
import { disclosureRules } from "./disclosure.ts";
import { fieldBox } from "./field.ts";
import { fieldsetRules } from "./fieldset.ts";
import { hrRules } from "./hr.ts";
import { kbdRules } from "./kbd.ts";
import { labelRules } from "./label.ts";
import { iconRules } from "./icon.ts";
import { joinRules } from "./join.ts";
import { meterRules } from "./meter.ts";
import { panelRules } from "./panel.ts";
import { progressRules } from "./progress.ts";
import { proseRules } from "./prose.ts";
import { radioRules } from "./radio.ts";
import { rangeRules } from "./range.ts";
import { skeletonRules } from "./skeleton.ts";
import { swatchRules } from "./swatch.ts";
import { statRules } from "./stat.ts";
import { tableRules } from "./table.ts";
import { tooltipRules } from "./tooltip.ts";
import { textareaRules } from "./textarea.ts";
import {
  type Claim,
  type PaintKey,
  paintKeyOf,
  type Placement,
  type PrimitiveScope,
} from "./scope.ts";
import { primitiveClaims } from "./scopes.ts";

/**
 * A recorded read, as its CSS variable name.
 *
 * The recording proxy observes the ONE property access a reader makes —
 * `theme["spacing-4"]` — and the flat map's keys are custom property names
 * without the leading `--`, so the variable is the recorded key itself,
 * prefixed.
 */
function themePathToCssVar(path: string): string {
  return `--${path}`;
}

/**
 * Create a recording theme proxy.
 *
 * The proxy records every property access path. A path is a leaf if no other
 * recorded path starts with it (i.e., it's not a prefix of another path).
 *
 * The proxy answers as the BASELINE answers: a token the baseline declares
 * reads as a plausible literal, and a token it does not declare reads as
 * absent. That matters because a rule which paints only when a token is
 * declared must be DERIVED as it paints in the baseline — a decision the
 * theme has not made is not a decision the primitive makes. The per-element
 * typography is the case: it is optional, and a rule that sets a paragraph's
 * size only when the theme says so paints no size at all in a theme that
 * says nothing.
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
          // The baseline's answer: a token the baseline does not declare is
          // absent, and the rule that reads it takes the other branch.
          const name = `--${newPath.join("-").toLowerCase()}`;
          if (!declaredVars.has(name)) return undefined;
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
 * Extract the selectors and the properties from rule yields.
 *
 * A yield is either:
 * - An array: first element is `[symbol, selectorFunction]`, the rest are
 *   `[property, value]` entries.
 * - An object: has a symbol key mapping to a selector function, and string
 *   keys naming the properties it sets.
 *
 * The properties are what the rule DECIDES; the selector is where it decides
 * them. Both are needed to say which element owns what.
 */
interface Painted {
  /** The selector the rule paints. */
  readonly selector: string;
  /** The properties the rule sets on it. */
  readonly properties: readonly string[];
}

function extractPainted(yields: unknown[]): Painted[] {
  const out: Painted[] = [];
  for (const y of yields) {
    if (y === null || y === undefined) continue;
    if (Array.isArray(y)) {
      const first = y[0];
      if (Array.isArray(first) && typeof first[1] === "function") {
        const properties: string[] = [];
        for (const entry of y.slice(1)) {
          if (Array.isArray(entry) && typeof entry[0] === "string") {
            properties.push(entry[0]);
          }
        }
        out.push({ selector: (first[1] as () => string)(), properties });
      }
      continue;
    }
    if (typeof y !== "object") continue;
    // Spreads of `ctx.symbols` — which several rules use, so a computed key
    // lands on a SYMBOL, not a string — keep that key, so both are checked.
    for (
      const sym of [
        ...Object.getOwnPropertySymbols(y),
        ...(Object.keys(y) as (string | symbol)[]).filter((k) =>
          typeof k === "symbol"
        ),
      ]
    ) {
      const value = (y as Record<symbol, unknown>)[sym];
      if (typeof value !== "function") continue;
      out.push({
        selector: (value as () => string)(),
        properties: Object.keys(y),
      });
    }
  }
  return out;
}

/**
 * The compounds of a selector, split at the combinators.
 *
 * The parentheses are counted rather than matched by a regex, because the
 * content of an `:is()` routinely CONTAINS them — and a combinator inside a
 * functional pseudo-class is not a combinator at all: `:is(a > b)` is one
 * compound.
 */
function compoundsOf(selector: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < selector.length; i++) {
    const ch = selector[i] as string;
    if (ch === "(") {
      depth++;
      continue;
    }
    if (ch === ")") {
      depth--;
      continue;
    }
    if (depth > 0) continue;
    if (ch === ">" || ch === "+" || ch === "~" || /\s/.test(ch)) {
      out.push(selector.slice(start, i));
      start = i + 1;
    }
  }
  out.push(selector.slice(start));
  return out.map((part) => part.trim()).filter((part) => part.length > 0);
}

/**
 * The combinators a selector chains its compounds with.
 *
 * The space is the DESCENDANT combinator and `>` is the child one: both put
 * the subject INSIDE another element, so the subject only exists to be
 * painted as that element's descendant.
 *
 * `+` and `~` are SIBLINGS. A sibling is not an ancestor: `li + li` says
 * "the item that follows another item", and it says it about every list in
 * the application — the subject is painted wherever it is written, and the
 * relationship is between two elements at the same level.
 *
 * The parentheses are counted rather than matched by a regex, for the same
 * reason `compoundsOf` counts them: a combinator inside a functional
 * pseudo-class is not a combinator at all.
 */
function combinatorsOf(selector: string): string[] {
  const out: string[] = [];
  let depth = 0;
  // Whitespace is a combinator only when it stands ALONE: the space around
  // an explicit combinator is that combinator's formatting, so `a + b` is one
  // sibling combinator and not a descendant and a sibling.
  let pendingSpace = false;
  let afterExplicit = false;
  let seenCompound = false;
  for (let i = 0; i < selector.length; i++) {
    const ch = selector[i] as string;
    if (ch === "(") {
      depth++;
      continue;
    }
    if (ch === ")") {
      depth--;
      continue;
    }
    if (depth > 0) continue;
    if (ch === ">" || ch === "+" || ch === "~") {
      pendingSpace = false;
      afterExplicit = true;
      out.push(ch);
      continue;
    }
    if (/\s/.test(ch)) {
      pendingSpace = true;
      continue;
    }
    if (pendingSpace && !afterExplicit && seenCompound) out.push(" ");
    pendingSpace = false;
    afterExplicit = false;
    seenCompound = true;
  }
  return out;
}

/**
 * The elements a selector reaches, and where each of them is reached.
 *
 * Only the SUBJECT of a selector is styled: `fieldset[disabled] *` styles the
 * descendant, not the fieldset. The subject is the last compound of each
 * alternative, and `:is()` is descended into — `button` in
 * `:is(button, [type="submit"])`.
 *
 * A CLASS claim is not a tag: `.card-header` names a class, and the element
 * that carries it is whatever the author wrote. The primitives whose own
 * element is a class claim no tag at all, and that is what keeps a class
 * name from becoming an element everybody owns.
 *
 * An alternative that reaches below its subject reaches a DESCENDANT of
 * something; one that does not paints the element itself, wherever it is.
 * What "below" means is an ANCESTOR — a descendant or a child combinator.
 * A sibling combinator relates two elements at the same level and puts
 * neither inside the other, so a rule that reaches its subject through one
 * paints it wherever it is.
 */
interface Reached {
  /** The tag the subject carries. */
  readonly tag: string;
  /** Where the subject has to sit for the rule to paint it. */
  readonly where: Placement;
}

function reachedBy(selector: string): Reached[] {
  const out: Reached[] = [];
  for (const alternative of splitTopLevel(selector)) {
    const compounds = compoundsOf(alternative);
    const where: Placement = combinatorsOf(alternative).some((combinator) =>
        combinator === " " || combinator === ">"
      )
      ? "descendant"
      : "global";
    const subject = compounds[compounds.length - 1];
    if (subject === undefined) {
      continue;
    }
    for (const tag of tagsOf(subject)) {
      out.push({ tag, where });
    }
  }
  return out;
}

/**
 * The tags a compound carries.
 *
 * A compound may be an `:is()` list, so it is descended into; and what is
 * inside may itself be a compound — `fieldset[disabled] *` is one compound
 * whose subject is the universal selector, not the fieldset.
 */
function tagsOf(compound: string): string[] {
  const tags = new Set<string>();
  for (const part of flattenIs(compound)) {
    const inner = compoundsOf(part);
    const subject = inner[inner.length - 1];
    if (subject === undefined) continue;
    const m = /^([a-z][a-z0-9-]*)/i.exec(subject.trim());
    if (m !== null) tags.add((m[1] as string).toLowerCase());
  }
  return [...tags];
}

/**
 * Whether a selector paints a pseudo-element rather than the element.
 *
 * `::before` is a rendering OF the element, not the element's own look: the
 * properties it sets belong to the pseudo-element, and counting them as the
 * element's would claim a decision the element does not make.
 */
function paintsPseudoElement(selector: string): boolean {
  return /::[a-z-]+/i.test(selector);
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
  badge: () => badgeRules(["badge"], { classless: true }),
  breadcrumbs: () => breadcrumbsRules(["breadcrumbs"], { classless: false }),
  button: () => buttonRules(["button"]),
  join: () => joinRules(["join"], { classless: false }),
  skeleton: () => skeletonRules(["skeleton"], { classless: false }),
  card: () => cardRules(["card"], { classless: true }),
  checkbox: () => controlRules(["checkbox"]),
  switch: () => controlRules(["switch"]),
  dialog: () => dialogRules(["dialog"], { classless: true }),
  details: () => disclosureRules(["details"], { classless: true }),
  progress: () => progressRules(["progress"], { classless: true }),
  table: () => tableRules(["table"], { classless: true }),
  prose: () => proseRules(["prose"], { classless: true }),
  radio: () => radioRules(["radio"]),
  range: () => rangeRules(["range"]),
  icon: () => iconRules(["icon"]),
  meter: () => meterRules(["meter"], { classless: true }),
  panel: () => panelRules(["panel"], { classless: true }),
  hr: () => hrRules(["hr"], { classless: true }),
  kbd: () => kbdRules(["kbd"], { classless: true }),
  label: () => labelRules(["label"], { classless: true }),
  stat: () => statRules(["stat"], { classless: false }),
  swatch: () => swatchRules(["swatch"], { classless: true }),
  tooltip: () => tooltipRules(["tooltip"], { classless: true }),
  fieldset: () => fieldsetRules(["fieldset"], { classless: true }),
  field: () => [fieldBox()],
};

/** The custom properties the baseline theme actually declares. */
export const declaredVars: ReadonlySet<string> = (() => {
  try {
    const doc = JSON.parse(
      readFileSync(
        fileURLToPath(
          new URL("../../../theme/themes/silk.json", import.meta.url),
        ),
        "utf8",
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
      `derive: cannot read the baseline theme, so reads cannot be filtered: ${
        String(error).slice(0, 160)
      }`,
    );
  }
})();

/**
 * Derive the scope of a rule component: what it paints, and what it decides
 * for each of the elements it paints.
 *
 * The CLAIM is authored (`scopes.ts`); this reads it back and checks the
 * rules against it. A rule that styles a tag the claim does not name — or
 * paints it somewhere the claim does not say — is a FAILURE, not a widening:
 * a primitive that reaches outside its scope would paint elements nobody
 * declared it paints, and the manifest would record the widening as though it
 * had been intended.
 *
 * The claim is a parameter so the check can be exercised: a claim that does
 * not cover what the rules reach is rejected, and that rejection is the
 * check working.
 *
 * What each painted element OWNS is observed, because it is the rules that
 * decide it: the properties a rule sets are the decisions it makes, and a
 * manifest that claimed a decision the rules do not make would be a claim
 * nothing backs.
 */
export function deriveScope(name: string, claim?: Claim): PrimitiveScope {
  const declared = claim ?? primitiveClaims[name];
  if (declared === undefined) {
    throw new Error(`no scope declared for component: ${name}`);
  }
  const source = RULE_SOURCES[name];
  if (source === undefined) {
    throw new Error(`no rule source for component: ${name}`);
  }
  const probe = createProbeTheme();
  const owns = new Map<string, Set<string>>();
  const reached = new Set<string>();
  for (const rule of source()) {
    for (const painted of extractPainted(runRule(rule, probe, name))) {
      const keys = paintsPseudoElement(painted.selector)
        ? []
        : painted.properties
          .map(paintKeyOf)
          .filter((key): key is PaintKey => key !== undefined);
      for (const { tag, where } of reachedBy(painted.selector)) {
        const key = `${tag}:${where}`;
        reached.add(key);
        if (keys.length === 0) continue;
        const set = owns.get(key) ?? new Set<string>();
        for (const owned of keys) set.add(owned);
        owns.set(key, set);
      }
    }
  }
  const undeclared = [...reached]
    .filter((key) =>
      !declared.paints.some((paint) => `${paint.tag}:${paint.where}` === key)
    )
    .sort();
  if (undeclared.length > 0) {
    throw new Error(
      `${name}: the rules paint ${
        undeclared.join(", ")
      }, which the scope does not declare`,
    );
  }
  return {
    self: declared.self,
    paints: declared.paints.map((paint) => ({
      tag: paint.tag,
      where: paint.where,
      owns: [...(owns.get(`${paint.tag}:${paint.where}`) ?? [])].sort(),
    })),
  };
}

/**
 * Derive the contract for a rule component.
 *
 * The taxonomy — the group the component sits in and the glyph it wears — is
 * not observed here: it is hand knowledge, like the component tokens, and it
 * is read out of the authored taxonomy rather than out of the rules.
 */
export function deriveRuleContract(
  name: string,
): {
  variants: string[];
  reads: ThemeCssVar[];
  tags: string[];
  scope: PrimitiveScope;
  category?: string;
  icon?: string;
} {
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
  // The tags are the CLAIM, not an observation: the scope says which
  // elements the primitive paints, and the rules are held to it.
  const scope = deriveScope(name);
  const tags = [...new Set(scope.paints.map((paint) => paint.tag))].sort();
  // A contract that paints no browsable element — the `a11y` family — is
  // filed nowhere and wears nothing, so it carries neither.
  const element = elementNamed(name);
  return {
    variants,
    reads,
    tags,
    scope,
    ...(element === undefined
      ? {}
      : { category: element.category, icon: element.icon }),
  };
}

/* ------------------------------------------------------------- the manifest -- */

/**
 * The one authored part of a component's entry.
 *
 * `component` is a token the THEME owns, declared so a scaffold can write a
 * placeholder for it. It is hand knowledge rather than an observation, which
 * is why it survives a regeneration and everything else does not.
 */
interface Authored {
  readonly comment: string;
  readonly header: string;
  readonly component: string;
}

/**
 * Write the checked-in manifest from what the rules actually do.
 *
 * The manifest is a GENERATED report, not a contract anyone maintains:
 * `tags`, `variants` and `reads` are read off the rules, so they cannot drift
 * from them. `component` is the one authored field, because a theme-owned
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

/**
 * The scope, as the manifest writes it.
 *
 * The claim and what each painted element owns, together: where the
 * primitive paints, and what it decides there. The lint reads it to know
 * when a utility is a second opinion, and the manifest is the only place the
 * two halves meet.
 */
function renderScope(scope: PrimitiveScope): string {
  const lines = [
    "    scope: {",
    `      self: ${JSON.stringify(scope.self)},`,
    "      paints: [",
    ...scope.paints.map((paint) =>
      `        { tag: ${JSON.stringify(paint.tag)}, where: ${
        JSON.stringify(paint.where)
      }, owns: [${paint.owns.map((own) => JSON.stringify(own)).join(", ")}] },`
    ),
    "      ],",
    "    },",
  ];
  return lines.join("\n");
}

/** The values inside a `[...]` array literal, as data. */

const NO_AUTHORED: Authored = {
  header: "",
  component: "    component: [],",
  comment: "",
};

/**
 * Pull the authored fields out of the checked-in manifest. Codegen rewrites
 * `variants` and `reads` for the components it owns; tags, component and the
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
      // A comment on its own lines above `component` is part of the authored
      // field: lose it here and the next codegen run deletes it for good.
      component:
        /^(?: {4}\/\/.*\n)* {4}component: \[[\s\S]*?\],/m.exec(part)?.[0] ??
          "    component: [],",
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
 * execution (\`bun run codegen\`), \`category\` and \`icon\` are derived from
 * the authored taxonomy, \`component\` is authored, and
 * \`tests/manifest.test.ts\` fails when the checked-in file goes stale.
 */`;

/**
 * The taxonomy the manifest carries: the groups a rail buckets elements into,
 * and every element's group and glyph.
 *
 * Written out of the authored taxonomy rather than re-exported from it, so
 * the manifest a consumer reads is the whole contract in one file: what a
 * component claims, what it spends, and where it is filed.
 */
function renderTaxonomy(): string {
  const categories = PRIMITIVE_CATEGORIES.map((category) =>
    `  { id: ${JSON.stringify(category.id)}, label: ${
      JSON.stringify(category.label)
    } },`
  );
  const elements = PRIMITIVE_ELEMENTS.map((element) =>
    `  { name: ${JSON.stringify(element.name)}, category: ${
      JSON.stringify(element.category)
    }, icon: ${JSON.stringify(element.icon)} },`
  );
  return [
    "/**",
    " * The taxonomy of the library: the groups, and every element's group and",
    " * glyph.",
    " *",
    " * DERIVED from `categories.ts`, so the manifest and the authored taxonomy",
    " * cannot disagree — a rail that filed an element somewhere else would be",
    " * reading a manifest that no longer says what the elements are.",
    " */",
    "export const primitiveCategories: readonly PrimitiveCategory[] = [",
    ...categories,
    "];",
    "",
    "/**",
    " * Every element, in the order a rail reads them.",
    " */",
    "export const primitiveElements: readonly PrimitiveElement[] = [",
    ...elements,
    "];",
  ].join("\n");
}

/**
 * The mark that says where the generated taxonomy begins.
 *
 * The manifest is written whole, so the block a previous run left has to come
 * OUT before the new one goes in — otherwise every run appends another copy
 * of the taxonomy and the file grows a little each time.
 */
const TAXONOMY_MARK = "/* --- taxonomy: generated from `categories.ts` --- */";

/** The file without the taxonomy block a previous run wrote. */
function withoutTaxonomy(text: string): string {
  const start = text.indexOf(TAXONOMY_MARK);
  if (start === -1) return text;
  return `${text.slice(0, start).trimEnd()}\n`;
}

/**
 * Every component's derived contract, or every failure at once: a claim that
 * is wrong in one place is usually wrong in the same way in three, and
 * finding them one at a time is a long conversation with yourself.
 */
function deriveContracts(): Map<string, ReturnType<typeof deriveRuleContract>> {
  // The names come from the rules themselves, so a component cannot exist in
  // the manifest without rules behind it, or be missing from it while having
  // them.
  const names = Object.keys(RULE_SOURCES).sort();
  const failures: string[] = [];
  const contracts = new Map<string, ReturnType<typeof deriveRuleContract>>();
  for (const name of names) {
    try {
      contracts.set(name, deriveRuleContract(name));
    } catch (error) {
      failures.push(String(error instanceof Error ? error.message : error));
    }
  }
  if (failures.length > 0) {
    throw new Error(failures.join("\n"));
  }
  return contracts;
}

/**
 * Regenerate the manifest into `to`, preserving every authored field read out
 * of the file being written. The destination is a parameter so a test can
 * round-trip a copy rather than dirty the checked-in file.
 */
export async function writeManifest(to: URL = MANIFEST_OUT): Promise<void> {
  const existing = withoutTaxonomy(await readIfPresent(to));
  const authored = parseAuthored(existing);

  // Refuse to write over authored fields this cannot read back: silently
  // emitting `component: []` would lose the one piece of hand knowledge in the
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
  const contracts = deriveContracts();
  const names = [...contracts.keys()].sort();
  const blocks = names.map((name) => {
    const derived = contracts.get(name) as ReturnType<
      typeof deriveRuleContract
    >;
    const mine = authored.get(name) ?? NO_AUTHORED;
    return [
      mine.comment,
      `  ${quoted(name)}: {`,
      mine.header ? mine.header + "\n" : "",
      renderArray("tags", derived.tags),
      renderArray("variants", derived.variants),
      renderArray("reads", derived.reads),
      renderScope(derived.scope),
      // The group and the glyph: where the component is filed and what it
      // wears. A component the taxonomy does not know is filed nowhere and
      // wears nothing, so it carries neither.
      ...(derived.category === undefined
        ? []
        : [`    category: ${JSON.stringify(derived.category)},`]),
      ...(derived.icon === undefined
        ? []
        : [`    icon: ${JSON.stringify(derived.icon)},`]),
      mine.component,
      "  },",
    ].filter((line) => line !== "").join("\n");
  });

  await writeFile(
    to,
    [
      header,
      "",
      DECL,
      ...blocks,
      "};",
      tail.trimEnd(),
      "",
      TAXONOMY_MARK,
      renderTaxonomy(),
      "",
    ].join("\n"),
  );
  console.log(`manifest.ts written (${names.length} components)`);
}

const MANIFEST_OUT = new URL("./manifest.ts", import.meta.url);

async function readIfPresent(url: URL): Promise<string> {
  try {
    return await readFile(fileURLToPath(url), "utf8");
  } catch {
    // First run: no checked-in manifest yet.
    return "";
  }
}

const ELEMENTS_OUT = new URL("../../elements.d.ts", import.meta.url);

/**
 * The element types, for every framework and none.
 *
 * Spin primitives are custom elements, not classes. `HTMLElementTagNameMap`
 * is the DOM-global every framework's JSX reads — React, Svelte, Vue — and
 * the Solid block below covers Solid's self-contained `JSX` namespace, which
 * does not consult the DOM global. Both blocks list every tag explicitly:
 * interface-extends does not merge through an augmented global, but explicit
 * entries do. The tags come from `scope.self` minus the platform's own, so
 * a primitive added to the rules appears here on the next codegen run.
 *
 * One generated file, zero per-framework files for consumers: this is the
 * only place that knows Solid exists.
 */
async function writeElements(
  contracts: Map<string, ReturnType<typeof deriveRuleContract>>,
): Promise<void> {
  const NATIVE = new Set([
    "a",
    "abbr",
    "address",
    "area",
    "article",
    "aside",
    "audio",
    "b",
    "base",
    "bdi",
    "bdo",
    "blockquote",
    "body",
    "br",
    "button",
    "canvas",
    "caption",
    "cite",
    "code",
    "col",
    "colgroup",
    "data",
    "datalist",
    "dd",
    "del",
    "details",
    "dfn",
    "dialog",
    "div",
    "dl",
    "dt",
    "em",
    "embed",
    "fieldset",
    "figcaption",
    "figure",
    "footer",
    "form",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "head",
    "header",
    "hgroup",
    "hr",
    "html",
    "i",
    "iframe",
    "img",
    "input",
    "ins",
    "kbd",
    "label",
    "legend",
    "li",
    "link",
    "main",
    "map",
    "mark",
    "menu",
    "meta",
    "meter",
    "nav",
    "noscript",
    "object",
    "ol",
    "optgroup",
    "option",
    "output",
    "p",
    "picture",
    "pre",
    "progress",
    "q",
    "rp",
    "rt",
    "ruby",
    "s",
    "samp",
    "script",
    "search",
    "section",
    "select",
    "slot",
    "small",
    "source",
    "span",
    "strong",
    "style",
    "sub",
    "summary",
    "sup",
    "table",
    "tbody",
    "td",
    "template",
    "textarea",
    "tfoot",
    "th",
    "thead",
    "time",
    "title",
    "tr",
    "track",
    "u",
    "ul",
    "var",
    "video",
    "wbr",
  ]);
  const tags = [
    ...new Set(
      [...contracts.values()].map((contract) => contract.scope.self),
    ),
  ].filter((tag) => !NATIVE.has(tag) && tag !== "a11y").sort();
  const domEntries = tags.map((tag) =>
    `    "${tag}": HTMLElement & SpinElementAttributes;`
  ).join("\n");
  const jsxEntries = tags.map((tag) =>
    `    "${tag}": SpinElementAttributes;`
  ).join("\n");
  await writeFile(
    ELEMENTS_OUT,
    [
      "/**",
      " * The spin element vocabulary, for TypeScript — every framework, and none.",
      " *",
      " * GENERATED by `bun run codegen` from the primitives manifest, which is",
      " * itself derived from the rules. Do not edit by hand.",
      " */",
      "export {};",
      "",
      "/** What every spin element accepts: the element's own attributes. */",
      "interface SpinElementAttributes {",
      "  class?: string;",
      "  id?: string;",
      "  role?: string;",
      "  title?: string;",
      "  hidden?: boolean;",
      "  variant?: string;",
      "  open?: boolean;",
      "  disabled?: boolean;",
      "  [attribute: string]: unknown;",
      "}",
      "",
      "declare global {",
      "  interface HTMLElementTagNameMap {",
      domEntries,
      "  }",
      "}",
      "",
      'declare module "solid-js" {',
      "  namespace JSX {",
      "    interface IntrinsicElements {",
      jsxEntries,
      "    }",
      "  }",
      "}",
      "",
    ].join("\n"),
  );
  console.log(`elements.d.ts written (${tags.length} tags)`);
}

if (import.meta.main) {
  await writeManifest();
  await writeElements(deriveContracts());
}
/* ------------------------------------------------------------------- states -- */
