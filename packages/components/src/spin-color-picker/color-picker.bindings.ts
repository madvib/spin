import { parseColor, type ColorChannel } from "@zag-js/color-utils";
import {
  dataAttr,
  defineComponent,
  isComposing,
  type ComponentDef,
  type PartScope,
  type SlotScope,
} from "@spin/runtime";
import {
  config,
  formatOf,
  implementations,
  initial,
  isOpenPhase,
  startOpen,
  valueAsString,
  type ColorFormat,
  type ColorPickerContext,
  type ColorPickerEvent,
  type ColorPickerInitial,
} from "./color-picker.machine.ts";

/**
 * Color-picker definition: the DOM contract as data. The machine owns the
 * four phases, the serialized color, the format and the active channel;
 * this file maps props to channels, parts to attribute bags, commands to
 * sends, and value/end/open/format transitions to their events.
 *
 * Everything that needs a node lives here — the area and channel drags
 * (which compute their percent against the node the pointer is over and
 * send events carrying it), the keyboard maps, the channel inputs, the
 * dismissal reflex, and the focus the panel opening owes the content.
 *
 * Thumb positions and gradient stops are CONTINUOUS values — a drag lands
 * between utilities — so the bags carry them as CSS custom properties only
 * (`--picker-x`, `--picker-alpha`...). Concrete properties stay banned:
 * the recipe's utility classes decide what each var feeds. The color object
 * itself is reconstructed per read via parseColor, because context holds
 * the serialized string.
 */

export interface AreaSlotProps {
  readonly xChannel?: ColorChannel | undefined;
  readonly yChannel?: ColorChannel | undefined;
}

export interface ChannelSlotProps {
  readonly channel: ColorChannel;
  readonly orientation?: "horizontal" | "vertical" | undefined;
}

export interface SwatchSlotProps {
  readonly value: string;
  readonly disabled?: boolean | undefined;
}

export interface ColorPickerItemState {
  readonly value: string;
  readonly disabled: boolean;
  readonly checked: boolean;
}

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

export interface ColorPickerApi {
  readonly open: boolean;
  readonly value: string;
  readonly valueAsString: string;
  readonly format: ColorFormat;
  readonly disabled: boolean;
  readonly empty: boolean;
  setValue(value: string): void;
  setFormat(format: ColorFormat): void;
  setOpen(open: boolean): void;
  getChannelValue(channel: ColorChannel | "hex"): string;
  getRootProps(): Record<string, unknown>;
  getLabelProps(): Record<string, unknown>;
  getControlProps(): Record<string, unknown>;
  getTriggerProps(): Record<string, unknown>;
  getPositionerProps(): Record<string, unknown>;
  getContentProps(): Record<string, unknown>;
  getValueTextProps(): Record<string, unknown>;
  getAreaProps(props?: AreaSlotProps): Record<string, unknown>;
  getAreaBackgroundProps(props?: AreaSlotProps): Record<string, unknown>;
  getAreaThumbProps(props?: AreaSlotProps): Record<string, unknown>;
  getTransparencyGridProps(): Record<string, unknown>;
  getChannelSliderProps(props: ChannelSlotProps): Record<string, unknown>;
  getChannelSliderTrackProps(props: ChannelSlotProps): Record<string, unknown>;
  getChannelSliderThumbProps(props: ChannelSlotProps): Record<string, unknown>;
  getChannelSliderLabelProps(props: ChannelSlotProps): Record<string, unknown>;
  getChannelSliderValueTextProps(props: ChannelSlotProps): Record<string, unknown>;
  getChannelInputProps(props: { channel: ColorChannel | "hex" }): Record<string, unknown>;
  getHiddenInputProps(): Record<string, unknown>;
  getEyeDropperTriggerProps(): Record<string, unknown>;
  getFormatSelectProps(): Record<string, unknown>;
  getSwatchGroupProps(): Record<string, unknown>;
  getSwatchTriggerProps(props: SwatchSlotProps): Record<string, unknown>;
  getSwatchIndicatorProps(props: SwatchSlotProps): Record<string, unknown>;
  getSwatchProps(props: SwatchSlotProps): Record<string, unknown>;
}

const sameValue = (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase();

const isColorFormat = (raw: unknown): raw is ColorFormat =>
  raw === "hex" || raw === "hexa" || raw === "rgb" || raw === "rgba" || raw === "hsl" || raw === "hsla" || raw === "hsb" || raw === "hsba";

interface ScopeLike extends PartScope<unknown, ColorPickerContext> {}

interface SlotLike<R> extends SlotScope<R, ColorPickerContext> {}

/** Transport guarantees the raw prop bag is a ColorPickerInitial-shaped object. */
const isColorPickerInitial = (raw: unknown): raw is ColorPickerInitial =>
  raw !== null && typeof raw === "object";

const openOf = (scope: ScopeLike): boolean =>
  isOpenPhase(scope.state, scope.context.inline);

/** The live color object, parsed from the serialized context. */
const colorOf = (scope: ScopeLike): ReturnType<typeof parseColor> => {
  try {
    return parseColor(scope.context.value);
  } catch {
    return parseColor("#000000");
  }
};

const CHANNELS: readonly string[] = ["hue", "saturation", "brightness", "lightness", "red", "green", "blue", "alpha"];

const isChannel = (raw: unknown): raw is ColorChannel =>
  typeof raw === "string" && (CHANNELS as readonly string[]).includes(raw);

const areaChannels = (props: unknown): { x: ColorChannel; y: ColorChannel } => {
  const x: unknown = isRecord(props) ? props["xChannel"] : undefined;
  const y: unknown = isRecord(props) ? props["yChannel"] : undefined;
  return {
    x: isChannel(x) ? x : "saturation",
    y: isChannel(y) ? y : "brightness",
  };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** The text off the event's own input: its value, or empty. */
const textOf = (target: EventTarget | null): string => {
  if (!isRecord(target)) return "";
  const value: unknown = target["value"];
  return typeof value === "string" ? value : "";
};

/** A text prop off the bag: parsed text arrives as a string. */
const propText = (raw: unknown): string => typeof raw === "string" ? raw : "";

/** Select the event input's text, when the target supports it. */
/** Whether the platform ships the eyedropper: read off the global
 * with a feature check, never assumed. */
const eyeDropperSupported = (): boolean => {
  const api: unknown = Reflect.get(globalThis, "EyeDropper");
  return api !== undefined && api !== null;
};

/** Select the event input's text, when the target supports it. */
const selectText = (target: EventTarget | null): void => {
  if (!isRecord(target)) return;
  const select: unknown = target["select"];
  if (typeof select === "function") select();
};

const channelOf = (arg: unknown): ChannelSlotProps => {
  const channel: unknown = isRecord(arg) ? arg["channel"] : undefined;
  const orientation: unknown = isRecord(arg) ? arg["orientation"] : undefined;
  return {
    channel: isChannel(channel) ? channel : "hue",
    ...(orientation === "vertical" || orientation === "horizontal" ? { orientation } : {}),
  };
};

const swatchOf = (arg: unknown): SwatchSlotProps => {
  if (!isRecord(arg)) return { value: "" };
  const value: unknown = arg["value"];
  const disabled: unknown = arg["disabled"];
  return {
    value: typeof value === "string" ? value : "",
    ...(disabled === true ? { disabled: true as const } : {}),
  };
};

const hexSlotOf = (arg: unknown): { channel: ColorChannel | "hex" } => {
  const channel: unknown = isRecord(arg) ? arg["channel"] : undefined;
  return { channel: channel === "hex" || isChannel(channel) ? channel : "hex" };
};

const areaPropsOf = (arg: unknown): AreaSlotProps => {
  if (!isRecord(arg)) return {};
  const x: unknown = arg["xChannel"];
  const y: unknown = arg["yChannel"];
  return {
    ...(isChannel(x) ? { xChannel: x } : {}),
    ...(isChannel(y) ? { yChannel: y } : {}),
  };
};

/** Percent of a pointer within a measured rect, 0..1 on each axis.
 * The rect comes from the framework measure or the event's own node —
 * defs never query the document. */
const pointPercent = (rect: Pick<DOMRect, "left" | "top" | "width" | "height"> | null, clientX: number, clientY: number): { x: number; y: number } => {
  if (rect === null || rect.width === 0 || rect.height === 0) return { x: 0, y: 0 };
  const clamp = (n: number): number => Math.min(1, Math.max(0, n));
  return {
    x: clamp((clientX - rect.left) / rect.width),
    y: clamp((clientY - rect.top) / rect.height),
  };
};

/** Percent along a channel track, honoring orientation and direction. */
const trackPercent = (
  rect: Pick<DOMRect, "left" | "top" | "width" | "height"> | null,
  orientation: "horizontal" | "vertical",
  clientX: number,
  clientY: number,
  dir: "ltr" | "rtl",
): number => {
  if (rect === null) return 0;
  const clamp = (n: number): number => Math.min(1, Math.max(0, n));
  if (orientation === "vertical") return clamp((clientY - rect.top) / rect.height);
  const raw = clamp((clientX - rect.left) / rect.width);
  return dir === "rtl" ? 1 - raw : raw;
};

const isCapturable = (value: unknown): value is Element & { setPointerCapture(id: number): void } => {
  if (!(value instanceof Element) || !("setPointerCapture" in value)) return false;
  const fn: unknown = value.setPointerCapture;
  return typeof fn === "function";
};

const capturePointer = (target: EventTarget | null, pointerId: number): void => {
  if (isCapturable(target)) target.setPointerCapture(pointerId);
};

const dirOf = (props: Record<string, unknown>): "ltr" | "rtl" =>
  props["dir"] === "rtl" ? "rtl" : "ltr";

/** The event target's own rect: the node the gesture is over, never a
 * document lookup. */
const rectOf = (target: EventTarget | null): Pick<DOMRect, "left" | "top" | "width" | "height"> | null => {
  if (!(target instanceof Element)) return null;
  if (typeof target.getBoundingClientRect !== "function") return null;
  const rect: DOMRect = target.getBoundingClientRect();
  if (typeof rect.width !== "number" || typeof rect.height !== "number") return null;
  return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
};

/** The arrow step: shift multiplies by ten, like a native range input. */
const arrowStep = (event: KeyboardEvent): number => (event.shiftKey ? 10 : 1);

const onAreaKeydown = (scope: ScopeLike, event: KeyboardEvent): void => {
  if (event.defaultPrevented) return;
  if (scope.props["disabled"] === true || scope.props["readOnly"] === true) return;
  if (isComposing(event)) return;
  const step = arrowStep(event);
  switch (event.key) {
    case "ArrowLeft":
      event.preventDefault();
      scope.send({ type: "AREA.ARROW", channel: "x", delta: scope.props["dir"] === "rtl" ? step : -step });
      return;
    case "ArrowRight":
      event.preventDefault();
      scope.send({ type: "AREA.ARROW", channel: "x", delta: scope.props["dir"] === "rtl" ? -step : step });
      return;
    case "ArrowUp":
      event.preventDefault();
      scope.send({ type: "AREA.ARROW", channel: "y", delta: step });
      return;
    case "ArrowDown":
      event.preventDefault();
      scope.send({ type: "AREA.ARROW", channel: "y", delta: -step });
      return;
    case "Home":
      event.preventDefault();
      scope.send({ type: "AREA.HOME_END", channel: "x", toMax: false });
      return;
    case "End":
      event.preventDefault();
      scope.send({ type: "AREA.HOME_END", channel: "x", toMax: true });
      return;
    default:
      return;
  }
};

const onChannelKeydown = (scope: ScopeLike, event: KeyboardEvent, channel: ColorChannel): void => {
  if (event.defaultPrevented) return;
  if (scope.props["disabled"] === true || scope.props["readOnly"] === true) return;
  if (isComposing(event)) return;
  const step = arrowStep(event);
  switch (event.key) {
    case "ArrowLeft":
    case "ArrowDown":
      event.preventDefault();
      scope.send({ type: "CHANNEL_SLIDER.ARROW", channel, delta: -step });
      return;
    case "ArrowRight":
    case "ArrowUp":
      event.preventDefault();
      scope.send({ type: "CHANNEL_SLIDER.ARROW", channel, delta: step });
      return;
    case "Home":
      event.preventDefault();
      scope.send({ type: "CHANNEL_SLIDER.HOME_END", channel, toMax: false });
      return;
    case "End":
      event.preventDefault();
      scope.send({ type: "CHANNEL_SLIDER.HOME_END", channel, toMax: true });
      return;
    default:
      return;
  }
};

/** Zag's `getItemState` for a swatch: what one preset color is worth. */
const swatchState = (scope: ScopeLike, props: SwatchSlotProps): ColorPickerItemState => ({
  value: props.value,
  disabled: scope.props["disabled"] === true || props.disabled === true,
  checked: scope.context.value.toLowerCase() === props.value.toLowerCase(),
});

const channelValueOf = (
  context: ColorPickerContext,
  _props: Record<string, unknown>,
  channel: ColorChannel | "hex",
): string => {
  const ctx = context;
  let color: ReturnType<typeof parseColor>;
  try {
    color = parseColor(ctx.value);
  } catch {
    color = parseColor("#000000");
  }
  if (channel === "hex") {
    try {
      return color.toString("hex");
    } catch {
      return ctx.value;
    }
  }
  // Hue/saturation/brightness are not rgb channels: read them off the
  // area value, the way the machine steps them. Alpha reads natively.
  try {
    const area: "hsla" | "hsba" = ctx.format.startsWith("hsl") ? "hsla" : "hsba";
    const source = channel === "alpha" ? color : color.toFormat(area);
    return String(source.getChannelValue(channel));
  } catch {
    return "";
  }
};

const def: ComponentDef<ColorPickerContext, ColorPickerEvent> = {
  name: "color-picker",
  config,
  implementations,
  start: (raw, _authored) => {
    const props: ColorPickerInitial = isColorPickerInitial(raw) ? raw : {};
    return startOpen(props) ? "active" : "idle";
  },
  seed: (raw, _authored) => {
    const props: ColorPickerInitial = isColorPickerInitial(raw) ? raw : {};
    const shaped = initial(props);
    return {
      ...shaped,
      value: "#000000",
      format: "hex" as const,
      activeChannel: null,
    };
  },
  establish: (raw, authored) => {
    // Normalize the seed through the machine's own parser, so the context
    // always holds a serialized color rather than the host's raw text.
    // Silent: establish sends run before the watch cursors prime.
    const props: ColorPickerInitial = isColorPickerInitial(raw) ? raw : {};
    const value: unknown = authored("value") ? props.value : props.defaultValue;
    const format = formatOf(props);
    return [
      { type: "VALUE.SET", value: typeof value === "string" ? value : "#000000" },
      { type: "FORMAT.SET", format },
    ];
  },
  reconcile: ({ context, parsed, authored, send, state }) => {
    if (authored("value")) {
      const outer: unknown = parsed["value"];
      if (typeof outer === "string" && !sameValue(context.value, outer)) {
        send({ type: "VALUE.SET", value: outer });
        return true;
      }
    }
    if (authored("format")) {
      const outer: unknown = parsed["format"];
      if (typeof outer === "string" && isColorFormat(outer) && context.format !== outer) {
        send({ type: "FORMAT.SET", format: outer });
        return true;
      }
    }
    if (authored("open")) {
      const outer = parsed["open"] === true;
      const open = isOpenPhase(state, context.inline);
      if (open !== outer) {
        send(outer ? { type: "CONTROLLED.OPEN" } : { type: "CONTROLLED.CLOSE" });
        return true;
      }
    }
    return false;
  },
  scalars: ["disabled", "readOnly", "closeOnSelect", "inline"],
  parts: {
    root: {
      sig: (scope) => [scope.state, scope.props["disabled"], scope.props["dir"]].join(" "),
      attrs: (scope) => ({
        id: scope.id(""),
        dir: scope.props["dir"],
        "data-disabled": dataAttr(scope.props["disabled"] === true),
      }),
    },
    label: {
      sig: (scope) => [scope.props["disabled"], scope.props["dir"]].join(" "),
      attrs: (scope) => ({
        id: scope.id("label"),
        dir: scope.props["dir"],
        "data-disabled": dataAttr(scope.props["disabled"] === true),
      }),
    },
    control: {
      sig: (scope) => [`${scope.props["disabled"] === true}`].join(" "),
      attrs: (scope) => ({
        id: scope.id("control"),
        "data-disabled": dataAttr(scope.props["disabled"] === true),
      }),
    },
    trigger: {
      sig: (scope) => {
        const ctx = scope.context;
        return [scope.state, ctx.value, scope.props["disabled"], scope.props["readOnly"]].join(" ");
      },
      attrs: (scope) => {
        const ctx = scope.context;
        const value = valueAsString(ctx);
        const open = openOf(scope);
        return {
          id: scope.id("trigger"),
          type: "button",
          dir: scope.props["dir"],
          "aria-label": `select color. current color is ${value}`,
          "aria-controls": scope.id("content"),
          "aria-labelledby": scope.id("label"),
          "aria-haspopup": scope.props["inline"] === true ? undefined : "dialog",
          "aria-expanded": open ? "true" : "false",
          "data-state": open ? "open" : "closed",
          "data-disabled": dataAttr(scope.props["disabled"] === true),
          "data-readonly": dataAttr(scope.props["readOnly"] === true),
          onClick: (): void => {
            if (scope.props["disabled"] === true || scope.props["readOnly"] === true) return;
            scope.send({ type: "TRIGGER.CLICK" });
          },
          onBlur: (): void => {
            if (scope.props["disabled"] === true || scope.props["readOnly"] === true) return;
            scope.send({ type: "TRIGGER.BLUR" });
          },
        };
      },
    },
    positioner: {
      // data-state drives the recipe's closed utilities: the `hidden`
      // attribute alone loses to the content's own `display` utility.
      sig: (scope) => [scope.state].join(" "),
      attrs: (scope) => ({
        id: scope.id("positioner"),
        "data-state": openOf(scope) ? "open" : "closed",
      }),
    },
    content: {
      sig: (scope) => [scope.state, scope.context.value].join(" "),
      attrs: (scope) => {
        const open = openOf(scope);
        return {
          id: scope.id("content"),
          role: scope.props["inline"] === true ? undefined : "dialog",
          tabindex: "-1",
          dir: scope.props["dir"],
          "data-state": open ? "open" : "closed",
          hidden: open ? undefined : "",
          // The layer: a press outside the panel dismisses, and Escape
          // while it is up does too.
          "use:dismissable": {
            onEscape: (): void => {
              if (!openOf(scope)) return;
              scope.send({ type: "CLOSE" });
            },
            onOutside: (): void => {
              if (!openOf(scope)) return;
              scope.send({ type: "LAYER.INTERACT_OUTSIDE" });
            },
          },
        };
      },
    },
    valueText: {
      id: "value-text",
      sig: (scope) => [scope.context.value].join(" "),
      attrs: (scope) => ({
        id: scope.id("valueText"),
        dir: scope.props["dir"],
        "data-disabled": dataAttr(scope.props["disabled"] === true),
      }),
    },
    area: {
      sig: (scope: ScopeLike, arg?: unknown) => {
        const { x, y } = areaChannels(arg);
        return [scope.context.value, x, y, scope.props["disabled"], scope.props["readOnly"]].join(" ");
      },
      attrs: (scope, arg) => {
        const slots = arg === undefined ? undefined : areaPropsOf(arg);
        const { x, y } = areaChannels(slots);
        const color = colorOf(scope);
        return {
          id: scope.id("area"),
          role: "group",
          "data-disabled": dataAttr(scope.props["disabled"] === true),
          "data-readonly": dataAttr(scope.props["readOnly"] === true),
          "data-channel-x": x,
          "data-channel-y": y,
          style: { "--picker-area": color.toString("css") },
          onPointerdown: (event: PointerEvent): void => {
            if (scope.props["disabled"] === true || scope.props["readOnly"] === true) return;
            if (event.button !== 0 || event.ctrlKey || event.metaKey || event.altKey) return;
            const at = pointPercent(scope.measure("area"), event.clientX, event.clientY);
            event.preventDefault();
            capturePointer(event.currentTarget, event.pointerId);
            scope.send({ type: "AREA.POINTER_DOWN", x: at.x, y: at.y });
          },
          onPointermove: (event: PointerEvent): void => {
            if (scope.state !== "dragging") return;
            const at = pointPercent(scope.measure("area"), event.clientX, event.clientY);
            scope.send({ type: "AREA.POINTER_MOVE", x: at.x, y: at.y });
          },
          onPointerup: (): void => {
            if (scope.state !== "dragging") return;
            scope.send({ type: "AREA.POINTER_UP" });
          },
        };
      },
    },
    areaBackground: {
      id: "area-background",
      sig: (scope: ScopeLike, arg?: unknown) => {
        const { x, y } = areaChannels(arg);
        return [scope.context.value, x, y].join(" ");
      },
      attrs: (scope: ScopeLike, arg?: unknown) => {
        const { x, y } = areaChannels(arg);
        return {
          id: scope.id("areaBackground"),
          "data-disabled": dataAttr(scope.props["disabled"] === true),
          "data-readonly": dataAttr(scope.props["readOnly"] === true),
          style: {
            "--picker-area": colorOf(scope).toString("css"),
            backgroundColor: "var(--picker-area)",
          },
        };
      },
    },
    areaThumb: {
      id: "area-thumb",
      sig: (scope: ScopeLike, arg?: unknown) => {
        const { x, y } = areaChannels(arg);
        return [scope.context.value, x, y, scope.props["dir"], scope.props["disabled"]].join(" ");
      },
      attrs: (scope: ScopeLike, arg?: unknown) => {
        const { x, y } = areaChannels(arg);
        const ctx = scope.context;
        const color = colorOf(scope);
        // The area's channels live in the area format: read them off the
        // converted value, because an rgb color has no saturation channel
        // and the raw read throws (which is why the thumb sat at 0,0).
        const area: "hsla" | "hsba" = ctx.format.startsWith("hsl") ? "hsla" : "hsba";
        let source = color;
        try {
          source = color.toFormat(area);
        } catch {
          // Unparseable stays home.
        }
        let xp = 0;
        let yp = 0;
        try {
          xp = source.getChannelValuePercent(x);
          yp = 1 - source.getChannelValuePercent(y);
        } catch {
          // Unparseable stays home.
        }
        if (scope.props["dir"] === "rtl") xp = 1 - xp;
        const xv = (() => {
          try {
            return source.getChannelValue(x);
          } catch {
            return 0;
          }
        })();
        const yv = (() => {
          try {
            return source.getChannelValue(y);
          } catch {
            return 0;
          }
        })();
        return {
          id: scope.id("areaThumb"),
          role: "slider",
          tabindex: scope.props["disabled"] === true ? undefined : "0",
          dir: scope.props["dir"],
          "aria-label": `${x} and ${y}`,
          "aria-roledescription": "2d slider",
          "aria-valuemin": "0",
          "aria-valuemax": "100",
          "aria-valuenow": String(xv),
          "aria-valuetext": `${x} ${xv}, ${y} ${yv}`,
          "aria-disabled": scope.props["disabled"] === true ? "true" : undefined,
          "data-disabled": dataAttr(scope.props["disabled"] === true),
          style: {
            "--picker-x": `${xp * 100}%`,
            "--picker-y": `${yp * 100}%`,
            "--picker-color": color.toString("css"),
            left: "var(--picker-x, 50%)",
            top: "var(--picker-y, 50%)",
            transform: "translate(-50%, -50%)",
            background: "var(--picker-color)",
          },
          onFocus: (): void => scope.send({ type: "AREA.ACTIVATE" }),
          onKeydown: (event: KeyboardEvent): void => onAreaKeydown(scope, event),
        };
      },
    },
    transparencyGrid: {
      id: "transparency-grid",
      sig: () => "grid",
      attrs: () => ({ "--picker-grid": "12px" }),
    },
    channelSlider: {
      id: "channel-slider",
      sig: (scope: ScopeLike, arg?: unknown) => {
        const slots = channelOf(arg);
        const orientation = slots.orientation ?? "horizontal";
        return [scope.props["disabled"], scope.props["readOnly"], orientation].join(" ");
      },
      attrs: (scope: ScopeLike, arg?: unknown) => {
        const slots = channelOf(arg);
        const orientation = slots.orientation ?? "horizontal";
        return {
          role: "presentation",
          "data-channel": slots.channel,
          "data-orientation": orientation,
          onPointerdown: (event: PointerEvent): void => {
            if (scope.props["disabled"] === true || scope.props["readOnly"] === true) return;
            if (event.button !== 0 || event.ctrlKey || event.metaKey || event.altKey) return;
            const rect = rectOf(event.currentTarget);
            if (rect === null) return;
            const percent = trackPercent(rect, orientation, event.clientX, event.clientY, dirOf(scope.props));
            event.preventDefault();
            capturePointer(event.currentTarget, event.pointerId);
            scope.send({ type: "CHANNEL_SLIDER.POINTER_DOWN", channel: slots.channel, percent });
          },
          onPointermove: (event: PointerEvent): void => {
            if (scope.state !== "dragging") return;
            const rect = rectOf(event.currentTarget);
            if (rect === null) return;
            const percent = trackPercent(rect, orientation, event.clientX, event.clientY, dirOf(scope.props));
            scope.send({ type: "CHANNEL_SLIDER.POINTER_MOVE", channel: slots.channel, percent });
          },
          onPointerup: (): void => {
            if (scope.state !== "dragging") return;
            scope.send({ type: "CHANNEL_SLIDER.POINTER_UP" });
          },
        };
      },
    },
    channelSliderTrack: {
      id: "track",
      sig: (scope: ScopeLike, arg?: unknown) => {
        const slots = channelOf(arg);
        const orientation = slots.orientation ?? "horizontal";
        return [scope.context.value, orientation, scope.props["dir"]].join(" ");
      },
      attrs: (scope: ScopeLike, arg?: unknown) => {
        const slots = channelOf(arg);
        const orientation = slots.orientation ?? "horizontal";
        const color = colorOf(scope);
        return {
          id: scope.id("track", slots.channel),
          role: "group",
          "data-channel": slots.channel,
          "data-orientation": orientation,
          style: {
            "--picker-track": color.toString("css"),
            background: "var(--picker-track)",
          },
        };
      },
    },
    channelSliderThumb: {
      id: "thumb",
      sig: (scope: ScopeLike, arg?: unknown) => {
        const slots = channelOf(arg);
        const orientation = slots.orientation ?? "horizontal";
        return [scope.context.value, orientation, scope.props["dir"], scope.props["disabled"]].join(" ");
      },
      attrs: (scope: ScopeLike, arg?: unknown) => {
        const slots = channelOf(arg);
        const orientation = slots.orientation ?? "horizontal";
        const ctx = scope.context;
        const color = colorOf(scope);
        // Hue/saturation/brightness are not rgb channels: read them off
        // the area value, the way the machine steps them. Alpha natively.
        const area: "hsla" | "hsba" = ctx.format.startsWith("hsl") ? "hsla" : "hsba";
        let source = color;
        try {
          source = slots.channel === "alpha" ? color : color.toFormat(area);
        } catch {
          // Unparseable stays home.
        }
        let offset = 0;
        let now = 0;
        let min = 0;
        let max = 100;
        try {
          const range = source.getChannelRange(slots.channel);
          now = source.getChannelValue(slots.channel);
          min = range.minValue;
          max = range.maxValue;
          offset = max === min ? 0 : (now - min) / (max - min);
        } catch {
          // Unparseable stays home.
        }
        if (orientation === "horizontal" && scope.props["dir"] === "rtl") offset = 1 - offset;
        return {
          id: scope.id("thumb", slots.channel),
          role: "slider",
          tabindex: scope.props["disabled"] === true ? undefined : "0",
          "aria-label": slots.channel,
          "aria-orientation": orientation,
          "aria-valuemin": String(min),
          "aria-valuemax": String(max),
          "aria-valuenow": String(now),
          "aria-valuetext": `${slots.channel} ${now}`,
          "aria-disabled": scope.props["disabled"] === true ? "true" : undefined,
          "data-channel": slots.channel,
          "data-disabled": dataAttr(scope.props["disabled"] === true),
          "data-orientation": orientation,
          style: {
            "--picker-offset": `${offset * 100}%`,
            "--picker-color": color.toString("css"),
            left: "var(--picker-offset, 0%)",
            top: "50%",
            transform: "translate(-50%, -50%)",
            background: "var(--picker-color)",
          },
          onFocus: (): void => scope.send({ type: "CHANNEL_SLIDER.ACTIVATE", channel: slots.channel }),
          onKeydown: (event: KeyboardEvent): void => onChannelKeydown(scope, event, slots.channel),
        };
      },
    },
    channelSliderLabel: {
      id: "channel-slider-label",
      sig: (scope) => [`${scope.props["dir"]}`].join(" "),
      attrs: (scope: ScopeLike, arg?: unknown) => {
        const slots = channelOf(arg);
        return { "data-channel": slots.channel, dir: scope.props["dir"] };
      },
    },
    channelSliderValueText: {
      id: "channel-slider-value-text",
      sig: (scope) => [scope.context.value].join(" "),
      attrs: (scope: ScopeLike, arg?: unknown) => {
        const slots = channelOf(arg);
        return { "data-channel": slots.channel };
      },
    },
    channelInput: {
      id: "channel-input",
      sig: (scope: ScopeLike, arg?: unknown) => {
        const slots = hexSlotOf(arg);
        const ctx = scope.context;
        return [slots.channel, channelValueOf(scope.context, scope.props, slots.channel), scope.props["disabled"], scope.props["readOnly"]].join(" ");
      },
      attrs: (scope: ScopeLike, arg?: unknown) => {
        const slots = hexSlotOf(arg);
        const isText = slots.channel === "hex";
        const current = channelValueOf(scope.context, scope.props, slots.channel);
        return {
          type: isText ? "text" : "number",
          dir: scope.props["dir"],
          "data-channel": slots.channel,
          "aria-label": slots.channel,
          "data-disabled": dataAttr(scope.props["disabled"] === true),
          "data-readonly": dataAttr(scope.props["readOnly"] === true),
          value: current,
          onFocus: (event: FocusEvent): void => {
            if (scope.props["disabled"] === true || scope.props["readOnly"] === true) return;
            scope.send({ type: "CHANNEL_INPUT.FOCUS", channel: slots.channel });
            selectText(event.currentTarget);
          },
          onBlur: (event: FocusEvent): void => {
            if (scope.props["disabled"] === true || scope.props["readOnly"] === true) return;
            const raw = textOf(event.currentTarget);
            scope.send({ type: "CHANNEL_INPUT.BLUR", channel: slots.channel, value: raw });
          },
          onKeydown: (event: KeyboardEvent): void => {
            if (event.defaultPrevented || isComposing(event)) return;
            if (scope.props["disabled"] === true || scope.props["readOnly"] === true) return;
            if (event.key !== "Enter") return;
            const raw = textOf(event.currentTarget);
            event.preventDefault();
            scope.send({ type: "CHANNEL_INPUT.CHANGE", channel: slots.channel, value: raw });
          },
        };
      },
    },
    hiddenInput: {
      id: "hidden-input",
      sig: (scope) => [scope.context.value, `${scope.props["name"]}`].join(" "),
      attrs: (scope: ScopeLike) => {
        const name = propText(scope.props["name"]);
        return {
          id: scope.id("hiddenInput"),
          type: "text",
          name: name.length > 0 ? name : undefined,
          tabindex: "-1",
          readonly: scope.props["readOnly"] === true ? "" : undefined,
          value: valueAsString(scope.context),
        };
      },
    },
    eyeDropperTrigger: {
      id: "eyedropper",
      sig: (scope) => {
        const supported = eyeDropperSupported();
        return [`${scope.props["disabled"] === true}`, `${supported}`].join(" ");
      },
      attrs: (scope) => {
        const supported = eyeDropperSupported();
        return {
          id: scope.id("eyeDropper"),
          type: "button",
          dir: scope.props["dir"],
          "aria-label": "Pick a color from the screen",
          "data-disabled": dataAttr(scope.props["disabled"] === true),
          hidden: supported ? undefined : "",
          onClick: (): void => {
            if (scope.props["disabled"] === true || scope.props["readOnly"] === true) return;
            scope.send({ type: "EYEDROPPER.CLICK" });
          },
        };
      },
    },
    formatSelect: {
      id: "format-select",
      sig: (scope) => [scope.context.format, `${scope.props["disabled"] === true}`].join(" "),
      attrs: (scope) => ({
        id: scope.id("formatSelect"),
        dir: scope.props["dir"],
        "data-disabled": dataAttr(scope.props["disabled"] === true),
        value: scope.context.format,
        onChange: (event: Event): void => {
          const next = textOf(event.currentTarget);
          if (!isColorFormat(next)) return;
          scope.send({ type: "FORMAT.SET", format: next });
        },
      }),
    },
    swatchGroup: {
      id: "swatch-group",
      sig: () => "group",
      attrs: (scope) => ({ id: scope.id("swatchGroup"), role: "group" }),
    },
    swatchTrigger: {
      id: "swatch",
      sig: (scope: ScopeLike, arg?: unknown) => {
        const slots = swatchOf(arg);
        const state = swatchState(scope, slots);
        return [state.checked, state.disabled, scope.context.format].join(" ");
      },
      attrs: (scope: ScopeLike, arg?: unknown) => {
        const slots = swatchOf(arg);
        const state = swatchState(scope, slots);
        return {
          id: scope.id("swatch", slots.value),
          type: "button",
          dir: scope.props["dir"],
          "aria-label": `select ${slots.value} as the color`,
          "data-state": state.checked ? "checked" : "unchecked",
          "data-value": slots.value,
          "data-disabled": dataAttr(state.disabled),
          style: { "--picker-swatch": slots.value },
          onClick: (): void => {
            if (state.disabled || scope.props["readOnly"] === true) return;
            scope.send({ type: "SWATCH_TRIGGER.CLICK", value: slots.value });
          },
        };
      },
    },
    swatchIndicator: {
      id: "swatch-indicator",
      sig: (scope: ScopeLike, arg?: unknown) => {
        const slots = swatchOf(arg);
        return [`${swatchState(scope, slots).checked}`].join(" ");
      },
      attrs: (scope: ScopeLike, arg?: unknown) => {
        const slots = swatchOf(arg);
        const checked = swatchState(scope, slots).checked;
        return {
          "aria-hidden": "true",
          "data-state": checked ? "checked" : "unchecked",
          hidden: checked ? undefined : "",
        };
      },
    },
    swatch: {
      id: "swatch",
      sig: (scope: ScopeLike, arg?: unknown) => {
        const slots = swatchOf(arg);
        return [`${swatchState(scope, slots).checked}`].join(" ");
      },
      attrs: (scope: ScopeLike, arg?: unknown) => {
        const slots = swatchOf(arg);
        const checked = swatchState(scope, slots).checked;
        return {
          "data-state": checked ? "checked" : "unchecked",
          "data-value": slots.value,
          style: { "--picker-swatch": slots.value },
        };
      },
    },
  },
  commands: {
    setValue: {
      event: (args) => {
        const value = args[0];
        return { type: "VALUE.SET", value: typeof value === "string" ? value : "#000000" };
      },
    },
    setFormat: {
      event: (args) => {
        const format = args[0];
        return { type: "FORMAT.SET", format: isColorFormat(format) ? format : "hex" as const };
      },
    },
    setOpen: { event: (args) => ({ type: args[0] === true ? "OPEN" : "CLOSE" }) },
  },
  readers: {
    open: {
      read: (context: ColorPickerContext, state) => isOpenPhase(state, context.inline),
    },
    value: { read: (context) => context.value },
    valueAsString: { read: (context) => valueAsString(context) },
    format: { read: (context) => context.format },
    disabled: { read: (_context, _state, props) => props["disabled"] === true },
    empty: { read: () => false },
  },
  methods: {
    getChannelValue: {
      call: (context: ColorPickerContext, _state, args, props) => {
        const channel = args[0];
        return channelValueOf(context, props, channel === "hex" || isChannel(channel) ? channel : "hex");
      },
    },
  },
  events: {
    "value-change": {
      prop: "onValueChange",
      watch: (context) => [context.value.toLowerCase()],
      detail: (_watched, _event, _props, context: ColorPickerContext) => ({
        value: context.value,
        format: context.format,
      }),
    },
    "open-change": {
      prop: "onOpenChange",
      watch: (context, state) => [isOpenPhase(state, context.inline)],
      detail: (watched: readonly unknown[]) => ({ open: watched[0] === true }),
    },
    "format-change": {
      prop: "onFormatChange",
      watch: (context) => [context.format],
      detail: (watched: readonly unknown[]) => {
        const format = watched[0];
        return { format: isColorFormat(format) ? format : "hex" as const };
      },
    },
    "value-change-end": {
      prop: "onValueChangeEnd",
      watch: (context) => [context.value.toLowerCase()],
      detail: (_watched, _event, _props, context: ColorPickerContext) => ({
        value: context.value,
        format: context.format,
      }),
      // Drag release and committed inputs only — every move already
      // reported above.
      select: (event, _before, after: ColorPickerContext) =>
        event.type === "AREA.POINTER_UP" ||
          event.type === "CHANNEL_SLIDER.POINTER_UP" ||
          event.type === "CHANNEL_INPUT.BLUR" ||
          event.type === "SWATCH_TRIGGER.CLICK"
          ? {
            value: after.value,
            format: after.format,
          }
          : null,
    },
  },
};

export const colorPicker = defineComponent<ColorPickerContext, ColorPickerEvent, ColorPickerApi>(def);
