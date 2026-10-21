/** Splitter machine: idle/hover/focus/dragging over four states. */
import { coerceJsonArray, defaultTwin } from "@spin/runtime";
import { createMachine, type Machine, type EventUnion } from "@spin/runtime/fsm";
const setFocusedHandle = (ctx: SplitterContext, event: EventUnion<SplitterEvents>) : Partial<SplitterContext> => {
        if (event.type !== "POINTER_OVER" && event.type !== "FOCUS") return {};
        void ctx;
        return { focusedHandle: event.id };
      };

const startDrag = (ctx: SplitterContext, event: EventUnion<SplitterEvents>) : Partial<SplitterContext> => {
        if (event.type !== "POINTER_DOWN") return {};
        const [beforeId, afterId] = splitHandle(event.id);
        const before = ctx.panels.findIndex((panel) => panel.id === beforeId);
        const after = ctx.panels.findIndex((panel) => panel.id === afterId);
        if (before < 0 || after < 0) return {};
        return {
          focusedHandle: event.id,
          drag: {
            handleId: event.id,
            beforeId,
            afterId,
            startPercent: event.startPercent,
            startSizes: [...ctx.size],
          },
        };
      };

const endDrag = () : Partial<SplitterContext> => { return ({ drag: null }); };



export interface SplitterPanel {
  readonly id: string;
  readonly minSize?: number | undefined;
  readonly maxSize?: number | undefined;
  readonly collapsible?: boolean | undefined;
  readonly collapsedSize?: number | undefined;
}

export interface SplitterDragState {
  readonly handleId: string;
  readonly beforeId: string;
  readonly afterId: string;
  readonly startPercent: number;
  readonly startSizes: number[];
}

export interface SplitterContext {
  panels: SplitterPanel[];
  /** Percent sizes, summing to 100. */
  size: number[];
  drag: SplitterDragState | null;
  /** The focused handle id (`before:after`), null when none. */
  focusedHandle: string | null;
  keyboardResizeBy: number;
  orientation: "horizontal" | "vertical";
  disabled: boolean;
  /** The pre-collapse size per panel: expand restores it. */
  beforeCollapse: Record<string, number>;
}

export interface SplitterEvents {
  "SET_SIZE": { size: readonly number[] };
  "RESET_SIZE": {};
  "COLLAPSE_PANEL": { id: string };
  "EXPAND_PANEL": { id: string; minSize?: number };
  "RESIZE_PANEL": { id: string; size: number };
  "POINTER_OVER": { id: string };
  "POINTER_LEAVE": {};
  "FOCUS": { id: string };
  "BLUR": {};
  "POINTER_DOWN": { id: string; startPercent: number };
  "POINTER_MOVE": { percent: number };
  "POINTER_UP": { handleFocused: boolean };
  "KEYBOARD_MOVE": { id: string; delta: number };
  "ENTER": { id: string };
  "SET_PANELS": { panels: SplitterPanel[] };
  "SET_DISABLED": { disabled: boolean };
}

export type SplitterEvent = EventUnion<SplitterEvents>;


export type SplitterResizeDetails = {
  readonly size: number[];
  readonly handleId: string | null;
};

const PRECISION = 10;

function fuzzyCompare(actual: number, expected: number): number {
  if (actual.toFixed(PRECISION) === expected.toFixed(PRECISION)) return 0;
  return actual > expected ? 1 : -1;
}

function fuzzyEqual(actual: number | undefined, expected: number | undefined): boolean {
  if (actual === undefined || expected === undefined) return false;
  return fuzzyCompare(actual, expected) === 0;
}

function fuzzySizeEqual(a: readonly number[], b: readonly number[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((size, index) => fuzzyEqual(size, b[index]));
}

function clampPanel(panels: SplitterPanel[], index: number, size: number): number {
  const panel = panels[index];
  if (panel === undefined) return size;
  const collapsedSize = panel.collapsedSize ?? 0;
  const minSize = panel.minSize ?? 0;
  const maxSize = panel.maxSize ?? 100;
  if (fuzzyCompare(size, minSize) < 0) {
    if (panel.collapsible === true) {
      const halfway = (collapsedSize + minSize) / 2;
      size = fuzzyCompare(size, halfway) < 0 ? collapsedSize : minSize;
    } else {
      size = minSize;
    }
  }
  size = Math.min(maxSize, size);
  return parseFloat(size.toFixed(PRECISION));
}

export function validateSizes(panels: SplitterPanel[], size: readonly number[]): number[] {
  if (size.length !== panels.length) {
    throw new Error(`Invalid ${panels.length} panel size: ${size.map((s) => `${s}%`).join(", ")}`);
  }
  const next = [...size];
  const total = next.reduce((sum, value) => sum + value, 0);
  if (!fuzzyEqual(total, 100) && next.length > 0) {
    for (let index = 0; index < panels.length; index += 1) {
      next[index] = (100 / total) * (next[index] ?? 0);
    }
  }
  let remaining = 0;
  for (let index = 0; index < panels.length; index += 1) {
    const safe = clampPanel(panels, index, next[index] ?? 0);
    if ((next[index] ?? 0) !== safe) {
      remaining += (next[index] ?? 0) - safe;
      next[index] = safe;
    }
  }
  if (!fuzzyEqual(remaining, 0)) {
    for (let index = 0; index < panels.length; index += 1) {
      const prev = next[index] ?? 0;
      const safe = clampPanel(panels, index, prev + remaining);
      if (prev !== safe) {
        remaining -= safe - prev;
        next[index] = safe;
        if (fuzzyEqual(remaining, 0)) break;
      }
    }
  }
  return next;
}

type Trigger = "imperative-api" | "keyboard" | "mouse-or-touch";

function resizeByDelta(
  panels: SplitterPanel[],
  delta: number,
  initialSize: readonly number[],
  pivotIndices: readonly number[],
  prevSize: readonly number[],
  trigger: Trigger,
): number[] {
  if (fuzzyEqual(delta, 0)) return [...initialSize];
  const first = pivotIndices[0] ?? -1;
  const second = pivotIndices[1] ?? -1;
  if (first < 0 || second < 0) return [...prevSize];
  const next = [...initialSize];

  if (trigger === "keyboard") {
    // A collapsed panel expands to min on the first nudge; a panel at min
    // collapses instead of shrinking past it.
    const expandIndex = delta < 0 ? second : first;
    const expandPanel = panels[expandIndex];
    if (expandPanel?.collapsible === true) {
      const prev = initialSize[expandIndex] ?? 0;
      if (fuzzyEqual(prev, expandPanel.collapsedSize ?? 0)) {
        const local = (expandPanel.minSize ?? 0) - prev;
        if (fuzzyCompare(local, Math.abs(delta)) > 0) delta = delta < 0 ? -local : local;
      }
    }
    const collapseIndex = delta < 0 ? first : second;
    const collapsePanel = panels[collapseIndex];
    if (collapsePanel?.collapsible === true) {
      const prev = initialSize[collapseIndex] ?? 0;
      if (fuzzyEqual(prev, collapsePanel.minSize ?? 0)) {
        const local = prev - (collapsePanel.collapsedSize ?? 0);
        if (fuzzyCompare(local, Math.abs(delta)) > 0) delta = delta < 0 ? -local : local;
      }
    }
  }

  // Clamp the delta to what the far side can absorb.
  const increment = delta < 0 ? 1 : -1;
  let cursor = delta < 0 ? second : first;
  let absorbable = 0;
  while (true) {
    const prev = initialSize[cursor] ?? 0;
    const room = clampPanel(panels, cursor, 100) - prev;
    absorbable += room;
    cursor += increment;
    if (cursor < 0 || cursor >= panels.length) break;
  }
  const clamped = Math.min(Math.abs(delta), Math.abs(absorbable));
  delta = delta < 0 ? -clamped : clamped;

  // Take from the shrinking side.
  let applied = 0;
  let pivot = delta < 0 ? first : second;
  let index = pivot;
  while (index >= 0 && index < panels.length) {
    const remaining = Math.abs(delta) - Math.abs(applied);
    const prev = initialSize[index] ?? 0;
    const safe = clampPanel(panels, index, prev - remaining);
    if (!fuzzyEqual(prev, safe)) {
      applied += prev - safe;
      next[index] = safe;
      if (applied.toPrecision(3).localeCompare(Math.abs(delta).toPrecision(3), undefined, { numeric: true }) >= 0) break;
    }
    index += delta < 0 ? -1 : 1;
  }

  // Give to the growing side.
  const grow = delta < 0 ? second : first;
  const growPrev = initialSize[grow] ?? 0;
  const unsafe = growPrev + applied;
  const safe = clampPanel(panels, grow, unsafe);
  next[grow] = safe;
  if (!fuzzyEqual(safe, unsafe)) {
    let remaining = unsafe - safe;
    let spill = grow;
    while (spill >= 0 && spill < panels.length) {
      const spillPrev = next[spill] ?? 0;
      const spillSafe = clampPanel(panels, spill, spillPrev + remaining);
      if (!fuzzyEqual(spillPrev, spillSafe)) {
        remaining -= spillSafe - spillPrev;
        next[spill] = spillSafe;
      }
      if (fuzzyEqual(remaining, 0)) break;
      spill += delta > 0 ? -1 : 1;
    }
  }

  if (fuzzySizeEqual(prevSize, next)) return [...prevSize];
  const total = next.reduce((sum, value) => sum + value, 0);
  if (!fuzzyEqual(total, 100)) return [...prevSize];
  return next;
}

function pivotOf(panels: SplitterPanel[], index: number): [number, number] {
  return index === panels.length - 1 ? [index - 1, index] : [index, index + 1];
}

export function defaultSizes(count: number, spec: readonly number[]): number[] {
  const next: number[] = new Array<number>(count).fill(0);
  let remaining = 100;
  let unsized = 0;
  for (let index = 0; index < count; index += 1) {
    const given = spec[index];
    if (given !== undefined) {
      next[index] = given;
      remaining -= given;
    } else {
      unsized += 1;
    }
  }
  for (let index = 0; index < count; index += 1) {
    if (spec[index] === undefined) {
      next[index] = unsized > 0 ? remaining / unsized : 0;
      remaining -= next[index] ?? 0;
      unsized -= 1;
    }
  }
  return next;
}

export function handleId(beforeId: string, afterId: string): string {
  return `${beforeId}:${afterId}`;
}

function splitHandle(id: string): [string, string] {
  const pivot = id.indexOf(":");
  return [id.slice(0, pivot), id.slice(pivot + 1)];
}

export function isInteractive(ctx: SplitterContext): boolean {
  return !ctx.disabled;
}

export function panelCollapsed(panels: SplitterPanel[], size: readonly number[], id: string): boolean {
  const panel = panels.find((candidate) => candidate.id === id);
  if (panel?.collapsible !== true) return false;
  const index = panels.findIndex((candidate) => candidate.id === id);
  return fuzzyEqual(size[index], panel.collapsedSize ?? 0);
}

/**
 * The splitter's arguments: the values the host may set.
 *
 * The twins (`defaultPanels`, `defaultSize`) are resolved by the framework
 * before the factory is called, so the machine only ever sees the live
 * values.
 *
 * The wire types are the scope's own: the panel tree and the sizes are
 * JSON text, the rest are the plain words the scope declares.
 */
export interface SplitterArgs {
  panels?: string;
  size?: string;
  orientation?: string;
  disabled?: boolean;
  defaultDisabled?: boolean;
}

interface PanelEntryShape { readonly id: string; readonly [field: string]: unknown }
function isPanelEntry(raw: unknown): raw is PanelEntryShape {
  if (typeof raw !== "object" || raw === null || !("id" in raw)) return false;
  const id: unknown = raw.id;
  return typeof id === "string" && id.length > 0;
}

export function parsePanels(raw: unknown): SplitterPanel[] {
  const list: readonly unknown[] = Array.isArray(raw) ? raw : (typeof raw === "string" ? coerceJsonArray(raw, []) : []);
  const out: SplitterPanel[] = [];
  for (const item of list) {
    if (!isPanelEntry(item)) continue;
    const num = (name: "minSize" | "maxSize" | "collapsedSize"): number | undefined => {
      const v: unknown = item[name];
      return typeof v === "number" && Number.isFinite(v) ? v : undefined;
    };
    const bool = (name: "collapsible"): boolean | undefined => {
      const v: unknown = item[name];
      return typeof v === "boolean" ? v : undefined;
    };
    const minSize = num("minSize");
    const maxSize = num("maxSize");
    const collapsible = bool("collapsible");
    const collapsedSize = num("collapsedSize");
    out.push({
      id: item.id,
      ...(minSize === undefined ? {} : { minSize }),
      ...(maxSize === undefined ? {} : { maxSize }),
      ...(collapsible === undefined ? {} : { collapsible }),
      ...(collapsedSize === undefined ? {} : { collapsedSize }),
    });
  }
  return out;
}

/** The percent sizes, as the host wrote them: JSON text or a plain list.
 * Malformed or non-numeric is no sizes, not a throw. */
const sizesOf = (raw: unknown): number[] | null => {
  const list: readonly unknown[] = Array.isArray(raw)
    ? raw
    : coerceJsonArray(typeof raw === "string" ? raw : null, []);
  if (list.length === 0) return null;
  if (!list.every((item): item is number => typeof item === "number" && Number.isFinite(item))) return null;
  return [...list];
};

/**
 * The machine's context, built from its arguments: the panel tree and the
 * sizes the host wrote, shaped and laid out, and the machine's own
 * defaults for everything else.
 *
 * The seed twins (`defaultPanels`, `defaultSize`) are the host's writes of
 * the panels and the sizes — the framework resolved them into the args —
 * so they count as writes too.
 */
export function initial(args: SplitterArgs = {}, authored: (name: string) => boolean): SplitterContext {
  // A host that wrote `defaultPanels` (or `defaultSize`) wrote the
  // channel too.
  const written = (field: string): boolean =>
    authored(field) ||
    authored(defaultTwin(field)) ||
    (args as Record<string, unknown>)[defaultTwin(field)] !== undefined;
  const panels = written("panels") ? parsePanels(args.panels) : [];
  const spec = written("size") ? sizesOf(args.size) ?? [] : [];
  let size: number[];
  try {
    size = validateSizes(panels, defaultSizes(panels.length, spec));
  } catch {
    size = defaultSizes(panels.length, spec);
  }
  return {
    panels: [...panels],
    size,
    drag: null,
    focusedHandle: null,
    keyboardResizeBy: 1,
    orientation: args.orientation === "vertical" ? "vertical" : "horizontal",
    disabled: args.disabled === true,
    // The pre-collapse snapshot per panel: expand restores it.
    beforeCollapse: {},
  };
}

export function splitter(
  args: SplitterArgs = {},
  authored: (name: string) => boolean,
): Machine<SplitterContext, SplitterEvents> {
  return createMachine<SplitterContext, SplitterEvents>({
    id: "splitter",
    initial: "idle",
    context: initial(args, authored),
    /**
     * The machine's contract with its hosts: the context fields a host may
     * write, and the event each write carries. A field with an event is
     * REPORTED — the machine decides, and the change reaches the host; a
     * field without one is SILENT.
     */
    fields: {
      panels: { event: "SET_PANELS" },
      size: { event: "SET_SIZE" },
      orientation: {},
      disabled: {},
    },
    on: {
      SET_SIZE: { assign: (ctx, event) => {
        // The sizes arrive the way the host wrote them; the machine
        // shapes them.
        const written = sizesOf(event.size);
        if (written === null) return {};
        try {
          const safe = validateSizes(ctx.panels, written);
          return fuzzySizeEqual(ctx.size, safe) ? {} : { size: safe };
        } catch {
          return {};
        }
      } },
      RESET_SIZE: { assign: (ctx) => {
        const safe = validateSizes(ctx.panels, defaultSizes(ctx.panels.length, []));
        return { size: safe };
      } },
      COLLAPSE_PANEL: { assign: (ctx, event) => {
        const index = ctx.panels.findIndex((panel) => panel.id === event.id);
        const panel = ctx.panels[index];
        if (panel?.collapsible !== true) return {};
        const current = ctx.size[index] ?? 0;
        const collapsedSize = panel.collapsedSize ?? 0;
        if (fuzzyEqual(current, collapsedSize)) return {};
        const pivots = pivotOf(ctx.panels, index);
        const last = index === ctx.panels.length - 1;
        const delta = last ? current - collapsedSize : collapsedSize - current;
        const next = resizeByDelta(ctx.panels, delta, ctx.size, pivots, ctx.size, "imperative-api");
        if (fuzzySizeEqual(ctx.size, next)) return {};
        return { size: next, beforeCollapse: { ...ctx.beforeCollapse, [panel.id]: current } };
      } },
      EXPAND_PANEL: { assign: (ctx, event) => {
        const index = ctx.panels.findIndex((panel) => panel.id === event.id);
        const panel = ctx.panels[index];
        if (panel?.collapsible !== true) return {};
        const current = ctx.size[index] ?? 0;
        const collapsedSize = panel.collapsedSize ?? 0;
        if (!fuzzyEqual(current, collapsedSize)) return {};
        const minSize = event.minSize ?? panel.minSize ?? 0;
        const remembered = ctx.beforeCollapse[panel.id];
        const base = remembered !== undefined && remembered >= minSize ? remembered : minSize;
        const last = index === ctx.panels.length - 1;
        const delta = last ? current - base : base - current;
        const pivots = pivotOf(ctx.panels, index);
        const next = resizeByDelta(ctx.panels, delta, ctx.size, pivots, ctx.size, "imperative-api");
        return fuzzySizeEqual(ctx.size, next) ? {} : { size: next };
      } },
      RESIZE_PANEL: { assign: (ctx, event) => {
        const index = ctx.panels.findIndex((panel) => panel.id === event.id);
        if (ctx.panels[index] === undefined) return {};
        const current = ctx.size[index] ?? 0;
        const last = index === ctx.panels.length - 1;
        const delta = last ? current - event.size : event.size - current;
        const next = resizeByDelta(ctx.panels, delta, ctx.size, pivotOf(ctx.panels, index), ctx.size, "imperative-api");
        return fuzzySizeEqual(ctx.size, next) ? {} : { size: next };
      } },
      SET_PANELS: { assign: (ctx, event) => {
        void ctx;
        // The tree arrives the way the host wrote it; the machine shapes it.
        return { panels: parsePanels(event.panels) };
      } },
      SET_DISABLED: { assign: (ctx, event) => {
        void ctx;
        return { disabled: event.disabled === true };
      } },
    },
    states: {
      idle: {
        entry: [{ assign: () => { return ({ drag: null }); } }, { assign: () => { return ({ focusedHandle: null }); } }],
        on: {
          POINTER_OVER: { target: "hover", assign: setFocusedHandle },
          FOCUS: { target: "focused", assign: setFocusedHandle },
          POINTER_DOWN: { target: "dragging", assign: startDrag },
        },
      },
      hover: {
        on: {
          FOCUS: { target: "focused", assign: setFocusedHandle },
          POINTER_DOWN: { target: "dragging", assign: startDrag },
          POINTER_LEAVE: { target: "idle" },
        },
      },
      focused: {
        on: {
          BLUR: { target: "idle" },
          ENTER: { assign: (ctx, event) => {
        const [beforeId] = splitHandle(event.id);
        const index = ctx.panels.findIndex((panel) => panel.id === beforeId);
        const panel = ctx.panels[index];
        if (panel?.collapsible !== true) return {};
        const collapsedSize = panel.collapsedSize ?? 0;
        const current = ctx.size[index] ?? 0;
        const pivots = pivotOf(ctx.panels, index);
        if (fuzzyEqual(current, collapsedSize)) {
          // Expand: restore the pre-collapse snapshot when it still fits.
          const minSize = panel.minSize ?? 0;
          const remembered = ctx.beforeCollapse[panel.id];
          const base = remembered !== undefined && remembered >= minSize ? remembered : minSize;
          const last = index === ctx.panels.length - 1;
          const delta = last ? current - base : base - current;
          const next = resizeByDelta(ctx.panels, delta, ctx.size, pivots, ctx.size, "keyboard");
          return fuzzySizeEqual(ctx.size, next) ? {} : { size: next };
        }
        const next = resizeByDelta(
          ctx.panels,
          (index === ctx.panels.length - 1 ? current - collapsedSize : collapsedSize - current),
          ctx.size,
          pivots,
          ctx.size,
          "keyboard",
        );
        if (fuzzySizeEqual(ctx.size, next)) return {};
        return { size: next, beforeCollapse: { ...ctx.beforeCollapse, [panel.id]: current } };
      } },
          POINTER_DOWN: { target: "dragging", assign: startDrag },
          KEYBOARD_MOVE: { assign: (ctx, event) => {
        const [beforeId, afterId] = splitHandle(event.id);
        const before = ctx.panels.findIndex((panel) => panel.id === beforeId);
        const after = ctx.panels.findIndex((panel) => panel.id === afterId);
        if (before < 0 || after < 0) return {};
        const next = resizeByDelta(ctx.panels, event.delta, ctx.size, [before, after], ctx.size, "keyboard");
        return fuzzySizeEqual(ctx.size, next) ? {} : { size: next };
      } },
        },
      },
      dragging: {
        on: {
          POINTER_MOVE: { assign: (ctx, event) => {
        if (event.type !== "POINTER_MOVE" || ctx.drag === null) return {};
        const before = ctx.panels.findIndex((panel) => panel.id === ctx.drag?.beforeId);
        const after = ctx.panels.findIndex((panel) => panel.id === ctx.drag?.afterId);
        if (before < 0 || after < 0) return {};
        const delta = event.percent - (ctx.drag?.startPercent ?? 0);
        const next = resizeByDelta(
          ctx.panels,
          delta,
          ctx.drag?.startSizes ?? ctx.size,
          [before, after],
          ctx.size,
          "mouse-or-touch",
        );
        return fuzzySizeEqual(ctx.size, next) ? {} : { size: next };
      } },
          POINTER_UP: [
            { cond: (_ctx, event) => { return event.type === "POINTER_UP" ? event.handleFocused : false; }, target: "focused", assign: endDrag },
            { target: "idle", assign: endDrag },
          ],
        },
      },
    },});
}
