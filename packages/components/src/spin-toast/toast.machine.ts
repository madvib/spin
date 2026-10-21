/** Toast machine: the queue, each toast's lifecycle, and the stacking mode. */

import { defaultTwin } from "@spin/runtime";
import { createMachine, type Machine, type EventUnion, type MachineSpec, type Transitions } from "@spin/runtime/fsm";
const createToast = (ctx: ToastContext, e: ToastEvent) : Partial<ToastContext> => {
      if (e.type !== "TOAST.CREATE") return {};
      // A known id updates in place, as Zag's store does.
      if (ctx.toasts.some((entry) => entry.id === e.id)) {
        return updateToast(ctx, e);
      }
      const entry = makeEntry(e);
      if (ctx.toasts.length >= ctx.max) return { queued: [...ctx.queued, entry] };
      return { toasts: [entry, ...ctx.toasts] };
    };

const updateToast = (ctx: ToastContext, e: ToastEvent) : Partial<ToastContext> => {
      if (e.type !== "TOAST.CREATE" && e.type !== "TOAST.UPDATE") return {};
      const merge = (entry: ToastEntry): ToastEntry => ({
        ...entry,
        title: e.title,
        description: e.description,
        type: e.toastType,
        action: e.action,
        priority: priorityFor(e.toastType, e.priority, e.action.length > 0),
        // Zag's `resetCloseTimer`: the update starts a new clock.
        remaining: durationFor(e.toastType, e.duration),
      });
      const toasts = amend(ctx.toasts, e.id, merge);
      if (toasts !== undefined) return { toasts };
      const queued = amend(ctx.queued, e.id, merge);
      return queued === undefined ? {} : { queued };
    };

const removeToast = (ctx: ToastContext, e: ToastEvent) : Partial<ToastContext> => {
      if (e.type !== "TOAST.REMOVE" && e.type !== "TIMER.REMOVED") return {};
      const gone = (entry: ToastEntry): boolean => entry.id !== e.id;
      if (!ctx.toasts.some((entry) => entry.id === e.id)) {
        return ctx.queued.some((entry) => entry.id === e.id)
          ? { queued: ctx.queued.filter(gone) }
          : {};
      }
      return promote({ ...ctx, toasts: ctx.toasts.filter(gone), queued: ctx.queued.filter(gone) });
    };

const dismissToast = (ctx: ToastContext, e: ToastEvent) : Partial<ToastContext> => {
      if (e.type !== "TOAST.DISMISS" && e.type !== "TIMER.ELAPSED") return {};
      const toasts = amend(ctx.toasts, e.id, (entry) =>
        entry.status === "dismissing" ? entry : { ...entry, status: "dismissing" },
      );
      return toasts === undefined ? {} : { toasts };
    };

const pauseToasts = (ctx: ToastContext) : Partial<ToastContext> => { return ({
      toasts: ctx.toasts.map((entry) =>
        entry.status === "visible" ? { ...entry, status: "persist" } : entry,
      ),
    }); };

const resumeToasts = (ctx: ToastContext) : Partial<ToastContext> => { return ({
      toasts: ctx.toasts.map(resumeEntry),
    }); };

const enterPointer = () : Partial<ToastContext> => { return ({ pointerWithin: true }); };

const leavePointer = () : Partial<ToastContext> => { return ({ pointerWithin: false }); };

const enterFocus = () : Partial<ToastContext> => { return ({ focusWithin: true }); };

const leaveFocus = () : Partial<ToastContext> => { return ({ focusWithin: false }); };

const shouldCollapse = (ctx: ToastContext, e: ToastEvent) : boolean => { return ctx.overlap && projectedCount(ctx, e) <= 1; };



export type ToastType = "info" | "success" | "warning" | "error" | "loading";

export type ToastStatus = "visible" | "persist" | "dismissing";

export interface ToastEntry {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly type: ToastType;
  readonly status: ToastStatus;
  /** The dismissal clock's remainder; Infinity never fires. */
  readonly remaining: number;
  /** Queue order: lower sorts first. */
  readonly priority: number;
  /** The action trigger's label; empty means no trigger. */
  readonly action: string;
  readonly height: number;
  /** False until the frame after the row attached. */
  readonly mounted: boolean;
}

export interface ToastContext {
  /** Newest first — the front toast is index 0. */
  toasts: ToastEntry[];
  /** Entries waiting for room; `max` full means held, not dropped. */
  queued: ToastEntry[];
  /** The region's stacking mode; mirrored on rows as `data-stack`. */
  overlap: boolean;
  max: number;
  removeDelay: number;
  pointerWithin: boolean;
  focusWithin: boolean;
  pageIdle: boolean;
}

export interface ToastEvents {
  "TOAST.CREATE": { id: string; title: string; description: string; toastType: ToastType; duration: number; priority: number; action: string };
  "TOAST.UPDATE": { id: string; title: string; description: string; toastType: ToastType; duration: number; priority: number; action: string };
  "TOAST.REMOVE": { id: string };
  "TOAST.DISMISS": { id: string; src: string };
  "DISMISS.ALL": {};
  "TOAST.PAUSE": { id: string; remaining: number };
  "TOAST.RESUME": { id: string };
  "TOAST.MOUNTED": { id: string };
  "TIMER.ELAPSED": { id: string };
  "TIMER.REMOVED": { id: string };
  "HEIGHT.SET": { id: string; height: number };
  "REGION.POINTER_ENTER": {};
  "REGION.POINTER_LEAVE": {};
  "REGION.FOCUS": {};
  "REGION.BLUR": {};
  "REGION.OVERLAP": {};
  "REGION.STACK": {};
  "PAGE.IDLE": {};
  "PAGE.ACTIVE": {};
}

export type ToastEvent = EventUnion<ToastEvents>;


/** Zag's `defaultTimeouts`. */
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
 * loading toast never takes one (Zag's `shouldPersist`). */
export const durationFor = (type: ToastType, authored: number): number =>
  authored > 0 && type !== "loading" ? authored : DURATIONS[type];

/** An authored priority of 0 or less means "unset" — the type decides. */
export const priorityFor = (type: ToastType, authored: number, hasAction: boolean): number =>
  authored > 0 ? authored : PRIORITIES[type][hasAction ? 0 : 1];

const forever = (entry: ToastEntry): boolean =>
  entry.type === "loading" || entry.remaining === Infinity;

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

/** Zag's `processQueue`: the queue promotes the highest priority first, and
 * on a tie the older one — the sort is stable. */
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
 * The queue events both states answer. They sit in the states, not the root
 * tier: the fork resolves candidates in the order `state.on[type]`,
 * `state.on[*]`, `config.on[type]`, `config.on[*]`, so a root-level collapse
 * rule would swallow the very event it guards.
 */
const QUEUE_EVENTS: Transitions<ToastContext, ToastEvents> = {
  "TOAST.CREATE": [
    { target: "overlap", cond: shouldCollapse, assign: createToast },
    { assign: createToast },
  ],
  "TOAST.REMOVE": [
    { target: "overlap", cond: shouldCollapse, assign: removeToast },
    { assign: removeToast },
  ],
  "TIMER.REMOVED": [
    { target: "overlap", cond: shouldCollapse, assign: removeToast },
    { assign: removeToast },
  ],
  "TOAST.UPDATE": { assign: updateToast },
  "TOAST.DISMISS": { assign: dismissToast },
  /** One command, one event: the def's commands send one event each, so a
   * whole-queue exit is one event the assign loops over. */
  "DISMISS.ALL": { assign: (ctx) => { return ({
      toasts: ctx.toasts.map((entry) =>
        entry.status === "dismissing" ? entry : { ...entry, status: "dismissing" }),
    }); } },
  "TIMER.ELAPSED": { assign: dismissToast },
  "TOAST.MOUNTED": { assign: (ctx, e) => {
      if (e.type !== "TOAST.MOUNTED") return {};
      const toasts = amend(ctx.toasts, e.id, (entry) => ({ ...entry, mounted: true }));
      return toasts === undefined ? {} : { toasts };
    } },
  "HEIGHT.SET": { assign: (ctx, e) => {
      if (e.type !== "HEIGHT.SET") return {};
      if (e.height < 0) return {};
      const toasts = amend(ctx.toasts, e.id, (entry) =>
        entry.height === e.height ? entry : { ...entry, height: e.height },
      );
      return toasts === undefined ? {} : { toasts };
    } },
} as const;

/**
 * The toast's arguments: the values the host may set.
 *
 * The host's list of toasts is not one of them: the queue is a diff of a
 * list, and the element keeps that statement.
 */
export interface ToastArgs {
  readonly overlap?: boolean;
  readonly max?: number;
  readonly removeDelay?: number;
}

const asCountMachine = (raw: unknown, fallback: number): number =>
  typeof raw === "number" && Number.isFinite(raw) ? Math.trunc(raw) : fallback;

export function initial(args: ToastArgs, authored: (name: string) => boolean): ToastContext {
  const written = (field: string): boolean =>
    authored(field) ||
    authored(defaultTwin(field)) ||
    (args as Record<string, unknown>)[defaultTwin(field)] !== undefined;
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

const config: MachineSpec<ToastContext, ToastEvents> = {
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
  // Zag's REGION.BLUR is the one gesture with three outcomes: collapse,
  // return to stack, or forget the focus.
  on: {
    "TOAST.PAUSE": { assign: (ctx, e) => {
      if (e.type !== "TOAST.PAUSE") return {};
      const toasts = amend(ctx.toasts, e.id, (entry) => ({
        ...entry,
        status: "persist",
        remaining: e.remaining,
      }));
      return toasts === undefined ? {} : { toasts };
    } },
    "TOAST.RESUME": { assign: (ctx, e) => {
      if (e.type !== "TOAST.RESUME") return {};
      const toasts = amend(ctx.toasts, e.id, resumeEntry);
      return toasts === undefined ? {} : { toasts };
    } },
    "PAGE.IDLE": { assign: [() => { return ({ pageIdle: true }); }, pauseToasts] },
    "PAGE.ACTIVE": { assign: [() => { return ({ pageIdle: false }); }, resumeToasts] },
    // The leaving branches also drop the focus the region borrowed: a
    // region that no longer holds focus is not pausing anything.
    "REGION.BLUR": [
      { target: "overlap", cond: (ctx) => { return ctx.overlap && !ctx.pointerWithin; }, assign: [resumeToasts, leaveFocus] },
      { target: "stack", cond: (ctx) => { return !ctx.pointerWithin; }, assign: [resumeToasts, leaveFocus] },
      { assign: leaveFocus },
    ],
  },
  states: {
    // Each toast sits where its measured height puts it.
    stack: {
      on: {
        ...QUEUE_EVENTS,
        "REGION.POINTER_LEAVE": [
          { target: "overlap", cond: (ctx) => { return ctx.overlap; }, assign: [leavePointer, resumeToasts] },
          { assign: [leavePointer, resumeToasts] },
        ],
        "REGION.OVERLAP": { target: "overlap" },
        "REGION.FOCUS": { assign: [enterFocus, pauseToasts] },
        "REGION.POINTER_ENTER": { assign: [enterPointer, pauseToasts] },
      },
    },
    // The front toast is the row, the rest peek behind.
    overlap: {
      on: {
        ...QUEUE_EVENTS,
        "REGION.STACK": { target: "stack", assign: resumeToasts },
        "REGION.POINTER_ENTER": {
          target: "stack",
          assign: [enterPointer, pauseToasts],
        },
        "REGION.FOCUS": {
          target: "stack",
          assign: [enterFocus, pauseToasts],
        },
      },
    },
  },
};

const implementations = {};

export function toast(
  args: ToastArgs = {},
  authored: (name: string) => boolean,
): Machine<ToastContext, ToastEvents> {
  return createMachine<ToastContext, ToastEvents>({
    ...config,
    context: initial(args, authored),
    /**
     * The context fields a host may write. The queue is not one of them:
     * the host's list is diffed by the element, not written as a field.
     */
    fields: {
      overlap: {},
      max: {},
      removeDelay: {},
    },
  });
}
