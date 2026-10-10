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
 * `interval` are the scalars the assigns read, synced from scope by the
 * bridge so a host write moves the clock without a machine event.
 */

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

export type TimerEvent =
  | { type: "START" }
  | { type: "PAUSE" }
  | { type: "RESUME" }
  | { type: "RESET" }
  | { type: "RESTART" }
  | { type: "TICK"; deltaMs: number }
  | { type: "CURRENT_MS.SET"; currentMs: number };

export const config = {
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
    RESTART: { target: "running", actions: [{ assign: "resetTime" }] },
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

export const implementations = {
  conds: {
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
    resetTime: (ctx: TimerContext): Partial<TimerContext> => ({ currentMs: ctx.startMs }),
    setCurrentMs: (_ctx: TimerContext, e: TimerEvent): Partial<TimerContext> =>
      e.type === "CURRENT_MS.SET" ? { currentMs: e.currentMs } : {},
  },
};
