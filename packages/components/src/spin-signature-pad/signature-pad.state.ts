import { defaultTwin } from "@spin/runtime";
import { getStroke } from "perfect-freehand";

export interface SignaturePoint {
  readonly x: number;
  readonly y: number;
  readonly pressure: number;
}

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
  drawing: unknown;
  dir: "ltr" | "rtl";
}

export interface SignaturePadArgs {
  paths?: string | readonly string[];
  disabled?: boolean;
  readOnly?: boolean;
  drawing?: unknown;
  defaultReadOnly?: boolean;
  dir?: string;
}

export type SignaturePadState = "idle" | "drawing";

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

export function strokePath(points: readonly SignaturePoint[], tuning: DrawingTuning): string {
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

// (removed wrapper)

export function isInteractive(ctx: SignaturePadContext): boolean {
  return !ctx.disabled && !ctx.readOnly;
}

export function isEmpty(ctx: SignaturePadContext): boolean {
  return ctx.paths.length === 0;
}

export function initial(args: SignaturePadArgs, authored: (name: string) => boolean): SignaturePadContext {
  const written = (field: string): boolean =>
    authored(field) ||
    authored(defaultTwin(field)) ||
    (args as Record<string, unknown>)[defaultTwin(field)] !== undefined;
  return {
    paths: written("paths") ? pathsOf(args.paths) : [],
    currentPoints: [],
    currentPath: null,
    disabled: args.disabled === true,
    readOnly: args.readOnly === true,
    tuning: { ...defaultTuning, ...tuningOf(args.drawing) },
    drawing: args.drawing,
    dir: args.dir === "rtl" ? "rtl" : "ltr",
  };
}
