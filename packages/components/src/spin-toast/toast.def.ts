import {
  dataAttr,
  defineComponent,
  machineTick,
  type ComponentDef,
  type PartScope as ScopeLike,
} from "@spin/runtime";
import {
  config,
  implementations,
  type ToastContext,
  type ToastEntry,
  type ToastEvent,
  type ToastStatus,
  type ToastType,
} from "./toast.machine.ts";
import type {
  ToastRegionParam,
  ToastTimerParam,
} from "./actions/toast-actions.ts";

/**
 * Toast definition: the DOM contract as data. The queue is one context, so
 * the whole contract is one api: `getGroupProps` for the region,
 * `getToastProps` and the title/description/action/close parts for a row,
 * and `getToasts` as the render source.
 *
 * Three things live here and nowhere else:
 *
 *  1. **Placement.** Inset is concrete geometry, so it becomes a utility
 *     choice instead: the region carries `data-side`/`data-align` presence
 *     attributes and the recipe's static classes key on them.
 *  2. **The stack.** Each row's offset is the measured heights of the rows
 *     in front of it plus the gaps, expressed as CSS custom properties the
 *     recipe's arbitrary-property utilities consume. Overlap mode lifts by
 *     the gap alone and scales the rows behind the front one down.
 *  3. **The clocks.** `use:toast-timer` owns the dismissal clock (with its
 *     pause/remainder report), the remove delay, and the frame after the
 *     row attaches that starts the entry motion; `use:toast-row` owns the
 *     measured height; `use:toast-region` owns the document reflexes.
 *     Neither the machine nor this file keeps a timer.
 *
 * Where the queue lives: the host's `items` prop is the write channel.
 * The reconcile diffs it one way — added ids create, dropped ids remove,
 * changed fields update — and a toast the machine took out on its own is
 * remembered, so a later host write of the same list does not bring it
 * back. A host that means to re-show a toast gives it a new id.
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
  /** The action trigger's label; empty is no action trigger. */
  readonly action: string;
}

export interface ToastStatusChange {
  readonly id: string;
  /** The statuses: `visible`, `dismissing`, `unmounted`. */
  readonly status: ToastStatus | "unmounted";
  /** What caused it: `user`, `keyboard`, or "" for a host write or timer. */
  readonly src: string;
}

export interface ToastApi {
  readonly count: number;
  readonly layout: "stack" | "overlap";
  readonly placement: string;
  readonly overlapping: boolean;
  readonly paused: boolean;
  create(item: ToastItem): void;
  update(id: string, item: Partial<ToastItem>): void;
  dismiss(id: string, src?: string): void;
  remove(id: string): void;
  dismissAll(): void;
  pause(id: string): void;
  resume(id: string): void;
  getToasts(): readonly ToastEntry[];
  getGroupProps(): Record<string, unknown>;
  getToastProps(entry: ToastEntry): Record<string, unknown>;
  getTitleProps(entry: ToastEntry): Record<string, unknown>;
  getDescriptionProps(entry: ToastEntry): Record<string, unknown>;
  getActionTriggerProps(entry: ToastEntry): Record<string, unknown>;
  getCloseTriggerProps(entry: ToastEntry): Record<string, unknown>;
}

/** The types the machine knows, in the order a host spells them. */
const TYPES: readonly string[] = ["info", "success", "warning", "error", "loading"];

const asType = (raw: unknown): ToastType => {
  if (typeof raw === "string" && TYPES.includes(raw)) return raw as ToastType;
  return "info";
};

const asText = (raw: unknown): string => (typeof raw === "string" ? raw : "");

const asCount = (raw: unknown, fallback: number): number =>
  typeof raw === "number" && Number.isFinite(raw) ? Math.trunc(raw) : fallback;

/** The object-array grammar hands back `unknown`; a record is what the fields
 * are read out of. */
const asRecord = (raw: unknown): raw is Record<string, unknown> =>
  typeof raw === "object" && raw !== null && !Array.isArray(raw);

/** The queue entry the prop channel carries, or none when a field is wrong. */
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

type Ctx = ToastContext;

const asCtx = (context: Record<string, unknown>): Ctx => context as unknown as Ctx;

const beforeToasts = (before: Record<string, unknown>): readonly ToastEntry[] =>
  (before["toasts"] as readonly ToastEntry[] | undefined) ?? [];

/** Tolls the machine removed on its own; a host write never revives them.
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

/** `top`/`bottom` plus the alignment the placement's suffix carries. */
const posture = (placement: string): { side: "top" | "bottom"; align: "start" | "center" | "end" } => {
  const [side, align] = placement.split("-");
  return {
    side: side === "top" ? "top" : "bottom",
    align: align === "start" || align === "end" ? align : "center",
  };
};

/** Zag's `setLastFocusedEl` / `restoreFocusIfPointerOut`: the element focus
 * came from is remembered, and given back when the region is left by both
 * the pointer and the keyboard. Keyed by bridge send, like the typeahead
 * buffer — the def-built api may rebuild, the memory must not. */
const focusedByBridge = new WeakMap<
  (event: { type: string } & Record<string, unknown>) => void,
  { current: Element | undefined }
>();
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
  if (!asCtx(scope.context).pointerWithin && last instanceof HTMLElement) {
    last.focus({ preventScroll: true });
    lastFocusedOf(scope).current = undefined;
  }
};

const onGroupPointerLeave = (scope: ScopeLike): void => {
  scope.send({ type: "REGION.POINTER_LEAVE" });
  // The region giving up the pointer gives back the focus it borrowed.
  const last = lastFocusedOf(scope).current;
  if (!asCtx(scope.context).focusWithin && last instanceof HTMLElement) {
    last.focus({ preventScroll: true });
    lastFocusedOf(scope).current = undefined;
  }
};

/** Zag's `heightBefore` plus the gaps: how far behind the front a row sits. */
const stackOffset = (scope: ScopeLike, index: number): number => {
  const gap = asCount(scope.props["gap"], 16);
  const list = asCtx(scope.context).toasts;
  let before = index * gap;
  for (let position = 0; position < index; position += 1) before += list[position]?.height ?? 0;
  return before;
};

/**
 * How far behind the front a row sits, as the transform the recipe reads.
 * A settled row is at its offset: the arrival and the exit are the fade
 * and the scale, so a row is never parked outside the viewport waiting
 * for its entry beat.
 */
const offsetY = (scope: ScopeLike, index: number): string => {
  const { side } = posture(scope.props["placement"] as string);
  const gap = asCount(scope.props["gap"], 16);
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

const def: ComponentDef<ToastContext, ToastEvent> = {
  name: "toast",
  config,
  implementations,
  seed: (props) => ({
    overlap: props["overlap"] === true,
    max: Math.max(1, asCount(props["max"], 24)),
    removeDelay: Math.max(0, asCount(props["removeDelay"], 200)),
  }),
  // The authored overlap prop is the group's initial posture: the fork's
  // `initial` is static, so the region enters overlap as the prop says,
  // exactly as Zag's `initialState({ prop })`.
  establish: (props) =>
    (props["overlap"] as boolean) === true ? [{ type: "REGION.OVERLAP" }] : [],
  channels: {
    items: { parse: parseItems },
    overlap: { parse: (raw) => raw === true },
    max: { parse: (raw) => Math.max(1, asCount(raw, 24)) },
    removeDelay: { parse: (raw) => Math.max(0, asCount(raw, 200)) },
    placement: {
      parse: (raw) => (typeof raw === "string" && raw.length > 0 ? raw : "bottom"),
    },
    gap: { parse: (raw) => Math.max(0, asCount(raw, 16)) },
    offsets: {
      parse: (raw) => (typeof raw === "string" && raw.length > 0 ? raw : "1rem"),
    },
    hotkey: { parse: (raw) => (typeof raw === "string" ? raw : "") },
    pauseOnPageIdle: { parse: (raw) => raw !== false },
    label: {
      parse: (raw) => (typeof raw === "string" && raw.length > 0 ? raw : "Notifications"),
    },
    closable: { parse: (raw) => raw !== false },
  },
  scalars: ["overlap", "max", "removeDelay"],
  reconcile: ({ context, state, parsed, send }) => {
    const ctx = asCtx(context);
    let moved = false;
    const overlap = parsed["overlap"] === true;
    if (overlap && state !== "overlap") {
      send({ type: "REGION.OVERLAP" });
      moved = true;
    }
    if (!overlap && state === "overlap") {
      send({ type: "REGION.STACK" });
      moved = true;
    }
    // The host's list is the queue's source, so the diff is one-way: ids
    // the host added are created, ids the host dropped are removed, and a
    // changed field is an update.
    const incoming = parsed["items"] as readonly ToastItem[];
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
      sig: (scope) => {
        const ctx = asCtx(scope.context);
        return [
          scope.props["placement"],
          scope.props["gap"],
          scope.props["offsets"],
          scope.props["label"],
          scope.props["hotkey"],
          ctx.toasts.length,
          scope.state,
        ].join(" ");
      },
      attrs: (scope) => {
        const ctx = asCtx(scope.context);
        const placement = scope.props["placement"] as string;
        const { side, align } = posture(placement);
        const count = ctx.toasts.length;
        const overlapped = scope.state === "overlap";
        const hotkey = scope.props["hotkey"] as string;
        return {
          id: scope.id("group"),
          role: "region",
          tabindex: -1,
          "aria-label": hotkey.length > 0
            ? `${scope.props["label"]}, ${placement} (${hotkey})`
            : `${scope.props["label"]}, ${placement}`,
          "aria-live": "polite",
          "aria-relevant": "additions text",
          "aria-atomic": "false",
          "data-placement": placement,
          "data-side": side,
          "data-align": align,
          "data-count": String(count),
          "data-empty": dataAttr(count === 0),
          "data-overlap": dataAttr(overlapped),
          "data-stack": dataAttr(!overlapped),
          // Geometry: the region's own inset and gaps are data; where they
          // land is the recipe's decision.
          style: {
            "--toast-gap": `${asCount(scope.props["gap"], 16)}px`,
            "--toast-offset": scope.props["offsets"],
          },
          "use:toast-region": {
            hotkey: hotkey.split(",").map((key) => key.trim()).filter((key) => key.length > 0),
            pauseOnPageIdle: scope.props["pauseOnPageIdle"] !== false,
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
      indexes: (context) => [...asCtx(context).toasts],
      sig: (scope) => {
        const entry = scope.slot as unknown as ToastEntry;
        const ctx = asCtx(scope.context);
        return [
          entry.status,
          entry.mounted,
          entry.remaining,
          entry.height,
          ctx.overlap,
          scope.state,
          ctx.pointerWithin,
          ctx.focusWithin,
          ctx.toasts.findIndex((candidate) => candidate.id === entry.id),
          ctx.toasts.length,
          scope.props["placement"],
          scope.props["removeDelay"],
        ].join(" ");
      },
      attrs: (scope) => {
        const entry = scope.slot as unknown as ToastEntry;
        const ctx = asCtx(scope.context);
        const placement = scope.props["placement"] as string;
        const { side, align } = posture(placement);
        const index = ctx.toasts.findIndex((candidate) => candidate.id === entry.id);
        const at = index === -1 ? ctx.toasts.length : index;
        const frontmost = at === 0;
        // Assigns replace entries rather than mutating them, so the slot's
        // captured entry goes stale on the first status move: resolve live.
        const current = ctx.toasts.find((candidate) => candidate.id === entry.id) ?? entry;
        const visible = current.status !== "dismissing";
        const paused = current.status === "persist";
        const overlapped = scope.state === "overlap";
        return {
          id: scope.id("toast", entry.id),
          role: "status",
          tabindex: 0,
          "aria-atomic": "true",
          "aria-labelledby": scope.id("toast", `${entry.id}:title`),
          "aria-describedby": entry.description.length > 0 ? scope.id("toast", `${entry.id}:description`) : undefined,
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
          style: {
            "--toast-y": offsetY(scope, at),
            "--toast-opacity": opacityOf(current),
            "--toast-scale": scaleOf(current, at, overlapped),
            "--toast-z": String(ctx.toasts.length - at),
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
            removeDelay: asCount(scope.props["removeDelay"], 200),
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
      indexes: (context) => [...asCtx(context).toasts],
      sig: (scope) => {
        const entry = scope.slot as unknown as ToastEntry;
        return `${entry.title} ${entry.type}`;
      },
      attrs: (scope) => {
        const entry = scope.slot as unknown as ToastEntry;
        return {
          id: scope.id("toast", `${entry.id}:title`),
          "data-type": entry.type,
        };
      },
    },
    description: {
      id: "toast",
      indexes: (context) => [...asCtx(context).toasts],
      sig: (scope) => `${(scope.slot as unknown as ToastEntry).description}`,
      attrs: (scope) => {
        const entry = scope.slot as unknown as ToastEntry;
        return {
          id: scope.id("toast", `${entry.id}:description`),
        };
      },
    },
    actionTrigger: {
      id: "toast",
      indexes: (context) => [...asCtx(context).toasts],
      sig: (scope) => `${(scope.slot as unknown as ToastEntry).action}`,
      attrs: (scope) => {
        const entry = scope.slot as unknown as ToastEntry;
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
      indexes: (context) => [...asCtx(context).toasts],
      sig: (scope) => {
        const entry = scope.slot as unknown as ToastEntry;
        return `${entry.id} ${scope.props["closable"] !== false}`;
      },
      attrs: (scope) => {
        const entry = scope.slot as unknown as ToastEntry;
        return {
          id: scope.id("toast", `${entry.id}:close`),
          type: "button",
          "aria-label": "Dismiss notification",
          hidden: scope.props["closable"] === false,
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
      event: (args) => {
        const item = args[0] as ToastItem;
        return {
          type: "TOAST.CREATE",
          id: item.id,
          title: item.title,
          description: item.description,
          toastType: asType(item.type),
          duration: item.duration,
          priority: item.priority,
          action: item.action,
        };
      },
    },
    update: {
      event: (args, context) => {
        const id = args[0] as string;
        const item = args[1] as Partial<ToastItem>;
        const ctx = context as unknown as Ctx;
        const current = ctx.toasts.find((entry) => entry.id === id) ??
          ctx.queued.find((entry) => entry.id === id);
        // A partial item merges over the entry the queue already holds.
        return {
          type: "TOAST.UPDATE",
          id,
          title: item.title ?? current?.title ?? "",
          description: item.description ?? current?.description ?? "",
          toastType: asType(item.type ?? current?.type),
          duration: item.duration ?? 0,
          priority: item.priority ?? 0,
          action: item.action ?? current?.action ?? "",
        };
      },
    },
    dismiss: {
      event: (args) => ({
        type: "TOAST.DISMISS",
        id: args[0] as string,
        src: (args[1] as string | undefined) ?? "programmatic",
      }),
    },
    remove: {
      event: (args) => ({ type: "TOAST.REMOVE", id: args[0] as string }),
    },
    dismissAll: {
      event: () => ({ type: "DISMISS.ALL" }),
    },
    pause: {
      event: (args, context) => {
        const id = args[0] as string;
        const ctx = context as unknown as Ctx;
        return {
          type: "TOAST.PAUSE",
          id,
          remaining: ctx.toasts.find((entry) => entry.id === id)?.remaining ?? 0,
        };
      },
    },
    resume: {
      event: (args) => ({ type: "TOAST.RESUME", id: args[0] as string }),
    },
  },
  readers: {
    count: { read: (context) => asCtx(context).toasts.length },
    layout: { read: (_context, state) => (state === "overlap" ? "overlap" : "stack") },
    placement: { read: (_context, _state, props) => props["placement"] },
    overlapping: { read: (_context, state) => state === "overlap" },
    paused: {
      read: (context) => {
        const ctx = asCtx(context);
        return ctx.pointerWithin || ctx.focusWithin || ctx.pageIdle;
      },
    },
  },
  methods: {
    getToasts: {
      call: (context) => {
        // The `for` effect re-runs only on signals its source reads: the
        // tick is the subscription that re-reads the queue after a move.
        machineTick();
        return [...(context as unknown as Ctx).toasts];
      },
    },
  },
  events: {
    "status-change": {
      prop: "onStatusChange",
      watch: () => [],
      detail: (watched) => ({ id: watched[0] as string }),
      // Zag's per-toast `onStatusChange`, reported by diffing each toast's
      // status across a send: `visible` on the way in, `dismissing` when
      // the exit starts, `unmounted` when the queue lets go. A removal the
      // machine made on its own is remembered (a host source never
      // revives it); a removal the host asked for is not.
      select: (event, before, after, _states, source) => {
        const beforeList = beforeToasts(before);
        const afterCtx = after as unknown as Ctx;
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
};

export const toast = defineComponent<ToastContext, ToastEvent, ToastApi>(def);
