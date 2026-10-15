import { computed, effect, machineTick, scope, signal, untrack } from "@spin/runtime";
import { createMachine, interpret, type Service } from "@spin/runtime/fsm";
import {
  config,
  implementations,
  isOpenPhase,
  valueAsString,
  type ColorFormat,
  type ColorPickerContext,
  type ColorPickerEvent,
} from "./color-picker.machine.ts";
import {
  connectRobotColorPicker,
  type ColorPickerApi,
  type ColorPickerConnectProps,
  type ColorPickerService,
  type ReadColorPickerProps,
} from "./color-picker.connect.ts";

export interface ColorPickerValueChange {
  readonly value: string;
  readonly format: ColorFormat;
}

export interface ColorPickerOpenChange {
  readonly open: boolean;
}

export interface ColorPickerFormatChange {
  readonly format: ColorFormat;
}

export interface ColorPickerCallbacks {
  readonly onValueChange: ((details: ColorPickerValueChange) => void) | undefined;
  readonly onValueChangeEnd: ((details: ColorPickerValueChange) => void) | undefined;
  readonly onOpenChange: ((details: ColorPickerOpenChange) => void) | undefined;
  readonly onFormatChange: ((details: ColorPickerFormatChange) => void) | undefined;
}

const textProp = (raw: unknown): string => (typeof raw === "string" ? raw : "");

const FORMATS: readonly ColorFormat[] = ["hex", "hexa", "rgb", "rgba", "hsl", "hsla", "hsb", "hsba"];

const parseFormat = (raw: unknown): ColorFormat | null =>
  typeof raw === "string" && (FORMATS as readonly string[]).includes(raw) ? (raw as ColorFormat) : null;

const sameValue = (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase();

/**
 * The color-picker bridge: scope values in, machine state out.
 *
 * Four jobs. Seed from `defaultValue`/`value` and `defaultFormat`/`format`;
 * alternate the two authored channels (`value`, `format`); report what moved
 * (change on every move, change-end on drag release and committed inputs);
 * and publish the connect api through the live-view proxy.
 *
 * The controlled channel is the authored-prop predicate (`@@authored`) — a
 * coerced default is never a write. Each channel remembers what it last
 * imposed rather than comparing against the context, so a machine move of
 * its own is never undone by an unrelated prop change.
 */
export function createColorPickerBridge(
  props: () => Record<string, unknown>,
  _root: () => Element,
  id: string,
): { readonly api: ColorPickerApi; dispose(): void } {
  const owner = scope();
  const tick = signal(0);
  // The fork's `config.context` is ONE object, and its interpreter starts on
  // it without copying: every picker on the page would otherwise share a
  // single color.
  const machine = createMachine<ColorPickerContext, ColorPickerEvent>(
    { ...config, context: { ...config.context } },
    implementations,
  );

  let service: Service<ColorPickerContext, ColorPickerEvent> | undefined;

  const authored = (name: string): boolean => {
    const predicate = props()["@@authored"];
    return typeof predicate === "function" ? (predicate as (n: string) => boolean)(name) : false;
  };

  const readCallbacks = (): ColorPickerCallbacks => {
    const p = props();
    const pick = <T>(name: string): T | undefined => {
      const value = p[name];
      return typeof value === "function" ? (value as T) : undefined;
    };
    return {
      onValueChange: pick<(d: ColorPickerValueChange) => void>("onValueChange"),
      onValueChangeEnd: pick<(d: ColorPickerValueChange) => void>("onValueChangeEnd"),
      onOpenChange: pick<(d: ColorPickerOpenChange) => void>("onOpenChange"),
      onFormatChange: pick<(d: ColorPickerFormatChange) => void>("onFormatChange"),
    };
  };

  const readContextProps = (): Pick<
    ColorPickerContext,
    "disabled" | "readOnly" | "closeOnSelect" | "inline" | "areaX" | "areaY"
  > => {
    const p = props();
    return {
      disabled: p["disabled"] === true,
      readOnly: p["readOnly"] === true,
      closeOnSelect: p["closeOnSelect"] === true,
      inline: p["inline"] === true,
      areaX: "saturation" as ColorPickerContext["areaX"],
      areaY: "brightness" as ColorPickerContext["areaY"],
    };
  };

  const readConnectProps: ReadColorPickerProps = (): ColorPickerConnectProps => {
    const p = props();
    return {
      disabled: p["disabled"] === true,
      readOnly: p["readOnly"] === true,
      invalid: p["invalid"] === true,
      required: p["required"] === true,
      inline: p["inline"] === true,
      dir: p["dir"] === "rtl" ? "rtl" : "ltr",
      name: textProp(p["name"]),
      swatches: Array.isArray(p["swatches"])
        ? p["swatches"].filter((v): v is string => typeof v === "string")
        : [],
    };
  };

  const parseValue = (raw: unknown): string | null =>
    typeof raw === "string" && raw.length > 0 ? raw : null;

  const ensureService = (): Service<ColorPickerContext, ColorPickerEvent> => {
    if (service) return service;
    const p = props();
    const scalars = readContextProps();
    const format = parseFormat(authored("format") ? p["format"] : p["defaultFormat"]) ?? "hex";
    const seed = parseValue(authored("value") ? p["value"] : p["defaultValue"]) ?? "#000000";
    service = owner.run(() => {
      const svc = interpret(machine).start(
        scalars.inline || p["open"] === true || p["defaultOpen"] === true ? "active" : "idle",
      );
      Object.assign(svc.state.context, scalars, { value: seed, format });
      // Normalize the seed through the machine's own parser, so the context
      // always holds a serialized color rather than the host's raw text.
      svc.send({ type: "VALUE.SET", value: seed });
      svc.send({ type: "FORMAT.SET", format });
      return svc;
    });
    return service;
  };

  /** What each controlled channel last imposed, seeded from the same place
   * the machine was, so a host that authors the seeded value writes nothing. */
  const initial = ensureService().state.context;
  let lastValue = initial.value;
  let lastFormat = initial.format;
  let lastOpen = isOpenPhase(ensureService().state.value, initial.inline);

  let pickerConnect: ColorPickerApi | undefined;
  const ensureConnect = (): ColorPickerApi => {
    pickerConnect ??= connectRobotColorPicker(serviceApi, readConnectProps, id);
    return pickerConnect;
  };

  /** Zag's `onValueChange`: every move, with the serialized color. */
  const notify = (): void => {
    const after = ensureService().state.context;
    const callbacks = readCallbacks();
    if (!sameValue(lastValue, after.value)) {
      lastValue = after.value;
      callbacks.onValueChange?.({ value: after.value, format: after.format });
    }
    if (lastFormat !== after.format) {
      lastFormat = after.format;
      callbacks.onFormatChange?.({ format: after.format });
    }
  };

  /** Zag's `onValueChangeEnd`: drag release and committed inputs only. */
  const notifyEnd = (event: ColorPickerEvent): void => {
    if (
      event.type !== "AREA.POINTER_UP" &&
      event.type !== "CHANNEL_SLIDER.POINTER_UP" &&
      event.type !== "CHANNEL_INPUT.BLUR" &&
      event.type !== "SWATCH_TRIGGER.CLICK"
    ) return;
    const after = ensureService().state.context;
    readCallbacks().onValueChangeEnd?.({ value: after.value, format: after.format });
  };

  /** Zag's `invokeOnOpen`/`invokeOnClose`: once per change. */
  const notifyOpen = (): void => {
    const svc = ensureService();
    const openNow = isOpenPhase(svc.state.value, svc.state.context.inline);
    if (openNow === lastOpen) return;
    lastOpen = openNow;
    readCallbacks().onOpenChange?.({ open: openNow });
  };

  const send = (event: ColorPickerEvent): void => {
    const svc = ensureService();
    Object.assign(svc.state.context, readContextProps());
    svc.send(event);
    notify();
    notifyEnd(event);
    notifyOpen();
    tick(tick() + 1);
    machineTick(machineTick() + 1);
  };

  /** The service surface the connect reads. Built once: the connect lives as
   * long as the bridge does, so this is the stable accessor it caches
   * against. */
  const serviceApi: ColorPickerService = {
    send: send as (event: { type: string } & Record<string, unknown>) => void,
    get context() {
      return ensureService().state.context;
    },
    get phase() {
      return ensureService().state.value;
    },
  };

  /**
   * Controlled alternation plus the scalar sync, in one owned effect: it
   * reads the live prop signals, so a host write — property or attribute —
   * moves the machine without waiting for a machine event.
   *
   * It writes no tick of its own: `svc.send` bumps the machine tick, which is
   * what wakes the bindings, and a tick read here would re-run the effect on
   * every later move and re-impose the authored props over it.
   */
  owner.run(() =>
    effect(() => {
      const svc = ensureService();
      let moved = false;
      const next = readContextProps();
      if (svc.state.context.disabled !== next.disabled) {
        svc.state.context.disabled = next.disabled;
        moved = true;
      }
      if (svc.state.context.readOnly !== next.readOnly) {
        svc.state.context.readOnly = next.readOnly;
        moved = true;
      }
      if (svc.state.context.closeOnSelect !== next.closeOnSelect) {
        svc.state.context.closeOnSelect = next.closeOnSelect;
        moved = true;
      }
      if (svc.state.context.inline !== next.inline) {
        svc.state.context.inline = next.inline;
        moved = true;
      }
      if (authored("value")) {
        const outer = parseValue(props()["value"]);
        if (outer !== null && !sameValue(lastValue, outer)) {
          untrack(() => svc.send({ type: "VALUE.SET", value: outer }));
          moved = true;
        }
      }
      if (authored("format")) {
        const outer = parseFormat(props()["format"]);
        if (outer !== null && lastFormat !== outer) {
          untrack(() => svc.send({ type: "FORMAT.SET", format: outer }));
          moved = true;
        }
      }
      if (authored("open")) {
        const outer = props()["open"] === true;
        const openNow = isOpenPhase(svc.state.value, svc.state.context.inline);
        if (lastOpen !== outer && openNow !== outer) {
          untrack(() => svc.send({ type: outer ? "CONTROLLED.OPEN" : "CONTROLLED.CLOSE" }));
          moved = true;
        }
      }
      if (moved) {
        notify();
        notifyOpen();
      }
    }),
  );

  void valueAsString;

  /** The api is read on every machine move, so this depends on the tick and
   * hands out the same connect each time. */
  const connected = computed(() => {
    tick();
    return ensureConnect();
  });

  const api = new Proxy({} as ColorPickerApi, {
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
