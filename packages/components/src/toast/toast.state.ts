import { defaultTwin } from "@spin/runtime";
import type { ToastEvents } from "./toast.events.ts";
import { type ToastEvent, type ToastType } from "./toast.events.ts";

export type ToastStatus = "visible" | "persist" | "dismissing";

export type ToastState = "stack" | "overlap";

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
  placement: string;
  gap: number;
  offsets: string;
  hotkey: string;
  label: string;
  pauseOnPageIdle: boolean;
  closable: boolean;
}

export interface ToastArgs {
  readonly overlap?: boolean;
  readonly max?: number;
  readonly removeDelay?: number;
  readonly placement?: string;
  readonly gap?: number;
  readonly offsets?: string;
  readonly hotkey?: string;
  readonly label?: string;
  readonly pauseOnPageIdle?: boolean;
  readonly closable?: boolean;
}

const DURATIONS: Readonly<Record<ToastType, number>> = {
  info: 5000,
  error: 5000,
  success: 2000,
  warning: 5000,
  loading: Infinity,
};

const PRIORITIES: Readonly<Record<ToastType, readonly [number, number]>> = {
  error: [1, 2],
  warning: [3, 6],
  loading: [4, 5],
  success: [5, 7],
  info: [6, 8],
};

export const durationFor = (type: ToastType, authored: number): number =>
  authored > 0 && type !== "loading" ? authored : DURATIONS[type];

export const priorityFor = (
  type: ToastType,
  authored: number,
  hasAction: boolean,
): number => authored > 0 ? authored : PRIORITIES[type][hasAction ? 0 : 1];

export const forever = (entry: ToastEntry): boolean =>
  entry.type === "loading" || entry.remaining === Infinity;

export const projectedCount = (ctx: ToastContext, e: ToastEvent): number => {
  if (e.type === "TOAST.CREATE") return ctx.toasts.length + 1;
  if (e.type === "TOAST.REMOVE" || e.type === "TIMER.REMOVED") {
    return ctx.toasts.length - 1;
  }
  return ctx.toasts.length;
};

export const makeEntry = (
  e: Extract<ToastEvent, { type: "TOAST.CREATE" }>,
): ToastEntry => ({
  id: e.id,
  title: e.title,
  description: e.description,
  type: e.toastType,
  status: "visible",
  remaining: durationFor(e.toastType, e.duration),
  action: e.action,
  height: 0,
  priority: priorityFor(e.toastType, e.priority, e.action.length > 0),
  mounted: false,
});

export const promote = (
  ctx: ToastContext,
): Pick<ToastContext, "toasts" | "queued"> => {
  const toasts = [...ctx.toasts];
  const waiting = [...ctx.queued].sort((a, b) => a.priority - b.priority);
  while (waiting.length > 0 && toasts.length < ctx.max) {
    const next = waiting.shift();
    if (next === undefined) break;
    toasts.unshift(next);
  }
  return { toasts, queued: waiting };
};

export const amend = (
  toasts: readonly ToastEntry[],
  id: string,
  make: (entry: ToastEntry) => ToastEntry,
): ToastEntry[] | undefined => {
  const at = toasts.findIndex((entry) => entry.id === id);
  const current = at === -1 ? undefined : toasts[at];
  if (current === undefined) return undefined;
  return [...toasts.slice(0, at), make(current), ...toasts.slice(at + 1)];
};

export const resumeEntry = (entry: ToastEntry): ToastEntry =>
  entry.status !== "persist" || forever(entry)
    ? entry
    : { ...entry, status: "visible" };

const asCountMachine = (raw: unknown, fallback: number): number =>
  typeof raw === "number" && Number.isFinite(raw) ? Math.trunc(raw) : fallback;

export function initial(
  args: ToastArgs,
  authored: (name: string) => boolean,
): ToastContext {
  const written = (field: string): boolean =>
    authored(field) ||
    authored(defaultTwin(field)) ||
    (args as Record<string, unknown>)[defaultTwin(field)] !== undefined;
  const text = (value: unknown, fallback: string): string =>
    typeof value === "string" && value.length > 0 ? value : fallback;
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
    placement: text(args.placement, "bottom"),
    gap: typeof args.gap === "number" && Number.isFinite(args.gap)
      ? Math.trunc(args.gap)
      : 16,
    offsets: text(args.offsets, "1rem"),
    hotkey: text(args.hotkey, ""),
    label: text(args.label, "Notifications"),
    pauseOnPageIdle: args.pauseOnPageIdle !== false,
    closable: args.closable !== false,
  };
}

export { asCountMachine };
export type { ToastEvent, ToastEvents, ToastType };
