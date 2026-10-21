import { ariaHidden, defineComponent, factAttrs, isRecord, liveRegion, machineTick, type ComponentDef, type PartScope, type SlotScope } from "@spin/runtime";
import {
  formatTime,
  msToTime,
  timer as timerMachine,
  type Time,
  type TimePart,
  type TimerArgs,
  type TimerContext,
  type TimerEvents,
} from "./timer.machine.ts";

/**
 * Timer definition: the DOM contract as data.
 *
 * The clock is not here: a `use:autoplay` action on the root owns the
 * interval and reports `onTick`; the handler measures the span since the
 * last send (`settled` captures the epoch per bridge).
 */

/** One row of the display: the unit, its caption, and whether a separator
 * follows it. */
export interface TimerUnit {
  readonly type: TimePart;
  readonly label: string;
  readonly last: boolean;
}

/** An item part, as Zag types it: the unit the part renders. */
export interface TimerItem {
  readonly type: TimePart;
}

/** A separator part, addressed by the unit it follows so a hidden unit
 * leaves no dangling separator behind it. `last` hides the trailing
 * separator — `show=` on a second row root misplaces (framework bug), so
 * the bag owns it. */
export interface TimerSeparator {
  readonly after: TimePart;
  readonly last?: boolean | undefined;
}

export type TimerAction = "start" | "pause" | "resume" | "reset" | "restart";

export interface TimerActionTrigger {
  readonly action: TimerAction;
}

export interface TimerTickChange {
  readonly value: number;
  readonly time: Time;
  readonly formattedTime: Time<string>;
}

export interface TimerApi {
  readonly running: boolean;
  readonly paused: boolean;
  readonly time: Time;
  readonly formattedTime: Time<string>;
  readonly progressPercent: number;
  getUnits(): readonly TimerUnit[];
  start(): void;
  pause(): void;
  resume(): void;
  reset(): void;
  restart(): void;
  getRootProps(): Record<string, unknown>;
  getAreaProps(): Record<string, unknown>;
  getProgressProps(): Record<string, unknown>;
  getControlProps(): Record<string, unknown>;
  getItemProps(item: TimerItem): Record<string, unknown>;
  getItemValueProps(item: TimerItem): Record<string, unknown>;
  getItemLabelProps(item: TimerItem): Record<string, unknown>;
  getSeparatorProps(separator: TimerSeparator): Record<string, unknown>;
  getActionTriggerProps(trigger: TimerActionTrigger): Record<string, unknown>;
}

interface ScopeLike extends PartScope<unknown, TimerContext> {}

interface SlotLike<R> extends SlotScope<R, TimerContext> {}

const timeOf = (context: TimerContext): Time => msToTime(context.currentMs);

/** A countdown runs from full to empty, a stopwatch from empty to full. A
 * targetless stopwatch stays at zero progress (Zag's default target is
 * zero). */
const progressOf = (context: TimerContext): number => {
  const { currentMs, startMs, targetMs, countdown } = context;
  const target = targetMs ?? 0;
  const range = target - startMs;
  if (range === 0) return 0;
  const fraction = countdown ? (target - currentMs) / range : (currentMs - startMs) / range;
  return Math.min(Math.max(fraction, 0), 1);
};

/** The clock's epoch per bridge: the tick's delta is the span since the
 * last send, and `settled` runs after every transmit. */
const epochByRoot = new WeakMap<Element, number>();

/** The units the recipe renders, and their captions. Milliseconds stays off
 * the display — a host that wants it reads `formattedTime.milliseconds`. */
const UNIT_LABELS: Readonly<Record<TimePart, string>> = {
  days: "days",
  hours: "hrs",
  minutes: "min",
  seconds: "sec",
  milliseconds: "ms",
};

const separatorAfter = (slot: unknown): TimePart => {
  if (!isRecord(slot)) return "seconds";
  const after: unknown = slot["after"];
  return after === "days" || after === "hours" || after === "minutes" || after === "seconds" || after === "milliseconds" ? after : "seconds";
};

const isLast = (slot: unknown): boolean =>
  isRecord(slot) && slot["last"] === true;

const isAction = (value: unknown): value is TimerActionTrigger["action"] =>
  typeof value === "string" && (VALID_ACTIONS as Record<string, unknown>)[value] === true;

/** An action trigger's action: the five valid verbs. Anything else is a
 * host bug, refused loudly — never a silent default. */
const actionOf = (slot: unknown): TimerActionTrigger["action"] => {
  const action: unknown = isRecord(slot) ? slot["action"] : undefined;
  if (isAction(action)) return action;
  throw new Error(
    `[timer] Invalid action: ${typeof action === "string" ? action : ""}. Must be one of: ${Object.keys(VALID_ACTIONS).join(", ")}`,
  );
};

/** Canonical rows: the `for` iterates these identities, and a countdown
 * crossing a day boundary swaps which array (never which row) is live. */
const DAY_UNIT: TimerUnit = { type: "days", label: "days", last: false };
const HOUR_UNIT: TimerUnit = { type: "hours", label: "hrs", last: false };
const MINUTE_UNIT: TimerUnit = { type: "minutes", label: "min", last: false };
const SECOND_UNIT: TimerUnit = { type: "seconds", label: "sec", last: true };
const UNITS_WITH_DAYS: readonly TimerUnit[] = [DAY_UNIT, HOUR_UNIT, MINUTE_UNIT, SECOND_UNIT];
const UNITS_WITHOUT_DAYS: readonly TimerUnit[] = [HOUR_UNIT, MINUTE_UNIT, SECOND_UNIT];

/** The days row shows when the current time has one, or the run's
 * start/target reaches a day — both fixed for the run, so no mid-run row
 * flip. */
function showDays(context: TimerContext): boolean {
  const ctx = context;
  if (timeOf(context).days > 0) return true;
  const day = 86_400_000;
  return ctx.startMs >= day || (ctx.targetMs ?? 0) >= day;
}

const ACTIONS: readonly TimerActionTrigger[] = [
  { action: "start" },
  { action: "pause" },
  { action: "resume" },
  { action: "reset" },
  { action: "restart" },
];

/** Zag's `validActions`. */
const VALID_ACTIONS: Readonly<Record<string, true>> = {
  start: true,
  pause: true,
  resume: true,
  reset: true,
  restart: true,
};

/** The component's public state: the names the markup may key on. */
export const facts = {
  state: (scope: ScopeLike) => scope.state,
};

const def: ComponentDef<TimerContext, TimerEvents> = {
  name: "timer",
  machine: (props, authored) => timerMachine(props as TimerArgs, authored),
  start: (raw) => (raw["autoStart"] === true ? "running" : "idle"),

  // The clock's epoch is the service's birth: an `autoStart` run's first
  // tick is measured from here, since no START send precedes it.
  // `settled` re-captures it after every transmit.
  mounted: ({ root }) => {
    epochByRoot.set(root(), Date.now());
  },
  settled: ({ root }) => {
    epochByRoot.set(root(), Date.now());
  },
  parts: {
    root: {
      attrs: (scope) => ({
        id: scope.id(""),
        "data-scope": "timer",
        "data-part": "root",
        ...factAttrs(scope, facts, "state"),
        "use:autoplay": {
          interval: scope.context.interval,
          enabled: scope.state === "running",
          onTick: (): void => {
            const interval = scope.context.interval;
            const epoch = epochByRoot.get(scope.root());
            const elapsed = epoch === undefined ? interval : Date.now() - epoch;
            scope.send({ type: "TICK", deltaMs: Math.max(elapsed, interval) });
          },
        },
      }),
    },
    area: {
      attrs: (scope) => {
        const t = timeOf(scope.context);
        const f = formatTime(t);
        return {
          id: scope.id("area"),
          role: "timer",
          "data-scope": "timer",
          "data-part": "area",
          // Zag's translation: the units a screen reader hears.
          "aria-label": `${t.days} days ${f.hours}:${f.minutes}:${f.seconds}`,
          ...liveRegion({ atomic: true }),
          ...factAttrs(scope, facts, "state"),
        };
      },
    },
    // The bar's fill: the progress is the machine's geometry, so it rides
    // the bag's style object — the markup names no property. The bag
    // rebuilds when the fields it read move, so the state it carries
    // cannot go stale.
    progress: {
      attrs: (scope) => ({
        id: scope.id("progress"),
        "data-scope": "timer",
        "data-part": "progress",
        ...factAttrs(scope, facts, "state"),
        style: { width: `${(progressOf(scope.context) * 100).toFixed(3)}%` },
      }),
    },
    control: {
      attrs: (scope) => ({
        id: scope.id("control"),
        "data-scope": "timer",
        "data-part": "control",
        ...factAttrs(scope, facts, "state"),
      }),
    },
  },
  slots: {
    item: {
      indexes: (context) =>
        showDays(context) ? UNITS_WITH_DAYS : UNITS_WITHOUT_DAYS,
      attrs: (scope: SlotLike<TimerUnit>) => {
        const unit = scope.slot.type;
        const value = timeOf(scope.context)[unit];
        return {
          id: scope.id("item", unit),
          "data-scope": "timer",
          "data-part": "item",
          "data-type": unit,
          ...factAttrs(scope, facts, "state"),
          // The raw unit is data, not a style: a recipe that wants it
          // reads the attribute.
          "data-value": value,
          // A leading zero is a unit the run has not reached: the recipe
          // hides the days row rather than showing an empty one.
          ...(unit === "days" && value === 0 ? { hidden: true } : {}),
        };
      },
    },
    itemValue: {
      id: "item-value",
      indexes: (context) =>
        showDays(context) ? UNITS_WITH_DAYS : UNITS_WITHOUT_DAYS,
      attrs: (scope: SlotLike<TimerUnit>) => {
        const unit = scope.slot.type;
        return {
          id: scope.id("itemValue", unit),
          "data-scope": "timer",
          "data-part": "item-value",
          "data-type": unit,
          ...factAttrs(scope, facts, "state"),
        };
      },
    },
    itemLabel: {
      id: "item-label",
      indexes: (context) =>
        showDays(context) ? UNITS_WITH_DAYS : UNITS_WITHOUT_DAYS,
      attrs: (scope: SlotLike<TimerUnit>) => {
        const unit = scope.slot.type;
        return {
          id: scope.id("itemLabel", unit),
          "data-scope": "timer",
          "data-part": "item-label",
          "data-type": unit,
          ...factAttrs(scope, facts, "state"),
        };
      },
    },
    separator: {
      indexes: (context: TimerContext) =>
        showDays(context) ? UNITS_WITH_DAYS : UNITS_WITHOUT_DAYS,
      attrs: (scope: SlotLike<TimerSeparator>) => {
        const slot = scope.slot;
        const after = separatorAfter(scope.slot);
        const unit = separatorAfter(slot);
        const followsHiddenDays = unit === "days" && timeOf(scope.context).days === 0;
        return {
          ...ariaHidden(true),
          "data-scope": "timer",
          "data-part": "separator",
          "data-after": unit,
          hidden: followsHiddenDays || isLast(slot),
        };
      },
    },
    actionTrigger: {
      id: "action-trigger",
      indexes: () => ACTIONS,
      attrs: (scope: SlotLike<TimerActionTrigger>) => {
        const action = actionOf(scope.slot);
        if (VALID_ACTIONS[action] !== true) {
          throw new Error(
            `[timer] Invalid action: ${action}. Must be one of: ${Object.keys(VALID_ACTIONS).join(", ")}`,
          );
        }
        const running = scope.state === "running";
        const paused = scope.state === "paused";
        // Reset hides only when there is nothing to reset (a fresh clock)
        // — never an empty control mid-run.
        const ctx = scope.context;
        const atStart = ctx.countdown
          ? ctx.currentMs >= ctx.startMs
          : ctx.currentMs <= 0;
        const hidden = action === "start"
          ? running || paused
          : action === "pause"
          ? !running
          : action === "resume"
          ? !paused
          : action === "reset"
          ? atStart && !running && !paused
          : false;
        return {
          id: scope.id("actionTrigger", action),
          type: "button",
          "data-scope": "timer",
          "data-part": "action-trigger",
          "data-action": action,
          ...factAttrs(scope, facts, "state"),
          hidden,
          onClick: (event: MouseEvent): void => {
            if (event.defaultPrevented) return;
            scope.send({ type: action.toUpperCase() });
          },
        };
      },
    },
  },
  methods: {
    getUnits: {
      call: (context) => {
        // `machineTick` is the runtime's subscription for this path: it
        // wakes the `for` directive so the digits get re-read.
        machineTick();
        return [...(showDays(context) ? UNITS_WITH_DAYS : UNITS_WITHOUT_DAYS)];
      },
    },
  },
  commands: {
    start: { event: () => ({ type: "START" }) },
    pause: { event: () => ({ type: "PAUSE" }) },
    resume: { event: () => ({ type: "RESUME" }) },
    reset: { event: () => ({ type: "RESET" }) },
    restart: { event: () => ({ type: "RESTART" }) },
  },
  readers: {
    running: { read: (_context, state) => state === "running" },
    paused: { read: (_context, state) => state === "paused" },
    time: { read: (context) => ({ ...timeOf(context) }) },
    formattedTime: { read: (context) => ({ ...formatTime(timeOf(context)) }) },
    progressPercent: { read: (context) => progressOf(context) },
  },
  events: {
    tick: {
      prop: "onTick",
      watch: () => [],
      detail: (watched: readonly unknown[]) => {
        const value = watched[0];
        return { value: typeof value === "number" ? value : 0 };
      },
      // A tick only counts while running — a stray one on a paused or
      // finished clock is not counted.
      select: (event, _before, after: TimerContext, states) => {
        if (event.type !== "TICK" || states?.was !== "running") return null;
        const time = msToTime(after.currentMs);
        return { value: after.currentMs, time, formattedTime: formatTime(time) };
      },
    },
    complete: {
      prop: "onComplete",
      watch: () => [],
      detail: () => ({}),
      // Only a completing tick leaves `running` for `idle`; a pause goes to
      // `paused` and a reset does not end the run.
      select: (event, _before, _after, states) => {
        if (event.type !== "TICK" || states?.was !== "running" || states?.is !== "idle") return null;
        return {};
      },
    },
  },
};

export const timer = defineComponent<TimerContext, TimerEvents, TimerApi>(def);
