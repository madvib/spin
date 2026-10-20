/**
 * Toast machine: the queue, every toast's lifecycle, and the region's
 * stacking mode.
 *
 * Zag splits this across two machines — a group that owns a STORE of toasts
 * and a per-toast machine whose `parent` prop reaches back into the group's
 * context for its z-index, height and placement. The store is app data: it
 * is the host's toaster, not the element's, and it does not come with the
 * machine. So the queue is context here, the host's `items` prop is the
 * write channel, and the per-toast lifecycle is a status on each entry
 * instead of a nested chart:
 *
 *   visible    — the dismissal clock runs (Zag's `visible`)
 *   persist    — the clock holds: paused, or loading, or no limit
 *                (Zag's `visible:persist`)
 *   dismissing — the exit is playing, the remove delay runs
 *                (Zag's `dismissing`); leaving the queue is `unmounted`
 *
 * The two states are the group's: `stack` lays the toasts out with the
 * measured heights, `overlap` collapses them onto the front one. Both answer
 * the queue events, which is why they live in one shared map — Zag puts them
 * at the root tier, and the fork's root tier cannot order a conditional
 * collapse ahead of them, so the states carry the queue and the root carries
 * what really works everywhere (the pause/resume reports, the page going
 * idle, the blur).
 *
 * Nothing here measures, waits, or touches the DOM: the clock is the
 * `toast-timer` action on each row, the heights arrive through
 * `use:resize-observer`, and the region's document reflexes are the
 * `toast-region` action.
 */

import { defaultTwin } from "@spin/runtime";
import { createMachine, type Machine } from "@spin/runtime/fsm";

export type ToastType = "info" | "success" | "warning" | "error" | "loading";

/** Where a toast is in its life. */
export type ToastStatus = "visible" | "persist" | "dismissing";

export interface ToastEntry {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly type: ToastType;
  readonly status: ToastStatus;
  /** The dismissal clock's remainder. Infinity is a clock that never fires. */
  readonly remaining: number;
  /** Queue order: lower sorts first. Zag's `priority`. */
  readonly priority: number;
  /** The action trigger's label. An empty label is no action trigger. */
  readonly action: string;
  /** Measured by the row's `use:resize-observer`; the stack's offsets. */
  readonly height: number;
  /** False until the frame after the row attached, which is the entry beat. */
  readonly mounted: boolean;
}

export interface ToastContext {
  /** Newest first — the front toast is index 0. */
  toasts: ToastEntry[];
  /** Entries waiting for room; `max` full means held, not dropped. */
  queued: ToastEntry[];
  /** The region's stacking mode, mirrored on every row as `data-stack`. */
  overlap: boolean;
  max: number;
  removeDelay: number;
  pointerWithin: boolean;
  focusWithin: boolean;
  pageIdle: boolean;
}

export type ToastEvent =
  | {
      type: "TOAST.CREATE";
      id: string;
      title: string;
      description: string;
      toastType: ToastType;
      duration: number;
      priority: number;
      action: string;
    }
  | {
      type: "TOAST.UPDATE";
      id: string;
      title: string;
      description: string;
      toastType: ToastType;
      duration: number;
      priority: number;
      action: string;
    }
  | { type: "TOAST.REMOVE"; id: string }
  | { type: "TOAST.DISMISS"; id: string; src: string }
  | { type: "DISMISS.ALL" }
  | { type: "TOAST.PAUSE"; id: string; remaining: number }
  | { type: "TOAST.RESUME"; id: string }
  | { type: "TOAST.MOUNTED"; id: string }
  | { type: "TIMER.ELAPSED"; id: string }
  | { type: "TIMER.REMOVED"; id: string }
  | { type: "HEIGHT.SET"; id: string; height: number }
  | { type: "REGION.POINTER_ENTER" }
  | { type: "REGION.POINTER_LEAVE" }
  | { type: "REGION.FOCUS" }
  | { type: "REGION.BLUR" }
  | { type: "REGION.OVERLAP" }
  | { type: "REGION.STACK" }
  | { type: "PAGE.IDLE" }
  | { type: "PAGE.ACTIVE" };

/** Zag's `defaultTimeouts`: an unset duration is the type's own. */
const DURATIONS: Readonly<Record<ToastType, number>> = {
  info: 5000,
  error: 5000,
  success: 2000,
  warning: 5000,
  loading: Infinity,
};

/** Zag's `priorities`: [actionable, plain] per type, lower sorts first. */
const PRIORITIES: Readonly<Record<ToastType, readonly [number, number]>> = {
  error: [1, 2],
  warning: [3, 6],
  loading: [4, 5],
  success: [5, 7],
  info: [6, 8],
};

/** An authored duration of 0 or less means "unset" — the type decides, and a
 * loading toast never takes one at all (Zag's `shouldPersist`). */
export const durationFor = (type: ToastType, authored: number): number =>
  authored > 0 && type !== "loading" ? authored : DURATIONS[type];

/** An authored priority of 0 or less means "unset" — the type decides. */
export const priorityFor = (type: ToastType, authored: number, hasAction: boolean): number =>
  authored > 0 ? authored : PRIORITIES[type][hasAction ? 0 : 1];

/** A clock that never elapses: a loading toast, or one with no limit. */
const forever = (entry: ToastEntry): boolean =>
  entry.type === "loading" || entry.remaining === Infinity;

/** `stacked` is the machine's state, so a collapse is this machine's. */
const projectedCount = (ctx: ToastContext, e: ToastEvent): number => {
  if (e.type === "TOAST.CREATE") return ctx.toasts.length + 1;
  if (e.type === "TOAST.REMOVE" || e.type === "TIMER.REMOVED") return ctx.toasts.length - 1;
  return ctx.toasts.length;
};

const makeEntry = (e: Extract<ToastEvent, { type: "TOAST.CREATE" }>): ToastEntry => ({
  id: e.id,
  title: e.title,
  description: e.description,
  type: e.toastType,
  status: "visible",
  remaining: durationFor(e.toastType, e.duration),
  priority: priorityFor(e.toastType, e.priority, e.action.length > 0),
  action: e.action,
  height: 0,
  mounted: false,
});

/** Zag's `processQueue`: the highest priority waits first, then age. */
const promote = (ctx: ToastContext): Pick<ToastContext, "toasts" | "queued"> => {
  const toasts = [...ctx.toasts];
  const waiting = [...ctx.queued].sort((a, b) => a.priority - b.priority);
  while (waiting.length > 0 && toasts.length < ctx.max) {
    const next = waiting.shift();
    if (next === undefined) break;
    toasts.unshift(next);
  }
  return { toasts, queued: waiting };
};

/** Apply `make` to the entry with this id, or report that there is none. */
const amend = (
  toasts: readonly ToastEntry[],
  id: string,
  make: (entry: ToastEntry) => ToastEntry,
): ToastEntry[] | undefined => {
  const at = toasts.findIndex((entry) => entry.id === id);
  const current = at === -1 ? undefined : toasts[at];
  if (current === undefined) return undefined;
  return [...toasts.slice(0, at), make(current), ...toasts.slice(at + 1)];
};

const resumeEntry = (entry: ToastEntry): ToastEntry =>
  entry.status !== "persist" || forever(entry) ? entry : { ...entry, status: "visible" };

/**
 * The queue events both states answer. Zag lifts them to the root tier; here
 * they sit in the states because the collapse candidate must run BEFORE the
 * assign it shares, and a root tier is evaluated after a root `*` fallback
 * but in front of nothing — the fork resolves candidates in the order
 * `state.on[type]`, `state.on[*]`, `config.on[type]`, `config.on[*]`, so a
 * root-level collapse rule would swallow the very event it guards.
 */
const QUEUE_EVENTS = {
  "TOAST.CREATE": [
    { target: "overlap", cond: "shouldCollapse", actions: [{ assign: "createToast" }] },
    { actions: [{ assign: "createToast" }] },
  ],
  "TOAST.REMOVE": [
    { target: "overlap", cond: "shouldCollapse", actions: [{ assign: "removeToast" }] },
    { actions: [{ assign: "removeToast" }] },
  ],
  "TIMER.REMOVED": [
    { target: "overlap", cond: "shouldCollapse", actions: [{ assign: "removeToast" }] },
    { actions: [{ assign: "removeToast" }] },
  ],
  "TOAST.UPDATE": { actions: [{ assign: "updateToast" }] },
  "TOAST.DISMISS": { actions: [{ assign: "dismissToast" }] },
  /** One command fans out here: the def's commands send one event each,
   * so a whole-queue exit is one event the assign loops over. */
  "DISMISS.ALL": { actions: [{ assign: "dismissAll" }] },
  "TIMER.ELAPSED": { actions: [{ assign: "dismissToast" }] },
  "TOAST.MOUNTED": { actions: [{ assign: "mountToast" }] },
  "HEIGHT.SET": { actions: [{ assign: "setHeight" }] },
} as const;

/**
 * The toast's arguments: the values the host may set.
 *
 * The names are the element's prop names — the machine is instantiated
 * with the element's prop bag and picks what it wants. The host's list
 * of toasts is not one of them: the queue is a diff of a list, and it
 * stays the element's statement of what the list means.
 */
export interface ToastArgs {
  /** Whether the region collapses its toasts onto the front one. */
  readonly overlap?: boolean;
  /** How many toasts the region shows at once. */
  readonly max?: number;
  /** The exit delay, in milliseconds. */
  readonly removeDelay?: number;
}

const asCountMachine = (raw: unknown, fallback: number): number =>
  typeof raw === "number" && Number.isFinite(raw) ? Math.trunc(raw) : fallback;

export function initial(args: ToastArgs, authored: (name: string) => boolean): ToastContext {
  // A channel: the host's write, or the machine's own default. The twin
  // is the framework's convention for the same write — a host that wrote
  // the twin wrote the channel too — and the framework has already
  // resolved the twin into the argument.
  const written = (field: string): boolean =>
    authored(field) || authored(defaultTwin(field));
  return {
    toasts: [],
    queued: [],
    overlap: written("overlap") ? args.overlap === true : false,
    max: written("max") ? Math.max(1, asCountMachine(args.max, 24)) : 24,
    removeDelay: written("removeDelay")
      ? Math.max(0, asCountMachine(args.removeDelay, 200))
      : 200,
    pointerWithin: false,
    focusWithin: false,
    pageIdle: false,
  };
}

const config = {
  id: "toast",
  initial: "stack",
  context: {
    toasts: [] as ToastEntry[],
    queued: [] as ToastEntry[],
    overlap: false,
    max: 24,
    removeDelay: 200,
    pointerWithin: false,
    focusWithin: false,
    pageIdle: false,
  },
  // The root tier: what works in both states. Zag's REGION.BLUR is the one
  // gesture with three outcomes — collapse, return to stack, or simply
  // forget the focus.
  on: {
    "TOAST.PAUSE": { actions: [{ assign: "pauseToast" }] },
    "TOAST.RESUME": { actions: [{ assign: "resumeToast" }] },
    "PAGE.IDLE": { actions: [{ assign: "idlePage" }, { assign: "pauseToasts" }] },
    "PAGE.ACTIVE": { actions: [{ assign: "activePage" }, { assign: "resumeToasts" }] },
    // The two leaving branches also drop the focus the region borrowed:
    // a region that no longer holds focus is not pausing anything.
    "REGION.BLUR": [
      { target: "overlap", cond: "collapsesOnBlur", actions: [{ assign: "resumeToasts" }, { assign: "leaveFocus" }] },
      { target: "stack", cond: "isPointerOut", actions: [{ assign: "resumeToasts" }, { assign: "leaveFocus" }] },
      { actions: [{ assign: "leaveFocus" }] },
    ],
  },
  states: {
    // The laid-out mode: every toast sits where its measured height puts it.
    stack: {
      on: {
        ...QUEUE_EVENTS,
        "REGION.POINTER_LEAVE": [
          { target: "overlap", cond: "isOverlapping", actions: [{ assign: "leavePointer" }, { assign: "resumeToasts" }] },
          { actions: [{ assign: "leavePointer" }, { assign: "resumeToasts" }] },
        ],
        "REGION.OVERLAP": { target: "overlap" },
        "REGION.FOCUS": { actions: [{ assign: "enterFocus" }, { assign: "pauseToasts" }] },
        "REGION.POINTER_ENTER": { actions: [{ assign: "enterPointer" }, { assign: "pauseToasts" }] },
      },
    },
    // The collapsed mode: the front toast is the row, the rest peek behind.
    overlap: {
      on: {
        ...QUEUE_EVENTS,
        "REGION.STACK": { target: "stack", actions: [{ assign: "resumeToasts" }] },
        "REGION.POINTER_ENTER": {
          target: "stack",
          actions: [{ assign: "enterPointer" }, { assign: "pauseToasts" }],
        },
        "REGION.FOCUS": {
          target: "stack",
          actions: [{ assign: "enterFocus" }, { assign: "pauseToasts" }],
        },
      },
    },
  },
};

const implementations = {
  conds: {
    /** Zag's `collapsedIfEmpty`: an emptied overlapping region collapses. */
    shouldCollapse: (ctx: ToastContext, e: ToastEvent): boolean =>
      ctx.overlap && projectedCount(ctx, e) <= 1,
    isOverlapping: (ctx: ToastContext): boolean => ctx.overlap,
    isPointerOut: (ctx: ToastContext): boolean => !ctx.pointerWithin,
    /** Zag's `and("isOverlapping", "isPointerOut")` on REGION.BLUR. */
    collapsesOnBlur: (ctx: ToastContext): boolean => ctx.overlap && !ctx.pointerWithin,
  },
  assigns: {
    createToast: (ctx: ToastContext, e: ToastEvent): Partial<ToastContext> => {
      if (e.type !== "TOAST.CREATE") return {};
      // A known id updates in place, exactly as Zag's store does.
      if (ctx.toasts.some((entry) => entry.id === e.id)) {
        return implementations.assigns.updateToast(ctx, e);
      }
      const entry = makeEntry(e);
      if (ctx.toasts.length >= ctx.max) return { queued: [...ctx.queued, entry] };
      return { toasts: [entry, ...ctx.toasts] };
    },
    updateToast: (ctx: ToastContext, e: ToastEvent): Partial<ToastContext> => {
      if (e.type !== "TOAST.CREATE" && e.type !== "TOAST.UPDATE") return {};
      const merge = (entry: ToastEntry): ToastEntry => ({
        ...entry,
        title: e.title,
        description: e.description,
        type: e.toastType,
        action: e.action,
        priority: priorityFor(e.toastType, e.priority, e.action.length > 0),
        // Zag's `resetCloseTimer`: a new clock starts on the update.
        remaining: durationFor(e.toastType, e.duration),
      });
      const toasts = amend(ctx.toasts, e.id, merge);
      if (toasts !== undefined) return { toasts };
      const queued = amend(ctx.queued, e.id, merge);
      return queued === undefined ? {} : { queued };
    },
    removeToast: (ctx: ToastContext, e: ToastEvent): Partial<ToastContext> => {
      if (e.type !== "TOAST.REMOVE" && e.type !== "TIMER.REMOVED") return {};
      const gone = (entry: ToastEntry): boolean => entry.id !== e.id;
      if (!ctx.toasts.some((entry) => entry.id === e.id)) {
        return ctx.queued.some((entry) => entry.id === e.id)
          ? { queued: ctx.queued.filter(gone) }
          : {};
      }
      return promote({ ...ctx, toasts: ctx.toasts.filter(gone), queued: ctx.queued.filter(gone) });
    },
    dismissAll: (ctx: ToastContext): Partial<ToastContext> => ({
      toasts: ctx.toasts.map((entry) =>
        entry.status === "dismissing" ? entry : { ...entry, status: "dismissing" }),
    }),
    dismissToast: (ctx: ToastContext, e: ToastEvent): Partial<ToastContext> => {
      if (e.type !== "TOAST.DISMISS" && e.type !== "TIMER.ELAPSED") return {};
      const toasts = amend(ctx.toasts, e.id, (entry) =>
        entry.status === "dismissing" ? entry : { ...entry, status: "dismissing" },
      );
      return toasts === undefined ? {} : { toasts };
    },
    /** The clock reports its remainder when it stops; that value is truth. */
    pauseToast: (ctx: ToastContext, e: ToastEvent): Partial<ToastContext> => {
      if (e.type !== "TOAST.PAUSE") return {};
      const toasts = amend(ctx.toasts, e.id, (entry) => ({
        ...entry,
        status: "persist",
        remaining: e.remaining,
      }));
      return toasts === undefined ? {} : { toasts };
    },
    resumeToast: (ctx: ToastContext, e: ToastEvent): Partial<ToastContext> => {
      if (e.type !== "TOAST.RESUME") return {};
      const toasts = amend(ctx.toasts, e.id, resumeEntry);
      return toasts === undefined ? {} : { toasts };
    },
    mountToast: (ctx: ToastContext, e: ToastEvent): Partial<ToastContext> => {
      if (e.type !== "TOAST.MOUNTED") return {};
      const toasts = amend(ctx.toasts, e.id, (entry) => ({ ...entry, mounted: true }));
      return toasts === undefined ? {} : { toasts };
    },
    setHeight: (ctx: ToastContext, e: ToastEvent): Partial<ToastContext> => {
      if (e.type !== "HEIGHT.SET") return {};
      if (e.height < 0) return {};
      const toasts = amend(ctx.toasts, e.id, (entry) =>
        entry.height === e.height ? entry : { ...entry, height: e.height },
      );
      return toasts === undefined ? {} : { toasts };
    },
    pauseToasts: (ctx: ToastContext): Partial<ToastContext> => ({
      toasts: ctx.toasts.map((entry) =>
        entry.status === "visible" ? { ...entry, status: "persist" } : entry,
      ),
    }),
    resumeToasts: (ctx: ToastContext): Partial<ToastContext> => ({
      toasts: ctx.toasts.map(resumeEntry),
    }),
    enterPointer: (): Partial<ToastContext> => ({ pointerWithin: true }),
    leavePointer: (): Partial<ToastContext> => ({ pointerWithin: false }),
    enterFocus: (): Partial<ToastContext> => ({ focusWithin: true }),
    leaveFocus: (): Partial<ToastContext> => ({ focusWithin: false }),
    idlePage: (): Partial<ToastContext> => ({ pageIdle: true }),
    activePage: (): Partial<ToastContext> => ({ pageIdle: false }),
  },
};

/**
 * The toast machine: state and nothing else. It is headless — it knows
 * its own arguments, and nothing about props, markup, or the DOM.
 */
export function toast(
  args: ToastArgs = {},
  authored: (name: string) => boolean,
): Machine<ToastContext, ToastEvent> {
  return createMachine<ToastContext, ToastEvent>({
    ...config,
    context: initial(args, authored),
    /**
     * The machine's contract with its hosts: the context fields a host
     * may write, and the event each write carries.
     *
     * A field with an event is REPORTED: the host's write is an event,
     * the machine decides, and the change reaches the host. A field
     * without one is SILENT: the host's write lands in the field, and
     * nothing reports.
     *
     * The host's LIST of toasts is not here: the queue is a diff of a
     * list, not one field, and the element keeps that statement.
     */
    fields: {
      overlap: {},
      max: {},
      removeDelay: {},
    },
    assigns: implementations.assigns,
    conds: implementations.conds,
  });
}
