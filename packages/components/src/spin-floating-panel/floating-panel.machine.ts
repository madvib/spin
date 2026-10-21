
import { defaultTwin, isRecord } from "@spin/runtime";
import { createMachine, type Machine, type EventUnion, type MachineSpec } from "@spin/runtime/fsm";
const clearDragFrom = () : Partial<FloatingPanelContext> => { return ({ dragFrom: null }); };

const clearResizeFrom = () : Partial<FloatingPanelContext> => { return ({ resizeFrom: null, axis: null }); };


/**
 * Floating-panel machine, in zag's shape: `closed` / `open{ idle, dragging,
 * resizing }` with `stage` (minimized/maximized/restored) in context — the
 * stage is not a state because it gates transitions (a maximized panel
 * cannot drag) without changing which events exist.
 *
 * Position and size are continuous values reported through the geometry
 * channel as custom properties. The boundary clamp and the initial focus
 * are the connect's job — the machine's factory builds `position`/`size`
 * from the host's props.
 */

export type FloatingPanelStage = "minimized" | "maximized" | "restored";

export interface FloatingPanelSize {
  readonly w: number;
  readonly h: number;
}

export interface FloatingPanelContext {
  position: { readonly x: number; readonly y: number };
  size: FloatingPanelSize;
  restoreSize: FloatingPanelSize | null;
  restorePosition: { readonly x: number; readonly y: number } | null;
  stage: FloatingPanelStage;
  dragFrom: { readonly x: number; readonly y: number } | null;
  minSize: FloatingPanelSize;
  maxSize: FloatingPanelSize;
  resizeFrom: { readonly size: FloatingPanelSize; readonly position: { readonly x: number; readonly y: number } } | null;
  axis: { readonly x: -1 | 0 | 1; readonly y: -1 | 0 | 1 } | null;
  draggable: boolean;
  resizable: boolean;
  closeOnEscape: boolean;
  boundary: { readonly w: number; readonly h: number };
}

export interface FloatingPanelOpenChange {
  readonly open: boolean;
}

export interface FloatingPanelSizeChange {
  readonly size: FloatingPanelSize;
}

export interface FloatingPanelPositionChange {
  readonly position: { readonly x: number; readonly y: number };
}

/** A size off the transport: `{ w, h }` numbers or JSON text; anything else
 * is absent. */
export function sizeOf(raw: unknown): FloatingPanelSize | null {
  const shape = (value: unknown): FloatingPanelSize | null => {
    if (!isRecord(value)) return null;
    const w: unknown = value["w"];
    const h: unknown = value["h"];
    return typeof w === "number" && typeof h === "number" ? { w, h } : null;
  };
  if (typeof raw === "string") {
    if (raw.length === 0) return null;
    try {
      return shape(JSON.parse(raw));
    } catch {
      return null;
    }
  }
  return shape(raw);
}

const DEFAULT_SIZE: FloatingPanelSize = { w: 360, h: 240 };
const DEFAULT_MIN: FloatingPanelSize = { w: 120, h: 80 };
const DEFAULT_MAX: FloatingPanelSize = { w: 1024, h: 768 };

/** The floating-panel's arguments: the values the host may set. */
export interface FloatingPanelArgs {
  size?: string;
  minSize?: string;
  maxSize?: string;
  stage?: string;
  draggable?: boolean;
  resizable?: boolean;
  closeOnEscape?: boolean;
  defaultCloseOnEscape?: boolean;
}

export function initial(args: FloatingPanelArgs = {}, authored: (name: string) => boolean): FloatingPanelContext {
  // The twin is the framework's convention — a host that wrote
  // `defaultSize` wrote `size` too.
  const written = (field: string): boolean =>
    authored(field) ||
    authored(defaultTwin(field)) ||
    (args as Record<string, unknown>)[defaultTwin(field)] !== undefined;
  const stage: unknown = args.stage;
  return {
    position: { x: 0, y: 0 },
    size: written("size") ? sizeOf(args.size) ?? DEFAULT_SIZE : DEFAULT_SIZE,
    restoreSize: null,
    restorePosition: null,
    stage: stage === "minimized" || stage === "maximized" ? stage : "restored",
    dragFrom: null,
    minSize: sizeOf(args.minSize) ?? DEFAULT_MIN,
    maxSize: sizeOf(args.maxSize) ?? DEFAULT_MAX,
    resizeFrom: null,
    axis: null,
    draggable: written("draggable") ? args.draggable !== false : true,
    resizable: written("resizable") ? args.resizable !== false : true,
    closeOnEscape: written("closeOnEscape") ? args.closeOnEscape !== false : true,
    boundary: { w: 1024, h: 768 },
  };
}

/** The seeded open state: an authored open wins, else its default. */
export function startOpen(
  raw: Record<string, unknown>,
  authored: (name: string) => boolean,
): boolean {
  // The scope's `open` defaults to false, so it is never absent.
  return authored("open") ? raw["open"] === true : raw["defaultOpen"] === true;
}

export interface FloatingPanelStageChange {
  readonly stage: FloatingPanelStage;
}

export interface FloatingPanelEvents {
  "OPEN": {};
  "CLOSE": {};
  "DRAG.START": {};
  "DRAG.MOVE": { dx: number; dy: number };
  "DRAG.END": {};
  "RESIZE.START": { x: -1 | 0 | 1; y: -1 | 0 | 1 };
  "RESIZE.MOVE": { dx: number; dy: number };
  "RESIZE.END": {};
  "ESCAPE": {};
  "MINIMIZE": {};
  "MAXIMIZE": {};
  "RESTORE": {};
  "SIZE.SET": { size: FloatingPanelSize | string };
}

export type FloatingPanelEvent = EventUnion<FloatingPanelEvents>;


const config: MachineSpec<FloatingPanelContext, FloatingPanelEvents> = {
  id: "floating-panel",
  initial: "closed",
  context: {
    position: { x: 0, y: 0 },
    size: { w: 360, h: 240 },
    restoreSize: null,
    restorePosition: null,
    minSize: { w: 120, h: 80 },
    maxSize: { w: 1024, h: 768 },
    stage: "restored" as FloatingPanelStage,
    dragFrom: null,
    resizeFrom: null,
    axis: null,
    draggable: true,
    resizable: true,
    closeOnEscape: true,
    boundary: { w: 1024, h: 768 },
  },
  on: {
    "SIZE.SET": { assign: (_ctx, e) => {
      if (e.type !== "SIZE.SET") return {};
      const size = sizeOf(e.size);
      if (size === null) return {};
      return { size: { w: size.w, h: size.h } };
    } },
    "MINIMIZE": [{ assign: (ctx) => {
      if (ctx.stage === "minimized") return {};
      // Stash only when leaving restored: a staged-to-staged move keeps
      // the original geometry, matching zag (prevSize survives until
      // the restore, not until the next stage).
      return ctx.stage === "restored"
        ? { stage: "minimized", restoreSize: { ...ctx.size }, restorePosition: { ...ctx.position } }
        : { stage: "minimized" };
    } }],
    "MAXIMIZE": [{ assign: (ctx) => {
      if (ctx.stage === "maximized") return {};
      return {
        restoreSize: ctx.stage === "restored" ? { ...ctx.size } : ctx.restoreSize,
        restorePosition: ctx.stage === "restored" ? { ...ctx.position } : ctx.restorePosition,
        stage: "maximized",
        size: { w: ctx.boundary.w, h: ctx.boundary.h },
        position: { x: 0, y: 0 },
      };
    } }],
    "RESTORE": [{ assign: (ctx) => {
      if (ctx.stage === "restored") return {};
      return {
        stage: "restored",
        size: ctx.restoreSize ?? ctx.size,
        position: ctx.restorePosition ?? ctx.position,
        restoreSize: null,
        restorePosition: null,
    minSize: { w: 120, h: 80 },
    maxSize: { w: 1024, h: 768 },
      };
    } }],
  },
  states: {
    closed: {
      on: {
        "OPEN": [{ target: "open" }],
      },
    },
    open: {
      on: {
        "CLOSE": [{ target: "closed" }],
        "ESCAPE": [
          { cond: (ctx) => { return ctx.closeOnEscape; }, target: "closed" },
          { assign: (ctx) => {
      const back: {
        position?: { readonly x: number; readonly y: number };
        size?: FloatingPanelSize;
      } = {};
      if (ctx.dragFrom !== null) back.position = { ...ctx.dragFrom };
      if (ctx.resizeFrom !== null) back.size = { ...ctx.resizeFrom.size };
      return { ...back, dragFrom: null, resizeFrom: null, axis: null };
    } },
        ],
        "DRAG.START": [
          { cond: (ctx) => { return ctx.draggable && ctx.stage !== "maximized" && ctx.stage !== "minimized"; }, target: "dragging", assign: (ctx) => { return ({
      dragFrom: { ...ctx.position },
    }); } },
        ],
        "RESIZE.START": [
          { cond: (ctx) => { return ctx.resizable && ctx.stage !== "maximized" && ctx.stage !== "minimized"; }, target: "resizing", assign: (ctx, e) => {
      if (e.type !== "RESIZE.START") return {};
      return {
        resizeFrom: { size: { ...ctx.size }, position: { ...ctx.position } },
        axis: { x: e.x, y: e.y },
      };
    } },
        ],
      },
    },
    dragging: {
      on: {
        "DRAG.MOVE": [{ assign: (ctx, e) => {
      if (e.type !== "DRAG.MOVE") return {};
      const from = ctx.dragFrom ?? ctx.position;
      return { position: clampPosition(ctx, from.x + e.dx, from.y + e.dy) };
    } }],
        "DRAG.END": [{ target: "open", assign: clearDragFrom }],
        // Escape cancels the gesture back to the press point; the panel
        // itself stays open — the closeOnEscape escape is the open
        // state's, and a drag swallows the key first.
        "ESCAPE": [
          {
            target: "open",
            assign: [(ctx) => { return ({
      position: ctx.dragFrom ?? ctx.position,
    }); }, clearDragFrom],
          },
        ],
      },
    },
    resizing: {
      on: {
        "RESIZE.MOVE": [{ assign: (ctx, e) => {
      if (e.type !== "RESIZE.MOVE") return {};
      const origin = ctx.resizeFrom;
      if (origin === null) return {};
      const axis = ctx.axis ?? { x: 0, y: 0 };
      const lo = ctx.minSize;
      const hi = ctx.maxSize;
      const w = Math.min(hi.w, Math.max(lo.w, origin.size.w + (axis.x === 1 ? e.dx : axis.x === -1 ? -e.dx : 0)));
      const h = Math.min(hi.h, Math.max(lo.h, origin.size.h + (axis.y === 1 ? e.dy : axis.y === -1 ? -e.dy : 0)));
      const back: {
        position?: { readonly x: number; readonly y: number };
      } = {};
      if (axis.x === -1) back.position = clampPosition(ctx, origin.position.x - (w - origin.size.w), origin.position.y);
      if (axis.y === -1) back.position = { x: back.position?.x ?? origin.position.x, y: origin.position.y - (h - origin.size.h) };
      return { size: { w, h }, ...back };
    } }],
        "RESIZE.END": [{ target: "open", assign: clearResizeFrom }],
        "ESCAPE": [
          {
            target: "open",
            assign: [(ctx) => {
      if (ctx.resizeFrom === null) return {};
      return { size: { ...ctx.resizeFrom.size }, position: { ...ctx.resizeFrom.position } };
    }, clearResizeFrom],
          },
        ],
      },
    },
  },
};

const implementations = {};

/** A position clamped so the panel never leaves its boundary. */
function clampPosition(
  ctx: FloatingPanelContext,
  x: number,
  y: number,
): { readonly x: number; readonly y: number } {
  const maxX = Math.max(0, ctx.boundary.w - ctx.size.w);
  const maxY = Math.max(0, ctx.boundary.h - ctx.size.h);
  return {
    x: Math.min(Math.max(x, 0), maxX),
    y: Math.min(Math.max(y, 0), maxY),
  };
}

export function floatingPanel(
  args: FloatingPanelArgs = {},
  authored: (name: string) => boolean,
): Machine<FloatingPanelContext, FloatingPanelEvents> {
  return createMachine<FloatingPanelContext, FloatingPanelEvents>({
    ...config,
    context: initial(args, authored),
    /**
     * The machine's contract with its hosts. A field with an event is
     * REPORTED: the host's write is an event, the machine decides, and the
     * change reaches the host. A field without one is SILENT: the write
     * lands in the field and nothing reports.
     */
    fields: {
      size: { event: "SIZE.SET" },
      draggable: {},
      resizable: {},
      closeOnEscape: {},
    },
  });
}
