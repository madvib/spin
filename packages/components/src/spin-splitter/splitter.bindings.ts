import {
  ariaControls,
  ariaOrientation,
  dataAttr,
  defineComponent,
  focuser,
  isComposing,
  sliderThumb,
  type ComponentDef,
  type PartScope,
  type SlotScope,
} from "@spin/runtime";
import type { DragDelta, DragPress } from "@spin/runtime/actions";
import {
  defaultSizes,
  handleId,
  parsePanels,
  isInteractive,
  panelCollapsed,
  splitter as splitterMachine,
  validateSizes,
  type SplitterArgs,
  type SplitterContext,
  type SplitterEvents,
  type SplitterPanel,
  type SplitterResizeDetails,
} from "./splitter.machine.ts";

/** Splitter bindings: the DOM contract as data. */

export type { SplitterResizeDetails };

export interface SplitterPanelSlotProps {
  readonly id: string;
}

export interface SplitterHandleSlotProps {
  readonly beforeId: string;
  readonly afterId: string;
}

export type SplitterHandleSlot = SplitterHandleSlotProps;

export interface SplitterItem {
  readonly type: "panel" | "handle";
  readonly id: string;
  readonly beforeId: string;
  readonly afterId: string;
}

export interface SplitterApi {
  readonly dragging: boolean;
  readonly orientation: "horizontal" | "vertical";
  setSizes(size: readonly number[]): void;
  resetSizes(): void;
  collapsePanel(id: string): void;
  expandPanel(id: string, minSize?: number): void;
  resizePanel(id: string, size: number): void;
  getPanelIds(): readonly string[];
  getItems(): readonly SplitterItem[];
  getHandles(): readonly SplitterHandleSlot[];
  getSizes(): readonly number[];
  getPanelSize(id: string): number;
  isPanelCollapsed(id: string): boolean;
  getHandleState(slot: SplitterHandleSlotProps): { readonly focused: boolean; readonly dragging: boolean };
  getRootProps(): Record<string, unknown>;
  getPanelProps(slot: SplitterPanelSlotProps): Record<string, unknown>;
  getHandleProps(slot: SplitterHandleSlotProps): Record<string, unknown>;
  getHandleIndicatorProps(slot: SplitterHandleSlotProps): Record<string, unknown>;
}

interface ScopeLike extends PartScope<unknown, SplitterContext> {}
interface SlotLike<R> extends SlotScope<R, SplitterContext> {}

type ItemSlot =
  | { readonly type: "panel"; readonly id: string }
  | { readonly type: "handle"; readonly beforeId: string; readonly afterId: string };

const sameSizes = (a: readonly number[], b: readonly number[]): boolean =>
  a.length === b.length && a.every((value, index) => value === b[index]);

/** The sends that end the gesture: release, keyboard, and the programmatic
 * writes. RESET_SIZE resizes without ending — it is not in the set. */
const COMMIT_TYPES: ReadonlySet<string> = new Set([
  "POINTER_UP",
  "KEYBOARD_MOVE",
  "ENTER",
  "SET_SIZE",
  "COLLAPSE_PANEL",
  "EXPAND_PANEL",
  "RESIZE_PANEL",
]);

const itemsOf = (panels: readonly SplitterPanel[]): readonly SplitterItem[] => {
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
  return built;
};

/** A client point as a group percent, measured off the root node.
 * Returns null when the root is not laid out yet. */
const groupPercent = (scope: ScopeLike, clientX: number, clientY: number): number | null => {
  const rect = scope.measure("");
  if (rect === null) return null;
  const horizontal = scope.context.orientation === "horizontal";
  const span = horizontal ? rect.width : rect.height;
  if (span <= 0) return null;
  const along = horizontal ? clientX - rect.left : clientY - rect.top;
  return (along / span) * 100;
};

/** Whether the handle holds the focus: the press focused it, so a drag ends
 * focused and the keyboard keeps working on the handle it moved. */
const handleFocused = (scope: ScopeLike, handle: string): boolean => {
  const owner = scope.root().ownerDocument;
  return owner?.activeElement?.id === scope.id("handle", handle);
};

/** Handle handlers, cached per bridge by handle id: the scope reads live
 * through proxies, so a cached closure never goes stale. */
interface HandleHandlers {
  readonly onPointermove: (event: PointerEvent) => void;
  readonly onPointerleave: () => void;
  readonly onBlur: () => void;
  readonly onFocus: () => void;
  readonly onKeydown: (event: KeyboardEvent) => void;
}

/** The gesture the runtime's drag action drives, cached per bridge by handle
 * id like the DOM handlers: the scope reads live through proxies, so a
 * cached closure never goes stale. */
interface HandleDrag {
  readonly onStart: (press: DragPress) => void;
  readonly onMove: (delta: DragDelta) => void;
  readonly onEnd: (end: { readonly cancelled: boolean }) => void;
}
type IdFn = (part: string, slot?: unknown) => string;
const handleHandlersByBridge = new WeakMap<IdFn, Map<string, HandleHandlers>>();
const handleDragByBridge = new WeakMap<IdFn, Map<string, HandleDrag>>();
const handlersFor = (scope: ScopeLike, handle: string): HandleHandlers => {
  let byId = handleHandlersByBridge.get(scope.id);
  if (byId === undefined) {
    byId = new Map();
    handleHandlersByBridge.set(scope.id, byId);
  }
  const hit = byId.get(handle);
  if (hit !== undefined) return hit;
  const made: HandleHandlers = {
    // The hover reflex stays a DOM reflex: the gesture itself belongs to
    // the drag action below.
    onPointermove: (event: PointerEvent): void => {
      if (scope.state === "idle") {
        if (event.pointerType !== "touch") scope.send({ type: "POINTER_OVER", id: handle });
        return;
      }
    },
    onPointerleave: (): void => {
      if (scope.state === "hover") scope.send({ type: "POINTER_LEAVE" });
    },
    onBlur: (): void => {
      scope.send({ type: "BLUR" });
    },
    onFocus: (): void => {
      if (!isInteractive(scope.context)) return;
      scope.send({ type: "FOCUS", id: handle });
    },
    onKeydown: (event: KeyboardEvent): void => {
      if (event.defaultPrevented) return;
      const ctx = scope.context;
      if (!isInteractive(ctx)) return;
      if (isComposing(event)) return;
      const rawStep: unknown = scope.props["keyboardResizeBy"];
      const unit = typeof rawStep === "number" && rawStep > 0 ? Math.trunc(rawStep) : 1;
      const keyed = (type: string, delta?: number): boolean => {
        event.preventDefault();
        scope.send(delta === undefined ? { type, id: handle } : { type, id: handle, delta });
        return true;
      };
      const horizontalKeys = ctx.orientation === "horizontal";
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
  };
  byId.set(handle, made);
  return made;
};

/** The handle's gesture, driven by the runtime's drag action: the press
 * arms it, the moves report the pointer's place in the group, the release
 * commits. Cached per bridge by handle id, like the DOM handlers. */
const dragFor = (scope: ScopeLike, handle: string): HandleDrag => {
  let byId = handleDragByBridge.get(scope.id);
  if (byId === undefined) {
    byId = new Map();
    handleDragByBridge.set(scope.id, byId);
  }
  const hit = byId.get(handle);
  if (hit !== undefined) return hit;
  const focusHandle = focuser(scope.id);
  const made: HandleDrag = {
    onStart: (press: DragPress): void => {
      // Safari never focuses a separator on press: do it explicitly so
      // keyboard resizing works after a click.
      focusHandle("handle", handle);
      const percent = groupPercent(scope, press.x, press.y);
      if (percent === null) return;
      scope.send({ type: "POINTER_DOWN", id: handle, startPercent: percent });
    },
    onMove: (delta: DragDelta): void => {
      if (scope.state !== "dragging") return;
      const percent = groupPercent(scope, delta.x, delta.y);
      if (percent === null) return;
      scope.send({ type: "POINTER_MOVE", percent });
    },
    onEnd: (): void => {
      if (scope.state !== "dragging") return;
      // The press focused the handle, so the drag ends focused: the
      // keyboard keeps working on the handle the pointer just moved.
      scope.send({ type: "POINTER_UP", handleFocused: handleFocused(scope, handle) });
    },
  };
  byId.set(handle, made);
  return made;
};

const panelBag = (scope: ScopeLike, id: string): Record<string, unknown> => {
  const context = scope.context;
  const index = context.panels.findIndex((panel) => panel.id === id);
  const size = context.size[index] ?? 0;
  const collapsed = panelCollapsed(context.panels, context.size, id);
  return {
    id: scope.id("panel", id),
    dir: typeof scope.props["dir"] === "string" ? scope.props["dir"] : undefined,
    "data-scope": "splitter",
    "data-part": "panel",
    "data-type": "panel",
    "data-orientation": context.orientation,
    "data-dragging": scope.attr(scope.state === "dragging"),
    "data-id": id,
    "data-collapsed": scope.attr(collapsed),
    style: {
      // The panel's share is the machine's own number: the bag carries it
      // as the flex grow factor, and the markup names no var.
      flexGrow: context.panels.length === 1 ? "1" : size.toPrecision(3),
      flexShrink: "1",
      flexBasis: "0",
      overflow: "hidden",
      ...(scope.state === "dragging" ? { pointerEvents: "none" } : {}),
    },
  };
};

const handleBag = (scope: ScopeLike, beforeId: string, afterId: string): Record<string, unknown> => {
  const handle = handleId(beforeId, afterId);
  const context = scope.context;
  const focused = context.focusedHandle === handle;
  const dragging = scope.state === "dragging" && context.drag?.handleId === handle;
  const horizontal = context.orientation === "horizontal";
  return {
    id: scope.id("handle", handle),
    dir: typeof scope.props["dir"] === "string" ? scope.props["dir"] : undefined,
    role: "separator",
    "data-scope": "splitter",
    "data-part": "handle",
    "data-type": "handle",
    "data-id": handle,
    tabindex: scope.props["disabled"] === true ? undefined : "0",
    ...sliderThumb({
      now: String(Math.round(context.size[context.panels.findIndex((p) => p.id === beforeId)] ?? 0)),
      min: "0",
      max: "100",
    }),
    "data-orientation": context.orientation,
    ...ariaOrientation(
      scope.props["orientation"] === "horizontal" || scope.props["orientation"] === "vertical"
        ? scope.props["orientation"]
        : undefined,
    ),
    ...ariaControls(scope, {
      parts: [{ part: "panel", slot: beforeId }, { part: "panel", slot: afterId }],
    }),
    "data-focus": scope.attr(focused),
    "data-dragging": scope.attr(dragging),
    "data-disabled": scope.attr(scope.props["disabled"] === true),
    style: {
      touchAction: "none",
      userSelect: "none",
      flex: "0 0 auto",
      cursor: horizontal ? "col-resize" : "row-resize",
      ...(horizontal ? { minHeight: "0" } : { minWidth: "0" }),
    },
    ...handlersFor(scope, handle),
    // The gesture is the runtime's: the press arms it, the moves report
    // the pointer's place in the group, the release commits. The hover
    // reflex above stays a DOM reflex: it is not part of the gesture.
    "use:drag": {
      // A disabled splitter never arms.
      enabled: isInteractive(context),
      // The press does not reach the handle's ancestors.
      stopPropagation: true,
      // No escape path here: Escape does nothing.
      cancelOnEscape: false,
      ...dragFor(scope, handle),
    },
  };
};

const indicatorBag = (scope: ScopeLike, beforeId: string, afterId: string): Record<string, unknown> => {
  const handle = handleId(beforeId, afterId);
  const context = scope.context;
  const focused = context.focusedHandle === handle;
  const dragging = scope.state === "dragging" && context.drag?.handleId === handle;
  return {
    dir: typeof scope.props["dir"] === "string" ? scope.props["dir"] : undefined,
    "data-scope": "splitter",
    "data-part": "handle-indicator",
    "data-type": "handle",
    "data-orientation": context.orientation,
    "data-focus": scope.attr(focused),
    "data-dragging": scope.attr(dragging),
  };
};

const def: ComponentDef<SplitterContext, SplitterEvents> = {
  name: "splitter",
  machine: (props, authored) => splitterMachine(props as SplitterArgs, authored),
  // The sizes follow the tree, so the machine never sees a tree it cannot
  // lay out.
  reconcile: ({ context }) => {
    let next: number[];
    try {
      next = validateSizes(
        context.panels,
        defaultSizes(context.panels.length, context.size),
      );
    } catch {
      next = defaultSizes(context.panels.length, []);
    }
    if (sameSizes(context.size, next)) return false;
    context.size = next;
    return true;
  },
  commitEvents: [
    "POINTER_UP",
    "KEYBOARD_MOVE",
    "ENTER",
    "SET_SIZE",
    "COLLAPSE_PANEL",
    "EXPAND_PANEL",
    "RESIZE_PANEL",
  ],
  parts: {
    root: {
      attrs: (scope: ScopeLike) => ({
        id: scope.id(""),
        dir: typeof scope.props["dir"] === "string" ? scope.props["dir"] : undefined,
        "data-scope": "splitter",
        "data-part": "root",
        "data-orientation": scope.context.orientation,
        "data-dragging": scope.attr(scope.state === "dragging"),
        style: {
          display: "flex",
          flexDirection: scope.context.orientation === "horizontal" ? "row" : "column",
          height: "100%",
          width: "100%",
          overflow: "hidden",
        },
      }),
    },
  },
  slots: {
    item: {
      indexes: (_context, props) => itemsOf(parsePanels(props["panels"])),
      attrs: (scope: SlotLike<ItemSlot>) => {
        const item = scope.slot;
        return item.type === "panel"
          ? panelBag(scope, item.id)
          : handleBag(scope, item.beforeId, item.afterId);
      },
    },
    itemIndicator: {
      indexes: (_context, props) => itemsOf(parsePanels(props["panels"])),
      attrs: (scope: SlotLike<ItemSlot>) => {
        const item = scope.slot;
        if (item.type !== "handle") return {};
        return indicatorBag(scope, item.beforeId, item.afterId);
      },
    },
    itemLabel: {
      indexes: (_context, props) => itemsOf(parsePanels(props["panels"])),
      // The label span needs its own data-type, because data variants
      // match the element's own attributes, never ancestors.
      attrs: (scope) => {
        const item = scope.slot;
        if (typeof item !== "object" || item === null || !("type" in item)) return {};
        return item.type === "handle" ? { "data-type": "handle" } : {};
      },
    },
    panel: {
      id: "panel",
      indexes: (_context, props) => parsePanels(props["panels"]).map((panel) => ({ id: panel.id })),
      attrs: (scope: SlotLike<{ readonly id: string }>) => panelBag(scope, scope.slot.id),
    },
    handle: {
      id: "handle",
      indexes: (_context, props) => {
        const panels = parsePanels(props["panels"]);
        return panels.slice(0, -1).map((panel, index) => ({
          beforeId: panel.id,
          afterId: panels[index + 1]?.id ?? "",
        }));
      },
      attrs: (scope: SlotLike<{ readonly beforeId: string; readonly afterId: string }>) => handleBag(scope, scope.slot.beforeId, scope.slot.afterId),
    },
    handleIndicator: {
      id: "handle-indicator",
      indexes: (_context, props) => {
        const panels = parsePanels(props["panels"]);
        return panels.slice(0, -1).map((panel, index) => ({
          beforeId: panel.id,
          afterId: panels[index + 1]?.id ?? "",
        }));
      },
      attrs: (scope: SlotLike<{ readonly beforeId: string; readonly afterId: string }>) => indicatorBag(scope, scope.slot.beforeId, scope.slot.afterId),
    },
  },
  commands: {
    setSizes: { event: (args: readonly unknown[]) => { const v = args[0]; return { type: "SET_SIZE", size: Array.isArray(v) && v.every((x): x is number => typeof x === "number") ? [...v] : [] }; } },
    resetSizes: { event: () => ({ type: "RESET_SIZE" }) },
    collapsePanel: { event: (args: readonly unknown[]) => { const v = args[0]; return { type: "COLLAPSE_PANEL", id: typeof v === "string" ? v : "" }; } },
    expandPanel: {
      event: (args: readonly unknown[]) => {
        const v = args[0];
        const id = typeof v === "string" ? v : "";
        const m = args[1];
        return { type: "EXPAND_PANEL", id, ...(typeof m === "number" ? { minSize: m } : {}) };
      },
    },
    resizePanel: {
      event: (args: readonly unknown[]) => {
        const id = args[0];
        const size = args[1];
        return { type: "RESIZE_PANEL", id: typeof id === "string" ? id : "", size: typeof size === "number" ? size : 0 };
      },
    },
  },
  readers: {
    dragging: { read: (_context, state) => state === "dragging" },
    orientation: { read: (context: SplitterContext) => context.orientation },
  },
  methods: {
    getPanelIds: {
      call: (context: SplitterContext) => context.panels.map((panel) => panel.id),
    },
    getItems: {
      call: (context: SplitterContext) => itemsOf(context.panels),
    },
    getHandles: {
      call: (context: SplitterContext) => {
        const panels = context.panels;
        return panels.slice(0, -1).map((panel, index) => ({
          beforeId: panel.id,
          afterId: panels[index + 1]?.id ?? "",
        }));
      },
    },
    getSizes: {
      call: (context: SplitterContext) => [...context.size],
    },
    getPanelSize: {
      call: (context: SplitterContext, _state, args: readonly unknown[]) => {
        const id = args[0];
        if (typeof id !== "string") return 0;
        const index = context.panels.findIndex((panel) => panel.id === id);
        return context.size[index] ?? 0;
      },
    },
    isPanelCollapsed: {
      call: (context: SplitterContext, _state, args: readonly unknown[]) => {
        const id = args[0];
        if (typeof id !== "string") return false;
        return panelCollapsed(context.panels, context.size, id);
      },
    },
    getHandleState: {
      call: (context: SplitterContext, state: string, args: readonly unknown[]) => {
        const slot = args[0];
        const beforeId = typeof slot === "object" && slot !== null && "beforeId" in slot && typeof slot.beforeId === "string" ? slot.beforeId : "";
        const afterId = typeof slot === "object" && slot !== null && "afterId" in slot && typeof slot.afterId === "string" ? slot.afterId : "";
        const handle = handleId(beforeId, afterId);
        return {
          focused: context.focusedHandle === handle,
          dragging: state === "dragging" && context.drag?.handleId === handle,
        };
      },
    },
  },
  events: {
    resize: {
      prop: "onResize",
      watch: (context: SplitterContext) => [...context.size],
      detail: (watched: readonly number[]) => {
        const handleId: string | null = null;
        return { size: [...watched], handleId };
      },
    },
    "resize-end": {
      prop: "onResizeEnd",
      watch: (context: SplitterContext) => [...context.size],
      detail: (watched: readonly number[]) => { const handleId: string | null = null; return { size: [...watched], handleId }; },
      // A commit with no size move still ends the gesture (the watch
      // alone would swallow it); an empty layout is not a resize anyone
      // made.
      select: (event, _before, after: SplitterContext) => {
        if (!COMMIT_TYPES.has(event.type)) return null;
        const ctx = after;
        if (ctx.size.length === 0) return null;
        return {
          size: [...ctx.size],
          handleId: ctx.drag?.handleId ?? null,
        };
      },
    },
  },
};

export const splitter = defineComponent<SplitterContext, SplitterEvents, SplitterApi>(def);
