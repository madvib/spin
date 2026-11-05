import {
  named,
  type ThemeContext,
  token,
} from "../../utils/lookup.ts";
import {
  FACE_CHAINS,
  type GlobalTypePath,
} from "../../../theme/index.ts";
import type { ThemeTokenPath } from "../../../theme/theme-types.d.ts";
/**
 * Primitives always claim their bare tags: `<button>` is a button and
 * `<card>` is a card. Classless is the whole premise, not an option —
 * incremental adoption is served by `primitives: [...]` narrowing, not by
 * a mode flip.
 *
 * Spend a component's own tokens, reading each from the theme.
 *
 * A token the theme does not declare is omitted rather than emitted as an
 * invalid `var()` — the declaration falls through to the cascade either way,
 * and omitting it keeps the rule honest about what the theme actually said.
 *
 * A step with a FALLBACK is the exception, and the fallback is a path into
 * the theme's own scales: a control that inherits the browser's default is a
 * control the theme never dressed, and the theme has the answer — the type
 * scale's semibold, say. The path is typed, so a fallback that names a
 * token nobody declares is a compile error rather than a silent nothing.
 */
export function spend(
  ctx: ThemeContext | undefined,
  group: string,
  properties: Record<string, string>,
  fallbacks: Record<string, ThemeTokenPath | undefined>,
  ...steps: string[]
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const step of steps) {
    const fallback = fallbacks[step];
    // The fallback is read on its own — not inside the `??` — so the
    // derivation that records what a rule spends sees it: a token the rule
    // only reaches when the theme is silent is still a token the rule spends.
    const shared = fallback === undefined ? undefined : token(ctx, fallback);
    const value = named(ctx, group, step) ?? shared;
    if (value === undefined) continue;
    const property = properties[step];
    if (property !== undefined) out[property] = value;
  }
  return out;
}

/**
 * A token a component spends, and the shared scale it falls back to.
 *
 * The fallback is read on its own — not inside the `??` — so the derivation
 * that records what a rule spends sees both. A token the rule only reaches
 * when the theme is silent is still a token the rule spends, and a manifest
 * that leaves it out is a manifest that understates the contract.
 */
export function withFallback(
  ctx: ThemeContext | undefined,
  path: ThemeTokenPath,
  fallback: ThemeTokenPath,
): string | undefined {
  const value = token(ctx, path);
  const shared = token(ctx, fallback);
  return value ?? shared;
}

/* ------------------------------------------------------------- the faces -- */

/**
 * The face a role reads, following the contract's chain.
 *
 * The display face falls back to the heading family, the heading family to
 * the body, and the body to the sans: a theme that names no display voice
 * still has a face for its headings, and a theme that names no body face
 * still has the sans. The chain is the contract's, so the answer is one
 * lookup rather than three, and a rule cannot spell the steps differently
 * from another rule.
 */
export function face(
  ctx: ThemeContext | undefined,
  path: GlobalTypePath,
): string | undefined {
  const chain = [path, ...(FACE_CHAINS[path] ?? [])];
  // Every candidate is read, not only the one that answers: a token the rule
  // reaches when the theme is silent is still a token the rule spends, and a
  // manifest that leaves it out understates the contract.
  const values = chain.map((candidate) => token(ctx, candidate));
  let nested: string | undefined;
  for (let i = values.length - 1; i >= 0; i -= 1) {
    const value = values[i];
    if (value === undefined) continue;
    if (typeof value !== "string" || nested === undefined) nested = `${value}`;
    else if (value.endsWith(")")) nested = `${value.slice(0, -1)}, ${nested})`;
    else return value;
  }
  return nested;
}

/* ------------------------------------------------------- the named styles -- */

/**
 * What one named style's tuple is, as the theme states it.
 *
 * Only what the theme STATES. A field the theme does not declare is absent
 * here, and the rule's ladder fallback stands in its place — the step the
 * style is built from. That is what makes a new style safe to declare
 * halfway: a theme that moves one style's size moves every element that
 * reads the style and nothing else.
 */
export interface StyleType {
  readonly family: string | undefined;
  readonly size: string | undefined;
  readonly weight: string | undefined;
  readonly tracking: string | undefined;
  readonly leading: string | undefined;
}

/**
 * The tuple one named style reads, as the theme states it.
 *
 * The five decisions are read together because a theme states them together:
 * `font.style.body.family` through `font.style.body.leading` are one
 * style's answer. No ladder fallback here: the caller pairs each field with
 * the ladder it replaces, so the fallback a paragraph keeps is the body's
 * and the one a heading keeps is its level's.
 */
export function styleType(
  ctx: ThemeContext | undefined,
  style: string,
): StyleType {
  return {
    family: named(ctx, "font-style", `${style}-family`),
    size: named(ctx, "font-style", `${style}-size`),
    weight: named(ctx, "font-style", `${style}-weight`),
    tracking: named(ctx, "font-style", `${style}-tracking`),
    leading: named(ctx, "font-style", `${style}-leading`),
  };
}

/**
 * The ladder step during the migration window: what a rule spends when the
 * theme is silent.
 *
 * Styles are required, so a complete theme never lands here — the style's
 * variable answers first. An incomplete theme cannot build, so the value
 * read here is never the product's; it is the old answer, kept so a partial
 * document renders what it rendered before. One function so the window's
 * end is one deletion: every call site pairs a style read with this, and
 * closing the window deletes the pair's second half.
 */
export function ladder(
  ctx: ThemeContext | undefined,
  path: GlobalTypePath,
): string | undefined {
  return token(ctx, path);
}

/** The ladder step one style field falls back to during the window. */
const STYLE_LADDER: Readonly<Record<string, ThemeTokenPath>> = {
  "caption-size": "font.size.xs",
  "label-size": "font.size.sm",
  "body-strong-weight": "font.weight.semibold",
  "code-family": "font.family.mono",
};

/**
 * One style field with its ladder fallback, for the readers that cannot
 * name their whole tuple's style.
 *
 * `kbd` and the subscripts are not prose voices and carry no default style,
 * but their sizes are the ladder's no longer: each reads the style that
 * wears the same step, falling back to the step itself during the window.
 */
export function styleField(
  ctx: ThemeContext | undefined,
  style: string,
  field: string,
): string | undefined {
  const value = named(ctx, "font-style", `${style}-${field}`);
  if (value !== undefined) return value;
  // Read on its own — not inside the `??` — so the derivation that records
  // what a rule spends sees the fallback: a token the rule only reaches
  // when the theme is silent is still a token the rule spends.
  const fallback = STYLE_LADDER[`${style}-${field}`];
  if (fallback === undefined) return undefined;
  return token(ctx, fallback);
}

/**
 * The style a component reference names, or the default when the theme
 * states no reference.
 *
 * A reference token (`button.type`) carries a style NAME, not CSS: the
 * factory resolves declared references to their literal names when it builds
 * the theme map, so by the time a rule reads, the value is the name or the
 * token is absent. Absent with a default is the common case — a theme that
 * says nothing about the button's type gets the label voice. Absent without
 * one is a variant that inherits: it states no type of its own.
 */
export function styleReference(
  ctx: ThemeContext | undefined,
  path: string,
  fallback: string | undefined,
): string | undefined {
  const segments = path.split(".");
  const name = segments.pop() as string;
  const family = segments.join("-");
  return named(ctx, family, name) ?? fallback;
}

/**
 * A spent declaration map as CSS entry tuples.
 *
 * `Object.entries` widens each tuple to `string[]`, which an array-bodied
 * uno yield cannot accept — it wants a fixed `[property, value]` pair. The
 * map has to become entries in this shape to be spread into one.
 */
export function spentEntries(
  declarations: Record<string, string>,
): [string, string][] {
  return Object.entries(declarations) as [string, string][];
}

/* ---------------------------------------------------------------- disabled --
 *
 * What a control wears when it cannot be used.
 */

/**
 * The posture a dead control wears.
 *
 * A disabled control is not a dimmer control. Dimming spends opacity on the
 * WHOLE element, so the ink dims with the fill: a white label on a blue
 * button at half strength measures 1.56:1 — a button nobody can read, in the
 * one state a reader is most likely to reach for by mistake.
 *
 * The posture is a PAIR, and the theme states both halves — the fill a dead
 * control wears, and the ink that reads on it — so a dead control is muted
 * and still legible. The edge is part of the posture: a dead control is
 * drawn in the same ink as its label, so it reads as one object rather than
 * as a label with a box around it.
 *
 * A theme that states neither role paints no posture at all: the rule then
 * says nothing about the dead state, which is the same answer the rest of
 * the system gives for a token a theme does not declare.
 */
export function disabledPosture(
  ctx: ThemeContext | undefined,
): Record<string, string | undefined> {
  const fill = token(ctx, "color.disabled");
  const ink = token(ctx, "color.on-disabled");
  return {
    ...(fill !== undefined ? { "background-color": fill } : {}),
    ...(ink !== undefined ? { color: ink, "border-color": ink } : {}),
  };
}

/**
 * The states a LIVE control can be in.
 *
 * `:disabled` and `aria-disabled` are the same fact said two ways: the
 * attribute for a control the platform has switched off, the ARIA state for
 * one an application has switched off itself. A control that says it is dead
 * must not answer the pointer, the press or the keyboard either — a dead
 * button that lifts on hover, or that grows a focus ring, says the opposite
 * of what it is.
 */
export const ALIVE = ':not(:disabled):not([aria-disabled="true"])';

/* ------------------------------------------------------------------- focus --
 *
 * The ring every interactive element shares.
 */

/**
 * The theme's focus ring: its stroke, its distance from the edge, its ink.
 *
 * Every element that can take focus spends the same three, so they are read
 * once and handed round rather than each rule spelling the paths out.
 */
export interface FocusRing {
  /** The ring's stroke — the outline's width. */
  readonly width: string | undefined;
  /** How far the ring stands off the control's edge. */
  readonly offset: string | undefined;
  /** The ring's ink. */
  readonly color: string | undefined;
}

/** The focus ring, read from the theme. */
export function focusRing(ctx: ThemeContext | undefined): FocusRing {
  return {
    width: token(ctx, "focus.width"),
    offset: token(ctx, "focus.offset"),
    color: token(ctx, "color.focus-ring"),
  };
}

/**
 * What a focused control wears.
 *
 * **The ring is an OUTLINE.** It is painted outside the control's box, so it
 * never changes the control's size and focusing a control never nudges the
 * page, and it is painted in the theme's focus ink rather than in a colour
 * the rule invented.
 *
 * **The ring is the control's edge.** The control's own border takes the
 * ring's ink too, so the reader sees ONE edge, in the theme's focus colour.
 * A border in one colour with a ring in another, sitting beside it, is a
 * doubled edge: it reads as a broken border rather than as focus. The ring
 * stands off the border by the theme's offset, so the two are one focus
 * treatment and not two borders arguing.
 */
export function focusPaint(
  ring: FocusRing,
): Record<string, string | undefined> {
  return {
    ...(ring.width !== undefined && ring.color !== undefined
      ? { outline: `${ring.width} solid ${ring.color}` }
      : {}),
    ...(ring.offset !== undefined ? { "outline-offset": ring.offset } : {}),
    ...(ring.color !== undefined ? { "border-color": ring.color } : {}),
  };
}

/**
 * A CSS entry, stated as a tuple rather than inferred.
 *
 * `[["border", value]]` inside a conditional widens to `string[][]`, and one
 * `string[]` among the entries is enough for uno's yield type to reject the
 * whole rule. Annotating the tuple is the fix; there is no way to narrow it
 * after the fact.
 */
export type Entry = [property: string, value: string | undefined];

/* -------------------------------------------------------------------- prose --
 *
 * The paint and spacing every prose rule spends, and the type the readers
 * outside prose still take from the ladder.
 *
 * These live here rather than in `prose.ts` because all four prose files read
 * them and `prose.ts` imports those four — so anything prose.ts exported was a
 * cycle, and a binding unavailable at module init is a runtime failure in a
 * build script, which is the worst place to find one.
 *
 * The type fields are the window's: the prose rules read their styles
 * outright through `styleType`, and what remains here is what the readers
 * that carry no default style still spend — the keycap, the breadcrumbs and
 * the disclosure summary. Each reads the style that wears its step first
 * and the step itself second, so moving the style moves them too.
 */

export interface Tokens {
  readonly spacing1: string | undefined;
  readonly spacing2: string | undefined;
  readonly spacing4: string | undefined;
  readonly radiusSm: string | undefined;
  readonly radiusMd: string | undefined;
  readonly text: string | undefined;
  readonly muted: string | undefined;
  readonly surface: string | undefined;
  readonly raised: string | undefined;
  readonly border: string | undefined;
  readonly link: string | undefined;
  readonly accent: string | undefined;
  readonly onAccent: string | undefined;
  readonly success: string | undefined;
  readonly error: string | undefined;
  readonly focusRing: string | undefined;
  readonly borderWidth: string | undefined;
  readonly focusWidth: string | undefined;
  readonly focusOffset: string | undefined;
  /** The caption's size, for the keycap and the subscripts. */
  readonly sizeXs: string | undefined;
  /** The label's size, for the breadcrumbs. */
  readonly sizeSm: string | undefined;
  /** The strong voice's weight, for the disclosure summary. */
  readonly weightSemibold: string | undefined;
  /** The code style's face, for the keycap. */
  readonly mono: string | undefined;
}

export function proseTokens(ctx: ThemeContext | undefined): Tokens {
  return {
    spacing1: token(ctx, "spacing.1"),
    spacing2: token(ctx, "spacing.2"),
    spacing4: token(ctx, "spacing.4"),
    radiusSm: token(ctx, "radius.sm"),
    radiusMd: token(ctx, "radius.md"),
    text: token(ctx, "color.text"),
    muted: token(ctx, "color.text-muted"),
    surface: token(ctx, "color.surface"),
    raised: token(ctx, "color.surface-raised"),
    border: token(ctx, "color.border"),
    link: token(ctx, "color.link"),
    accent: token(ctx, "color.accent"),
    onAccent: token(ctx, "color.on-accent"),
    success: token(ctx, "color.semantic.success"),
    error: token(ctx, "color.semantic.error"),
    focusRing: token(ctx, "color.focus-ring"),
    borderWidth: token(ctx, "border.width"),
    focusWidth: token(ctx, "focus.width"),
    focusOffset: token(ctx, "focus.offset"),
    sizeXs: styleField(ctx, "caption", "size"),
    sizeSm: styleField(ctx, "label", "size"),
    weightSemibold: styleField(ctx, "body-strong", "weight"),
    mono: styleField(ctx, "code", "family"),
  };
}

/**
 * The space a block leaves under itself.
 *
 * The block's own top margin is zeroed, so the space between two blocks is
 * the one the theme states and nothing else: the space a heading leaves under
 * it is the space a paragraph leaves under it.
 */
export function spacing(t: Tokens): Record<string, string | undefined> {
  return {
    "margin-block-start": "0",
    ...(t.spacing4 !== undefined ? { "margin-block-end": t.spacing4 } : {}),
  };
}
