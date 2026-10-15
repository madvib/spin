import { computed, effect, machineTick, scope, signal, untrack } from "@spin/runtime";
import { createMachine, interpret, type Service } from "@spin/runtime/fsm";
import {
  connectRobotTour,
  type TourApi,
  type TourConnectProps,
  type TourStepRecord,
} from "./tour.connect.ts";
import {
  config,
  implementations,
  type TourContext,
  type TourDismissChange,
  type TourEvent,
  type TourStepChange,
} from "./tour.machine.ts";

export type { TourDismissChange, TourStepChange, TourStepRecord };

/** An authored-prop predicate: a coerced default is never a host write. */
const authored = (props: () => Record<string, unknown>, name: string): boolean => {
  const predicate = props()["@@authored"];
  return typeof predicate === "function" ? (predicate as (n: string) => boolean)(name) : false;
};

/** The JSON transport for the step collection. */
const parseSteps = (raw: unknown): readonly TourStepRecord[] | null => {
  if (typeof raw !== "string" || raw.length === 0) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed)) return null;
  const steps: TourStepRecord[] = [];
  for (const entry of parsed) {
    if (typeof entry !== "object" || entry === null) continue;
    const bag = entry as Record<string, unknown>;
    const id = bag["id"];
    const target = bag["target"];
    const title = bag["title"];
    const description = bag["description"];
    if (typeof id !== "string" || typeof target !== "string") continue;
    steps.push({
      id,
      target,
      title: typeof title === "string" ? title : "",
      description: typeof description === "string" ? description : "",
    });
  }
  return steps;
};

/**
 * The tour bridge: scope values in, machine state out.
 *
 * Four jobs. Sync the step collection and the scalars the assigns read,
 * alternate the controlled `step`, publish the connect api through the
 * live-view proxy, and report the four channels (start, step-change,
 * dismiss with its reason, complete) from one funnel after every send —
 * the fork's send is synchronous, so the event name and the before-state
 * are the only honest diff.
 */
export function createTourBridge(
  props: () => Record<string, unknown>,
  root: () => Element,
  id: string,
): { readonly api: TourApi; dispose(): void } {
  void root;
  const owner = scope();
  const tick = signal(0);
  const machine = createMachine<TourContext, TourEvent>(config, implementations);

  let service: Service<TourContext, TourEvent> | undefined;

  const ensureService = (): Service<TourContext, TourEvent> => {
    if (service !== undefined) return service;
    const p = props();
    service = owner.run(() => {
      const svc = interpret(machine).start();
      const steps = parseSteps(p["steps"]);
      if (steps !== null) svc.state.context.steps = steps;
      const seeded = parseSteps(p["defaultSteps"]);
      if (steps === null && seeded !== null) svc.state.context.steps = seeded;
      const step = p["step"];
      if (typeof step === "number" && step >= 0) {
        svc.send({ type: "STEP.SET", step });
      }
      return svc;
    });
    return service;
  };

  const readConnectProps = (): TourConnectProps => {
    const p = props();
    const label = p["label"];
    return {
      label: typeof label === "string" ? label : "",
      spotlightPadding: typeof p["spotlightPadding"] === "number" ? p["spotlightPadding"] : 8,
      disabled: p["disabled"] === true,
    };
  };

  function send(event: TourEvent): void {
    const svc = ensureService();
    const beforeState = svc.state.value;
    const beforeStep = svc.state.context.step;
    svc.send(event);
    const after = svc.state.context;
    const afterState = svc.state.value;
    const running = (name: string): boolean => name === "resolving" || name === "scrolling" || name === "active";
    if (running(afterState) !== running(beforeState)) {
      if (!running(afterState)) {
        // The run ended: the event that ended it names the reason.
        (props()["onDismiss"] as ((d: TourDismissChange) => void) | undefined)?.({
          reason: event.type === "SKIP"
            ? "skip"
            : event.type === "TARGET.NOT_FOUND"
            ? "not-found"
            : beforeState === "active" && beforeStep === after.steps.length - 1 && event.type === "DISMISS"
            ? "complete"
            : "dismiss",
          step: beforeStep,
        });
        if (beforeState === "active" && beforeStep === after.steps.length - 1 && event.type === "DISMISS") {
          (props()["onComplete"] as (() => void) | undefined)?.();
        }
      } else {
        (props()["onStart"] as ((d: { step: number }) => void) | undefined)?.({ step: after.step });
      }
    }
    // A real step move only: the closing reset (step -1) reports through
    // dismiss/complete, and reporting it here would overwrite that reason
    // with an empty step id.
    if (after.step !== beforeStep && after.step >= 0) {
      (props()["onStepChange"] as ((d: TourStepChange) => void) | undefined)?.({
        step: after.step,
        stepId: after.steps[after.step]?.id ?? "",
      });
    }
    tick(tick() + 1);
    machineTick(machineTick() + 1);
  }

  ensureService();

  /** One connect per element, not one per machine move. */
  let tourConnect: TourApi | undefined;
  const ensureConnect = (): TourApi => {
    tourConnect ??= connectRobotTour(
      {
        send,
        get context(): TourContext {
          return ensureService().state.context;
        },
        get state(): string {
          return ensureService().state.value;
        },
      },
      readConnectProps,
      id,
    );
    return tourConnect;
  };

  let lastStep: number | undefined = undefined;

  owner.run(() =>
    effect(() => {
      const svc = ensureService();
      const p = props();
      const steps = parseSteps(p["steps"]) ?? parseSteps(p["defaultSteps"]);
      if (steps !== null && steps.map((entry) => entry.id).join(",") !== svc.state.context.steps.map((e) => e.id).join(",")) {
        svc.state.context.steps = steps;
      }
      if (authored(props, "step")) {
        const outer = p["step"];
        const inner = svc.state.context.step;
        if (typeof outer === "number" && lastStep !== outer && outer !== inner) {
          lastStep = outer;
          untrack(() => send({ type: "STEP.SET", step: outer }));
        }
      }
    }),
  );

  const connected = computed(() => {
    tick();
    return ensureConnect();
  });

  const api = new Proxy({} as TourApi, {
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
