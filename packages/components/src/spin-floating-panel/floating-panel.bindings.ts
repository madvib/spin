import { dataAttr, defineComponent, isRecord, type ComponentDef, type PartScope, type SlotScope } from "@spin/runtime";
import type { DragDelta } from "@spin/runtime/actions";
import {
  config,
  implementations,
  initial,
  sizeOf,
  startOpen,
  startStage,
  type FloatingPanelContext,
  type FloatingPanelEvent,
  type FloatingPanelInitial,
  type FloatingPanelSize,
  type FloatingPanelStage,
} from "./floating-panel.machine.ts";

/**
 * Floating-panel definition: the DOM contract as data. The machine owns
 * the modes (closed/open/dragging/resizing), the stage, and the clamped
 * position and size; this file maps props to channels, parts to attribute
 * bags, commands to sends, and open/size/position/stage transitions to
 * their events.
 *
 * Everything that needs the DOM lives here: the drag and resize handles
 * (the `drag` action reports deltas), the boundary the position clamps to
 * (measured once and on resize), and the position/size reported through
 * the geometry channel as custom properties.
 *
 * A drag never reads the boundary per move: the machine clamps against a
 * size measured at open, so the gesture stays honest while the window
 * changes underneath it — the next open re-measures.
 */

export type { FloatingPanelSize, FloatingPanelStage };

export interface FloatingPanelApi {
  /** Whether the panel is open; the reactive channel is open-change. */
  readonly isOpen: boolean;
  readonly stage: FloatingPanelStage;
  readonly position: { readonly x: number; readonly y: number };
  readonly size: FloatingPanelSize;
  /** The machine's state: closed, open, dragging, or resizing. */
  readonly state: string;
  setOpen(): void;
  close(): void;
  minimize(): void;
  maximize(): void;
  restore(): void;
  getTriggerProps(): Record<string, unknown>;
  getPositionerProps(): Record<string, unknown>;
  getContentProps(): Record<string, unknown>;
  getDragTriggerProps(): Record<string, unknown>;
  /**
   * One trigger per stage, ark's shape: `{ stage: "minimized" |
   * "maximized" | "default" }`. "default" addresses the restored
   * geometry. A trigger hides itself (the `hidden` attribute) when it
   * is not the move: minimize/maximize hide while staged, restore
   * hides while restored.
   */
  getStageTriggerProps(options: FloatingPanelStageTrigger): Record<string, unknown>;
  getResizeTriggerProps(edge: ResizeEdge): Record<string, unknown>;
  getCloseTriggerProps(): Record<string, unknown>;
}

/** The stage a stage-trigger addresses: ark's vocabulary. "default"
 * is the panel's restored geometry. */
export interface FloatingPanelStageTrigger {
  readonly stage: "minimized" | "maximized" | "default";
}

/** The eight resize handles, by their axis signs. */
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

const sameSize = (a: FloatingPanelSize, b: FloatingPanelSize): boolean =>
  a.w === b.w && a.h === b.h;


/** A stage-trigger arg: ark's three stages, defaulting to restore. */
const stageOf = (arg: unknown): FloatingPanelStageTrigger["stage"] => {
  if (!isRecord(arg)) return "default";
  const stage: unknown = arg["stage"];
  return stage === "minimized" || stage === "maximized" ? stage : "default";
};

/** A resize edge off the recipe: the eight handles, defaulting to se. */
const isEdge = (arg: unknown): arg is ResizeEdge =>
  typeof arg === "string" && (Object.keys(EDGES) as readonly string[]).includes(arg);

const edgeOf = (arg: unknown): ResizeEdge => (isEdge(arg) ? arg : "se");

interface ScopeLike extends PartScope<unknown, FloatingPanelContext> {}

interface SlotLike<R> extends SlotScope<R, FloatingPanelContext> {}

/** Transport guarantees the raw prop bag is a FloatingPanelInitial-shaped object. */
const isFloatingPanelInitial = (raw: unknown): raw is FloatingPanelInitial =>
  raw !== null && typeof raw === "object";

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

/** The geometry bag: the panel reads position and size as data. */
const geometryStyle = (scope: ScopeLike): Record<string, string> => {
  const at = scope.context;
  return {
    "--panel-x": `${at.position.x}px`,
    "--panel-y": `${at.position.y}px`,
    "--panel-w": `${at.size.w}px`,
    "--panel-h": `${at.size.h}px`,
  };
};

const def: ComponentDef<FloatingPanelContext, FloatingPanelEvent> = {
  name: "floating-panel",
  config,
  implementations,
  start: (raw, authored) => {
    const props: FloatingPanelInitial = isFloatingPanelInitial(raw) ? raw : {};
    return startOpen(props, authored) ? "open" : "closed";
  },
  seed: (raw, authored) => {
    const props: FloatingPanelInitial = isFloatingPanelInitial(raw) ? raw : {};
    const shaped = initial(props);
    return {
      ...shaped,
      position: { x: 0, y: 0 },
      restoreSize: null,
      restorePosition: null,
      stage: startStage(props, authored),
      dragFrom: null,
      resizeFrom: null,
      axis: null,
      boundary: { w: 1024, h: 768 },
    };
  },
  reconcile: ({ context, state, parsed, authored, send }) => {
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
    if (authored("size")) {
      const outer = sizeOf(parsed["size"]);
      if (outer !== null && !sameSize(context.size, outer)) {
        send({ type: "SIZE.SET", size: { ...outer } });
        return true;
      }
    }
    return false;
  },
  establish: () => {
    // Detach the fork's shared initial context: two panels on a page
    // would otherwise share one position until the first gesture.
    return [{ type: "DRAG.END" }];
  },
  scalars: ["draggable", "resizable", "closeOnEscape"],
  parts: {
    trigger: {
      sig: (scope) => [`${scope.state === "open"}`, `${scope.props["disabled"] === true}`].join(" "),
      attrs: (scope) => {
        const open = scope.state !== "closed";
        return {
          id: scope.id("trigger"),
          "aria-label": scope.props["label"],
          "aria-expanded": open,
          "aria-haspopup": "dialog",
          "data-state": open ? "open" : "closed",
          hidden: open,
          onClick: (): void => scope.send({ type: open ? "CLOSE" : "OPEN" }),
        };
      },
    },
    positioner: {
      sig: (scope) => {
        const ctx = scope.context;
        return [
          scope.state,
          ctx.position.x, ctx.position.y, ctx.size.w, ctx.size.h,
          ctx.stage, scope.props["disabled"],
        ].join(" ");
      },
      attrs: (scope) => {
        const ctx = scope.context;
        const open = scope.state !== "closed";
        return {
          id: scope.id("positioner"),
          role: "dialog",
          "aria-label": scope.props["label"],
          "data-state": open ? "open" : "closed",
          "data-stage": ctx.stage,
          "data-dragging": dataAttr(scope.state === "dragging"),
          "data-resizing": dataAttr(scope.state === "resizing"),
          "data-disabled": dataAttr(scope.props["disabled"] === true),
          style: geometryStyle(scope),
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
      sig: (scope) => {
        const ctx = scope.context;
        return [
          scope.state,
          ctx.position.x, ctx.position.y, ctx.size.w, ctx.size.h,
          ctx.stage, scope.props["disabled"],
        ].join(" ");
      },
      attrs: (scope) => ({
        id: scope.id("content"),
        // The closed-state utilities (invisible, scale, opacity) live on
        // this element's class list, so the state they key on must live
        // here too — the positioner carries its own copy for its own list.
        "data-state": scope.state === "closed" ? "closed" : "open",
        "data-stage": scope.context.stage,
      }),
    },
    dragTrigger: {
      id: "drag",
      sig: (scope) => [scope.state, scope.context.stage].join(" "),
      attrs: (scope) => {
        const ctx = scope.context;
        const disabled = scope.props["disabled"] === true;
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
      sig: (scope: ScopeLike, arg?: unknown) => {
        const want = stageOf(arg);
        return [want, scope.context.stage].join(" ");
      },
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
      sig: (scope) => [scope.state, `${scope.props["disabled"] === true}`].join(" "),
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
      sig: (scope: ScopeLike, arg?: unknown) => {
        const edge = edgeOf(arg);
        return [edge, scope.state, scope.context.stage, `${scope.props["disabled"] === true}`].join(" ");
      },
      attrs: (scope: ScopeLike, arg?: unknown) => {
        const edge = edgeOf(arg);
        const ctx = scope.context;
        const disabled = scope.props["disabled"] === true;
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
};

export const floatingPanel = defineComponent<FloatingPanelContext, FloatingPanelEvent, FloatingPanelApi>(def);
