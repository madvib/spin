/**
 * Primitives manifest — each component's contract with the theme: `tags`,
 * `variants` and `reads` are derived from its rules by probing rule execution
 * (`deno task codegen`), `scope` is the claim the rules are held to plus what
 * each painted element owns, `category` and `icon` are derived from the
 * authored taxonomy, `component` is authored, and `tests/manifest.test.ts`
 * fails when the checked-in file goes stale.
 */

import type { ThemeCssVar } from "@spin/theme/theme-types";
import type { TokenType } from "@spin/theme";
import type { PrimitiveCategory, PrimitiveElement } from "./categories.ts";
import type { PrimitiveScope } from "./scope.ts";

export interface PrimitiveContract {
  /**
   * The tags the component claims, e.g. `button`, `h1`.
   *
   * DECLARED, not inferred: the scope says which elements the component
   * paints, and the codegen fails when a rule reaches outside the claim. A
   * tag list read off the rules' selector text was an artifact of how a rule
   * was written, and it became a law about what authors may write.
   */
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
   * What the component paints, and what it decides for each of them.
   *
   * The claim is authored (`scopes.ts`) and the rules are held to it; what
   * each painted element owns is observed from the rules, so the manifest
   * cannot claim a decision the rules do not make.
   */
  scope: PrimitiveScope;
  /**
   * The group this component sits in, and the glyph it wears.
   *
   * Both come from the taxonomy — the same one every rail reads — so a
   * component cannot be filed in one place and drawn in another. They are
   * absent for a contract that paints no browsable element: `a11y` is a
   * utility family, not a thing a reader browses.
   */
  category?: string;
  icon?: string;
  /**
   * Tokens this component needs a theme to decide — the opposite of a spent
   * scale binding. Each entry carries everything a scaffold needs to write it,
   * so the component owns its own placeholder rather than leaving the
   * composition layer to guess one. Empty when every read is a scale step.
   */
  component: readonly ComponentToken[];
}

/**
 * One theme-authored token a component declares.
 *
 * `path` is the dotted DTCG path, `type` is the closed token type it must
 * have, and `value` is the placeholder a scaffold writes — valid, legible, and
 * obviously unfinished.
 */
export interface ComponentToken {
  readonly path: string;
  readonly type: TokenType;
  readonly value: string;
}

/** The contract per component, keyed by file stem. */

export const primitiveContracts: Record<string, PrimitiveContract> = {
  a11y: {
    tags: [],
    variants: ["visually-hidden"],
    reads: [
      "--color-focus-ring",
      "--focus-offset",
      "--focus-width",
      "--motion-duration-fast",
    ],
    scope: {
      self: "a11y",
      paints: [],
    },
    component: [],
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
      "--alert-edge",
      "--alert-padding",
      "--alert-padding-inline",
      "--alert-radius",
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
    scope: {
      self: "alert",
      paints: [
        {
          tag: "alert",
          where: "global",
          owns: ["background", "corner", "edge", "ink", "size", "weight"],
        },
      ],
    },
    category: "feedback",
    icon: "i-lucide-triangle-alert",
    component: [
      { path: "alert.radius", type: "dimension", value: "0.5rem" },
      { path: "alert.padding", type: "dimension", value: "0.5rem" },
      { path: "alert.padding-inline", type: "dimension", value: "1rem" },
      { path: "alert.edge", type: "color", value: "#e5e5e5" },
    ],
  },
  avatar: {
    tags: ["img"],
    variants: [
      "avatar",
      "avatar-circle",
      "avatar-lg",
      "avatar-md",
      "avatar-ring",
      "avatar-sm",
      "avatar-status",
    ],
    reads: [
      "--avatar-lg",
      "--avatar-md",
      "--avatar-sm",
      "--border-width-2",
      "--color-border-strong",
      "--color-semantic-success",
      "--radius-full",
      "--radius-md",
      "--spacing-10",
      "--spacing-16",
      "--spacing-6",
    ],
    scope: {
      self: "avatar",
      paints: [
        { tag: "img", where: "descendant", owns: [] },
      ],
    },
    category: "display",
    icon: "i-lucide-circle-user",
    // The ladder is the avatar's whole palette: a face has no palette of its
    // own, and the sizes are the one set of decisions the theme owns for it.
    // Scaffolds carry the shipped defaults so a theme that never decided a
    // size gets the one the reference renders.
    component: [
      { path: "avatar.sm", type: "dimension", value: "1.5rem" },
      { path: "avatar.md", type: "dimension", value: "2.5rem" },
      { path: "avatar.lg", type: "dimension", value: "4rem" },
    ],
  },
  "avatar-group": {
    tags: [],
    variants: ["avatar-group"],
    reads: ["--avatar-md", "--border-width", "--color-surface", "--spacing-10"],
    scope: {
      self: "avatar-group",
      paints: [],
    },
    category: "display",
    icon: "i-lucide-users",
    component: [],
  },
  badge: {
    tags: ["badge"],
    variants: [
      "badge-accent",
      "badge-accent-muted",
      "badge-close",
      "badge-danger",
      "badge-danger-muted",
      "badge-info",
      "badge-info-muted",
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
      "--badge-pill",
      "--border-width",
      "--color-accent",
      "--color-border",
      "--color-on-accent",
      "--color-on-primary",
      "--color-on-secondary",
      "--color-on-semantic-error",
      "--color-on-semantic-info",
      "--color-on-semantic-success",
      "--color-on-semantic-warning",
      "--color-primary",
      "--color-secondary",
      "--color-semantic-error",
      "--color-semantic-info",
      "--color-semantic-success",
      "--color-semantic-warning",
      "--color-surface-raised",
      "--color-text",
      "--font-size-xs",
      "--font-weight-medium",
      "--radius-full",
      "--spacing-0",
      "--spacing-1",
      "--spacing-2",
      "--spacing-4",
    ],
    scope: {
      self: "badge",
      paints: [
        {
          tag: "badge",
          where: "global",
          owns: ["background", "corner", "edge", "ink", "size", "weight"],
        },
      ],
    },
    category: "feedback",
    icon: "i-lucide-badge-check",
    component: [
      // How square the pill is and how present its edge is: the decisions a
      // theme owns for its badges. Neobrut squares them off with a hard
      // border; the default keeps the pill with a hairline.
      { path: "badge.edge", type: "dimension", value: "{border.width}" },
      // The decision is the boolean, not a radius: `badge.pill` answers yes and
      // the rule computes its corner from `radius.full`; a theme that says no
      // gets the badge's own square. A component token named after a radius
      // would write a token no rule reads.
      { path: "badge.pill", type: "boolean", value: "true" },
    ],
  },
  breadcrumbs: {
    tags: ["a", "li"],
    variants: [
      "breadcrumbs",
      "breadcrumbs-arrow",
      "breadcrumbs-box",
      "breadcrumbs-list",
    ],
    reads: [
      "--border-width",
      "--color-border",
      "--color-surface-raised",
      "--color-text",
      "--color-text-muted",
      "--font-size-sm",
      "--radius-md",
      "--spacing-1",
      "--spacing-2",
    ],
    scope: {
      self: "breadcrumbs",
      paints: [
        { tag: "a", where: "descendant", owns: ["decoration", "ink"] },
        { tag: "li", where: "descendant", owns: [] },
      ],
    },
    category: "actions",
    icon: "i-lucide-chevron-right",
    component: [],
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
      "--color-disabled",
      "--color-focus-ring",
      "--color-on-accent",
      "--color-on-disabled",
      "--color-on-primary",
      "--color-on-semantic-error",
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
      "--font-weight-semibold",
      "--icon-md",
      "--motion-duration-fast",
      "--motion-easing-standard",
      "--radius-md",
      "--spacing-1",
      "--spacing-2",
      "--spacing-4",
      "--spacing-8",
    ],
    scope: {
      self: "button",
      paints: [
        {
          tag: "button",
          where: "global",
          owns: [
            "background",
            "case",
            "corner",
            "decoration",
            "edge",
            "elevation",
            "face",
            "ink",
            "size",
            "tracking",
            "weight",
          ],
        },
        {
          tag: "button",
          where: "descendant",
          owns: ["background", "corner", "edge", "ink"],
        },
        { tag: "span", where: "global", owns: [] },
      ],
    },
    category: "actions",
    icon: "i-lucide-mouse-pointer-click",
    component: [
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
      "card-figure",
      "card-footer",
      "card-header",
      "card-title",
    ],
    variants: ["card-default", "card-ghost", "card-narrow", "card-wide"],
    reads: [
      "--border-width",
      "--card-border",
      "--card-elevation",
      "--card-padding",
      "--card-radius",
      "--color-border",
      "--color-surface-raised",
      "--color-text",
      "--color-text-muted",
      "--font-size-lg",
      "--font-size-sm",
      "--font-weight-semibold",
      "--radius-md",
      "--shadow-md",
      "--spacing-4",
    ],
    scope: {
      self: "card",
      paints: [
        {
          tag: "card",
          where: "global",
          owns: ["background", "corner", "edge", "elevation"],
        },
        { tag: "card-action", where: "global", owns: [] },
        { tag: "card-content", where: "global", owns: ["ink"] },
        { tag: "card-description", where: "global", owns: ["ink", "size"] },
        { tag: "card-figure", where: "global", owns: ["edge"] },
        { tag: "card-footer", where: "global", owns: [] },
        { tag: "card-header", where: "global", owns: [] },
        { tag: "card-title", where: "global", owns: ["ink", "size", "weight"] },
      ],
    },
    category: "containers",
    icon: "i-lucide-square",
    component: [
      { path: "card.radius", type: "dimension", value: "0.5rem" },
      { path: "card.padding", type: "dimension", value: "1rem" },
      { path: "card.border", type: "color", value: "#e5e5e5" },
      { path: "card.elevation", type: "shadow", value: "none" },
    ],
  },
  checkbox: {
    tags: ["input"],
    variants: [],
    reads: [
      "--border-width",
      "--checkbox-depth",
      "--color-border",
      "--color-disabled",
      "--color-focus-ring",
      "--color-on-disabled",
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
    scope: {
      self: "checkbox",
      paints: [
        {
          tag: "input",
          where: "global",
          owns: ["background", "corner", "edge", "elevation", "ink"],
        },
      ],
    },
    category: "inputs",
    icon: "i-lucide-square-check",
    component: [
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
      "--color-focus-ring",
      "--color-surface-raised",
      "--color-surface-sunken",
      "--color-text",
      "--color-text-muted",
      "--focus-offset",
      "--focus-width",
      "--font-weight-semibold",
      "--motion-duration-base",
      "--motion-duration-fast",
      "--motion-easing-decelerate",
      "--motion-easing-standard",
      "--radius-md",
      "--radius-sm",
      "--spacing-2",
    ],
    scope: {
      self: "details",
      paints: [
        {
          tag: "details",
          where: "global",
          owns: ["background", "corner", "edge"],
        },
        {
          tag: "summary",
          where: "global",
          owns: ["background", "corner", "edge", "ink", "weight"],
        },
        { tag: "summary", where: "descendant", owns: [] },
      ],
    },
    category: "containers",
    icon: "i-lucide-list",
    component: [],
  },
  dialog: {
    tags: ["dialog", "footer", "h1", "h2", "h3", "header"],
    variants: [],
    reads: [
      "--border-width",
      "--color-border",
      "--color-scrim",
      "--color-surface-raised",
      "--color-text",
      "--motion-duration-fast",
      "--motion-easing-standard",
      "--radius-lg",
      "--shadow-lg",
      "--spacing-2",
      "--spacing-4",
    ],
    scope: {
      self: "dialog",
      paints: [
        {
          tag: "dialog",
          where: "global",
          owns: ["background", "corner", "edge", "elevation", "ink", "opacity"],
        },
        { tag: "footer", where: "descendant", owns: [] },
        { tag: "h1", where: "descendant", owns: [] },
        { tag: "h2", where: "descendant", owns: [] },
        { tag: "h3", where: "descendant", owns: [] },
        { tag: "header", where: "descendant", owns: [] },
      ],
    },
    category: "containers",
    icon: "i-lucide-message-square",
    component: [],
  },
  field: {
    tags: ["input", "select", "textarea"],
    variants: [],
    reads: [
      "--border-width",
      "--color-border",
      "--color-border-strong",
      "--color-disabled",
      "--color-field",
      "--color-focus-ring",
      "--color-on-disabled",
      "--color-primary",
      "--color-semantic-error",
      "--color-semantic-success",
      "--color-text",
      "--color-text-muted",
      "--field-border",
      "--field-radius",
      "--focus-offset",
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
    scope: {
      self: "field",
      paints: [
        {
          tag: "input",
          where: "global",
          owns: ["background", "corner", "edge", "face", "ink", "size"],
        },
        {
          tag: "select",
          where: "global",
          owns: ["background", "corner", "edge", "face", "ink", "size"],
        },
        {
          tag: "textarea",
          where: "global",
          owns: ["background", "corner", "edge", "face", "ink", "size"],
        },
      ],
    },
    category: "inputs",
    icon: "i-lucide-form",
    component: [
      { path: "field.radius", type: "dimension", value: "0.5rem" },
      { path: "field.border", type: "color", value: "#999999" },
    ],
  },
  fieldset: {
    tags: ["fieldset", "legend"],
    variants: [],
    reads: [
      "--border-width",
      "--color-border",
      "--font-size-sm",
      "--font-weight-semibold",
      "--radius-md",
      "--spacing-2",
      "--spacing-4",
    ],
    scope: {
      self: "fieldset",
      paints: [
        { tag: "fieldset", where: "global", owns: ["corner", "edge"] },
        { tag: "legend", where: "descendant", owns: ["size", "weight"] },
      ],
    },
    category: "containers",
    icon: "i-lucide-boxes",
    component: [],
  },
  group: {
    tags: ["badge", "button", "input", "select", "textarea"],
    variants: [],
    reads: ["--border-width", "--radius-md"],
    scope: {
      self: "group",
      paints: [
        { tag: "badge", where: "descendant", owns: ["corner", "edge"] },
        { tag: "button", where: "descendant", owns: ["corner", "edge"] },
        { tag: "input", where: "descendant", owns: ["corner", "edge"] },
        { tag: "select", where: "descendant", owns: ["corner", "edge"] },
        { tag: "textarea", where: "descendant", owns: ["corner", "edge"] },
      ],
    },
    category: "containers",
    icon: "i-lucide-group",
    component: [],
  },
  hr: {
    tags: ["hr"],
    variants: ["divider-dashed", "divider-vertical"],
    reads: [
      "--border-width",
      "--color-accent",
      "--color-border",
      "--color-focus-ring",
      "--color-link",
      "--color-on-accent",
      "--color-semantic-error",
      "--color-semantic-success",
      "--color-surface",
      "--color-surface-raised",
      "--color-text",
      "--color-text-muted",
      "--focus-offset",
      "--focus-width",
      "--font-family-body",
      "--font-family-heading",
      "--font-family-mono",
      "--font-family-sans",
      "--font-family-serif",
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
      "--spacing-8",
    ],
    scope: {
      self: "hr",
      paints: [
        { tag: "hr", where: "global", owns: ["edge"] },
      ],
    },
    category: "containers",
    icon: "i-lucide-minus",
    component: [],
  },
  icon: {
    tags: [],
    variants: ["icon-lg", "icon-md", "icon-sm"],
    reads: [
      "--font-size-md",
      "--font-size-sm",
      "--font-size-xl",
      "--icon-lg",
      "--icon-md",
      "--icon-sm",
    ],
    scope: {
      self: "icon",
      paints: [],
    },
    category: "typography",
    icon: "i-lucide-image",
    component: [
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
  join: {
    tags: [],
    variants: ["join", "join-item"],
    reads: ["--border-width", "--radius-md"],
    scope: {
      self: "join",
      paints: [],
    },
    category: "actions",
    icon: "i-lucide-rows-3",
    component: [],
  },
  kbd: {
    tags: ["kbd"],
    variants: [],
    reads: [
      "--border-width",
      "--color-accent",
      "--color-border",
      "--color-focus-ring",
      "--color-link",
      "--color-on-accent",
      "--color-semantic-error",
      "--color-semantic-success",
      "--color-surface",
      "--color-surface-raised",
      "--color-text",
      "--color-text-muted",
      "--focus-offset",
      "--focus-width",
      "--font-family-body",
      "--font-family-heading",
      "--font-family-mono",
      "--font-family-sans",
      "--font-family-serif",
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
    scope: {
      self: "kbd",
      paints: [
        {
          tag: "kbd",
          where: "global",
          owns: ["background", "corner", "edge", "face", "ink", "size"],
        },
      ],
    },
    category: "actions",
    icon: "i-lucide-keyboard",
    component: [],
  },
  label: {
    tags: ["label"],
    variants: [],
    reads: ["--font-family-sans", "--spacing-2"],
    scope: {
      self: "label",
      paints: [
        { tag: "label", where: "global", owns: ["face"] },
      ],
    },
    category: "inputs",
    icon: "i-lucide-tag",
    component: [],
  },
  meter: {
    tags: ["meter"],
    variants: [],
    reads: [
      "--border-width",
      "--color-border",
      "--color-field",
      "--color-semantic-error",
      "--color-semantic-success",
      "--color-semantic-warning",
      "--font-family-sans",
      "--font-size-sm",
      "--opacity-50",
      "--radius-sm",
    ],
    scope: {
      self: "meter",
      paints: [
        { tag: "meter", where: "global", owns: ["face", "opacity", "size"] },
      ],
    },
    category: "inputs",
    icon: "i-lucide-gauge",
    component: [],
  },
  mode: {
    tags: [],
    variants: ["button", "mode"],
    reads: [
      "--color-disabled",
      "--color-on-disabled",
      "--icon-md",
      "--spacing-2",
    ],
    scope: {
      self: "mode",
      paints: [],
    },
    category: "actions",
    icon: "i-lucide-sun-moon",
    component: [],
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
    scope: {
      self: "popover",
      paints: [
        {
          tag: "popover",
          where: "global",
          owns: ["background", "corner", "edge", "elevation", "ink", "opacity"],
        },
        {
          tag: "tooltip",
          where: "global",
          owns: [
            "background",
            "corner",
            "edge",
            "elevation",
            "ink",
            "opacity",
            "size",
          ],
        },
        { tag: "tooltip", where: "descendant", owns: [] },
      ],
    },
    category: "containers",
    icon: "i-lucide-message-circle",
    component: [],
  },
  progress: {
    tags: ["progress"],
    variants: ["progress-indeterminate"],
    reads: [
      "--color-primary",
      "--color-semantic-error",
      "--color-semantic-warning",
      "--color-surface-raised",
      "--radius-full",
      "--spacing-1",
    ],
    scope: {
      self: "progress",
      paints: [
        {
          tag: "progress",
          where: "global",
          owns: ["background", "corner", "elevation"],
        },
      ],
    },
    category: "feedback",
    icon: "i-lucide-loader",
    component: [],
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
      "iframe",
      "img",
      "ins",
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
      "--color-on-accent",
      "--color-semantic-error",
      "--color-semantic-success",
      "--color-surface",
      "--color-surface-raised",
      "--color-text",
      "--color-text-muted",
      "--focus-offset",
      "--focus-width",
      "--font-family-body",
      "--font-family-heading",
      "--font-family-mono",
      "--font-family-sans",
      "--font-family-serif",
      "--font-size-2xl",
      "--font-size-3xl",
      "--font-size-lg",
      "--font-size-md",
      "--font-size-sm",
      "--font-size-xl",
      "--font-size-xs",
      "--font-weight-bold",
      "--font-weight-semibold",
      "--link-underline",
      "--radius-md",
      "--radius-sm",
      "--spacing-1",
      "--spacing-2",
      "--spacing-4",
    ],
    scope: {
      self: "prose",
      paints: [
        {
          tag: "a",
          where: "global",
          owns: ["corner", "decoration", "edge", "ink"],
        },
        { tag: "abbr", where: "global", owns: ["decoration"] },
        { tag: "b", where: "global", owns: ["weight"] },
        { tag: "blockquote", where: "global", owns: ["face"] },
        {
          tag: "body",
          where: "global",
          owns: ["background", "face", "ink", "size"],
        },
        {
          tag: "code",
          where: "global",
          owns: ["background", "corner", "face", "ink", "size"],
        },
        { tag: "dd", where: "global", owns: [] },
        { tag: "dl", where: "global", owns: [] },
        { tag: "dt", where: "global", owns: ["weight"] },
        { tag: "figcaption", where: "global", owns: ["ink", "size"] },
        { tag: "figure", where: "global", owns: [] },
        {
          tag: "h1",
          where: "global",
          owns: ["face", "size", "tracking", "weight"],
        },
        {
          tag: "h2",
          where: "global",
          owns: ["face", "size", "tracking", "weight"],
        },
        { tag: "h3", where: "global", owns: ["face", "size", "weight"] },
        { tag: "h4", where: "global", owns: ["face", "size", "weight"] },
        { tag: "h5", where: "global", owns: ["face", "size", "weight"] },
        { tag: "h6", where: "global", owns: ["face", "size", "weight"] },
        { tag: "li", where: "global", owns: [] },
        { tag: "ol", where: "global", owns: [] },
        { tag: "p", where: "global", owns: [] },
        { tag: "pre", where: "global", owns: ["face"] },
        { tag: "prose", where: "global", owns: [] },
        { tag: "samp", where: "global", owns: ["face", "size"] },
        { tag: "small", where: "global", owns: ["ink", "size"] },
        { tag: "strong", where: "global", owns: ["weight"] },
        { tag: "sub", where: "global", owns: ["size"] },
        { tag: "sup", where: "global", owns: ["size"] },
        { tag: "ul", where: "global", owns: [] },
        { tag: "blockquote", where: "descendant", owns: ["edge", "ink"] },
        { tag: "canvas", where: "descendant", owns: [] },
        { tag: "code", where: "descendant", owns: ["background"] },
        { tag: "del", where: "descendant", owns: ["decoration", "ink"] },
        { tag: "embed", where: "descendant", owns: ["corner", "edge"] },
        { tag: "figcaption", where: "descendant", owns: [] },
        { tag: "figure", where: "descendant", owns: [] },
        { tag: "footer", where: "descendant", owns: ["size"] },
        { tag: "iframe", where: "descendant", owns: ["corner", "edge"] },
        { tag: "img", where: "descendant", owns: ["corner"] },
        { tag: "ins", where: "descendant", owns: ["decoration", "ink"] },
        { tag: "mark", where: "descendant", owns: ["background", "ink"] },
        { tag: "object", where: "descendant", owns: ["corner", "edge"] },
        {
          tag: "pre",
          where: "descendant",
          owns: ["background", "corner", "ink"],
        },
        { tag: "svg", where: "descendant", owns: [] },
        { tag: "video", where: "descendant", owns: ["corner"] },
      ],
    },
    category: "typography",
    icon: "i-lucide-whole-word",
    component: [],
  },
  radio: {
    tags: ["input"],
    variants: [],
    reads: [
      "--border-width",
      "--color-border",
      "--color-disabled",
      "--color-field",
      "--color-focus-ring",
      "--color-on-disabled",
      "--color-primary",
      "--focus-offset",
      "--focus-width",
      "--motion-duration-fast",
      "--motion-easing-standard",
      "--spacing-4",
    ],
    scope: {
      self: "radio",
      paints: [
        {
          tag: "input",
          where: "global",
          owns: ["background", "corner", "edge", "elevation", "ink"],
        },
      ],
    },
    category: "inputs",
    icon: "i-lucide-circle-dot",
    component: [],
  },
  range: {
    tags: ["input"],
    variants: [],
    reads: [
      "--border-width",
      "--color-border",
      "--color-border-strong",
      "--color-field",
      "--color-focus-ring",
      "--color-primary",
      "--focus-offset",
      "--focus-width",
      "--opacity-50",
      "--radius-full",
      "--spacing-3",
      "--spacing-4",
    ],
    scope: {
      self: "range",
      paints: [
        { tag: "input", where: "global", owns: ["corner", "edge", "opacity"] },
      ],
    },
    category: "inputs",
    icon: "i-lucide-slash",
    component: [],
  },
  rating: {
    tags: ["input"],
    variants: ["rating", "rating-star"],
    reads: [
      "--color-semantic-warning",
      "--color-text-muted",
      "--icon-md",
      "--spacing-1",
    ],
    scope: {
      self: "rating",
      paints: [
        { tag: "input", where: "global", owns: [] },
      ],
    },
    category: "inputs",
    icon: "i-lucide-star",
    component: [],
  },
  skeleton: {
    tags: [],
    variants: ["skeleton", "skeleton-circle", "skeleton-text"],
    reads: [
      "--avatar-md",
      "--color-field",
      "--font-size-sm",
      "--motion-duration-loop",
      "--motion-duration-slow",
      "--motion-easing-standard",
      "--radius-full",
      "--radius-sm",
      "--spacing-2",
    ],
    scope: {
      self: "skeleton",
      paints: [],
    },
    category: "feedback",
    icon: "i-lucide-square-dashed",
    component: [],
  },
  stat: {
    tags: [],
    variants: ["stat", "stat-desc", "stat-row", "stat-title", "stat-value"],
    reads: [
      "--color-text",
      "--color-text-muted",
      "--font-family-mono",
      "--font-letter-spacing-wide",
      "--font-size-2xl",
      "--font-size-sm",
      "--font-size-xs",
      "--font-weight-semibold",
      "--spacing-2",
      "--stat-value-family",
      "--stat-value-size",
      "--stat-value-weight",
    ],
    scope: {
      self: "stat",
      paints: [],
    },
    category: "display",
    icon: "i-lucide-sigma",
    component: [
      { path: "stat.value-size", type: "dimension", value: "1.5rem" },
      { path: "stat.value-weight", type: "fontWeight", value: "600" },
    ],
  },
  switch: {
    tags: ["input"],
    variants: [],
    reads: [
      "--border-width",
      "--color-border",
      "--color-disabled",
      "--color-focus-ring",
      "--color-on-disabled",
      "--color-on-primary",
      "--color-primary",
      "--color-surface-raised",
      "--color-text",
      "--color-text-muted",
      "--focus-offset",
      "--focus-width",
      "--motion-duration-fast",
      "--motion-easing-standard",
      "--radius-full",
      "--radius-md",
      "--shadow-sm",
      "--spacing-4",
    ],
    scope: {
      self: "switch",
      paints: [
        {
          tag: "input",
          where: "global",
          owns: ["background", "corner", "edge", "elevation", "ink"],
        },
      ],
    },
    category: "inputs",
    icon: "i-lucide-toggle-right",
    component: [
      { path: "switch.depth", type: "number", value: "1" },
    ],
  },
  table: {
    tags: ["caption", "table", "td", "th"],
    variants: ["striped"],
    reads: [
      "--border-width",
      "--color-border",
      "--color-surface-raised",
      "--color-surface-sunken",
      "--color-text",
      "--color-text-muted",
      "--font-family-sans",
      "--font-size-md",
      "--font-size-sm",
      "--font-size-xs",
      "--font-weight-semibold",
      "--spacing-2",
      "--table-header-weight",
      "--table-rule",
      "--table-zebra",
    ],
    scope: {
      self: "table",
      paints: [
        { tag: "caption", where: "global", owns: ["ink", "size"] },
        {
          tag: "table",
          where: "global",
          owns: ["edge", "face", "ink", "size"],
        },
        { tag: "td", where: "global", owns: ["edge"] },
        { tag: "td", where: "descendant", owns: ["edge", "weight"] },
        {
          tag: "th",
          where: "global",
          owns: ["background", "edge", "ink", "size", "weight"],
        },
        { tag: "th", where: "descendant", owns: ["edge", "weight"] },
      ],
    },
    category: "display",
    icon: "i-lucide-table-2",
    component: [
      { path: "table.header-weight", type: "fontWeight", value: "600" },
      { path: "table.rule", type: "color", value: "#e5e5e5" },
      { path: "table.zebra", type: "color", value: "#f0f0f0" },
    ],
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

/**
 * Tags that carry a visual base — the elements a primitive DECIDES the look
 * of.
 *
 * Read from the scope, and only from the elements the primitive actually
 * decides something about. A component spends a colour token for its own
 * element, and that says nothing about the elements it merely lays out: the
 * button spends colours and also joins a group of controls, and the group
 * container is laid out rather than painted. Treating every tag a component
 * mentions as painted is what made every `<span>` in every project an element
 * the button owned.
 */
export function paintedElements(): Set<string> {
  const out = new Set<string>();
  for (const component of Object.values(primitiveContracts)) {
    for (const paint of component.scope.paints) {
      if (paint.owns.length === 0) continue;
      out.add(paint.tag);
    }
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

/* --- taxonomy: generated from `categories.ts` --- */
/**
 * The taxonomy of the library: the groups, and every element's group and
 * glyph.
 *
 * DERIVED from `categories.ts`, so the manifest and the authored taxonomy
 * cannot disagree — a rail that filed an element somewhere else would be
 * reading a manifest that no longer says what the elements are.
 */
export const primitiveCategories: readonly PrimitiveCategory[] = [
  { id: "actions", label: "Actions" },
  { id: "inputs", label: "Inputs" },
  { id: "containers", label: "Containers & layout" },
  { id: "display", label: "Display" },
  { id: "feedback", label: "Feedback & status" },
  { id: "typography", label: "Typography" },
];

/**
 * Every element, in the order a rail reads them.
 */
export const primitiveElements: readonly PrimitiveElement[] = [
  { name: "button", category: "actions", icon: "i-lucide-mouse-pointer-click" },
  { name: "breadcrumbs", category: "actions", icon: "i-lucide-chevron-right" },
  { name: "join", category: "actions", icon: "i-lucide-rows-3" },
  { name: "kbd", category: "actions", icon: "i-lucide-keyboard" },
  { name: "mode", category: "actions", icon: "i-lucide-sun-moon" },
  { name: "checkbox", category: "inputs", icon: "i-lucide-square-check" },
  { name: "radio", category: "inputs", icon: "i-lucide-circle-dot" },
  { name: "switch", category: "inputs", icon: "i-lucide-toggle-right" },
  { name: "field", category: "inputs", icon: "i-lucide-form" },
  { name: "input", category: "inputs", icon: "i-lucide-text-cursor-input" },
  { name: "select", category: "inputs", icon: "i-lucide-chevron-down" },
  { name: "textarea", category: "inputs", icon: "i-lucide-text-cursor" },
  { name: "range", category: "inputs", icon: "i-lucide-slash" },
  { name: "rating", category: "inputs", icon: "i-lucide-star" },
  { name: "meter", category: "inputs", icon: "i-lucide-gauge" },
  { name: "label", category: "inputs", icon: "i-lucide-tag" },
  { name: "card", category: "containers", icon: "i-lucide-square" },
  { name: "dialog", category: "containers", icon: "i-lucide-message-square" },
  { name: "details", category: "containers", icon: "i-lucide-list" },
  { name: "popover", category: "containers", icon: "i-lucide-message-circle" },
  { name: "group", category: "containers", icon: "i-lucide-group" },
  { name: "fieldset", category: "containers", icon: "i-lucide-boxes" },
  { name: "hr", category: "containers", icon: "i-lucide-minus" },
  { name: "table", category: "display", icon: "i-lucide-table-2" },
  { name: "stat", category: "display", icon: "i-lucide-sigma" },
  { name: "avatar", category: "display", icon: "i-lucide-circle-user" },
  { name: "avatar-group", category: "display", icon: "i-lucide-users" },
  { name: "alert", category: "feedback", icon: "i-lucide-triangle-alert" },
  { name: "badge", category: "feedback", icon: "i-lucide-badge-check" },
  { name: "progress", category: "feedback", icon: "i-lucide-loader" },
  { name: "skeleton", category: "feedback", icon: "i-lucide-square-dashed" },
  {
    name: "tooltip",
    category: "feedback",
    icon: "i-lucide-message-circle-off",
  },
  { name: "prose", category: "typography", icon: "i-lucide-whole-word" },
  { name: "typography", category: "typography", icon: "i-lucide-type" },
  { name: "icon", category: "typography", icon: "i-lucide-image" },
];
