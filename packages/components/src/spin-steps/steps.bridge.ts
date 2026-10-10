import { computed, effect, machineTick, scope, signal, untrack } from "@spin/runtime";
import { createMachine, interpret, type FsmService } from "@spin/runtime/fsm";
import {
  connectRobotSteps,
  type StepsFsmApi,
  type StepsFsmConnectProps,
  type StepsService,
} from "./steps.connect.ts";
import {
  config,
  implementations,
  validateStepIndex,
  type StepsContext,
  type StepsEvent,
  type StepValidity,
} from "./steps.machine.ts";

export interface StepsStepChange {
  readonly step: number;
}

export interface StepsStepInvalid {
  readonly step: number;
  readonly action: "set" | "next";
  readonly targetStep: number | undefined;
}

/**
 * The steps bridge: scope values in, machine state out.
 *
 * Seeds `defaultStep` (rejecting an out-of-range index the way Zag's machine
 * entry does), alternates a controlled `step` from the authored prop only,
 * syncs the scalars the conds read, and reports the three Zag callbacks.
 *
 * A step-change reports only a move the MACHINE made. Zag's bindable onChange
 * fires from `context.set`, never from the controlled channel's own read of
 * the prop, so an authored write is not echoed back to the host that wrote
 * it — that is what routes the alternation through an unguarded `STEP.SYNC`
 * instead of the api's `STEP.SET`.
 *
 * The two behavioral predicates are read live off the root (the scope grammar
 * types no functions) and handed to BOTH readers: the connect's api, which
 * must see a host write the moment it lands, and the context copies the
 * conds read, which a send re-syncs so the guards never see a stale one.
 */

/** An out-of-range int on the prop channel reads as no int. */
const readInt = (raw: unknown, fallback: number): number =>
  typeof raw === "number" && Number.isFinite(raw) ? Math.trunc(raw) : fallback;

const ALWAYS_VALID: StepValidity = (): boolean => true;
const NEVER_SKIPPABLE: StepValidity = (): boolean => false;

/** Captions travel the prop channel as an array or a comma-joined string.
 * The grammar's coercion of an absent `string[] = []` is the single entry
 * `"[]"`, which is not a caption. */
const parseLabels = (raw: unknown): readonly string[] => {
  if (typeof raw === "string") {
    return raw.split(",").map((part) => part.trim()).filter((part) => part.length > 0);
  }
  if (!Array.isArray(raw)) return [];
  const parts = raw.filter((part): part is string => typeof part === "string");
  return parts.length === 1 && parts[0] === "[]" ? [] : parts;
};

/** The scope grammar types no functions, so the two behavioral predicates
 * cross as element properties — the framework writes every host prop as one
 * and this reads it back off the root. Zag's default is `valid` for
 * `isStepValid` and `not skippable` for `isStepSkippable`; the fallbacks are
 * module constants so the effect's diff can tell "the host wrote nothing"
 * from "the host wrote the same answer again". */
const readPredicate = (root: () => Element, name: string, fallback: StepValidity): StepValidity => {
  const value: unknown = Reflect.get(root(), name);
  return typeof value === "function" ? (value as StepValidity) : fallback;
};

export function createStepsFsmBridge(
  props: () => Record<string, unknown>,
  root: () => Element,
  id: string,
): { readonly api: StepsFsmApi; dispose(): void } {
  const owner = scope();
  const tick = signal(0);
  /**
   * A private context object per bridge. The config is a module singleton, so
   * its `context` is one shared object and `interpret` starts every service
   * on it — seeding in place would let one element's seed rewrite every other
   * element's state. The fork's assigns already fork the object on the first
   * send; this covers the seed before it.
   */
  const machine = createMachine<StepsContext, StepsEvent>(
    { ...config, context: { ...config.context } },
    implementations,
  );

  let service: FsmService<StepsContext, StepsEvent> | undefined;

  const authored = (name: string): boolean => {
    const predicate = props()["@@authored"];
    return typeof predicate === "function" ? (predicate as (n: string) => boolean)(name) : false;
  };

  const readCallbacks = (): {
    onStepChange: ((details: StepsStepChange) => void) | undefined;
    onStepComplete: (() => void) | undefined;
    onStepInvalid: ((details: StepsStepInvalid) => void) | undefined;
  } => {
    const p = props();
    const pick = <T>(name: string): T | undefined => {
      const value = p[name];
      return typeof value === "function" ? (value as T) : undefined;
    };
    return {
      onStepChange: pick<(d: StepsStepChange) => void>("onStepChange"),
      onStepComplete: pick<() => void>("onStepComplete"),
      onStepInvalid: pick<(d: StepsStepInvalid) => void>("onStepInvalid"),
    };
  };

  /** The scalars the conds read, synced from scope. */
  const readContextProps = (): Pick<StepsContext, "count" | "isStepValid" | "isStepSkippable"> => ({
    count: readInt(props()["count"], 1),
    isStepValid: readPredicate(root, "isStepValid", ALWAYS_VALID),
    isStepSkippable: readPredicate(root, "isStepSkippable", NEVER_SKIPPABLE),
  });

  const readConnectProps = (): StepsFsmConnectProps => {
    const p = props();
    return {
      count: readInt(p["count"], 1),
      linear: p["linear"] === true,
      orientation: p["orientation"] === "vertical" ? "vertical" : "horizontal",
      labels: parseLabels(p["labels"]),
      isValid: readPredicate(root, "isStepValid", ALWAYS_VALID),
      isSkippable: readPredicate(root, "isStepSkippable", NEVER_SKIPPABLE),
    };
  };

  const ensureService = (): FsmService<StepsContext, StepsEvent> => {
    if (service) return service;
    const p = props();
    const count = readInt(p["count"], 1);
    const seeded = readInt(p["defaultStep"], 0);
    validateStepIndex(count, seeded);
    service = owner.run(() => {
      const svc = interpret(machine).start();
      Object.assign(svc.state.context, readContextProps(), { step: seeded });
      return svc;
    });
    return service;
  };

  /** Zag's bindable onChange: a step-change reports the new value, and a
   * landing on `count` reports the completion. */
  const reportChange = (step: number, count: number): void => {
    const callbacks = readCallbacks();
    callbacks.onStepChange?.({ step });
    if (step === count) callbacks.onStepComplete?.();
  };

  /** The service is created before the effect that alternates it: an effect
   * that instantiates it would re-run the seed on every prop write. */
  let lastStep = ensureService().state.context.step;

  owner.run(() =>
    effect(() => {
      const svc = ensureService();
      let moved = false;
      const next = readContextProps();
      if (svc.state.context.count !== next.count) {
        svc.state.context.count = next.count;
        moved = true;
      }
      if (svc.state.context.isStepValid !== next.isStepValid) {
        svc.state.context.isStepValid = next.isStepValid;
        moved = true;
      }
      if (svc.state.context.isStepSkippable !== next.isStepSkippable) {
        svc.state.context.isStepSkippable = next.isStepSkippable;
        moved = true;
      }
      if (authored("step")) {
        const outer = readInt(props()["step"], 0);
        if (svc.state.context.step !== outer) {
          lastStep = outer;
          untrack(() => svc.send({ type: "STEP.SYNC", value: outer }));
          moved = true;
        }
      }
      if (moved) untrack(() => tick(tick() + 1));
    }),
  );

  const send = (event: StepsEvent): void => {
    const svc = ensureService();
    const before = svc.state.context.step;
    // A send is synchronous, so the machine must see the props as they are
    // now — a host write and a click in the same tick must not disagree.
    Object.assign(svc.state.context, readContextProps());
    svc.send(event);
    const after = svc.state.context;
    if (after.step !== before && after.step !== lastStep) {
      lastStep = after.step;
      reportChange(after.step, after.count);
    }
    if (after.refusal !== null) {
      const action = after.refusal;
      const detail: StepsStepInvalid = {
        step: after.step,
        action,
        targetStep: event.type === "STEP.SET" ? event.value : undefined,
      };
      after.refusal = null;
      readCallbacks().onStepInvalid?.(detail);
    }
    tick(tick() + 1);
    machineTick(machineTick() + 1);
  };

  /** The service surface the connect reads. Built once: the connect lives as
   * long as the bridge does, so this is the stable accessor it caches against. */
  const serviceApi: StepsService = {
    send: send as (event: { type: string } & Record<string, unknown>) => void,
    get context() {
      return ensureService().state.context;
    },
  };

  /** One connect per element, not one per machine move: its bags are cached
   * against machine state. Rebuilding it per move is what made each read hand
   * out fresh handlers. */
  let stepsConnect: StepsFsmApi | undefined;
  const ensureConnect = (): StepsFsmApi => {
    stepsConnect ??= connectRobotSteps(serviceApi, readConnectProps, id);
    return stepsConnect;
  };

  /** The api is read on every machine move, so this depends on the tick and
   * hands out the same connect each time. */
  const connected = computed(() => {
    tick();
    return ensureConnect();
  });

  const api = new Proxy({} as StepsFsmApi, {
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
