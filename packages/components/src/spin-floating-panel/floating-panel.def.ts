import {
  dataAttr,
  defineComponent,
  type ComponentDef,
  type PartScope as ScopeLike,
} from "@spin/runtime";
import type { DragDelta } from "@spin/runtime/actions";
import {
  config,
  implementations,
  type FloatingPanelContext,
  type FloatingPanelEvent,
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

/** The JSON transport for a size: `{"w":360,"h":240}`. */
const parseSize = (raw: unknown): FloatingPanelSize | null => {
  if (typeof raw !== "string" || raw.length === 0) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const bag = parsed as Record<string, unknown>;
  const w = bag["w"];
  const h = bag["h"];
  if (typeof w !== "number" || typeof h !== "number") return null;
  return { w, h };
};

const sameSize = (a: FloatingPanelSize, b: FloatingPanelSize): boolean =>
  a.w === b.w && a.h === b.h;

type Ctx = FloatingPanelContext;

const asCtx = (context: Record<string, unknown>): Ctx => context as unknown as Ctx;

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
  const at = asCtx(scope.context);
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
  start: (props, authored) => {
    if (authored("open")) return (props["open"] as boolean) === true ? "open" : "closed";
    return (props["defaultOpen"] as boolean) === true ? "open" : "closed";
  },
  seed: (props, authored) => ({
    draggable: props["draggable"] !== false,
    resizable: props["resizable"] !== false,
    closeOnEscape: props["closeOnEscape"] !== false,
    size: parseSize(authored("size") ? props["size"] : props["defaultSize"]) ?? { w: 360, h: 240 },
  }),
  establish: () => {
    // Detach the fork's shared initial context: two panels on a page
    // would otherwise share one position until the first gesture.
    return [{ type: "DRAG.END" }];
  },
  channels: {
    size: {
      controlled: true,
      parse: (raw) => parseSize(raw),
      nullable: true,
      event: (value: FloatingPanelSize | null) =>
        value === null ? { type: "SIZE.SET", size: { w: 360, h: 240 } } : { type: "SIZE.SET", size: value },
      equal: (current, outer) => {
        if (current === null || current === undefined || outer === null || outer === undefined) {
          return current == null && outer == null;
        }
        return sameSize(
          current as FloatingPanelSize,
          outer as unknown as FloatingPanelSize,
        );
      },
    },
    defaultSize: { parse: parseSize },
    open: {
      controlled: true,
      parse: (raw) => raw === true,
      event: (value: boolean) => ({ type: value ? "OPEN" : "CLOSE" }),
      current: (_context, state) => state === "open",
    },
    defaultOpen: { parse: (raw) => raw === true },
    stage: {
      controlled: true,
      parse: (raw) =>
        raw === "minimized" || raw === "maximized" || raw === "restored" ? raw : null,
      nullable: true,
      // The stage is prop-driven: a host write alternates it from any
      // state, and the stage only gates which gestures are legal.
      event: (value: FloatingPanelStage | null) =>
        value === null
          ? { type: "RESTORE" }
          : value === "minimized"
          ? { type: "MINIMIZE" }
          : value === "maximized"
          ? { type: "MAXIMIZE" }
          : { type: "RESTORE" },
    },
    defaultStage: {
      parse: (raw) =>
        raw === "minimized" || raw === "maximized" || raw === "restored" ? raw : null,
    },
    draggable: { parse: (raw) => raw !== false },
    resizable: { parse: (raw) => raw !== false },
    closeOnEscape: { parse: (raw) => raw !== false },
    label: { parse: (raw) => (typeof raw === "string" ? raw : "") },
    disabled: { parse: (raw) => raw === true },
  },
  scalars: ["draggable", "resizable", "closeOnEscape"],
  parts: {
    trigger: {
      sig: (scope) => [`${scope.state === "open"}`, `${scope.props["disabled"] === true}`].join(" "),
      attrs: (scope) => {
        const open = scope.state === "open";
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
        const ctx = asCtx(scope.context);
        return [
          scope.state,
          ctx.position.x, ctx.position.y, ctx.size.w, ctx.size.h,
          ctx.stage, scope.props["disabled"],
        ].join(" ");
      },
      attrs: (scope) => {
        const ctx = asCtx(scope.context);
        const open = scope.state === "open";
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
        const ctx = asCtx(scope.context);
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
        "data-state": scope.state === "open" ? "open" : "closed",
        "data-stage": asCtx(scope.context).stage,
      }),
    },
    dragTrigger: {
      id: "drag",
      sig: (scope) => [scope.state, asCtx(scope.context).stage].join(" "),
      attrs: (scope) => {
        const ctx = asCtx(scope.context);
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
      sig: (scope, arg) => {
        const want = (arg as FloatingPanelStageTrigger).stage;
        return [want, asCtx(scope.context).stage].join(" ");
      },
      attrs: (scope, arg) => {
        const want = (arg as FloatingPanelStageTrigger).stage;
        const staged = asCtx(scope.context).stage !== "restored";
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
      sig: (scope, arg) => {
        const edge = arg as ResizeEdge;
        return [edge, scope.state, asCtx(scope.context).stage, `${scope.props["disabled"] === true}`].join(" ");
      },
      attrs: (scope, arg) => {
        const edge = arg as ResizeEdge;
        const ctx = asCtx(scope.context);
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
    isOpen: { read: (_context, state) => state === "open" },
    stage: { read: (context) => asCtx(context).stage },
    position: { read: (context) => ({ ...asCtx(context).position }) },
    size: { read: (context) => ({ ...asCtx(context).size }) },
    state: { read: (_context, state) => state },
  },
  events: {
    "open-change": {
      prop: "onOpenChange",
      watch: (_context, state) => [state === "open"],
      detail: (watched) => ({ open: watched[0] as boolean }),
    },
    "size-change": {
      prop: "onSizeChange",
      watch: (context) => {
        const size = asCtx(context).size;
        return [size.w, size.h];
      },
      detail: (watched, _event, _props, context) => {
        void watched;
        return { size: { ...(context as unknown as Ctx).size } };
      },
    },
    "position-change": {
      prop: "onPositionChange",
      watch: (context) => {
        const position = asCtx(context).position;
        return [position.x, position.y];
      },
      detail: (watched, _event, _props, context) => {
        void watched;
        return { position: { ...(context as unknown as Ctx).position } };
      },
    },
    "stage-change": {
      prop: "onStageChange",
      watch: (context) => [asCtx(context).stage],
      detail: (watched) => ({ stage: watched[0] as FloatingPanelStage }),
    },
  },
};

export const floatingPanel = defineComponent<FloatingPanelContext, FloatingPanelEvent, FloatingPanelApi>(def);
