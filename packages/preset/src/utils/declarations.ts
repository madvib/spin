import {
  ALIGN_CONTENT,
  ALIGN_ITEMS,
  ALIGN_SELF,
  BORDER_STYLES,
  COLOR_KEYWORDS,
  CURSOR,
  DISPLAY_UTILITIES,
  DISPLAY_VALUES,
  FLEX_DIRECTIONS,
  FLEX_FACTORS,
  FLEX_WRAPS,
  JUSTIFY_CONTENT,
  OPACITY_UTILITIES,
  opacityValue,
  ORDER_STEPS,
  ORDER_VALUES,
  OUTLINE,
  OVERFLOW_UTILITIES,
  OVERFLOW_VALUES,
  POINTER_EVENTS,
  POSITION_UTILITIES,
  RESIZE,
  SCROLL_BEHAVIOR,
  TEXT_ALIGN,
  TEXT_DECORATION,
  TEXT_TRANSFORMS,
  TRACKING,
  TRANSITION_PROPERTY,
  USER_SELECT,
  VISIBILITY,
  WHITESPACE,
  WORD_BREAK,
} from "./vocabulary.ts";

/** Parse a declaration list into the object a rule returns. */
function cssDecl(css: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of css.split(";")) {
    const colon = part.indexOf(":");
    if (colon === -1) continue;
    out[part.slice(0, colon).trim()] = part.slice(colon + 1).trim();
  }
  return out;
}
/**
 * Assembling the vocabulary into declarations.
 *
 * Every static utility's CSS is derived from the tables in `vocabulary.ts`
 * rather than restated, so a name cannot exist here without a value and a
 * value cannot exist without a name. The generated families — grid tracks,
 * order steps — are assembled the same way as the written ones.
 */

export const STATIC_DECLS: Record<string, Record<string, string>> = {
  ...Object.fromEntries(
    Object.entries(TEXT_TRANSFORMS).map(([name, value]) => [
      name,
      { "text-transform": value },
    ]),
  ),
  ...Object.fromEntries(
    Object.entries(TRACKING).map(([name, value]) => [
      `tracking-${name}`,
      { "letter-spacing": value },
    ]),
  ),
  ...Object.fromEntries(
    Object.entries(OUTLINE).map(([name, value]) => [name, cssDecl(value)]),
  ),
  ...Object.fromEntries(
    DISPLAY_UTILITIES.map((name) => [name, { display: DISPLAY_VALUES[name] }]),
  ),
  ...Object.fromEntries(
    OPACITY_UTILITIES.map((name) => [name, { opacity: opacityValue(name) }]),
  ),
  ...Object.fromEntries(
    Object.entries(FLEX_DIRECTIONS).map(([name, value]) => [
      name,
      { "flex-direction": value },
    ]),
  ),
  ...Object.fromEntries(
    Object.entries(FLEX_WRAPS).map(([name, value]) => [
      name,
      { "flex-wrap": value },
    ]),
  ),
  ...Object.fromEntries(
    Object.entries(ALIGN_ITEMS).map(([name, value]) => [
      name,
      { "align-items": value },
    ]),
  ),
  ...Object.fromEntries(
    Object.entries(JUSTIFY_CONTENT).map(([name, value]) => [
      name,
      { "justify-content": value },
    ]),
  ),
  ...Object.fromEntries(
    Object.entries(ALIGN_CONTENT).map(([name, value]) => [
      name,
      { "align-content": value },
    ]),
  ),
  ...Object.fromEntries(
    Object.entries(ALIGN_SELF).map(([name, value]) => [
      name,
      { "align-self": value },
    ]),
  ),
  ...Object.fromEntries(
    Object.entries(FLEX_FACTORS).map(([name, value]) => {
      const prop = name.startsWith("grow")
        ? "flex-grow"
        : name.startsWith("shrink")
        ? "flex-shrink"
        : "flex";
      return [name, { [prop]: value }];
    }),
  ),
  ...Object.fromEntries(
    OVERFLOW_UTILITIES.map((name) => {
      const value = OVERFLOW_VALUES[name.split("-").at(-1) as string] as string;
      const prop = name.startsWith("overflow-x-")
        ? "overflow-x"
        : name.startsWith("overflow-y-")
        ? "overflow-y"
        : "overflow";
      return [name, { [prop]: value }];
    }),
  ),
  ...Object.fromEntries(
    Object.entries(POSITION_UTILITIES).map(([name, value]) => [
      name,
      { position: value },
    ]),
  ),
  ...Object.fromEntries(
    Object.entries(TEXT_DECORATION).map(([name, value]) => [
      name,
      { "text-decoration": value },
    ]),
  ),
  ...Object.fromEntries(
    Object.entries(BORDER_STYLES).map(([name, value]) => [
      name,
      { "border-style": value },
    ]),
  ),
  ...Object.fromEntries(
    Object.entries(ORDER_VALUES).map(([name, value]) => [
      name,
      { order: value },
    ]),
  ),
  ...Object.fromEntries(
    ORDER_STEPS.map((step) => [`order-${step}`, { order: String(step) }]),
  ),
  ...Object.fromEntries(
    Object.entries(VISIBILITY).map(([name, value]) => [
      name,
      { visibility: value },
    ]),
  ),
  ...Object.fromEntries(
    Object.entries(TEXT_ALIGN).map(([name, value]) => [
      name,
      { "text-align": value },
    ]),
  ),
  ...Object.fromEntries(
    Object.entries(WHITESPACE).map(([name, value]) => [
      name,
      { "white-space": value },
    ]),
  ),
  ...Object.fromEntries(
    Object.entries(WORD_BREAK).map(([name, spec]) => [
      name,
      { [spec.prop]: spec.value },
    ]),
  ),
  ...Object.fromEntries(
    Object.entries(TRANSITION_PROPERTY).map(([name, value]) => [
      name,
      { "transition-property": value },
    ]),
  ),
  ...Object.fromEntries(
    Object.entries(CURSOR).map(([name, value]) => [name, { cursor: value }]),
  ),
  ...Object.fromEntries(
    Object.entries(POINTER_EVENTS).map(([name, value]) => [
      name,
      { "pointer-events": value },
    ]),
  ),
  ...Object.fromEntries(
    Object.entries(USER_SELECT).map(([name, value]) => [
      name,
      { "user-select": value },
    ]),
  ),
  ...Object.fromEntries(
    Object.entries(RESIZE).map(([name, value]) => [name, { resize: value }]),
  ),
  ...Object.fromEntries(
    Object.entries(SCROLL_BEHAVIOR).map(([name, value]) => [
      name,
      { "scroll-behavior": value },
    ]),
  ),
  "w-full": { width: "100%" },
  "top-1/2": { top: "50%" },
};
export const GRID_DECLS: Record<string, Record<string, string>> =
  gridDeclarations();

function gridDeclarations(): Record<string, Record<string, string>> {
  const decls: Record<string, Record<string, string>> = {};

  for (let i = 1; i <= 12; i++) {
    decls[`grid-cols-${i}`] = {
      "grid-template-columns": `repeat(${i}, minmax(0, 1fr))`,
    };
    decls[`grid-rows-${i}`] = {
      "grid-template-rows": `repeat(${i}, minmax(0, 1fr))`,
    };
    decls[`col-span-${i}`] = { "grid-column": `span ${i} / span ${i}` };
    decls[`row-span-${i}`] = { "grid-row": `span ${i} / span ${i}` };
  }

  Object.assign(decls, {
    "grid-cols-none": { "grid-template-columns": "none" },
    "grid-rows-none": { "grid-template-rows": "none" },
    "grid-cols-subgrid": { "grid-template-columns": "subgrid" },
    "grid-rows-subgrid": { "grid-template-rows": "subgrid" },
    "grid-cols-repeat": {
      "grid-template-columns": "repeat(var(--grid-cols, 1), minmax(0, 1fr))",
    },
    "grid-rows-repeat": {
      "grid-template-rows": "repeat(var(--grid-rows, 1), minmax(0, 1fr))",
    },
    "col-span-full": { "grid-column": "1 / -1" },
    "row-span-full": { "grid-row": "1 / -1" },
    "col-span-auto": { "grid-column": "auto" },
    "row-span-auto": { "grid-row": "auto" },
    "col-auto": { "grid-column": "auto" },
    "row-auto": { "grid-row": "auto" },
    "col-span-min": { "grid-column": "span min(var(--grid-col-span, 1), 12)" },
    "row-span-min": { "grid-row": "span min(var(--grid-row-span, 1), 12)" },
    "col-min": { "grid-column": "min-content" },
    "col-max": { "grid-column": "max-content" },
    "row-min": { "grid-row": "min-content" },
    "row-max": { "grid-row": "max-content" },
    "grid-flow-row": { "grid-auto-flow": "row" },
    "grid-flow-col": { "grid-auto-flow": "column" },
    "grid-flow-row-dense": { "grid-auto-flow": "row dense" },
    "grid-flow-col-dense": { "grid-auto-flow": "column dense" },
  });

  return decls;
}
