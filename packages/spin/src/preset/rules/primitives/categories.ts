/**
 * The taxonomy of the element library: the group an element sits in, and the
 * glyph it wears.
 *
 * A group is what the thing is FOR. A letter bucket is a filing convention,
 * not a way to find anything: people look for the control they want —
 * something to type into, something to click — not for the first letter of
 * its name. So every element sits in the group whose purpose it serves, and
 * the groups are read in the order a reader arrives in.
 *
 * It lives here, beside the rules, because it is a fact about the ELEMENTS
 * and not about the app that draws them. The studio's rail, the reference
 * app's rail and the docs' gallery read this one taxonomy, so none of them
 * can file an element somewhere another one files it elsewhere.
 *
 * The glyph is the WHOLE class, name included. The icon preset generates a
 * rule for every name that is written down and for no name that is joined at
 * runtime, so `i-lucide-${name}` styles nothing — the classes are written
 * out here, once, and every consumer spends the same ones.
 */

/** One group of the library. */
export interface PrimitiveCategory {
  /** The group's name, as a consumer keys it. */
  readonly id: string;
  /** The group's title, as a reader reads it. */
  readonly label: string;
}

/**
 * The groups, in the order a rail reads them.
 *
 * The order is the order a reader arrives in: what you can do, what you can
 * type into, what things sit in, what they look like, what they say, and
 * how they are written.
 */
export const PRIMITIVE_CATEGORIES: readonly PrimitiveCategory[] = [
  { id: "actions", label: "Actions" },
  { id: "inputs", label: "Inputs" },
  { id: "containers", label: "Containers & layout" },
  { id: "display", label: "Display" },
  { id: "feedback", label: "Feedback & status" },
  { id: "typography", label: "Typography" },
];

/** One element: where it sits, and what it wears. */
export interface PrimitiveElement {
  /** The element's name, as the library lists it. */
  readonly name: string;
  /** The group it sits in — one of {@link PRIMITIVE_CATEGORIES}. */
  readonly category: string;
  /** The glyph it wears: the whole class, name included. */
  readonly icon: string;
}

/**
 * Every element, in the order a rail reads them: the groups in their order,
 * and the elements within each group.
 *
 * The order inside a group is a reading order, not an alphabetical one: a
 * rail that filed its rows by name made the reader learn the filing before
 * they could find anything, and the row they wanted was somewhere in the
 * middle of it.
 *
 * `field` is the family the input and the textarea share — one rule family,
 * two elements — so it is filed with the inputs even though it is not a row
 * of its own.
 */
export const PRIMITIVE_ELEMENTS: readonly PrimitiveElement[] = [
  { name: "button", category: "actions", icon: "i-lucide-mouse-pointer-click" },
  { name: "breadcrumbs", category: "actions", icon: "i-lucide-chevron-right" },
  { name: "join", category: "actions", icon: "i-lucide-rows-3" },
  { name: "kbd", category: "actions", icon: "i-lucide-keyboard" },
  { name: "checkbox", category: "inputs", icon: "i-lucide-square-check" },
  { name: "radio", category: "inputs", icon: "i-lucide-circle-dot" },
  { name: "switch", category: "inputs", icon: "i-lucide-toggle-right" },
  { name: "field", category: "inputs", icon: "i-lucide-form" },
  { name: "input", category: "inputs", icon: "i-lucide-text-cursor-input" },
  { name: "textarea", category: "inputs", icon: "i-lucide-text-cursor" },
  { name: "meter", category: "inputs", icon: "i-lucide-gauge" },
  { name: "label", category: "inputs", icon: "i-lucide-tag" },
  { name: "card", category: "containers", icon: "i-lucide-square" },
  { name: "dialog", category: "containers", icon: "i-lucide-message-square" },
  { name: "details", category: "containers", icon: "i-lucide-list" },
  { name: "fieldset", category: "containers", icon: "i-lucide-boxes" },
  { name: "hr", category: "containers", icon: "i-lucide-minus" },
  { name: "panel", category: "containers", icon: "i-lucide-panel-top" },
  { name: "table", category: "display", icon: "i-lucide-table-2" },
  { name: "stat", category: "display", icon: "i-lucide-sigma" },
  { name: "alert", category: "feedback", icon: "i-lucide-triangle-alert" },
  { name: "badge", category: "feedback", icon: "i-lucide-badge-check" },
  { name: "swatch", category: "display", icon: "i-lucide-palette" },
  { name: "progress", category: "feedback", icon: "i-lucide-loader" },
  { name: "skeleton", category: "feedback", icon: "i-lucide-square-dashed" },
  { name: "tooltip", category: "feedback", icon: "i-lucide-message-circle" },
  { name: "prose", category: "typography", icon: "i-lucide-whole-word" },
  { name: "typography", category: "typography", icon: "i-lucide-type" },
  { name: "icon", category: "typography", icon: "i-lucide-image" },
];

/**
 * An element's group and glyph, or `undefined` when the taxonomy does not
 * know the name.
 *
 * The lookup a consumer makes per row, so it is a map rather than a scan.
 */
const BY_NAME: ReadonlyMap<string, PrimitiveElement> = new Map(
  PRIMITIVE_ELEMENTS.map((element) => [element.name, element]),
);

/** The element of that name, or `undefined` when there is none. */
export function elementNamed(name: string): PrimitiveElement | undefined {
  return BY_NAME.get(name);
}

/**
 * The elements of one group, in the order the taxonomy files them.
 *
 * The order of {@link PRIMITIVE_ELEMENTS} is the reading order, and a filter
 * keeps it — so a group reads the same way in every consumer.
 */
export function elementsOf(category: string): readonly PrimitiveElement[] {
  return PRIMITIVE_ELEMENTS.filter((element) => element.category === category);
}
