import {
  dataAttr,
  defineComponent,
  isComposing,
  type ComponentDef,
  type PartScope as ScopeLike,
} from "@spin/runtime";
import {
  config,
  defaultSizes,
  handleId,
  implementations,
  isInteractive,
  panelCollapsed,
  validateSizes,
  type SplitterContext,
  type SplitterEvent,
  type SplitterPanel,
  type SplitterResizeDetails,
} from "./splitter.machine.ts";

/**
 * Splitter definition: the DOM contract as data. The machine owns the four
 * phases, the percent sizes, the drag snapshot and the collapse memory;
 * this file maps props to channels, parts to attribute bags, commands to
 * sends, and resize/resize-end transitions to their events.
 *
 * Everything that needs a node lives here — the pointer-to-percent
 * measurement (reported in as a group percent, because the machine never
 * touches the DOM), pointer capture (an off-handle release still ends the
 * drag), and the handle focus after a pointer press (Safari never focuses
 * it for us). Panels arrive as JSON (the scope grammar has no object-array
 * transport for panel data); sizes normalize through `validateSizes`.
 */

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
  /** The label props for a panel item: the label span needs its own
   * data-type, because data variants match the element's own attributes,
   * never ancestors. Handle items get an empty bag. */
  getItemLabelProps(item: SplitterItem): Record<string, unknown>;
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

/** Panels travel the prop channel as JSON text: id plus optional numeric
 * constraints. Anything else arriving is no panels. */
export const parsePanels = (raw: unknown): SplitterPanel[] => {
  const list: unknown = typeof raw === "string"
    ? ((): unknown => {
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    })()
    : raw;
  if (!Array.isArray(list)) return [];
  const panels: SplitterPanel[] = [];
  for (const item of list) {
    if (typeof item !== "object" || item === null) continue;
    const record = item as Record<string, unknown>;
    const id = record["id"];
    if (typeof id !== "string" || id.length === 0) continue;
    const num = (name: string): number | undefined => {
      const value = record[name];
      return typeof value === "number" && Number.isFinite(value) ? value : undefined;
    };
    const bool = (name: string): boolean | undefined => {
      const value = record[name];
      return typeof value === "boolean" ? value : undefined;
    };
    panels.push({
      id,
      ...(num("minSize") !== undefined ? { minSize: num("minSize") } : {}),
      ...(num("maxSize") !== undefined ? { maxSize: num("maxSize") } : {}),
      ...(bool("collapsible") !== undefined ? { collapsible: bool("collapsible") } : {}),
      ...(num("collapsedSize") !== undefined ? { collapsedSize: num("collapsedSize") } : {}),
    });
  }
  return panels;
};

/** Percent sizes travel the prop channel as JSON text (the grammar coerces
 * `= []` to `["[]"]`). */
const sizesProp = (raw: unknown): number[] | null => {
  const list: unknown = typeof raw === "string"
    ? ((): unknown => {
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    })()
    : raw;
  if (!Array.isArray(list)) return null;
  return list.every((item) => typeof item === "number" && Number.isFinite(item))
    ? [...(list as number[])]
    : null;
};

const sameSizes = (a: readonly number[], b: readonly number[]): boolean =>
  a.length === b.length && a.every((value, index) => value === b[index]);

/** The sends that end the gesture: release, keyboard, and the programmatic
 * writes. RESET_SIZE resizes without ending — it is not in the set. */
const COMMIT_TYPES = new Set([
  "POINTER_UP",
  "KEYBOARD_MOVE",
  "ENTER",
  "SET_SIZE",
  "COLLAPSE_PANEL",
  "EXPAND_PANEL",
  "RESIZE_PANEL",
]);

const samePanels = (a: readonly SplitterPanel[], b: readonly SplitterPanel[]): boolean =>
  a.length === b.length &&
  a.every((panel, index) =>
    panel.id === b[index]?.id &&
    panel.minSize === b[index]?.minSize &&
    panel.maxSize === b[index]?.maxSize &&
    panel.collapsible === b[index]?.collapsible &&
    panel.collapsedSize === b[index]?.collapsedSize
  );

type Ctx = SplitterContext;

const asCtx = (context: Record<string, unknown>): Ctx => context as unknown as Ctx;

type IdFn = (part: string, slot?: unknown) => string;

const panelsOf = (parsed: Record<string, unknown>): SplitterPanel[] =>
  parsed["panels"] as SplitterPanel[];

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

/** A client point as a group percent, measured off the root node. */
const groupPercent = (scope: ScopeLike, clientX: number, clientY: number): number | null => {
  if (typeof document === "undefined") return null;
  const root = document.getElementById(scope.id(""));
  if (root === null || typeof root.getBoundingClientRect !== "function") return null;
  const rect = root.getBoundingClientRect();
  const horizontal = asCtx(scope.context).orientation === "horizontal";
  const span = horizontal ? rect.width : rect.height;
  if (span <= 0) return null;
  const along = horizontal ? clientX - rect.left : clientY - rect.top;
  return (along / span) * 100;
};

type Capturable = Element & { setPointerCapture?: (id: number) => void };

/** Handle handlers, cached per bridge by handle id: the scope reads live
 * through proxies, so a cached closure never goes stale — while the bag
 * rebuild still re-spreads fresh attributes around them. */
interface HandleHandlers {
  readonly onPointerdown: (event: PointerEvent) => void;
  readonly onPointermove: (event: PointerEvent) => void;
  readonly onPointerleave: () => void;
  readonly onPointerup: (event: PointerEvent) => void;
  readonly onBlur: () => void;
  readonly onFocus: () => void;
  readonly onKeydown: (event: KeyboardEvent) => void;
}
const handleHandlersByBridge = new WeakMap<IdFn, Map<string, HandleHandlers>>();
const handlersFor = (scope: ScopeLike, handle: string): HandleHandlers => {
  let byId = handleHandlersByBridge.get(scope.id);
  if (byId === undefined) {
    byId = new Map();
    handleHandlersByBridge.set(scope.id, byId);
  }
  const hit = byId.get(handle);
  if (hit !== undefined) return hit;
  const made: HandleHandlers = {
    onPointerdown: (event: PointerEvent): void => {
      const ctx = asCtx(scope.context);
      if (!isInteractive(ctx)) return;
      if (event.pointerType === "mouse" && event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      // Safari never focuses a separator on press: do it explicitly so
      // keyboard resizing works after a click.
      (event.currentTarget as HTMLElement | null)?.focus?.({ preventScroll: true });
      const percent = groupPercent(scope, event.clientX, event.clientY);
      if (percent === null) return;
      (event.currentTarget as Capturable | null)?.setPointerCapture?.(event.pointerId);
      scope.send({ type: "POINTER_DOWN", id: handle, startPercent: percent });
    },
    onPointermove: (event: PointerEvent): void => {
      if (scope.state === "idle") {
        if (event.pointerType !== "touch") scope.send({ type: "POINTER_OVER", id: handle });
        return;
      }
      if (scope.state !== "dragging") return;
      const percent = groupPercent(scope, event.clientX, event.clientY);
      if (percent === null) return;
      scope.send({ type: "POINTER_MOVE", percent });
    },
    onPointerleave: (): void => {
      if (scope.state === "hover") scope.send({ type: "POINTER_LEAVE" });
    },
    onPointerup: (event: PointerEvent): void => {
      if (scope.state !== "dragging") return;
      const handleFocused = typeof document === "undefined"
        ? false
        : document.activeElement?.id === scope.id("handle", handle);
      void event;
      scope.send({ type: "POINTER_UP", handleFocused });
    },
    onBlur: (): void => {
      scope.send({ type: "BLUR" });
    },
    onFocus: (): void => {
      if (!isInteractive(asCtx(scope.context))) return;
      scope.send({ type: "FOCUS", id: handle });
    },
    onKeydown: (event: KeyboardEvent): void => {
      if (event.defaultPrevented) return;
      const ctx = asCtx(scope.context);
      if (!isInteractive(ctx)) return;
      if (isComposing(event)) return;
      const unit = event.shiftKey ? 10 : (scope.props["keyboardResizeBy"] as number);
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

const panelBag = (scope: ScopeLike, id: string): Record<string, unknown> => {
  const context = asCtx(scope.context);
  const index = context.panels.findIndex((panel) => panel.id === id);
  const size = context.size[index] ?? 0;
  const collapsed = panelCollapsed(context.panels, context.size, id);
  return {
    id: scope.id("panel", id),
    dir: scope.props["dir"],
    "data-scope": "splitter",
    "data-part": "panel",
    "data-type": "panel",
    "data-orientation": scope.props["orientation"],
    "data-dragging": dataAttr(scope.state === "dragging"),
    "data-id": id,
    "data-collapsed": dataAttr(collapsed),
    style: {
      "--splitter-size": `${size}%`,
      flexGrow: context.panels.length === 1 ? "1" : size.toPrecision(3),
      flexShrink: "1",
      flexBasis: "0",
      overflow: "hidden",
      ...(scope.state === "dragging" ? { pointerEvents: "none" } : {}),
    },
  };
};

const panelSig = (scope: ScopeLike, id: string): string => {
  const context = asCtx(scope.context);
  const index = context.panels.findIndex((panel) => panel.id === id);
  const size = context.size[index] ?? 0;
  const collapsed = panelCollapsed(context.panels, context.size, id);
  return [size, collapsed, scope.state, scope.props["orientation"]].join(" ");
};

const handleBag = (scope: ScopeLike, beforeId: string, afterId: string): Record<string, unknown> => {
  const handle = handleId(beforeId, afterId);
  const context = asCtx(scope.context);
  const focused = context.focusedHandle === handle;
  const dragging = scope.state === "dragging" && context.drag?.handleId === handle;
  const horizontal = context.orientation === "horizontal";
  return {
    id: scope.id("handle", handle),
    dir: scope.props["dir"],
    role: "separator",
    "data-scope": "splitter",
    "data-part": "handle",
    "data-type": "handle",
    "data-id": handle,
    tabindex: scope.props["disabled"] === true ? undefined : "0",
    "aria-valuenow": String(Math.round(context.size[context.panels.findIndex((p) => p.id === beforeId)] ?? 0)),
    "aria-valuemin": "0",
    "aria-valuemax": "100",
    "data-orientation": scope.props["orientation"],
    "aria-orientation": scope.props["orientation"],
    "aria-controls": `${scope.id("panel", beforeId)} ${scope.id("panel", afterId)}`,
    "data-focus": dataAttr(focused),
    "data-dragging": dataAttr(dragging),
    "data-disabled": dataAttr(scope.props["disabled"] === true),
    style: {
      touchAction: "none",
      userSelect: "none",
      flex: "0 0 auto",
      cursor: horizontal ? "col-resize" : "row-resize",
      ...(horizontal ? { minHeight: "0" } : { minWidth: "0" }),
    },
    ...handlersFor(scope, handle),
  };
};

const handleSig = (scope: ScopeLike, beforeId: string, afterId: string): string => {
  const handle = handleId(beforeId, afterId);
  const context = asCtx(scope.context);
  const focused = context.focusedHandle === handle;
  const dragging = scope.state === "dragging" && context.drag?.handleId === handle;
  return [focused, dragging, scope.state, scope.props["orientation"], scope.props["dir"]].join(" ");
};

const indicatorBag = (scope: ScopeLike, beforeId: string, afterId: string): Record<string, unknown> => {
  const handle = handleId(beforeId, afterId);
  const context = asCtx(scope.context);
  const focused = context.focusedHandle === handle;
  const dragging = scope.state === "dragging" && context.drag?.handleId === handle;
  return {
    dir: scope.props["dir"],
    "data-scope": "splitter",
    "data-part": "handle-indicator",
    "data-type": "handle",
    "data-orientation": scope.props["orientation"],
    "data-focus": dataAttr(focused),
    "data-dragging": dataAttr(dragging),
  };
};

const indicatorSig = (scope: ScopeLike, beforeId: string, afterId: string): string => {
  const handle = handleId(beforeId, afterId);
  const context = asCtx(scope.context);
  const focused = context.focusedHandle === handle;
  const dragging = scope.state === "dragging" && context.drag?.handleId === handle;
  return [focused, dragging, scope.props["orientation"]].join(" ");
};

const def: ComponentDef<SplitterContext, SplitterEvent> = {
  name: "splitter",
  config,
  implementations,
  seed: (props, authored) => {
    const list = (authored("panels") ? props["panels"] : props["defaultPanels"]) as SplitterPanel[];
    const panels = Array.isArray(list) ? list : [];
    const spec = sizesProp(authored("size") ? props["size"] : props["defaultSize"]) ?? [];
    let size: number[];
    try {
      size = validateSizes(panels, defaultSizes(panels.length, spec));
    } catch {
      size = defaultSizes(panels.length, spec);
    }
    return {
      panels: [...panels],
      size,
      orientation: props["orientation"] === "vertical" ? "vertical" : "horizontal",
      disabled: props["disabled"] === true,
      beforeCollapse: {},
      focusedHandle: null,
      drag: null,
    };
  },
  channels: {
    panels: { parse: parsePanels },
    defaultPanels: { parse: parsePanels },
    size: {
      controlled: true,
      parse: (raw) => sizesProp(raw) ?? [],
      event: (value: readonly number[]) => ({ type: "SET_SIZE", size: [...value] }),
      equal: (current, outer) =>
        Array.isArray(current) && Array.isArray(outer) &&
        sameSizes(current as number[], outer as number[]),
    },
    defaultSize: {
      parse: (raw) => sizesProp(raw) ?? [],
    },
    orientation: { parse: (raw) => (raw === "vertical" ? "vertical" : "horizontal") },
    disabled: { parse: (raw) => raw === true },
    dir: { parse: (raw) => (raw === "rtl" ? "rtl" : "ltr") },
    keyboardResizeBy: { parse: (raw) => (typeof raw === "number" && raw > 0 ? raw : 1) },
  },
  scalars: ["orientation", "disabled"],
  reconcile: ({ context, parsed, send }) => {
    const ctx = asCtx(context);
    // A changed panel tree reseeds the sizes it still fits — the machine
    // never sees a tree it cannot lay out.
    const list = panelsOf(parsed);
    void send;
    if (samePanels(ctx.panels, list)) return false;
    ctx.panels = [...list];
    try {
      ctx.size = validateSizes(ctx.panels, defaultSizes(ctx.panels.length, ctx.size));
    } catch {
      ctx.size = defaultSizes(ctx.panels.length, []);
    }
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
      sig: (scope) => [scope.props["orientation"], scope.props["dir"], scope.state].join(" "),
      attrs: (scope) => ({
        id: scope.id(""),
        dir: scope.props["dir"],
        "data-scope": "splitter",
        "data-part": "root",
        "data-orientation": scope.props["orientation"],
        "data-dragging": dataAttr(scope.state === "dragging"),
        style: {
          display: "flex",
          flexDirection: scope.props["orientation"] === "horizontal" ? "row" : "column",
          height: "100%",
          width: "100%",
          overflow: "hidden",
        },
      }),
    },
  },
  slots: {
    item: {
      indexes: (_context, props) => itemsOf(panelsOf(props)),
      sig: (scope) => {
        const item = scope.slot as unknown as SplitterItem;
        return item.type === "panel"
          ? `panel ${panelSig(scope, item.id)}`
          : `handle ${handleSig(scope, item.beforeId, item.afterId)}`;
      },
      attrs: (scope) => {
        const item = scope.slot as unknown as SplitterItem;
        return item.type === "panel"
          ? panelBag(scope, item.id)
          : handleBag(scope, item.beforeId, item.afterId);
      },
    },
    itemIndicator: {
      indexes: (_context, props) => itemsOf(panelsOf(props)),
      sig: (scope) => {
        const item = scope.slot as unknown as SplitterItem;
        return item.type === "handle"
          ? indicatorSig(scope, item.beforeId, item.afterId)
          : "panel";
      },
      attrs: (scope) => {
        const item = scope.slot as unknown as SplitterItem;
        return item.type === "handle"
          ? indicatorBag(scope, item.beforeId, item.afterId)
          : {};
      },
    },
    itemLabel: {
      indexes: (_context, props) => itemsOf(panelsOf(props)),
      sig: (scope) => {
        const item = scope.slot as unknown as SplitterItem;
        return item.type === "handle" ? "handle" : `panel ${item.id}`;
      },
      // The label span needs its own data-type, because data variants
      // match the element's own attributes, never ancestors.
      attrs: (scope) => {
        const item = scope.slot as unknown as SplitterItem;
        return item.type === "handle" ? { "data-type": "handle" } : {};
      },
    },
    panel: {
      id: "panel",
      indexes: (_context, props) => panelsOf(props).map((panel) => ({ id: panel.id })),
      sig: (scope) => panelSig(scope, (scope.slot as unknown as SplitterPanelSlotProps).id),
      attrs: (scope) => panelBag(scope, (scope.slot as unknown as SplitterPanelSlotProps).id),
    },
    handle: {
      id: "handle",
      indexes: (_context, props) => {
        const panels = panelsOf(props);
        return panels.slice(0, -1).map((panel, index) => ({
          beforeId: panel.id,
          afterId: panels[index + 1]?.id ?? "",
        }));
      },
      sig: (scope) => {
        const slot = scope.slot as unknown as SplitterHandleSlotProps;
        return handleSig(scope, slot.beforeId, slot.afterId);
      },
      attrs: (scope) => {
        const slot = scope.slot as unknown as SplitterHandleSlotProps;
        return handleBag(scope, slot.beforeId, slot.afterId);
      },
    },
    handleIndicator: {
      id: "handle-indicator",
      indexes: (_context, props) => {
        const panels = panelsOf(props);
        return panels.slice(0, -1).map((panel, index) => ({
          beforeId: panel.id,
          afterId: panels[index + 1]?.id ?? "",
        }));
      },
      sig: (scope) => {
        const slot = scope.slot as unknown as SplitterHandleSlotProps;
        return indicatorSig(scope, slot.beforeId, slot.afterId);
      },
      attrs: (scope) => {
        const slot = scope.slot as unknown as SplitterHandleSlotProps;
        return indicatorBag(scope, slot.beforeId, slot.afterId);
      },
    },
  },
  commands: {
    setSizes: { event: (args) => ({ type: "SET_SIZE", size: [...(args[0] as readonly number[])] }) },
    resetSizes: { event: () => ({ type: "RESET_SIZE" }) },
    collapsePanel: { event: (args) => ({ type: "COLLAPSE_PANEL", id: args[0] as string }) },
    expandPanel: {
      event: (args) => ({
        type: "EXPAND_PANEL",
        id: args[0] as string,
        ...(args[1] === undefined ? {} : { minSize: args[1] as number }),
      }),
    },
    resizePanel: {
      event: (args) => ({ type: "RESIZE_PANEL", id: args[0] as string, size: args[1] as number }),
    },
  },
  readers: {
    dragging: { read: (_context, state) => state === "dragging" },
    orientation: { read: (context) => asCtx(context).orientation },
  },
  methods: {
    getPanelIds: {
      call: (context) => (context as unknown as Ctx).panels.map((panel) => panel.id),
    },
    getItems: {
      call: (context) => itemsOf((context as unknown as Ctx).panels),
    },
    getHandles: {
      call: (context) => {
        const panels = (context as unknown as Ctx).panels;
        return panels.slice(0, -1).map((panel, index) => ({
          beforeId: panel.id,
          afterId: panels[index + 1]?.id ?? "",
        }));
      },
    },
    getSizes: {
      call: (context) => [...(context as unknown as Ctx).size],
    },
    getPanelSize: {
      call: (context, _state, args) => {
        const ctx = context as unknown as Ctx;
        const index = ctx.panels.findIndex((panel) => panel.id === (args[0] as string));
        return ctx.size[index] ?? 0;
      },
    },
    isPanelCollapsed: {
      call: (context, _state, args) => {
        const ctx = context as unknown as Ctx;
        return panelCollapsed(ctx.panels, ctx.size, args[0] as string);
      },
    },
    getHandleState: {
      call: (context, state, args) => {
        const ctx = context as unknown as Ctx;
        const slot = args[0] as SplitterHandleSlotProps;
        const handle = handleId(slot.beforeId, slot.afterId);
        return {
          focused: ctx.focusedHandle === handle,
          dragging: state === "dragging" && ctx.drag?.handleId === handle,
        };
      },
    },
  },
  events: {
    resize: {
      prop: "onResize",
      watch: (context) => [...asCtx(context).size],
      detail: (watched, _event, _props, context) => {
        void watched;
        const ctx = context as unknown as Ctx;
        return {
          size: [...ctx.size],
          handleId: ctx.drag?.handleId ?? null,
        };
      },
    },
    "resize-end": {
      prop: "onResizeEnd",
      watch: (context) => [...asCtx(context).size],
      detail: (watched) => ({
        size: [...(watched as number[])],
        handleId: null,
      }),
      // A commit with no size move still ends the gesture (the watch
      // alone would swallow it); an empty layout is not a resize anyone
      // made. RESET_SIZE resizes without ending — it is not in the set.
      select: (event, _before, after) => {
        if (!COMMIT_TYPES.has(event.type)) return null;
        const ctx = after as unknown as Ctx;
        if (ctx.size.length === 0) return null;
        return {
          size: [...ctx.size],
          handleId: ctx.drag?.handleId ?? null,
        };
      },
    },
  },
};

export const splitter = defineComponent<SplitterContext, SplitterEvent, SplitterApi>(def);
