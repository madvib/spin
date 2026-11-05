/**
 * The named-type typography: the styles a theme declares.
 *
 * A shared scale is a decision the whole system shares — spacing, type,
 * radius, shadow. A named STYLE is a complete tuple the theme declares under
 * `font.style.<name>`: the face, the size, the weight, the tracking, the
 * leading, and the ink. Elements read styles by default (see
 * `ELEMENT_STYLE_DEFAULTS` below); authors change style by changing element
 * or by attaching another declared style — never by per-field element
 * overrides, which TYPE-c deleted.
 *
 * The styles are REQUIRED (see the floor below); the scales are the style
 * author's library — styles alias `{font.size.md}` instead of writing
 * `1rem` fourteen times. A theme with literal-valued styles and no scales
 * is complete.
 *
 * The style paths are `font.style.<name>.<field>`; a style's fields are
 * aliases into the scales the tuple is built from, so moving a step moves
 * every style built from it.
 */


/**
 * What one named style is made of.
 *
 * The complete tuple: the face, the size, the weight, the tracking, the
 * leading, and the ink. Every field is an alias into the scale it is built
 * from, so the tuple never drifts from the ladders.
 */
export type NamedStyleField =
  | "family"
  | "size"
  | "weight"
  | "tracking"
  | "leading"
  | "ink";

/**
 * The global paths a per-element decision falls back to.
 *
 * The ladder's steps, the family's slots, the weights, the tracking ramp
 * and the leading ramp — the vocabulary the system already has. A fallback
 * outside this set is a path the theme language does not have, and the type
 * says so at compile time.
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
  | "font.weight.bold"
  | "font.tracking.tighter"
  | "font.tracking.tight"
  | "font.tracking.normal"
  | "font.tracking.wide"
  | "font.tracking.wider"
  | "font.tracking.widest"
  | "font.leading.none"
  | "font.leading.tight"
  | "font.leading.snug"
  | "font.leading.normal"
  | "font.leading.relaxed"
  | "font.leading.loose";

/** The element a named style is the default for, when it is one. */
export type StyleDefaultElement =
  | "h1"
  | "h2"
  | "h3"
  | "h4"
  | "h5"
  | "h6"
  | "p"
  | "blockquote"
  | "code"
  | "small"
  | "strong"
  | "a"
  | "figcaption";

/** One named style the starters ship, and the element it styles by default. */
export interface NamedStyleDeclaration {
  /** The style's name: `body`, `display`, `caption`. */
  readonly name: string;
  /** The element that reads this style unless the theme says otherwise. */
  readonly element?: StyleDefaultElement;
  /** What the style is for, in the words an editor shows. */
  readonly doc: string;
}

/**
 * The styles a theme owes: the floor every starter implements.
 *
 * The names are stable API — a theme that renames one breaks every consumer
 * of that name — so trimming below this set fails completeness. The tuple
 * each name carries is the theme's own: shared keys, free values.
 */
export const STYLE_FLOOR: readonly NamedStyleDeclaration[] = [
  { name: "display", element: "h1", doc: "The display voice: the largest statement a page makes." },
  { name: "title", element: "h2", doc: "The title voice: a section head, sized to be found." },
  { name: "heading", element: "h3", doc: "The heading voice: a subsection head inside a section." },
  { name: "subtitle", doc: "The subtitle voice: the sentence under a heading that frames what follows." },
  { name: "lead", doc: "The lead voice: the sentence that introduces what follows." },
  { name: "body", element: "p", doc: "The body voice: the default reading text." },
  { name: "quote", element: "blockquote", doc: "The quotation voice: long-form editorial text set apart." },
  { name: "code", element: "code", doc: "The code voice: machine text at a size that sits beside prose." },
  { name: "link", element: "a", doc: "The link voice: a run of body text that reads as a control." },
  { name: "label", element: "h4", doc: "The label voice: the name on a control or a field." },
  { name: "caption", element: "small", doc: "The caption voice: small print under a figure or a table." },
  { name: "overline", element: "h5", doc: "The overline voice: an eyebrow or category mark above copy." },
  { name: "stat", doc: "The stat voice: the number a figure shows, set to be read at a glance." },
  { name: "badge", doc: "The badge voice: the word on a pill, set small enough to sit inside one." },
  { name: "body-strong", element: "strong", doc: "The strong voice: body copy with emphasis." },
  { name: "caption-strong", element: "figcaption", doc: "The figure-caption voice: a caption that names its figure." },
  { name: "stat-label", doc: "The stat-label voice: the name above a figure, tracked open so it reads as a label." },
  { name: "card-title", doc: "The card-title voice: the name on a card, set to be found inside a surface." },
];

/** The floor names, in the order the starters state them. */
export function styleFloorNames(): readonly string[] {
  return STYLE_FLOOR.map((style) => style.name);
}

/** The fields every floor style carries: the complete tuple. */
export function styleFloorFields(): readonly NamedStyleField[] {
  return ["family", "size", "weight", "tracking", "leading"];
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


/** The style an element reads by default.
 *
 * Stated once so the guide, the rules and the lint cannot disagree: a
 * heading reads the display style, a paragraph the body, code the code
 * style, and the small label the caption. A theme moves an element by
 * attaching another declared style or declaring a new one — never by
 * per-field element overrides, which TYPE-c deleted.
 *
 * This stays in core for web; the move to a platform-mapping layer (iOS
 * largeTitle to display and the like) is future work, not this stage.
 */
export const ELEMENT_STYLE_DEFAULTS: Readonly<Record<string, string>> = {
  h1: "display",
  h2: "title",
  h3: "heading",
  h4: "label",
  h5: "overline",
  h6: "overline",
  p: "body",
  blockquote: "quote",
  code: "code",
  small: "caption",
  strong: "body-strong",
  a: "link",
  figcaption: "caption-strong",
};

/** The named style an element reads unless the theme says otherwise. */
export function elementStyleDefault(element: string): string | undefined {
  return ELEMENT_STYLE_DEFAULTS[element];
}

/** The elements that read a named style by default, in reading order. */
export function elementStyleElements(): readonly string[] {
  return Object.keys(ELEMENT_STYLE_DEFAULTS);
}
