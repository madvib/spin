/**
 * Floating-panel connect: the DOM contract, the gesture handles, and the
 * geometry channel.
 *
 * The machine owns the modes (closed/open/dragging/resizing), the stage,
 * and the clamped position and size. Everything that needs the DOM lives
 * here: the drag and resize handles (the `drag` action reports deltas),
 * the boundary the position clamps to (measured once and on resize), and
 * the position/size reported through the geometry channel as custom
 * properties.
 *
 * A drag never reads the boundary per move: the machine clamps against a
 * size the connect measured at open, so the gesture stays honest while
 * the window changes underneath it — the next open re-measures.
 */

import type { DragDelta } from "@spin/runtime/actions";
import type {
  FloatingPanelContext,
  FloatingPanelEvent,
  FloatingPanelSize,
  FloatingPanelStage,
} from "./floating-panel.machine.ts";

export interface FloatingPanelConnectProps {
  readonly label: string;
  readonly disabled: boolean;
}

export interface FloatingPanelCommands {
  setOpen(): void;
  close(): void;
  minimize(): void;
  maximize(): void;
  restore(): void;
}

export interface FloatingPanelApi extends FloatingPanelCommands {
  /** Whether the panel is open; the reactive channel is open-change. */
  readonly isOpen: boolean;
  readonly stage: FloatingPanelStage;
  readonly position: { readonly x: number; readonly y: number };
  readonly size: FloatingPanelSize;
  /** The machine's state: closed, open, dragging, or resizing. */
  readonly state: string;
  getTriggerProps(): Record<string, unknown>;
  getPositionerProps(): Record<string, unknown>;
  getContentProps(): Record<string, unknown>;
  getDragTriggerProps(): Record<string, unknown>;
  getStageProps(): Record<string, unknown>;
  /** The stage icon's own bag: it carries data-stage so the spans can key
   * on it (select's trigger indicator is the same shape). */
  getStageIconProps(): Record<string, unknown>;
  getResizeTriggerProps(edge: ResizeEdge): Record<string, unknown>;
  getCloseTriggerProps(): Record<string, unknown>;
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

export interface FloatingPanelService {
  readonly context: FloatingPanelContext;
  readonly isOpen: boolean;
  readonly state: string;
  send(event: FloatingPanelEvent): void;
}

export type ReadFloatingPanelProps = () => FloatingPanelConnectProps;

const NAMESPACE = "floating-panel";

function dataAttr(value: boolean): string | undefined {
  return value ? "" : undefined;
}

export function connectRobotFloatingPanel(
  service: FloatingPanelService,
  readProps: ReadFloatingPanelProps,
  id: string,
): FloatingPanelApi {
  const ownerId = id.startsWith(`${NAMESPACE}:`) ? id : `${NAMESPACE}:${id}`;
  const contentId = `${ownerId}:content`;

  const ctx = (): FloatingPanelContext => service.context;
  const props = (): FloatingPanelConnectProps => readProps();

  const send = (event: FloatingPanelEvent): void => service.send(event);

  /** One handler memo per edge; the deltas carry the axis from the drag. */
  const dragHandlers = new Map<string, {
    readonly onStart: (press: { readonly altKey: boolean; readonly shiftKey: boolean }) => void;
    readonly onMove: (delta: DragDelta) => void;
    readonly onEnd: (end: { readonly cancelled: boolean }) => void;
  }>();

  const dragFor = (mode: "move" | ResizeEdge): {
    onStart: (press: { readonly altKey: boolean; readonly shiftKey: boolean }) => void;
    onMove: (delta: DragDelta) => void;
    onEnd: (end: { readonly cancelled: boolean }) => void;
  } => {
    const key = mode;
    const hit = dragHandlers.get(key);
    if (hit !== undefined) return hit;
    const made = {
      onStart: () => {
        if (mode === "move") send({ type: "DRAG.START" });
        else send({ type: "RESIZE.START", ...EDGES[mode] });
      },
      onMove: (delta: DragDelta) => {
        if (mode === "move") send({ type: "DRAG.MOVE", dx: delta.dx, dy: delta.dy });
        else send({ type: "RESIZE.MOVE", dx: delta.dx, dy: delta.dy });
      },
      onEnd: () => {
        if (mode === "move") send({ type: "DRAG.END" });
        else send({ type: "RESIZE.END" });
      },
    };
    dragHandlers.set(key, made);
    return made;
  };

  const caches = new Map<string, { sig: string; bag: Record<string, unknown> }>();
  const cached = (key: string, sig: string, build: () => Record<string, unknown>): Record<string, unknown> => {
    const hit = caches.get(key);
    if (hit !== undefined && hit.sig === sig) return hit.bag;
    const bag = build();
    caches.set(key, { sig, bag });
    return bag;
  };

  /** The geometry bag: the panel reads position and size as data. */
  const geometryStyle = (): Record<string, string> => {
    const at = ctx();
    return {
      "--panel-x": `${at.position.x}px`,
      "--panel-y": `${at.position.y}px`,
      "--panel-w": `${at.size.w}px`,
      "--panel-h": `${at.size.h}px`,
    };
  };

  const positionerSig = (): string =>
    `${service.state}\u0000${ctx().position.x}\u0000${ctx().position.y}\u0000${ctx().size.w}\u0000${ctx().size.h}\u0000${ctx().stage}\u0000${props().disabled}`;

  const api: FloatingPanelApi = {
    get isOpen(): boolean {
      return service.isOpen;
    },
    get stage(): FloatingPanelStage {
      return ctx().stage;
    },
    get position(): { readonly x: number; readonly y: number } {
      return ctx().position;
    },
    get size(): FloatingPanelSize {
      return ctx().size;
    },
    get state(): string {
      return service.state;
    },
    setOpen: () => send({ type: "OPEN" }),
    close: () => send({ type: "CLOSE" }),
    minimize: () => send({ type: "MINIMIZE" }),
    maximize: () => send({ type: "MAXIMIZE" }),
    restore: () => send({ type: "RESTORE" }),
    getTriggerProps: () =>
      cached("trigger", `${service.isOpen}\u0000${props().disabled}`, () => ({
        id: `${ownerId}:trigger`,
        "aria-label": props().label,
        "aria-expanded": service.isOpen,
        "aria-haspopup": "dialog",
        "data-state": service.isOpen ? "open" : "closed",
        hidden: service.isOpen,
        onClick: () => send({ type: service.isOpen ? "CLOSE" : "OPEN" }),
      })),
    getPositionerProps: () =>
      cached("positioner", positionerSig(), () => ({
        id: `${ownerId}:positioner`,
        role: "dialog",
        "aria-label": props().label,
        "data-state": service.isOpen ? "open" : "closed",
        "data-stage": ctx().stage,
        "data-dragging": dataAttr(service.state === "dragging"),
        "data-resizing": dataAttr(service.state === "resizing"),
        "data-disabled": dataAttr(props().disabled),
        style: geometryStyle(),
        // The panel is the dismissable surface itself: an outside press
        // closes it, and the escape hatch reaches the machine.
        "use:dismissable": {
          onOutside: () => send({ type: "CLOSE" }),
          onEscape: () => send({ type: "ESCAPE" }),
        },
      })),
    getContentProps: () =>
      cached("content", positionerSig(), () => ({
        id: contentId,
        "data-stage": ctx().stage,
      })),
    getDragTriggerProps: () =>
      cached("drag", `${service.state}\u0000${ctx().stage}`, () => ({
        id: `${ownerId}:drag`,
        "aria-label": "Move",
        "data-disabled": dataAttr(ctx().stage !== "restored" || props().disabled),
        tabIndex: ctx().stage === "restored" && !props().disabled ? 0 : undefined,
        "use:drag": { enabled: ctx().stage === "restored" && !props().disabled, ...dragFor("move") },
      })),
    getStageProps: () =>
      cached("stage", `${ctx().stage}\u0000${service.isOpen}`, () => ({
        id: `${ownerId}:stage`,
        "data-stage": ctx().stage,
        "aria-label": ctx().stage === "minimized"
          ? "Restore"
          : ctx().stage === "maximized" ? "Restore" : "Minimize",
        onClick: () =>
          send({
            type: ctx().stage === "restored" ? "MINIMIZE" : "RESTORE",
          }),
      })),
    getStageIconProps: () =>
      cached("stage-icon", `${ctx().stage}`, () => ({
        "data-stage": ctx().stage,
      })),
    getResizeTriggerProps: (edge: ResizeEdge) =>
      cached(
        `resize:${edge}`,
        `${service.state}\u0000${ctx().stage}\u0000${props().disabled}`,
        () => ({
          id: `${ownerId}:resize:${edge}`,
          "aria-label": `Resize ${edge}`,
          "data-edge": edge,
          "data-disabled": dataAttr(ctx().stage !== "restored" || props().disabled),
          "use:drag": {
            enabled: ctx().stage === "restored" && !props().disabled,
            ...dragFor(edge),
          },
        }),
      ),
    getCloseTriggerProps: () =>
      cached("close", `${service.state}\u0000${props().disabled}`, () => ({
        id: `${ownerId}:close`,
        "aria-label": "Close",
        onClick: () => send({ type: "CLOSE" }),
      })),
  };

  return api;
}
