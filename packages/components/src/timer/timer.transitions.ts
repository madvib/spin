import { parseMs } from "./timer.state.ts";
import { effectiveTarget } from "./timer.state.ts";
import type { TimerContext } from "./timer.state.ts";
import type { TimerEvents } from "./timer.events.ts";
import type { AssignFor, GuardFor } from "@spin/runtime/fsm";

type TimerAssign<K extends keyof TimerEvents = keyof TimerEvents> = AssignFor<
  TimerContext,
  TimerEvents,
  K
>;

export const resetTime: TimerAssign<"RESTART" | "RESET"> = (ctx, event) => {
  if (event.type === "RESTART" && event.startMs !== undefined) {
    const start = parseMs(event.startMs) ?? 0;
    return { startMs: start, currentMs: start };
  }
  return { currentMs: ctx.startMs };
};

export const restartChanged: GuardFor<TimerContext, TimerEvents, "RESTART"> = (
  ctx,
  event,
) => {
  if (event.startMs === undefined) return true;
  return (parseMs(event.startMs) ?? 0) !== ctx.startMs;
};

export const setCurrentMs: TimerAssign<"CURRENT_MS.SET"> = (_ctx, event) => {
  const currentMs = parseMs(event.currentMs);
  return currentMs === undefined ? {} : { currentMs };
};

export const isComplete: GuardFor<TimerContext, TimerEvents> = (ctx) => {
  const target = effectiveTarget(ctx);
  if (target === null) return false;
  return ctx.countdown ? ctx.currentMs <= target : ctx.currentMs >= target;
};

export const tick: TimerAssign<"TICK"> = (ctx, event) => {
  const deltaMs = Math.floor(event.deltaMs / ctx.interval) * ctx.interval;
  const next = ctx.currentMs + (ctx.countdown ? -1 : 1) * deltaMs;
  const target = effectiveTarget(ctx);
  if (target === null) return { currentMs: next };
  return {
    currentMs: ctx.countdown ? Math.max(next, target) : Math.min(next, target),
  };
};
