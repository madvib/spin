/**
 * Primitives manifest — each component's contract with the theme: `tags`,
 * `variants` and `reads` are derived from its rules by probing rule execution
 * (`deno task codegen`), `character` is authored, and `tests/manifest.test.ts`
 * fails when the checked-in file goes stale.
 */

import type { ThemeCssVar } from "@spin/theme/theme-types";
import type { TokenType } from "@spin/theme";

export interface PrimitiveContract {
  /** Bare tag names the component styles, e.g. `button`, `h1`. */
  tags: readonly string[];
  /** Class names the component defines, e.g. `secondary`. */
  variants: readonly string[];
  /**
   * The custom properties this component spends, as CSS variable NAMES:
   * `color-border`, not `--color-border` and not `border.width`.
   *
   * Typed against the union the theme package generates from the shipped
   * default theme, so a typo is a compile error rather than a declaration that
   * silently never applies — which is the failure mode this list had, four
   * separate times, each time caught by a test only after something looked
   * wrong on screen.
   *
   * The union comes from the DEFAULT theme on purpose. A component may only
   * spend a token the default states, because that is the one surface every
   * consumer is guaranteed to have; a token that exists only in one starter is
   * a token most consumers cannot use.
   */
  reads: readonly ThemeCssVar[];
  /**
   * Tokens this component needs a theme to decide — the opposite of a spent
   * scale binding. Each entry carries everything a scaffold needs to write it,
   * so the component owns its own placeholder rather than leaving the
   * composition layer to guess one. Empty when every read is a scale step.
   */
  character: readonly CharacterToken[];
}

/**
 * One theme-authored token a component declares.
 *
 * `path` is the dotted DTCG path, `type` is the closed token type it must
 * have, and `value` is the placeholder a scaffold writes — valid, legible, and
 * obviously unfinished.
 */
export interface CharacterToken {
  readonly path: string;
  readonly type: TokenType;
  readonly value: string;
}

/** The contract per component, keyed by file stem. */

export const primitiveContracts: Record<string, PrimitiveContract> = {
  a11y: {
tags: [],
  variants: ["visually-hidden"],
  reads: ["--motion-duration-fast"],
character: [],
  },
  alert: {
  tags: ["alert"],
  variants: [
    "alert-accent",
    "alert-accent-muted",
    "alert-danger",
    "alert-danger-muted",
    "alert-neutral",
    "alert-neutral-muted",
    "alert-primary",
    "alert-primary-muted",
    "alert-secondary",
    "alert-secondary-muted",
    "alert-success",
    "alert-success-muted",
    "alert-warning",
    "alert-warning-muted",
  ],
  reads: [
    "--border-width",
    "--color-accent",
    "--color-border",
    "--color-primary",
    "--color-secondary",
    "--color-semantic-error",
    "--color-semantic-success",
    "--color-semantic-warning",
    "--color-surface-raised",
    "--color-text",
    "--font-size-sm",
    "--font-weight-medium",
    "--radius-md",
    "--spacing-2",
    "--spacing-4",
  ],
character: [],
  },
  badge: {
  tags: ["badge"],
  variants: [
    "badge-accent",
    "badge-accent-muted",
    "badge-close",
    "badge-danger",
    "badge-danger-muted",
    "badge-lg",
    "badge-neutral",
    "badge-neutral-muted",
    "badge-primary",
    "badge-primary-muted",
    "badge-secondary",
    "badge-secondary-muted",
    "badge-sm",
    "badge-success",
    "badge-success-muted",
    "badge-warning",
    "badge-warning-muted",
  ],
  reads: [
    "--badge-edge",
    "--badge-radius",
    "--border-width",
    "--color-accent",
    "--color-border",
    "--color-on-accent",
    "--color-on-danger",
    "--color-on-primary",
    "--color-on-secondary",
    "--color-on-semantic-success",
    "--color-on-semantic-warning",
    "--color-primary",
    "--color-secondary",
    "--color-semantic-error",
    "--color-semantic-success",
    "--color-semantic-warning",
    "--color-surface-raised",
    "--color-text",
    "--font-size-2xs",
    "--font-size-sm",
    "--font-size-xs",
    "--font-weight-medium",
    "--radius-sm",
    "--spacing-0",
    "--spacing-1",
    "--spacing-2",
    "--spacing-4",
  ],
character: [
      // How square the pill is and how present its edge is: the decisions a
      // theme owns for its badges. Neobrut squares them off with a hard
      // border; the default keeps the pill with a hairline.
      { path: "badge.edge", type: "dimension", value: "{border.width}" },
      { path: "badge.radius", type: "dimension", value: "{radius.full}" },
  ],
  },
  button: {
  tags: ["button", "span"],
  variants: [
    "bare",
    "button-icon",
    "contrast",
    "danger",
    "ghost",
    "icon",
    "outline",
    "s-lg",
    "s-sm",
    "secondary",
  ],
  reads: [
    "--border-width",
    "--button-case",
    "--button-shadow",
    "--button-shadow-hover",
    "--button-tracking",
    "--button-weight",
    "--color-accent",
    "--color-border",
    "--color-focus-ring",
    "--color-on-danger",
    "--color-on-primary",
    "--color-primary",
    "--color-semantic-error",
    "--color-surface",
    "--color-surface-raised",
    "--color-text",
    "--focus-offset",
    "--focus-width",
    "--font-family-sans",
    "--font-size-lg",
    "--font-size-md",
    "--font-size-sm",
    "--icon-md",
    "--motion-duration-fast",
    "--motion-easing-standard",
    "--radius-md",
    "--spacing-1",
    "--spacing-2",
    "--spacing-4",
    "--spacing-8",
  ],
character: [
      // The test: a token is worth its place only when the component spends
      // it unconditionally and no global scale step serves it — a global
      // would have to mean "control", not "everything".
      //
      // weight, case, tracking — the button's type, spent in the base rule
      // always. The type scale could name them, but "my buttons are bold and
      // my prose is not" is a real product need, so the button keeps its own
      // say.
      { path: "button.weight", type: "fontWeight", value: "600" },
      { path: "button.case", type: "textTransform", value: "none" },
      { path: "button.tracking", type: "dimension", value: "0em" },
      // shadow, shadow-hover — the resting and the hovered elevation, both
      // spent always. Neobrut steps 4px to 6px and light steps none to a soft
      // shadow, so the hover elevation is a distinct product decision no
      // global shadow step serves; dropping it would flatten both themes'
      // hover feedback.
      { path: "button.shadow", type: "shadow", value: "none" },
      { path: "button.shadow-hover", type: "shadow", value: "none" },
      // border-width — gone. The shared border.width scale already claims
      // every control ("a theme changes its edge weight in one place"), and
      // card, content and group read it directly; the button does too now, so
      // the token only duplicated the scale.
      //
      // hover-lift-x, hover-lift-y — gone. The lift is opt-in motion with a
      // well-defined default: the stylesheet reads the variables with a
      // no-movement fallback, so a silent theme gets no transform (what
      // declaring 0 bought), and a theme that wants a lift — neobrut — states
      // the tokens in its document, where the preflight emits them.
    ],
  },
  card: {
  tags: [
    "card",
    "card-action",
    "card-content",
    "card-description",
    "card-footer",
    "card-header",
    "card-title",
  ],
  variants: ["card-default", "card-narrow", "card-wide"],
  reads: [
    "--border-width",
    "--color-border",
    "--color-surface-raised",
    "--color-text",
    "--color-text-muted",
    "--font-size-lg",
    "--font-size-sm",
    "--font-weight-semibold",
    "--radius-lg",
    "--shadow-lg",
    "--spacing-4",
  ],
character: [],
  },
  checkbox: {
  tags: ["checkbox", "input"],
variants: [],
  reads: [
    "--border-width",
    "--checkbox-depth",
    "--color-border",
    "--color-focus-ring",
    "--color-on-primary",
    "--color-primary",
    "--color-text",
    "--focus-offset",
    "--focus-width",
    "--motion-duration-fast",
    "--motion-easing-standard",
    "--radius-sm",
    "--spacing-4",
  ],
character: [
      // How physical the box is: one scalar drives three inset shadows. The
      // checkbox's own, not a group's, because a theme that wants this control
      // flat and another raised should be able to say so.
      { path: "checkbox.depth", type: "number", value: "1" },
    ],
  },
  details: {
  tags: ["details", "summary"],
variants: [],
  reads: [
    "--border-width",
    "--color-border",
    "--color-surface-raised",
    "--color-text",
    "--color-text-muted",
    "--focus-offset",
    "--font-weight-semibold",
    "--motion-duration-fast",
    "--motion-easing-standard",
    "--radius-md",
    "--spacing-2",
  ],
character: [],
  },
  dialog: {
  tags: ["dialog", "footer", "h1", "h2", "h3", "header"],
variants: [],
  reads: [
    "--border-width",
    "--color-border",
    "--color-surface-raised",
    "--color-text",
    "--motion-duration-fast",
    "--motion-easing-standard",
    "--radius-lg",
    "--shadow-lg",
    "--spacing-2",
    "--spacing-4",
  ],
character: [],
  },
  group: {
  tags: ["badge", "button", "input", "select", "textarea"],
variants: [],
  reads: ["--border-width", "--radius-md"],
character: [],
  },
  icon: {
tags: [],
  variants: ["icon-lg", "icon-md", "icon-sm"],
  reads: ["--icon-lg", "--icon-md", "--icon-sm"],
character: [
      // The glyph size, in `em` so it scales with the control it sits in: the
      // icon class from preset-icons sizes itself `1em`, and a theme states
      // the multiplier. `md` is the default the button's slot spends; `sm`
      // and `lg` are the steps an author writes beside it. A theme that
      // omits the group gets no declaration and the glyph falls back to the
      // inherited size.
      { path: "icon.sm", type: "dimension", value: "0.875em" },
      { path: "icon.md", type: "dimension", value: "1em" },
      { path: "icon.lg", type: "dimension", value: "1.25em" },
    ],
  },
  input: {
  tags: ["fieldset", "input", "label", "legend", "select", "textarea"],
variants: [],
  reads: [
    "--border-width",
    "--color-border",
    "--color-border-strong",
    "--color-field",
    "--color-focus-ring",
    "--color-primary",
    "--color-semantic-error",
    "--color-semantic-success",
    "--color-text",
    "--color-text-muted",
    "--focus-width",
    "--font-family-sans",
    "--font-size-md",
    "--motion-duration-fast",
    "--motion-easing-standard",
    "--radius-md",
    "--spacing-2",
  ],
character: [],
  },
  popover: {
  tags: ["popover", "tooltip"],
variants: [],
  reads: [
    "--border-width",
    "--color-border",
    "--color-surface-raised",
    "--color-text",
    "--font-size-xs",
    "--motion-duration-base",
    "--motion-easing-standard",
    "--radius-lg",
    "--radius-sm",
    "--shadow-lg",
    "--shadow-sm",
    "--spacing-1",
    "--spacing-2",
    "--spacing-4",
    "--z-index-dropdown",
  ],
character: [],
  },
  progress: {
  tags: ["meter", "progress"],
  variants: ["progress-indeterminate"],
  reads: [
    "--color-primary",
    "--color-semantic-error",
    "--color-semantic-warning",
    "--color-surface-raised",
    "--motion-duration-fast",
    "--radius-full",
    "--spacing-1",
  ],
character: [],
  },
  prose: {
  tags: [
    "a",
    "abbr",
    "b",
    "blockquote",
    "body",
    "canvas",
    "code",
    "dd",
    "del",
    "dl",
    "dt",
    "embed",
    "figcaption",
    "figure",
    "footer",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "hr",
    "iframe",
    "img",
    "ins",
    "kbd",
    "li",
    "mark",
    "object",
    "ol",
    "p",
    "pre",
    "prose",
    "samp",
    "small",
    "strong",
    "sub",
    "sup",
    "svg",
    "ul",
    "video",
  ],
variants: [],
  reads: [
    "--border-width",
    "--color-accent",
    "--color-border",
    "--color-focus-ring",
    "--color-link",
    "--color-semantic-error",
    "--color-semantic-success",
    "--color-surface",
    "--color-surface-raised",
    "--color-text",
    "--color-text-muted",
    "--focus-offset",
    "--focus-width",
    "--font-family-mono",
    "--font-size-2xl",
    "--font-size-3xl",
    "--font-size-lg",
    "--font-size-md",
    "--font-size-sm",
    "--font-size-xl",
    "--font-size-xs",
    "--font-weight-bold",
    "--font-weight-semibold",
    "--radius-md",
    "--radius-sm",
    "--spacing-1",
    "--spacing-2",
    "--spacing-4",
  ],
character: [],
  },
  radio: {
  tags: ["input", "radio"],
variants: [],
  reads: [
    "--border-width",
    "--color-border",
    "--color-field",
    "--color-focus-ring",
    "--color-primary",
    "--focus-offset",
    "--focus-width",
    "--motion-duration-fast",
    "--motion-easing-standard",
    "--spacing-4",
  ],
character: [],
  },
  select: {
  tags: ["input", "select", "textarea"],
variants: [],
  reads: [
    "--border-width",
    "--color-border",
    "--color-border-strong",
    "--color-field",
    "--color-focus-ring",
    "--color-primary",
    "--color-semantic-error",
    "--color-semantic-success",
    "--color-text",
    "--color-text-muted",
    "--focus-width",
    "--font-family-sans",
    "--font-size-md",
    "--motion-duration-fast",
    "--motion-easing-standard",
    "--radius-md",
    "--spacing-2",
  ],
character: [],
  },
  switch: {
  tags: ["input", "switch"],
variants: [],
  reads: [
    "--border-width",
    "--color-border",
    "--color-on-primary",
    "--color-primary",
    "--color-surface-raised",
    "--color-text",
    "--color-text-muted",
    "--motion-duration-fast",
    "--motion-easing-standard",
    "--radius-full",
    "--radius-md",
    "--spacing-4",
    "--switch-depth",
  ],
character: [
      { path: "switch.depth", type: "number", value: "1" },
    ],
  },
  table: {
  tags: ["caption", "table", "tbody", "td", "tfoot", "th", "thead"],
  variants: ["striped"],
  reads: [
    "--border-width",
    "--color-border",
    "--color-surface-raised",
    "--color-text",
    "--color-text-muted",
    "--font-family-sans",
    "--font-size-md",
    "--font-size-sm",
    "--font-size-xs",
    "--font-weight-semibold",
    "--spacing-2",
  ],
character: [],
  },
  tabs: {
  tags: ["div", "input", "label", "section", "tabs"],
  variants: ["tabs-vertical"],
  reads: [
    "--border-width",
    "--color-focus-ring",
    "--color-primary",
    "--color-text",
    "--color-text-muted",
    "--focus-offset",
    "--focus-width",
    "--font-weight-medium",
    "--font-weight-semibold",
    "--motion-duration-fast",
    "--motion-easing-standard",
    "--spacing-0",
    "--spacing-1",
    "--spacing-2",
    "--spacing-4",
  ],
character: [],
  },
  textarea: {
  tags: ["input", "select", "textarea"],
variants: [],
  reads: [
    "--border-width",
    "--color-border",
    "--color-border-strong",
    "--color-field",
    "--color-focus-ring",
    "--color-primary",
    "--color-semantic-error",
    "--color-semantic-success",
    "--color-text",
    "--color-text-muted",
    "--focus-width",
    "--font-family-sans",
    "--font-size-md",
    "--motion-duration-fast",
    "--motion-easing-standard",
    "--radius-md",
    "--spacing-16",
    "--spacing-2",
    "--spacing-4",
  ],
character: [],
  },
};


/* --------------------------------------------------------------- readers --

/**
 * A component's contract with its name attached.
 *
 * The join the studio and the lint read: `tags` is what the component claims,
 * and `name` is which one. It used to carry a stylesheet too, and stopped the
 * moment every primitive became a rule — there is nothing left to carry.
 */
export interface PrimitiveComponent extends PrimitiveContract {
  readonly name: string;
}

/** Every component's contract, keyed by name. Joined once at module load. */
export const primitiveComponents: Record<string, PrimitiveComponent> = Object
  .fromEntries(
    Object.entries(primitiveContracts).map(([name, contract]) => [
      name,
      { ...contract, name },
    ]),
  );


/**
 * Tags any component owns. A utility class on one of these is a conflict,
 * because the component already decides how that element looks.
 */
export function claimedElements(): Set<string> {
  const out = new Set<string>();
  for (const component of Object.values(primitiveContracts)) {
    for (const tag of component.tags) out.add(tag);
  }
  return out;
}

/** Every class name the primitives define, across all components. */
export function primitiveVariants(): Set<string> {
  const out = new Set<string>();
  for (const component of Object.values(primitiveContracts)) {
    for (const variant of component.variants) out.add(variant);
  }
  return out;
}

/**
 * Custom properties the primitives read, grouped by the top-level token
 * group they belong to (`button`, `color`, `font`, ...).
 */
export function primitiveReadsByGroup(): Record<string, string[]> {
  const out: Record<string, Set<string>> = {};
  for (const component of Object.values(primitiveContracts)) {
    for (const token of component.reads) {
      const [group, ...rest] = token.split("-");
      // A multi-segment name like `on-primary` belongs to the group that
      // precedes it; a single-segment name like `white` has no group.
      const key = rest.length > 0 ? group : "color";
      (out[key] ??= new Set<string>()).add([key, ...rest].join("-"));
    }
  }
  return Object.fromEntries(
    Object.entries(out).map(([k, v]) => [k, [...v].sort()]),
  );
}

