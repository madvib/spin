/**
 * The utility vocabulary: every name the static surface defines and what it
 * means.
 *
 * A table per family, naming utility to declaration. Nothing here computes —
 * the tables are the closed set, and `declarations.ts` turns them into CSS.
 * Adding a utility means adding a row here, which is the only place that
 * should have to change.
 */

/**
 * Colour vocabulary that is a value rather than a token. Resolved by
 * `rules/color.ts`, which reads this before falling back to the theme.
 */
export const COLOR_KEYWORDS = ["transparent", "currentColor"] as const;

/**
 * Utilities with no token behind them, owned statically by the preset.
 *
 * Authored, not derived: `w-full` and `top-1/2` are literal declarations in
 * `declarations.ts` with no scale step to derive from, and `flex` is claimed
 * here so `layout.ts` owns the rule rather than `display.ts` (which also
 * lists it). A typo is a compile error.
 */
export const STATIC_UTILITIES = ["flex", "w-full", "top-1/2"] as const;

export const DISPLAY_VALUES: Record<string, string> = {
  "block": "block",
  "inline-block": "inline-block",
  "inline": "inline",
  "flex": "flex",
  "inline-flex": "inline-flex",
  "grid": "grid",
  "inline-grid": "inline-grid",
  "contents": "contents",
  "hidden": "none",
};

/** Display utilities. Derived from `DISPLAY_VALUES` so the two cannot disagree. */
export const DISPLAY_UTILITIES: readonly string[] = Object.keys(DISPLAY_VALUES);

export const OPACITY_STEPS = [
  0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100,
] as const;

/** Opacity utilities. Derived from `OPACITY_STEPS`. */
export const OPACITY_UTILITIES: readonly string[] = OPACITY_STEPS.map(
  (step) => `opacity-${step}`,
);

/**
 * Track sizing.
 *
 * Fixed counts and fractions only. A theme does not get to name a column
 * scale — `grid-cols-12` would only exist if every theme in the world wanted
 * twelve, and the ones that do not would be carrying a vocabulary they never
 * designed. `auto-fit` with a minimum is the expressive form, and it needs no
 * vocabulary at all: it fills whatever space the container has.
 */
export const GRID_TRACKS: string[] = [
  ...Array.from({ length: 12 }, (_, i) => `grid-cols-${i + 1}`),
  ...Array.from({ length: 12 }, (_, i) => `grid-rows-${i + 1}`),
  "grid-cols-none",
  "grid-rows-none",
  "grid-cols-subgrid",
  "grid-rows-subgrid",
  "grid-cols-repeat",
  "grid-rows-repeat",
];

export const GRID_SPANS: string[] = [
  ...Array.from({ length: 12 }, (_, i) => `col-span-${i + 1}`),
  ...Array.from({ length: 12 }, (_, i) => `row-span-${i + 1}`),
  "col-span-full",
  "row-span-full",
  "col-span-auto",
  "row-span-auto",
];

export const GRID_FLOW = [
  "grid-flow-row",
  "grid-flow-col",
  "grid-flow-row-dense",
  "grid-flow-col-dense",
] as const;

export function opacityValue(utility: string): string {
  return String(Number(utility.slice("opacity-".length)) / 100);
}

export const FRACTIONS: Record<string, string> = {
  "1/2": "50%",
  "1/3": "33.333333%",
  "2/3": "66.666667%",
  "1/4": "25%",
  "3/4": "75%",
  "1/5": "20%",
  "2/5": "40%",
  "3/5": "60%",
  "4/5": "80%",
  "1/6": "16.666667%",
  "5/6": "83.333333%",
  "1/12": "8.333333%",
  "11/12": "91.666667%",
};

export const WIDTH_KEYWORDS: Record<string, string> = {
  "full": "100%",
  "screen": "100vw",
  "min": "min-content",
  "max": "max-content",
  "fit": "fit-content",
};

export const HEIGHT_KEYWORDS: Record<string, string> = {
  "full": "100%",
  "screen": "100vh",
  "min": "min-content",
  "max": "max-content",
  "fit": "fit-content",
};

export const FLEX_DIRECTIONS: Record<string, string> = {
  "flex-row": "row",
  "flex-row-reverse": "row-reverse",
  "flex-col": "column",
  "flex-col-reverse": "column-reverse",
};

export const FLEX_WRAPS: Record<string, string> = {
  "flex-wrap": "wrap",
  "flex-wrap-reverse": "wrap-reverse",
  "flex-nowrap": "nowrap",
};

export const ALIGN_ITEMS: Record<string, string> = {
  "items-start": "flex-start",
  "items-end": "flex-end",
  "items-center": "center",
  "items-baseline": "baseline",
  "items-stretch": "stretch",
};

export const JUSTIFY_CONTENT: Record<string, string> = {
  "justify-start": "flex-start",
  "justify-end": "flex-end",
  "justify-center": "center",
  "justify-between": "space-between",
  "justify-around": "space-around",
  "justify-evenly": "space-evenly",
};

export const ALIGN_CONTENT: Record<string, string> = {
  "content-start": "flex-start",
  "content-end": "flex-end",
  "content-center": "center",
  "content-between": "space-between",
  "content-around": "space-around",
  "content-evenly": "space-evenly",
};

export const ALIGN_SELF: Record<string, string> = {
  "self-auto": "auto",
  "self-start": "flex-start",
  "self-end": "flex-end",
  "self-center": "center",
  "self-stretch": "stretch",
};

export const FLEX_FACTORS: Record<string, string> = {
  "flex-1": "1 1 0%",
  "flex-auto": "1 1 auto",
  "flex-initial": "0 1 auto",
  "flex-none": "none",
  "grow": "1",
  "grow-0": "0",
  "shrink": "1",
  "shrink-0": "0",
};

export const FLEX_UTILITIES: string[] = [
  ...Object.keys(FLEX_DIRECTIONS),
  ...Object.keys(FLEX_WRAPS),
  ...Object.keys(ALIGN_ITEMS),
  ...Object.keys(JUSTIFY_CONTENT),
  ...Object.keys(ALIGN_CONTENT),
  ...Object.keys(ALIGN_SELF),
  ...Object.keys(FLEX_FACTORS),
];

export const OVERFLOW_VALUES: Record<string, string> = {
  "auto": "auto",
  "hidden": "hidden",
  "clip": "clip",
  "scroll": "scroll",
  "visible": "visible",
};

export const OVERFLOW_UTILITIES: string[] = [
  ...Object.keys(OVERFLOW_VALUES).map((value) => `overflow-${value}`),
  ...Object.keys(OVERFLOW_VALUES).map((value) => `overflow-x-${value}`),
  ...Object.keys(OVERFLOW_VALUES).map((value) => `overflow-y-${value}`),
];

export const POSITION_UTILITIES: Record<string, string> = {
  "static": "static",
  "relative": "relative",
  "absolute": "absolute",
  "fixed": "fixed",
  "sticky": "sticky",
};

export const TEXT_DECORATION: Record<string, string> = {
  "underline": "underline",
  "overline": "overline",
  "line-through": "line-through",
  "no-underline": "none",
};

export const LIST_STYLE: Record<string, string> = {
  "list-none": "none",
};

export const TEXT_ALIGN: Record<string, string> = {
  "text-left": "left",
  "text-center": "center",
  "text-right": "right",
  "text-justify": "justify",
};

export const WHITESPACE: Record<string, string> = {
  "whitespace-normal": "normal",
  "whitespace-nowrap": "nowrap",
  "whitespace-pre": "pre",
  "whitespace-pre-line": "pre-line",
  "whitespace-pre-wrap": "pre-wrap",
  "whitespace-break-spaces": "break-spaces",
};

export const WORD_BREAK: Record<string, { prop: string; value: string }> = {
  "break-normal": { prop: "overflow-wrap", value: "normal" },
  "break-words": { prop: "overflow-wrap", value: "break-word" },
  "break-all": { prop: "word-break", value: "break-all" },
};

export const TRANSITION_PROPERTY: Record<string, string> = {
  "transition":
    "color, background-color, border-color, text-decoration-color, fill, stroke, opacity, box-shadow, transform, translate, scale, rotate",
  "transition-none": "none",
  "transition-all": "all",
  "transition-colors":
    "color, background-color, border-color, text-decoration-color, fill, stroke",
  "transition-opacity": "opacity",
  "transition-shadow": "box-shadow",
  "transition-transform": "transform, translate, scale, rotate",
};

export const ORDER_VALUES: Record<string, string> = {
  "order-first": "-9999",
  "order-last": "9999",
  "order-none": "0",
};

export const ORDER_STEPS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

export const ORDER_UTILITIES: string[] = [
  ...Object.keys(ORDER_VALUES),
  ...ORDER_STEPS.map((step) => `order-${step}`),
];

export const VISIBILITY: Record<string, string> = {
  "visible": "visible",
  "invisible": "hidden",
  "collapse": "collapse",
};

export const INSET_KEYWORDS: Record<string, string> = {
  "0": "0",
  "full": "100%",
  "auto": "auto",
};

export const CURSOR: Record<string, string> = {
  "cursor-default": "default",
  "cursor-pointer": "pointer",
  "cursor-wait": "wait",
  "cursor-text": "text",
  "cursor-move": "move",
  "cursor-help": "help",
  "cursor-not-allowed": "not-allowed",
  "cursor-none": "none",
  "cursor-context-menu": "context-menu",
  "cursor-progress": "progress",
  "cursor-cell": "cell",
  "cursor-crosshair": "crosshair",
  "cursor-vertical-text": "vertical-text",
  "cursor-alias": "alias",
  "cursor-copy": "copy",
  "cursor-no-drop": "no-drop",
  "cursor-grab": "grab",
  "cursor-grabbing": "grabbing",
  "cursor-all-scroll": "all-scroll",
  "cursor-col-resize": "col-resize",
  "cursor-row-resize": "row-resize",
  "cursor-zoom-in": "zoom-in",
  "cursor-zoom-out": "zoom-out",
};

export const POINTER_EVENTS: Record<string, string> = {
  "pointer-events-none": "none",
  "pointer-events-auto": "auto",
};

export const USER_SELECT: Record<string, string> = {
  "select-none": "none",
  "select-text": "text",
  "select-all": "all",
  "select-auto": "auto",
};

export const RESIZE: Record<string, string> = {
  "resize-none": "none",
  "resize-x": "horizontal",
  "resize-y": "vertical",
  "resize-both": "both",
};

export const SCROLL_BEHAVIOR: Record<string, string> = {
  "scroll-auto": "auto",
  "scroll-smooth": "smooth",
};

export const OVERSCROLL_BEHAVIOR: Record<string, string> = {
  contain: "contain",
};

export const BOX_SIZING: Record<string, string> = {
  border: "border-box",
};

export const ANIMATION: Record<string, string> = {
  none: "none",
};

export const INTERACTIVITY_UTILITIES: string[] = [
  ...Object.keys(CURSOR),
  ...Object.keys(POINTER_EVENTS),
  ...Object.keys(USER_SELECT),
  ...Object.keys(RESIZE),
  ...Object.keys(SCROLL_BEHAVIOR),
  ...Object.keys(OVERSCROLL_BEHAVIOR).map((name) => `overscroll-${name}`),
  ...Object.keys(BOX_SIZING).map((name) => `box-${name}`),
  ...Object.keys(ANIMATION).map((name) => `animation-${name}`),
];

export const DIVIDE_WIDTHS: Record<string, string> = {
  "": "1px",
  "0": "0",
  "2": "2px",
  "4": "4px",
  "8": "8px",
};

export const BORDER_WIDTHS: Record<string, string> = {
  "": "1px",
  "0": "0",
  "2": "2px",
  "4": "4px",
  "8": "8px",
};

export const BORDER_SIDES: Record<string, string> = {
  "": "border-width",
  "t": "border-top-width",
  "r": "border-right-width",
  "b": "border-bottom-width",
  "l": "border-left-width",
  // Logical axes. `border-x` is the pair a writing mode treats as inline, so
  // it follows the text rather than the viewport.
  "x": "border-inline-width",
  "y": "border-block-width",
  "s": "border-inline-start-width",
  "e": "border-inline-end-width",
};

/**
 * Corner radii by logical corner.
 *
 * A joined group rounds only its outer corners, and which corners those are
 * depends on writing mode — `border-start-start-radius` is top-left in
 * horizontal text and top-right in vertical. The physical suffixes remain for
 * the cases where the side really is fixed.
 */
export const CORNER_LOGICAL: Record<string, string> = {
  "ss": "border-start-start-radius",
  "se": "border-start-end-radius",
  "es": "border-end-start-radius",
  "ee": "border-end-end-radius",
  "s": "border-start-start-radius",
  "e": "border-start-end-radius",
};

/**
 * Capitalisation, spelled as a utility rather than a component token.
 *
 * A theme that wanted to own this would be expressing a preference about its
 * own prose, which is what the type scale already is — so it is vocabulary.
 */
export const TEXT_TRANSFORMS: Record<string, string> = {
  uppercase: "uppercase",
  lowercase: "lowercase",
  capitalize: "capitalize",
  "normal-case": "none",
};

/**
 * Letter spacing. A theme may declare its own scale under `font.letter-spacing`
 * and these are the conventional steps it falls back to, so a silent theme
 * still gets a ramp rather than nothing.
 */
export const TRACKING: Record<string, string> = {
  tighter: "-0.05em",
  tight: "-0.025em",
  normal: "0em",
  wide: "0.025em",
  wider: "0.05em",
  widest: "0.1em",
};

/**
 * The flat shadow, and the lift steps a component spends.
 *
 * `shadow-none` is a look a theme reaches for most: a control with no shadow
 * is a deliberate decision, not the absence of one. It is here rather than in
 * the shadow scale because a theme's own shadow steps are named by the theme —
 * `shadow-sm` reads whatever `shadow.sm` is.
 */
export const SHADOW: Record<string, string> = {
  none: "none",
};

/** Focus ring geometry, spent by every interactive component. */
export const OUTLINE: Record<string, string> = {
  // A transparent ring of the theme's own thickness: the point of `outline-none`
  // is to keep the box the same size, and both numbers come from the theme.
  "outline-none": "outline: 2px solid transparent",
  "outline-solid": "outline-style: solid",
  "outline-dashed": "outline-style: dashed",
  "outline-dotted": "outline-style: dotted",
};

export const BORDER_STYLES: Record<string, string> = {
  "border-solid": "solid",
  "border-dashed": "dashed",
  "border-dotted": "dotted",
  "border-double": "double",
  "border-none": "none",
};
