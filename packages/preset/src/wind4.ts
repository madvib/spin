/**
 * `@unocss/preset-wind4`, layered UNDER our rules — and only its rules.
 *
 * Two things are deliberately not taken from wind4, and both are silent
 * failures rather than loud ones:
 *
 * **No preflight.** `presetWind4()` ships three: a reset, a theme block, and
 * a properties block. The theme block walks OUR theme object and re-emits each
 * value as a variable — and our values are already references, so it writes
 * `--spacing-2` as a reference to `--spacing-2`. A self-reference resolves to
 * nothing at computed-value time, so every component that spends `spacing.2`
 * gets no padding while the sheet itself looks perfectly fine.
 * The reset is a second opinion on ground our own preflights already hold.
 * So this module takes `rules` and `variants` and stops: `preflights.ts` is
 * the only source of document-level CSS in a spin build.
 *
 * **Order.** Ours go first, which is what makes ours win. Uno keeps the first
 * rule that MATCHES a token, and dynamic rules are `unshift`ed onto the match
 * list as they register — so among dynamic rules the LAST registered is tried
 * first. Registering ours first therefore makes ours the fallback wind4 is
 * tried behind, which is the whole arrangement: a token we own resolves
 * against our theme, and a token we do not own falls through to wind4.
 * (Measured rather than assumed — swapping the two arrays flips which rule
 * wins, in `uno`'s `resolveConfig`.)
 *
 * What wind4 is allowed to contribute is decided by two DERIVED audits, both
 * computed from rule metadata at module load so neither can drift from the
 * code it describes:
 *
 * - **Family ownership.** The leading literal a matcher pins is the utility
 *   namespace it claims. wind4's claims are intersected with ours; a rule
 *   whose claim we also make is dead weight against ours and is dropped whole.
 * - **Inertness.** wind4 defers values to custom properties and registers
 *   them with `@property` from inside a RULE — good — but several of those
 *   registrations carry no initial value, so a bare read of them resolves to
 *   nothing and the declaration is invalid at computed-value time while still
 *   parsing. `from-primary` is the canonical case: it sets
 *   `--un-gradient-from` from wind4's own `--colors-primary` palette
 *   namespace, which a spin theme does not have. Those rules are detected by
 *   RUNNING them and reading what they produced, not by reading their source,
 *   so the answer stays right when wind4 respells a family.
 */

import type {
  DynamicRule,
  Rule,
  RuleContext,
  Variant,
  VariantContext,
  VariantObject,
} from "@unocss/core";
import { symbols, toArray } from "@unocss/core";
import { refFamilies } from "@spin/theme";
import {
  rules as wind4Rules,
  variants as wind4Variants,
} from "@unocss/preset-wind4";
import { spinRules } from "./rules/index.ts";
import { primitiveContracts } from "./rules/primitives/manifest.ts";

/** Options for {@link wind4Layers}. */
export interface Wind4Options {
  /**
   * How wind4's `dark:` variant scopes itself.
   *
   * wind4 defaults to `"class"`, but a spin theme is switched with
   * `data-theme`/`data-mode` — a selector wind4 knows nothing about — so its
   * `dark:` lands on something a spin document never carries. `false` drops
   * the variant and lets our own mode handling carry the switch, which is
   * what a spin build wants. `"media"` follows the OS instead.
   */
  dark?: false | "class" | "media";
}

/** wind4's rules and variants, filtered to what a spin build can use. */
export interface Wind4Layers {
  rules: Rule[];
  variants: Variant[];
}

/**
 * A rule, and why it was left out.
 *
 * `rule` is wind4's own identifier for it — the utility name for a static
 * rule, the pattern source for a dynamic one — so a report points at
 * something findable in wind4 rather than at a category invented here.
 */
export interface Wind4Exclusion {
  /** How wind4 identifies the rule: its utility name or its pattern. */
  readonly rule: string;
  /** Why the rule contributes nothing under a spin theme. */
  readonly reason: "owned" | "inert";
  /**
   * The bare reference that resolved to nothing, for an `inert` exclusion.
   * Absent for `owned`, where the rule was never run.
   */
  readonly undefined?: string;
}

/** A rule's identity: its utility name, or the pattern it matches on. */
function nameOf(rule: Rule): string {
  return typeof rule[0] === "string" ? rule[0] : rule[0].source;
}

/**
 * The utility namespaces a matcher claims, as the literals it pins up front.
 *
 * A static rule claims its own NAME and nothing wider: `list-none` claims
 * `list-none`, not `list`, because naming one utility is not owning the
 * namespace around it. That distinction decides real cases — our `list-none`
 * must not be read as a claim on wind4's whole `list` family, which would
 * throw away `list-disc` and `list-inside` to protect a single utility we
 * already emit.
 *
 * A dynamic rule claims whatever literal text it pins before the first
 * construct that admits anything else, expanded across a leading alternation.
 * So `/^bg-(.+)$/` claims `bg`, while `/^bg-(gradient|linear)-/` claims
 * `bg-gradient` and `bg-linear` — the gradient family is wind4's, and pinning
 * only `bg` would hand it to us and take `bg-gradient-to-r` with it.
 */
function claimsOf(rule: Rule): string[] {
  if (typeof rule[0] === "string") return [rule[0]];
  let rest = rule[0].source.replace(/^\^/, "");
  let claims = [""];
  // Bounded so a pathological pattern cannot spin here; every real matcher
  // settles in two or three steps.
  for (let step = 0; step < 12 && rest.length > 0; step++) {
    // An OPTIONAL construct pins no claim of its own, because a class may
    // always leave it out. Scanning has to continue past it rather than
    // stop: `(?:position-|pos-)?inset-(.+)` is reachable as plain `inset-4`,
    // so stopping at the optional prefix would claim nothing and let wind4
    // answer a family we own.
    const optionalGroup = /^\(\??:?([^)]*)\)\?/.exec(rest);
    if (optionalGroup) {
      rest = rest.slice(optionalGroup[0].length);
      continue;
    }
    const alternation = /^\(\??:?([^)]*)\)/.exec(rest);
    if (alternation) {
      const [, inner = ""] = alternation;
      // A character class names utilities outright: `[wh]` means `w` or `h`,
      // which is a claim on both and not on the class spelling.
      const characterClass = /^\[([a-z0-9-]+)\]$/.exec(inner);
      if (characterClass) {
        const [, chars = ""] = characterClass;
        claims = claims.flatMap((claim) =>
          [...chars].map((letter) => claim + letter)
        );
        rest = rest.slice(alternation[0].length);
        continue;
      }
      const options = inner.split("|");
      // Every option must be something a utility can actually be CALLED. An
      // option carrying a metacharacter — `(\?|\w)`, `(a|b)?` — admits names
      // beyond what is written, so the rule claims nothing rather than
      // claiming a name no class could ever carry.
      if (!options.every((option) => /^[a-z][a-z0-9-]*$/.test(option))) break;
      claims = claims.flatMap((claim) => options.map((one) => claim + one));
      rest = rest.slice(alternation[0].length);
      continue;
    }
    const literal = /^-?[a-z][a-z0-9-]*/.exec(rest);
    if (literal) {
      const text = literal[0];
      claims = claims.map((claim) => claim + text);
      rest = rest.slice(text.length);
      // `p a?` — a trailing `?` makes that last character optional, so the
      // shorter spelling is reachable and is a claim too. This is what keeps
      // `pa?()` a claim on `p`: the padding family is ours, and reading the
      // optional `a` as mandatory would hand `p-4` to wind4, which answers it
      // with a `var(--spacing)` base our sheet never defines.
      if (rest.startsWith("?")) {
        claims = claims.flatMap((claim) => [claim, claim.slice(0, -1)]);
        rest = rest.slice(1);
      }
      continue;
    }
    // A `?` with no character in front of it admits anything else, so there
    // is no literal text left to pin.
    if (rest.startsWith("?")) {
      rest = rest.slice(1);
      continue;
    }
    break;
  }
  return [
    ...new Set(
      claims.map((claim) => claim.replace(/-+$/, "")).filter((claim) =>
        claim.length > 0
      ),
    ),
  ];
}

/**
 * A matcher that names exactly one utility and nothing wider.
 *
 * A static rule names its own utility. A dynamic rule does exactly when its
 * source is a fully-anchored literal — `^object$`, the `<object>` element in
 * prose — which matches one token and admits nothing else. That is NOT a
 * claim on the namespace around it: `^object$` does not provide
 * `object-cover`, so it must not exclude wind4's `object-*` rule as "owned".
 * (Measured: before this distinction, `object-cover`, `object-center` and
 * `object-top` matched nothing — ours cannot answer them, wind4's was dropped.)
 */
const EXACT_SOURCE = /^\^([a-z][a-z0-9-]*)\$$/;
function exactName(rule: Rule): string | undefined {
  if (typeof rule[0] === "string") return rule[0];
  return EXACT_SOURCE.exec(rule[0].source)?.[1];
}

/**
 * Every namespace our own rules claim, read off the rules themselves.
 *
 * Built from `spinRules` with the full primitive set and the classless
 * default — the shape a spin preset has when nobody has narrowed it — so a
 * family the primitives claim stays ours even when a caller opts them out.
 * Opting out of a component should not hand its namespaces to wind4.
 *
 * Exact names are kept apart: an element rule for one tag must never read as
 * ownership of the utility family that shares its spelling.
 */
const ownedExact: ReadonlySet<string> = (() => {
  const owned = new Set<string>();
  for (
    const rule of spinRules(Object.keys(primitiveContracts), {
      classless: true,
    })
  ) {
    const exact = exactName(rule);
    if (exact !== undefined) owned.add(exact);
  }
  return owned;
})();

/**
 * Every namespace our own rules claim, read off the rules themselves.
 *
 * Same construction as `ownedExact`, minus the exact names: what is left is a
 * claim on a whole family — `p` from the padding rule — rather than on one
 * utility.
 */
const ownedNamespaces: ReadonlySet<string> = (() => {
  const owned = new Set<string>();
  for (
    const rule of spinRules(Object.keys(primitiveContracts), {
      classless: true,
    })
  ) {
    if (exactName(rule) !== undefined) continue;
    for (const claim of claimsOf(rule)) owned.add(claim);
  }
  return owned;
})();

/**
 * Whether a wind4 rule's claim is covered by something we own.
 *
 * A namespace claim is covered by an owned namespace. An exact name covers
 * only the single utility it names — and only against a wind4 rule naming
 * that same utility, never against a rule claiming the family around it.
 */
function covered(rule: Rule, claim: string): boolean {
  if (ownedNamespaces.has(claim)) return true;
  if (!ownedExact.has(claim)) return false;
  return exactName(rule) === claim;
}

/**
 * The variable namespaces a spin sheet defines.
 *
 * Every token becomes a `--<group>-<name>` variable, so the GROUPS are the
 * defined surface: `--color-primary` is defined because the colour group
 * carries a `primary`, and a rule reading one is reading something real.
 * `refFamilies` is read rather than a prefix list written out, so a theme that
 * grows a group widens this with it.
 *
 * `--grid-gutter` is the one variable nobody declares — `spacing.ts` and
 * `grid.ts` both spend it, and the consumer sets it on the container.
 */
const definedNamespaces: readonly string[] = [
  ...refFamilies().map((family) => "--" + family.replace(/\./g, "-")),
  "--grid-gutter",
];

/**
 * A bare `var()` read — one with no fallback behind it.
 *
 * A read WITH a fallback resolves to that fallback when the variable is
 * absent, which is a well-formed way of saying "use it if wind4's preflight
 * defined this, otherwise carry on". Only a bare read is broken, so only a
 * bare read is matched. Nesting still counts: a read placed bare inside
 * another's fallback is itself a bare read, and an undefined name there
 * invalidates the whole declaration at computed-value time exactly as an
 * undefined name in the outer read would.
 */
const BARE_READ = /\bvar\(\s*(--[\w-]+)\s*\)/g;

/** A rule's output, read two ways: as declaration pairs, and as raw objects. */
interface Inspected {
  /** `[property, value]` for every declaration the rule produced. */
  readonly pairs: readonly (readonly [string, unknown])[];
  /**
   * Every object in the output, at any depth.
   *
   * A `@property` registration is an object in its own right — `{syntax,
   * inherits, initial-value}` plus a symbol-keyed variant that names it. Read
   * through `pairs` it is indistinguishable from three unrelated
   * declarations, so it has to be seen before it is decomposed.
   */
  readonly objects: readonly object[];
}

/** Walk a handler's result into declaration pairs and raw objects. */
function inspect(value: unknown, into: {
  pairs: (readonly [string, unknown])[];
  objects: object[];
}): void {
  if (value === null || value === undefined || typeof value !== "object") {
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) inspect(item, into);
    return;
  }
  if (Symbol.iterator in value) {
    for (const item of value as Iterable<unknown>) inspect(item, into);
    return;
  }
  into.objects.push(value);
  for (const [property, inner] of Object.entries(value)) {
    into.pairs.push([property, inner]);
    inspect(inner, into);
  }
}

/** Inspect a synchronous result. */
function inspected(value: unknown): Inspected {
  const into = {
    pairs: [] as (readonly [string, unknown])[],
    objects: [] as object[],
  };
  inspect(value, into);
  return into;
}

/** Inspect a result that may arrive lazily. */
async function inspectedAsync(value: unknown): Promise<Inspected> {
  if (
    value !== null && typeof value === "object" &&
    Symbol.asyncIterator in value
  ) {
    const into = {
      pairs: [] as (readonly [string, unknown])[],
      objects: [] as object[],
    };
    for await (const item of value as AsyncIterable<unknown>) {
      await inspectedAsyncInto(item, into);
    }
    return into;
  }
  return inspected(value);
}

/** Drain one lazily-produced item into an accumulator. */
async function inspectedAsyncInto(
  value: unknown,
  into: { pairs: (readonly [string, unknown])[]; objects: object[] },
): Promise<void> {
  const nested = await inspectedAsync(value);
  into.pairs.push(...nested.pairs);
  into.objects.push(...nested.objects);
}

/**
 * The properties the output registers with `@property`, with an initial value.
 *
 * wind4 registers `--un-*` variables from inside its rules and leans on the
 * registration to give them an initial value, so a registered variable IS
 * defined and reading it is fine. But the registration only DEFINES when it
 * carries that initial value — `@property` without one is a type declaration
 * and nothing more, and the read still resolves to nothing.
 */
function registered(objects: readonly object[]): ReadonlySet<string> {
  const names = new Set<string>();
  for (const object of objects) {
    if (!("syntax" in object) || !("initial-value" in object)) continue;
    const variants = (object as Record<symbol, unknown>)[symbols.variants];
    if (typeof variants !== "function") continue;
    for (const variant of toArray(variants() as unknown)) {
      if (variant === null || typeof variant !== "object") continue;
      if (!("selector" in variant)) continue;
      const selector = variant.selector;
      const name = typeof selector === "function"
        ? (selector as () => unknown)()
        : selector;
      const matched = typeof name === "string"
        ? /^@property\s+(--[\w-]+)/.exec(name)
        : null;
      if (matched) {
        const [, read] = matched;
        if (read !== undefined) names.add(read);
      }
    }
  }
  return names;
}

/**
 * The first bare read in a rule's output that nothing in the sheet defines.
 *
 * Three things count as definitions: the rule's own property declarations
 * (wind4's `from-*` writes `--un-gradient-from` and reads it straight back,
 * and that pairing works), its `@property` registrations that carry an
 * initial value, and the theme's own namespaces. What is left is a read that
 * resolves to nothing — which parses, and renders as no value at all.
 */
function undefinedRead(output: Inspected): string | undefined {
  const local = new Set(
    output.pairs.map(([property]) => property).filter((property) =>
      property.startsWith("--")
    ),
  );
  for (const name of registered(output.objects)) local.add(name);
  for (const [, value] of output.pairs) {
    if (typeof value !== "string") continue;
    BARE_READ.lastIndex = 0;
    for (
      let hit = BARE_READ.exec(value);
      hit;
      hit = BARE_READ.exec(value)
    ) {
      const [, name] = hit;
      if (name === undefined) continue;
      const defined = definedNamespaces.some((namespace) =>
        name === namespace || name.startsWith(namespace + "-")
      );
      if (!local.has(name) && !defined) return name;
    }
  }
  return undefined;
}

/**
 * Whether a rule is DYNAMIC — matched by a pattern and run, rather than named.
 *
 * A declared guard rather than an inline `typeof`, because `Rule` is a union of
 * two TUPLE types and TypeScript cannot narrow a union of tuples from a
 * `typeof` test on one of its elements.
 */
function isDynamic(rule: Rule): rule is DynamicRule {
  return rule[0] instanceof RegExp;
}

/**
 * Wrap a dynamic handler so a broken read suppresses its own output.
 *
 * Only dynamic rules are wrapped. Uno resolves a static rule by handing its
 * handler straight to `resolveCSSResult` WITHOUT awaiting, so an async
 * wrapper around one resolves to a promise and emits nothing at all — which
 * silently deletes every static wind4 utility rather than auditing it. Static
 * rules are audited in place instead, because their output is the literal
 * declaration object sitting in the rule tuple.
 */
function guarded(
  rule: DynamicRule,
  report: (exclusion: Wind4Exclusion) => void,
): DynamicRule {
  const [matcher, handler, meta] = rule;
  // This wrapper runs per MATCH, so a rule that matches repeatedly must not
  // report repeatedly: a second report for the same rule would append a
  // duplicate to the audit, which the pinned inert set in
  // `organization.test.ts` would read as a NEW exclusion. One flag per
  // wrapped rule, closed over here.
  let reported = false;
  const reportOnce = (exclusion: Wind4Exclusion) => {
    if (!reported) {
      reported = true;
      report(exclusion);
    }
  };
  const wrapped = (async (match: RegExpMatchArray, ctx: Readonly<RuleContext>) => {
    let value: unknown;
    try {
      value = await handler(match, ctx);
    } catch {
      // A handler that cannot run without wind4's own theme — `backdrop-blur`
      // reads a `backdropBlur` table a spin theme does not carry, and its
      // `cssvar` throws on the missing entry — is inert for the same reason
      // a bare read of an undefined variable is: it can produce nothing
      // under a spin theme. Reported rather than passed through, because a
      // rule that throws inside `generate()` fails the whole build, and a
      // quiet exclusion is what the owned and bare-read cases already do.
      // (Measured: `backdrop-blur` threw
      // `TypeError: Cannot read properties of undefined (reading
      // 'startsWith')` from inside wind4's `cssvar`.)
      reportOnce({ rule: nameOf(rule), reason: "inert", undefined: "wind4 theme" });
      return undefined;
    }
    const broken = undefinedRead(await inspectedAsync(value));
    if (broken !== undefined) {
      reportOnce({ rule: nameOf(rule), reason: "inert", undefined: broken });
      return undefined;
    }
    // Handed back untouched: a generator stays a generator, because uno
    // resolves variants differently for a generator than for an array, and
    // reshaping a rule we are KEEPING would change it.
    return value;
  }) as unknown as DynamicRule[1];
  // `meta` reaches the tuple (master), but under exactOptionalPropertyTypes
  // a slot typed `RuleMeta | undefined` is not assignable to the optional
  // third element: the defined case spells it, the undefined case omits it.
  return meta === undefined ? [matcher, wrapped] : [matcher, wrapped, meta];
}

/**
 * wind4's rules, minus the ones a spin build cannot use.
 *
 * Ownership is applied first and structurally: an owned rule is never run, so
 * there is nothing to audit and nothing further to say about it. Inertness is
 * applied to the survivors, and for a static rule that costs nothing at all —
 * its declarations are already sitting in the tuple, readable without calling
 * anything.
 */
function usableRules(report: (exclusion: Wind4Exclusion) => void): Rule[] {
  const kept: Rule[] = [];
  for (const rule of wind4Rules) {
    if (claimsOf(rule).some((claim) => covered(rule, claim))) {
      report({ rule: nameOf(rule), reason: "owned" });
      continue;
    }
    if (isDynamic(rule)) {
      kept.push(guarded(rule, report));
      continue;
    }
    const broken = undefinedRead(inspected(rule[1]));
    if (broken !== undefined) {
      report({ rule: nameOf(rule), reason: "inert", undefined: broken });
      continue;
    }
    kept.push(rule);
  }
  return kept;
}

/**
 * The tokens that name a colour scheme, in every spelling a class can use.
 *
 * A user reaches for the same axis as `dark:`, `.dark:`, `@dark:` or
 * `not-dark:`; wind4 answers to each through a separate variant. The
 * spellings are enumerated here because they are what an AUTHOR can write,
 * not because they are what wind4 happens to name its variants — so a variant
 * wind4 adds for the same axis is caught without this list changing.
 */
const COLOUR_SCHEME_SPELLINGS: readonly string[] = ["dark", "light"];

/**
 * wind4's variants, with the colour-scheme ones dropped unless asked for.
 *
 * Our own `variants/index.ts` removed `dark:` deliberately: a dark theme is a
 * different theme that declares its own tokens, so a utility that only applies
 * in dark mode is a theme patch wearing a utility's clothes. Left in place,
 * wind4 would put that back through the side door — as `.dark:`, `@dark:` and
 * `not-dark:` as much as `dark:` — and scope it to a class or a media query a
 * spin document does not use.
 *
 * Which variants those are is decided by ASKING them, not by reading their
 * names: a variant is colour-scheme if it claims a colour-scheme token. wind4
 * has no way to be told "omit it" — passing `dark: false` still yields the
 * variant — so it is built with a mode it understands and the answer is
 * filtered out here.
 */
function buildVariants(dark: Wind4Options["dark"]): Variant[] {
  // `undefined` is the same request as `false` — the default IS "no colour
  // scheme variants" — so it is normalised before the branch, or the default
  // would read as "enabled" and quietly restore what it is meant to remove.
  const mode = dark ?? false;
  const built = wind4Variants({
    dark: mode === false ? "class" : mode,
  }) as VariantObject[];
  if (mode !== false) return built;
  // A colour variant only reads the separator list and the theme, so the probe
  // carries those two and nothing else. A variant needing more than that
  // throws, and a variant we cannot classify is not one we have grounds to
  // drop — so the catch keeps rather than discards.
  const context = {
    theme: {},
    generator: { config: { separators: [":", "-"] } },
  } as unknown as Readonly<VariantContext>;
  const probes = COLOUR_SCHEME_SPELLINGS.flatMap((
    axis,
  ) => [`${axis}:x`, `.${axis}:x`, `@${axis}:x`, `not-${axis}:x`]);
  return built.filter((variant) => {
    if (typeof variant.match !== "function") return true;
    return !probes.some((probe) => {
      try {
        return variant.match(probe, context) != null;
      } catch {
        return false;
      }
    });
  });
}

/**
 * The rules, built once.
 *
 * Memoised because auditing is a side effect of BUILDING — running a rule to
 * see what it reads — so a second build would report every exclusion twice for
 * one underlying cause. One build, one report.
 *
 * The VARIANTS are deliberately not folded into the same cache: they are the
 * one part that depends on the options, and memoising them here would hand
 * the first caller's `dark` setting to every caller after it.
 */
let builtRules: Rule[] | undefined;
let audit: Wind4Exclusion[] = [];

/**
 * wind4's rules and variants, as a layer beneath ours.
 *
 * A variant rewrites a SELECTOR, and every selector wind4 can write is still
 * a legal selector over our markup: there is no theme token in `hover:` or
 * `md:`, so there is nothing for one to resolve and nothing for it to get
 * wrong. The colour-scheme axis is the exception and is ours to decide — see
 * `buildVariants`.
 */
export function wind4Layers(options: Wind4Options = {}): Wind4Layers {
  if (!builtRules) {
    const found: Wind4Exclusion[] = [];
    builtRules = usableRules((exclusion) => found.push(exclusion));
    audit = found;
  }
  return { rules: builtRules, variants: buildVariants(options.dark) };
}

/**
 * Every rule left out — ownership first, then inertness, in wind4's rule order.
 *
 * Exported so the reference can label what is missing rather than omit it
 * silently. An absent rule otherwise reads as "this preset has no such
 * utility", which is a lie about wind4 and a smaller one about us.
 */
export function wind4Exclusions(): readonly Wind4Exclusion[] {
  if (!builtRules) wind4Layers();
  return audit;
}
