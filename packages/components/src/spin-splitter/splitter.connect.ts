import { dataAttr } from "../spin-select/select.shared.ts";
import {
  handleId,
  isInteractive,
  panelCollapsed,
  type SplitterContext,
  type SplitterPanel,
} from "./splitter.machine.ts";

/**
 * Splitter connect: the DOM contract, the view-owned geometry, and the
 * reflexes the parts carry.
 *
 * What the machine owns stays there: the four phases, the percent sizes,
 * the drag snapshot, the collapse memory. Everything that needs a node
 * lives here — the pointer-to-percent measurement (reported in as a group
 * percent, because the machine never touches the DOM), pointer capture (an
 * off-handle release still ends the drag), and the handle focus after a
 * pointer press (Safari never focuses it for us).
 */

export interface SplitterConnectProps {
  readonly disabled: boolean;
  readonly dir: "ltr" | "rtl";
  readonly orientation: "horizontal" | "vertical";
  readonly keyboardResizeBy: number;
  readonly label: string;
}

export interface SplitterPanelSlotProps {
  readonly id: string;
}

export interface SplitterHandleSlotProps {
  readonly beforeId: string;
  readonly afterId: string;
}

export type SplitterHandleSlot = SplitterHandleSlotProps;

/** Zag's api methods, narrowed to the command surface the element exposes. */
export interface SplitterCommands {
  setSizes(size: readonly number[]): void;
  resetSizes(): void;
  collapsePanel(id: string): void;
  expandPanel(id: string, minSize?: number): void;
  resizePanel(id: string, size: number): void;
}

export interface SplitterApi extends SplitterCommands {
  readonly dragging: boolean;
  readonly orientation: "horizontal" | "vertical";
  /** Panel ids in order, for the recipe's iteration. */
  getPanelIds(): readonly string[];
  /** Panels interleaved with their handles, for the recipe's iteration. */
  getItems(): readonly SplitterItem[];
  /** The handle slots in order, for the recipe's handle iteration. */
  getHandles(): readonly SplitterHandleSlot[];
  /** The props for one interleaved item: panel bags for panels, handle
   * bags for handles. The recipe iterates getItems once; the branch lives
   * here because templates have no conditional. */
  getItemProps(item: SplitterItem): Record<string, unknown>;
  /** The indicator props for a handle item. Panel items get an empty bag:
   * the recipe spreads unconditionally, and spreading null throws. */
  getItemIndicatorProps(item: SplitterItem): Record<string, unknown>;
  getSizes(): readonly number[];
  getPanelSize(id: string): number;
  isPanelCollapsed(id: string): boolean;
  getHandleState(slot: SplitterHandleSlotProps): {
    readonly focused: boolean;
    readonly dragging: boolean;
  };
  getRootProps(): Record<string, unknown>;
  getPanelProps(slot: SplitterPanelSlotProps): Record<string, unknown>;
  getHandleProps(slot: SplitterHandleSlotProps): Record<string, unknown>;
  getHandleIndicatorProps(slot: SplitterHandleSlotProps): Record<string, unknown>;
}

/** The service the connect reads: the fork's, narrowed to what it needs. */
export interface SplitterService {
  readonly context: SplitterContext;
  /** The machine's state: idle, hover, focused, or dragging. */
  readonly state: string;
  send(event: { type: string } & Record<string, unknown>): void;
}

export interface SplitterItem {
  readonly type: "panel" | "handle";
  readonly id: string;
  readonly beforeId: string;
  readonly afterId: string;
}

export interface BagMemo {
  sig: string;
  bag: Record<string, unknown>;
}

/** A bag cached until the signature of the fields it reads moves. One memo
 * holds the single bag of one part (there is one root per element), so a
 * single slot is the whole cache. */
function memo(): (
  sig: string,
  build: () => Record<string, unknown>,
) => Record<string, unknown> {
  let sig = "";
  let bag: Record<string, unknown> | undefined;
  return (next, build) => {
    if (bag !== undefined && sig === next) return bag;
    sig = next;
    bag = build();
    return bag;
  };
}

/** Panels and handles are stable slots, so the memo dies with the slot it
 * came from. */
function keyed<K extends object>(
  store: WeakMap<K, BagMemo>,
  owner: K,
  sig: string,
  build: () => Record<string, unknown>,
): Record<string, unknown> {
  const hit = store.get(owner);
  if (hit !== undefined && hit.sig === sig) return hit.bag;
  const bag = build();
  store.set(owner, { sig, bag });
  return bag;
}
/** Stable slot owners per item id: the recipe hands getItemProps a fresh
 * item object per render, which would defeat the keyed memos. Owners
 * persist by id, so bags survive re-renders. */
const panelOwners = new Map<string, { id: string }>();
const handleOwners = new Map<string, { beforeId: string; afterId: string }>();
function panelOwner(id: string): { id: string } {
  let owner = panelOwners.get(id);
  if (owner === undefined) {
    owner = { id };
    panelOwners.set(id, owner);
  }
  return owner;
}
function handleOwner(item: SplitterItem): { beforeId: string; afterId: string } {
  let owner = handleOwners.get(item.id);
  if (owner === undefined) {
    owner = { beforeId: item.beforeId, afterId: item.afterId };
    handleOwners.set(item.id, owner);
  }
  return owner;
}

/** Zag's `isComposingEvent`: a composing keystroke is not a navigation. */
const isComposing = (event: KeyboardEvent): boolean =>
  event.isComposing === true || event.keyCode === 229;

type Capturable = Element & { setPointerCapture?: (id: number) => void };

export function connectSplitter(
  service: SplitterService,
  readProps: () => SplitterConnectProps,
  id: string,
): SplitterApi {
  // Live accessor, never a snapshot: the fork replaces the context object
  // on every assign, so a destructured copy would freeze the first read.
  const ctx = (): SplitterContext => service.context;
  const send = service.send;
  const rootId = `splitter:${id}`;
  const panelId = (panel: string): string => `splitter:${id}:panel:${panel}`;
  const handleDomId = (handle: string): string => `splitter:${id}:handle:${handle}`;

  const rootBag = memo();
  const panelBags = new WeakMap<{ id: string }, BagMemo>();
  const handleBags = new WeakMap<{ beforeId: string; afterId: string }, BagMemo>();
  const indicatorBags = new WeakMap<{ beforeId: string; afterId: string }, BagMemo>();

  /** A client point as a group percent, measured off the root node. */
  const groupPercent = (clientX: number, clientY: number): number | null => {
    if (typeof document === "undefined") return null;
    const root = document.getElementById(rootId);
    if (root === null || typeof root.getBoundingClientRect !== "function") return null;
    const rect = root.getBoundingClientRect();
    const horizontal = ctx().orientation === "horizontal";
    const span = horizontal ? rect.width : rect.height;
    if (span <= 0) return null;
    const along = horizontal ? clientX - rect.left : clientY - rect.top;
    return (along / span) * 100;
  };

  const focusHandle = (handle: string): void => {
    if (typeof document === "undefined") return;
    document.getElementById(handleDomId(handle))?.focus({ preventScroll: true });
  };

  const api: SplitterApi = {
    get dragging() {
      return service.state === "dragging";
    },
    get orientation() {
      return ctx().orientation;
    },
    setSizes: (size: readonly number[]) => {
      send({ type: "SET_SIZE", size: [...size] });
    },
    resetSizes: () => {
      send({ type: "RESET_SIZE" });
    },
    collapsePanel: (panel: string) => {
      send({ type: "COLLAPSE_PANEL", id: panel });
    },
    expandPanel: (panel: string, minSize?: number) => {
      send({ type: "EXPAND_PANEL", id: panel, minSize });
    },
    resizePanel: (panel: string, size: number) => {
      send({ type: "RESIZE_PANEL", id: panel, size });
    },
    getPanelIds: () => ctx().panels.map((panel) => panel.id),
    getItems: (() => {
      let panels: SplitterPanel[] = [];
      let items: readonly SplitterItem[] = [];
      return () => {
        if (ctx().panels !== panels) {
          panels = ctx().panels;
          const built: SplitterItem[] = [];
          panels.forEach((panel, index) => {
            built.push({ type: "panel", id: panel.id, beforeId: "", afterId: "" });
            const next = panels[index + 1];
            if (next !== undefined) {
              built.push({
                type: "handle",
                id: handleId(panel.id, next.id),
                beforeId: panel.id,
                afterId: next.id,
              });
            }
          });
          items = built;
        }
        return items;
      };
    })(),
    getHandles: (() => {
      let panels: SplitterPanel[] = [];
      let handles: readonly SplitterHandleSlot[] = [];
      return () => {
        if (ctx().panels !== panels) {
          panels = ctx().panels;
          handles = panels
            .slice(0, -1)
            .map((panel, index) => ({ beforeId: panel.id, afterId: panels[index + 1]?.id ?? "" }));
        }
        return handles;
      };
    })(),
    getItemProps: (item: SplitterItem) =>
      item.type === "panel"
        ? api.getPanelProps(panelOwner(item.id))
        : api.getHandleProps(handleOwner(item)),
    getItemIndicatorProps: (item: SplitterItem) =>
      item.type === "handle" ? api.getHandleIndicatorProps(handleOwner(item)) : {},
    getSizes: () => ctx().size,
    getPanelSize: (panel: string) => {
      const index = ctx().panels.findIndex((candidate) => candidate.id === panel);
      return ctx().size[index] ?? 0;
    },
    isPanelCollapsed: (panel: string) => panelCollapsed(ctx().panels, ctx().size, panel),
    getHandleState: (slot: SplitterHandleSlotProps) => {
      const handle = handleId(slot.beforeId, slot.afterId);
      return {
        focused: ctx().focusedHandle === handle,
        dragging: service.state === "dragging" && ctx().drag?.handleId === handle,
      };
    },
    getRootProps: () => {
      const props = readProps();
      return rootBag(
        [props.orientation, props.dir, service.state].join("|"),
        () => ({
          id: rootId,
          dir: props.dir,
          "data-scope": "splitter",
          "data-part": "root",
          "data-orientation": props.orientation,
          "data-dragging": dataAttr(service.state === "dragging"),
          style: {
            display: "flex",
            flexDirection: props.orientation === "horizontal" ? "row" : "column",
            height: "100%",
            width: "100%",
            overflow: "hidden",
          },
        }),
      );
    },
    getPanelProps: (slot: SplitterPanelSlotProps) => {
      const props = readProps();
      const context = ctx();
      const index = context.panels.findIndex((panel) => panel.id === slot.id);
      const size = context.size[index] ?? 0;
      const collapsed = panelCollapsed(context.panels, context.size, slot.id);
      return keyed(
        panelBags,
        slot,
        [size, collapsed, service.state, props.orientation].join("|"),
        () => ({
          id: panelId(slot.id),
          dir: props.dir,
          "data-scope": "splitter",
          "data-part": "panel",
          "data-type": "panel",
          "data-orientation": props.orientation,
          "data-dragging": dataAttr(service.state === "dragging"),
          "data-id": slot.id,
          "data-collapsed": dataAttr(collapsed),
          style: {
            "--splitter-size": `${size}%`,
            flexGrow: context.panels.length === 1 ? "1" : size.toPrecision(3),
            flexShrink: "1",
            flexBasis: "0",
            overflow: "hidden",
            ...(service.state === "dragging" ? { pointerEvents: "none" } : {}),
          },
        }),
      );
    },
    getHandleProps: (slot: SplitterHandleSlotProps) => {
      const props = readProps();
      const handle = handleId(slot.beforeId, slot.afterId);
      const context = ctx();
      const focused = context.focusedHandle === handle;
      const dragging = service.state === "dragging" && context.drag?.handleId === handle;
      const horizontal = context.orientation === "horizontal";
      return keyed(
        handleBags,
        slot,
        [focused, dragging, service.state, props.orientation, props.dir].join("|"),
        () => ({
          id: handleDomId(handle),
          dir: props.dir,
          role: "separator",
          "data-scope": "splitter",
          "data-part": "handle",
          "data-type": "handle",
          "data-id": handle,
          tabindex: props.disabled ? undefined : "0",
          "aria-valuenow": String(Math.round(context.size[context.panels.findIndex((p) => p.id === slot.beforeId)] ?? 0)),
          "aria-valuemin": "0",
          "aria-valuemax": "100",
          "data-orientation": props.orientation,
          "aria-orientation": props.orientation,
          "aria-controls": `${panelId(slot.beforeId)} ${panelId(slot.afterId)}`,
          "data-focus": dataAttr(focused),
          "data-dragging": dataAttr(dragging),
          "data-disabled": dataAttr(props.disabled),
          style: {
            touchAction: "none",
            userSelect: "none",
            flex: "0 0 auto",
            cursor: horizontal ? "col-resize" : "row-resize",
            ...(horizontal ? { minHeight: "0" } : { minWidth: "0" }),
          },
          onPointerdown: (event: PointerEvent) => {
            if (!isInteractive(ctx())) return;
            if (event.pointerType === "mouse" && event.button !== 0) return;
            event.preventDefault();
            event.stopPropagation();
            // Safari never focuses a separator on press: do it explicitly
            // so keyboard resizing works after a click.
            (event.currentTarget as HTMLElement | null)?.focus?.({ preventScroll: true });
            const percent = groupPercent(event.clientX, event.clientY);
            if (percent === null) return;
            (event.currentTarget as Capturable | null)?.setPointerCapture?.(event.pointerId);
            send({ type: "POINTER_DOWN", id: handle, startPercent: percent });
          },
          onPointermove: (event: PointerEvent) => {
            if (service.state === "idle") {
              if (event.pointerType !== "touch") send({ type: "POINTER_OVER", id: handle });
              return;
            }
            if (service.state !== "dragging") return;
            const percent = groupPercent(event.clientX, event.clientY);
            if (percent === null) return;
            send({ type: "POINTER_MOVE", percent });
          },
          onPointerleave: () => {
            if (service.state === "hover") send({ type: "POINTER_LEAVE" });
          },
          onPointerup: (event: PointerEvent) => {
            if (service.state !== "dragging") return;
            const handleFocused = document.activeElement?.id === handleDomId(handle);
            void (event as PointerEvent);
            send({ type: "POINTER_UP", handleFocused });
          },
          onBlur: () => {
            send({ type: "BLUR" });
          },
          onFocus: () => {
            if (!isInteractive(ctx())) return;
            send({ type: "FOCUS", id: handle });
          },
          onKeydown: (event: KeyboardEvent) => {
            if (event.defaultPrevented) return;
            if (!isInteractive(ctx())) return;
            if (isComposing(event)) return;
            const unit = event.shiftKey ? 10 : props.keyboardResizeBy;
            const keyed = (type: string, delta?: number): boolean => {
              event.preventDefault();
              send(delta === undefined ? { type, id: handle } : { type, id: handle, delta });
              return true;
            };
            const horizontalKeys = context.orientation === "horizontal";
            switch (event.key) {
              case "Enter":
                keyed("ENTER");
                break;
              case "ArrowUp":
                keyed("KEYBOARD_MOVE", horizontalKeys ? 0 : -unit);
                break;
              case "ArrowDown":
                keyed("KEYBOARD_MOVE", horizontalKeys ? 0 : unit);
                break;
              case "ArrowLeft":
                keyed("KEYBOARD_MOVE", horizontalKeys ? -unit : 0);
                break;
              case "ArrowRight":
                keyed("KEYBOARD_MOVE", horizontalKeys ? unit : 0);
                break;
              case "Home":
                keyed("KEYBOARD_MOVE", -100);
                break;
              case "End":
                keyed("KEYBOARD_MOVE", 100);
                break;
              default:
                break;
            }
          },
        }),
      );
    },
    getHandleIndicatorProps: (slot: SplitterHandleSlotProps) => {
      const props = readProps();
      const handle = handleId(slot.beforeId, slot.afterId);
      const context = ctx();
      const focused = context.focusedHandle === handle;
      const dragging = service.state === "dragging" && context.drag?.handleId === handle;
      return keyed(
        indicatorBags,
        slot,
        [focused, dragging, props.orientation].join("|"),
        () => ({
          dir: props.dir,
          "data-scope": "splitter",
          "data-part": "handle-indicator",
          "data-type": "handle",
          "data-orientation": props.orientation,
          "data-focus": dataAttr(focused),
          "data-dragging": dataAttr(dragging),
        }),
      );
    },
  };

  return api;
}
