import { defaultTwin } from "@spinjs/components/runtime";

export type TimePart =
  | "days"
  | "hours"
  | "minutes"
  | "seconds"
  | "milliseconds";

export interface Time<T = number> {
  readonly days: T;
  readonly hours: T;
  readonly minutes: T;
  readonly seconds: T;
  readonly milliseconds: T;
}

export type TimerState = "idle" | "running" | "paused";

export interface TimerContext {
  currentMs: number;
  startMs: number;
  targetMs: number | null;
  countdown: boolean;
  interval: number;
}

export interface TimerArgs {
  readonly startMs?: string;
  readonly targetMs?: string;
  readonly countdown?: boolean;
  readonly interval?: number;
}

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

export function validateTimer(
  startMs: number | undefined,
  targetMs: number | undefined,
  countdown: boolean,
  interval: number,
): void {
  if (typeof interval !== "number" || interval <= 0) {
    throw new Error(
      `[timer] Invalid interval: ${interval}. Must be a positive number.`,
    );
  }
  if (startMs !== undefined && (typeof startMs !== "number" || startMs < 0)) {
    throw new Error(
      `[timer] Invalid startMs: ${startMs}. Must be a non-negative number.`,
    );
  }
  if (
    targetMs !== undefined && (typeof targetMs !== "number" || targetMs < 0)
  ) {
    throw new Error(
      `[timer] Invalid targetMs: ${targetMs}. Must be a non-negative number.`,
    );
  }
  if (
    countdown && startMs !== undefined && targetMs !== undefined &&
    startMs <= targetMs
  ) {
    throw new Error(
      `[timer] Invalid countdown configuration: startMs (${startMs}) must be greater than targetMs (${targetMs}).`,
    );
  }
  if (
    !countdown && startMs !== undefined && targetMs !== undefined &&
    startMs >= targetMs
  ) {
    throw new Error(
      `[timer] Invalid stopwatch configuration: startMs (${startMs}) must be less than targetMs (${targetMs}).`,
    );
  }
  if (
    countdown && targetMs === undefined && startMs !== undefined && startMs <= 0
  ) {
    throw new Error(
      `[timer] Invalid countdown configuration: startMs (${startMs}) must be greater than 0 when no targetMs is provided.`,
    );
  }
}

export function initial(
  args: TimerArgs,
  authored: (name: string) => boolean,
): TimerContext {
  const written = (field: string): boolean =>
    authored(field) ||
    authored(defaultTwin(field)) ||
    (args as Record<string, unknown>)[defaultTwin(field)] !== undefined;
  const startMs = written("startMs") ? parseMs(args.startMs) : undefined;
  const targetMs = written("targetMs") ? parseMs(args.targetMs) : undefined;
  const countdown = written("countdown") ? args.countdown === true : false;
  const rawInterval = written("interval") ? args.interval : undefined;
  const interval = typeof rawInterval === "number"
    ? Math.trunc(rawInterval)
    : 1000;
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

const MS_PER_SECOND = 1000;
const MS_PER_MINUTE = 60 * MS_PER_SECOND;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const MS_PER_DAY = 24 * MS_PER_HOUR;

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

export function formatTime(time: Time): Time<string> {
  return {
    days: time.days.toString().padStart(2, "0"),
    hours: time.hours.toString().padStart(2, "0"),
    minutes: time.minutes.toString().padStart(2, "0"),
    seconds: time.seconds.toString().padStart(2, "0"),
    milliseconds: time.milliseconds.toString().padStart(3, "0"),
  };
}

export const effectiveTarget = (ctx: TimerContext): number | null =>
  ctx.targetMs !== null ? ctx.targetMs : ctx.countdown ? 0 : null;
