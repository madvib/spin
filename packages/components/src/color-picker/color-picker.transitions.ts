import type { AssignFor, GuardFor } from "@spinjs/runtime/fsm";
import type { ColorPickerEvents } from "./color-picker.events.ts";
import {
  type AreaFormat,
  type ColorFormat,
  type ColorPickerContext,
  parse,
  serialize,
} from "./color-picker.state.ts";
import { isFormat } from "./color-picker.state.ts";
import type { ColorChannel } from "./color.ts";

type ColorPickerAssign<
  K extends keyof ColorPickerEvents = keyof ColorPickerEvents,
> = AssignFor<
  ColorPickerContext,
  ColorPickerEvents,
  K
>;
type ColorPickerGuard<
  K extends keyof ColorPickerEvents = keyof ColorPickerEvents,
> = GuardFor<
  ColorPickerContext,
  ColorPickerEvents,
  K
>;

export const setValueFromSwatch: ColorPickerAssign<"SWATCH_TRIGGER.CLICK"> = (
  ctx,
  event,
) => {
  const { color } = parse(event.value, ctx.value);
  return { value: serialize(color, ctx.format) };
};

export const setActiveChannel: ColorPickerAssign<"CHANNEL_INPUT.FOCUS"> = (
  _ctx,
  event,
) => {
  return event.channel === "hex" ? {} : { activeChannel: event.channel };
};

export const setChannelFromInput: ColorPickerAssign<
  "CHANNEL_INPUT.BLUR" | "CHANNEL_INPUT.CHANGE"
> = (ctx, event) => {
  const { color } = parse(ctx.value, "#000000");
  if (event.channel === "alpha") {
    const n = parseFloat(event.value);
    if (Number.isNaN(n)) return {};
    return { value: serialize(color.withChannelValue("alpha", n), ctx.format) };
  }
  if (event.channel === "hex") {
    const { color: next } = parse(
      event.value.startsWith("#") ? event.value : `#${event.value}`,
      ctx.value,
    );
    const alpha = color.getChannelValue("alpha");
    return {
      value: serialize(next.withChannelValue("alpha", alpha), ctx.format),
    };
  }
  const n = parseFloat(event.value);
  if (Number.isNaN(n)) return {};
  const inFormat = color;
  return {
    value: serialize(inFormat.withChannelValue(event.channel, n), ctx.format),
  };
};

export const setAreaFromPoint: ColorPickerAssign<
  "AREA.POINTER_DOWN" | "AREA.POINTER_MOVE"
> = (ctx, event) => {
  const { color } = parse(ctx.value, "#000000");
  const areaFormat: AreaFormat = ctx.format.startsWith("hsl") ? "hsla" : "hsba";
  const v = color.toFormat(areaFormat);
  const next = v
    .withChannelValue(ctx.areaX, v.getChannelPercentValue(ctx.areaX, event.x))
    .withChannelValue(
      ctx.areaY,
      v.getChannelPercentValue(ctx.areaY, 1 - event.y),
    );
  return { value: serialize(next, ctx.format) };
};

export const setChannelFromPoint: ColorPickerAssign<
  "CHANNEL_SLIDER.POINTER_DOWN" | "CHANNEL_SLIDER.POINTER_MOVE"
> = (ctx, event) => {
  const { color } = parse(ctx.value, "#000000");
  const areaFormat: AreaFormat = ctx.format.startsWith("hsl") ? "hsla" : "hsba";
  const channel = event.channel;
  const native = (): string => {
    const next = color.withChannelValue(
      channel,
      color.getChannelPercentValue(channel, event.percent),
    );
    return serialize(next, ctx.format);
  };
  // Hue/saturation/brightness/lightness are not rgb channels: read them off
  // the area value, the way the machine steps them. Alpha and rgb natively.
  if (channel === "alpha" || channel === "red" || channel === "green" || channel === "blue") {
    return { value: native() };
  }
  try {
    const source = color.toFormat(areaFormat);
    const next = source.withChannelValue(
      channel,
      source.getChannelPercentValue(channel, event.percent),
    );
    return { value: serialize(next, ctx.format) };
  } catch {
    return { value: native() };
  }
};

export const setValue: ColorPickerAssign<"VALUE.SET"> = (ctx, event) => {
  const { color } = parse(event.value, ctx.value);
  return { value: serialize(color, ctx.format) };
};

export const setFormat: ColorPickerAssign<"FORMAT.SET"> = (ctx, event) => {
  if (!isFormat(event.format)) return {};
  const { color } = parse(ctx.value, "#000000");
  return { format: event.format, value: serialize(color, event.format) };
};

export const clearActiveChannel: ColorPickerAssign<"AREA.ACTIVATE"> = () => ({
  activeChannel: null,
});

export const setSliderChannel: ColorPickerAssign<"CHANNEL_SLIDER.ACTIVATE"> = (
  _ctx,
  event,
) => ({
  activeChannel: event.channel,
});

export const stepAreaValue: ColorPickerAssign<"AREA.ARROW"> = (ctx, event) => {
  const { color } = parse(ctx.value, "#000000");
  const areaFormat: AreaFormat = ctx.format.startsWith("hsl") ? "hsla" : "hsba";
  const v = color.toFormat(areaFormat);
  const channel = event.channel === "x" ? ctx.areaX : ctx.areaY;
  const stepped = event.delta > 0
    ? v.incrementChannel(channel, event.delta)
    : v.decrementChannel(channel, -event.delta);
  return { value: serialize(stepped, ctx.format) };
};

export const boundAreaValue: ColorPickerAssign<"AREA.HOME_END"> = (
  ctx,
  event,
) => {
  const { color } = parse(ctx.value, "#000000");
  const areaFormat: AreaFormat = ctx.format.startsWith("hsl") ? "hsla" : "hsba";
  const v = color.toFormat(areaFormat);
  const channel = event.channel === "x" ? ctx.areaX : ctx.areaY;
  const range = v.getChannelRange(channel);
  if (range === undefined) return {};
  return {
    value: serialize(
      v.withChannelValue(
        channel,
        event.toMax ? range.maxValue : range.minValue,
      ),
      ctx.format,
    ),
  };
};

export const stepChannelValue: ColorPickerAssign<"CHANNEL_SLIDER.ARROW"> = (
  ctx,
  event,
) => {
  const { color } = parse(ctx.value, "#000000");
  const areaFormat: AreaFormat = ctx.format.startsWith("hsl") ? "hsla" : "hsba";
  const native = event.channel === "alpha" || event.channel === "red" ||
    event.channel === "green" || event.channel === "blue";
  const v = native ? color : color.toFormat(areaFormat);
  const stepped = event.delta > 0
    ? v.incrementChannel(event.channel, event.delta)
    : v.decrementChannel(event.channel, -event.delta);
  return { value: serialize(stepped, ctx.format) };
};

export const boundChannelValue: ColorPickerAssign<"CHANNEL_SLIDER.HOME_END"> = (
  ctx,
  event,
) => {
  const { color } = parse(ctx.value, "#000000");
  const areaFormat: AreaFormat = ctx.format.startsWith("hsl") ? "hsla" : "hsba";
  const native = event.channel === "alpha" || event.channel === "red" ||
    event.channel === "green" || event.channel === "blue";
  const v = native ? color : color.toFormat(areaFormat);
  const range = v.getChannelRange(event.channel);
  if (range === undefined) return {};
  return {
    value: serialize(
      v.withChannelValue(
        event.channel,
        event.toMax ? range.maxValue : range.minValue,
      ),
      ctx.format,
    ),
  };
};

export const isOpenControlled: ColorPickerGuard = (ctx) => ctx.inline;
