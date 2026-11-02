/**
 * The per-element token groups: the decisions a theme owns for ONE element.
 *
 * A shared scale is a decision the whole system shares — spacing, type,
 * radius, shadow. A per-element group is a decision the ELEMENT owns: the
 * card's corner, the alert's air, the field's edge, the number a stat shows,
 * the rule under a table row, the underline under a link. They exist so a
 * primitive can be styled independently of the scales it otherwise wears,
 * and they are supported only where that independence means something: a
 * group nothing spends is a lie, and a token that restates a scale step is a
 * second name for it.
 *
 * Each declaration carries the path, the type, the placeholder a scaffold
 * writes, the documentation an editor shows, and the GLOBAL path a theme
 * falls back to when it omits this one. The fallback is what makes a group
 * safe to leave out: a theme that says nothing about the card's corner gets
 * the system's answer — the page's radius — and never the browser's.
 *
 * The groups are optional. A theme may declare none of them and still be a
 * complete theme; the primitives fall back to the shared scales, and the
 * stylesheet says which one it spent. A scaffold declares all of them,
 * because a scaffold is the document an author edits, and an author should
 * be shown the decisions rather than the gaps.
 */

import type { TokenType } from "../pipeline/types.ts";

/** One thing an element owns, and everything a scaffold needs to write it. */
export interface ElementDeclaration {
  /** The group the token lives in — `card`, `alert`, `field`. */
  readonly group: string;
  /** The element that spends it. The same name as the group, always. */
  readonly element: string;
  /** The dotted path, e.g. `card.radius`. */
  readonly path: string;
  readonly type: TokenType;
  /**
   * What a scaffold writes. Valid, legible, and obviously unfinished.
   *
   * A literal, never an alias: a scaffold declares no scales, so an alias
   * would point at a token the scaffold itself does not carry.
   */
  readonly value: string | number | boolean;
  readonly doc: string;
  /**
   * The global path a theme falls back to when it omits this token.
   *
   * Absent when there is no global answer to fall back to: the browser's own
   * default is the right answer for a case, a tracking and a resting
   * elevation, and the element's own ladder is the only answer for a size.
   */
  readonly fallback?: string;
}

/**
 * The per-element groups, one entry per token.
 *
 * The order is the order a reader meets them: the groups that existed, then
 * the ones the element library added. A group is here because a primitive
 * spends it — the element's own decision, and only that.
 */
export const ELEMENT_ROLES: readonly ElementDeclaration[] = [
  {
    group: "badge",
    element: "badge",
    path: "badge.edge",
    type: "dimension",
    value: "1px",
    doc: "The stroke the badge draws around itself.",
    fallback: "border.width",
  },
  {
    group: "badge",
    element: "badge",
    path: "badge.pill",
    type: "boolean",
    value: true,
    doc: "Whether the badge is a pill or a square tag.",
  },
  {
    group: "button",
    element: "button",
    path: "button.weight",
    type: "fontWeight",
    value: "600",
    doc:
      "The button's own weight: a control carries more than the prose around it.",
    fallback: "font.weight.semibold",
  },
  {
    group: "button",
    element: "button",
    path: "button.case",
    type: "textTransform",
    value: "none",
    doc: "The case a button's label is written in.",
  },
  {
    group: "button",
    element: "button",
    path: "button.tracking",
    type: "dimension",
    value: "0em",
    doc: "The tracking of a button's label.",
  },
  {
    group: "button",
    element: "button",
    path: "button.shadow",
    type: "shadow",
    value: "none",
    doc: "The elevation a button rests at.",
  },
  {
    group: "button",
    element: "button",
    path: "button.shadow-hover",
    type: "shadow",
    value: "none",
    doc: "The elevation a button lifts to when it is touched.",
  },
  {
    group: "button",
    element: "button",
    path: "button.edge",
    type: "color",
    value: "#e5e5e5",
    doc: "The ink a button frames itself in; both variants share it.",
    fallback: "color.border",
  },
  {
    group: "checkbox",
    element: "checkbox",
    path: "checkbox.depth",
    type: "number",
    value: 1.5,
    doc: "How physical a checkbox is: one scalar driving three inset shadows.",
  },
  {
    group: "switch",
    element: "switch",
    path: "switch.depth",
    type: "number",
    value: 1.5,
    doc: "How physical a switch is: one scalar driving three inset shadows.",
  },
  {
    group: "icon",
    element: "icon",
    path: "icon.sm",
    type: "dimension",
    value: "0.875em",
    doc:
      "The smallest glyph step, in `em` so it tracks the control it sits in.",
  },
  {
    group: "icon",
    element: "icon",
    path: "icon.md",
    type: "dimension",
    value: "1em",
    doc: "The default glyph step.",
  },
  {
    group: "icon",
    element: "icon",
    path: "icon.lg",
    type: "dimension",
    value: "1.25em",
    doc: "The largest glyph step.",
  },
  {
    group: "card",
    element: "card",
    path: "card.radius",
    type: "dimension",
    value: "0.5rem",
    doc:
      "The card's own corner. A card is not a button and need not round the same way.",
    fallback: "radius.md",
  },
  {
    group: "card",
    element: "card",
    path: "card.padding",
    type: "dimension",
    value: "1rem",
    doc: "The air inside the card, between its parts and around its edge.",
    fallback: "spacing.4",
  },
  {
    group: "card",
    element: "card",
    path: "card.border",
    type: "color",
    value: "#e5e5e5",
    doc: "The ink of the card's own edge, when it draws one.",
    fallback: "color.border",
  },
  {
    group: "card",
    element: "card",
    path: "card.elevation",
    type: "shadow",
    value: "none",
    doc:
      "The elevation the card rests at. A card that sits on the page says so.",
    fallback: "shadow.md",
  },
  {
    group: "alert",
    element: "alert",
    path: "alert.radius",
    type: "dimension",
    value: "0.5rem",
    doc: "The alert's own corner.",
    fallback: "radius.md",
  },
  {
    group: "alert",
    element: "alert",
    path: "alert.padding",
    type: "dimension",
    value: "0.5rem",
    doc: "The air above and below the alert's text.",
    fallback: "spacing.2",
  },
  {
    group: "alert",
    element: "alert",
    path: "alert.padding-inline",
    type: "dimension",
    value: "1rem",
    doc: "The air beside the alert's text, where the message is read.",
    fallback: "spacing.4",
  },
  {
    group: "alert",
    element: "alert",
    path: "alert.edge",
    type: "color",
    value: "#e5e5e5",
    doc: "The ink of the hairline the alert wears on every side.",
    fallback: "color.border",
  },
  {
    group: "field",
    element: "field",
    path: "field.radius",
    type: "dimension",
    value: "0.5rem",
    doc: "The field's own corner.",
    fallback: "radius.md",
  },
  {
    group: "field",
    element: "field",
    path: "field.border",
    type: "color",
    value: "#999999",
    doc: "The ink of the field's own edge: the line a finger has to find.",
    fallback: "color.border-strong",
  },
  {
    group: "stat",
    element: "stat",
    path: "stat.value-size",
    type: "dimension",
    value: "1.5rem",
    doc: "The size of the number a stat shows.",
    fallback: "font.size.2xl",
  },
  {
    group: "stat",
    element: "stat",
    path: "stat.value-weight",
    type: "fontWeight",
    value: "600",
    doc: "The weight of the number a stat shows.",
    fallback: "font.weight.semibold",
  },
  {
    group: "stat",
    element: "stat",
    path: "stat.value-family",
    type: "fontFamily",
    value: "ui-monospace, SFMono-Regular, Menlo, monospace",
    doc:
      "The face the number a stat shows is set in: a figure is a figure, and the mono is the face that carries figures.",
    fallback: "font.family.mono",
  },
  {
    group: "table",
    element: "table",
    path: "table.header-weight",
    type: "fontWeight",
    value: "600",
    doc: "The weight of a column's heading.",
    fallback: "font.weight.semibold",
  },
  {
    group: "table",
    element: "table",
    path: "table.rule",
    type: "color",
    value: "#e5e5e5",
    doc: "The ink of the rule under a row.",
    fallback: "color.border",
  },
  {
    group: "table",
    element: "table",
    path: "table.zebra",
    type: "color",
    value: "#f0f0f0",
    doc: "The fill a striped row wears.",
    fallback: "color.surface-sunken",
  },
  {
    group: "link",
    element: "link",
    path: "link.underline",
    type: "dimension",
    value: "0.0625em",
    doc:
      "The thickness of the rule under a link. Zero marks the link by colour alone.",
  },
];

/** The paths of every per-element token. */
export function elementPaths(): readonly string[] {
  return ELEMENT_ROLES.map((role) => role.path);
}

/** The declaration for one path, when there is one. */
export function elementRole(path: string): ElementDeclaration | undefined {
  return ELEMENT_ROLES.find((role) => role.path === path);
}

/**
 * The global path a token falls back to when a theme omits it.
 *
 * The fallback is a fact about the contract, not about one rule: the card's
 * corner falls back to the page's radius wherever the card is drawn, so the
 * answer is asked of the theme once and read by every rule.
 */
export function elementFallback(path: string): string | undefined {
  return elementRole(path)?.fallback;
}
