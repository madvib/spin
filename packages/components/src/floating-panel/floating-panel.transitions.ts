import type { AssignFor, GuardFor } from "@spin/runtime/fsm";
import type { FloatingPanelEvents } from "./floating-panel.events.ts";
import type { FloatingPanelContext, FloatingPanelSize } from "./floating-panel.state.ts";
import { clampPosition, sizeOf } from "./floating-panel.state.ts";

type FPAssign<K extends keyof FloatingPanelEvents = keyof FloatingPanelEvents> = AssignFor<
  FloatingPanelContext,
  FloatingPanelEvents,
  K
>;

export const clearDragFrom: FPAssign = () => ({ dragFrom: null });

export const clearResizeFrom: FPAssign = () => ({ resizeFrom: null, axis: null });

export const setSize: FPAssign<"SIZE.SET"> = (_ctx, event) => {
  const size = sizeOf(event.size);
  if (size === null) return {};
  return { size: { w: size.w, h: size.h } };
};

export const minimize: FPAssign<"MINIMIZE"> = (ctx) => {
  if (ctx.stage === "minimized") return {};
  return ctx.stage === "restored"
    ? { stage: "minimized", restoreSize: { ...ctx.size }, restorePosition: { ...ctx.position } }
    : { stage: "minimized" };
};

export const maximize: FPAssign<"MAXIMIZE"> = (ctx) => {
  if (ctx.stage === "maximized") return {};
  return {
    restoreSize: ctx.stage === "restored" ? { ...ctx.size } : ctx.restoreSize,
    restorePosition: ctx.stage === "restored" ? { ...ctx.position } : ctx.restorePosition,
    stage: "maximized",
    size: { w: ctx.boundary.w, h: ctx.boundary.h },
    position: { x: 0, y: 0 },
  };
};

export const restore: FPAssign<"RESTORE"> = (ctx) => {
  if (ctx.stage === "restored") return {};
  return {
    stage: "restored",
    size: ctx.restoreSize ?? ctx.size,
    position: ctx.restorePosition ?? ctx.position,
    restoreSize: null,
    restorePosition: null,
  };
};

export const escapeCancel: FPAssign<"ESCAPE"> = (ctx) => {
  const back: {
    position?: { readonly x: number; readonly y: number };
    size?: FloatingPanelSize;
  } = {};
  if (ctx.dragFrom !== null) back.position = { ...ctx.dragFrom };
  if (ctx.resizeFrom !== null) back.size = { ...ctx.resizeFrom.size };
  return { ...back, dragFrom: null, resizeFrom: null, axis: null };
};

export const dragStart: FPAssign<"DRAG.START"> = (ctx) => ({
  dragFrom: { ...ctx.position },
});

export const resizeStart: FPAssign<"RESIZE.START"> = (ctx, event) => ({
  resizeFrom: { size: { ...ctx.size }, position: { ...ctx.position } },
  axis: { x: event.x, y: event.y },
});

export const dragMove: FPAssign<"DRAG.MOVE"> = (ctx, event) => {
  const from = ctx.dragFrom ?? ctx.position;
  return { position: clampPosition(ctx, from.x + event.dx, from.y + event.dy) };
};

export const resizeMove: FPAssign<"RESIZE.MOVE"> = (ctx, event) => {
  const origin = ctx.resizeFrom;
  if (origin === null) return {};
  const axis = ctx.axis ?? { x: 0, y: 0 };
  const lo = ctx.minSize;
  const hi = ctx.maxSize;
  const w = Math.min(hi.w, Math.max(lo.w, origin.size.w + (axis.x === 1 ? event.dx : axis.x === -1 ? -event.dx : 0)));
  const h = Math.min(hi.h, Math.max(lo.h, origin.size.h + (axis.y === 1 ? event.dy : axis.y === -1 ? -event.dy : 0)));
  const back: {
    position?: { readonly x: number; readonly y: number };
  } = {};
  if (axis.x === -1) back.position = clampPosition(ctx, origin.position.x - (w - origin.size.w), origin.position.y);
  if (axis.y === -1) back.position = { x: back.position?.x ?? origin.position.x, y: origin.position.y - (h - origin.size.h) };
  return { size: { w, h }, ...back };
};

export const cancelDragToOpen: FPAssign = (ctx) => ({
  position: ctx.dragFrom ?? ctx.position,
});

export const restoreResizeGeometry: FPAssign = (ctx) => {
  if (ctx.resizeFrom === null) return {};
  return { size: { ...ctx.resizeFrom.size }, position: { ...ctx.resizeFrom.position } };
};

// guards
export const closeOnEscape: GuardFor<FloatingPanelContext, FloatingPanelEvents> = (ctx) => ctx.closeOnEscape;

export const canDrag: GuardFor<FloatingPanelContext, FloatingPanelEvents> = (ctx) =>
  ctx.draggable && ctx.stage !== "maximized" && ctx.stage !== "minimized";

export const canResize: GuardFor<FloatingPanelContext, FloatingPanelEvents> = (ctx) =>
  ctx.resizable && ctx.stage !== "maximized" && ctx.stage !== "minimized";
