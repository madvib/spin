import { computed, effect, machineTick, scope, signal, untrack } from "@spin/runtime";
import { createMachine, interpret, type Service } from "@spin/runtime/fsm";
import {
  config,
  implementations,
  type SliderContext,
  type SliderEvent,
  type SliderFocusChange,
  type SliderValueChange,
  type SliderValueChangeEnd,
  type ThumbCollisionBehavior,
} from "./slider.machine.ts";
import {
  connectSlider,
  type SliderApi,
  type SliderConnectProps,
  type SliderService,
} from "./slider.connect.ts";

/**
 * The slider bridge: scope values in, machine state out.
 *
 * Seed the values from `defaultValue`; alternate the one authored channel
 * (`value`) against a remembered shadow so a machine drag of its own is
 * never undone by an unrelated prop change. Report what moved through
 * `value-change` (every move), `value-change-end` (release + keyboard
 * commit) and `focus-change`. The callbacks live on the props surface —
 * the def maps them to CustomEvents.
 */

export interface SliderCallbacks {
  readonly onValueChange: ((details: SliderValueChange) => void) | undefined;
  readonly onValueChangeEnd: ((details: SliderValueChangeEnd) => void) | undefined;
  readonly onFocusChange: ((details: SliderFocusChange) => void) | undefined;
}

const numProp = (raw: unknown): number | null =>
  typeof raw === "number" && Number.isFinite(raw) ? raw : null;

const textProp = (raw: unknown): string => (typeof raw === "string" ? raw : "");

/** Values travel the prop channel as JSON text: the scope grammar types an
 * array either as `string[]` (whose default coercion produces `["[]"]` for
 * `= []`) or as a JSON string, so both spellings parse. */
const valuesProp = (raw: unknown): number[] | null => {
  if (Array.isArray(raw)) {
    return raw.every((item) => typeof item === "number" && Number.isFinite(item))
      ? [...(raw as number[])]
      : null;
  }
  if (typeof raw !== "string") return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) &&
        parsed.every((item) => typeof item === "number" && Number.isFinite(item))
      ? [...(parsed as number[])]
      : null;
  } catch {
    return null;
  }
};

const sameValues = (a: readonly number[], b: readonly number[]): boolean =>
  a.length === b.length && a.every((value, index) => value === b[index]);

export function createSliderBridge(
  props: () => Record<string, unknown>,
  _root: () => Element,
  id: string,
): { readonly api: SliderApi; dispose(): void } {
  const owner = scope();
  const tick = signal(0);
  // The fork's `config.context` is ONE object, and its interpreter starts on
  // it without copying: every slider on the page would otherwise share one
  // value.
  const machine = createMachine<SliderContext, SliderEvent>(
    { ...config, context: { ...config.context, value: [...config.context.value] } },
    implementations,
  );

  let service: Service<SliderContext, SliderEvent> | undefined;

  const authored = (name: string): boolean => {
    const predicate = props()["@@authored"];
    return typeof predicate === "function" ? (predicate as (n: string) => boolean)(name) : false;
  };

  const readCallbacks = (): SliderCallbacks => {
    const p = props();
    const pick = <T>(name: string): T | undefined => {
      const value = p[name];
      return typeof value === "function" ? (value as T) : undefined;
    };
    return {
      onValueChange: pick<(d: SliderValueChange) => void>("onValueChange"),
      onValueChangeEnd: pick<(d: SliderValueChangeEnd) => void>("onValueChangeEnd"),
      onFocusChange: pick<(d: SliderFocusChange) => void>("onFocusChange"),
    };
  };

  const collisionProp = (raw: unknown): ThumbCollisionBehavior => {
    if (raw === "push" || raw === "swap") return raw;
    return "none";
  };

  const readContextProps = (): Pick<
    SliderContext,
    | "min"
    | "max"
    | "step"
    | "largeStep"
    | "minStepsBetweenThumbs"
    | "origin"
    | "orientation"
    | "thumbCollisionBehavior"
    | "disabled"
    | "readOnly"
    | "invalid"
  > => {
    const p = props();
    const min = numProp(p["min"]) ?? 0;
    const max = numProp(p["max"]) ?? 100;
    const step = numProp(p["step"]) ?? 1;
    const orientation = p["orientation"] === "vertical" ? "vertical" : "horizontal";
    const origin = p["origin"];
    return {
      min,
      max,
      step,
      largeStep: numProp(p["largeStep"]) ?? 10 * step,
      minStepsBetweenThumbs: Math.max(0, Math.floor(numProp(p["minStepsBetweenThumbs"]) ?? 0)),
      origin: origin === "center" || origin === "end" ? origin : "start",
      orientation,
      thumbCollisionBehavior: collisionProp(p["thumbCollisionBehavior"]),
      disabled: p["disabled"] === true,
      readOnly: p["readOnly"] === true,
      invalid: p["invalid"] === true,
    };
  };

  const readConnectProps = (): SliderConnectProps => {
    const p = props();
    const label = textProp(p["label"]);
    const ariaLabel = textProp(p["aria-label"]);
    const context = ensureService().state.context;
    return {
      disabled: p["disabled"] === true,
      readOnly: p["readOnly"] === true,
      invalid: p["invalid"] === true,
      required: p["required"] === true,
      name: textProp(p["name"]),
      form: textProp(p["form"]),
      dir: p["dir"] === "rtl" ? "rtl" : "ltr",
      orientation: context.orientation,
      label: label.length > 0 ? label : "Slider",
      ariaLabel,
      thumbLabels: [],
      min: context.min,
      max: context.max,
      step: context.step,
      largeStep: context.largeStep,
    };
  };

  const ensureService = (): Service<SliderContext, SliderEvent> => {
    if (service) return service;
    const p = props();
    const scalars = readContextProps();
    const seeded = valuesProp(authored("value") ? p["value"] : p["defaultValue"]) ?? [scalars.min];
    service = owner.run(() => {
      const svc = interpret(machine).start("idle");
      Object.assign(svc.state.context, scalars, { value: seeded });
      return svc;
    });
    return service;
  };

  /** What the value channel last imposed, seeded from the same place the
   * machine was, so a host that authors the seeded value writes nothing. */
  let lastValue: number[] = [...ensureService().state.context.value];
  let lastFocused = -1;

  let sliderConnect: SliderApi | undefined;
  const ensureConnect = (): SliderApi => {
    sliderConnect ??= connectSlider(serviceApi, readConnectProps, id);
    return sliderConnect;
  };

  /**
   * Report what moved. Value-change fires on every value event; change-end
   * fires on release and keyboard commits. The cursors advance only after
   * the callbacks: the fork's send is synchronous, so a post-send check
   * would already see the new value.
   */
  const notify = (kind: "move" | "commit"): void => {
    const after = ensureService().state.context;
    const callbacks = readCallbacks();
    if (!sameValues(lastValue, after.value)) {
      lastValue = [...after.value];
      callbacks.onValueChange?.({ value: [...after.value] });
      if (kind === "commit") callbacks.onValueChangeEnd?.({ value: [...after.value] });
    } else if (kind === "commit" && after.value.length > 0) {
      // A keyboard commit that hits a bound still ends the gesture: Zag
      // fires change-end on every commit gesture, not only on movement.
      callbacks.onValueChangeEnd?.({ value: [...after.value] });
    }
    if (lastFocused !== after.focusedIndex) {
      lastFocused = after.focusedIndex;
      callbacks.onFocusChange?.({ focusedIndex: after.focusedIndex, value: [...after.value] });
    }
  };

  const COMMIT = new Set(["POINTER_UP", "ARROW_INC", "ARROW_DEC", "HOME", "END", "INCREMENT", "DECREMENT", "SET_VALUE"]);

  const send = (event: SliderEvent): void => {
    const svc = ensureService();
    // The scalars are re-read on every send so an assign or a cond never
    // reads a stale one.
    Object.assign(svc.state.context, readContextProps());
    svc.send(event);
    notify(COMMIT.has(event.type) ? "commit" : "move");
    tick(tick() + 1);
    machineTick(machineTick() + 1);
  };

  /** The service surface the connect reads. Built once: the connect lives as
   * long as the bridge does, so this is the stable accessor it caches
   * against. */
  const serviceApi: SliderService = {
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
      if (authored("value")) {
        const outer = valuesProp(props()["value"]);
        if (outer !== null && !sameValues(lastValue, outer)) {
          untrack(() => svc.send({ type: "SET_VALUE", value: outer }));
          moved = true;
        }
      }
      if (moved) notify("commit");
    }),
  );

  /** The api is read on every machine move, so this depends on the tick and
   * hands out the same connect each time. */
  const connected = computed(() => {
    tick();
    return ensureConnect();
  });

  const api = new Proxy({} as SliderApi, {
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
