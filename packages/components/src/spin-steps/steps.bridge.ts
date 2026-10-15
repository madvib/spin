import { computed, effect, machineTick, scope, signal, untrack } from "@spin/runtime";
import { createMachine, interpret, type Service } from "@spin/runtime/fsm";
import {
  config,
  implementations,
  type StepsContext,
  type StepsEvent,
  type StepsInvalid,
  type StepsStepChange,
} from "./steps.machine.ts";
import {
  connectSteps,
  type StepsApi,
  type StepsConnectProps,
  type StepsService,
} from "./steps.connect.ts";

/**
 * The steps bridge: scope values in, machine state out.
 *
 * Seed the step from `defaultStep`; alternate the one authored channel
 * (`step`) against a remembered shadow. The validators ride each
 * navigation event (functions cannot cross the scope channel, so the
 * machine's guards read them off the event the bridge sends). Report what
 * moved through `step-change` (every accepted move), `step-complete` (a
 * move that lands on count) and `step-invalid` (a refused forward move).
 * The callbacks live on the props surface — the def maps them to
 * CustomEvents.
 */

export interface StepsComplete {
  readonly step: number;
}

export interface StepsCallbacks {
  readonly onStepChange: ((details: StepsStepChange) => void) | undefined;
  readonly onStepComplete: ((details: StepsComplete) => void) | undefined;
  readonly onStepInvalid: ((details: StepsInvalid) => void) | undefined;
}

type Validator = (index: number) => boolean;

/** Titles travel the prop channel as JSON text (see the slider bridge:
 * the grammar coerces `= []` to `["[]"]`). */
function parseTitles(raw: unknown): readonly string[] {
  const list: unknown = typeof raw === "string"
    ? ((): unknown => {
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    })()
    : raw;
  if (!Array.isArray(list)) return [];
  return list.filter((item): item is string => typeof item === "string");
}

const numProp = (raw: unknown): number | null =>
  typeof raw === "number" && Number.isFinite(raw) ? raw : null;

export function createStepsBridge(
  props: () => Record<string, unknown>,
  _root: () => Element,
  id: string,
): { readonly api: StepsApi; dispose(): void } {
  const owner = scope();
  const tick = signal(0);
  // The fork's `config.context` is ONE object, and its interpreter starts on
  // it without copying: every steps on the page would otherwise share one
  // index.
  const machine = createMachine<StepsContext, StepsEvent>(
    { ...config, context: { ...config.context, lastInvalid: null } },
    implementations,
  );

  let service: Service<StepsContext, StepsEvent> | undefined;

  const authored = (name: string): boolean => {
    const predicate = props()["@@authored"];
    return typeof predicate === "function" ? (predicate as (n: string) => boolean)(name) : false;
  };

  const readCallbacks = (): StepsCallbacks => {
    const p = props();
    const pick = <T>(name: string): T | undefined => {
      const value = p[name];
      return typeof value === "function" ? (value as T) : undefined;
    };
    return {
      onStepChange: pick<(d: StepsStepChange) => void>("onStepChange"),
      onStepComplete: pick<(d: StepsComplete) => void>("onStepComplete"),
      onStepInvalid: pick<(d: StepsInvalid) => void>("onStepInvalid"),
    };
  };

  const readValidators = (): { valid: Validator | undefined; skippable: Validator | undefined } => {
    const p = props();
    const valid = p["isStepValid"];
    const skippable = p["isStepSkippable"];
    return {
      valid: typeof valid === "function" ? (valid as Validator) : undefined,
      skippable: typeof skippable === "function" ? (skippable as Validator) : undefined,
    };
  };

  const readConnectProps = (): StepsConnectProps => {
    const p = props();
    return {
      dir: p["dir"] === "rtl" ? "rtl" : "ltr",
      orientation: p["orientation"] === "vertical" ? "vertical" : "horizontal",
      linear: p["linear"] === true,
      label: typeof p["label"] === "string" ? p["label"] : "",
      titles: parseTitles(p["titles"]),
    };
  };

  const ensureService = (): Service<StepsContext, StepsEvent> => {
    if (service) return service;
    const p = props();
    const count = Math.max(1, Math.floor(numProp(p["count"]) ?? 1));
    const seeded = authored("step") ? numProp(p["step"]) : numProp(p["defaultStep"]);
    service = owner.run(() => {
      const svc = interpret(machine).start("idle");
      Object.assign(svc.state.context, {
        count,
        step: Math.min(count, Math.max(0, seeded ?? 0)),
      });
      return svc;
    });
    return service;
  };

  /** What the step channel last imposed, seeded from the same place the
   * machine was, so a host that authors the seeded value writes nothing. */
  let lastStep: number = ensureService().state.context.step;
  let lastInvalid = 0;

  let stepsConnect: StepsApi | undefined;
  const ensureConnect = (): StepsApi => {
    stepsConnect ??= connectSteps(serviceApi, readConnectProps, id);
    return stepsConnect;
  };

  /**
   * Report what moved. The cursors advance only after the callbacks: the
   * fork's send is synchronous, so a post-send check would already see the
   * new value.
   */
  const notify = (): void => {
    const after = ensureService().state.context;
    const callbacks = readCallbacks();
    if (lastStep !== after.step) {
      lastStep = after.step;
      callbacks.onStepChange?.({ step: after.step });
      if (after.step === after.count) callbacks.onStepComplete?.({ step: after.step });
    }
    if (lastInvalid !== after.invalidAttempts && after.lastInvalid !== null) {
      lastInvalid = after.invalidAttempts;
      callbacks.onStepInvalid?.({
        step: after.step,
        action: after.lastInvalid.action,
        targetStep: after.lastInvalid.targetStep,
      });
    }
  };

  /** Navigation events carry the host validators: functions cannot cross
   * the scope channel, so the machine's guards read them off the event. */
  const navigating = (
    event: StepsEvent,
  ): StepsEvent & Record<string, unknown> => {
    if (event.type !== "STEP.SET" && event.type !== "STEP.NEXT") return event;
    const { valid, skippable } = readValidators();
    return {
      ...event,
      ...(valid !== undefined ? { valid } : {}),
      ...(skippable !== undefined ? { skippable } : {}),
    };
  };

  const send = (event: StepsEvent): void => {
    const svc = ensureService();
    const count = Math.max(1, Math.floor(numProp(props()["count"]) ?? 1));
    if (svc.state.context.count !== count) svc.state.context.count = count;
    svc.send(navigating(event));
    notify();
    tick(tick() + 1);
    machineTick(machineTick() + 1);
  };

  /** The service surface the connect reads. Built once: the connect lives as
   * long as the bridge does, so this is the stable accessor it caches
   * against. */
  const serviceApi: StepsService = {
    send: send as (event: { type: string } & Record<string, unknown>) => void,
    get context() {
      return ensureService().state.context;
    },
    get state() {
      return ensureService().state.value;
    },
  };

  /**
   * Controlled alternation in one owned effect: it reads the live prop
   * signals, so a host write moves the machine without waiting for a
   * machine event.
   *
   * It writes no tick of its own: `svc.send` bumps the machine tick, which
   * is what wakes the bindings, and a tick read here would re-run the
   * effect on every later move and re-impose the authored props over it.
   */
  owner.run(() =>
    effect(() => {
      const svc = ensureService();
      let moved = false;
      if (authored("step")) {
        const outer = numProp(props()["step"]);
        if (outer !== null && lastStep !== outer) {
          untrack(() => svc.send(navigating({ type: "STEP.SET", value: outer })));
          moved = true;
        }
      }
      if (moved) notify();
    }),
  );

  /** The api is read on every machine move, so this depends on the tick and
   * hands out the same connect each time. */
  const connected = computed(() => {
    tick();
    return ensureConnect();
  });

  const api = new Proxy({} as StepsApi, {
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
