import { dataAttr, defineComponent, disclosureTrigger, isRecord, type ApiOf, type ComponentDef, type ScopeFor, type SlotScopeFor } from "@spin/runtime";
import type { DragDelta } from "@spin/runtime/actions";
import { floatingPanel as floatingPanelMachine } from "./floating-panel.machine.ts";
import { startOpen, type FloatingPanelArgs, type FloatingPanelContext, type FloatingPanelSize, type FloatingPanelStage, type FloatingPanelState } from "./floating-panel.state.ts";
import type { FloatingPanelEvents } from "./floating-panel.events.ts";

/**
 * Floating-panel definition: the DOM contract as data. This file maps props
 * to channels, parts to attribute bags, and commands to sends.
 *
 * A drag never reads the boundary per move: the machine clamps against a
 * size measured at open, so the gesture stays honest while the window
 * changes underneath it — the next open re-measures.
 */

export type { FloatingPanelSize, FloatingPanelStage };



/** The stage a stage-trigger addresses: ark's vocabulary. "default"
 * is the panel's restored geometry. */
export interface FloatingPanelStageTrigger {
  readonly stage: "minimized" | "maximized" | "default";
}

export type ResizeEdge = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

const EDGES: Readonly<Record<ResizeEdge, { readonly x: -1 | 0 | 1; readonly y: -1 | 0 | 1 }>> = {
  n: { x: 0, y: -1 },
  s: { x: 0, y: 1 },
  e: { x: 1, y: 0 },
  w: { x: -1, y: 0 },
  ne: { x: 1, y: -1 },
  nw: { x: -1, y: -1 },
  se: { x: 1, y: 1 },
  sw: { x: -1, y: 1 },
};

const stageOf = (arg: unknown): FloatingPanelStageTrigger["stage"] => {
  if (!isRecord(arg)) return "default";
  const stage: unknown = arg["stage"];
  return stage === "minimized" || stage === "maximized" ? stage : "default";
};

const isEdge = (arg: unknown): arg is ResizeEdge =>
  typeof arg === "string" && (Object.keys(EDGES) as readonly string[]).includes(arg);

const edgeOf = (arg: unknown): ResizeEdge => (isEdge(arg) ? arg : "se");

type ScopeLike = ScopeFor<FloatingPanelContext, FloatingPanelEvents, FloatingPanelState>;

type SlotLike<R> = SlotScopeFor<R, FloatingPanelContext, FloatingPanelEvents, FloatingPanelState>;

type IdFn = (part: string, slot?: unknown) => string;

/** One drag handler set per edge per bridge; the scope reads live through
 * proxies, so a cached closure never goes stale. */
interface DragHandlers {
  readonly onStart: (press: { readonly altKey: boolean; readonly shiftKey: boolean }) => void;
  readonly onMove: (delta: DragDelta) => void;
  readonly onEnd: (end: { readonly cancelled: boolean }) => void;
}
const dragHandlersByBridge = new WeakMap<IdFn, Map<string, DragHandlers>>();
const dragFor = (scope: ScopeLike, mode: "move" | ResizeEdge): DragHandlers => {
  let byEdge = dragHandlersByBridge.get(scope.id);
  if (byEdge === undefined) {
    byEdge = new Map();
    dragHandlersByBridge.set(scope.id, byEdge);
  }
  const hit = byEdge.get(mode);
  if (hit !== undefined) return hit;
  const made: DragHandlers = {
    onStart: () => {
      if (mode === "move") scope.send({ type: "DRAG.START" });
      else scope.send({ type: "RESIZE.START", ...EDGES[mode] });
    },
    onMove: (delta: DragDelta) => {
      if (mode === "move") scope.send({ type: "DRAG.MOVE", dx: delta.dx, dy: delta.dy });
      else scope.send({ type: "RESIZE.MOVE", dx: delta.dx, dy: delta.dy });
    },
    onEnd: () => {
      if (mode === "move") scope.send({ type: "DRAG.END" });
      else scope.send({ type: "RESIZE.END" });
    },
  };
  byEdge.set(mode, made);
  return made;
};



const def = {
  name: "floating-panel",
  machine: (props, authored) => floatingPanelMachine(props as FloatingPanelArgs, authored),
  start: (raw, authored) => (startOpen(raw, authored) ? "open" : "closed"),
  reconcile: ({ context, state, parsed, authored, send }) => {
    // The stage and the open fact are STATE channels: their moves are
    // separate events and the contract carries one event per field, so
    // they are reconciled here; the size, which is one event, is the
    // machine's contract.
    if (authored("stage")) {
      const stage: unknown = parsed["stage"];
      const outer = stage === "minimized" || stage === "maximized" || stage === "restored" ? stage : null;
      if (outer !== null && context.stage !== outer) {
        send(outer === "minimized" ? { type: "MINIMIZE" } : outer === "maximized" ? { type: "MAXIMIZE" } : { type: "RESTORE" });
        return true;
      }
    }
    if (authored("open")) {
      const outer = parsed["open"] === true;
      const open = state !== "closed";
      if (open !== outer) {
        send(outer ? { type: "OPEN" } : { type: "CLOSE" });
        return true;
      }
    }
    return false;
  },
  parts: {
    trigger: {
      attrs: (scope) => {
        const open = scope.state !== "closed";
        return {
          id: scope.id("trigger"),
          "aria-label": scope.context.label,
          ...disclosureTrigger(scope, {
            expanded: open,
            hasPopup: "dialog",
          }),
          "data-state": open ? "open" : "closed",
          hidden: open,
          onClick: (): void => scope.send({ type: open ? "CLOSE" : "OPEN" }),
        };
      },
    },
    positioner: {
      attrs: (scope) => {
        const ctx = scope.context;
        const open = scope.state !== "closed";
        return {
          id: scope.id("positioner"),
          role: "dialog",
          "aria-label": scope.context.label,
          "data-state": open ? "open" : "closed",
          "data-stage": ctx.stage,
                    "data-disabled": dataAttr(scope.context.disabled),
          // The panel is the dismissable surface itself: an outside press
          // closes it, and the escape hatch reaches the machine.
          "use:dismissable": {
            onOutside: (): void => scope.send({ type: "CLOSE" }),
            onEscape: (): void => scope.send({ type: "ESCAPE" }),
          },
        };
      },
    },
    content: {
      attrs: (scope) => {
        const ctx = scope.context;
        return {
          id: scope.id("content"),
          // The closed-state utilities (invisible, scale, opacity) live on
          // this element's class list, so the state they key on must live
          // here too — the positioner carries its own copy for its own list.
          "data-state": scope.state === "closed" ? "closed" : "open",
          "data-stage": ctx.stage,
          // The panel's own box: where it sits in the stage and how big
          // it is. The recipe names no var — the bag carries the geometry.
          //
          // The size is the RESTORED size: a stage that draws its own
          // box (the minimized header, the maximized fill) is the
          // recipe's, and the machine's restored size must not fight it
          // with an inline height. So the geometry is the position
          // always, and the size only where the machine owns the box.
          style: {
            left: `${ctx.position.x}px`,
            top: `${ctx.position.y}px`,
            // The restored box is the machine's. A stage that draws its
            // own box (the maximized fill) is the recipe's, so the width
            // and the height are not set there: the recipe's utilities
            // win without needing an important.
            // The restored box is the machine's, and the minimized stage
            // keeps the machine's WIDTH (the header bar is the panel's
            // height, the recipe's). The maximized stage fills the stage
            // box — the recipe's — so the machine sets neither
            // dimension there, and the recipe's utilities win without an
            // important.
            // The box is the machine's, at every stage: the machine sizes
            // the panel (the restored size, the minimized header, the
            // maximized boundary).
            //
            // The HEIGHT at the minimized stage is the header's, and the
            // recipe's `h-12` says so — so the machine sets the width
            // there and the recipe owns the height.
            width: `${ctx.size.w}px`,
            ...(ctx.stage === "minimized" ? {} : { height: `${ctx.size.h}px` }),
          },
        };
      },
    },
    dragTrigger: {
      id: "drag",
      attrs: (scope) => {
        const ctx = scope.context;
        const disabled = scope.context.disabled;
        return {
          id: scope.id("dragTrigger"),
          "aria-label": "Move",
          "data-disabled": dataAttr(ctx.stage !== "restored" || disabled),
          tabIndex: ctx.stage === "restored" && !disabled ? 0 : undefined,
          "use:drag": { enabled: ctx.stage === "restored" && !disabled, ...dragFor(scope, "move") },
        };
      },
    },
    stageTrigger: {
      id: "stage",
      attrs: (scope: ScopeLike, arg?: unknown) => {
        const want = stageOf(arg);
        const staged = scope.context.stage !== "restored";
        const self = want === "default" ? !staged : staged;
        return {
          id: scope.id("stage", want),
          "data-stage": want,
          "aria-label":
            want === "minimized" ? "Minimize" : want === "maximized" ? "Maximize" : "Restore",
          hidden: self,
          type: "button",
          onClick: (): void =>
            scope.send({
              type: want === "minimized" ? "MINIMIZE" : want === "maximized" ? "MAXIMIZE" : "RESTORE",
            }),
        };
      },
    },
    closeTrigger: {
      id: "close",
      attrs: (scope) => ({
        id: scope.id("closeTrigger"),
        "aria-label": "Close",
        onClick: (): void => scope.send({ type: "CLOSE" }),
      }),
    },
    // A part, not a slot: the recipe hands the edge as a bare string,
    // which a slot memo (keyed by object identity) cannot hold. The
    // handlers stay stable through the per-bridge drag cache.
    resizeTrigger: {
      id: "resize",
      attrs: (scope: ScopeLike, arg?: unknown) => {
        const edge = edgeOf(arg);
        const ctx = scope.context;
        const disabled = scope.context.disabled;
        return {
          id: scope.id("resizeTrigger", edge),
          "aria-label": `Resize ${edge}`,
          "data-edge": edge,
          "data-disabled": dataAttr(ctx.stage !== "restored" || disabled),
          "use:drag": {
            enabled: ctx.stage === "restored" && !disabled,
            ...dragFor(scope, edge),
          },
        };
      },
    },
  },
  slots: {
  },
  commands: {
    setOpen: { event: () => ({ type: "OPEN" }) },
    close: { event: () => ({ type: "CLOSE" }) },
    minimize: { event: () => ({ type: "MINIMIZE" }) },
    maximize: { event: () => ({ type: "MAXIMIZE" }) },
    restore: { event: () => ({ type: "RESTORE" }) },
  },
  readers: {
    isOpen: { read: (_context, state) => state !== "closed" },
    dragging: { read: (_context, state) => state === "dragging" },
    stage: { read: (context) => context.stage },
    position: { read: (context) => ({ ...context.position }) },
    size: { read: (context) => ({ ...context.size }) },
    state: { read: (_context, state) => state },
  },
  events: {
    "open-change": {
      prop: "onOpenChange",
      watch: (_context, state) => [state !== "closed"],
      detail: (watched: readonly unknown[]) => {
        const open = watched[0];
        return { open: open === true };
      },
    },
    "size-change": {
      prop: "onSizeChange",
      watch: (context) => {
        const size = context.size;
        return [size.w, size.h];
      },
      detail: (_watched, _event, _props, context: FloatingPanelContext) => ({
        size: { ...context.size },
      }),
    },
    "position-change": {
      prop: "onPositionChange",
      watch: (context) => {
        const position = context.position;
        return [position.x, position.y];
      },
      detail: (_watched, _event, _props, context: FloatingPanelContext) => ({
        position: { ...context.position },
      }),
    },
    "stage-change": {
      prop: "onStageChange",
      watch: (context) => [context.stage],
      detail: (watched: readonly unknown[]) => {
        const stage = watched[0];
        const known: FloatingPanelStage = stage === "minimized" || stage === "maximized" ? stage : "restored";
        return { stage: known };
      },
    },
  },
} satisfies ComponentDef<FloatingPanelContext, FloatingPanelEvents, Record<string, unknown>, FloatingPanelArgs, FloatingPanelState>;
export type FloatingPanelApi = ApiOf<typeof def>;
export const floatingPanel = defineComponent<FloatingPanelContext, FloatingPanelEvents, FloatingPanelApi, FloatingPanelArgs, FloatingPanelState>(def);
