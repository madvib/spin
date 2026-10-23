import { parseColor, type ColorChannel } from "@zag-js/color-utils";
import {
  ariaDisabled,
  ariaHidden,
  ariaLabelledBy,
  ariaOrientation,
  ariaRoleDescription,
  dataAttr,
  defineComponent,
  disclosureTrigger,
  isComposing,
  isRecord,
  sliderThumb,
  type ApiOf,
  type ComponentDef,
  type ScopeFor,
  type SlotScopeFor,
} from "@spin/runtime";
import type { DragDelta, DragPress } from "@spin/runtime/actions";
import { colorPicker as colorPickerMachine } from "./color-picker.machine.ts";
import {
  isOpenPhase,
  startOpen,
  valueAsString,
  type ColorPickerState,
  type ColorFormat,
  type ColorPickerArgs,
  type ColorPickerContext,
} from "./color-picker.state.ts";
import type { ColorPickerEvents } from "./color-picker.events.ts";

/**
 * Color-picker definition: the DOM contract as data.
 *
 * Everything that needs a node lives here — the area and channel drags
 * (the gesture itself is the runtime's `drag` action; the bags only report
 * the percent and send the events carrying it), the keyboard maps, the
 * channel inputs, and the dismissal reflex.
 *
 * Thumb positions and gradient stops are CONTINUOUS values — a drag lands
 * between utilities — so the bags project them into their own style object
 * as concrete properties (`left`, `top`, `background`); the markup names
 * nothing and no custom property carries the geometry.
 *
 * The color object is reconstructed per read: the context holds the
 * serialized string.
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

const isColorFormat = (raw: unknown): raw is ColorFormat =>
  raw === "hex" || raw === "hexa" || raw === "rgb" || raw === "rgba" || raw === "hsl" || raw === "hsla" || raw === "hsb" || raw === "hsba";

type ScopeLike = ScopeFor<ColorPickerContext, ColorPickerEvents, ColorPickerState>;

type SlotLike<R> = SlotScopeFor<R, ColorPickerContext, ColorPickerEvents, ColorPickerState>;

const openOf = (scope: ScopeLike): boolean =>
  isOpenPhase(scope.state, scope.context.inline);

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

const areaChannels = (slot: unknown): { x: ColorChannel; y: ColorChannel } => {
  const x: unknown = isRecord(slot) ? slot["xChannel"] : undefined;
  const y: unknown = isRecord(slot) ? slot["yChannel"] : undefined;
  return {
    x: isChannel(x) ? x : "saturation",
    y: isChannel(y) ? y : "brightness",
  };
};

const textOf = (target: EventTarget | null): string => {
  if (!isRecord(target)) return "";
  const value: unknown = target["value"];
  return typeof value === "string" ? value : "";
};

const propText = (raw: unknown): string => typeof raw === "string" ? raw : "";

/** Whether the platform ships the eyedropper: a feature check, never assumed. */
const eyeDropperSupported = (): boolean => {
  const api: unknown = Reflect.get(globalThis, "EyeDropper");
  return api !== undefined && api !== null;
};

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

/** Percent of a pointer within a measured rect, 0..1 on each axis. The rect
 * comes from the framework measure or the event's own node — defs never
 * query the document. */
const pointPercent = (rect: Pick<DOMRect, "left" | "top" | "width" | "height"> | null, clientX: number, clientY: number): { x: number; y: number } => {
  if (rect === null || rect.width === 0 || rect.height === 0) return { x: 0, y: 0 };
  const clamp = (n: number): number => Math.min(1, Math.max(0, n));
  return {
    x: clamp((clientX - rect.left) / rect.width),
    y: clamp((clientY - rect.top) / rect.height),
  };
};

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

/** The arrow step: shift multiplies by ten, like a native range input. */
const arrowStep = (event: KeyboardEvent): number => (event.shiftKey ? 10 : 1);

const onAreaKeydown = (scope: ScopeLike, event: KeyboardEvent): void => {
  if (event.defaultPrevented) return;
  if (scope.context.disabled === true || scope.context.readOnly === true) return;
  if (isComposing(event)) return;
  const step = arrowStep(event);
  switch (event.key) {
    case "ArrowLeft":
      event.preventDefault();
      scope.send({ type: "AREA.ARROW", channel: "x", delta: scope.context.dir === "rtl" ? step : -step });
      return;
    case "ArrowRight":
      event.preventDefault();
      scope.send({ type: "AREA.ARROW", channel: "x", delta: scope.context.dir === "rtl" ? -step : step });
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
  if (scope.context.disabled === true || scope.context.readOnly === true) return;
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

const swatchState = (scope: ScopeLike, slot: SwatchSlotProps): ColorPickerItemState => ({
  value: slot.value,
  disabled: scope.context.disabled === true || slot.disabled === true,
  checked: scope.context.value.toLowerCase() === slot.value.toLowerCase(),
});

const channelValueOf = (
  context: ColorPickerContext,
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
  // Hue/saturation/brightness are not rgb channels: read them off the area
  // value, the way the machine steps them. Alpha reads natively.
  try {
    const area: "hsla" | "hsba" = ctx.format.startsWith("hsl") ? "hsla" : "hsba";
    const source = channel === "alpha" ? color : color.toFormat(area);
    return String(source.getChannelValue(channel));
  } catch {
    return "";
  }
};

export const def = {
  name: "color-picker",
  machine: (args: ColorPickerArgs, authored: (name: string) => boolean) => colorPickerMachine(args, authored),
  start: (raw: Record<string, unknown>) => (startOpen(raw) ? "active" : "idle"),
  reconcile: ({ context, parsed, authored, send, state }) => {
    // The panel's visibility is the machine's STATE, not a context field, so
    // the host's `open` prop is reconciled here rather than in the machine's
    // contract.
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
  parts: {
    root: {
      attrs: (scope) => ({
        dir: scope.context.dir,
        "data-disabled": dataAttr(scope.context.disabled === true),
      }),
    },
    label: {
      attrs: (scope) => ({
        dir: scope.context.dir,
        "data-disabled": dataAttr(scope.context.disabled === true),
      }),
    },
    control: {
      attrs: (scope) => ({
        "data-disabled": dataAttr(scope.context.disabled === true),
      }),
    },
    trigger: {
      attrs: (scope) => {
        const ctx = scope.context;
        const value = valueAsString(ctx);
        const open = openOf(scope);
        return {
          type: "button",
          dir: scope.context.dir,
          "aria-label": `select color. current color is ${value}`,
          ...disclosureTrigger(scope, {
            expanded: open ? "true" : "false",
            hasPopup: scope.context.inline === true ? undefined : "dialog",
            controls: { part: "content" },
          }),
          ...ariaLabelledBy(scope, { part: "label" }),
          "data-state": open ? "open" : "closed",
          "data-disabled": dataAttr(scope.context.disabled === true),
          onClick: (): void => {
            if (scope.context.disabled === true || scope.context.readOnly === true) return;
            scope.send({ type: "TRIGGER.CLICK" });
          },
          onBlur: (): void => {
            if (scope.context.disabled === true || scope.context.readOnly === true) return;
            scope.send({ type: "TRIGGER.BLUR" });
          },
        };
      },
    },
    positioner: {
      // data-state drives the recipe's closed utilities: `hidden` alone
      // loses to the content's own `display` utility.
      attrs: (scope) => ({
        "data-state": openOf(scope) ? "open" : "closed",
      }),
    },
    content: {
      attrs: (scope) => {
        const open = openOf(scope);
        return {
          role: scope.context.inline === true ? undefined : "dialog",
          tabindex: "-1",
          dir: scope.context.dir,
          "data-state": open ? "open" : "closed",
          hidden: open ? undefined : "",
          // The layer dismisses on an outside press and on Escape.
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
      attrs: (scope) => ({
        dir: scope.context.dir,
        "data-disabled": dataAttr(scope.context.disabled === true),
      }),
    },
    area: {
      attrs: (scope, arg) => {
        const slots = arg === undefined ? undefined : areaPropsOf(arg);
        const { x, y } = areaChannels(slots);
        return {
          role: "group",
          "data-disabled": dataAttr(scope.context.disabled === true),
          "data-channel-x": x,
          "data-channel-y": y,
          // The gesture lives in the runtime: the press arms the drag, the
          // machine still owns the geometry — the percent comes from the
          // area's own measured box.
          "use:drag": {
            enabled: scope.context.disabled !== true && scope.context.readOnly !== true,
            cancelOnEscape: false,
            onStart: (press: DragPress): void => {
              if (press.ctrlKey === true || press.metaKey === true || press.altKey === true) return;
              const at = pointPercent(scope.measure("area"), press.x, press.y);
              scope.send({ type: "AREA.POINTER_DOWN", x: at.x, y: at.y });
            },
            onMove: (delta: DragDelta): void => {
              if (scope.state !== "dragging") return;
              const at = pointPercent(scope.measure("area"), delta.x, delta.y);
              scope.send({ type: "AREA.POINTER_MOVE", x: at.x, y: at.y });
            },
            onEnd: (): void => {
              if (scope.state !== "dragging") return;
              scope.send({ type: "AREA.POINTER_UP" });
            },
          },
        };
      },
    },
    areaBackground: {
      id: "area-background",
      attrs: (scope: ScopeLike, arg?: unknown) => {
        const { x, y } = areaChannels(arg);
        return {
          "data-disabled": dataAttr(scope.context.disabled === true),
          // The color is the machine's own value: the bag carries it as a
          // concrete background, and the markup names no var.
          style: {
            backgroundColor: colorOf(scope).toString("css"),
          },
        };
      },
    },
    areaThumb: {
      id: "area-thumb",
      attrs: (scope: ScopeLike, arg?: unknown) => {
        const { x, y } = areaChannels(arg);
        const ctx = scope.context;
        const color = colorOf(scope);
        // The area's channels live in the area format: an rgb color has no
        // saturation channel, so the raw read throws — read off the
        // converted value instead.
        const area: "hsla" | "hsba" = ctx.format.startsWith("hsl") ? "hsla" : "hsba";
        let source = color;
        try {
          source = color.toFormat(area);
        } catch {
          // Unparseable: keep what we have.
        }
        let xp = 0;
        let yp = 0;
        try {
          xp = source.getChannelValuePercent(x);
          yp = 1 - source.getChannelValuePercent(y);
        } catch {
          // Unparseable: keep what we have.
        }
        if (scope.context.dir === "rtl") xp = 1 - xp;
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
          role: "slider",
          tabindex: scope.context.disabled === true ? undefined : "0",
          dir: scope.context.dir,
          "aria-label": `${x} and ${y}`,
          ...ariaRoleDescription("2d slider"),
          ...sliderThumb({
            min: "0",
            max: "100",
            now: String(xv),
            text: `${x} ${xv}, ${y} ${yv}`,
          }),
          ...ariaDisabled(scope.context.disabled === true ? "true" : undefined),
          "data-disabled": dataAttr(scope.context.disabled === true),
          style: {
            // The thumb rides the area: the percent is the machine's own
            // geometry, so the bag carries it directly.
            left: `${xp * 100}%`,
            top: `${yp * 100}%`,
            transform: "translate(-50%, -50%)",
            background: color.toString("css"),
          },
          onFocus: (): void => scope.send({ type: "AREA.ACTIVATE" }),
          onKeydown: (event: KeyboardEvent): void => onAreaKeydown(scope, event),
        };
      },
    },
    transparencyGrid: {
      id: "transparency-grid",
      attrs: () => ({ "--picker-grid": "12px" }),
    },
    channelSlider: {
      id: "channel-slider",
      attrs: (scope: ScopeLike, arg?: unknown) => {
        const slots = channelOf(arg);
        const orientation = slots.orientation ?? "horizontal";
        return {
          role: "presentation",
          "data-channel": slots.channel,
          "data-orientation": orientation,
          // The gesture lives in the runtime; the percent comes from the
          // handle's OWN box, the one the drag action reports.
          "use:drag": {
            enabled: scope.context.disabled !== true && scope.context.readOnly !== true,
            cancelOnEscape: false,
            onStart: (press: DragPress): void => {
              if (press.ctrlKey === true || press.metaKey === true || press.altKey === true) return;
              const rect = press.rect;
              if (rect === null) return;
              const percent = trackPercent(rect, orientation, press.x, press.y, scope.context.dir);
              scope.send({ type: "CHANNEL_SLIDER.POINTER_DOWN", channel: slots.channel, percent });
            },
            onMove: (delta: DragDelta): void => {
              if (scope.state !== "dragging") return;
              const rect = delta.rect;
              if (rect === null) return;
              const percent = trackPercent(rect, orientation, delta.x, delta.y, scope.context.dir);
              scope.send({ type: "CHANNEL_SLIDER.POINTER_MOVE", channel: slots.channel, percent });
            },
            onEnd: (): void => {
              if (scope.state !== "dragging") return;
              scope.send({ type: "CHANNEL_SLIDER.POINTER_UP" });
            },
          },
        };
      },
    },
    channelSliderTrack: {
      id: "track",
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
            // The track is the current color: the bag paints it, and the
            // markup names no var.
            background: color.toString("css"),
          },
        };
      },
    },
    channelSliderThumb: {
      id: "thumb",
      attrs: (scope: ScopeLike, arg?: unknown) => {
        const slots = channelOf(arg);
        const orientation = slots.orientation ?? "horizontal";
        const ctx = scope.context;
        const color = colorOf(scope);
        // Hue/saturation/brightness are not rgb channels: read them off the
        // area value, the way the machine steps them. Alpha natively.
        const area: "hsla" | "hsba" = ctx.format.startsWith("hsl") ? "hsla" : "hsba";
        let source = color;
        try {
          source = slots.channel === "alpha" ? color : color.toFormat(area);
        } catch {
          // Unparseable: keep what we have.
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
          // Unparseable: keep what we have.
        }
        if (orientation === "horizontal" && scope.context.dir === "rtl") offset = 1 - offset;
        return {
          id: scope.id("thumb", slots.channel),
          role: "slider",
          tabindex: scope.context.disabled === true ? undefined : "0",
          "aria-label": slots.channel,
          ...ariaOrientation(orientation),
          ...sliderThumb({
            min: String(min),
            max: String(max),
            now: String(now),
            text: `${slots.channel} ${now}`,
          }),
          ...ariaDisabled(scope.context.disabled === true ? "true" : undefined),
          "data-channel": slots.channel,
          "data-disabled": dataAttr(scope.context.disabled === true),
          "data-orientation": orientation,
          style: {
            // The thumb's place on the track is the machine's own number:
            // the bag carries it directly.
            left: `${offset * 100}%`,
            top: "50%",
            transform: "translate(-50%, -50%)",
            background: color.toString("css"),
          },
          onFocus: (): void => scope.send({ type: "CHANNEL_SLIDER.ACTIVATE", channel: slots.channel }),
          onKeydown: (event: KeyboardEvent): void => onChannelKeydown(scope, event, slots.channel),
        };
      },
    },
    channelSliderLabel: {
      id: "channel-slider-label",
      attrs: (scope: ScopeLike, arg?: unknown) => {
        const slots = channelOf(arg);
        return { "data-channel": slots.channel, dir: scope.context.dir };
      },
    },
    channelSliderValueText: {
      id: "channel-slider-value-text",
      attrs: (scope: ScopeLike, arg?: unknown) => {
        const slots = channelOf(arg);
        return { "data-channel": slots.channel };
      },
    },
    channelInput: {
      id: "channel-input",
      attrs: (scope: ScopeLike, arg?: unknown) => {
        const slots = hexSlotOf(arg);
        const isText = slots.channel === "hex";
        const current = channelValueOf(scope.context, slots.channel);
        return {
          type: isText ? "text" : "number",
          dir: scope.context.dir,
          "data-channel": slots.channel,
          "aria-label": slots.channel,
          "data-disabled": dataAttr(scope.context.disabled === true),
          value: current,
          onFocus: (event: FocusEvent): void => {
            if (scope.context.disabled === true || scope.context.readOnly === true) return;
            scope.send({ type: "CHANNEL_INPUT.FOCUS", channel: slots.channel });
            selectText(event.currentTarget);
          },
          onBlur: (event: FocusEvent): void => {
            if (scope.context.disabled === true || scope.context.readOnly === true) return;
            const raw = textOf(event.currentTarget);
            scope.send({ type: "CHANNEL_INPUT.BLUR", channel: slots.channel, value: raw });
          },
          onKeydown: (event: KeyboardEvent): void => {
            if (event.defaultPrevented || isComposing(event)) return;
            if (scope.context.disabled === true || scope.context.readOnly === true) return;
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
      attrs: (scope: ScopeLike) => {
        const name = scope.context.name ?? "";
        return {
          type: "text",
          name: name.length > 0 ? name : undefined,
          tabindex: "-1",
          readonly: scope.context.readOnly === true ? "" : undefined,
          value: valueAsString(scope.context),
        };
      },
    },
    eyeDropperTrigger: {
      id: "eyedropper",
      attrs: (scope) => {
        const supported = eyeDropperSupported();
        return {
          type: "button",
          dir: scope.context.dir,
          "aria-label": "Pick a color from the screen",
          "data-disabled": dataAttr(scope.context.disabled === true),
          hidden: supported ? undefined : "",
          onClick: (): void => {
            if (scope.context.disabled === true || scope.context.readOnly === true) return;
            scope.send({ type: "EYEDROPPER.CLICK" });
          },
        };
      },
    },
    formatSelect: {
      id: "format-select",
      attrs: (scope) => ({
        dir: scope.context.dir,
        "data-disabled": dataAttr(scope.context.disabled === true),
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
      attrs: (scope) => ({ id: scope.id("swatchGroup"), role: "group" }),
    },
    swatchTrigger: {
      id: "swatch",
      attrs: (scope: ScopeLike, arg?: unknown) => {
        const slots = swatchOf(arg);
        const state = swatchState(scope, slots);
        return {
          id: scope.id("swatch", slots.value),
          type: "button",
          dir: scope.context.dir,
          "aria-label": `select ${slots.value} as the color`,
          "data-checked": dataAttr(state.checked),
          "data-value": slots.value,
          "data-disabled": dataAttr(state.disabled),
          // The swatch's color is a published value: the theme paints the
          // chip with it, so it stays a custom property.
          style: { "--picker-swatch": slots.value },
          onClick: (): void => {
            if (state.disabled || scope.context.readOnly === true) return;
            scope.send({ type: "SWATCH_TRIGGER.CLICK", value: slots.value });
          },
        };
      },
    },
    swatchIndicator: {
      id: "swatch-indicator",
      attrs: (scope: ScopeLike, arg?: unknown) => {
        const slots = swatchOf(arg);
        const checked = swatchState(scope, slots).checked;
        return {
          ...ariaHidden("true"),
          "data-checked": dataAttr(checked),
          hidden: checked ? undefined : "",
        };
      },
    },
    swatch: {
      id: "swatch",
      attrs: (scope: ScopeLike, arg?: unknown) => {
        const slots = swatchOf(arg);
        const checked = swatchState(scope, slots).checked;
        return {
          "data-checked": dataAttr(checked),
          "data-value": slots.value,
          style: { "--picker-swatch": slots.value },
        };
      },
    },
  },
  commands: {
    setValue: {
      event: ([value]: [value: string]) => ({ type: "VALUE.SET" as const, value }),
    },
    setFormat: {
      event: ([format]: [format: ColorFormat]) => ({ type: "FORMAT.SET" as const, format }),
    },
    setOpen: { event: ([open]: [open: boolean]) => ({ type: open ? "OPEN" as const : "CLOSE" as const }) },
  },
  readers: {
    open: {
      read: (context: ColorPickerContext, state) => isOpenPhase(state, context.inline),
    },
    value: { read: (context) => context.value },
    valueAsString: { read: (context) => valueAsString(context) },
    format: { read: (context) => context.format },
    disabled: { read: (context) => context.disabled },
    empty: { read: () => false },
  },
  methods: {
    getChannelValue: {
      call: (context: ColorPickerContext, _state, [channel]: [channel: ColorChannel | "hex"]): string => {
        return channelValueOf(context, isChannel(channel) ? channel : "hex");
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
      // Drag release and committed inputs only — every move already reported.
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
} satisfies ComponentDef<ColorPickerContext, ColorPickerEvents, Record<string, unknown>, ColorPickerArgs, ColorPickerState>;

export type ColorPickerApi = ApiOf<typeof def>;
export const colorPicker = defineComponent<ColorPickerContext, ColorPickerEvents, ColorPickerApi, ColorPickerArgs, ColorPickerState>(def);
