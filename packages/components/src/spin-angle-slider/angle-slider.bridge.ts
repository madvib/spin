import { computed, effect, machineTick, scope, signal, untrack } from "@spin/runtime";
import { createMachine, interpret, type Service } from "@spin/runtime/fsm";
import {
  config,
  implementations,
  type AngleSliderContext,
  type AngleSliderEvent,
  type AngleSliderValueChange,
} from "./angle-slider.machine.ts";
import {
  connectAngleSlider,
  type AngleSliderApi,
  type AngleSliderConnectProps,
  type AngleSliderService,
} from "./angle-slider.connect.ts";

/**
 * The angle-slider bridge: scope values in, machine state out.
 *
 * Seed the value from `defaultValue`; alternate the one authored channel
 * (`value`) against a remembered shadow so a machine drag of its own is
 * never undone by an unrelated prop change. Report what moved through
 * `value-change` (every move) and `value-change-end` (release + keyboard
 * commit). The callbacks live on the props surface — the def maps them to
 * CustomEvents.
 */

export interface AngleSliderValueChangeEnd {
  readonly value: number;
  readonly valueAsDegree: string;
}

export interface AngleSliderCallbacks {
  readonly onValueChange: ((details: AngleSliderValueChange) => void) | undefined;
  readonly onValueChangeEnd: ((details: AngleSliderValueChangeEnd) => void) | undefined;
}

const numProp = (raw: unknown): number | null =>
  typeof raw === "number" && Number.isFinite(raw) ? raw : null;

const textProp = (raw: unknown): string => (typeof raw === "string" ? raw : "");

export function createAngleSliderBridge(
  props: () => Record<string, unknown>,
  _root: () => Element,
  id: string,
): { readonly api: AngleSliderApi; dispose(): void } {
  const owner = scope();
  const tick = signal(0);
  // The fork's `config.context` is ONE object, and its interpreter starts on
  // it without copying: every dial on the page would otherwise share one
  // angle.
  const machine = createMachine<AngleSliderContext, AngleSliderEvent>(
    { ...config, context: { ...config.context } },
    implementations,
  );

  let service: Service<AngleSliderContext, AngleSliderEvent> | undefined;

  const authored = (name: string): boolean => {
    const predicate = props()["@@authored"];
    return typeof predicate === "function" ? (predicate as (n: string) => boolean)(name) : false;
  };

  const readCallbacks = (): AngleSliderCallbacks => {
    const p = props();
    const pick = <T>(name: string): T | undefined => {
      const value = p[name];
      return typeof value === "function" ? (value as T) : undefined;
    };
    return {
      onValueChange: pick<(d: AngleSliderValueChange) => void>("onValueChange"),
      onValueChangeEnd: pick<(d: AngleSliderValueChangeEnd) => void>("onValueChangeEnd"),
    };
  };

  const readContextProps = (): Pick<
    AngleSliderContext,
    "step" | "largeStep" | "dir" | "disabled" | "readOnly" | "invalid"
  > => {
    const p = props();
    const step = numProp(p["step"]) ?? 1;
    return {
      step,
      largeStep: numProp(p["largeStep"]) ?? 10 * step,
      dir: p["dir"] === "rtl" ? "rtl" : "ltr",
      disabled: p["disabled"] === true,
      readOnly: p["readOnly"] === true,
      invalid: p["invalid"] === true,
    };
  };

  const readConnectProps = (): AngleSliderConnectProps => {
    const p = props();
    return {
      disabled: p["disabled"] === true,
      readOnly: p["readOnly"] === true,
      invalid: p["invalid"] === true,
      required: p["required"] === true,
      name: textProp(p["name"]),
      dir: p["dir"] === "rtl" ? "rtl" : "ltr",
      label: textProp(p["label"]),
      ariaLabel: textProp(p["aria-label"]),
    };
  };

  const ensureService = (): Service<AngleSliderContext, AngleSliderEvent> => {
    if (service) return service;
    const p = props();
    const scalars = readContextProps();
    const seeded = numProp(authored("value") ? p["value"] : p["defaultValue"]) ?? 0;
    service = owner.run(() => {
      const svc = interpret(machine).start("idle");
      Object.assign(svc.state.context, scalars, { value: seeded });
      return svc;
    });
    return service;
  };

  /** What the value channel last imposed, seeded from the same place the
   * machine was, so a host that authors the seeded value writes nothing. */
  let lastValue: number = ensureService().state.context.value;

  let dialConnect: AngleSliderApi | undefined;
  const ensureConnect = (): AngleSliderApi => {
    dialConnect ??= connectAngleSlider(serviceApi, readConnectProps, id);
    return dialConnect;
  };

  /**
   * Report what moved. Value-change fires on every value event; change-end
   * fires on release and keyboard commits. The cursor advances only after
   * the callbacks: the fork's send is synchronous, so a post-send check
   * would already see the new value.
   */
  const notify = (kind: "move" | "commit"): void => {
    const after = ensureService().state.context;
    const callbacks = readCallbacks();
    if (lastValue !== after.value) {
      lastValue = after.value;
      callbacks.onValueChange?.({ value: after.value, valueAsDegree: `${after.value}deg` });
      if (kind === "commit") {
        callbacks.onValueChangeEnd?.({ value: after.value, valueAsDegree: `${after.value}deg` });
      }
    } else if (kind === "commit") {
      callbacks.onValueChangeEnd?.({ value: after.value, valueAsDegree: `${after.value}deg` });
    }
  };

  const COMMIT = new Set([
    "DOC.POINTER_UP",
    "THUMB.ARROW_INC",
    "THUMB.ARROW_DEC",
    "THUMB.HOME",
    "THUMB.END",
    "VALUE.SET",
  ]);

  const send = (event: AngleSliderEvent): void => {
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
  const serviceApi: AngleSliderService = {
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
        const outer = numProp(props()["value"]);
        if (outer !== null && lastValue !== outer) {
          untrack(() => svc.send({ type: "VALUE.SET", value: outer }));
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

  const api = new Proxy({} as AngleSliderApi, {
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
