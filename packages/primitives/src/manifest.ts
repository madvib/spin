/**
 * Primitives manifest — the contract the CSS owns, written down.
 *
 * Previously derived at module scope by parsing the stylesheets with postcss.
 * That put a CSS parser in the shipped graph for what is really an authoring
 * fact: when someone writes a new selector they know whether it claims an
 * element or defines a variant. This file is that knowledge, beside the CSS
 * instead of extracted from it. `tags` and `character` stay authored;
 * `variants` and `reads` are derived from the CSS by `codegen.ts`, and
 * `primitives.test.ts` fails the suite when the checked-in file disagrees
 * with a fresh derive.
 *
 * `tags` are bare elements the component styles; a utility class on one is a
 * conflict, enforced by the lint plugin. `variants` are the classes an author
 * may write. `reads` are the custom properties the CSS consumes, without the
 * leading `--`; every entry must resolve against the theme contract.
 */

import type { TokenType } from "@spin/theme";

export interface PrimitiveContract {
  /** Bare tag names the component styles, e.g. `button`, `h1`. */
  tags: readonly string[];
  /** Class names the component defines, e.g. `secondary`. */
  variants: readonly string[];
  /** Custom properties the stylesheet reads, without the leading `--`. */
  reads: readonly string[];
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
  button: {
  tags: ["button", "span"],
  variants: [
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
    "button-border-width",
    "button-case",
    "button-hover-lift-x",
    "button-hover-lift-y",
    "button-shadow",
    "button-shadow-hover",
    "button-tracking",
    "button-weight",
    "color-border",
    "color-focus-ring",
    "color-on-danger",
    "color-on-primary",
    "color-primary",
    "color-semantic-error",
    "color-surface",
    "color-surface-raised",
    "color-text",
    "focus-offset",
    "focus-width",
    "font-family-sans",
    "font-size-lg",
    "font-size-md",
    "font-size-sm",
    "motion-duration-fast",
    "motion-easing-standard",
    "radius-md",
    "spacing-1",
    "spacing-2",
    "spacing-4",
    "spacing-8",
  ],
character: [
      { path: "button.weight", type: "fontWeight", value: "600" },
      { path: "button.case", type: "textTransform", value: "none" },
      { path: "button.tracking", type: "dimension", value: "0em" },
      { path: "button.border-width", type: "dimension", value: "1px" },
      { path: "button.shadow", type: "shadow", value: "none" },
      { path: "button.shadow-hover", type: "shadow", value: "none" },
      { path: "button.hover-lift-x", type: "dimension", value: "0px" },
      { path: "button.hover-lift-y", type: "dimension", value: "0px" },
    ],
  },
  form: {
  tags: ["fieldset", "input", "label", "legend", "select", "textarea"],
variants: [],
  reads: [
    "border-width",
    "color-border",
    "color-focus-ring",
    "color-on-primary",
    "color-primary",
    "color-semantic-error",
    "color-semantic-success",
    "color-surface",
    "color-surface-raised",
    "color-text",
    "color-text-muted",
    "focus-offset",
    "focus-width",
    "font-family-sans",
    "font-size-md",
    "font-size-sm",
    "font-weight-medium",
    "font-weight-semibold",
    "motion-duration-fast",
    "motion-easing-standard",
    "radius-full",
    "radius-md",
    "radius-sm",
    "spacing-1",
    "spacing-16",
    "spacing-2",
    "spacing-4",
    "switch-travel",
  ],
character: [],
  },
  content: {
  tags: [
    "a",
    "abbr",
    "b",
    "blockquote",
    "body",
    "canvas",
    "caption",
    "code",
    "dd",
    "del",
    "dl",
    "dt",
    "embed",
    "figcaption",
    "figure",
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
    "samp",
    "small",
    "strong",
    "sub",
    "sup",
    "svg",
    "table",
    "td",
    "tfoot",
    "th",
    "ul",
    "video",
  ],
  variants: ["striped"],
  reads: [
    "border-width",
    "color-accent",
    "color-border",
    "color-focus-ring",
    "color-link",
    "color-semantic-error",
    "color-semantic-success",
    "color-surface",
    "color-surface-raised",
    "color-text",
    "color-text-muted",
    "focus-offset",
    "focus-width",
    "font-family-sans",
    "font-size-2xl",
    "font-size-3xl",
    "font-size-lg",
    "font-size-md",
    "font-size-sm",
    "font-size-xl",
    "font-size-xs",
    "font-weight-bold",
    "font-weight-semibold",
    "radius-md",
    "radius-sm",
    "spacing-1",
    "spacing-2",
    "spacing-4",
  ],
character: [],
  },
  disclosure: {
  tags: ["details", "dialog"],
variants: [],
  reads: [
    "border-width",
    "color-border",
    "color-focus-ring",
    "color-surface",
    "color-surface-raised",
    "color-text",
    "font-weight-semibold",
    "motion-duration-base",
    "motion-duration-fast",
    "motion-easing-decelerate",
    "motion-easing-standard",
    "radius-lg",
    "radius-md",
    "shadow-lg",
    "spacing-2",
    "spacing-4",
  ],
character: [],
  },
  layout: {
  tags: [
    "article",
    "aside",
    "body",
    "footer",
    "header",
    "main",
    "nav",
    "section",
  ],
  variants: ["container", "container-fluid", "overflow-auto"],
  reads: ["spacing-4"],
character: [],
  },
  nav: {
  tags: ["nav"],
variants: [],
  reads: [
    "color-text",
    "color-text-muted",
    "font-weight-semibold",
    "spacing-1",
    "spacing-2",
    "spacing-4",
  ],
character: [],
  },
  group: {
tags: [],
variants: [],
  reads: [
    "border-width",
    "color-border",
    "color-focus-ring",
    "color-surface",
    "color-text",
    "focus-width",
    "font-size-xs",
    "motion-duration-fast",
    "motion-easing-standard",
    "radius-full",
    "radius-md",
    "radius-sm",
    "spacing-1",
    "spacing-2",
  ],
character: [],
  },
  feedback: {
  tags: ["a", "progress"],
  variants: ["visually-hidden"],
  reads: [
    "color-primary",
    "color-surface-raised",
    "motion-duration-base",
    "motion-duration-fast",
    "motion-easing-standard",
    "radius-full",
    "spacing-1",
    "spacing-2",
  ],
character: [],
  },
  card: {
tags: [],
  variants: ["card"],
  reads: [
    "border-width",
    "color-border",
    "color-surface-raised",
    "radius-lg",
    "shadow-sm",
    "spacing-4",
  ],
character: [],
  },
};
