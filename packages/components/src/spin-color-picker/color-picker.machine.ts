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
import { createMachine, type Machine, type EventUnion, type MachineSpec } from "@spin/runtime/fsm";
const setValueFromSwatch = (ctx: ColorPickerContext, event: EventUnion<ColorPickerEvents>) : Partial<ColorPickerContext> => {
      if (event.type !== "SWATCH_TRIGGER.CLICK") return {};
      const { color } = parse(event.value, ctx.value);
      return { value: serialize(color, ctx.format) };
    };

const setActiveChannel = (ctx: ColorPickerContext, event: EventUnion<ColorPickerEvents>) : Partial<ColorPickerContext> => {
      if (event.type !== "CHANNEL_INPUT.FOCUS") return {};
      void ctx;
      return { activeChannel: event.channel };
    };

const setChannelFromInput = (ctx: ColorPickerContext, event: EventUnion<ColorPickerEvents>) : Partial<ColorPickerContext> => {
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
    };

const setAreaFromPoint = (ctx: ColorPickerContext, event: EventUnion<ColorPickerEvents>) : Partial<ColorPickerContext> => {
      if (event.type !== "AREA.POINTER_DOWN" && event.type !== "AREA.POINTER_MOVE") return {};
      const { color } = parse(ctx.value, "#000000");
      const areaFormat: AreaFormat = ctx.format.startsWith("hsl") ? "hsla" : "hsba";
      const v = color.toFormat(areaFormat);
      const next = v
        .withChannelValue(ctx.areaX, v.getChannelPercentValue(ctx.areaX, event.x))
        .withChannelValue(ctx.areaY, v.getChannelPercentValue(ctx.areaY, 1 - event.y));
      return { value: serialize(next, ctx.format) };
    };

const setChannelFromPoint = (ctx: ColorPickerContext, event: EventUnion<ColorPickerEvents>) : Partial<ColorPickerContext> => {
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
    };

const isOpenControlled = (ctx: ColorPickerContext) : boolean => { return ctx.inline; };



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

export interface ColorPickerEvents {
  "VALUE.SET": { value: string };
  "FORMAT.SET": { format: ColorFormat | string };
  "OPEN": {};
  "CLOSE": {};
  "CONTROLLED.OPEN": {};
  "CONTROLLED.CLOSE": {};
  "TRIGGER.CLICK": {};
  "TRIGGER.BLUR": {};
  "LAYER.INTERACT_OUTSIDE": {};
  "CHANNEL_INPUT.FOCUS": { channel: ColorChannel };
  "CHANNEL_INPUT.BLUR": { channel: ColorChannel | "hex"; value: string };
  "CHANNEL_INPUT.CHANGE": { channel: ColorChannel | "hex"; value: string };
  "AREA.POINTER_DOWN": { x: number; y: number };
  "AREA.ACTIVATE": {};
  "AREA.POINTER_MOVE": { x: number; y: number };
  "AREA.POINTER_UP": {};
  "AREA.ARROW": { channel: "x" | "y"; delta: number };
  "AREA.HOME_END": { channel: "x" | "y"; toMax: boolean };
  "CHANNEL_SLIDER.POINTER_DOWN": { channel: ColorChannel; percent: number };
  "CHANNEL_SLIDER.ACTIVATE": { channel: ColorChannel };
  "CHANNEL_SLIDER.POINTER_MOVE": { channel: ColorChannel; percent: number };
  "CHANNEL_SLIDER.POINTER_UP": {};
  "CHANNEL_SLIDER.ARROW": { channel: ColorChannel; delta: number };
  "CHANNEL_SLIDER.HOME_END": { channel: ColorChannel; toMax: boolean };
  "SWATCH_TRIGGER.CLICK": { value: string };
  "EYEDROPPER.CLICK": {};
}

export type ColorPickerEvent = EventUnion<ColorPickerEvents>;


const config: MachineSpec<ColorPickerContext, ColorPickerEvents> = {
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
    "VALUE.SET": { assign: (ctx, event) => {
      const { color } = parse(event.value, ctx.value);
      return { value: serialize(color, ctx.format) };
    } },
    "FORMAT.SET": { assign: (ctx, event) => {
      if (!isFormat(event.format)) return {};
      const { color } = parse(ctx.value, "#000000");
      return { format: event.format, value: serialize(color, event.format) };
    } },
    "CHANNEL_INPUT.CHANGE": { assign: setChannelFromInput },
  },
  states: {
    idle: {
      on: {
        "CONTROLLED.OPEN": { target: "active" },
        OPEN: [
          { cond: isOpenControlled },
          { target: "active" },
        ],
        "TRIGGER.CLICK": [
          { cond: isOpenControlled },
          { target: "active" },
        ],
        "CHANNEL_INPUT.FOCUS": { target: "focused", assign: setActiveChannel },
      },
    },
    focused: {
      on: {
        "CONTROLLED.OPEN": { target: "active" },
        OPEN: [
          { cond: isOpenControlled },
          { target: "active" },
        ],
        "TRIGGER.CLICK": [
          { cond: isOpenControlled },
          { target: "active" },
        ],
        "CHANNEL_INPUT.FOCUS": { assign: setActiveChannel },
        "CHANNEL_INPUT.BLUR": { target: "idle", assign: setChannelFromInput },
        "TRIGGER.BLUR": { target: "idle" },
        "SWATCH_TRIGGER.CLICK": { assign: setValueFromSwatch },
      },
    },
    active: {
      on: {
        "CONTROLLED.CLOSE": { target: "idle" },
        CLOSE: [
          { cond: isOpenControlled },
          { target: "idle" },
        ],
        "LAYER.INTERACT_OUTSIDE": [
          { cond: isOpenControlled },
          { target: "idle" },
        ],
        "TRIGGER.CLICK": [
          { cond: isOpenControlled },
          { target: "focused" },
        ],
        "AREA.POINTER_DOWN": { target: "dragging", assign: setAreaFromPoint },
        "AREA.ACTIVATE": { assign: (ctx) => {
      void ctx;
      return { activeChannel: null };
    } },
        "CHANNEL_SLIDER.POINTER_DOWN": {
          target: "dragging",
          assign: setChannelFromPoint,
        },
        "CHANNEL_SLIDER.ACTIVATE": { assign: (ctx, event) => {
      void ctx;
      return { activeChannel: event.channel };
    } },
        "AREA.ARROW": { assign: (ctx, event) => {
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
    } },
        "AREA.HOME_END": { assign: (ctx, event) => {
      const { color } = parse(ctx.value, "#000000");
      const areaFormat: AreaFormat = ctx.format.startsWith("hsl") ? "hsla" : "hsba";
      const v = color.toFormat(areaFormat);
      const channel = event.channel === "x" ? ctx.areaX : ctx.areaY;
      const range = v.getChannelRange(channel);
      if (range === undefined) return {};
      return {
        value: serialize(v.withChannelValue(channel, event.toMax ? range.maxValue : range.minValue), ctx.format),
      };
    } },
        "CHANNEL_SLIDER.ARROW": { assign: (ctx, event) => {
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
    } },
        "CHANNEL_SLIDER.HOME_END": { assign: (ctx, event) => {
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
    } },
        "CHANNEL_INPUT.BLUR": { assign: setChannelFromInput },
        "SWATCH_TRIGGER.CLICK": [
          {
            cond: (ctx) => { return ctx.closeOnSelect; },
            target: "focused",
            assign: setValueFromSwatch,
          },
          { assign: setValueFromSwatch },
        ],
      },
    },
    dragging: {
      on: {
        "AREA.POINTER_MOVE": { assign: setAreaFromPoint },
        "AREA.POINTER_UP": { target: "active" },
        "CHANNEL_SLIDER.POINTER_MOVE": { assign: setChannelFromPoint },
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

const implementations = {};

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
    authored(field) ||
    authored(defaultTwin(field)) ||
    (args as Record<string, unknown>)[defaultTwin(field)] !== undefined;
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
): Machine<ColorPickerContext, ColorPickerEvents> {
  return createMachine<ColorPickerContext, ColorPickerEvents>({
    ...config,
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
