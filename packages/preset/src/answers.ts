/**
 * What the Uno engine answers: the checks' questions, filled from the preset.
 *
 * Three answers: the utility families the catalog produces, the primitives
 * the manifest claims (as the checks read them — tags, paints, variants),
 * and the surfaces — what each element carries and each class sets, read by
 * running the preset's own rules. Same rules the browser's stylesheet comes
 * from, so the answers cannot go stale.
 */

import { describeCatalog } from "./catalog.ts";
import { createSpinFactory } from "./factory.ts";
import {
  primitiveContracts,
  primitiveVariants,
} from "./rules/primitives/manifest.ts";
import { canonicalMap } from "./utils/css.ts";
import {
  parseTokens,
  requiredPaths,
  validateLegibility,
  validateTokens,
} from "@spinjs/theme";
import type { ThemeDocument } from "@spinjs/theme";
/* ------------------------------------------------------------- the shapes -- */

/**
 * What the style engine answers, in the checks' own words.
 *
 * The checks judge markup against three things: the theme's policy, the
 * primitives the engine claims, and the vocabulary the engine produces.
 * The engine fills these shapes; the checks never import the engine.
 * A second engine fills the same shapes from its own sources.
 */

/**
 * An element above the one being read.
 *
 * The shape is the one the core already reads, so the two fit without either
 * naming the other.
 */
export interface Ancestor {
  readonly tag: string | undefined;
  readonly classes: readonly string[];
}

/**
 * What the theme puts on elements and classes.
 *
 * The surfaces are read once per project and kept: a lint run visits the
 * same elements over and over, and re-running the rules for every class
 * attribute would cost more than the lint itself.
 */
export interface Surfaces {
  /**
   * The declarations the theme puts on an element, given where it sits and
   * what it wears.
   *
   * An element inside a document column is painted differently from the same
   * element outside one, so the chain of ancestors is part of the question.
   * And an element that wears a VARIANT is painted differently from the same
   * element that does not: the variant speaks over the base, so the classes
   * the element carries are part of the question too.
   */
  element(
    tag: string,
    ancestors: readonly Ancestor[],
    classes?: readonly string[],
  ): ReadonlyMap<string, string>;
  /** The declarations a class sets. */
  utility(cls: string): ReadonlyMap<string, string>;
  /**
   * The classes among these that paint the element.
   *
   * A primitive's variants are classes an author types on its own element —
   * and some of the classes a primitive declares are not: the icon slot is a
   * class on a CHILD, so it is a class the vocabulary knows and not a
   * variant of the element. The rules are asked which is which: a variant
   * paints the element because its selector names the element.
   */
  variants(tag: string, classes: readonly string[]): readonly string[];
  /**
   * The declarations the element's own variants set on it.
   *
   * A variant is how a primitive is told to change, so what it sets is the
   * element's look and not the base's: a button that wears `bare` has no fill
   * and no edge, whatever the base said. The declarations are read from the
   * rules, so a variant cannot claim a decision its rule does not make.
   */
  worn(
    tag: string,
    ancestors: readonly Ancestor[],
    classes: readonly string[],
  ): ReadonlyMap<string, string>;
}


/**
 * Where a primitive's painting lands.
 *
 * - **global** — the element is painted wherever it is.
 * - **descendant** — the element is painted only inside the primitive's own
 *   element.
 */
export type Placement = "global" | "descendant";

/**
 * What a primitive paints, as the lint reads it.
 *
 * The scope is the primitives' own declaration: the manifest carries it, and
 * the lint does not decide it.
 */
export interface ScopeFact {
  /** The primitive that paints it. */
  readonly primitive: string;
  /** The element the primitive is: the tag (or class) it claims. */
  readonly self: string;
  /** The tag of the painted element. */
  readonly tag: string;
  /** Where the painted element has to sit for the primitive to paint it. */
  readonly where: Placement;
  /** The decisions the primitive owns for it. */
  readonly owns: readonly string[];
  /**
   * The variants the primitive declares.
   *
   * A variant is a class the author types on the primitive's OWN element —
   * the card's variants belong to the card, not to the title the card
   * paints — so the rule that names a variant asks whether the painted
   * element IS the primitive before it names one.
   */
  readonly variants: readonly string[];
}


/** One family of utilities the engine produces: the group's id and its members. */
export interface UtilityFamily {
  /** The catalog group, e.g. `background`. Tiers and decisions key off it. */
  readonly id: string;
  /** Every utility the family produces. */
  readonly utilities: readonly string[];
}

/** The primitives the engine claims: tags, what each paints, and their variants. */
export interface ClaimedPrimitives {
  /** What each primitive paints, as the checks read it. */
  readonly scopes: readonly ScopeFact[];
  /** The classes the primitives define themselves. */
  readonly variants: ReadonlySet<string>;
}

/** Everything the checks ask the engine, answered. */
export interface EngineAnswers {
  /** The utility families the engine produces. */
  readonly families: readonly UtilityFamily[];
  /** The primitives the engine claims. */
  readonly primitives: ClaimedPrimitives;
  /** What the theme puts on elements, and what a class sets. */
  readonly surfaces: Surfaces;
}

/**
 * What a caller states about the documents it hands over.
 *
 * Composed themes owe the full contract (the default); fragments owe
  * nothing — a documentation specimen's layer is read for what it says, not
  * for what the language beside it already declares. Callers state which.
 */
export interface SurfacesOptions {
  /** The dotted paths every document must declare. Defaults to the full contract. */
  readonly required?: readonly string[];
}


/**
 * The symbol the preset's rules carry their selector under.
 *
 * The rules read it off the context they are run with, so the context this
 * module builds supplies its own: the rules never name a symbol they did not
 * receive.
 */
const SELECTOR = Symbol("selector");

/**
 * The symbol the preset's rules carry their parent at-rule under.
 *
 * Supplied for the same reason, and read for the same reason: a rule that
 * yields a parent at-rule is yielding something the lint does not read — a
 * transition's start state, a focus ring's fallback — so those yields are
 * dropped rather than mistaken for the element's own declarations.
 */
const PARENT = Symbol("parent");

/** A rule, as far as this module reads it. */
interface PresetRule {
  readonly 0: string | RegExp;
  readonly 1?: unknown;
  readonly 2?: unknown;
}

/** The context a rule is run with. */
interface RuleContext {
  readonly theme: unknown;
  readonly symbols: {
    readonly selector: symbol;
    readonly parent: symbol;
  };
  /** The name the rule was asked about, raw. */
  readonly rawSelector: string;
  /** The name the rule was asked about, as the rule sees it. */
  readonly currentSelector: string;
  /** The variants in force. There are none: the lint reads no variant. */
  readonly variantHandlers: readonly unknown[];
  /** The variant match. There is none: the lint reads no variant. */
  readonly variantMatch: readonly unknown[];
  /** The custom CSS a rule asks for. The lint reads none. */
  constructCSS(...args: unknown[]): string;
}

/** One thing a rule decided: a selector, and the declarations under it. */
interface Painted {
  readonly selector: string;
  readonly declarations: ReadonlyMap<string, string>;
}

/* ------------------------------------------------------------- the runner -- */

/**
 * Run the preset's rules for a name, and collect what they decided.
 *
 * The order is the one the generator uses: a rule that matches a name
 * exactly is asked first, and the pattern rules are asked from the last
 * registered to the first — so the rule that spoke last is the one that
 * speaks.
 */
function paint(
  rules: readonly PresetRule[],
  context: RuleContext,
  name: string,
): Painted[] {
  // A rule that matches a name exactly is asked first, and the last one
  // registered is the one that answers — the same order the generator
  // resolves in.
  let exact: PresetRule | undefined;
  for (const rule of rules) {
    const matcher = rule[0];
    if (typeof matcher !== "string" || matcher !== name) continue;
    exact = rule;
  }
  if (exact !== undefined) {
    const painted = yieldOf(exact, context, name);
    if (painted.length > 0) return painted;
  }
  for (const rule of [...rules].reverse()) {
    const matcher = rule[0];
    if (typeof matcher === "string") continue;
    const match = name.match(matcher);
    if (match === null) continue;
    const painted = yieldOf(rule, context, name, match);
    if (painted.length > 0) return painted;
  }
  return [];
}

/**
 * What one rule decided about a name.
 *
 * A rule answers with the declarations it sets, and — for the primitives —
 * with the selector it sets them under. A rule that yields a parent at-rule
 * is yielding a state rather than the element's own look, so it is dropped.
 *
 * A rule that matches a name EXACTLY answers with its declarations and
 * nothing else; a rule that matches a pattern answers with what it yields.
 *
 * A rule that answers with a PROMISE is a rule that cannot answer
 * synchronously, and the lint reads no promise: the rule is passed over, and
 * the rule behind it answers.
 */
function yieldOf(
  rule: PresetRule,
  context: RuleContext,
  name: string,
  match?: RegExpMatchArray,
): Painted[] {
  const handler = rule[1];
  if (handler === undefined) return [];
  if (typeof handler !== "function") {
    // A rule that matches a name exactly carries its declarations as its
    // body.
    return collect(handler, context);
  }
  const result = handler(
    (match ?? [name]) as unknown as string[],
    context as never,
  );
  if (isPromise(result)) return [];
  return collect(result, context);
}

/** Whether a rule answered with something the lint cannot wait for. */
function isPromise(value: unknown): boolean {
  return typeof value === "object" && value !== null &&
    typeof (value as { then?: unknown }).then === "function";
}

/** The yields of a rule, read as declarations under a selector. */
function collect(result: unknown, context: RuleContext): Painted[] {
  const out: Painted[] = [];
  for (const entry of entriesOf(result)) {
    if (entry === null || typeof entry !== "object") continue;
    if (Array.isArray(entry)) {
      const properties: [string, string][] = [];
      let selector: string | undefined;
      for (const item of entry) {
        if (!Array.isArray(item) || item.length < 2) continue;
        const [key, value] = item;
        if (key === context.symbols.selector) {
          if (typeof value === "function") {
            selector = (value as () => string)();
          }
          continue;
        }
        if (typeof key === "string") properties.push([key, String(value)]);
      }
      if (selector !== undefined) {
        out.push({ selector, declarations: canonicalMap(properties) });
      }
      continue;
    }
    const record = entry as Record<string | symbol, unknown>;
    if (record[context.symbols.parent] !== undefined) continue;
    const properties: [string, string][] = [];
    for (const [key, value] of Object.entries(record)) {
      if (typeof value === "symbol") continue;
      properties.push([key, String(value)]);
    }
    const selector = record[context.symbols.selector];
    if (typeof selector === "function") {
      out.push({
        selector: (selector as () => string)(),
        declarations: canonicalMap(properties),
      });
      continue;
    }
    out.push({ selector: "", declarations: canonicalMap(properties) });
  }
  return out;
}

/** The yields of a rule, however it answered. */
function entriesOf(result: unknown): unknown[] {
  if (result === undefined || result === null) return [];
  if (Array.isArray(result)) return result;
  if (typeof result === "object" && Symbol.iterator in result) {
    return Array.from(result as Iterable<unknown>);
  }
  return [result];
}

/* ------------------------------------------------------------ the selector -- */

/**
 * A compound of a selector, and the combinator that joins it to the one
 * before it.
 */
interface Compound {
  readonly text: string;
  readonly combinator: string;
}

/**
 * The compounds of a selector.
 *
 * A combinator inside a functional pseudo-class is not a combinator at all:
 * `:is(a > b)` is one compound, and cutting it in two would read a selector
 * the rule never wrote. So the parentheses are counted rather than matched.
 */
function compounds(selector: string): Compound[] {
  const out: Compound[] = [];
  let depth = 0;
  let start = 0;
  let combinator = "";
  for (let index = 0; index < selector.length; index += 1) {
    const ch = selector[index] as string;
    if (ch === "(") depth += 1;
    if (ch === ")") depth -= 1;
    if (depth > 0) continue;
    if (ch === ">" || ch === "+" || ch === "~") {
      out.push({ text: selector.slice(start, index), combinator });
      combinator = ch;
      start = index + 1;
      continue;
    }
    if (/\s/.test(ch)) {
      if (selector.slice(start, index).trim() !== "") {
        out.push({ text: selector.slice(start, index), combinator });
        combinator = " ";
        start = index + 1;
      }
    }
  }
  const last = selector.slice(start).trim();
  if (last !== "") out.push({ text: last, combinator });
  return out;
}

/**
 * A type selector a compound names, and whether it is conditional.
 *
 * A conditional one names an element only in some circumstances — `a:hover`
 * names a link under a pointer, `abbr[title]` an abbreviation with a title —
 * and what it says is about that circumstance, not about the element. So the
 * lint reads it as the element's own decision only when the rule means it
 * for every instance.
 */
interface Subject {
  readonly tag: string;
  readonly conditional: boolean;
}

/**
 * The type selectors a compound names.
 *
 * `:is(…)` and `:where(…)` are lists of what the subject may be, and each
 * name in them is a subject of its own. `:not(…)` is a negation and names
 * nothing. A pseudo-class or an attribute anywhere else in the compound
 * makes the subject CONDITIONAL: `a:hover` says something about a link
 * under a pointer, not about the link, and `abbr[title]` about an
 * abbreviation that has a title.
 */
function subjects(compound: string): Subject[] {
  const out: Subject[] = [];
  collectSubjects(compound, out, isConditional(compound));
  return out;
}

/**
 * The parts of a compound, split where a selector list splits.
 *
 * The commas inside a functional pseudo-class are not a list's commas: they
 * are the alternatives of one subject.
 */
function splitTop(compound: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of compound) {
    if (ch === "(") depth += 1;
    if (ch === ")") depth -= 1;
    if (ch === "," && depth === 0) {
      out.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  out.push(current.trim());
  return out.filter((part) => part !== "");
}

/**
 * Whether a compound's subject is conditional.
 *
 * The subject of a compound says WHAT the element is; what stands beside it
 * qualifies it. A qualification that is a state (`:hover`), an attribute
 * (`[title]`) or a negation (`:not(...)`) says the rule speaks about the
 * element only in some circumstances — and a rule that speaks only in some
 * circumstances does not say what the element looks like.
 *
 * A class beside the subject is not a qualification of that kind: the
 * primitive's variants are classes, and `:is(button, ...).bare` names the
 * button and says nothing about when.
 */
function isConditional(compound: string): boolean {
  for (const part of splitTop(compound)) {
    const subject = leadingSubject(part);
    const beside = part.slice(subject.length);
    if (beside.includes("[")) return true;
    if (/::?[a-z-]/.test(beside)) return true;
    // A compound that is nothing but an attribute names the element by what
    // it carries, and says nothing about how it looks.
    if (subject === "") return true;
  }
  return false;
}

/**
 * The subject of a part of a compound: what says WHAT the element is.
 *
 * A type selector names it, a class or an id names it, and a group
 * (`:is(...)`, `:where(...)`) names what it MAY be. Whatever stands after
 * the subject qualifies it.
 */
function leadingSubject(part: string): string {
  const group = /^:(?:is|where)\(/.exec(part);
  if (group !== null) {
    const close = matchingParen(part, group[0].length - 1);
    return close === -1 ? part : part.slice(0, close + 1);
  }
  const name = /^([a-zA-Z*][a-zA-Z0-9-]*)/.exec(part);
  if (name !== null) return name[0];
  const mark = /^([.#][a-zA-Z0-9_-]+)/.exec(part);
  if (mark !== null) return mark[0];
  return "";
}

/** The index of the parenthesis that closes the one at `open`. */
function matchingParen(text: string, open: number): number {
  let depth = 0;
  for (let index = open; index < text.length; index += 1) {
    const ch = text[index] as string;
    if (ch === "(") depth += 1;
    if (ch === ")") {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

/**
 * The type selectors a piece of a compound names.
 *
 * A name is a type selector when nothing classes it and nothing calls it: a
 * dot makes it a class, a hash a name, a parenthesis a function.
 */
function collectSubjects(
  compound: string,
  out: Subject[],
  conditional: boolean,
): void {
  for (const part of splitTop(compound)) {
    const open = /^:(?:is|where)\(/.exec(part);
    if (open !== null) {
      const close = matchingParen(part, open[0].length - 1);
      if (close !== -1) {
        collectSubjects(
          part.slice(open[0].length, close),
          out,
          conditional,
        );
        continue;
      }
    }
    if (part.startsWith(":") || part.startsWith("[")) continue;
    const name = /^([a-zA-Z][a-zA-Z0-9-]*)/.exec(part);
    if (name === null) continue;
    const rest = part
      .slice((name[1] as string).length)
      .replace(/^:(?:not\(\[role\]\)|where\(:not\(\[role\]\)\))/, "");
    out.push({
      tag: name[1] as string,
      conditional: conditional || /^\s*[:[]/.test(rest),
    });
  }
}

/* ------------------------------------------------------------- the surface -- */

/**
 * The surfaces of a project's themes.
 *
 * The preset is asked once, and its rules are run per name — the elements
 * the manifest paints, and the classes the vocabulary knows. Both are cached:
 * a lint run asks about the same handful of elements over and over.
 */
export function surfacesFor(
  documents: readonly ThemeDocument[],
  options: SurfacesOptions = {},
): Surfaces {
  const preset = presetFor(documents, options);
  if (preset === undefined) return empty();
  const rules = preset.rules as unknown as readonly PresetRule[];
  const contextFor = (name: string): RuleContext => ({
    theme: preset.theme,
    symbols: { selector: SELECTOR, parent: PARENT },
    rawSelector: name,
    currentSelector: name,
    variantHandlers: [],
    variantMatch: [],
    constructCSS: () => "",
  });
  const elements = new Map<string, readonly Painted[]>();
  const utilities = new Map<string, ReadonlyMap<string, string>>();
  const variants = new Map<string, readonly string[]>();

  const paintedFor = (tag: string): readonly Painted[] => {
    const cached = elements.get(tag);
    if (cached !== undefined) return cached;
    const painted = paint(rules, contextFor(tag), tag);
    elements.set(tag, painted);
    return painted;
  };

  /**
   * The classes among these that paint the element.
   *
   * A primitive's variants are classes an author types on its own element, and
   * some of the classes a primitive declares are not: the icon slot is a class
   * on a CHILD, so it is a class the vocabulary knows and not a variant of the
   * element. The rules are asked which is which: a variant paints the element
   * because its selector names the element.
   */
  const variantsOf = (
    tag: string,
    classes: readonly string[],
  ): readonly string[] => {
    const key = tag + "\u0000" + classes.join("\u0000");
    const cached = variants.get(key);
    if (cached !== undefined) return cached;
    const out: string[] = [];
    for (const cls of classes) {
      const painted = paint(rules, contextFor(cls), cls);
      // A class that paints no element paints no element: the slot on a
      // child says nothing about the element the class sits on.
      if (painted.some((item) => namesElement(item.selector, tag))) {
        out.push(cls);
      }
    }
    variants.set(key, out);
    return out;
  };

  /**
   * What a class sets on the element it names.
   *
   * Only the yields that reach the element in its resting state count: a
   * variant's hover and its dead form are states, and a state is not what the
   * element looks like while it rests.
   */
  const wornFor = (
    tag: string,
    ancestors: readonly Ancestor[],
    cls: string,
  ): ReadonlyMap<string, string> => {
    const out = new Map<string, string>();
    for (const item of paint(rules, contextFor(cls), cls)) {
      if (
        !appliesTo(item.selector, tag, ancestors) &&
        !namesWornClass(item.selector, cls)
      ) continue;
      for (const [property, value] of item.declarations) {
        out.set(property, value);
      }
    }
    return out;
  };

  return {
    element(tag, ancestors, classes = []) {
      const out = new Map<string, string>();
      for (const item of paintedFor(tag)) {
        if (!appliesTo(item.selector, tag, ancestors)) continue;
        for (const [property, value] of item.declarations) {
          out.set(property, value);
        }
      }
      // The variants the element wears speak over the base: they are the
      // element's own look, so they are read last and they win.
      for (const cls of variantsOf(tag, classes)) {
        for (const [property, value] of wornFor(tag, ancestors, cls)) {
          out.set(property, value);
        }
      }
      return out;
    },
    utility(cls) {
      const cached = utilities.get(cls);
      if (cached !== undefined) return cached;
      const painted = paint(rules, contextFor(cls), cls);
      const declarations = new Map<string, string>();
      for (const item of painted) {
        if (item.selector !== "") continue;
        for (const [property, value] of item.declarations) {
          declarations.set(property, value);
        }
      }
      utilities.set(cls, declarations);
      return declarations;
    },
    variants(tag, classes) {
      return variantsOf(tag, classes);
    },
    worn(tag, ancestors, classes) {
      const out = new Map<string, string>();
      for (const cls of variantsOf(tag, classes)) {
        for (const [property, value] of wornFor(tag, ancestors, cls)) {
          out.set(property, value);
        }
      }
      return out;
    },
  };
}

/**
 * Whether a selector names the element.
 *
 * The subject of the selector is what says it: a variant rule's selector
 * names the element it paints, and a slot's selector names a class on a
 * child — which is no element at all.
 */
function namesElement(selector: string, tag: string): boolean {
  for (const alternative of splitTop(selector)) {
    for (const compound of compounds(alternative)) {
      for (const name of subjects(compound.text)) {
        if (name.tag === tag) return true;
      }
    }
  }
  return false;
}

/**
 * Whether a yield's selector is the worn class itself.
 *
 * A variant's reset may live one selector lighter than the variant — `.bare`
 * beside `:is(button, …).bare` — so utilities can still speak over it. That
 * yield names no element, but the element wears the class, so the yield
 * paints the element by construction.
 */
function namesWornClass(selector: string, cls: string): boolean {
  const escaped = cls.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const bare = new RegExp(`^\\.${escaped}$`);
  const attr = new RegExp(`^\\[variant~="${escaped}"\\]$`);
  return splitTop(selector).some((alternative) =>
    bare.test(alternative.trim()) || attr.test(alternative.trim())
  );
}

/**
 * The preset for a set of themes.
 *
 * A theme that does not satisfy the caller's requirements has no preset:
 * the rules would be reading tokens the theme never declared. Such a theme
 * is set aside rather than allowed to spoil the others — one unreadable
 * document must not cost every document its surfaces.
 */
function presetFor(
  documents: readonly ThemeDocument[],
  options: SurfacesOptions = {},
): { rules: unknown[]; theme: unknown } | undefined {
  const usable = documents.filter((document) => readable(document, options));
  if (usable.length === 0) return undefined;
  try {
    const preset = createSpinFactory(true)({
      themes: Object.fromEntries(
        usable.map((document, index) => [`theme-${index}`, document]),
      ),
    });
    return preset as unknown as { rules: unknown[]; theme: unknown };
  } catch {
    return undefined;
  }
}

/**
 * Whether the preset can read a theme.
 *
 * The caller's required set decides: a composed theme owes every role and a
 * palette it can defend; a fragment owes nothing but soundness — it parses
 * and its values are well-typed.
 */
function readable(document: ThemeDocument, options: SurfacesOptions = {}): boolean {
  const parsed = parseTokens(document);
  if (!parsed.ok) return false;
  const required = options.required ?? [...requiredPaths()];
  if (required.length > 0) {
    const report = validateTokens(parsed.tree, { required });
    if (report.issues.length > 0) return false;
    return validateLegibility(parsed.tree).length === 0;
  }
  return validateTokens(parsed.tree, { required: [] }).issues.length === 0;
}

/** The surfaces of a project whose themes could not be read. */
function empty(): Surfaces {
  return {
    element: () => new Map(),
    utility: () => new Map(),
    variants: () => [],
    worn: () => new Map(),
  };
}

/**
 * Whether a rule's selector paints this element, here.
 *
 * The rule has to name the element, and it has to name it unconditionally:
 * a rule that says `a:hover` says something about a link under a pointer, not
 * about the link. And the rule has to reach this element from where it
 * stands: a rule that paints a quotation inside a document column says
 * nothing about a quotation outside one.
 */
function appliesTo(
  selector: string,
  tag: string,
  ancestors: readonly Ancestor[],
): boolean {
  // A selector is a LIST of alternatives, and a rule that paints the element
  // paints it through ONE of them: a variant writes its class and the
  // attribute form of the same variant side by side, and both are the
  // element.
  for (const alternative of splitTop(selector)) {
    if (appliesToOne(alternative, tag, ancestors)) return true;
  }
  return false;
}

/**
 * Whether ONE alternative of a rule's selector paints this element, here.
 */
function appliesToOne(
  selector: string,
  tag: string,
  ancestors: readonly Ancestor[],
): boolean {
  const parts = compounds(selector);
  if (parts.length === 0) return false;
  const subject = parts[parts.length - 1] as Compound;
  const names = subjects(subject.text);
  if (!names.some((name) => name.tag === tag && !name.conditional)) {
    return false;
  }
  if (parts.length === 1) return true;
  const guard = parts[0] as Compound;
  // A sibling is not an ancestor: `li + li` says something about the item
  // that follows another one, and the lint cannot know which item it is
  // looking at. So a sibling rule is not the element's own decision.
  if (guard.combinator === "+" || guard.combinator === "~") return false;
  const guards = subjects(guard.text);
  if (guards.length === 0) return true;
  // Prose is base: the column is `<prose>`, never `.prose`. A classed
  // ancestor guards nothing for prose selectors (custom elements keep dual
  // matching until C3b).
  const inProseScope = guards.some((name) => name.tag === "prose");
  if (inProseScope) {
    return ancestors.some((ancestor) => ancestor.tag === "prose");
  }
  return guards.some((name) =>
    ancestors.some((ancestor) =>
      ancestor.tag === name.tag || ancestor.classes.includes(name.tag)
    )
  );
}

/**
 * Everything the checks ask the Uno engine, answered.
 *
 * Families from the catalog, primitives from the manifest (as the checks
 * read them — one scope row per painted element), surfaces from the rules.
 * A second engine answers the same shape from its own sources.
 */
export function engineAnswers(
  documents: readonly ThemeDocument[],
  options: SurfacesOptions = {},
): EngineAnswers {
  const trees = documents.flatMap((document) => {
    const parsed = parseTokens(document);
    return parsed.ok ? [parsed.tree] : [];
  });
  const families = new Map<string, Set<string>>();
  for (const tree of trees) {
    for (const section of describeCatalog(tree)) {
      const set = families.get(section.id) ?? new Set<string>();
      for (const utility of section.utilities) set.add(utility);
      families.set(section.id, set);
    }
  }
  const scopes: ScopeFact[] = [];
  for (const [name, contract] of Object.entries(primitiveContracts)) {
    for (const paint of contract.scope.paints) {
      scopes.push({
        primitive: name,
        self: contract.scope.self,
        tag: paint.tag,
        where: paint.where,
        owns: paint.owns,
        variants: contract.variants,
      });
    }
  }
  const familiesOut: UtilityFamily[] = [...families.entries()].map(([id, utilities]) => ({
    id,
    utilities: [...utilities],
  }));
  return {
    families: familiesOut,
    primitives: { scopes, variants: primitiveVariants() },
    surfaces: surfacesFor(documents, options),
  };
}
