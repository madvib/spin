import type { AssignFor, GuardFor } from "@spinjs/runtime/fsm";
import {
  amend,
  durationFor,
  makeEntry,
  priorityFor,
  projectedCount,
  promote,
  resumeEntry,
  type ToastContext,
  type ToastEntry,
} from "./toast.state.ts";
import type { ToastEvents } from "./toast.events.ts";

type ToastAssign<K extends keyof ToastEvents = keyof ToastEvents> = AssignFor<
  ToastContext,
  ToastEvents,
  K
>;

export const createToast: ToastAssign<"TOAST.CREATE"> = (ctx, event) => {
  if (ctx.toasts.some((entry) => entry.id === event.id)) {
    return updateToast(ctx, event);
  }
  const entry = makeEntry(event);
  if (ctx.toasts.length >= ctx.max) return { queued: [...ctx.queued, entry] };
  return { toasts: [entry, ...ctx.toasts] };
};

// updateToast needs both events; handle via union cast
export const updateToast: ToastAssign<"TOAST.CREATE" | "TOAST.UPDATE"> = (
  ctx,
  event,
) => {
  const merge = (entry: ToastEntry): ToastEntry => ({
    ...entry,
    title: event.title,
    description: event.description,
    type: event.toastType,
    action: event.action,
    priority: priorityFor(
      event.toastType,
      event.priority,
      event.action.length > 0,
    ),
    remaining: durationFor(event.toastType, event.duration),
  });
  const toasts = amend(ctx.toasts, event.id, merge);
  if (toasts !== undefined) return { toasts };
  const queued = amend(ctx.queued, event.id, merge);
  return queued === undefined ? {} : { queued };
};

export const removeToast: ToastAssign<"TOAST.REMOVE" | "TIMER.REMOVED"> = (
  ctx,
  event,
) => {
  const gone = (entry: ToastEntry): boolean => entry.id !== event.id;
  if (!ctx.toasts.some((entry) => entry.id === event.id)) {
    return ctx.queued.some((entry) => entry.id === event.id)
      ? { queued: ctx.queued.filter(gone) }
      : {};
  }
  return promote({
    ...ctx,
    toasts: ctx.toasts.filter(gone),
    queued: ctx.queued.filter(gone),
  });
};

export const dismissToast: ToastAssign<"TOAST.DISMISS" | "TIMER.ELAPSED"> = (
  ctx,
  event,
) => {
  const toasts = amend(
    ctx.toasts,
    event.id,
    (entry) =>
      entry.status === "dismissing"
        ? entry
        : { ...entry, status: "dismissing" },
  );
  return toasts === undefined ? {} : { toasts };
};

export const pauseToasts = (ctx: ToastContext): Partial<ToastContext> => ({
  toasts: ctx.toasts.map((entry) =>
    entry.status === "visible" ? { ...entry, status: "persist" } : entry
  ),
});

export const resumeToasts = (ctx: ToastContext): Partial<ToastContext> => ({
  toasts: ctx.toasts.map(resumeEntry),
});

export const enterPointer = (): Partial<ToastContext> => ({
  pointerWithin: true,
});
export const leavePointer = (): Partial<ToastContext> => ({
  pointerWithin: false,
});
export const enterFocus = (): Partial<ToastContext> => ({ focusWithin: true });
export const leaveFocus = (): Partial<ToastContext> => ({ focusWithin: false });

export const shouldCollapse: GuardFor<ToastContext, ToastEvents> = (
  ctx,
  event,
) => ctx.overlap && projectedCount(ctx, event) <= 1;

export const toastMounted: ToastAssign<"TOAST.MOUNTED"> = (ctx, event) => {
  const toasts = amend(
    ctx.toasts,
    event.id,
    (entry) => ({ ...entry, mounted: true }),
  );
  return toasts === undefined ? {} : { toasts };
};

export const heightSet: ToastAssign<"HEIGHT.SET"> = (ctx, event) => {
  if (event.height < 0) return {};
  const toasts = amend(
    ctx.toasts,
    event.id,
    (entry) =>
      entry.height === event.height
        ? entry
        : { ...entry, height: event.height },
  );
  return toasts === undefined ? {} : { toasts };
};

export const dismissAll = (ctx: ToastContext): Partial<ToastContext> => ({
  toasts: ctx.toasts.map((entry) =>
    entry.status === "dismissing" ? entry : { ...entry, status: "dismissing" }
  ),
});

export const toastPause: ToastAssign<"TOAST.PAUSE"> = (ctx, event) => {
  const toasts = amend(ctx.toasts, event.id, (entry) => ({
    ...entry,
    status: "persist",
    remaining: event.remaining,
  }));
  return toasts === undefined ? {} : { toasts };
};

export const toastResume: ToastAssign<"TOAST.RESUME"> = (ctx, event) => {
  const toasts = amend(ctx.toasts, event.id, resumeEntry);
  return toasts === undefined ? {} : { toasts };
};

export const pageIdle = (): Partial<ToastContext> => ({ pageIdle: true });
export const pageActive = (): Partial<ToastContext> => ({ pageIdle: false });
