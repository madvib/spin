/**
 * Timer machine: the clock's phase and the count it holds.
 *
 * The clock is not here: an `autoplay`-shaped action on the view owns the
 * interval and reports `TICK`; a tick's delta is rounded to `interval`, as
 * Zag rounds `event.deltaMs`.
 */

import { defaultTwin } from "@spin/runtime";
import { createMachine, type Machine, type EventUnion, type MachineSpec } from "@spin/runtime/fsm";
const resetTime = (ctx: TimerContext, e: TimerEvent) : Partial<TimerContext> => {
      if (e.type === "RESTART" && e.startMs !== undefined) {
        const start = parseMs(e.startMs) ?? 0;
        return { startMs: start, currentMs: start };
      }
      return { currentMs: ctx.startMs };
    };



export type TimePart = "days" | "hours" | "minutes" | "seconds" | "milliseconds";

export interface Time<T = number> {
  readonly days: T;
  readonly hours: T;
  readonly minutes: T;
  readonly seconds: T;
  readonly milliseconds: T;
}

export interface TimerContext {
  currentMs: number;
  startMs: number;
  targetMs: number | null;
  countdown: boolean;
  interval: number;
}

/**
 * The timer's arguments: the values the host may set.
 *
 * The twin (`defaultValue`) is resolved by the framework before the factory
 * is called, so the machine only ever sees the live values.
 */
export interface TimerArgs {
  readonly startMs?: string;
  readonly targetMs?: string;
  readonly countdown?: boolean;
  readonly interval?: number;
}

/** Coerce a seed value to milliseconds, or `undefined`. Date strings are the
 * one shaping this machine keeps (the transport grammar has no date type). */
export function parseMs(raw: unknown): number | undefined {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : undefined;
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return undefined;
  const numeric = Number(trimmed);
  if (!Number.isNaN(numeric)) return numeric;
  const at = new Date(trimmed).getTime();
  return Number.isNaN(at) ? undefined : at;
}

/** Zag's `validateProps`: an impossible clock refuses to build. Checked
 * once, at seed. */
export function validateTimer(
  startMs: number | undefined,
  targetMs: number | undefined,
  countdown: boolean,
  interval: number,
): void {
  if (typeof interval !== "number" || interval <= 0) {
    throw new Error(`[timer] Invalid interval: ${interval}. Must be a positive number.`);
  }
  if (startMs !== undefined && (typeof startMs !== "number" || startMs < 0)) {
    throw new Error(`[timer] Invalid startMs: ${startMs}. Must be a non-negative number.`);
  }
  if (targetMs !== undefined && (typeof targetMs !== "number" || targetMs < 0)) {
    throw new Error(`[timer] Invalid targetMs: ${targetMs}. Must be a non-negative number.`);
  }
  if (countdown && startMs !== undefined && targetMs !== undefined && startMs <= targetMs) {
    throw new Error(
      `[timer] Invalid countdown configuration: startMs (${startMs}) must be greater than targetMs (${targetMs}).`,
    );
  }
  if (!countdown && startMs !== undefined && targetMs !== undefined && startMs >= targetMs) {
    throw new Error(
      `[timer] Invalid stopwatch configuration: startMs (${startMs}) must be less than targetMs (${targetMs}).`,
    );
  }
  if (countdown && targetMs === undefined && startMs !== undefined && startMs <= 0) {
    throw new Error(
      `[timer] Invalid countdown configuration: startMs (${startMs}) must be greater than 0 when no targetMs is provided.`,
    );
  }
}

export function initial(args: TimerArgs, authored: (name: string) => boolean): TimerContext {
  const written = (field: string): boolean =>
    authored(field) ||
    authored(defaultTwin(field)) ||
    (args as Record<string, unknown>)[defaultTwin(field)] !== undefined;
  const startMs = written("startMs") ? parseMs(args.startMs) : undefined;
  const targetMs = written("targetMs") ? parseMs(args.targetMs) : undefined;
  const countdown = written("countdown") ? args.countdown === true : false;
  const rawInterval = written("interval") ? args.interval : undefined;
  // A non-numeric write has no meaning; every other value is validated
  // verbatim, so a zero refuses to build rather than silently defaulting.
  const interval = typeof rawInterval === "number" ? Math.trunc(rawInterval) : 1000;
  validateTimer(startMs, targetMs, countdown, interval);
  const start = startMs ?? 0;
  return {
    startMs: start,
    targetMs: targetMs ?? null,
    countdown,
    interval,
    currentMs: start,
  };
}

export interface TimerEvents {
  "START": {};
  "PAUSE": {};
  "RESUME": {};
  "RESET": {};
  "RESTART": { startMs?: string | number };
  "TICK": { deltaMs: number };
  "CURRENT_MS.SET": { currentMs: string | number };
}

export type TimerEvent = EventUnion<TimerEvents>;


const config: MachineSpec<TimerContext, TimerEvents> = {
  id: "timer",
  initial: "idle",
  context: {
    currentMs: 0,
    startMs: 0,
    targetMs: null as number | null,
    countdown: false,
    interval: 1000,
  },
  // Programmatic commands are root-level so every phase answers them.
  on: {
    RESTART: { target: "running", cond: (ctx, e) => {
      if (e.type !== "RESTART" || e.startMs === undefined) return true;
      return (parseMs(e.startMs) ?? 0) !== ctx.startMs;
    }, assign: resetTime },
    "CURRENT_MS.SET": { assign: (_ctx, e) => {
      if (e.type !== "CURRENT_MS.SET") return {};
      const currentMs = parseMs(e.currentMs);
      return currentMs === undefined ? {} : { currentMs };
    } },
  },
  states: {
    idle: {
      on: {
        START: { target: "running" },
        RESET: { assign: resetTime },
      },
    },
    running: {
      on: {
        PAUSE: { target: "paused" },
        RESET: { assign: resetTime },
        // The first candidate whose guard passes wins: a tick that reaches
        // the target ends the run, every other tick is worth its delta.
        TICK: [{ target: "idle", cond: (ctx) => {
      const target = effectiveTarget(ctx);
      if (target === null) return false;
      return ctx.countdown ? ctx.currentMs <= target : ctx.currentMs >= target;
    } }, { assign: (ctx, e) => {
      if (e.type !== "TICK") return {};
      // RoundToInterval: a tick is worth whole intervals, never a part — a
      // starved clock reports a delta it then counts in interval steps.
      const deltaMs = Math.floor(e.deltaMs / ctx.interval) * ctx.interval;
      const next = ctx.currentMs + (ctx.countdown ? -1 : 1) * deltaMs;
      const target = effectiveTarget(ctx);
      if (target === null) return { currentMs: next };
      return { currentMs: ctx.countdown ? Math.max(next, target) : Math.min(next, target) };
    } }],
      },
    },
    paused: {
      on: {
        RESUME: { target: "running" },
        // A paused clock resets to idle: the count goes home and stops.
        RESET: { target: "idle", assign: resetTime },
      },
    },
  },
};

const MS_PER_SECOND = 1000;
const MS_PER_MINUTE = 60 * MS_PER_SECOND;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const MS_PER_DAY = 24 * MS_PER_HOUR;

/** Zag's `msToTime`. Days are whole days; every smaller unit wraps. */
export function msToTime(ms: number): Time {
  const time = Math.max(0, ms);
  return {
    days: Math.floor(time / MS_PER_DAY),
    hours: Math.floor(time / MS_PER_HOUR) % 24,
    minutes: Math.floor(time / MS_PER_MINUTE) % 60,
    seconds: Math.floor(time / MS_PER_SECOND) % 60,
    milliseconds: time % MS_PER_SECOND,
  };
}

/** Zag's `formatTime`. */
export function formatTime(time: Time): Time<string> {
  return {
    days: time.days.toString().padStart(2, "0"),
    hours: time.hours.toString().padStart(2, "0"),
    minutes: time.minutes.toString().padStart(2, "0"),
    seconds: time.seconds.toString().padStart(2, "0"),
    milliseconds: time.milliseconds.toString().padStart(3, "0"),
  };
}

/**
 * A countdown with no target counts down to zero; a stopwatch with no target
 * never completes.
 */
const effectiveTarget = (ctx: TimerContext): number | null =>
  ctx.targetMs !== null ? ctx.targetMs : ctx.countdown ? 0 : null;

const implementations = {};

export function timer(
  args: TimerArgs = {},
  authored: (name: string) => boolean,
): Machine<TimerContext, TimerEvents> {
  return createMachine<TimerContext, TimerEvents>({
    ...config,
    context: initial(args, authored),
    /**
     * The machine's contract with its hosts: the context fields a host may
     * write, and the event each write carries. A field with an event is
     * REPORTED — the machine decides, and the change reaches the host; a
     * field without one is SILENT.
     */
    fields: {
      startMs: { event: "RESTART" },
      currentMs: { event: "CURRENT_MS.SET" },
      targetMs: {},
      countdown: {},
      interval: {},
    },
  });
}
