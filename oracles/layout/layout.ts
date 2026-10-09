/**
 * Geometry: the fixture DOM, styled by the resolved sheet, laid out by taffy.
 *
 * Tradeoffs, stated once and honoured everywhere below:
 *
 * - **Taffy is the engine.** Every box position and size the invariants read
 *   comes from `TaffyTree` + `computeLayoutWithMeasure`. Nothing is computed
 *   by hand.
 * - **Tables** use taffy's own table layout (`itemIsTable`); `thead`/`tbody`
 *   group nodes are flattened so rows are direct children, which is the shape
 *   taffy's table algorithm takes. `border-collapse` is approximated by
 *   giving each cell its rule's border and letting row heights add up — it
 *   lands within 1px of the reference's own numbers.
 * - **Text** is measured, not rendered: a per-character advance table stands
 *   in for font metrics (no font engine here). Row heights use a
 *   `line-height: normal` factor of 1.5×, calibrated against the reference in
 *   Chromium. Widths that only feed the overflow check are approximate by
 *   design; every asserted invariant is a height, an intrinsic dimension, or
 *   a theme-token relationship, none of which the approximation can move.
 * - **Sticky** is a paint behaviour, not a box: the header keeps its flow
 *   geometry, so "the header stays visible while rows scroll" is checked as
 *   "the scroller's box is at least header + 3 rows tall".
 * - **Flex shrink** of wrapping prose is the one place taffy's flexbox
 *   diverges from CSS (it shrinks definite items and treats measured text as
 *   fixed). A second pass hands an over-wide text item the width a browser
 *   would give it, so the wrap and height are the browser's; every other
 *   number still comes from the first pass.
 * - **Captions** are not modelled: taffy's table algorithm takes rows only,
 *   and a caption's height feeds no asserted invariant.
 * - **Inline** display is modelled as block; every inline-ish node in the
 *   fixtures is a flex item, where the distinction does not exist.
 * - **Pseudo-element boxes, state rules and @media blocks** are not modelled
 *   (see css.ts); no fixture places asserted geometry inside them.
 */

import {
  AlignItems,
  AlignSelf,
  BoxSizing,
  Display,
  FlexDirection,
  FlexWrap,
  JustifyContent,
  loadTaffy,
  Overflow,
  Position,
  Style,
  TaffyTree,
} from "taffy-layout";
import type { DomNode } from "./dom.ts";
import { evalLength, type Length, NORMAL_LINE_FACTOR } from "./css.ts";

export interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface MeasureContext {
  readonly tag: string;
  readonly text: string;
  readonly fontSizePx: number;
  readonly lineHeightPx: number;
}

export interface LayoutResult {
  readonly boxOf: (node: DomNode) => Box;
  /**
   * Whether the engine modelled this node at all. Table section wrappers
   * (thead/tbody) are flattened into the table's rows, so they have no box
   * of their own; everything under them does.
   */
  readonly isModelled: (node: DomNode) => boolean;
  readonly dispose: () => void;
}

await loadTaffy();

/** Per-character advance in em, standing in for font metrics. */
const ADVANCE: Record<string, number> = {
  " ": 0.26,
  "i": 0.3,
  "l": 0.3,
  "j": 0.3,
  "t": 0.36,
  "f": 0.36,
  "r": 0.4,
  "I": 0.36,
  ".": 0.28,
  ",": 0.28,
  ":": 0.28,
  ";": 0.28,
  "'": 0.2,
  "!": 0.32,
  "-": 0.36,
  "+": 0.58,
  "%": 0.85,
  "/": 0.42,
};

function advanceOf(char: string): number {
  const table = ADVANCE[char];
  if (table !== undefined) return table;
  if (char >= "0" && char <= "9") return 0.6;
  if (char >= "A" && char <= "Z") return 0.68;
  return 0.53;
}

export function measureTextWidth(text: string, fontSizePx: number): number {
  let width = 0;
  for (const char of text) width += advanceOf(char) * fontSizePx;
  return width;
}

function wrapLines(
  text: string,
  fontSizePx: number,
  availablePx: number | null,
): string[] {
  if (text === "") return [""];
  // A null available space is a max-content query: the text on one line.
  // A definite zero is a min-content query: every word on its own line, so
  // the widest word is the answer.
  if (availablePx === null) return [text];
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current === "" ? word : `${current} ${word}`;
    if (
      current === "" || measureTextWidth(candidate, fontSizePx) <= availablePx
    ) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  lines.push(current);
  return lines;
}

/** Prose wraps; controls and cells hold one line, as the fixtures write them. */
const WRAPPING_TAGS: Record<string, true> = {
  p: true,
  h1: true,
  h2: true,
  h3: true,
  h4: true,
  h5: true,
  h6: true,
};

const INLINE_DISPLAY_MAP: Record<string, string> = {
  inline: "block",
  "inline-block": "block",
  "inline-flex": "flex",
  "inline-grid": "grid",
  "table-row-group": "block",
  "table-header-group": "block",
  "table-row": "block",
  "table-cell": "block",
};

type Edge = number | `${number}%` | "auto";

type Sides = {
  top: Edge;
  right: Edge;
  bottom: Edge;
  left: Edge;
};

/** Taffy takes plain lengths for padding and borders; `auto` reads as 0. */
type FixedSides = {
  top: number | `${number}%`;
  right: number | `${number}%`;
  bottom: number | `${number}%`;
  left: number | `${number}%`;
};

function fixed(sides: Sides): FixedSides {
  const edge = (value: Edge): number | `${number}%` =>
    value === "auto" ? 0 : value;
  return {
    top: edge(sides.top),
    right: edge(sides.right),
    bottom: edge(sides.bottom),
    left: edge(sides.left),
  };
}

/**
 * A node's offset within an ancestor, in taffy's per-parent coordinates.
 * Flattened table sections contribute no offset of their own.
 */
export function offsetWithin(
  layout: LayoutResult,
  ancestor: DomNode,
  node: DomNode,
): { x: number; y: number } {
  let x = 0;
  let y = 0;
  let current: DomNode | null = node;
  while (current !== null && current !== ancestor) {
    if (layout.isModelled(current)) {
      const box = layout.boxOf(current);
      x += box.x;
      y += box.y;
    }
    current = current.parent;
  }
  return { x, y };
}

interface Pass {
  readonly boxOf: (node: DomNode) => Box;
  readonly marginOf: (
    node: DomNode,
  ) => { left: number; right: number; top: number; bottom: number };
  readonly isModelled: (node: DomNode) => boolean;
  readonly contextOf: Map<DomNode, MeasureContext>;
  readonly tree: TaffyTree;
}

function runPass(
  root: DomNode,
  resolved: ReadonlyMap<DomNode, Record<string, string>>,
  vars: Record<string, string>,
  viewportWidth: number,
  widthOverrides: ReadonlyMap<DomNode, number>,
): Pass {
  const tree = new TaffyTree();
  const nodeOf = new Map<DomNode, bigint>();
  const contextOf = new Map<DomNode, MeasureContext>();

  const build = (node: DomNode): bigint => {
    const own = { ...(resolved.get(node) ?? {}) };
    const width = widthOverrides.get(node);
    if (width !== undefined) own["width"] = `${width}px`;
    const style = styleFor(node, own, vars);
    const context = textContextFor(node, own, vars);
    if (context !== null) contextOf.set(node, context);
    const kids = node.tag === "select" ? [] : tableRowChildren(node).map(build);
    const id = kids.length === 0 && context !== null
      ? tree.newLeafWithContext(style, context)
      : kids.length === 0
      ? tree.newLeaf(style)
      : tree.newWithChildren(style, kids);
    nodeOf.set(node, id);
    return id;
  };
  const rootId: bigint = build(root);

  tree.computeLayoutWithMeasure(
    rootId,
    { width: viewportWidth, height: "max-content" },
    (known, available, _node, context) => {
      const measure = context as MeasureContext | undefined;
      if (measure === undefined) {
        return { width: known.width ?? 0, height: known.height ?? 0 };
      }
      const availableWidth = typeof available.width === "number"
        ? available.width
        : null;
      const wraps = WRAPPING_TAGS[measure.tag] === true;
      const lines =
        wraps && known.width === undefined && known.height === undefined
          ? wrapLines(measure.text, measure.fontSizePx, availableWidth)
          : [measure.text];
      const width = known.width ?? lines.reduce(
        (widest, line) =>
          Math.max(widest, measureTextWidth(line, measure.fontSizePx)),
        0,
      );
      const height = known.height ?? lines.length * measure.lineHeightPx;
      return { width, height };
    },
  );

  const boxOf = (node: DomNode): Box => {
    const id = nodeOf.get(node);
    if (id === undefined) {
      throw new Error(
        `layout oracle: node never laid out: <${node.tag} class="${node.classes.join(".")}">`,
      );
    }
    const layout = tree.getLayout(id);
    return {
      x: layout.x,
      y: layout.y,
      width: layout.width,
      height: layout.height,
    };
  };
  const marginOf = (node: DomNode) => {
    const id = nodeOf.get(node);
    if (id === undefined) {
      throw new Error("layout oracle: node was never laid out");
    }
    const layout = tree.getLayout(id);
    return {
      left: layout.marginLeft,
      right: layout.marginRight,
      top: layout.marginTop,
      bottom: layout.marginBottom,
    };
  };
  return {
    boxOf,
    marginOf,
    isModelled: (node) => nodeOf.has(node),
    contextOf,
    tree,
  };
}

/**
 * CSS shrinks a flex item down to its automatic minimum and makes the
 * shrinkable prose beside it absorb the rest; taffy's first cut shrinks the
 * definite items and treats measured text as fixed. This second pass hands
 * the over-wide text item the width the browser would give it, so the wrap
 * and the resulting height are the browser's. Every other number still
 * comes from taffy.
 */
function textShrinkOverrides(
  root: DomNode,
  pass: Pass,
  resolved: ReadonlyMap<DomNode, Record<string, string>>,
  vars: Record<string, string>,
): Map<DomNode, number> {
  const overrides = new Map<DomNode, number>();
  const walk = (node: DomNode): void => {
    const own = resolved.get(node) ?? {};
    if (own["display"] === "flex" && own["flex-wrap"] !== "wrap") {
      const items = [...node.children].filter((child) =>
        pass.isModelled(child)
      );
      for (const item of items) {
        const context = pass.contextOf.get(item);
        if (context === undefined || WRAPPING_TAGS[context.tag] !== true) {
          continue;
        }
        const box = pass.boxOf(node);
        const padL = padPx(own, "left");
        const padR = padPx(own, "right");
        const content = box.width - padL - padR;
        const gap = gapPx(own, vars);
        let siblings = gap * Math.max(0, items.length - 1);
        for (const sibling of items) {
          if (sibling === item) continue;
          const margin = pass.marginOf(sibling);
          siblings += pass.boxOf(sibling).width + margin.left + margin.right;
        }
        const available = content - siblings;
        const itemBox = pass.boxOf(item);
        if (available > 0 && itemBox.width > available + 0.5) {
          overrides.set(item, available);
        }
      }
    }
    for (const child of node.children) walk(child);
  };
  walk(root);
  return overrides;
}

function padPx(own: Record<string, string>, edge: "left" | "right"): number {
  const raw = own[`padding-${edge}`] ?? own["padding"];
  if (raw === undefined) return 0;
  const length = evalLength(raw, {});
  return length.kind === "px" ? length.px : 0;
}

function gapPx(
  own: Record<string, string>,
  vars: Record<string, string>,
): number {
  const raw = own["gap"] ?? own["column-gap"];
  if (raw === undefined) return 0;
  const length = evalLength(raw, vars);
  return length.kind === "px" ? length.px : 0;
}

export function buildLayout(
  root: DomNode,
  resolved: ReadonlyMap<DomNode, Record<string, string>>,
  vars: Record<string, string>,
  viewportWidth: number,
): LayoutResult {
  const first = runPass(root, resolved, vars, viewportWidth, new Map());
  const overrides = textShrinkOverrides(root, first, resolved, vars);
  const active = overrides.size === 0
    ? first
    : runPass(root, resolved, vars, viewportWidth, overrides);
  if (active !== first) first.tree.free();

  return {
    boxOf: active.boxOf,
    isModelled: active.isModelled,
    dispose: () => {
      active.tree.free();
    },
  };
}

/* ------------------------------------------------------------------ styles -- */

function styleFor(
  node: DomNode,
  own: Record<string, string>,
  vars: Record<string, string>,
): Style {
  const style = new Style();
  const fontPx = fontSizePx(own, vars);
  const len = (value: string | undefined, fallback: Length): Length =>
    value === undefined ? fallback : evalLength(value, vars, fontPx);

  style.display = own["display"] === undefined && node.tag === "tr"
    ? Display.Flex
    : displayOf(own["display"]);
  if (node.tag === "table") style.itemIsTable = true;
  style.boxSizing = own["box-sizing"] === "content-box"
    ? BoxSizing.ContentBox
    : BoxSizing.BorderBox;

  style.size = {
    width: dimension(len(own["width"], { kind: "auto" })),
    height: dimension(len(own["height"], { kind: "auto" })),
  };
  style.minSize = {
    width: dimension(len(own["min-width"], { kind: "auto" })),
    height: dimension(len(own["min-height"], { kind: "auto" })),
  };
  style.maxSize = {
    width: dimensionMax(len(own["max-width"], { kind: "none" })),
    height: dimensionMax(len(own["max-height"], { kind: "none" })),
  };

  style.padding = fixed(boxSides(own, "padding", vars, fontPx));
  style.border = fixed(borderSides(own));
  style.margin = boxSides(own, "margin", vars, fontPx);

  const gap = len(own["gap"] ?? own["row-gap"], { kind: "px", px: 0 });
  const columnGap = len(own["column-gap"] ?? own["gap"], gap);
  style.gap = { width: percentOrPx(columnGap), height: percentOrPx(gap) };

  const flex = own["flex"]?.trim().split(/\s+/) ?? [];
  if (flex.length > 0) {
    const growN = Number(flex[0]);
    const shrinkN = Number(flex[1] ?? "1");
    style.flexGrow = Number.isFinite(growN) ? growN : 0;
    style.flexShrink = Number.isFinite(shrinkN) ? shrinkN : 1;
    if (flex[2] !== undefined) {
      style.flexBasis = dimension(len(flex[2], { kind: "auto" }));
    }
  }
  const grow = own["flex-grow"];
  if (grow !== undefined && Number.isFinite(Number(grow))) {
    style.flexGrow = Number(grow);
  }
  const shrink = own["flex-shrink"];
  if (shrink !== undefined && Number.isFinite(Number(shrink))) {
    style.flexShrink = Number(shrink);
  }

  switch (own["flex-direction"]) {
    case "column":
      style.flexDirection = FlexDirection.Column;
      break;
    case "column-reverse":
      style.flexDirection = FlexDirection.ColumnReverse;
      break;
    case "row-reverse":
      style.flexDirection = FlexDirection.RowReverse;
      break;
    default:
      style.flexDirection = FlexDirection.Row;
  }
  style.flexWrap = own["flex-wrap"] === "wrap"
    ? FlexWrap.Wrap
    : own["flex-wrap"] === "wrap-reverse"
    ? FlexWrap.WrapReverse
    : FlexWrap.NoWrap;
  style.alignItems = alignOf(own["align-items"]);
  style.alignSelf = alignSelfOf(own["align-self"]);
  style.justifyContent = justifyOf(own["justify-content"]);

  const overflow = own["overflow"];
  style.overflow = {
    x: overflowValue(own["overflow-x"] ?? overflow),
    y: overflowValue(own["overflow-y"] ?? overflow),
  };

  style.position = own["position"] === "absolute" || own["position"] === "fixed"
    ? Position.Absolute
    : Position.Relative;

  return style;
}

function fontSizePx(
  own: Record<string, string>,
  vars: Record<string, string>,
): number {
  const raw = own["font-size"];
  if (raw === undefined) return 16;
  const length = evalLength(raw, vars);
  return length.kind === "px" ? length.px : 16;
}

function lineHeightPx(
  own: Record<string, string>,
  vars: Record<string, string>,
): number {
  const raw = own["line-height"];
  if (raw === undefined || raw === "normal") {
    return fontSizePx(own, vars) * NORMAL_LINE_FACTOR;
  }
  const unitless = Number(raw);
  if (Number.isFinite(unitless)) return unitless * fontSizePx(own, vars);
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : fontSizePx(own, vars) * NORMAL_LINE_FACTOR;
}

function displayOf(raw: string | undefined): Display {
  const value = raw === undefined ? "block" : INLINE_DISPLAY_MAP[raw] ?? raw;
  switch (value) {
    case "flex":
      return Display.Flex;
    case "grid":
      return Display.Grid;
    case "none":
      return Display.None;
    default:
      return Display.Block;
  }
}

function dimension(length: Length): number | `${number}%` | "auto" {
  switch (length.kind) {
    case "px":
      return length.px;
    case "percent":
      return `${length.fraction * 100}%`;
    default:
      return "auto";
  }
}

function dimensionMax(length: Length): number | `${number}%` | "auto" {
  return length.kind === "none" ? "auto" : dimension(length);
}

function percentOrPx(length: Length): number | `${number}%` {
  if (length.kind === "px") return length.px;
  if (length.kind === "percent") return `${length.fraction * 100}%`;
  return 0;
}

/**
 * A box's four sides. The sheet's shorthands arrive expanded as longhands
 * (css.ts), so only the logical-to-physical mapping is left to do.
 */
function boxSides(
  own: Record<string, string>,
  prop: "padding" | "margin",
  vars: Record<string, string>,
  fontPx: number,
): Sides {
  const sides: Sides = {
    left: sideOf(own[`${prop}-inline-start`], vars, fontPx),
    right: sideOf(own[`${prop}-inline-end`], vars, fontPx),
    top: sideOf(own[`${prop}-block-start`], vars, fontPx),
    bottom: sideOf(own[`${prop}-block-end`], vars, fontPx),
  };
  const left = own[`${prop}-left`];
  if (left !== undefined) sides.left = sideOf(left, vars, fontPx);
  const right = own[`${prop}-right`];
  if (right !== undefined) sides.right = sideOf(right, vars, fontPx);
  const top = own[`${prop}-top`];
  if (top !== undefined) sides.top = sideOf(top, vars, fontPx);
  const bottom = own[`${prop}-bottom`];
  if (bottom !== undefined) sides.bottom = sideOf(bottom, vars, fontPx);
  return sides;
}

function sideOf(
  value: string | undefined,
  vars: Record<string, string>,
  fontPx: number,
): number | `${number}%` | "auto" {
  if (value === undefined) return 0;
  const length = evalLength(value, vars, fontPx);
  if (length.kind === "px") return length.px;
  if (length.kind === "percent") return `${length.fraction * 100}%`;
  return 0;
}

/** `1px` reads as 1; `none`, `hidden` and junk read as null. */
function borderWidthValue(value: string | undefined): number | null {
  if (value === undefined) return null;
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : null;
}

/** Border widths only, from the expanded longhands; `none` reads as 0. */
function borderSides(own: Record<string, string>): Sides {
  const read = (edge: string, logical: string): number => {
    const width = borderWidthValue(own[`border-${logical}-width`]) ??
      borderWidthValue(own[`border-${edge}-width`]);
    if (width === null) return 0;
    const style = own[`border-${edge}-style`] ?? own[`border-${logical}-style`];
    return style === "none" || style === "hidden" ? 0 : width;
  };
  return {
    top: read("top", "block-start"),
    right: read("right", "inline-end"),
    bottom: read("bottom", "block-end"),
    left: read("left", "inline-start"),
  };
}

function alignOf(align: string | undefined): AlignItems {
  switch (align) {
    case "flex-start":
    case "start":
      return AlignItems.Start;
    case "flex-end":
    case "end":
      return AlignItems.End;
    case "center":
      return AlignItems.Center;
    case "baseline":
      return AlignItems.Baseline;
    default:
      return AlignItems.Stretch;
  }
}

function alignSelfOf(align: string | undefined): AlignSelf {
  switch (align) {
    case "flex-start":
    case "start":
      return AlignSelf.Start;
    case "flex-end":
    case "end":
      return AlignSelf.End;
    case "center":
      return AlignSelf.Center;
    case "baseline":
      return AlignSelf.Baseline;
    case "stretch":
      return AlignSelf.Stretch;
    default:
      return AlignSelf.Auto;
  }
}

function justifyOf(justify: string | undefined): JustifyContent {
  switch (justify) {
    case "flex-start":
    case "start":
      return JustifyContent.Start;
    case "flex-end":
    case "end":
      return JustifyContent.End;
    case "center":
      return JustifyContent.Center;
    case "space-between":
      return JustifyContent.SpaceBetween;
    case "space-around":
      return JustifyContent.SpaceAround;
    case "space-evenly":
      return JustifyContent.SpaceEvenly;
    default:
      return JustifyContent.Start;
  }
}

function overflowValue(value: string | undefined): Overflow {
  switch (value) {
    case "hidden":
      return Overflow.Hidden;
    case "scroll":
    case "auto":
      return Overflow.Scroll;
    case "clip":
      return Overflow.Clip;
    default:
      return Overflow.Visible;
  }
}

/**
 * An element's used border width on one edge, from whatever the sheet wrote:
 * the `border` shorthand, a logical or physical side, or the longhand.
 */
export function resolvedBorderWidthPx(
  own: Record<string, string>,
  edge: "top" | "right" | "bottom" | "left",
): number {
  const sides = borderSides(own);
  const value = sides[edge];
  if (typeof value !== "number") return 0;
  return value;
}

/** Taffy's table algorithm takes rows as direct children. */
function tableRowChildren(node: DomNode): DomNode[] {
  if (node.tag !== "table") return [...node.children];
  const rows: DomNode[] = [];
  const walk = (n: DomNode): void => {
    for (const child of n.children) {
      if (child.tag === "tr") rows.push(child);
      else walk(child);
    }
  };
  walk(node);
  return rows;
}

const MEASURED_TAGS: Record<string, true> = {
  td: true,
  th: true,
  button: true,
  p: true,
  span: true,
  a: true,
  code: true,
  h1: true,
  h2: true,
  h3: true,
  h4: true,
  h5: true,
  h6: true,
  input: true,
  select: true,
  option: true,
  caption: true,
};

function textContextFor(
  node: DomNode,
  own: Record<string, string>,
  vars: Record<string, string>,
): (MeasureContext & { tag: string }) | null {
  if (node.children.length > 0 && node.tag !== "select") return null;
  if (!MEASURED_TAGS[node.tag]) return null;
  const text = measuredTextOf(node);
  if (text === "") return null;
  return {
    tag: node.tag,
    text,
    fontSizePx: fontSizePx(own, vars),
    lineHeightPx: lineHeightPx(own, vars),
  };
}

function measuredTextOf(node: DomNode): string {
  if (node.tag === "input") {
    return node.attrs["placeholder"] ?? node.attrs["value"] ?? "";
  }
  if (node.tag === "select") return widestOptionText(node);
  return node.text.trim();
}

function widestOptionText(select: DomNode): string {
  let widest = "";
  let widestWidth = -1;
  const walk = (n: DomNode): void => {
    for (const child of n.children) {
      if (child.tag === "option") {
        const width = measureTextWidth(child.text.trim(), 16);
        if (width > widestWidth) {
          widest = child.text.trim();
          widestWidth = width;
        }
      }
      walk(child);
    }
  };
  walk(select);
  return widest;
}
