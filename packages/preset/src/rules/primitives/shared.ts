import type { ThemeContext } from "../../utils/lookup.ts";
import type { ThemeTokenPath } from "@spinjs/theme/theme-types";
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
  _ctx: ThemeContext | undefined,
  _group: string,
  _properties: Record<string, string>,
  _fallbacks: Record<string, ThemeTokenPath | undefined>,
  ..._steps: string[]
): Record<string, string> { throw new Error("spend() deleted: inline typed reads instead"); }

/**
 * A component token, and the shared scale it falls back to.
 *
 * Both arguments evaluate before the call, so the derivation that records
 * what a rule spends sees both. A token the rule only reaches when the theme
 * is silent is still a token the rule spends, and a manifest that leaves it
 * out is a manifest that understates the contract.
 */
export function fallback(
  primary: string | undefined,
  shared: string | undefined,
): string | undefined {
  return primary ?? shared;
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
  const fill = ctx?.theme?.color?.disabled;
  const ink = ctx?.theme?.color?.["on-disabled"];
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
    width: ctx?.theme?.focus?.width,
    offset: ctx?.theme?.focus?.offset,
    color: ctx?.theme?.color?.["focus-ring"],
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
 * The paint and spacing every prose rule spends.
 *
 * These live here rather than in `prose.ts` because all four prose files read
 * them and `prose.ts` imports those four — so anything prose.ts exported was a
 * cycle, and a binding unavailable at module init is a runtime failure in a
 * build script, which is the worst place to find one.
 *
 * The prose rules read their styles outright through `ctx.theme`; what remains
 * here is the paint and spacing no style owns.
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
}

export function proseTokens(ctx: ThemeContext | undefined): Tokens {
  return {
    spacing1: ctx?.theme?.spacing?.[1],
    spacing2: ctx?.theme?.spacing?.[2],
    spacing4: ctx?.theme?.spacing?.[4],
    radiusSm: ctx?.theme?.radius?.sm,
    radiusMd: ctx?.theme?.radius?.md,
    text: ctx?.theme?.color?.text,
    muted: ctx?.theme?.color?.["text-muted"],
    surface: ctx?.theme?.color?.surface,
    raised: ctx?.theme?.color?.["surface-raised"],
    border: ctx?.theme?.color?.border,
    link: ctx?.theme?.color?.link,
    accent: ctx?.theme?.color?.accent,
    onAccent: ctx?.theme?.color?.["on-accent"],
    success: ctx?.theme?.color?.semantic?.success,
    error: ctx?.theme?.color?.semantic?.error,
    focusRing: ctx?.theme?.color?.["focus-ring"],
    borderWidth: ctx?.theme?.border?.width,
    focusWidth: ctx?.theme?.focus?.width,
    focusOffset: ctx?.theme?.focus?.offset,
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
