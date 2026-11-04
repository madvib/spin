import {
  named,
  type ThemeContext,
  themeOf,
  token,
} from "../../utils/lookup.ts";
import { themeKey } from "../../../theme/index.ts";
import {
  elementTypeFields,
  FACE_CHAINS,
  type GlobalTypePath,
} from "../../../theme/index.ts";
import type { ThemeTokenPath } from "../../../theme/theme-types.d.ts";

/**
 * How a primitive claims its element.
 *
 * `classless` is the default and the whole premise: `<button>` is a button.
 * With it off, a primitive claims only its own class, which is what a consumer
 * needs when they do not control the markup — a CMS, a third-party embed, a
 * codebase mid-migration — and cannot have every table in the page restyled by
 * their build tool.
 *
 * The claim is per component rather than global because a consumer's own
 * `<button>` is nearly always the one they want styled, while a `<table>` in
 * pasted content nearly always is not.
 */
export interface Mode {
  readonly classless: boolean;
}

/** The claim a component makes on its element: the tag, or its class. */
export function claim(mode: Mode, tag: string): string {
  return mode.classless ? tag : `.${tag}`;
}

/**
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

/* ------------------------------------------------ the per-element decisions -- */

/**
 * What one element's type is, as the theme states it.
 *
 * Only what the theme STATES. A token the theme does not declare is absent
 * here, and the rule's own answer stands in its place — the ladder's step,
 * the role's face, the weight the level implies. That is what makes the
 * group safe to leave out, and what makes it worth having: a theme that
 * moves one heading's size moves that heading and nothing else.
 */
export interface StatedType {
  readonly family: string | undefined;
  readonly size: string | undefined;
  readonly weight: string | undefined;
}

/**
 * The type one element reads, as the theme states it.
 *
 * The three decisions are read together because a theme states them together:
 * `font.element.h1.family`, `font.element.h1.size` and
 * `font.element.h1.weight` are one element's answer, and the answer a theme
 * gives is the whole of it or none of it.
 */
export function statedType(
  ctx: ThemeContext | undefined,
  element: string,
): StatedType {
  const theme = themeOf(ctx);
  const fields = elementTypeFields(element);
  if (theme === undefined) {
    return { family: undefined, size: undefined, weight: undefined };
  }
  const read = (path: string | undefined): string | undefined =>
    path === undefined ? undefined : theme[themeKey(path)];
  return {
    family: read(fields.family?.path),
    size: read(fields.size?.path),
    weight: read(fields.weight?.path),
  };
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
 * The typography every prose rule spends, and the spacing they share.
 *
 * These live here rather than in `prose.ts` because all four prose files read
 * them and `prose.ts` imports those four — so anything prose.ts exported was a
 * cycle, and a binding unavailable at module init is a runtime failure in a
 * build script, which is the worst place to find one.
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
  readonly sizeXs: string | undefined;
  readonly sizeSm: string | undefined;
  readonly sizeMd: string | undefined;
  readonly sizeLg: string | undefined;
  readonly sizeXl: string | undefined;
  readonly size2xl: string | undefined;
  readonly size3xl: string | undefined;
  readonly weightRegular: string | undefined;
  readonly weightSemibold: string | undefined;
  readonly weightBold: string | undefined;
  readonly mono: string | undefined;
  /** The body face: what `font.family.body` says, or the sans it falls to. */
  readonly body: string | undefined;
  /** The editorial face: `font.family.serif`. */
  readonly serif: string | undefined;
  readonly heading: string | undefined;
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
    sizeXs: token(ctx, "font.size.xs"),
    sizeSm: token(ctx, "font.size.sm"),
    sizeMd: token(ctx, "font.size.md"),
    sizeLg: token(ctx, "font.size.lg"),
    sizeXl: token(ctx, "font.size.xl"),
    size2xl: token(ctx, "font.size.2xl"),
    size3xl: token(ctx, "font.size.3xl"),
    weightRegular: token(ctx, "font.weight.regular"),
    weightSemibold: token(ctx, "font.weight.semibold"),
    weightBold: token(ctx, "font.weight.bold"),
    mono: token(ctx, "font.family.mono"),
    // The body face: what `font.family.body` says, or the sans it falls to.
    body: face(ctx, "font.family.body"), // The editorial face: `font.family.serif`.
    serif: token(ctx, "font.family.serif"),
    // The heading face is a fallback chain, not a step: a theme may name a
    // heading face, then a body face, and fall through to the sans face. The
    // chain is the contract's, and it is resolved here rather than spelled as
    // a nested `var()` because a rule reads values, not variable names.
    heading: face(ctx, "font.family.heading"),
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
