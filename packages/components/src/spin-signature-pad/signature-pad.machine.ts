/**
 * Signature-pad machine: idle/drawing over Zag's two states.
 *
 * Stroke ink is `perfect-freehand`'s pure `getStroke` (imported directly
 * from its ESM bundle — no DOM in that module, only point math); the SVG
 * outline is Zag's own `getSvgPathFromStroke`, vendored below because it is
 * 30 lines of string building. The machine owns no stroke math of its own.
 *
 * Context stays serializable for the scope channel: points and paths are
 * values, the tuning is a value. Guards sit where Zag put them:
 * POINTER_DOWN draws only when interactive; moves with no active stroke are
 * refused; POINTER_UP with no stroke is a no-op.
 */

import { getStroke } from "perfect-freehand";

/** A stroke sample: canvas-relative position plus pointer pressure. */
export interface SignaturePoint {
  readonly x: number;
  readonly y: number;
  readonly pressure: number;
}

/** perfect-freehand's tuning surface; mirrors Zag's DrawingOptions minus
 * fill (a view concern — the recipe paints the stroke). */
export interface DrawingTuning {
  readonly size: number;
  readonly simulatePressure: boolean;
  readonly thinning: number;
  readonly smoothing: number;
  readonly streamline: number;
}

export const defaultTuning: DrawingTuning = {
  size: 2,
  simulatePressure: false,
  thinning: 0.7,
  smoothing: 0.4,
  streamline: 0.6,
};

export interface SignaturePadContext {
  paths: string[];
  currentPoints: SignaturePoint[];
  currentPath: string | null;
  disabled: boolean;
  readOnly: boolean;
  tuning: DrawingTuning;
}

export type SignaturePadEvent =
  | { type: "POINTER_DOWN"; point: SignaturePoint }
  | { type: "POINTER_MOVE"; point: SignaturePoint }
  | { type: "POINTER_UP" }
  | { type: "CLEAR" }
  | { type: "SET_PATHS"; paths: string[] }
  | { type: "SET_DISABLED"; disabled: boolean }
  | { type: "SET_READ_ONLY"; readOnly: boolean }
  | { type: "SET_TUNING"; tuning: Partial<DrawingTuning> };

export type SignaturePadDrawDetails = {
  readonly paths: string[];
  readonly currentPath: string | null;
};

export interface SignaturePadInitial {
  readonly paths?: unknown;
  readonly defaultPaths?: unknown;
  readonly disabled?: unknown;
  readonly readOnly?: unknown;
  readonly drawing?: unknown;
}

/** Seed shaping: authored paths win, else their default, else empty.
 * The tuning rides the opaque `drawing` prop — shaped here where the
 * numbers are named, not in the bags. */
/** Paths off any transport: well-shaped string lists only (the grammar
 * coerces `= []` to `["[]"]`), anything else is empty. The machine and the
 * reconcile share it. */
export function pathsOf(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.every((item): item is string => typeof item === "string") ? [...value] : [];
  }
  if (typeof value !== "string" || value.length === 0) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) && parsed.every((item): item is string => typeof item === "string")
      ? [...parsed]
      : [];
  } catch {
    return [];
  }
}

/** Two path lists are one selection when every path matches in order. */
export function samePaths(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((path, index) => path === b[index]);
}

export function initial(raw: SignaturePadInitial): Omit<SignaturePadContext, "currentPoints" | "currentPath"> {
  return {
    paths: pathsOf(raw.paths).length > 0 ? pathsOf(raw.paths) : pathsOf(raw.defaultPaths),
    disabled: raw.disabled === true,
    readOnly: raw.readOnly === true,
    tuning: { ...defaultTuning, ...tuningOf(raw.drawing) },
  };
}

/** The tuning off the opaque `drawing` prop: numbers by name, nothing
 * else. The seed and the reconcile share it — both name the fields once. */
export function tuningOf(value: unknown): Partial<DrawingTuning> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  const bag: Record<string, unknown> = { ...value };
  const count = (field: unknown): number | null =>
    typeof field === "number" && Number.isFinite(field) ? field : null;
  const size = count(bag["size"]);
  const thinning = count(bag["thinning"]);
  const smoothing = count(bag["smoothing"]);
  const streamline = count(bag["streamline"]);
  const simulate = bag["simulatePressure"];
  return {
    ...(size === null ? {} : { size }),
    ...(thinning === null ? {} : { thinning }),
    ...(smoothing === null ? {} : { smoothing }),
    ...(streamline === null ? {} : { streamline }),
    ...(typeof simulate === "boolean" ? { simulatePressure: simulate } : {}),
  };
}

/** Zag's get-svg-path, vendored: outline points to a closed SVG path. */
export function svgPathFromStroke(points: readonly (readonly number[])[], closed = true): string {
  const len = points.length;
  if (len < 4) return "";
  const average = (a: number, b: number): number => (a + b) / 2;
  const ax = points[0]?.[0] ?? 0;
  const ay = points[0]?.[1] ?? 0;
  const bx = points[1]?.[0] ?? 0;
  const by = points[1]?.[1] ?? 0;
  const cx = points[2]?.[0] ?? 0;
  const cy = points[2]?.[1] ?? 0;
  let result =
    `M${ax.toFixed(2)},${ay.toFixed(2)} Q${bx.toFixed(2)},${by.toFixed(2)} ` +
    `${average(bx, cx).toFixed(2)},${average(by, cy).toFixed(2)} T`;
  for (let i = 2, max = len - 1; i < max; i += 1) {
    const a = points[i] ?? [0, 0];
    const b = points[i + 1] ?? [0, 0];
    result += `${average(a[0] ?? 0, b[0] ?? 0).toFixed(2)},${average(a[1] ?? 0, b[1] ?? 0).toFixed(2)} `;
  }
  if (closed) result += "Z";
  return result;
}

function strokePath(points: readonly SignaturePoint[], tuning: DrawingTuning): string {
  const outline = (getStroke as unknown as (points: readonly { x: number; y: number; pressure: number }[], options: Record<string, unknown>) => number[][])(
    points.map((p) => ({ x: p.x, y: p.y, pressure: p.pressure })),
    {
      size: tuning.size,
      simulatePressure: tuning.simulatePressure,
      thinning: tuning.thinning,
      smoothing: tuning.smoothing,
      streamline: tuning.streamline,
    },
  ) as number[][];
  return svgPathFromStroke(outline);
}

export function isInteractive(ctx: SignaturePadContext): boolean {
  return !ctx.disabled && !ctx.readOnly;
}

export function isEmpty(ctx: SignaturePadContext): boolean {
  return ctx.paths.length === 0;
}

export const config = {
  id: "signature-pad",
  initial: "idle",
  context: {
    paths: [] as string[],
    currentPoints: [] as SignaturePoint[],
    currentPath: null as string | null,
    disabled: false,
    readOnly: false,
    tuning: { ...defaultTuning },
  },
  on: {
    CLEAR: {
      target: "idle",
      actions: [{ assign: "clearAll" }],
    },
    SET_PATHS: { actions: [{ assign: "setPaths" }] },
    SET_DISABLED: { actions: [{ assign: "setDisabled" }] },
    SET_READ_ONLY: { actions: [{ assign: "setReadOnly" }] },
    SET_TUNING: { actions: [{ assign: "setTuning" }] },
  },
  states: {
    idle: {
      on: {
        POINTER_DOWN: [
          {
            cond: "isInteractive",
            target: "drawing",
            actions: [{ assign: "startStroke" }],
          },
        ],
      },
    },
    drawing: {
      on: {
        POINTER_MOVE: { actions: [{ assign: "addPoint" }] },
        POINTER_UP: { target: "idle", actions: [{ assign: "endStroke" }] },
      },
    },
  },
};

export const implementations = {
  conds: {
    isInteractive: (ctx: SignaturePadContext): boolean => isInteractive(ctx),
  },
  assigns: {
    startStroke: (ctx: SignaturePadContext, event: SignaturePadEvent): Partial<SignaturePadContext> => {
      if (event.type !== "POINTER_DOWN") return {};
      const currentPoints = [event.point];
      return { currentPoints, currentPath: strokePath(currentPoints, ctx.tuning) };
    },
    addPoint: (ctx: SignaturePadContext, event: SignaturePadEvent): Partial<SignaturePadContext> => {
      if (event.type !== "POINTER_MOVE") return {};
      const currentPoints = [...ctx.currentPoints, event.point];
      return { currentPoints, currentPath: strokePath(currentPoints, ctx.tuning) };
    },
    endStroke: (ctx: SignaturePadContext): Partial<SignaturePadContext> => {
      if (ctx.currentPath === null) return { currentPoints: [], currentPath: null };
      return {
        paths: [...ctx.paths, ctx.currentPath],
        currentPoints: [],
        currentPath: null,
      };
    },
    clearAll: (): Partial<SignaturePadContext> => ({ paths: [], currentPoints: [], currentPath: null }),
    setPaths: (ctx: SignaturePadContext, event: SignaturePadEvent): Partial<SignaturePadContext> => {
      if (event.type !== "SET_PATHS") return {};
      void ctx;
      return { paths: [...event.paths] };
    },
    setDisabled: (ctx: SignaturePadContext, event: SignaturePadEvent): Partial<SignaturePadContext> => {
      if (event.type !== "SET_DISABLED") return {};
      void ctx;
      return { disabled: event.disabled };
    },
    setReadOnly: (ctx: SignaturePadContext, event: SignaturePadEvent): Partial<SignaturePadContext> => {
      if (event.type !== "SET_READ_ONLY") return {};
      void ctx;
      return { readOnly: event.readOnly };
    },
    setTuning: (ctx: SignaturePadContext, event: SignaturePadEvent): Partial<SignaturePadContext> => {
      if (event.type !== "SET_TUNING") return {};
      return { tuning: { ...ctx.tuning, ...event.tuning } };
    },
  },
};
