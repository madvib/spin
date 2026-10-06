import type { ThemeContext } from "../../utils/lookup.ts";
import { groupOf, themeOf } from "../../utils/lookup.ts";

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
 * Spend a component's character tokens, reading each from the theme.
 *
 * A token the theme does not declare is omitted rather than emitted as an
 * invalid `var()` — the declaration falls through to the cascade either way,
 * and omitting it keeps the rule honest about what the theme actually said.
 *
 * Shared between the button and the card: both spend character tokens from
 * the theme, and the omission behaviour is identical.
 */
export function spend(
  ctx: ThemeContext | undefined,
  group: string,
  properties: Record<string, string>,
  ...steps: string[]
): Record<string, string> {
  const tokens = groupOf(ctx, group);
  const out: Record<string, string> = {};
  for (const step of steps) {
    const value = tokens[step];
    if (value === undefined) continue;
    const property = properties[step];
    if (property !== undefined) out[property] = value;
  }
  return out;
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
 * The typography every prose rule spends, and the rhythm they share.
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
  readonly weightSemibold: string | undefined;
  readonly weightBold: string | undefined;
  readonly mono: string | undefined;
  readonly sans: string | undefined;
  readonly heading: string | undefined;
}

export function proseTokens(ctx: Parameters<typeof themeOf>[0]): Tokens {
  const t = themeOf(ctx);
  const family = t?.fontFamily;
  return {
    spacing1: t?.spacing["1"],
    spacing2: t?.spacing["2"],
    spacing4: t?.spacing["4"],
    radiusSm: t?.radius?.["sm"],
    radiusMd: t?.radius?.["md"],
    text: t?.colors["text"],
    muted: t?.colors["text-muted"],
    surface: t?.colors["surface"],
    raised: t?.colors["surface-raised"],
    border: t?.colors["border"],
    link: t?.colors["link"],
    accent: t?.colors["accent"],
    success: t?.colors["semantic-success"],
    error: t?.colors["semantic-error"],
    focusRing: t?.colors["focus-ring"],
    borderWidth: t?.borderWidth?.["width"],
    focusWidth: t?.focusWidth?.["width"],
    focusOffset: t?.focusOffset?.["offset"],
    sizeXs: t?.fontSize?.["xs"],
    sizeSm: t?.fontSize?.["sm"],
    sizeMd: t?.fontSize?.["md"],
    sizeLg: t?.fontSize?.["lg"],
    sizeXl: t?.fontSize?.["xl"],
    size2xl: t?.fontSize?.["2xl"],
    size3xl: t?.fontSize?.["3xl"],
    weightSemibold: t?.fontWeight?.["semibold"],
    weightBold: t?.fontWeight?.["bold"],
    mono: family?.["mono"],
    sans: family?.["body"] ?? family?.["sans"],
    // The heading face is a fallback chain, not a step: a theme may name a
    // heading face, then a body face, and fall through to the sans face. The
    // chain is resolved here rather than spelled as a nested `var()` because a
    // rule reads values, not variable names.
    heading: family?.["heading"] ?? family?.["body"] ?? family?.["sans"],
  };
}

export function rhythm(t: Tokens): Record<string, string | undefined> {
  return {
    "margin-block-start": "0",
    ...(t.spacing2 !== undefined ? { "margin-block-end": t.spacing2 } : {}),
  };
}
