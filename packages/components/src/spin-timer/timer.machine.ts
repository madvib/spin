/**
 * Timer machine: the clock's phase and the count it holds.
 *
 * Zag ships four states; three survive. `idle`, `running` and `paused` are
 * the phases a host can observe and drive. `running:temp` was Zag's
 * "restart, then wait one frame before the clock's effect re-arms" shuttle
 * — an interpreter sequencing concern with no behaviour of its own once the
 * clock is an action the view attaches while `running`. It always ended in
 * `running`, so `RESTART` goes straight there.
 *
 * The clock is NOT here. An `autoplay`-shaped action on the view owns the
 * interval and reports `TICK`; the machine decides what a tick is worth and
 * when the target has been reached. That is why `interval` is a context
 * scalar: a tick's delta is rounded to it, exactly as Zag rounds
 * `event.deltaMs`.
 *
 * `currentMs` is the state. `startMs`, `targetMs`, `countdown` and
 * `interval` are the scalars the assigns read; a host write to one of
 * them reaches the machine as the contract says it should.
 */

import { defaultTwin } from "@spin/runtime";
import { createMachine, type Machine } from "@spin/runtime/fsm";

export type TimePart = "days" | "hours" | "minutes" | "seconds" | "milliseconds";

export interface Time<T = number> {
  readonly days: T;
  readonly hours: T;
  readonly minutes: T;
  readonly seconds: T;
  readonly milliseconds: T;
}

export interface TimerContext {
  /** The count in milliseconds. */
  currentMs: number;
  startMs: number;
  /** `null` is "no target": a stopwatch runs forever, a countdown to zero. */
  targetMs: number | null;
  countdown: boolean;
  interval: number;
}

/**
 * The timer's arguments: the values the host may set.
 *
 * The names are the element's prop names — the machine is instantiated
 * with the element's prop bag and picks what it wants. The twin
 * (`defaultValue`) is resolved by the framework before the factory is
 * called, so the machine only ever sees the live values.
 */
export interface TimerArgs {
  /** The run's start, as the host wrote it. */
  readonly startMs?: string;
  /** The run's target, as the host wrote it. */
  readonly targetMs?: string;
  /** Whether the run counts down. */
  readonly countdown?: boolean;
  /** The clock's step, in milliseconds. */
  readonly interval?: number;
}

/** Coerce a seed value to milliseconds: a finite number, a numeric
 * string, or a parseable date — otherwise undefined. Date strings are
 * the one shaping this machine keeps (the transport grammar has no
 * date type). */
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

/** Zag's `validateProps`, verbatim: an impossible clock refuses to build
 * rather than running one. Checked once, at seed. */
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
  // A channel: the host's write, or the machine's own default. The twin
  // is the framework's convention for the same write — a host that wrote
  // the twin wrote the channel too — and the framework has already
  // resolved the twin into the argument.
  const written = (field: string): boolean =>
    authored(field) || authored(defaultTwin(field));
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
    // The count is the machine's own: it starts at the run's start, and a
    // host's write of it arrives as the contract's event.
    currentMs: start,
  };
}

export type TimerEvent =
  | { type: "START" }
  | { type: "PAUSE" }
  | { type: "RESUME" }
  | { type: "RESET" }
  // A restart carries the start time when the HOST wrote one: the
  // contract's payload is the raw prop, and the machine shapes it.
  | { type: "RESTART"; startMs?: string | number }
  | { type: "TICK"; deltaMs: number }
  | { type: "CURRENT_MS.SET"; currentMs: string | number };

const config = {
  id: "timer",
  initial: "idle",
  context: {
    currentMs: 0,
    startMs: 0,
    targetMs: null as number | null,
    countdown: false,
    interval: 1000,
  },
  // Programmatic commands are root-level so every phase answers them, which
  // is also where Zag puts RESTART.
  on: {
    RESTART: { target: "running", cond: "isNewRun", actions: [{ assign: "resetTime" }] },
    "CURRENT_MS.SET": { actions: [{ assign: "setCurrentMs" }] },
  },
  states: {
    idle: {
      on: {
        START: { target: "running" },
        RESET: { actions: [{ assign: "resetTime" }] },
      },
    },
    running: {
      on: {
        PAUSE: { target: "paused" },
        RESET: { actions: [{ assign: "resetTime" }] },
        // The first candidate whose guard passes wins: a tick that reaches
        // the target ends the run, every other tick is worth its delta.
        TICK: [{ target: "idle", cond: "hasReachedTarget" }, { actions: [{ assign: "updateTime" }] }],
      },
    },
    paused: {
      on: {
        RESUME: { target: "running" },
        // A paused clock resets to idle: the count goes home and stops.
        RESET: { target: "idle", actions: [{ assign: "resetTime" }] },
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

/** Zag's `formatTime`: two digits per unit, three for milliseconds. */
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
 * A countdown with no target counts down to zero; a stopwatch with no
 * target never completes. Everything else clamps at the target it was
 * given.
 */
const effectiveTarget = (ctx: TimerContext): number | null =>
  ctx.targetMs !== null ? ctx.targetMs : ctx.countdown ? 0 : null;

const implementations = {
  conds: {
    /**
     * A restart that carries the start time the run already has is not a
     * new run: the seeded start is not a write. The host's write of a
     * DIFFERENT start time is a new run, and it restarts the clock.
     */
    isNewRun: (ctx: TimerContext, e: TimerEvent): boolean => {
      if (e.type !== "RESTART" || e.startMs === undefined) return true;
      return (parseMs(e.startMs) ?? 0) !== ctx.startMs;
    },
    hasReachedTarget: (ctx: TimerContext): boolean => {
      const target = effectiveTarget(ctx);
      if (target === null) return false;
      return ctx.countdown ? ctx.currentMs <= target : ctx.currentMs >= target;
    },
  },
  assigns: {
    updateTime: (ctx: TimerContext, e: TimerEvent): Partial<TimerContext> => {
      if (e.type !== "TICK") return {};
      // RoundToInterval: a tick is worth whole intervals, never a part — a
      // starved clock reports a delta it then counts in interval steps.
      const deltaMs = Math.floor(e.deltaMs / ctx.interval) * ctx.interval;
      const next = ctx.currentMs + (ctx.countdown ? -1 : 1) * deltaMs;
      const target = effectiveTarget(ctx);
      if (target === null) return { currentMs: next };
      return { currentMs: ctx.countdown ? Math.max(next, target) : Math.min(next, target) };
    },
    /**
     * The count goes home. A restart that carries the host's start time
     * takes it: the payload is the raw prop, and the machine shapes it.
     */
    resetTime: (ctx: TimerContext, e: TimerEvent): Partial<TimerContext> => {
      if (e.type === "RESTART" && e.startMs !== undefined) {
        const start = parseMs(e.startMs) ?? 0;
        return { startMs: start, currentMs: start };
      }
      return { currentMs: ctx.startMs };
    },
    /**
     * The host's count: the raw prop arrives, the machine shapes it.
     */
    setCurrentMs: (_ctx: TimerContext, e: TimerEvent): Partial<TimerContext> => {
      if (e.type !== "CURRENT_MS.SET") return {};
      const currentMs = parseMs(e.currentMs);
      return currentMs === undefined ? {} : { currentMs };
    },
  },
};

/**
 * The timer machine: state and nothing else. It is headless — it knows
 * its own arguments, and nothing about props, markup, or the DOM.
 */
export function timer(
  args: TimerArgs = {},
  authored: (name: string) => boolean,
): Machine<TimerContext, TimerEvent> {
  return createMachine<TimerContext, TimerEvent>({
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
     */
    fields: {
      startMs: { event: "RESTART" },
      currentMs: { event: "CURRENT_MS.SET" },
      targetMs: {},
      countdown: {},
      interval: {},
    },
    assigns: implementations.assigns,
    conds: implementations.conds,
  });
}
