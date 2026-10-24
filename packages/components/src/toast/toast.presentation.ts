import {
  ariaDescribedBy,
  ariaLabelledBy,
  dataAttr,
  defineComponent,
  liveRegion,
  machineTick,
  type ApiOf,
  type ComponentDef,
  type ScopeFor,
  type SlotScopeFor,
} from "@spin/runtime";
import { toast as toastMachine } from "./toast.machine.ts";
import type {
  ToastArgs,
  ToastContext,
  ToastEntry,
  ToastState,
  ToastStatus,
  ToastType,
} from "./toast.state.ts";
import type { ToastEvents } from "./toast.events.ts";
import type {
  ToastRegionParam,
  ToastTimerParam,
} from "@spin/runtime/actions";

/**
 * Toast definition: the DOM contract as data. The queue is one context, so
 * the whole contract is one api: `getGroupProps` for the region,
 * `getToastProps` and the title/description/action/close parts for a row,
 * and `getToasts` as the render source.
 *
 * The clocks live in the actions: `use:toast-timer` owns the dismissal
 * clock (with its pause/remainder report), the remove delay, and the frame
 * after the row attaches that starts the entry motion; `use:toast-row` owns
 * the measured height; `use:toast-region` owns the document reflexes.
 * Neither the machine nor this file keeps a timer.
 *
 * Where the queue lives: the host's `items` prop is the write channel. A
 * toast the machine took out on its own is remembered, so a later host
 * write of the same list does not bring it back. A host that means to
 * re-show a toast gives it a new id.
 */

/** One queue entry as the host authors it. */
export interface ToastItem {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly type: string;
  /** An unset duration (0 or less) is the type's own. */
  readonly duration: number;
  /** An unset priority (0 or less) is the type's own. */
  readonly priority: number;
  readonly action: string;
}

export interface ToastStatusChange {
  readonly id: string;
  readonly status: ToastStatus | "unmounted";
  /** What caused it: `user`, `keyboard`, or "" for a host write or timer. */
  readonly src: string;
}

// ToastApi derived below

const isToastType = (raw: unknown): raw is ToastType =>
  raw === "info" || raw === "success" || raw === "warning" || raw === "error" || raw === "loading";

/** The toast's own record test: it accepts an array, which the
 * framework's record test rejects. */
const isRecordOrArray = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const asType = (raw: unknown): ToastType => isToastType(raw) ? raw : "info";

const asText = (raw: unknown): string => (typeof raw === "string" ? raw : "");

const asCount = (raw: unknown, fallback: number): number =>
  typeof raw === "number" && Number.isFinite(raw) ? Math.trunc(raw) : fallback;

/** Unlike the record test above, an array is not a record. */
const asRecord = (raw: unknown): raw is Record<string, unknown> =>
  typeof raw === "object" && raw !== null && !Array.isArray(raw);

const toEntry = (raw: unknown): ToastItem | undefined => {
  if (!asRecord(raw)) return undefined;
  const id = asText(raw["id"]);
  if (id.length === 0) return undefined;
  return {
    id,
    title: asText(raw["title"]),
    description: asText(raw["description"]),
    type: asType(raw["type"]),
    duration: asCount(raw["duration"], 0),
    priority: asCount(raw["priority"], 0),
    action: asText(raw["action"]),
  };
};

const parseItems = (raw: unknown): readonly ToastItem[] => {
  if (!Array.isArray(raw)) return [];
  return raw.map(toEntry).filter((item): item is ToastItem => item !== undefined);
};

const sameEntry = (a: ToastItem, b: ToastEntry): boolean =>
  a.id === b.id &&
  a.title === b.title &&
  a.description === b.description &&
  a.type === b.type &&
  a.action === b.action &&
  a.priority === b.priority &&
  // A duration the host did not author keeps the clock it already has.
  (a.duration <= 0 || a.duration === b.remaining);

type ScopeLike = ScopeFor<ToastContext, ToastEvents, ToastState>;
type SlotLike<R> = SlotScopeFor<R, ToastContext, ToastEvents, ToastState>;
type Ctx = ToastContext;


/** Toasts the machine removed on its own; a host write never revives them.
 * Keyed by the context object, which is stable per service — assigns
 * replace fields, never the object. */
const removedByBridge = new WeakMap<object, Set<string>>();
const removedOf = (context: object): Set<string> => {
  let ids = removedByBridge.get(context);
  if (ids === undefined) {
    ids = new Set();
    removedByBridge.set(context, ids);
  }
  return ids;
};

const posture = (placement: string): { side: "top" | "bottom"; align: "start" | "center" | "end" } => {
  const [side, align] = placement.split("-");
  return {
    side: side === "top" ? "top" : "bottom",
    align: align === "start" || align === "end" ? align : "center",
  };
};

/** Zag's `setLastFocusedEl` / `restoreFocusIfPointerOut`: the element focus
 * came from is remembered, and given back when the region is left by both
 * the pointer and the keyboard. Keyed by bridge send — the def-built api may
 * rebuild, the memory must not. */
const focusedByBridge = new WeakMap<object, { current: Element | undefined }>();
const lastFocusedOf = (
  scope: ScopeLike,
): { current: Element | undefined } => {
  let slot = focusedByBridge.get(scope.send);
  if (slot === undefined) {
    slot = { current: undefined };
    focusedByBridge.set(scope.send, slot);
  }
  return slot;
};

const onGroupFocus = (scope: ScopeLike, event: FocusEvent): void => {
  const related = event.relatedTarget;
  if (related !== null && related instanceof Element && scope.root().contains(related)) return;
  lastFocusedOf(scope).current = related instanceof Element ? related : undefined;
  scope.send({ type: "REGION.FOCUS" });
};

const onGroupBlur = (scope: ScopeLike, event: FocusEvent): void => {
  const related = event.relatedTarget;
  const inside = related !== null && related instanceof Element && scope.root().contains(related);
  if (!inside) scope.send({ type: "REGION.BLUR" });
  const last = lastFocusedOf(scope).current;
  if (!scope.context.pointerWithin && last instanceof HTMLElement) {
    last.focus({ preventScroll: true });
    lastFocusedOf(scope).current = undefined;
  }
};

const onGroupPointerLeave = (scope: ScopeLike): void => {
  scope.send({ type: "REGION.POINTER_LEAVE" });
  // The region giving up the pointer gives back the focus it borrowed.
  const last = lastFocusedOf(scope).current;
  if (!scope.context.focusWithin && last instanceof HTMLElement) {
    last.focus({ preventScroll: true });
    lastFocusedOf(scope).current = undefined;
  }
};

const placementOf = (context: ToastContext): string => context.placement;

const stackOffset = (scope: ScopeLike, index: number): number => {
  const gap = scope.context.gap;
  const list = scope.context.toasts;
  let before = index * gap;
  for (let position = 0; position < index; position += 1) before += list[position]?.height ?? 0;
  return before;
};

/**
 * How far behind the front a row sits, as the transform the recipe reads.
 * A settled row is at its offset: the arrival and the exit are the fade
 * and the scale, so a row never waits outside the viewport for its entry
 * beat.
 */
const offsetY = (scope: ScopeLike, index: number): string => {
  const placement = placementOf(scope.context);
  const { side } = posture(placement);
  const gap = scope.context.gap;
  const distance = scope.state === "overlap" ? index * gap : stackOffset(scope, index);
  // A settled front row is at the origin, not at negative zero.
  return `${side === "top" ? distance : -distance || 0}px`;
};

/** A row that has not settled into place is slightly small and clear. A
 * paused row holds its clocks but stays put: only the exit clears it. */
const settledRow = (entry: ToastEntry): boolean =>
  entry.status !== "dismissing" && entry.mounted;

const opacityOf = (entry: ToastEntry): string => (settledRow(entry) ? "1" : "0");

const scaleOf = (entry: ToastEntry, index: number, overlapped: boolean): string => {
  if (!settledRow(entry)) return "0.96";
  if (!overlapped || index === 0) return "1";
  return String(Math.max(0.6, 1 - index * 0.05));
};

const def = {
  name: "toast",
  machine: (props, authored) => toastMachine(props as ToastArgs, authored),
  establish: (props) =>
    props["overlap"] === true ? [{ type: "REGION.OVERLAP" }] : [],
  reconcile: ({ context, state, parsed, send }) => {
    const ctx = context;
    let moved = false;
    // The machine's bounds, kept in step with the props: a cap below one
    // is no cap, a negative delay is no delay.
    const max = Math.max(1, asCount(parsed["max"], 24));
    if (ctx.max !== max) {
      ctx.max = max;
      moved = true;
    }
    const removeDelay = Math.max(0, asCount(parsed["removeDelay"], 200));
    if (ctx.removeDelay !== removeDelay) {
      ctx.removeDelay = removeDelay;
      moved = true;
    }
    const overlap = parsed["overlap"] === true;
    if (overlap && state !== "overlap") {
      send({ type: "REGION.OVERLAP" });
      moved = true;
    }
    if (!overlap && state === "overlap") {
      send({ type: "REGION.STACK" });
      moved = true;
    }
    const incoming = parseItems(parsed["items"]);
    const before = [...ctx.toasts, ...ctx.queued];
    const removed = removedOf(context);
    for (const item of incoming) {
      const current = before.find((entry) => entry.id === item.id);
      if (current === undefined) {
        if (removed.has(item.id)) continue;
        send({
          type: "TOAST.CREATE",
          id: item.id,
          title: item.title,
          description: item.description,
          toastType: asType(item.type),
          duration: item.duration,
          priority: item.priority,
          action: item.action,
        });
        moved = true;
      } else if (!sameEntry(item, current)) {
        send({
          type: "TOAST.UPDATE",
          id: item.id,
          title: item.title,
          description: item.description,
          toastType: asType(item.type),
          duration: item.duration,
          priority: item.priority,
          action: item.action,
        });
        moved = true;
      }
    }
    for (const entry of before) {
      if (incoming.some((item) => item.id === entry.id)) continue;
      send({ type: "TOAST.REMOVE", id: entry.id });
      moved = true;
    }
    return moved;
  },
  parts: {
    group: {
      attrs: (scope: SlotLike<ToastEntry>) => {
        const ctx = scope.context;
        const placement = ctx.placement;
        const { side, align } = posture(placement);
        const offset = ctx.offsets;
        const count = ctx.toasts.length;
        const overlapped = scope.state === "overlap";
        const hotkey = ctx.hotkey;
        const label = ctx.label;
        return {
          id: scope.id("group"),
          role: "region",
          tabindex: -1,
          "aria-label": hotkey.length > 0
          ? `${label}, ${placement} (${hotkey})`
          : `${label}, ${placement}`,
          ...liveRegion({ live: "polite", relevant: "additions text", atomic: "false" }),
          "data-placement": placement,
          "data-side": side,
          "data-align": align,
          "data-count": String(count),
          "data-empty": dataAttr(count === 0),
          "data-overlap": dataAttr(overlapped),
          "data-stack": dataAttr(!overlapped),
          // The region's own box: the gap it stacks with, and the inset
          // its placement asks for. The recipe names no var — the bag
          // carries the geometry.
          style: {
            gap: `${ctx.gap}px`,
            ...(side === "top" ? { top: offset } : { bottom: offset }),
            ...(align === "start"
              ? { left: offset }
              : align === "end"
              ? { right: offset }
              : { left: "50%", right: "50%" }),
          },
          "use:toast-region": {
            hotkey: hotkey.split(",").map((key) => key.trim()).filter((key) => key.length > 0),
            pauseOnPageIdle: ctx.pauseOnPageIdle,
            onIdleChange: (idle: boolean): void => {
              scope.send({ type: idle ? "PAGE.IDLE" : "PAGE.ACTIVE" });
            },
          } satisfies ToastRegionParam,
          onMouseEnter: (): void => scope.send({ type: "REGION.POINTER_ENTER" }),
          onMouseMove: (): void => scope.send({ type: "REGION.POINTER_ENTER" }),
          onMouseLeave: (): void => onGroupPointerLeave(scope),
          onFocus: (event: FocusEvent): void => onGroupFocus(scope, event),
          onBlur: (event: FocusEvent): void => onGroupBlur(scope, event),
        };
      },
    },
  },
  slots: {
    toast: {
      indexes: (context) => [...context.toasts],
      attrs: (scope: SlotLike<ToastEntry>) => {
        const entry = scope.slot;
        const ctx = scope.context;
        const placement = ctx.placement;
        const { side, align } = posture(placement);
        const index = ctx.toasts.findIndex((candidate) => candidate.id === entry.id);
        const at = index === -1 ? ctx.toasts.length : index;
        const frontmost = at === 0;
        // Assigns replace entries, so the slot's captured entry goes stale
        // on the first status move: resolve live.
        const current = ctx.toasts.find((candidate) => candidate.id === entry.id) ?? entry;
        const visible = current.status !== "dismissing";
        const paused = current.status === "persist";
        const overlapped = scope.state === "overlap";
        return {
          id: scope.id("toast", entry.id),
          role: "status",
          tabindex: 0,
          ...liveRegion({ atomic: "true" }),
          ...ariaLabelledBy(scope, { part: "toast", slot: `${entry.id}:title` }),
          ...ariaDescribedBy(
            scope,
            entry.description.length > 0
              ? { part: "toast", slot: `${entry.id}:description` }
              : undefined,
          ),
          "data-state": visible ? "open" : "closed",
          "data-type": entry.type,
          "data-placement": placement,
          "data-side": side,
          "data-align": align,
          "data-mounted": dataAttr(current.mounted),
          "data-paused": dataAttr(paused),
          "data-first": dataAttr(frontmost),
          "data-sibling": dataAttr(!frontmost),
          "data-stack": dataAttr(!overlapped),
          "data-overlap": dataAttr(overlapped),
          // The row's own box: where it sits in the stack, how it reads
          // while it settles, and its place in the paint order. The
          // recipe names no var — the bag carries the geometry.
          style: {
            transform: `translateY(${offsetY(scope, at)})`,
            scale: scaleOf(current, at, overlapped),
            opacity: opacityOf(current),
            zIndex: String(ctx.toasts.length - at),
          },
          onKeydown: (event: KeyboardEvent): void => {
            if (event.defaultPrevented) return;
            if (event.key === "Escape") {
              event.preventDefault();
              scope.send({ type: "TOAST.DISMISS", id: entry.id, src: "keyboard" });
            }
          },
          "use:toast-timer": {
            remaining: current.remaining,
            paused,
            dismissing: current.status === "dismissing",
            removeDelay: ctx.removeDelay,
            onTimeout: (): void => scope.send({ type: "TIMER.ELAPSED", id: entry.id }),
            onRemove: (): void => scope.send({ type: "TIMER.REMOVED", id: entry.id }),
            onPause: (remaining: number): void => {
              scope.send({ type: "TOAST.PAUSE", id: entry.id, remaining });
            },
            onReady: (): void => scope.send({ type: "TOAST.MOUNTED", id: entry.id }),
          } satisfies ToastTimerParam,
          "use:toast-row": {
            onHeight: (height: number): void => {
              scope.send({ type: "HEIGHT.SET", id: entry.id, height });
            },
          },
        };
      },
    },
    title: {
      id: "toast",
      indexes: (context) => [...context.toasts],
      attrs: (scope: SlotLike<ToastEntry>) => {
        const entry = scope.slot;
        return {
          id: scope.id("toast", `${entry.id}:title`),
          "data-type": entry.type,
        };
      },
    },
    description: {
      id: "toast",
      indexes: (context) => [...context.toasts],
      attrs: (scope: SlotLike<ToastEntry>) => {
        const entry = scope.slot;
        return {
          id: scope.id("toast", `${entry.id}:description`),
        };
      },
    },
    actionTrigger: {
      id: "toast",
      indexes: (context) => [...context.toasts],
      attrs: (scope: SlotLike<ToastEntry>) => {
        const entry = scope.slot;
        return {
          id: scope.id("toast", `${entry.id}:action`),
          type: "button",
          "aria-label": entry.action,
          hidden: entry.action.length === 0,
          onClick: (event: MouseEvent): void => {
            if (event.defaultPrevented) return;
            // The host's action is reported as an event the host answers;
            // the dismissal follows either way.
            scope.root().dispatchEvent(
              new CustomEvent("toast-action", { bubbles: true, detail: { id: entry.id } }),
            );
            scope.send({ type: "TOAST.DISMISS", id: entry.id, src: "user" });
          },
        };
      },
    },
    closeTrigger: {
      id: "toast",
      indexes: (context) => [...context.toasts],
      attrs: (scope: SlotLike<ToastEntry>) => {
        const entry = scope.slot;
        return {
          id: scope.id("toast", `${entry.id}:close`),
          type: "button",
          "aria-label": "Dismiss notification",
          hidden: scope.context.closable === false,
          onClick: (event: MouseEvent): void => {
            if (event.defaultPrevented) return;
            scope.send({ type: "TOAST.DISMISS", id: entry.id, src: "user" });
          },
        };
      },
    },
  },
  commands: {
    create: {
      event: (args: readonly unknown[]) => {
        const item: unknown = args[0];
        if (typeof item !== "object" || item === null) throw new Error("[toast] create requires an item object");
        if (!isRecordOrArray(item)) throw new Error("[toast] create requires an object item");
        const field = (name: string): unknown => item[name];
        const id = field("id");
        if (typeof id !== "string" || id.length === 0) throw new Error("[toast] create requires a string id");
        const text = (name: string): string => { const v = field(name); return typeof v === "string" ? v : ""; };
        const count = (name: string): number => { const v = field(name); return typeof v === "number" && Number.isFinite(v) ? Math.trunc(v) : 0; };
        return {
          type: "TOAST.CREATE",
          id,
          title: text("title"),
          description: text("description"),
          toastType: asType(field("type")),
          duration: count("duration"),
          priority: count("priority"),
          action: text("action"),
        };
      },
    },
    update: {
      event: (args: readonly unknown[], context: Ctx) => {
        const id = args[0];
        const item: unknown = args[1];
        if (typeof id !== "string") throw new Error("[toast] update requires a string id");
        if (!isRecordOrArray(item)) throw new Error("[toast] update requires a partial item object");
        const field = (name: string): unknown => item[name];
        const textOr = (name: string, fallback: string): string => {
          const v = field(name);
          return typeof v === "string" ? v : fallback;
        };
        const count = (name: string): number => {
          const v = field(name);
          return typeof v === "number" && Number.isFinite(v) ? Math.trunc(v) : 0;
        };
        const current = context.toasts.find((entry) => entry.id === id) ??
          context.queued.find((entry) => entry.id === id);
        return {
          type: "TOAST.UPDATE",
          id,
          title: textOr("title", current?.title ?? ""),
          description: textOr("description", current?.description ?? ""),
          toastType: asType(field("type") ?? current?.type),
          duration: count("duration"),
          priority: count("priority"),
          action: textOr("action", current?.action ?? ""),
        };
      },
    },
    dismiss: {
      event: (args: readonly unknown[]) => {
        const id = args[0];
        const src = args[1];
        return {
          type: "TOAST.DISMISS",
          id: typeof id === "string" ? id : "",
          src: typeof src === "string" ? src : "programmatic",
        };
      },
    },
    remove: {
      event: (args: readonly unknown[]) => { const id = args[0]; return { type: "TOAST.REMOVE", id: typeof id === "string" ? id : "" }; },
    },
    dismissAll: {
      event: () => ({ type: "DISMISS.ALL" }),
    },
    pause: {
      event: (args: readonly unknown[], context: Ctx) => {
        const id = args[0];
        if (typeof id !== "string") return { type: "TOAST.PAUSE", id: "", remaining: 0 };
        const ctx = context;
        return {
          type: "TOAST.PAUSE",
          id,
          remaining: ctx.toasts.find((entry) => entry.id === id)?.remaining ?? 0,
        };
      },
    },
    resume: {
      event: (args: readonly unknown[]) => { const id = args[0]; return { type: "TOAST.RESUME", id: typeof id === "string" ? id : "" }; },
    },
  },
  readers: {
    count: { read: (context) => context.toasts.length },
    layout: { read: (_context, state) => (state === "overlap" ? "overlap" : "stack") },
    placement: { read: (context) => placementOf(context) },
    overlapping: { read: (_context, state) => state === "overlap" },
    paused: {
      read: (context) => {
        const ctx = context;
        return ctx.pointerWithin || ctx.focusWithin || ctx.pageIdle;
      },
    },
  },
  methods: {
    getToasts: {
      call: (context): readonly ToastEntry[] => {
        // The tick is the subscription that re-reads the queue after a
        // move. Rows rebind on resync, so plain entries are enough — no
        // live getters needed.
        machineTick();
        return [...context.toasts];
      },
    },
  },
  events: {
    "status-change": {
      prop: "onStatusChange",
      watch: () => [],
      detail: (watched: readonly unknown[]) => { const v = watched[0]; return { id: typeof v === "string" ? v : "" }; },
      // Zag's per-toast `onStatusChange`, reported by diffing each toast's
      // status across a send: `visible` on the way in, `dismissing` when
      // the exit starts, `unmounted` when the queue lets go. A removal the
      // machine made on its own is remembered; a removal the host asked
      // for is not.
      select: (event, before, after, _states, source) => {
        const beforeList = before.toasts;
        const afterCtx = after as Ctx;
        const afterList = afterCtx.toasts;
        const remembered = source !== "reconcile";
        const src = event.type === "TOAST.DISMISS"
          ? (event["src"] as string)
          : "";
        const reports: Record<string, unknown>[] = [];
        for (const entry of beforeList) {
          const now = afterList.find((candidate) => candidate.id === entry.id);
          if (now === undefined) {
            if (remembered) removedOf(after).add(entry.id);
            reports.push({ id: entry.id, status: "unmounted", src });
          } else if (now.status !== entry.status) {
            reports.push({ id: entry.id, status: now.status, src });
          }
        }
        for (const entry of afterList) {
          if (beforeList.some((candidate) => candidate.id === entry.id)) continue;
          reports.push({ id: entry.id, status: "visible", src });
        }
        return reports.length === 0 ? null : reports;
      },
    },
  },
} satisfies ComponentDef<ToastContext, ToastEvents, Record<string, unknown>, ToastArgs, ToastState>;
export type ToastApi = ApiOf<typeof def>;
export const toast = defineComponent<ToastContext, ToastEvents, ToastApi, ToastArgs, ToastState>(def);
