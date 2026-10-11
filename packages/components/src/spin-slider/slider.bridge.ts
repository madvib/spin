import { computed, effect, machineTick, scope, signal } from "@spin/runtime";
import { createMachine, interpret, type FsmService } from "@spin/runtime/fsm";
import {
  connectRobotSlider,
  type SliderFsmApi,
  type SliderFsmConnectProps,
} from "./slider.connect.ts";
import {
  COMMITTING_EVENTS,
  config,
  implementations,
  normalizeValues,
  type SliderContext,
  type SliderEvent,
  type SliderFocusChange,
  type SliderValueChange,
} from "./slider.machine.ts";

/** JSON transport for shapes the scope grammar cannot type: the thumb box
 * and the value array. Both are validated here, never trusted at the read. */
const parseSize = (raw: unknown): { width: number; height: number } | null => {
  if (raw === null || typeof raw !== "object") return null;
  const size = raw as { width?: unknown; height?: unknown };
  if (typeof size.width !== "number" || typeof size.height !== "number") return null;
  if (!Number.isFinite(size.width) || !Number.isFinite(size.height)) return null;
  return { width: size.width, height: size.height };
};

const parseSizeFromProp = (raw: unknown): { width: number; height: number } | null => {
  if (typeof raw !== "string" || raw.length === 0) return null;
  try {
    return parseSize(JSON.parse(raw));
  } catch {
    return null;
  }
};

const parseNumbers = (raw: unknown): number[] | null => {
  let parsed: unknown = raw;
  if (typeof raw === "string") {
    if (raw.length === 0) return null;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!Array.isArray(parsed)) return null;
  const values: number[] = [];
  for (const entry of parsed) {
    if (typeof entry !== "number" || !Number.isFinite(entry)) return null;
    values.push(entry);
  }
  return values;
};

const readProps = (
  props: Record<string, unknown>,
): Pick<SliderContext, "min" | "max" | "step" | "minStepsBetweenThumbs" | "thumbCollisionBehavior"> => {
  const behavior = props["thumbCollisionBehavior"];
  return {
    min: typeof props["min"] === "number" ? props["min"] : 0,
    max: typeof props["max"] === "number" ? props["max"] : 100,
    step: typeof props["step"] === "number" && props["step"] > 0 ? props["step"] : 1,
    minStepsBetweenThumbs: typeof props["minStepsBetweenThumbs"] === "number"
      ? props["minStepsBetweenThumbs"]
      : 0,
    thumbCollisionBehavior: behavior === "push" || behavior === "swap" ? behavior : "none",
  };
};

const connectProps = (
  props: Record<string, unknown>,
): SliderFsmConnectProps => {
  const step = typeof props["step"] === "number" && props["step"] > 0 ? props["step"] : 1;
  const largeStep = typeof props["largeStep"] === "number" && props["largeStep"] > 0
    ? props["largeStep"]
    : 10 * step;
  const orientation = props["orientation"] === "vertical" ? "vertical" : "horizontal";
  const thumbAlignment = props["thumbAlignment"] === "center" ? "center" : "contain";
  const origin = props["origin"] === "center" || props["origin"] === "end" ? props["origin"] : "start";
  const name = typeof props["name"] === "string" && props["name"].length > 0 ? props["name"] : undefined;
  return {
    orientation,
    thumbAlignment,
    origin,
    disabled: props["disabled"] === true,
    largeStep,
    name,
    thumbSize: parseSizeFromProp(props["thumbSize"]),
    markers: parseNumbers(props["markers"]) ?? [],
  };
};

/** The authored-prop predicate: a coerced default is never a host write. */
const authored = (props: () => Record<string, unknown>, name: string): boolean => {
  const predicate = props()["@@authored"];
  return typeof predicate === "function" ? (predicate as (n: string) => boolean)(name) : false;
};

/**
 * The slider bridge: scope values in, machine state out. Three jobs, as
 * every bridge: seed from `defaultValue`, sync the scalars the assigns read,
 * and publish the connect api through the live-view proxy. The controlled
 * `value` alternates through the authored-prop predicate, so a host write
 * wins immediately and the coerced default never does.
 */
export function createSliderFsmBridge(
  props: () => Record<string, unknown>,
  root: () => Element,
  id: string,
): { readonly api: SliderFsmApi; dispose(): void } {
  const owner = scope();
  const tick = signal(0);
  const machine = createMachine<SliderContext, SliderEvent>(config, implementations);

  let service: FsmService<SliderContext, SliderEvent> | undefined;

  const ensureService = (): FsmService<SliderContext, SliderEvent> => {
    if (!service) {
      const scalars = readProps(props());
      const seeded = typeof props()["defaultValue"] === "number"
        ? [props()["defaultValue"] as number]
        : [scalars.min];
      service = owner.run(() => {
        const svc = interpret(machine).start();
        // Seed through events, not a write: the fork's initial context IS
        // the config's object until a transition folds a copy, so two
        // sliders on a page would otherwise share one context until their
        // first interaction.
        svc.send({ type: "SET_VALUE", value: seeded });
        Object.assign(svc.state.context, scalars);
        svc.send({
          type: "SET_VALUE",
          value: normalizeValues(
            seeded,
            scalars.min,
            scalars.max,
            scalars.step,
            scalars.minStepsBetweenThumbs,
          ),
        });
        return svc;
      });
    }
    return service;
  };

  /** The controlled value, when the host authored one. */
  const controlledValue = (): number[] | null => {
    if (!authored(props, "value")) return null;
    const parsed = parseNumbers(props()["value"]);
    return parsed === null || parsed.length === 0 ? null : parsed;
  };

  const sameValues = (a: readonly number[], b: readonly number[]): boolean =>
    a.length === b.length && a.every((value, index) => value === b[index]);

  /**
   * One context scalar, when the prop moved. Generic over the key so the
   * write stays type-checked across the union.
   */
  const syncScalar = <K extends keyof SliderContext>(
    svc: FsmService<SliderContext, SliderEvent>,
    key: K,
    value: SliderContext[K],
  ): boolean => {
    if (svc.state.context[key] === value) return false;
    svc.state.context[key] = value;
    return true;
  };

  /**
   * Scalar and controlled-value sync, on the live props so a write
   * alternates immediately. A disabled write mid-drag cancels the gesture:
   * the view stops listening, and leaving the machine dragging would strand
   * the next pointer-up as a no-op on a stopped-looking control.
   */
  owner.run(() =>
    effect(() => {
      const svc = ensureService();
      const scalars = readProps(props());
      let moved = false;
      for (const key of ["min", "max", "step", "minStepsBetweenThumbs", "thumbCollisionBehavior"] as const) {
        if (syncScalar(svc, key, scalars[key])) moved = true;
      }
      const next = controlledValue();
      if (next && !sameValues(next, svc.state.context.value)) {
        svc.state.context.value = normalizeValues(
          next,
          scalars.min,
          scalars.max,
          scalars.step,
          scalars.minStepsBetweenThumbs,
        );
        moved = true;
      }
      // A disabled write mid-drag cancels the gesture: the view stops
      // listening, and a machine left dragging would strand the next
      // pointer-up on a control the host means to be inert.
      if (props()["disabled"] === true && svc.state.value === "dragging") {
        svc.send({ type: "POINTER_CANCEL" });
        moved = true;
      }
      if (moved) {
        tick(tick() + 1);
        machineTick(machineTick() + 1);
      }
    }),
  );

  const fireCallbacks = (
    before: { value: number[]; focusedIndex: number },
    event: SliderEvent,
    after: SliderContext,
  ): void => {
    const p = props();
    if (!sameValues(before.value, after.value)) {
      (p["onValueChange"] as ((d: SliderValueChange) => void) | undefined)?.({
        value: after.value,
      });
    }
    if (COMMITTING_EVENTS[event.type] === true) {
      (p["onValueChangeEnd"] as ((d: SliderValueChange) => void) | undefined)?.({
        value: after.value,
      });
    }
    if (before.focusedIndex !== after.focusedIndex) {
      (p["onFocusChange"] as ((d: SliderFocusChange) => void) | undefined)?.({
        focusedIndex: after.focusedIndex,
        value: after.value,
      });
    }
  };

  const send = (event: SliderEvent): void => {
    const svc = ensureService();
    const before = { value: [...svc.state.context.value], focusedIndex: svc.state.context.focusedIndex };
    Object.assign(svc.state.context, readProps(props()));
    const next = controlledValue();
    if (next) svc.state.context.value = next;
    svc.send(event);
    fireCallbacks(before, event, svc.state.context);
    tick(tick() + 1);
    machineTick(machineTick() + 1);
  };

  const connected = computed(() => {
    tick();
    const svc = ensureService();
    const adapted = {
      send: send as (event: { type: string } & Record<string, unknown>) => void,
      get context() {
        return svc.state.context;
      },
      get state() {
        return svc.state;
      },
    };
    return connectRobotSlider(adapted, connectProps(props()), root(), id, send as never);
  });

  // Commands resolve INSIDE the trap: Object.assign onto a live-view proxy
  // is shadowed by its own get trap and the host would call undefined.
  const commands = {
    setValue: (value: readonly number[]): void => send({ type: "SET_VALUE", value: [...value] }),
    focus: (): void => {
      connected().focus();
    },
  };

  const api = new Proxy({} as SliderFsmApi, {
    get: (_target, key) =>
      key in commands
        ? (commands as Record<string | symbol, unknown>)[key]
        : Reflect.get(connected(), key),
    has: (_target, key) => key in commands || Reflect.has(connected(), key),
    ownKeys: () => [...new Set([...Reflect.ownKeys(connected()), ...Object.keys(commands)])],
    getOwnPropertyDescriptor: (_target, key) => {
      if (key in commands) {
        return {
          configurable: true,
          enumerable: true,
          value: (commands as Record<string | symbol, unknown>)[key],
        };
      }
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
