import { computed, effect, machineTick, scope, signal, untrack } from "@spin/runtime";
import { createMachine, interpret, type Service } from "@spin/runtime/fsm";
import {
  config,
  formatTime,
  implementations,
  msToTime,
  type Time,
  type TimerContext,
  type TimerEvent,
} from "./timer.machine.ts";
import {
  connectRobotTimer,
  type ReadTimerProps,
  type TimerApi,
  type TimerConnectProps,
  type TimerService,
} from "./timer.connect.ts";

export interface TimerTickChange {
  readonly value: number;
  readonly time: Time;
  readonly formattedTime: Time<string>;
}

export interface TimerCallbacks {
  readonly onTick: ((details: TimerTickChange) => void) | undefined;
  readonly onComplete: (() => void) | undefined;
}

/**
 * A millisecond prop, as Zag's `parse` accepts one: a number, a numeric
 * string (an element attribute is always a string), or a date string. The
 * time-segment object has no transport on the prop channel — the scope
 * grammar has no object type — so the host computes the milliseconds.
 */
const parseMs = (raw: unknown): number | undefined => {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : undefined;
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return undefined;
  const numeric = Number(trimmed);
  if (!Number.isNaN(numeric)) return numeric;
  const at = new Date(trimmed).getTime();
  return Number.isNaN(at) ? undefined : at;
};

/** Zag's `validateProps`, verbatim: an impossible clock refuses to build
 * rather than running one. Checked once, when the service is created. */
const validateProps = (
  startMs: number | undefined,
  targetMs: number | undefined,
  countdown: boolean,
  interval: number,
): void => {
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
};

/**
 * The timer bridge: scope values in, machine state out.
 *
 * Four jobs. Seed the phase from `autoStart` and the count from `startMs`;
 * keep the scalars the assigns read in step with the props; alternate an
 * authored `currentMs` and restart on an authored `startMs`, which is Zag's
 * `watch` on `startMs`; and publish the connect api through the live-view
 * proxy.
 *
 * The clock's delta is measured here because the bridge is the only thing
 * that sees every send. The view's interval action re-arms its clock on each
 * one, so the span since the last send is what a tick is worth.
 */
export function createTimerBridge(
  props: () => Record<string, unknown>,
  _root: () => Element,
  id: string,
): { readonly api: TimerApi; dispose(): void } {
  const owner = scope();
  const tick = signal(0);
  // The fork's `config.context` is ONE object, and its interpreter starts on
  // it without copying: every timer on the page would otherwise share a
  // single count.
  const machine = createMachine<TimerContext, TimerEvent>(
    { ...config, context: { ...config.context } },
    implementations,
  );

  let service: Service<TimerContext, TimerEvent> | undefined;
  let lastMoveAt = 0;

  const authored = (name: string): boolean => {
    const predicate = props()["@@authored"];
    return typeof predicate === "function" ? (predicate as (n: string) => boolean)(name) : false;
  };

  const readCallbacks = (): TimerCallbacks => {
    const p = props();
    const pick = <T>(name: string): T | undefined => {
      const value = p[name];
      return typeof value === "function" ? (value as T) : undefined;
    };
    return {
      onTick: pick<(d: TimerTickChange) => void>("onTick"),
      onComplete: pick<() => void>("onComplete"),
    };
  };

  /** The scalars the assigns read, synced from scope. */
  const readScalars = (): Pick<TimerContext, "startMs" | "targetMs" | "countdown" | "interval"> => {
    const p = props();
    const interval = p["interval"];
    return {
      startMs: parseMs(p["startMs"]) ?? 0,
      targetMs: parseMs(p["targetMs"]) ?? null,
      countdown: p["countdown"] === true,
      // A mid-life write of zero or less is not worth a throw inside an
      // effect: the clock simply runs at its fastest.
      interval: typeof interval === "number" && interval > 0 ? Math.trunc(interval) : 1000,
    };
  };

  const ensureService = (): Service<TimerContext, TimerEvent> => {
    if (service) return service;
    const p = props();
    const startMs = parseMs(p["startMs"]);
    const targetMs = parseMs(p["targetMs"]);
    const countdown = p["countdown"] === true;
    const rawInterval = p["interval"];
    // A non-numeric write has no meaning; every other value is validated
    // verbatim, so a zero refuses to build rather than silently defaulting.
    const interval = typeof rawInterval === "number" ? Math.trunc(rawInterval) : 1000;
    validateProps(startMs, targetMs, countdown, interval);
    // The clock's epoch is the service's birth: an `autoStart` run's first
    // tick is measured from here, since no START send precedes it.
    lastMoveAt = Date.now();
    service = owner.run(() => {
      const svc = interpret(machine).start(p["autoStart"] === true ? "running" : "idle");
      Object.assign(svc.state.context, {
        startMs: startMs ?? 0,
        targetMs: targetMs ?? null,
        countdown,
        interval,
      });
      svc.state.context.currentMs = startMs ?? 0;
      return svc;
    });
    return service;
  };

  const send = (event: TimerEvent): void => {
    const svc = ensureService();
    // The scalars are re-read on every send so an assign never reads a stale
    // one, and the delta's epoch is the send that just started.
    Object.assign(svc.state.context, readScalars());
    lastMoveAt = Date.now();
    const before = svc.state.value;
    svc.send(event);
    const after = svc.state.context;
    // A tick only counts while running — a stray one on a paused or finished
    // clock is not Zag's `invokeOnTick`, which sits on the running TICK
    // transition.
    if (event.type === "TICK" && before === "running") {
      const callbacks = readCallbacks();
      const time = msToTime(after.currentMs);
      callbacks.onTick?.({ value: after.currentMs, time, formattedTime: formatTime(time) });
      // Only a completing tick leaves `running` for `idle`: a pause goes to
      // `paused`, a reset stays or goes home without ending the run.
      if (svc.state.value === "idle") callbacks.onComplete?.();
    }
    tick(tick() + 1);
    machineTick(machineTick() + 1);
  };

  /** The service surface the connect reads. Built once: the connect lives as
   * long as the bridge does, so this is the stable accessor it caches
   * against. */
  const serviceApi: TimerService = {
    send: send as (event: { type: string } & Record<string, unknown>) => void,
    get context() {
      return ensureService().state.context;
    },
    get state() {
      return ensureService().state;
    },
    elapsedSinceMove: (): number => Date.now() - lastMoveAt,
  };

  const readConnectProps: ReadTimerProps = (): TimerConnectProps => ({
    interval: ensureService().state.context.interval,
  });

  /**
   * Zag's `watch` on `startMs`, the authored `currentMs`, and the scalar
   * sync, in one owned effect: it reads the live prop signals, so a host
   * write moves the machine without waiting for a machine event.
   *
   * It writes no tick of its own that it also reads: the prop signals are
   * its only dependencies, so a later send never re-runs it and re-imposes
   * the authored value over the machine's own move.
   */
  let lastStartMs = ensureService().state.context.startMs;
  owner.run(() =>
    effect(() => {
      const svc = ensureService();
      let moved = false;
      const next = readScalars();
      if (svc.state.context.startMs !== next.startMs) {
        svc.state.context.startMs = next.startMs;
        moved = true;
      }
      if (svc.state.context.targetMs !== next.targetMs) {
        svc.state.context.targetMs = next.targetMs;
        moved = true;
      }
      if (svc.state.context.countdown !== next.countdown) {
        svc.state.context.countdown = next.countdown;
        moved = true;
      }
      if (svc.state.context.interval !== next.interval) {
        svc.state.context.interval = next.interval;
        moved = true;
      }
      // A new startMs is a new run: Zag restarts on the change, and the
      // capture is taken before the send because the fork's send is
      // synchronous.
      if (next.startMs !== lastStartMs) {
        lastStartMs = next.startMs;
        untrack(() => svc.send({ type: "RESTART" }));
        moved = true;
      }
      if (authored("currentMs")) {
        const outer = parseMs(props()["currentMs"]) ?? 0;
        if (svc.state.context.currentMs !== outer) {
          untrack(() => svc.send({ type: "CURRENT_MS.SET", currentMs: outer }));
          moved = true;
        }
      }
      if (moved) {
        tick(tick() + 1);
        machineTick(machineTick() + 1);
      }
    }),
  );

  /** One connect per element, not one per machine move: its bags are cached
   * against machine state. */
  let timerConnect: TimerApi | undefined;
  const ensureConnect = (): TimerApi => {
    timerConnect ??= connectRobotTimer(serviceApi, readConnectProps, id);
    return timerConnect;
  };

  /** The api is read on every machine move, so this depends on the tick and
   * hands out the same connect each time. */
  const connected = computed(() => {
    tick();
    return ensureConnect();
  });

  const api = new Proxy({} as TimerApi, {
    get: (_target, key) => Reflect.get(connected(), key),
    has: (_target, key) => Reflect.has(connected(), key),
    ownKeys: () => Reflect.ownKeys(connected()),
    getOwnPropertyDescriptor: (_target, key) => {
      const descriptor = Reflect.getOwnPropertyDescriptor(connected(), key);
      return descriptor && { ...descriptor, configurable: true };
    },
  });

  return {
    api,
    dispose: () => {
      service?.stop();
      owner.dispose();
    },
  };
}
