/** Signature-pad machine: idle/drawing over Zag's two states. */

import { getStroke } from "perfect-freehand";
import { defaultTwin } from "@spin/runtime";
import { createMachine, type Machine } from "@spin/runtime/fsm";

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

/**
 * The signature-pad's arguments: the values the host may set.
 *
 * The twin (`defaultPaths`) is resolved by the framework before the factory
 * is called, so the machine only ever sees the live value.
 */
export interface SignaturePadArgs {
  paths?: string | readonly string[];
  disabled?: boolean;
  readOnly?: boolean;
  drawing?: unknown;
  defaultReadOnly?: boolean;
}

/** Paths off any transport: well-shaped string lists only (the grammar
 * coerces `= []` to `["[]"]`), anything else is empty. */
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

/** The machine's context, from its arguments: the committed paths, the
 * pad's own flags, and the stroke tuning the opaque `drawing` prop names.
 *
 * The seed twin (`defaultPaths`) is the host's write of the paths — the
 * framework resolved it into the args — so it counts as a write too.
 */
export function initial(args: SignaturePadArgs, authored: (name: string) => boolean): SignaturePadContext {
  // A host that wrote `defaultPaths` wrote the channel too.
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
  };
}

/** The tuning off the opaque `drawing` prop: numbers by name, nothing else. */
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

export function signaturePad(
  args: SignaturePadArgs = {},
  authored: (name: string) => boolean,
): Machine<SignaturePadContext, SignaturePadEvent> {
  return createMachine<SignaturePadContext, SignaturePadEvent>({
    id: "signature-pad",
    initial: "idle",
    /**
     * The machine's contract with its hosts: the context fields a host may
     * write, and the event each write carries. A field with an event is
     * REPORTED — the machine decides, and the change reaches the host; a
     * field without one is SILENT.
     */
    fields: {
      paths: { event: "SET_PATHS" },
      disabled: {},
      readOnly: {},
    },
    context: initial(args, authored),
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
        // The paths arrive the way the host wrote them; the machine shapes them.
        return { paths: pathsOf(event.paths) };
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
  });
}
