/**
 * Color-picker machine: closed and unfocused, closed and focused, open with
 * the user driving (`active`), open with a drag in flight (`dragging`).
 *
 * Zag nests `open.{idle,dragging}` under an `open` parent whose handlers the
 * children share. The fork has no nesting, so the open parent's handlers sit
 * at the root tier (the events that work from every open phase) and the
 * closed states shadow what they must not inherit — the same shape as the
 * combobox's open parent.
 *
 * The color travels as a STRING. Context must stay serializable for the
 * scope channel, so every assign parses, mutates through the Color object,
 * and writes back the string in the machine's format. `parseColor` is the
 * only import from `@zag-js/color-utils` — the machine owns no color math
 * of its own.
 *
 * Geometry is NOT here. Area and channel drags compute their percent in the
 * view (against the node the pointer is over) and send events carrying that
 * percent; the machine turns percent into channel values. What the machine
 * does read is the format and the active channel, synced from scope by the
 * bridge, because parsing and stepping are statements about the color, not
 * about nodes.
 */

import { parseColor, type ColorChannel } from "@zag-js/color-utils";

export type ColorFormat = "hex" | "hexa" | "rgb" | "rgba" | "hsl" | "hsla" | "hsb" | "hsba";

export interface ColorPickerContext {
  /** The color, serialized in `format`. */
  value: string;
  format: ColorFormat;
  /** The channel the focused input or drag owns. */
  activeChannel: ColorChannel | null;
  /** The area's x/y channels. */
  areaX: ColorChannel;
  areaY: ColorChannel;
  disabled: boolean;
  readOnly: boolean;
  closeOnSelect: boolean;
  inline: boolean;
}

export type ColorPickerEvent =
  | { type: "VALUE.SET"; value: string }
  | { type: "FORMAT.SET"; format: ColorFormat }
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

export const config = {
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

/** Parse, tolerating garbage: an unparseable string keeps the old color. */
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

export const implementations = {
  conds: {
    // Controlled inline is always open: the host owns the visibility.
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
      // The area's channels live in the area format (hsla/hsba): an rgb
      // color has no saturation channel, so stepping it throws. Convert
      // first, step, serialize back — which is Zag's `areaValue`.
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
      // slider computes against the area value (hsla/hsba), which is Zag's
      // `normalizedValue` fallback. Alpha exists everywhere, so it converts
      // to itself.
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

/** True when the panel shows. Inline is always open: the host owns it. */
export const isOpenPhase = (phase: string, inline: boolean): boolean =>
  inline || phase === "active" || phase === "dragging";

/** The value string the hidden input carries. */
export const valueAsString = (ctx: ColorPickerContext): string => ctx.value;
