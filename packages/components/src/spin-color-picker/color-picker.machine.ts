/**
 * Color-picker machine: closed (idle), focused, open (active), dragging.
 *
 * Zag nests `open.{idle,dragging}` under an `open` parent whose handlers the
 * children share. The fork has no nesting, so the open parent's handlers sit
 * at the root tier and the closed states shadow what they must not inherit.
 *
 * The color travels as a STRING: context must stay serializable for the
 * scope channel, so every assign parses, mutates through the Color object,
 * and writes back the string in the machine's format.
 *
 * Geometry is NOT here: area and channel drags compute their percent in the
 * view and send events carrying that percent; the machine turns percent into
 * channel values.
 */

import { parseColor, type ColorChannel } from "@zag-js/color-utils";
import { defaultTwin } from "@spin/runtime";
import { createMachine, type Machine } from "@spin/runtime/fsm";

export type ColorFormat = "hex" | "hexa" | "rgb" | "rgba" | "hsl" | "hsla" | "hsb" | "hsba";

export interface ColorPickerContext {
  value: string;
  format: ColorFormat;
  activeChannel: ColorChannel | null;
  areaX: ColorChannel;
  areaY: ColorChannel;
  disabled: boolean;
  readOnly: boolean;
  closeOnSelect: boolean;
  inline: boolean;
}

export type ColorPickerEvent =
  | { type: "VALUE.SET"; value: string }
  | { type: "FORMAT.SET"; format: ColorFormat | string }
  | { type: "OPEN" }
  | { type: "CLOSE" }
  | { type: "CONTROLLED.OPEN" }
  | { type: "CONTROLLED.CLOSE" }
  | { type: "TRIGGER.CLICK" }
  | { type: "TRIGGER.BLUR" }
  | { type: "LAYER.INTERACT_OUTSIDE" }
  | { type: "CHANNEL_INPUT.FOCUS"; channel: ColorChannel }
  | { type: "CHANNEL_INPUT.BLUR"; channel: ColorChannel | "hex"; value: string }
  | { type: "CHANNEL_INPUT.CHANGE"; channel: ColorChannel | "hex"; value: string }
  | { type: "AREA.POINTER_DOWN"; x: number; y: number }
  | { type: "AREA.ACTIVATE" }
  | { type: "AREA.POINTER_MOVE"; x: number; y: number }
  | { type: "AREA.POINTER_UP" }
  | { type: "AREA.ARROW"; channel: "x" | "y"; delta: number }
  | { type: "AREA.HOME_END"; channel: "x" | "y"; toMax: boolean }
  | { type: "CHANNEL_SLIDER.POINTER_DOWN"; channel: ColorChannel; percent: number }
  | { type: "CHANNEL_SLIDER.ACTIVATE"; channel: ColorChannel }
  | { type: "CHANNEL_SLIDER.POINTER_MOVE"; channel: ColorChannel; percent: number }
  | { type: "CHANNEL_SLIDER.POINTER_UP" }
  | { type: "CHANNEL_SLIDER.ARROW"; channel: ColorChannel; delta: number }
  | { type: "CHANNEL_SLIDER.HOME_END"; channel: ColorChannel; toMax: boolean }
  | { type: "SWATCH_TRIGGER.CLICK"; value: string }
  | { type: "EYEDROPPER.CLICK" };

const config = {
  id: "color-picker",
  initial: "idle",
  context: {
    value: "#000000",
    format: "hex" as ColorFormat,
    activeChannel: null as ColorChannel | null,
    areaX: "saturation" as ColorChannel,
    areaY: "brightness" as ColorChannel,
    disabled: false,
    readOnly: false,
    closeOnSelect: false,
    inline: false,
  },
  on: {
    "VALUE.SET": { actions: [{ assign: "setValue" }] },
    "FORMAT.SET": { actions: [{ assign: "setFormat" }] },
    "CHANNEL_INPUT.CHANGE": { actions: [{ assign: "setChannelFromInput" }] },
  },
  states: {
    idle: {
      on: {
        "CONTROLLED.OPEN": { target: "active" },
        OPEN: [
          { cond: "isOpenControlled", actions: [] },
          { target: "active" },
        ],
        "TRIGGER.CLICK": [
          { cond: "isOpenControlled", actions: [] },
          { target: "active" },
        ],
        "CHANNEL_INPUT.FOCUS": { target: "focused", actions: [{ assign: "setActiveChannel" }] },
      },
    },
    focused: {
      on: {
        "CONTROLLED.OPEN": { target: "active" },
        OPEN: [
          { cond: "isOpenControlled", actions: [] },
          { target: "active" },
        ],
        "TRIGGER.CLICK": [
          { cond: "isOpenControlled", actions: [] },
          { target: "active" },
        ],
        "CHANNEL_INPUT.FOCUS": { actions: [{ assign: "setActiveChannel" }] },
        "CHANNEL_INPUT.BLUR": { target: "idle", actions: [{ assign: "setChannelFromInput" }] },
        "TRIGGER.BLUR": { target: "idle" },
        "SWATCH_TRIGGER.CLICK": { actions: [{ assign: "setValueFromSwatch" }] },
      },
    },
    active: {
      on: {
        "CONTROLLED.CLOSE": { target: "idle" },
        CLOSE: [
          { cond: "isOpenControlled", actions: [] },
          { target: "idle" },
        ],
        "LAYER.INTERACT_OUTSIDE": [
          { cond: "isOpenControlled", actions: [] },
          { target: "idle" },
        ],
        "TRIGGER.CLICK": [
          { cond: "isOpenControlled", actions: [] },
          { target: "focused" },
        ],
        "AREA.POINTER_DOWN": { target: "dragging", actions: [{ assign: "setAreaFromPoint" }] },
        "AREA.ACTIVATE": { actions: [{ assign: "setAreaActive" }] },
        "CHANNEL_SLIDER.POINTER_DOWN": {
          target: "dragging",
          actions: [{ assign: "setChannelFromPoint" }],
        },
        "CHANNEL_SLIDER.ACTIVATE": { actions: [{ assign: "setChannelActive" }] },
        "AREA.ARROW": { actions: [{ assign: "stepArea" }] },
        "AREA.HOME_END": { actions: [{ assign: "edgeArea" }] },
        "CHANNEL_SLIDER.ARROW": { actions: [{ assign: "stepChannel" }] },
        "CHANNEL_SLIDER.HOME_END": { actions: [{ assign: "edgeChannel" }] },
        "CHANNEL_INPUT.BLUR": { actions: [{ assign: "setChannelFromInput" }] },
        "SWATCH_TRIGGER.CLICK": [
          {
            cond: "closeOnSelect",
            target: "focused",
            actions: [{ assign: "setValueFromSwatch" }],
          },
          { actions: [{ assign: "setValueFromSwatch" }] },
        ],
      },
    },
    dragging: {
      on: {
        "AREA.POINTER_MOVE": { actions: [{ assign: "setAreaFromPoint" }] },
        "AREA.POINTER_UP": { target: "active" },
        "CHANNEL_SLIDER.POINTER_MOVE": { actions: [{ assign: "setChannelFromPoint" }] },
        "CHANNEL_SLIDER.POINTER_UP": { target: "active" },
      },
    },
  },
};

const parse = (value: string, fallback: string): { color: ReturnType<typeof parseColor>; raw: string } => {
  try {
    return { color: parseColor(value), raw: value };
  } catch {
    return { color: parseColor(fallback), raw: fallback };
  }
};

const serialize = (color: ReturnType<typeof parseColor>, format: ColorFormat): string => {
  try {
    return color.toString(format);
  } catch {
    return color.toString("hex");
  }
};

type AreaFormat = "hsla" | "hsba";

const implementations = {
  conds: {
    // Inline means controlled: the host owns the visibility.
    isOpenControlled: (ctx: ColorPickerContext): boolean => ctx.inline,
    closeOnSelect: (ctx: ColorPickerContext): boolean => ctx.closeOnSelect,
  },
  assigns: {
    setValue: (ctx: ColorPickerContext, event: ColorPickerEvent): Partial<ColorPickerContext> => {
      if (event.type !== "VALUE.SET") return {};
      const { color } = parse(event.value, ctx.value);
      return { value: serialize(color, ctx.format) };
    },
    setValueFromSwatch: (ctx: ColorPickerContext, event: ColorPickerEvent): Partial<ColorPickerContext> => {
      if (event.type !== "SWATCH_TRIGGER.CLICK") return {};
      const { color } = parse(event.value, ctx.value);
      return { value: serialize(color, ctx.format) };
    },
    setFormat: (ctx: ColorPickerContext, event: ColorPickerEvent): Partial<ColorPickerContext> => {
      if (event.type !== "FORMAT.SET") return {};
      if (!isFormat(event.format)) return {};
      const { color } = parse(ctx.value, "#000000");
      return { format: event.format, value: serialize(color, event.format) };
    },
    setActiveChannel: (ctx: ColorPickerContext, event: ColorPickerEvent): Partial<ColorPickerContext> => {
      if (event.type !== "CHANNEL_INPUT.FOCUS") return {};
      void ctx;
      return { activeChannel: event.channel };
    },
    setAreaActive: (ctx: ColorPickerContext): Partial<ColorPickerContext> => {
      void ctx;
      return { activeChannel: null };
    },
    setChannelActive: (ctx: ColorPickerContext, event: ColorPickerEvent): Partial<ColorPickerContext> => {
      if (event.type !== "CHANNEL_SLIDER.ACTIVATE") return {};
      void ctx;
      return { activeChannel: event.channel };
    },
    setChannelFromInput: (ctx: ColorPickerContext, event: ColorPickerEvent): Partial<ColorPickerContext> => {
      if (event.type !== "CHANNEL_INPUT.BLUR" && event.type !== "CHANNEL_INPUT.CHANGE") return {};
      const { color } = parse(ctx.value, "#000000");
      if (event.channel === "alpha") {
        const n = parseFloat(event.value);
        if (Number.isNaN(n)) return {};
        return { value: serialize(color.withChannelValue("alpha", n), ctx.format) };
      }
      if (event.channel === "hex") {
        const { color: next } = parse(event.value.startsWith("#") ? event.value : `#${event.value}`, ctx.value);
        const alpha = color.getChannelValue("alpha");
        return { value: serialize(next.withChannelValue("alpha", alpha), ctx.format) };
      }
      const n = parseFloat(event.value);
      if (Number.isNaN(n)) return {};
      const inFormat = color;
      return { value: serialize(inFormat.withChannelValue(event.channel, n), ctx.format) };
    },
    setAreaFromPoint: (ctx: ColorPickerContext, event: ColorPickerEvent): Partial<ColorPickerContext> => {
      if (event.type !== "AREA.POINTER_DOWN" && event.type !== "AREA.POINTER_MOVE") return {};
      const { color } = parse(ctx.value, "#000000");
      const areaFormat: AreaFormat = ctx.format.startsWith("hsl") ? "hsla" : "hsba";
      const v = color.toFormat(areaFormat);
      const next = v
        .withChannelValue(ctx.areaX, v.getChannelPercentValue(ctx.areaX, event.x))
        .withChannelValue(ctx.areaY, v.getChannelPercentValue(ctx.areaY, 1 - event.y));
      return { value: serialize(next, ctx.format) };
    },
    setChannelFromPoint: (ctx: ColorPickerContext, event: ColorPickerEvent): Partial<ColorPickerContext> => {
      if (
        event.type !== "CHANNEL_SLIDER.POINTER_DOWN" &&
        event.type !== "CHANNEL_SLIDER.POINTER_MOVE"
      ) return {};
      const { color } = parse(ctx.value, "#000000");
      const next = color.withChannelValue(
        event.channel,
        color.getChannelPercentValue(event.channel, event.percent),
      );
      return { value: serialize(next, ctx.format) };
    },
    stepArea: (ctx: ColorPickerContext, event: ColorPickerEvent): Partial<ColorPickerContext> => {
      if (event.type !== "AREA.ARROW") return {};
      // The area's channels live in the area format (hsla/hsba): an rgb color
      // has no saturation channel, so stepping it throws. Convert first, step,
      // serialize back — Zag's `areaValue`.
      const { color } = parse(ctx.value, "#000000");
      const areaFormat: AreaFormat = ctx.format.startsWith("hsl") ? "hsla" : "hsba";
      const v = color.toFormat(areaFormat);
      const channel = event.channel === "x" ? ctx.areaX : ctx.areaY;
      const stepped = event.delta > 0
        ? v.incrementChannel(channel, event.delta)
        : v.decrementChannel(channel, -event.delta);
      return { value: serialize(stepped, ctx.format) };
    },
    edgeArea: (ctx: ColorPickerContext, event: ColorPickerEvent): Partial<ColorPickerContext> => {
      if (event.type !== "AREA.HOME_END") return {};
      const { color } = parse(ctx.value, "#000000");
      const areaFormat: AreaFormat = ctx.format.startsWith("hsl") ? "hsla" : "hsba";
      const v = color.toFormat(areaFormat);
      const channel = event.channel === "x" ? ctx.areaX : ctx.areaY;
      const range = v.getChannelRange(channel);
      if (range === undefined) return {};
      return {
        value: serialize(v.withChannelValue(channel, event.toMax ? range.maxValue : range.minValue), ctx.format),
      };
    },
    stepChannel: (ctx: ColorPickerContext, event: ColorPickerEvent): Partial<ColorPickerContext> => {
      if (event.type !== "CHANNEL_SLIDER.ARROW") return {};
      // Hue/saturation/brightness are not rgb channels: without a format the
      // slider computes against the area value (hsla/hsba), Zag's
      // `normalizedValue` fallback. Alpha converts to itself.
      const { color } = parse(ctx.value, "#000000");
      const areaFormat: AreaFormat = ctx.format.startsWith("hsl") ? "hsla" : "hsba";
      const v = event.channel === "alpha" ? color : color.toFormat(areaFormat);
      const stepped = event.delta > 0
        ? v.incrementChannel(event.channel, event.delta)
        : v.decrementChannel(event.channel, -event.delta);
      return { value: serialize(stepped, ctx.format) };
    },
    edgeChannel: (ctx: ColorPickerContext, event: ColorPickerEvent): Partial<ColorPickerContext> => {
      if (event.type !== "CHANNEL_SLIDER.HOME_END") return {};
      const { color } = parse(ctx.value, "#000000");
      const areaFormat: AreaFormat = ctx.format.startsWith("hsl") ? "hsla" : "hsba";
      const v = event.channel === "alpha" ? color : color.toFormat(areaFormat);
      const range = v.getChannelRange(event.channel);
      if (range === undefined) return {};
      return {
        value: serialize(
          v.withChannelValue(event.channel, event.toMax ? range.maxValue : range.minValue),
          ctx.format,
        ),
      };
    },
  },
};

/** The color-picker's arguments: the values the host may set. */
export interface ColorPickerArgs {
  value?: string;
  format?: string;
  inline?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  closeOnSelect?: boolean;
  defaultInline?: boolean;
}

const FORMATS: readonly string[] = ["hex", "hexa", "rgb", "rgba", "hsl", "hsla", "hsb", "hsba"];

const isFormat = (raw: unknown): raw is ColorFormat =>
  typeof raw === "string" && (FORMATS as readonly string[]).includes(raw);

const textOf = (raw: unknown, fallback: string): string =>
  typeof raw === "string" && raw.length > 0 ? raw : fallback;

/**
 * The color the host wrote, normalized the way the machine's own assigns
 * would: the value first in hex, then reserialized in the format — a color
 * with an alpha loses it in hex and keeps it in the format.
 */
const valueOf = (raw: unknown, format: ColorFormat): string => {
  const hex = serialize(parse(textOf(raw, "#000000"), "#000000").color, "hex");
  return serialize(parse(hex, "#000000").color, format);
};

export function initial(args: ColorPickerArgs, authored: (name: string) => boolean): ColorPickerContext {
  // A host that wrote the twin (`defaultValue`) wrote the channel too.
  const written = (field: string): boolean =>
    authored(field) || authored(defaultTwin(field));
  const format = written("format")
    ? (isFormat(args.format) ? args.format : "hex")
    : "hex";
  return {
    value: written("value")
      ? valueOf(args.value, format)
      : valueOf("#000000", format),
    format,
    activeChannel: null,
    areaX: "saturation",
    areaY: "brightness",
    disabled: written("disabled") ? args.disabled === true : false,
    readOnly: written("readOnly") ? args.readOnly === true : false,
    closeOnSelect: written("closeOnSelect") ? args.closeOnSelect === true : false,
    inline: written("inline") ? args.inline === true : false,
  };
}

export function startOpen(raw: Record<string, unknown>): boolean {
  if (typeof raw["open"] === "boolean") return raw["open"];
  return raw["inline"] === true || raw["defaultOpen"] === true;
}

/** True when the panel shows; inline is always open. */
export const isOpenPhase = (phase: string, inline: boolean): boolean =>
  inline || phase === "active" || phase === "dragging";

export const valueAsString = (ctx: ColorPickerContext): string => ctx.value;

export function colorPicker(
  args: ColorPickerArgs = {},
  authored: (name: string) => boolean,
): Machine<ColorPickerContext, ColorPickerEvent> {
  return createMachine<ColorPickerContext, ColorPickerEvent>({
    ...config,
    ...implementations,
    context: initial(args, authored),
    fields: {
      value: { event: "VALUE.SET" },
      format: { event: "FORMAT.SET" },
      disabled: {},
      readOnly: {},
      closeOnSelect: {},
      inline: {},
    },
  });
}
