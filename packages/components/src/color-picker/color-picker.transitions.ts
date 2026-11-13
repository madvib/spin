import type { AssignFor, GuardFor } from "@spinjs/components/fsm";
import type { ColorPickerEvents } from "./color-picker.events.ts";
import {
  type AreaFormat,
  type ColorFormat,
  type ColorPickerContext,
  parse,
  serialize,
} from "./color-picker.state.ts";
import { isFormat } from "./color-picker.state.ts";

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

function isAchromatic(
  v: ReturnType<ReturnType<typeof parse>["color"]["toFormat"]>,
  areaFormat: AreaFormat,
): boolean {
  if (v.getChannelValue("saturation") === 0) return true;
  return areaFormat === "hsba"
    ? v.getChannelValue("brightness") === 0
    : v.getChannelValue("lightness") === 0 ||
      v.getChannelValue("lightness") === 100;
}

function areaColorOf(ctx: ColorPickerContext) {
  const { color } = parse(ctx.value, "#000000");
  const areaFormat: AreaFormat = ctx.format.startsWith("hsl") ? "hsla" : "hsba";
  const v = color.toFormat(areaFormat);
  return isAchromatic(v, areaFormat) ? v.withChannelValue("hue", ctx.hue) : v;
}

function preservedHueOf(
  color: ReturnType<typeof parse>["color"],
  format: ColorFormat,
  fallbackHue: number,
): number {
  const areaFormat: AreaFormat = format.startsWith("hsl") ? "hsla" : "hsba";
  const v = color.toFormat(areaFormat);
  return isAchromatic(v, areaFormat) ? fallbackHue : v.getChannelValue("hue");
}

export const setValueFromSwatch: ColorPickerAssign<"SWATCH_TRIGGER.CLICK"> = (
  ctx,
  event,
) => {
  const { color } = parse(event.value, ctx.value);
  return {
    value: serialize(color, ctx.format),
    hue: preservedHueOf(color, ctx.format, ctx.hue),
  };
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
      hue: preservedHueOf(next, ctx.format, ctx.hue),
    };
  }
  const n = parseFloat(event.value);
  if (Number.isNaN(n)) return {};
  if (event.channel === "hue") {
    const v = areaColorOf(ctx).withChannelValue("hue", n);
    return { value: serialize(v, ctx.format), hue: v.getChannelValue("hue") };
  }
  const inFormat = event.channel === "saturation" ||
      event.channel === "brightness" || event.channel === "lightness"
    ? areaColorOf(ctx)
    : color;
  const updated = inFormat.withChannelValue(event.channel, n);
  return {
    value: serialize(updated, ctx.format),
    hue: preservedHueOf(updated, ctx.format, ctx.hue),
  };
};

export const setAreaFromPoint: ColorPickerAssign<
  "AREA.POINTER_DOWN" | "AREA.POINTER_MOVE"
> = (ctx, event) => {
  const v = areaColorOf(ctx);
  const next = v
    .withChannelValue(ctx.areaX, v.getChannelPercentValue(ctx.areaX, event.x))
    .withChannelValue(
      ctx.areaY,
      v.getChannelPercentValue(ctx.areaY, 1 - event.y),
    );
  return {
    value: serialize(next, ctx.format),
    hue: next.getChannelValue("hue"),
  };
};
export const setChannelFromPoint: ColorPickerAssign<
  "CHANNEL_SLIDER.POINTER_DOWN" | "CHANNEL_SLIDER.POINTER_MOVE"
> = (ctx, event) => {
  const { color } = parse(ctx.value, "#000000");
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
    const source = areaColorOf(ctx);
    const next = source.withChannelValue(
      channel,
      source.getChannelPercentValue(channel, event.percent),
    );
    return {
      value: serialize(next, ctx.format),
      hue: channel === "hue" ? next.getChannelValue("hue") : ctx.hue,
    };
  } catch {
    return { value: native() };
  }
};

export const setValue: ColorPickerAssign<"VALUE.SET"> = (ctx, event) => {
  const { color } = parse(event.value, ctx.value);
  return {
    value: serialize(color, ctx.format),
    hue: preservedHueOf(color, ctx.format, ctx.hue),
  };
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
  const v = areaColorOf(ctx);
  const channel = event.channel === "x" ? ctx.areaX : ctx.areaY;
  const stepped = event.delta > 0
    ? v.incrementChannel(channel, event.delta)
    : v.decrementChannel(channel, -event.delta);
  return {
    value: serialize(stepped, ctx.format),
    hue: stepped.getChannelValue("hue"),
  };
};

export const boundAreaValue: ColorPickerAssign<"AREA.HOME_END"> = (
  ctx,
  event,
) => {
  const v = areaColorOf(ctx);
  const channel = event.channel === "x" ? ctx.areaX : ctx.areaY;
  const range = v.getChannelRange(channel);
  if (range === undefined) return {};
  const next = v.withChannelValue(
    channel,
    event.toMax ? range.maxValue : range.minValue,
  );
  return {
    value: serialize(next, ctx.format),
    hue: next.getChannelValue("hue"),
  };
};

export const stepChannelValue: ColorPickerAssign<"CHANNEL_SLIDER.ARROW"> = (
  ctx,
  event,
) => {
  const { color } = parse(ctx.value, "#000000");
  const native = event.channel === "alpha" || event.channel === "red" ||
    event.channel === "green" || event.channel === "blue";
  const v = native ? color : areaColorOf(ctx);
  const stepped = event.delta > 0
    ? v.incrementChannel(event.channel, event.delta)
    : v.decrementChannel(event.channel, -event.delta);
  return {
    value: serialize(stepped, ctx.format),
    hue: event.channel === "hue" ? stepped.getChannelValue("hue") : ctx.hue,
  };
};

export const boundChannelValue: ColorPickerAssign<"CHANNEL_SLIDER.HOME_END"> = (
  ctx,
  event,
) => {
  const { color } = parse(ctx.value, "#000000");
  const native = event.channel === "alpha" || event.channel === "red" ||
    event.channel === "green" || event.channel === "blue";
  const v = native ? color : areaColorOf(ctx);
  const range = v.getChannelRange(event.channel);
  if (range === undefined) return {};
  const next = v.withChannelValue(
    event.channel,
    event.toMax ? range.maxValue : range.minValue,
  );
  return {
    value: serialize(next, ctx.format),
    hue: event.channel === "hue" ? next.getChannelValue("hue") : ctx.hue,
  };
};

export const isOpenControlled: ColorPickerGuard = (ctx) => ctx.inline;
