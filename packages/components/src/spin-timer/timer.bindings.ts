import { defineComponent, isRecord, machineTick, type ComponentDef, type PartScope, type SlotScope } from "@spin/runtime";
import {
  config,
  formatTime,
  implementations,
  initial,
  msToTime,
  parseMs,
  validateTimer,
  type Time,
  type TimePart,
  type TimerContext,
  type TimerEvent,
  type TimerInitial,
} from "./timer.machine.ts";

/**
 * Timer definition: the DOM contract as data. The machine owns the phase
 * (idle/running/paused) and the count; this file maps props to channels,
 * parts to attribute bags, commands to sends, and tick/complete
 * transitions to their events.
 *
 * The clock is NOT here. A `use:autoplay` action on the root owns the
 * interval and reports `onTick`; the bag's handler measures the span since
 * the last send (the def's `settled` captures the epoch per bridge) and
 * the machine decides what the tick is worth. `startMs` restarts the run
 * on change (Zag's `watch`); an authored `currentMs` alternates the count.
 */

/** One row of the display: the unit, its caption, and whether a separator
 * follows it. `getUnits` is the recipe's row source, the way a listbox's
 * `getBlocks` is. */
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
  getControlProps(): Record<string, unknown>;
  getItemProps(item: TimerItem): Record<string, unknown>;
  getItemValueProps(item: TimerItem): Record<string, unknown>;
  getItemLabelProps(item: TimerItem): Record<string, unknown>;
  getSeparatorProps(separator: TimerSeparator): Record<string, unknown>;
  getActionTriggerProps(trigger: TimerActionTrigger): Record<string, unknown>;
}

interface ScopeLike extends PartScope<unknown, TimerContext> {}

interface SlotLike<R> extends SlotScope<R, TimerContext> {}

/** Transport guarantees the raw prop bag is a TimerInitial-shaped object. */
const isTimerInitial = (raw: unknown): raw is TimerInitial =>
  raw !== null && typeof raw === "object";
const timeOf = (context: TimerContext): Time => msToTime(context.currentMs);

/** The run's progress as a fraction: a countdown runs from full to empty,
 * a stopwatch from empty to full. A target of zero is Zag's default when
 * none is given, which leaves a targetless stopwatch at zero progress. */
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

/** The units the recipe renders, and their captions. Milliseconds stays on
 * the api — a host that wants it reads `formattedTime.milliseconds`. */
const UNIT_LABELS: Readonly<Record<TimePart, string>> = {
  days: "days",
  hours: "hrs",
  minutes: "min",
  seconds: "sec",
  milliseconds: "ms",
};

/** A separator's unit: the row carries `after`, defaulting to seconds. */
const separatorAfter = (slot: unknown): TimePart => {
  if (!isRecord(slot)) return "seconds";
  const after: unknown = slot["after"];
  return after === "days" || after === "hours" || after === "minutes" || after === "seconds" || after === "milliseconds" ? after : "seconds";
};

const isLast = (slot: unknown): boolean =>
  isRecord(slot) && slot["last"] === true;


/** An action trigger's action: the five valid verbs, defaulting to start. */
const isAction = (value: unknown): value is TimerActionTrigger["action"] =>
  typeof value === "string" && (VALID_ACTIONS as Record<string, unknown>)[value] === true;

/** An action trigger's action: the five valid verbs. Anything else is a
 * host bug, refused loudly at the call — never a silent default. */
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

/** Tark keeps the days row for day-scale runs (00 days at 23:59:57): days
 * shows when the current time has one, or the run's start/target reaches
 * a day — both fixed for the run, so no mid-run row flip. */
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

/** Zag's `validActions` — the machine refuses anything else. */
const VALID_ACTIONS: Readonly<Record<string, true>> = {
  start: true,
  pause: true,
  resume: true,
  reset: true,
  restart: true,
};

const def: ComponentDef<TimerContext, TimerEvent> = {
  name: "timer",
  config,
  implementations,
  start: (raw, _authored) => {
    const props: TimerInitial = isTimerInitial(raw) ? raw : {};
    return props.autoStart === true ? "running" : "idle";
  },
  seed: (raw, _authored) => {
    const props: TimerInitial = isTimerInitial(raw) ? raw : {};
    return { ...initial(props) };
  },

  // The clock's epoch is the service's birth: an `autoStart` run's first
  // tick is measured from here, since no START send precedes it.
  // `settled` re-captures it after every transmit.
  mounted: ({ root }) => {
    epochByRoot.set(root(), Date.now());
  },
  settled: ({ root }) => {
    epochByRoot.set(root(), Date.now());
  },
  scalarsOf: (parsed) => {
    const interval = parsed["interval"];
    return {
      targetMs: (() => {
        const target: unknown = parsed["targetMs"];
        return typeof target === "number" ? target : null;
      })(),
      countdown: parsed["countdown"] === true,
      // A mid-life write of zero or less is not worth a throw inside an
      // effect: the clock simply runs at its fastest.
      interval: typeof interval === "number" && interval > 0 ? Math.trunc(interval) : 1000,
    };
  },
  reconcile: ({ context, parsed, authored, send }) => {
    const ctx = context;
    // A new startMs is a new run: Zag restarts on the change. `startMs`
    // stays out of the scalar merge so the change is still visible here —
    // the merge would assign it first and mask the restart.
    const parsedStart = parseMs(parsed["startMs"]);
    const startMs = parsedStart ?? 0;
    if (ctx.startMs !== startMs) {
      ctx.startMs = startMs;
      send({ type: "RESTART" });
      return true;
    }
    if (authored("currentMs")) {
      const outer = parseMs(parsed["currentMs"]);
      if (outer !== undefined && ctx.currentMs !== outer) {
        send({ type: "CURRENT_MS.SET", currentMs: outer });
        return true;
      }
    }
    return false;
  },
  parts: {
    root: {
      sig: (scope) => [scope.state, scope.context.interval].join(" "),
      attrs: (scope) => ({
        id: scope.id(""),
        "data-scope": "timer",
        "data-part": "root",
        "data-state": scope.state,
        // The clock: the action owns the interval, the machine owns nothing.
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
      sig: (scope) => [scope.state, scope.context.currentMs].join(" "),
      attrs: (scope) => {
        const t = timeOf(scope.context);
        const f = formatTime(t);
        return {
          id: scope.id("area"),
          role: "timer",
          "data-scope": "timer",
          "data-part": "area",
          // Zag's translation, verbatim: the units a screen reader hears.
          "aria-label": `${t.days} days ${f.hours}:${f.minutes}:${f.seconds}`,
          "aria-atomic": true,
          "data-state": scope.state,
          // Continuous, so it is data for the recipe's bar, not a style.
          style: { "--timer-progress": `${(progressOf(scope.context) * 100).toFixed(3)}%` },
        };
      },
    },
    control: {
      sig: (scope) => [scope.state].join(" "),
      attrs: (scope) => ({
        id: scope.id("control"),
        "data-scope": "timer",
        "data-part": "control",
        "data-state": scope.state,
      }),
    },
  },
  slots: {
    item: {
      indexes: (context) =>
        showDays(context) ? UNITS_WITH_DAYS : UNITS_WITHOUT_DAYS,
      sig: (scope: SlotLike<TimerUnit>) => {
        const unit = scope.slot;
        return [scope.state, timeOf(scope.context)[unit.type]].join(" ");
      },
      attrs: (scope: SlotLike<TimerUnit>) => {
        const unit = scope.slot.type;
        const value = timeOf(scope.context)[unit];
        return {
          id: scope.id("item", unit),
          "data-scope": "timer",
          "data-part": "item",
          "data-type": unit,
          "data-state": scope.state,
          style: { "--value": value },
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
      sig: (scope: SlotLike<TimerUnit>) => {
        const unit = scope.slot.type;
        return [scope.state, formatTime(timeOf(scope.context))[unit]].join(" ");
      },
      attrs: (scope: SlotLike<TimerUnit>) => {
        const unit = scope.slot.type;
        return {
          id: scope.id("itemValue", unit),
          "data-scope": "timer",
          "data-part": "item-value",
          "data-type": unit,
          "data-state": scope.state,
        };
      },
    },
    itemLabel: {
      id: "item-label",
      indexes: (context) =>
        showDays(context) ? UNITS_WITH_DAYS : UNITS_WITHOUT_DAYS,
      sig: (scope: SlotLike<TimerUnit>) => `${scope.slot.type}`,
      attrs: (scope: SlotLike<TimerUnit>) => {
        const unit = scope.slot.type;
        return {
          id: scope.id("itemLabel", unit),
          "data-scope": "timer",
          "data-part": "item-label",
          "data-type": unit,
          "data-state": scope.state,
        };
      },
    },
    separator: {
      indexes: (context: TimerContext) =>
        showDays(context) ? UNITS_WITH_DAYS : UNITS_WITHOUT_DAYS,
      sig: (scope: SlotLike<TimerSeparator>) => {
        const after = separatorAfter(scope.slot);
        return `${after === "days" && timeOf(scope.context).days === 0}`;
      },
      attrs: (scope: SlotLike<TimerSeparator>) => {
        const slot = scope.slot;
        const after = separatorAfter(scope.slot);
        const unit = separatorAfter(slot);
        const followsHiddenDays = unit === "days" && timeOf(scope.context).days === 0;
        return {
          "aria-hidden": true,
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
      sig: (scope: SlotLike<TimerActionTrigger>) => {
        const action = actionOf(scope.slot);
        return [scope.state, action].join(" ");
      },
      attrs: (scope: SlotLike<TimerActionTrigger>) => {
        const action = actionOf(scope.slot);
        if (VALID_ACTIONS[action] !== true) {
          throw new Error(
            `[timer] Invalid action: ${action}. Must be one of: ${Object.keys(VALID_ACTIONS).join(", ")}`,
          );
        }
        const running = scope.state === "running";
        const paused = scope.state === "paused";
        // Which triggers the phase answers: a stopped clock offers start
        // and restart, a running one pause and reset, a paused one resume,
        // reset and restart. Reset hides only when there is nothing to
        // reset (fresh clock) — never an empty control mid-run.
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
          "data-state": scope.state,
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
        // The rows read plain-mutated context through a snapshot getter,
        // which tracks nothing on its own: `machineTick` is the runtime's
        // subscription for exactly that path, and it is what wakes the
        // `for` directive so the digits get re-read.
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
      // finished clock is not Zag's `invokeOnTick`, which sits on the
      // running TICK transition.
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
      // Only a completing tick leaves `running` for `idle`: a pause goes
      // to `paused`, a reset stays or goes home without ending the run.
      select: (event, _before, _after, states) => {
        if (event.type !== "TICK" || states?.was !== "running" || states?.is !== "idle") return null;
        return {};
      },
    },
  },
};

export const timer = defineComponent<TimerContext, TimerEvent, TimerApi>(def);
