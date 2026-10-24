/**
 * The per-element typography: what one element's type is, when the theme says so.
 *
 * A shared scale is a decision the whole system shares — spacing, type,
 * radius, shadow. The type an ELEMENT reads is a decision the element owns: a
 * theme may set `<h1>` in a display face at the top of the ladder, put a
 * quotation in the body face, or take a link out of the body's size and set
 * it small.
 *
 * The group is OPTIONAL, and the system has an answer for every one of its
 * tokens: the ladder's step for a heading's size, the role's face for its
 * family, the weight the level implies. A theme that says nothing about a
 * heading gets the system's answer; a theme that says something replaces it.
 * That is what makes the group safe to leave out, and what makes it worth
 * having — one heading's size can move without the other five moving with
 * it, and a theme that never mentions the group still reads as a complete
 * theme.
 *
 * The paths are `font.element.<tag>.<field>`, and the fallback each one
 * carries is the system's answer, stated here rather than in a rule — so the
 * theme's own documentation and the rules that spend it cannot disagree.
 */

import type { TokenType } from "../pipeline/types.ts";

/**
 * What one element's type is made of.
 *
 * Three decisions, and no more: the face it reads in, the size it reads at,
 * and the weight it reads at. The leading is the system's — a heading's line
 * height and a heading's tracking are the scale's business, and a theme that
 * wants a different leading says so on the scale.
 */
export type ElementTypeField = "family" | "size" | "weight";

/**
 * The global paths a per-element decision falls back to.
 *
 * The ladder's steps, the family's slots, and the weights — the vocabulary
 * the system already has. A fallback outside this set is a path the theme
 * language does not have, and the type says so at compile time.
 */
export type GlobalTypePath =
  | "font.family.sans"
  | "font.family.heading"
  | "font.family.body"
  | "font.family.serif"
  | "font.family.mono"
  | "font.size.xs"
  | "font.size.sm"
  | "font.size.md"
  | "font.size.lg"
  | "font.size.xl"
  | "font.size.2xl"
  | "font.size.3xl"
  | "font.weight.regular"
  | "font.weight.medium"
  | "font.weight.semibold"
  | "font.weight.bold";

/** One decision one element may state, and what it stands for when it does not. */
export interface ElementTypeDeclaration {
  /** The element the decision is about: `h1`, `p`, `blockquote`. */
  readonly element: string;
  /** Which of the three decisions this is. */
  readonly field: ElementTypeField;
  /** The dotted path: `font.element.h1.family`. */
  readonly path: string;
  readonly type: TokenType;
  /** What the token is for, in the words an editor shows. */
  readonly doc: string;
  /**
   * The global path the element reads when the theme says nothing.
   *
   * The system's answer, stated once. A heading's size falls back to the
   * ladder's step, its face to the display face, and the body's face to the
   * sans.
   */
  readonly fallback: GlobalTypePath;
}

/**
 * The chain a face falls back through.
 *
 * The display face falls back to the heading family, the heading family to
 * the body, and the body to the sans: a theme that names no display voice
 * still has a face for its headings, and a theme that names no body face
 * still has the sans. The chain is the contract's, so a rule reads one
 * answer for "what face does this element read" rather than spelling the
 * steps out again.
 *
 * A slot with no chain is a slot with no answer: a theme that names no
 * editorial face leaves a quotation in the face it inherits.
 */
export const FACE_CHAINS: Readonly<
  Partial<Record<GlobalTypePath, readonly GlobalTypePath[]>>
> = {
  "font.family.heading": ["font.family.body", "font.family.sans"],
  "font.family.body": ["font.family.sans"],
};

/**
 * The per-element typography, one entry per decision.
 *
 * The order is the order a reader meets them: the headings, then the block
 * and the inline elements, then the caption. Every entry is a decision a
 * theme MAY make, and every one of them has a fallback, so the group is
 * optional throughout — a theme that declares none of it is complete.
 */
export const ELEMENT_TYPE_ROLES = [
  {
    element: "h1",
    field: "family",
    path: "font.element.h1.family",
    type: "fontFamily",
    doc:
      "The face a level-one heading reads in. The display face, unless the theme says otherwise.",
    fallback: "font.family.heading",
  },
  {
    element: "h1",
    field: "size",
    path: "font.element.h1.size",
    type: "dimension",
    doc:
      "The size a level-one heading reads at. The top of the ladder, unless the theme says otherwise.",
    fallback: "font.size.3xl",
  },
  {
    element: "h1",
    field: "weight",
    path: "font.element.h1.weight",
    type: "fontWeight",
    doc:
      "The weight a level-one heading reads at. The ladder's bold, unless the theme says otherwise.",
    fallback: "font.weight.bold",
  },
  {
    element: "h2",
    field: "family",
    path: "font.element.h2.family",
    type: "fontFamily",
    doc: "The face a level-two heading reads in.",
    fallback: "font.family.heading",
  },
  {
    element: "h2",
    field: "size",
    path: "font.element.h2.size",
    type: "dimension",
    doc: "The size a level-two heading reads at.",
    fallback: "font.size.2xl",
  },
  {
    element: "h2",
    field: "weight",
    path: "font.element.h2.weight",
    type: "fontWeight",
    doc: "The weight a level-two heading reads at.",
    fallback: "font.weight.semibold",
  },
  {
    element: "h3",
    field: "family",
    path: "font.element.h3.family",
    type: "fontFamily",
    doc: "The face a level-three heading reads in.",
    fallback: "font.family.heading",
  },
  {
    element: "h3",
    field: "size",
    path: "font.element.h3.size",
    type: "dimension",
    doc: "The size a level-three heading reads at.",
    fallback: "font.size.xl",
  },
  {
    element: "h3",
    field: "weight",
    path: "font.element.h3.weight",
    type: "fontWeight",
    doc: "The weight a level-three heading reads at.",
    fallback: "font.weight.semibold",
  },
  {
    element: "h4",
    field: "family",
    path: "font.element.h4.family",
    type: "fontFamily",
    doc: "The face a level-four heading reads in.",
    fallback: "font.family.heading",
  },
  {
    element: "h4",
    field: "size",
    path: "font.element.h4.size",
    type: "dimension",
    doc: "The size a level-four heading reads at.",
    fallback: "font.size.lg",
  },
  {
    element: "h4",
    field: "weight",
    path: "font.element.h4.weight",
    type: "fontWeight",
    doc: "The weight a level-four heading reads at.",
    fallback: "font.weight.semibold",
  },
  {
    element: "h5",
    field: "family",
    path: "font.element.h5.family",
    type: "fontFamily",
    doc: "The face a level-five heading reads in.",
    fallback: "font.family.heading",
  },
  {
    element: "h5",
    field: "size",
    path: "font.element.h5.size",
    type: "dimension",
    doc: "The size a level-five heading reads at.",
    fallback: "font.size.md",
  },
  {
    element: "h5",
    field: "weight",
    path: "font.element.h5.weight",
    type: "fontWeight",
    doc: "The weight a level-five heading reads at.",
    fallback: "font.weight.semibold",
  },
  {
    element: "h6",
    field: "family",
    path: "font.element.h6.family",
    type: "fontFamily",
    doc: "The face a level-six heading reads in.",
    fallback: "font.family.heading",
  },
  {
    element: "h6",
    field: "size",
    path: "font.element.h6.size",
    type: "dimension",
    doc: "The size a level-six heading reads at.",
    fallback: "font.size.sm",
  },
  {
    element: "h6",
    field: "weight",
    path: "font.element.h6.weight",
    type: "fontWeight",
    doc: "The weight a level-six heading reads at.",
    fallback: "font.weight.semibold",
  },
  {
    element: "p",
    field: "family",
    path: "font.element.p.family",
    type: "fontFamily",
    doc:
      "The face a paragraph reads in. The body face, unless the theme says otherwise.",
    fallback: "font.family.body",
  },
  {
    element: "p",
    field: "size",
    path: "font.element.p.size",
    type: "dimension",
    doc:
      "The size a paragraph reads at. The body's size, unless the theme says otherwise.",
    fallback: "font.size.md",
  },
  {
    element: "p",
    field: "weight",
    path: "font.element.p.weight",
    type: "fontWeight",
    doc: "The weight a paragraph reads at.",
    fallback: "font.weight.regular",
  },
  {
    element: "blockquote",
    field: "family",
    path: "font.element.blockquote.family",
    type: "fontFamily",
    doc:
      "The face a quotation reads in. The editorial face, unless the theme says otherwise.",
    fallback: "font.family.serif",
  },
  {
    element: "blockquote",
    field: "size",
    path: "font.element.blockquote.size",
    type: "dimension",
    doc: "The size a quotation reads at.",
    fallback: "font.size.md",
  },
  {
    element: "blockquote",
    field: "weight",
    path: "font.element.blockquote.weight",
    type: "fontWeight",
    doc: "The weight a quotation reads at.",
    fallback: "font.weight.regular",
  },
  {
    element: "code",
    field: "family",
    path: "font.element.code.family",
    type: "fontFamily",
    doc:
      "The face a run of code reads in. The mono face, unless the theme says otherwise.",
    fallback: "font.family.mono",
  },
  {
    element: "code",
    field: "size",
    path: "font.element.code.size",
    type: "dimension",
    doc: "The size a run of code reads at.",
    fallback: "font.size.sm",
  },
  {
    element: "code",
    field: "weight",
    path: "font.element.code.weight",
    type: "fontWeight",
    doc: "The weight a run of code reads at.",
    fallback: "font.weight.regular",
  },
  {
    element: "small",
    field: "family",
    path: "font.element.small.family",
    type: "fontFamily",
    doc: "The face a small label reads in.",
    fallback: "font.family.body",
  },
  {
    element: "small",
    field: "size",
    path: "font.element.small.size",
    type: "dimension",
    doc: "The size a small label reads at.",
    fallback: "font.size.xs",
  },
  {
    element: "small",
    field: "weight",
    path: "font.element.small.weight",
    type: "fontWeight",
    doc: "The weight a small label reads at.",
    fallback: "font.weight.regular",
  },
  {
    element: "strong",
    field: "family",
    path: "font.element.strong.family",
    type: "fontFamily",
    doc: "The face a strong run reads in.",
    fallback: "font.family.body",
  },
  {
    element: "strong",
    field: "size",
    path: "font.element.strong.size",
    type: "dimension",
    doc: "The size a strong run reads at. The size of the text it sits in.",
    fallback: "font.size.md",
  },
  {
    element: "strong",
    field: "weight",
    path: "font.element.strong.weight",
    type: "fontWeight",
    doc:
      "The weight a strong run reads at. The ladder's bold, unless the theme says otherwise.",
    fallback: "font.weight.bold",
  },
  {
    element: "a",
    field: "family",
    path: "font.element.a.family",
    type: "fontFamily",
    doc: "The face a link reads in.",
    fallback: "font.family.body",
  },
  {
    element: "a",
    field: "size",
    path: "font.element.a.size",
    type: "dimension",
    doc: "The size a link reads at. The size of the text it sits in.",
    fallback: "font.size.md",
  },
  {
    element: "a",
    field: "weight",
    path: "font.element.a.weight",
    type: "fontWeight",
    doc: "The weight a link reads at.",
    fallback: "font.weight.regular",
  },
  {
    element: "figcaption",
    field: "family",
    path: "font.element.figcaption.family",
    type: "fontFamily",
    doc: "The face a caption reads in.",
    fallback: "font.family.body",
  },
  {
    element: "figcaption",
    field: "size",
    path: "font.element.figcaption.size",
    type: "dimension",
    doc: "The size a caption reads at.",
    fallback: "font.size.sm",
  },
  {
    element: "figcaption",
    field: "weight",
    path: "font.element.figcaption.weight",
    type: "fontWeight",
    doc: "The weight a caption reads at.",
    fallback: "font.weight.regular",
  },
] as const satisfies readonly ElementTypeDeclaration[];

/** The paths of every per-element typography token. */
export type ElementTypePath = (typeof ELEMENT_TYPE_ROLES)[number]["path"];

/** The declaration for one path, when there is one. */
export function elementTypeRole(
  path: string,
): ElementTypeDeclaration | undefined {
  return ELEMENT_TYPE_ROLES.find((role) => role.path === path);
}

/** The paths of every per-element typography token. */
export function elementTypePaths(): readonly string[] {
  return ELEMENT_TYPE_ROLES.map((role) => role.path);
}

/**
 * The global path a token falls back to when a theme omits it.
 *
 * The fallback is a fact about the contract, not about one rule: a heading's
 * size falls back to the ladder's step wherever the heading is drawn, so the
 * answer is asked of the theme once and read by every rule.
 */
export function elementTypeFallback(path: string): string | undefined {
  return elementTypeRole(path)?.fallback;
}

/** The three decisions one element may state, keyed by field. */
export type ElementTypeFields = Readonly<
  Record<ElementTypeField, ElementTypeDeclaration | undefined>
>;

/** The decisions one element may state, with their fallbacks. */
export function elementTypeFields(element: string): ElementTypeFields {
  const find = (field: ElementTypeField) =>
    ELEMENT_TYPE_ROLES.find((role) =>
      role.element === element && role.field === field
    );
  return {
    family: find("family"),
    size: find("size"),
    weight: find("weight"),
  };
}

/**
 * The elements the per-element typography is about, in the order they read.
 *
 * The order is the order the roles are declared in, so the map a studio draws
 * and the contract a theme reads are the same list.
 */
export function elementTypeElements(): readonly string[] {
  const out: string[] = [];
  for (const role of ELEMENT_TYPE_ROLES) {
    if (!out.includes(role.element)) out.push(role.element);
  }
  return out;
}
