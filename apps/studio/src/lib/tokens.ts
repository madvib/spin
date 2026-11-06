import {
  aliasTarget,
  cssVarName,
  indexTree,
  ownedStyleFields,
  ownedStyleNames,
  valuesInMode,
} from "@spinjs/spin/theme";
import type { TokenTree } from "@spinjs/spin/theme";
import { scaleValue } from "./scale.ts";
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
 * serve them. A border is a width, a style and a colour; a transition is a
 * duration and an easing; a gradient is a direction and a list of stops.
 * (TYPE-c: the `typography` composite is gone — one path, `font.style`.)
 * One string carries all of them, so one string cannot be edited part by
 * part — and a text box that takes the whole string is how a border ends up
 * with a colour that is not one.
 *
 * The three are the types the studio gives a control of their own. The
 * others — a shadow, a curve, a duration on its own — are already served by
 * the controls the studio has.
 */
export const COMPOSITE_TYPES = [
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
 * a border's three are the edge a control draws with.
 */
export type Composite =
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

/** A timing function: a keyword, or a function. */
function isEasing(token: string): boolean {
  return token === "linear" || token === "ease" || token === "ease-in" ||
    token === "ease-out" || token === "ease-in-out" || token === "step-start" ||
    token === "step-end" || token.includes("(");
}

/**
 * A border's parts: the CSS `border` shorthand — a width, a style and a
 * colour, in that order, which is the order the theme's own diagnostics
 * reads a border in.
 */

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
 * The type decides the parts: a border is three edge decisions, a
 * transition is two motion decisions, and a gradient is a direction and a
 * list of stops. A value that cannot be read as the type's parts is
 * answered with nothing, and the editor says so rather than guessing.
 */
export function parseComposite(
  type: string,
  value: string,
): Composite | undefined {
  switch (type) {
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
 * One ramp scaled by one factor: every step the factor can mean moves in its
 * own unit, and a step it cannot mean keeps the document's word.
 *
 * A factor of one or a ramp the grid rounds back to unchanged is no edit at
 * all, so the caller's undo stack stays quiet. Anything at or below zero is
 * refused: it scales the group out of existence rather than anywhere.
 */
export function scaleRampEdits(
  steps: readonly { path: string; value: string }[],
  factor: number,
): StyleEdit[] {
  if (!Number.isFinite(factor) || factor <= 0) {
    throw new Error(`a ramp scales by a positive factor, got ${factor}`);
  }
  const out: StyleEdit[] = [];
  for (const step of steps) {
    const next = scaleValue(step.value, factor);
    if (next === undefined || next === step.value) continue;
    out.push({ path: step.path.split("."), value: next });
  }
  return out;
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

/**
 * One named style the theme declares, with the fields the document holds.
 *
 * The owned set is the contract's list, in the contract's order; the user
 * extension follows in the document's order. A field row carries the path the
 * tuple leaf lives at, so the page edits leaves and never the group.
 */
export interface StyleGroup {
  /** The style's name, as `type-<name>` spends it. */
  readonly name: string;
  /** True for an owned name the contract requires the theme to keep. */
  readonly owned: boolean;
  /** The tuple leaves the document holds, by field. */
  readonly fields: readonly TokenRow[];
}

/** The style names the document holds under `font.style`, in order. */
export function declaredStyles(text: string): readonly string[] {
  let doc: Record<string, unknown>;
  try {
    doc = JSON.parse(text) as Record<string, unknown>;
  } catch {
    return [];
  }
  const font = doc["font"];
  if (typeof font !== "object" || font === null) return [];
  const style = (font as Record<string, unknown>)["style"];
  if (typeof style !== "object" || style === null) return [];
  return Object.keys(style).filter((key) => !key.startsWith("$"));
}

/**
 * The styles a document holds, owned first.
 *
 * Rows come from the tree so the values are the mode's, but membership is
 * the document's: a style is what the document declares, not what resolves.
 */
export function styleGroups(tree: TokenTree): StyleGroup[] {
  const owned = new Set(ownedStyleNames());
  const names = new Set<string>();
  for (const leaf of Object.values(indexTree(tree).leaves)) {
    if (leaf.path[0] === "font" && leaf.path[1] === "style") {
      const name = leaf.path[2];
      if (name !== undefined) names.add(name);
    }
  }
  const byName = new Map<string, TokenRow[]>();
  for (const row of groupTokens(tree, [["font", "style"]])) {
    const name = row.path.split(".")[2];
    if (name === undefined) continue;
    const held = byName.get(name);
    if (held === undefined) byName.set(name, [row]);
    else held.push(row);
  }
  const ordered = [
    ...ownedStyleNames().filter((name) =>
      names.has(name as string)
    ),
    ...[...names].filter((name) => !owned.has(name)),
  ];
  return ordered.map((name) => ({
    name,
    owned: owned.has(name),
    fields: byName.get(name) ?? [],
  }));
}


/**
 * Why a style may not be trimmed, when it may not be.
 *
 * An owned name is stable API — trimming it fails completeness — so the trim
 * is refused here, in words, before the document moves. Anything else trims.
 */
export function trimRefusal(text: string, name: string): string | undefined {
  if (ownedStyleNames().includes(name)) {
    return `“${name}” is an owned style every theme keeps — re-point the elements that read it, or restyle its tuple, but the name stays.`;
  }
  if (!declaredStyles(text).includes(name)) {
    return `“${name}” is not a style this theme declares.`;
  }
  return undefined;
}

/**
 * Trim a custom style from the document.
 *
 * The group goes whole: a half-trimmed tuple is a style the rules cannot
 * spend. The owned set is refused by `trimRefusal`, never here.
 */
export function trimStyle(text: string, name: string): string {
  const doc = JSON.parse(text) as Record<string, unknown>;
  const font = doc["font"] as Record<string, unknown> | undefined;
  const style = font?.["style"] as Record<string, unknown> | undefined;
  if (style !== undefined) delete style[name];
  return JSON.stringify(doc, null, 2);
}

/** The DTCG type one tuple field carries. */
function tupleFieldType(field: string): string {
  if (field === "family") return "fontFamily";
  if (field === "weight") return "fontWeight";
  return "dimension";
}

/**
 * A document with a custom style added, scaffolded from the body voice.
 *
 * The tuple starts as the body's: a new style reads like body until the
 * author edits it, so it is spendable the moment it lands. The name must be
 * new — an existing name is the caller's mistake, said as a throw.
 */
export function styleEdits(text: string, name: string): string {
  if (name.trim().length === 0) {
    throw new Error("a style needs a name before it can be added");
  }
  if (declaredStyles(text).includes(name)) {
    throw new Error(`“${name}” is already a style this theme declares`);
  }
  const doc = JSON.parse(text) as Record<string, unknown>;
  const font = doc["font"] as Record<string, unknown> | undefined;
  const style = font?.["style"] as Record<string, unknown> | undefined;
  const body = style?.["body"] as Record<string, unknown> | undefined;
  const added: Record<string, unknown> = {
    $description: `The ${name} voice.`,
  };
  for (const field of ownedStyleFields()) {
    const leaf = body?.[field] as Record<string, unknown> | undefined;
    const value = leaf?.["$value"];
    added[field] = {
      $type: tupleFieldType(field),
      $value: typeof value === "string" || typeof value === "number"
        ? value
        : field === "weight"
        ? "400"
        : field === "family"
        ? "system-ui, sans-serif"
        : "1rem",
    };
  }
  if (
    typeof font !== "object" || font === null ||
    typeof style !== "object" || style === null
  ) {
    throw new Error("this theme declares no font.style group to add to");
  }
  style[name] = added;
  return JSON.stringify(doc, null, 2);
}

/**
 * The style an element reads: the alias target of `element.<element>.type`.
 *
 * A `.type` token is the five-leaf tuple the parser fans out from one
 * whole-style alias, so the `family` leaf carries the target outright:
 * `element.p.type.family = "{font.style.body.family}"` reads as `body`.
 * Absent, or not a `font.style` alias, reads as nothing — the route says
 * so, not a default.
 */
export function attachedStyle(
  tree: TokenTree,
  element: string,
): string | undefined {
  return typeTarget(tree, `element.${element}.type`);
}

/**
 * The alias style one `.type` group points at, by dotted group path.
 *
 * The parser fans a whole-style alias out to five field aliases, so the
 * `family` leaf carries the target: `<path>.family =
 * "{font.style.<name>.family}"` reads as `<name>`. Anything else — absent,
 * not an alias, outside `font.style` — is not a style target, and reads as
 * nothing.
 */

export function typeTarget(tree: TokenTree, path: string): string | undefined {
  const leaf = indexTree(tree).leaves[`${path}.family`];
  if (leaf === undefined) return undefined;
  const target = aliasTarget(leaf.value);
  if (target === null) return undefined;
  const prefix = "font.style.";
  const suffix = ".family";
  if (!target.startsWith(prefix) || !target.endsWith(suffix)) return undefined;
  const name = target.slice(prefix.length, -suffix.length);
  if (name.length === 0 || name.includes(".")) return undefined;
  return name;
}

/**
 * The element names that carry a `.type` tuple, in tree order.
 *
 * `element.p.type` is the five-leaf group the parser fans out from one
 * whole-style alias; the `family` leaf is the witness, because every tuple
 * carries one and only tuples carry one. First-seen order is the document's
 * own, so the picker lists elements the way the theme states them.
 */
export function elementTargets(tree: TokenTree): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const leaf of Object.values(indexTree(tree).leaves)) {
    const path = leaf.path;
    if (
      path.length !== 4 || path[0] !== "element" || path[2] !== "type" ||
      path[3] !== "family"
    ) continue;
    const element = path[1] as string;
    if (seen.has(element)) continue;
    seen.add(element);
    out.push(element);
  }
  return out;
}

/**
 * The dotted `.type` group paths outside `element` and `font.style`, in
 * tree order.
 *
 * `button.type` or `button.s-sm.type` is the same five-leaf tuple an
 * element carries — the `family` leaf is the witness — but the row it
 * feeds names the group, not the leaf. `font.style` tuples are the aliases'
 * targets, not references, so they stay out; `element` rows belong to the
 * element picker.
 */
export function referenceTargets(tree: TokenTree): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const leaf of Object.values(indexTree(tree).leaves)) {
    const path = leaf.path;
    const last = path[path.length - 1];
    const second = path[path.length - 2];
    if (last !== "family" || second !== "type") continue;
    if (path[0] === "element" || path[0] === "font") continue;
    const group = path.slice(0, -1).join(".");
    if (seen.has(group)) continue;
    seen.add(group);
    out.push(group);
  }
  return out;
}

/** One leaf edit, as the document spells it: a DTCG path and the value. */
export interface StyleEdit {
  readonly path: readonly string[];
  readonly value: string;
}
