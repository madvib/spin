import { cssVarName, indexTree, valuesInMode } from "@spinjs/theme";
import type { TokenTree } from "@spinjs/theme";
import { ROUTES } from "./routes.ts";

export interface TokenRow {
  path: string;
  variable: string;
  value: string;
  /** The theme's declared type for this token, e.g. `color`, `dimension`. */
  type: string;
}

/**
 * The composite types: a value that is more than one thing.
 *
 * A colour is one thing and a dimension is one thing, so a text field can
 * serve them. A typography is a family, a size, a weight and a tracking; a
 * border is a width, a style and a colour; a transition is a duration and an
 * easing; a gradient is a direction and a list of stops. One string carries
 * all of them, so one string cannot be edited part by part — and a text box
 * that takes the whole string is how a border ends up with a colour that is
 * not one.
 *
 * The four are the types the studio gives a control of their own. The
 * others — a shadow, a curve, a duration on its own — are already served by
 * the controls the studio has.
 */
export const COMPOSITE_TYPES = [
  "typography",
  "border",
  "transition",
  "gradient",
] as const;

/** A type whose value is more than one thing. */
export type CompositeType = (typeof COMPOSITE_TYPES)[number];

/** True when a declared type is one of the composites. */
export function isCompositeType(type: string): type is CompositeType {
  return (COMPOSITE_TYPES as readonly string[]).includes(type);
}

/**
 * One stop of a gradient: a colour and where it sits.
 */
export interface GradientStop {
  readonly color: string;
  readonly position: string;
}

/**
 * A composite's parts, as the theme spells them.
 *
 * The parts are the theme's own decisions, so each one names what it is:
 * a typography's four parts are the four ladders the type page shows, and a
 * border's three are the edge a control draws with.
 */
export type Composite =
  | {
    readonly type: "typography";
    /** The face, as a stack. */
    readonly family: string;
    /** The size, at the theme's own step. */
    readonly size: string;
    /** The weight, at the theme's own step. */
    readonly weight: string;
    /** The tracking, at the theme's own step. */
    readonly tracking: string;
    /** The leading, when the theme wrote one. */
    readonly leading: string;
  }
  | {
    readonly type: "border";
    readonly width: string;
    readonly style: string;
    readonly color: string;
  }
  | {
    readonly type: "transition";
    /** The property that moves, when the theme named one. */
    readonly property: string;
    readonly duration: string;
    readonly easing: string;
    /** The delay, when the theme wrote one. */
    readonly delay: string;
  }
  | {
    readonly type: "gradient";
    readonly direction: string;
    readonly stops: readonly GradientStop[];
  };

/** The line styles a border may be drawn in. */
export const STROKE_STYLES = [
  "solid",
  "dashed",
  "dotted",
  "double",
  "groove",
  "ridge",
  "inset",
  "outset",
  "none",
] as const;

/**
 * A value's parts, split on the whitespace that separates them.
 *
 * A part may hold a function with spaces in it — `cubic-bezier(0.4, 0, 0.2,
 * 1)` — so the split counts parentheses rather than cutting at every space.
 */
function parts(value: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of value) {
    if (ch === "(") depth += 1;
    if (ch === ")") depth -= 1;
    if (depth === 0 && /\s/.test(ch)) {
      if (current !== "") out.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  if (current !== "") out.push(current);
  return out;
}

/** A length: a number with a unit, or a bare zero. */
function isLength(token: string): boolean {
  return /^-?\d*\.?\d+(px|rem|em|%|vh|vw|ch|ex|pt|pc|cm|mm|in|q)?$/.test(
    token,
  ) && token !== "";
}

/** A time: a number with a time unit. */
function isTime(token: string): boolean {
  return /^-?\d*\.?\d+(ms|s)$/.test(token);
}

/** A weight: a number, or one of the CSS weight keywords. */
function isWeight(token: string): boolean {
  return /^\d{1,4}$/.test(token) ||
    token === "normal" || token === "bold" || token === "bolder" ||
    token === "lighter";
}

/** A timing function: a keyword, or a function. */
function isEasing(token: string): boolean {
  return token === "linear" || token === "ease" || token === "ease-in" ||
    token === "ease-out" || token === "ease-in-out" || token === "step-start" ||
    token === "step-end" || token.includes("(");
}

/**
 * A typography's parts.
 *
 * The theme spells a typography as the CSS `font` shorthand — a weight, a
 * size and a family — with the theme's tracking after it, because CSS's own
 * shorthand has no slot for a tracking and a theme's tracking is a step of
 * its own scale like any other. A value with no tracking is the shorthand
 * exactly, so a theme that writes one writes CSS the browser takes.
 */
function parseTypography(value: string): Composite {
  const tokens = parts(value);
  let tracking = "";
  const last = tokens[tokens.length - 1];
  if (tokens.length > 2 && last !== undefined && isLength(last)) {
    tracking = last;
    tokens.pop();
  }
  const weight = isWeight(tokens[0] ?? "") ? (tokens[0] as string) : "";
  const rest = weight === "" ? tokens : tokens.slice(1);
  const size = rest[0] ?? "";
  const slash = size.indexOf("/");
  return {
    type: "typography",
    family: rest.slice(1).join(" "),
    size: slash === -1 ? size : size.slice(0, slash),
    weight,
    tracking,
    leading: slash === -1 ? "" : size.slice(slash + 1),
  };
}

/**
 * A border's parts: the CSS `border` shorthand — a width, a style and a
 * colour, in that order, which is the order the theme's own diagnostics
 * reads a border in.
 */
function parseBorder(value: string): Composite {
  const tokens = parts(value);
  const width = tokens[0] ?? "";
  const style = tokens[1] !== undefined &&
      (STROKE_STYLES as readonly string[]).includes(tokens[1])
    ? tokens[1]
    : "";
  const color = (style === "" ? tokens.slice(1) : tokens.slice(2)).join(" ");
  return { type: "border", width, style, color };
}

/**
 * A transition's parts: the CSS `transition` shorthand — a property, a
 * duration, a timing function and a delay, of which a theme writes the
 * first two and the last two are optional.
 */
function parseTransition(value: string): Composite {
  const tokens = parts(value);
  let property = "";
  let duration = "";
  let easing = "";
  let delay = "";
  for (const token of tokens) {
    if (duration === "" && isTime(token)) {
      duration = token;
      continue;
    }
    if (delay === "" && isTime(token)) {
      delay = token;
      continue;
    }
    if (easing === "" && isEasing(token)) {
      easing = token;
      continue;
    }
    property = property === "" ? token : `${property} ${token}`;
  }
  return { type: "transition", property, duration, easing, delay };
}

/** A gradient's stops, split on the commas that separate them. */
function argumentsOf(value: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of value) {
    if (ch === "(") depth += 1;
    if (ch === ")") depth -= 1;
    if (ch === "," && depth === 0) {
      out.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  out.push(current.trim());
  return out;
}

/** One stop: a colour, and where it sits. */
function parseStop(value: string): GradientStop {
  const tokens = parts(value);
  const last = tokens[tokens.length - 1];
  if (tokens.length > 1 && last !== undefined && isLength(last)) {
    return { color: tokens.slice(0, -1).join(" "), position: last };
  }
  return { color: value.trim(), position: "" };
}

/**
 * A gradient's parts: the direction, and the stops.
 *
 * The direction is what CSS calls the first argument, and the stops are
 * the rest — a colour and where it sits, which is what a gradient is.
 */
function parseGradient(value: string): Composite {
  const open = value.indexOf("(");
  const close = value.lastIndexOf(")");
  if (open === -1 || close === -1) {
    return { type: "gradient", direction: "", stops: [] };
  }
  const args = argumentsOf(value.slice(open + 1, close));
  return {
    type: "gradient",
    direction: args[0] ?? "",
    stops: args.slice(1).map(parseStop),
  };
}

/**
 * A composite's parts, read out of the value the theme holds.
 *
 * The type decides the parts: a typography is four type decisions, a border
 * is three edge decisions, a transition is two motion decisions, and a
 * gradient is a direction and a list of stops. A value that cannot be read
 * as the type's parts is answered with nothing, and the editor says so
 * rather than guessing.
 */
export function parseComposite(
  type: string,
  value: string,
): Composite | undefined {
  switch (type) {
    case "typography":
      return parseTypography(value);
    case "border":
      return parseBorder(value);
    case "transition":
      return parseTransition(value);
    case "gradient":
      return parseGradient(value);
    default:
      return undefined;
  }
}

/**
 * A composite's parts, written back the way the theme spells them.
 *
 * The same shape the value was read in, so a document that is edited and
 * read again says the same thing: a part that was not touched is written
 * exactly as it was read.
 */
export function formatComposite(composite: Composite): string {
  switch (composite.type) {
    case "typography": {
      const size = composite.leading === ""
        ? composite.size
        : `${composite.size}/${composite.leading}`;
      return [composite.weight, size, composite.family, composite.tracking]
        .filter((part) => part !== "")
        .join(" ");
    }
    case "border":
      return [composite.width, composite.style, composite.color]
        .filter((part) => part !== "")
        .join(" ");
    case "transition":
      return [
        composite.property,
        composite.duration,
        composite.easing,
        composite.delay,
      ]
        .filter((part) => part !== "")
        .join(" ");
    case "gradient": {
      const stops = composite.stops.map((stop) =>
        stop.position === "" ? stop.color : `${stop.color} ${stop.position}`
      );
      return `linear-gradient(${
        [composite.direction, ...stops].filter((part) => part !== "").join(", ")
      })`;
    }
  }
}

/**
 * One step of a theme's ladder.
 */
export interface LadderStep {
  /** The token's path, e.g. `font.size.3xl`. */
  readonly path: string;
  /** The step's own name, e.g. `3xl`. */
  readonly name: string;
  /** The value the theme holds for it, in the mode being shown. */
  readonly value: string;
}

/**
 * The steps a group holds, one level under it.
 *
 * The theme's ladders are groups of tokens — `font.size` holds the sizes,
 * `motion.duration` the durations — and a step is one of them. The value is
 * the one the theme holds in the mode being shown, so the control offers
 * the theme's own answer rather than the document's base.
 */
function stepsUnder(
  tree: TokenTree,
  mode: string,
  group: string,
): readonly LadderStep[] {
  const prefix = group.split(".");
  const effective = valuesInMode(tree, mode);
  const out: LadderStep[] = [];
  for (const leaf of Object.values(indexTree(tree).leaves)) {
    if (leaf.path.length !== prefix.length + 1) continue;
    if (!prefix.every((segment, i) => leaf.path[i] === segment)) continue;
    const value = effective.get(leaf.path.join("."));
    if (value === undefined) continue;
    out.push({
      path: leaf.path.join("."),
      name: leaf.path[leaf.path.length - 1] ?? "",
      value: typeof value === "string" ? value : String(value),
    });
  }
  return out;
}

/**
 * The theme's own ladders, as the composite editors read them.
 *
 * Every part of a composite is a decision the theme has made somewhere
 * else — a size is a step of the type scale, a width a step of the border
 * ladder, a colour a role of the palette — so the editors offer those
 * steps rather than free numbers. A theme that declares none offers none,
 * and the editor falls back to a field that takes the value.
 */
export interface CompositeLadders {
  readonly families: readonly LadderStep[];
  readonly sizes: readonly LadderStep[];
  readonly weights: readonly LadderStep[];
  readonly trackings: readonly LadderStep[];
  readonly widths: readonly LadderStep[];
  readonly durations: readonly LadderStep[];
  readonly easings: readonly LadderStep[];
  /** The palette's roles — the colours the theme names. */
  readonly colors: readonly LadderStep[];
}

/**
 * The ladders a theme offers its composites, read from the document.
 */
export function compositeLadders(
  tree: TokenTree,
  mode: string,
): CompositeLadders {
  return {
    families: stepsUnder(tree, mode, "font.family"),
    sizes: stepsUnder(tree, mode, "font.size"),
    weights: stepsUnder(tree, mode, "font.weight"),
    trackings: stepsUnder(tree, mode, "font.letter-spacing"),
    widths: stepsUnder(tree, mode, "border").filter((step) =>
      step.name === "width" || step.name.startsWith("width-")
    ),
    durations: stepsUnder(tree, mode, "motion.duration"),
    easings: stepsUnder(tree, mode, "motion.easing"),
    colors: stepsUnder(tree, mode, "color"),
  };
}

function formatValue(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }
  return JSON.stringify(value);
}

/** A length in px at the 16px root; undefined for a value that is not a length. */
export function toPx(value: string): number | undefined {
  if (value.trim() === "0") return 0;
  const rem = value.trim().match(/^(-?[\d.]+)rem$/);
  if (rem) return Number(rem[1]) * 16;
  const px = value.trim().match(/^(-?[\d.]+)px$/);
  if (px) return Number(px[1]);
  return undefined;
}

/**
 * The border utility whose value the token carries. `border.width` is the
 * bare hairline; `border.width-N` is the step. Anything else does not usefully
 * name a border utility at all, and fails the oracle rather than guessing.
 */
export function borderUtilityOf(path: string | { path: string }): string {
  const p = typeof path === "string" ? path : path.path;
  const leaf = p.split(".").pop() ?? "";
  return leaf === "width" ? "border" : `border-${leaf.replace(/^width-/, "")}`;
}

export function groupTokens(
  tree: TokenTree,
  prefixes: string[][],
  mode: string = "light",
): TokenRow[] {
  if (prefixes.length === 0) return [];
  const index = indexTree(tree);
  // The theme answers what a token is worth in the active mode.
  const effective = valuesInMode(tree, mode);
  return Object.values(index.leaves)
    .filter((leaf) =>
      prefixes.some((prefix) =>
        prefix.every((segment, i) => leaf.path[i] === segment)
      )
    )
    .map((leaf) => {
      const path = leaf.path.join(".");
      return {
        path,
        variable: cssVarName(leaf.path),
        value: formatValue(effective.get(path) ?? leaf.value),
        // The declared type picks the control: a color gets a picker, a
        // dimension a step control.
        type: (leaf.type as string | undefined) ?? "",
      };
    });
}

/** Every custom property the theme declares, keyed by the variable it emits. */
export function tokenPathsByVar(
  tree: TokenTree,
): ReadonlyMap<string, string> {
  const out = new Map<string, string>();
  for (const leaf of Object.values(indexTree(tree).leaves)) {
    out.set(cssVarName(leaf.path), leaf.path.join("."));
  }
  return out;
}

/**
 * The theme's own row for one exact path, in the mode asked for.
 *
 * Exact, because creation is the other half of its job: `color.neutral` is
 * a group, and reading the leaf BENEATH it as if the path itself were a
 * token would offer to scaffold a namespace the theme already has.
 */
export function tokenRowAt(
  tree: TokenTree,
  path: string,
  mode: string,
): TokenRow | undefined {
  return groupTokens(tree, [path.split(".")], mode).find((row) =>
    row.path === path
  );
}

/** Which editor route owns a token path; a group no editor owns answers `/`. */
export function editorRouteFor(path: string): string {
  const segments = path.split(".");
  const owned = ROUTES.find((route) =>
    // `in`, because the table is a tuple of literals: an entry with no
    // `owns` has no such field at all.
    "owns" in route &&
    route.owns.some((prefix) =>
      prefix.every((segment, i) => segments[i] === segment)
    )
  );
  return owned?.path ?? "/";
}
