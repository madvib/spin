import { coerceJsonArray, defaultTwin } from "@spin/runtime";

export type SplitterState = "idle" | "hover" | "focused" | "dragging";

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
  size: number[];
  drag: SplitterDragState | null;
  focusedHandle: string | null;
  keyboardResizeBy: number;
  orientation: "horizontal" | "vertical";
  disabled: boolean;
  beforeCollapse: Record<string, number>;
}

export interface SplitterArgs {
  panels?: string;
  size?: string;
  orientation?: string;
  disabled?: boolean;
  defaultDisabled?: boolean;
}

const PRECISION = 10;

function fuzzyCompare(actual: number, expected: number): number {
  if (actual.toFixed(PRECISION) === expected.toFixed(PRECISION)) return 0;
  return actual > expected ? 1 : -1;
}

export function fuzzyEqual(actual: number | undefined, expected: number | undefined): boolean {
  if (actual === undefined || expected === undefined) return false;
  return fuzzyCompare(actual, expected) === 0;
}

export function fuzzySizeEqual(a: readonly number[], b: readonly number[]): boolean {
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

export function resizeByDelta(
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

  let applied = 0;
  const pivot = delta < 0 ? first : second;
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

export function pivotOf(panels: SplitterPanel[], index: number): [number, number] {
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

export function splitHandle(id: string): [string, string] {
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

interface PanelEntryShape {
  readonly id: string;
  readonly [field: string]: unknown;
}

function isPanelEntry(raw: unknown): raw is PanelEntryShape {
  if (typeof raw !== "object" || raw === null || !("id" in raw)) return false;
  const id: unknown = (raw as Record<string, unknown>).id;
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

const sizesOf = (raw: unknown): number[] | null => {
  const list: readonly unknown[] = Array.isArray(raw)
    ? raw
    : coerceJsonArray(typeof raw === "string" ? raw : null, []);
  if (list.length === 0) return null;
  if (!list.every((item): item is number => typeof item === "number" && Number.isFinite(item))) return null;
  return [...list];
};

export { sizesOf };

export function initial(args: SplitterArgs = {}, authored: (name: string) => boolean): SplitterContext {
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
    beforeCollapse: {},
  };
}
