/**
 * Timer connect: the DOM contract, the recipe's unit rows and the clock.
 *
 * Three jobs. The parts carry the machine's phase as `data-state` so the
 * utility engine paints every transition; the continuous values — the item's
 * `--value` and the run's `--timer-progress` — leave as CSS custom
 * properties, never as concrete declarations; and the interval is the
 * stdlib `autoplay` action attached through the root's bag, so the machine
 * never owns a timer.
 *
 * The clock's delta is measured here, not in the action: the stdlib action
 * re-arms its interval on every machine move, so what a tick is worth is
 * decided by the span since the machine last moved, floored at one
 * interval. The machine rounds that delta to the interval — Zag's
 * `roundToInterval` — which is where the step size lives.
 */

import { machineTick } from "@spin/runtime";
import {
  formatTime,
  msToTime,
  type Time,
  type TimePart,
  type TimerContext,
} from "./timer.machine.ts";

export type { Time, TimePart };

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
 * leaves no dangling separator behind it. */
export interface TimerSeparator {
  readonly after: TimePart;
}

export type TimerAction = "start" | "pause" | "resume" | "reset" | "restart";

export interface TimerActionTrigger {
  readonly action: TimerAction;
}

export interface TimerConnectProps {
  /** The clock's period in milliseconds. */
  readonly interval: number;
}

/** The element's imperative surface — Zag's api methods. Every one is a
 * send: the machine holds the phase, and the view decides what the host's
 * word means. */
export interface TimerCommands {
  start(): void;
  pause(): void;
  resume(): void;
  reset(): void;
  restart(): void;
}

export interface TimerApi extends TimerCommands {
  readonly running: boolean;
  readonly paused: boolean;
  readonly time: Time;
  readonly formattedTime: Time<string>;
  readonly progressPercent: number;
  getUnits(): readonly TimerUnit[];
  getRootProps(): Record<string, unknown>;
  getAreaProps(): Record<string, unknown>;
  getControlProps(): Record<string, unknown>;
  getItemProps(item: TimerItem): Record<string, unknown>;
  getItemValueProps(item: TimerItem): Record<string, unknown>;
  getItemLabelProps(item: TimerItem): Record<string, unknown>;
  getSeparatorProps(separator: TimerSeparator): Record<string, unknown>;
  getActionTriggerProps(trigger: TimerActionTrigger): Record<string, unknown>;
}

type Send = (event: { type: string } & Record<string, unknown>) => void;

/** The part-id namespace. */
const NAMESPACE = "timer";

export interface TimerService {
  readonly context: TimerContext;
  readonly state: { readonly value: string };
  send(event: { type: string } & Record<string, unknown>): void;
  /**
   * The tick's delta in milliseconds. The clock is an action the bridge
   * drives through this service, and the action re-arms its interval on
   * every machine move — so the span since the last move is what a tick is
   * worth, floored at the one interval that just ran.
   */
  elapsedSinceMove(): number;
}

/** The behavioural props, read on demand: the connect lives as long as the
 * element does, so a snapshot would freeze the first read's interval inside
 * the clock it caches. */
export type ReadTimerProps = () => TimerConnectProps;

/** A bag cached until the signature of the fields it reads moves. */
interface BagMemo {
  sig: string;
  bag: Record<string, unknown>;
}

/** A binding re-reads the bag on every machine move, so a fresh bag per read
 * would detach and re-attach every listener each move. Only one of the
 * fields the signature enumerates moving rebuilds it. */
function cached(): (sig: string, build: () => Record<string, unknown>) => Record<string, unknown> {
  let sig = "";
  let bag: Record<string, unknown> | undefined;
  return (next: string, build: () => Record<string, unknown>): Record<string, unknown> => {
    if (bag !== undefined && sig === next) return bag;
    sig = next;
    bag = build();
    return bag;
  };
}

/** `cached` per key: the unit rows are stable objects, so the memo dies with
 * the unit it came from. */
function keyed(
  store: Map<string, BagMemo>,
  key: string,
  sig: string,
  build: () => Record<string, unknown>,
): Record<string, unknown> {
  const hit = store.get(key);
  if (hit !== undefined && hit.sig === sig) return hit.bag;
  const bag = build();
  store.set(key, { sig, bag });
  return bag;
}

/** The units the recipe renders, and their captions. Milliseconds stays on
 * the api — a host that wants it reads `formattedTime.milliseconds`. */
const UNIT_LABELS: Readonly<Record<TimePart, string>> = {
  days: "days",
  hours: "hrs",
  minutes: "min",
  seconds: "sec",
  milliseconds: "ms",
};

/** Zag's `validActions` — the machine refuses anything else. */
const VALID_ACTIONS: Readonly<Record<string, true>> = {
  start: true,
  pause: true,
  resume: true,
  reset: true,
  restart: true,
};

export function connectRobotTimer(
  service: TimerService,
  readProps: ReadTimerProps,
  id: string,
): TimerApi {
  const ownerId = id.startsWith(`${NAMESPACE}:`) ? id : `${NAMESPACE}:${id}`;
  const areaId = `${ownerId}:area`;
  const controlId = `${ownerId}:control`;
  const itemId = (type: TimePart): string => `${ownerId}:item:${type}`;
  const itemValueId = (type: TimePart): string => `${ownerId}:item-value:${type}`;
  const itemLabelId = (type: TimePart): string => `${ownerId}:item-label:${type}`;
  const triggerId = (action: string): string => `${ownerId}:action-trigger:${action}`;
  const ctx = (): TimerContext => service.context;
  /** Every event the view sends, funnelled through the service the bridge
   * hands it — the bridge's wrapper is what fires the change callbacks. */
  const send: Send = (event): void => {
    service.send(event);
  };

  const running = (): boolean => service.state.value === "running";
  const paused = (): boolean => service.state.value === "paused";
  const time = (): Time => msToTime(ctx().currentMs);
  const formattedTime = (): Time<string> => formatTime(time());
  /** The run's progress as a fraction: a countdown runs from full to empty,
   * a stopwatch from empty to full. A target of zero is Zag's default when
   * none is given, which leaves a targetless stopwatch at zero progress. */
  const progressPercent = (): number => {
    const { currentMs, startMs, targetMs, countdown } = ctx();
    const target = targetMs ?? 0;
    const range = target - startMs;
    if (range === 0) return 0;
    const fraction = countdown ? (target - currentMs) / range : (currentMs - startMs) / range;
    return Math.min(Math.max(fraction, 0), 1);
  };

  /** The phase every part states on itself: state leaves the bag as an
   * attribute because `group-data-` selectors are banned in markup. */
  const stateAttrs = (): Record<string, unknown> => ({ "data-state": service.state.value });

  /** The machine never walks the clock: this reads the elapsed span the
   * bridge measured and lets the assign round it to the interval. */
  const onTick = (): void => {
    const interval = readProps().interval;
    send({ type: "TICK", deltaMs: Math.max(service.elapsedSinceMove(), interval) });
  };

  // ---- the recipe's rows -------------------------------------------------

  /** Memoized on which units are visible: a countdown that crosses a day
   * boundary grows a row. The ROWS are stable objects — the `for` directive
   * reuses a cell by its key — but the ARRAY is fresh on every read, because
   * that is what tells the directive to re-run each row's parts, and the
   * digits are one of them. */
  let unitsSig = "";
  let unitsCache: readonly TimerUnit[] = [];
  const units = (): readonly TimerUnit[] => {
    // The rows read plain-mutated context through a snapshot getter, which
    // tracks nothing on its own: `machineTick` is the runtime's subscription
    // for exactly that path, and it is what wakes the `for` directive so the
    // digits get re-read.
    machineTick();
    const visible: readonly TimePart[] = time().days > 0
      ? ["days", "hours", "minutes", "seconds"]
      : ["hours", "minutes", "seconds"];
    const sig = visible.join("\u0000");
    if (sig !== unitsSig) {
      unitsSig = sig;
      unitsCache = visible.map((type, index) => ({
        type,
        label: UNIT_LABELS[type],
        last: index === visible.length - 1,
      }));
    }
    return [...unitsCache];
  };

  // ---- cached bags --------------------------------------------------------

  const rootBag = cached();
  const areaBag = cached();
  const controlBag = cached();
  const itemBags = new Map<string, BagMemo>();
  const itemValueBags = new Map<string, BagMemo>();
  const itemLabelBags = new Map<string, BagMemo>();
  const separatorBags = new Map<string, BagMemo>();
  const triggerBags = new Map<string, BagMemo>();

  return {
    get running(): boolean {
      return running();
    },
    get paused(): boolean {
      return paused();
    },
    get time(): Time {
      return time();
    },
    get formattedTime(): Time<string> {
      return formattedTime();
    },
    get progressPercent(): number {
      return progressPercent();
    },
    getUnits: units,
    start: (): void => send({ type: "START" }),
    pause: (): void => send({ type: "PAUSE" }),
    resume: (): void => send({ type: "RESUME" }),
    reset: (): void => send({ type: "RESET" }),
    restart: (): void => send({ type: "RESTART" }),
    getRootProps: () => {
      const props = readProps();
      return rootBag(`${service.state.value}\u0000${props.interval}`, () => ({
        id: `${ownerId}:root`,
        ...stateAttrs(),
        // The clock: the action owns the interval, the machine owns nothing.
        "use:autoplay": {
          interval: props.interval,
          enabled: running(),
          onTick,
        },
      }));
    },
    getAreaProps: () => {
      const t = time();
      const f = formattedTime();
      // The raw count, not its parts: the bar's var moves with the
      // milliseconds, and a signature of the formatted parts would not see a
      // change the second unit has not caught up with yet.
      return areaBag(`${service.state.value}\u0000${ctx().currentMs}`, () => ({
          id: areaId,
          role: "timer",
          // Zag's translation, verbatim: the units a screen reader hears.
          "aria-label": `${t.days} days ${f.hours}:${f.minutes}:${f.seconds}`,
          "aria-atomic": true,
          ...stateAttrs(),
          // Continuous, so it is data for the recipe's bar, not a style.
          style: { "--timer-progress": `${(progressPercent() * 100).toFixed(3)}%` },
        }),
      );
    },
    getControlProps: () =>
      controlBag(service.state.value, () => ({
        id: controlId,
        ...stateAttrs(),
      })),
    getItemProps: (item: TimerItem) => {
      const type = item.type;
      const value = time()[type];
      return keyed(itemBags, type, `${service.state.value}\u0000${value}`, () => ({
        id: itemId(type),
        "data-type": type,
        ...stateAttrs(),
        style: { "--value": value },
        // A leading zero is a unit the run has not reached: the recipe hides
        // the days row rather than showing an empty one.
        ...(type === "days" && value === 0 ? { hidden: true } : {}),
      }));
    },
    getItemValueProps: (item: TimerItem) => {
      const type = item.type;
      return keyed(
        itemValueBags,
        type,
        `${service.state.value}\u0000${formattedTime()[type]}`,
        () => ({
          id: itemValueId(type),
          "data-type": type,
          ...stateAttrs(),
        }),
      );
    },
    getItemLabelProps: (item: TimerItem) => {
      const type = item.type;
      return keyed(itemLabelBags, type, type, () => ({
        id: itemLabelId(type),
        "data-type": type,
        ...stateAttrs(),
      }));
    },
    getSeparatorProps: (separator: TimerSeparator) => {
      const after = separator.after;
      const followsHiddenDays = after === "days" && time().days === 0;
      return keyed(separatorBags, after, `${followsHiddenDays}`, () => ({
        "aria-hidden": true,
        "data-after": after,
        hidden: followsHiddenDays,
      }));
    },
    getActionTriggerProps: (trigger: TimerActionTrigger) => {
      const action = trigger.action;
      if (VALID_ACTIONS[action] !== true) {
        throw new Error(
          `[timer] Invalid action: ${action}. Must be one of: ${Object.keys(VALID_ACTIONS).join(", ")}`,
        );
      }
      // Which triggers the phase answers: a stopped clock offers start and
      // restart, a running one pause and reset, a paused one resume, reset
      // and restart.
      const hidden = action === "start"
        ? running() || paused()
        : action === "pause"
        ? !running()
        : action === "resume"
        ? !paused()
        : action === "reset"
        ? !running() && !paused()
        : false;
      return keyed(triggerBags, action, `${service.state.value}\u0000${hidden}`, () => ({
        id: triggerId(action),
        type: "button",
        "data-action": action,
        ...stateAttrs(),
        hidden,
        onClick: (event: MouseEvent): void => {
          if (event.defaultPrevented) return;
          send({ type: action.toUpperCase() });
        },
      }));
    },
  };
}
