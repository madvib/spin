/**
 * Floating-panel machine: the open/closed modes, the gesture modes inside
 * open (idle, dragging, resizing), and the stage that changes which
 * gestures are legal.
 *
 * Zag's floating-panel is `closed` / `open{ idle, dragging, resizing }`
 * with `stage` (minimized/maximized/restored) in context — exactly the
 * fork's shape: the stage is not a state because it gates transitions
 * (a maximized panel cannot drag) without changing which events exist.
 *
 * The pointer gesture itself is the `drag` action on the handles' bags;
 * this machine receives START/MOVE/END and moves the geometry. Position
 * and size are continuous values reported through the geometry channel as
 * custom properties, and the panel-stack ordering (bring to front) is a
 * connect-owned reflex: it orders siblings, it does not change modes.
 *
 * Nothing here touches the DOM. The boundary clamp and the initial focus
 * are the connect's job — the bridge seeds `position`/`size` from props
 * and alternates them from the authored channels.
 */

export type FloatingPanelStage = "minimized" | "maximized" | "restored";

export interface FloatingPanelSize {
  readonly w: number;
  readonly h: number;
}

export interface FloatingPanelContext {
  /** The panel's position against its boundary, in pixels. */
  position: { readonly x: number; readonly y: number };
  /** The panel's size, in pixels; the restored one survives maximize. */
  size: FloatingPanelSize;
  /** The size before a stage, so RESTORE returns to it. */
  restoreSize: FloatingPanelSize | null;
  /** The position before a stage, so RESTORE returns to it. */
  restorePosition: { readonly x: number; readonly y: number } | null;
  stage: FloatingPanelStage;
  /** The position the drag started from, for an Escape cancel. */
  dragFrom: { readonly x: number; readonly y: number } | null;
  /** The floor a resize clamps to. */
  minSize: FloatingPanelSize;
  /** The ceiling a resize clamps to. */
  maxSize: FloatingPanelSize;
  /** The size AND position a resize started from, for the cancel. */
  resizeFrom: { readonly size: FloatingPanelSize; readonly position: { readonly x: number; readonly y: number } } | null;
  /** Which resize handle the gesture came from. */
  axis: { readonly x: -1 | 0 | 1; readonly y: -1 | 0 | 1 } | null;
  /** The scalars the assigns read, synced from scope by the bridge. */
  draggable: boolean;
  resizable: boolean;
  closeOnEscape: boolean;
  /** The boundary the position and size clamp to, in pixels. */
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

export interface FloatingPanelStageChange {
  readonly stage: FloatingPanelStage;
}

export type FloatingPanelEvent =
  | { type: "OPEN" }
  | { type: "CLOSE" }
  | { type: "DRAG.START" }
  | { type: "DRAG.MOVE"; dx: number; dy: number }
  | { type: "DRAG.END" }
  | { type: "RESIZE.START"; x: -1 | 0 | 1; y: -1 | 0 | 1 }
  | { type: "RESIZE.MOVE"; dx: number; dy: number }
  | { type: "RESIZE.END" }
  | { type: "ESCAPE" }
  | { type: "MINIMIZE" }
  | { type: "MAXIMIZE" }
  | { type: "RESTORE" }
  | { type: "SIZE.SET"; size: FloatingPanelSize };

export const config = {
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
  // Root tier: the programmatic channel (a host's authoritative open and
  // the size write) works from every state.
  on: {
    "SIZE.SET": { actions: [{ assign: "setSize" }] },
    // The stage is prop-driven: a host's `stage` write alternates it from
    // any state, and the stage only gates which gestures are legal.
    "MINIMIZE": [{ actions: [{ assign: "setMinimized" }] }],
    "MAXIMIZE": [{ actions: [{ assign: "setMaximized" }] }],
    "RESTORE": [{ actions: [{ assign: "setRestored" }] }],
  },
  // Flat states: the fork's targets are plain names, and the gesture modes
  // (dragging, resizing) only matter while the panel is open — a close
  // from any of them is one transition, not three.
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
          { cond: "closeOnEscape", target: "closed" },
          { actions: [{ assign: "cancelGesture" }] },
        ],
        "DRAG.START": [
          { cond: "isDraggable", target: "dragging", actions: [{ assign: "rememberDragFrom" }] },
        ],
        "RESIZE.START": [
          { cond: "isResizable", target: "resizing", actions: [{ assign: "rememberResizeFrom" }] },
        ],
      },
    },
    dragging: {
      on: {
        "DRAG.MOVE": [{ actions: [{ assign: "moveBy" }] }],
        "DRAG.END": [{ target: "open", actions: [{ assign: "clearDragFrom" }] }],
        // Escape cancels the gesture back to the press point; the panel
        // itself stays open — the closeOnEscape escape is the open
        // state's, and a drag swallows the key first.
        "ESCAPE": [
          {
            target: "open",
            actions: [{ assign: "restoreDragFrom" }, { assign: "clearDragFrom" }],
          },
        ],
      },
    },
    resizing: {
      on: {
        "RESIZE.MOVE": [{ actions: [{ assign: "sizeBy" }] }],
        "RESIZE.END": [{ target: "open", actions: [{ assign: "clearResizeFrom" }] }],
        "ESCAPE": [
          {
            target: "open",
            actions: [{ assign: "restoreResizeFrom" }, { assign: "clearResizeFrom" }],
          },
        ],
      },
    },
  },
};

export const implementations = {
  conds: {
    isDraggable: (ctx: FloatingPanelContext): boolean =>
      ctx.draggable && ctx.stage !== "maximized" && ctx.stage !== "minimized",
    isResizable: (ctx: FloatingPanelContext): boolean =>
      ctx.resizable && ctx.stage !== "maximized" && ctx.stage !== "minimized",
    closeOnEscape: (ctx: FloatingPanelContext): boolean => ctx.closeOnEscape,
  },
  assigns: {
    cancelGesture: (ctx: FloatingPanelContext): Partial<FloatingPanelContext> => {
      const back: {
        position?: { readonly x: number; readonly y: number };
        size?: FloatingPanelSize;
      } = {};
      if (ctx.dragFrom !== null) back.position = { ...ctx.dragFrom };
      if (ctx.resizeFrom !== null) back.size = { ...ctx.resizeFrom.size };
      return { ...back, dragFrom: null, resizeFrom: null, axis: null };
    },
    setSize: (_ctx: FloatingPanelContext, e: FloatingPanelEvent): Partial<FloatingPanelContext> => {
      if (e.type !== "SIZE.SET") return {};
      return { size: { w: e.size.w, h: e.size.h } };
    },
    rememberDragFrom: (ctx: FloatingPanelContext): Partial<FloatingPanelContext> => ({
      dragFrom: { ...ctx.position },
    }),
    clearDragFrom: (): Partial<FloatingPanelContext> => ({ dragFrom: null }),
    restoreDragFrom: (ctx: FloatingPanelContext): Partial<FloatingPanelContext> => ({
      position: ctx.dragFrom ?? ctx.position,
    }),
    /**
     * A drag move carries the cumulative delta from the press point (the
     * action reports it that way), so the position is always the press
     * origin plus the delta — never the last position plus it, which would
     * accumulate one delta per move event.
     */
    moveBy: (ctx: FloatingPanelContext, e: FloatingPanelEvent): Partial<FloatingPanelContext> => {
      if (e.type !== "DRAG.MOVE") return {};
      const from = ctx.dragFrom ?? ctx.position;
      return { position: clampPosition(ctx, from.x + e.dx, from.y + e.dy) };
    },
    rememberResizeFrom: (ctx: FloatingPanelContext, e: FloatingPanelEvent): Partial<FloatingPanelContext> => {
      if (e.type !== "RESIZE.START") return {};
      return {
        resizeFrom: { size: { ...ctx.size }, position: { ...ctx.position } },
        axis: { x: e.x, y: e.y },
      };
    },
    clearResizeFrom: (): Partial<FloatingPanelContext> => ({ resizeFrom: null, axis: null }),
    restoreResizeFrom: (ctx: FloatingPanelContext): Partial<FloatingPanelContext> => {
      if (ctx.resizeFrom === null) return {};
      return { size: { ...ctx.resizeFrom.size }, position: { ...ctx.resizeFrom.position } };
    },
    /**
     * One resize per axis sign, always from the press origin: an east
     * handle grows the width by the pointer's delta, a west handle grows
     * it by the negative and moves the panel's left edge with it (the
     * right edge stays). The cumulative deltas the action reports are why
     * the origin matters — adding each one would grow the panel once per
     * move event.
     */
    sizeBy: (ctx: FloatingPanelContext, e: FloatingPanelEvent): Partial<FloatingPanelContext> => {
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
    },
    setMinimized: (ctx: FloatingPanelContext): Partial<FloatingPanelContext> => {
      if (ctx.stage === "minimized") return {};
      // Stash only when leaving restored: a staged-to-staged move keeps
      // the original geometry, matching zag (prevSize survives until
      // the restore, not until the next stage).
      return ctx.stage === "restored"
        ? { stage: "minimized", restoreSize: { ...ctx.size }, restorePosition: { ...ctx.position } }
        : { stage: "minimized" };
    },
    setMaximized: (ctx: FloatingPanelContext): Partial<FloatingPanelContext> => {
      if (ctx.stage === "maximized") return {};
      return {
        restoreSize: ctx.stage === "restored" ? { ...ctx.size } : ctx.restoreSize,
        restorePosition: ctx.stage === "restored" ? { ...ctx.position } : ctx.restorePosition,
        stage: "maximized",
        size: { w: ctx.boundary.w, h: ctx.boundary.h },
        position: { x: 0, y: 0 },
      };
    },
    setRestored: (ctx: FloatingPanelContext): Partial<FloatingPanelContext> => {
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
    },
  },
};

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
