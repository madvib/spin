/**
 * The color value: parse, convert, serialize, and step one channel.
 *
 * @zag-js/color-utils, MIT, (c) Zag. The upstream package owns the
 * contract this file keeps: the parse shapes, the conversion formulas,
 * the serialization cases, and the channel ranges. Vendored so the
 * color-picker stands on the runtime's own math instead of the package.
 */

import {
  clampValue,
  getPercentValue,
  getValuePercent,
  snapValueToStep,
} from "@spinjs/components/runtime";

/** A channel the picker reads, writes, or steps. */
export type ColorChannel =
  | "hue"
  | "saturation"
  | "brightness"
  | "lightness"
  | "red"
  | "green"
  | "blue"
  | "alpha";

/** The three spaces a color converts between. */
export type ColorFormat = "rgba" | "hsla" | "hsba";

/** The serializations `toString` accepts. */
export type ColorStringFormat =
  | "hex"
  | "hexa"
  | "rgb"
  | "hsl"
  | "hsb"
  | ColorFormat
  | "css";

/** The stepped range a channel moves within. */
export interface ColorChannelRange {
  readonly minValue: number;
  readonly maxValue: number;
  readonly step: number;
  readonly pageSize: number;
}

const toFixedNumber = (value: number, digits: number): number => {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
};

const mod = (value: number, m: number): number => ((value % m) + m) % m;

const equalsRecord = (
  a: Record<string, number>,
  b: Record<string, number>,
): boolean => {
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;
  for (const key of keys) {
    if (a[key] !== b[key]) return false;
  }
  return true;
};

const NATIVE_COLORS =
  "aliceblue:f0f8ff,antiquewhite:faebd7,aqua:00ffff,aquamarine:7fffd4,azure:f0ffff," +
  "beige:f5f5dc,bisque:ffe4c4,black:000000,blanchedalmond:ffebcd,blue:0000ff," +
  "blueviolet:8a2be2,brown:a52a2a,burlywood:deb887,cadetblue:5f9ea0,chartreuse:7fff00," +
  "chocolate:d2691e,coral:ff7f50,cornflowerblue:6495ed,cornsilk:fff8dc,crimson:dc143c," +
  "cyan:00ffff,darkblue:00008b,darkcyan:008b8b,darkgoldenrod:b8860b,darkgray:a9a9a9," +
  "darkgreen:006400,darkkhaki:bdb76b,darkmagenta:8b008b,darkolivegreen:556b2f," +
  "darkorange:ff8c00,darkorchid:9932cc,darkred:8b0000,darksalmon:e9967a," +
  "darkseagreen:8fbc8f,darkslateblue:483d8b,darkslategray:2f4f4f,darkturquoise:00ced1," +
  "darkviolet:9400d3,deeppink:ff1493,deepskyblue:00bfff,dimgray:696969," +
  "dodgerblue:1e90ff,firebrick:b22222,floralwhite:fffaf0,forestgreen:228b22," +
  "fuchsia:ff00ff,gainsboro:dcdcdc,ghostwhite:f8f8ff,gold:ffd700,goldenrod:daa520," +
  "gray:808080,green:008000,greenyellow:adff2f,honeydew:f0fff0,hotpink:ff69b4," +
  "indianred:cd5c5c,indigo:4b0082,ivory:fffff0,khaki:f0e68c,lavender:e6e6fa," +
  "lavenderblush:fff0f5,lawngreen:7cfc00,lemonchiffon:fffacd,lightblue:add8e6," +
  "lightcoral:f08080,lightcyan:e0ffff,lightgoldenrodyellow:fafad2,lightgrey:d3d3d3," +
  "lightgreen:90ee90,lightpink:ffb6c1,lightsalmon:ffa07a,lightseagreen:20b2aa," +
  "lightskyblue:87cefa,lightslategray:778899,lightsteelblue:b0c4de," +
  "lightyellow:ffffe0,lime:00ff00,limegreen:32cd32,linen:faf0e6,magenta:ff00ff," +
  "maroon:800000,mediumaquamarine:66cdaa,mediumblue:0000cd,mediumorchid:ba55d3," +
  "mediumpurple:9370d8,mediumseagreen:3cb371,mediumslateblue:7b68ee," +
  "mediumspringgreen:00fa9a,mediumturquoise:48d1cc,mediumvioletred:c71585," +
  "midnightblue:191970,mintcream:f5fffa,mistyrose:ffe4e1,moccasin:ffe4b5," +
  "navajowhite:ffdead,navy:000080,oldlace:fdf5e6,olive:808000,olivedrab:6b8e23," +
  "orange:ffa500,orangered:ff4500,orchid:da70d6,palegoldenrod:eee8aa," +
  "palegreen:98fb98,paleturquoise:afeeee,palevioletred:d87093,papayawhip:ffefd5," +
  "peachpuff:ffdab9,peru:cd853f,pink:ffc0cb,plum:dda0dd,powderblue:b0e0e6," +
  "purple:800080,rebeccapurple:663399,red:ff0000,rosybrown:bc8f8f," +
  "royalblue:4169e1,saddlebrown:8b4513,salmon:fa8072,sandybrown:f4a460," +
  "seagreen:2e8b57,seashell:fff5ee,sienna:a0522d,silver:c0c0c0,skyblue:87ceeb," +
  "slateblue:6a5acd,slategray:708090,snow:fffafa,springgreen:00ff7f," +
  "steelblue:4682b4,tan:d2b48c,teal:008080,thistle:d8bfd8,tomato:ff6347," +
  "turquoise:40e0d0,violet:ee82ee,wheat:f5deb3,white:ffffff,whitesmoke:f5f5f5," +
  "yellow:ffff00,yellowgreen:9acd32";

const nativeColorMap = (() => {
  const map = new Map<string, string>();
  for (const entry of NATIVE_COLORS.split(",")) {
    const [name, hex] = entry.split(":");
    if (name === undefined || hex === undefined) continue;
    map.set(name, `#${hex}`);
    if (name.includes("gray")) map.set(name.replace("gray", "grey"), `#${hex}`);
  }
  return map;
})();

/** The color contract: what the picker reads off any parsed value. */
export interface Color {
  toFormat(format: ColorFormat): Color;
  toString(format?: ColorStringFormat): string;
  getChannelValue(channel: ColorChannel): number;
  withChannelValue(channel: ColorChannel, value: number): Color;
  getChannelRange(channel: ColorChannel): ColorChannelRange;
  getChannelValuePercent(channel: ColorChannel, value?: number): number;
  getChannelPercentValue(channel: ColorChannel, percent: number): number;
  incrementChannel(channel: ColorChannel, stepSize: number): Color;
  decrementChannel(channel: ColorChannel, stepSize: number): Color;
  toJSON(): Record<string, number>;
  clone(): Color;
  getFormat(): ColorFormat;
  isEqual(color: Color): boolean;
}

abstract class ColorBase implements Color {
  abstract toFormat(format: ColorFormat): Color;
  abstract toString(format?: ColorStringFormat): string;
  abstract getChannelRange(channel: ColorChannel): ColorChannelRange;
  abstract toJSON(): Record<string, number>;
  abstract clone(): Color;
  abstract getFormat(): ColorFormat;

  getChannelValue(channel: ColorChannel): number {
    if (channel in this) {
      return (this as unknown as Record<ColorChannel, number>)[channel];
    }
    throw new Error(`Unsupported color channel: ${channel}`);
  }

  getChannelValuePercent(channel: ColorChannel, value?: number): number {
    const current = value ?? this.getChannelValue(channel);
    const { minValue, maxValue } = this.getChannelRange(channel);
    return getValuePercent(current, minValue, maxValue);
  }

  getChannelPercentValue(channel: ColorChannel, percent: number): number {
    const { minValue, maxValue, step } = this.getChannelRange(channel);
    return snapValueToStep(
      getPercentValue(percent, minValue, maxValue, step),
      minValue,
      maxValue,
      step,
    );
  }

  withChannelValue(channel: ColorChannel, value: number): Color {
    const { minValue, maxValue } = this.getChannelRange(channel);
    if (channel in this) {
      const clone = this.clone() as unknown as Record<ColorChannel, number>;
      clone[channel] = clampValue(value, minValue, maxValue);
      return clone as unknown as Color;
    }
    throw new Error(`Unsupported color channel: ${channel}`);
  }

  incrementChannel(channel: ColorChannel, stepSize: number): Color {
    const { minValue, maxValue, step } = this.getChannelRange(channel);
    const value = snapValueToStep(
      clampValue(
        this.getChannelValue(channel) + stepSize,
        minValue,
        maxValue,
      ),
      minValue,
      maxValue,
      step,
    );
    return this.withChannelValue(channel, value);
  }

  decrementChannel(channel: ColorChannel, stepSize: number): Color {
    return this.incrementChannel(channel, -stepSize);
  }

  isEqual(color: Color): boolean {
    return (
      equalsRecord(this.toJSON(), color.toJSON()) &&
      this.getChannelValue("alpha") === color.getChannelValue("alpha")
    );
  }
}

class RGBColor extends ColorBase {
  readonly red: number;
  readonly green: number;
  readonly blue: number;
  readonly alpha: number;

  constructor(red: number, green: number, blue: number, alpha: number) {
    super();
    this.red = red;
    this.green = green;
    this.blue = blue;
    this.alpha = alpha;
  }

  static parse(value: string): RGBColor | undefined {
    const colors: number[] = [];
    if (HEX_COLOR_REGEX.test(value) && [4, 5, 7, 9].includes(value.length)) {
      const digits = (value.length < 6
        ? value.replace(HEX_STARTING_REGEX, "$&$&")
        : value).slice(1).split("");
      while (digits.length > 0) {
        colors.push(parseInt(digits.splice(0, 2).join(""), 16));
      }
      colors[3] = colors[3] !== undefined ? colors[3] / 255 : undefined as unknown as number;
    }
    const match = value.match(RGB_COLOR_REGEX);
    if (match?.[1] !== undefined) {
      const parsed = match[1].split(",").map((part) => Number(part.trim())).map(
        (num, i) => clampValue(num, 0, i < 3 ? 255 : 1),
      );
      colors.length = 0;
      colors.push(...parsed);
    }
    if (colors.length < 3) return undefined;
    return new RGBColor(colors[0]!, colors[1]!, colors[2]!, colors[3] ?? 1);
  }

  override toString(format: ColorStringFormat = "css"): string {
    switch (format) {
      case "hex":
        return "#" + (this.red.toString(16).padStart(2, "0") +
          this.green.toString(16).padStart(2, "0") +
          this.blue.toString(16).padStart(2, "0")).toUpperCase();
      case "hexa":
        return "#" + (this.red.toString(16).padStart(2, "0") +
          this.green.toString(16).padStart(2, "0") +
          this.blue.toString(16).padStart(2, "0") +
          Math.round(this.alpha * 255).toString(16).padStart(2, "0")).toUpperCase();
      case "rgb":
        return `rgb(${this.red}, ${this.green}, ${this.blue})`;
      case "css":
      case "rgba":
        return `rgba(${this.red}, ${this.green}, ${this.blue}, ${this.alpha})`;
      case "hsl":
        return this.toHSL().toString("hsl");
      case "hsb":
        return this.toHSB().toString("hsb");
      default:
        return this.toFormat(format).toString(format);
    }
  }

  toFormat(format: ColorFormat): Color {
    switch (format) {
      case "rgba":
        return this;
      case "hsba":
        return this.toHSB();
      case "hsla":
        return this.toHSL();
      default:
        throw new Error(`Unsupported color conversion: rgb -> ${format}`);
    }
  }

  toHSB(): HSBColor {
    const red = this.red / 255;
    const green = this.green / 255;
    const blue = this.blue / 255;
    const min = Math.min(red, green, blue);
    const brightness = Math.max(red, green, blue);
    const chroma = brightness - min;
    const saturation = brightness === 0 ? 0 : chroma / brightness;
    let hue = 0;
    if (chroma !== 0) {
      switch (brightness) {
        case red:
          hue = (green - blue) / chroma + (green < blue ? 6 : 0);
          break;
        case green:
          hue = (blue - red) / chroma + 2;
          break;
        case blue:
          hue = (red - green) / chroma + 4;
          break;
      }
      hue /= 6;
    }
    return new HSBColor(
      toFixedNumber(hue * 360, 2),
      toFixedNumber(saturation * 100, 2),
      toFixedNumber(brightness * 100, 2),
      toFixedNumber(this.alpha, 2),
    );
  }

  toHSL(): HSLColor {
    const red = this.red / 255;
    const green = this.green / 255;
    const blue = this.blue / 255;
    const min = Math.min(red, green, blue);
    const max = Math.max(red, green, blue);
    const lightness = (max + min) / 2;
    const chroma = max - min;
    let hue = 0;
    let saturation = 0;
    if (chroma !== 0) {
      saturation = chroma / (lightness < 0.5 ? max + min : 2 - max - min);
      switch (max) {
        case red:
          hue = (green - blue) / chroma + (green < blue ? 6 : 0);
          break;
        case green:
          hue = (blue - red) / chroma + 2;
          break;
        case blue:
          hue = (red - green) / chroma + 4;
          break;
      }
      hue /= 6;
    }
    return new HSLColor(
      toFixedNumber(hue * 360, 2),
      toFixedNumber(saturation * 100, 2),
      toFixedNumber(lightness * 100, 2),
      toFixedNumber(this.alpha, 2),
    );
  }

  clone(): Color {
    return new RGBColor(this.red, this.green, this.blue, this.alpha);
  }

  getChannelRange(channel: ColorChannel): ColorChannelRange {
    switch (channel) {
      case "red":
      case "green":
      case "blue":
        return { minValue: 0, maxValue: 255, step: 1, pageSize: 17 };
      case "alpha":
        return { minValue: 0, maxValue: 1, step: 0.01, pageSize: 0.1 };
      default:
        throw new Error(`Unknown color channel: ${channel}`);
    }
  }

  toJSON(): Record<string, number> {
    return { r: this.red, g: this.green, b: this.blue, a: this.alpha };
  }

  getFormat(): ColorFormat {
    return "rgba";
  }
}

const HEX_COLOR_REGEX = /^#[\da-f]+$/i;
const RGB_COLOR_REGEX = /^rgba?\((.*)\)$/;
const HEX_STARTING_REGEX = /[^#]/gi;

class HSLColor extends ColorBase {
  readonly hue: number;
  readonly saturation: number;
  readonly lightness: number;
  readonly alpha: number;

  constructor(hue: number, saturation: number, lightness: number, alpha: number) {
    super();
    this.hue = hue;
    this.saturation = saturation;
    this.lightness = lightness;
    this.alpha = alpha;
  }

  static parse(value: string): HSLColor | undefined {
    const match = value.match(HSL_REGEX);
    if (match === null) return undefined;
    const [h, s, l, a] = (match[1] ?? match[2] ?? "").split(",").map((n) =>
      Number(n.trim().replace("%", ""))
    );
    return new HSLColor(
      mod(h ?? 0, 360),
      clampValue(s ?? 0, 0, 100),
      clampValue(l ?? 0, 0, 100),
      clampValue(a ?? 1, 0, 1),
    );
  }

  override toString(format: ColorStringFormat = "css"): string {
    switch (format) {
      case "hex":
        return this.toRGB().toString("hex");
      case "hexa":
        return this.toRGB().toString("hexa");
      case "hsl":
        return `hsl(${this.hue}, ${toFixedNumber(this.saturation, 2)}%, ${toFixedNumber(this.lightness, 2)}%)`;
      case "css":
      case "hsla":
        return `hsla(${this.hue}, ${toFixedNumber(this.saturation, 2)}%, ${toFixedNumber(this.lightness, 2)}%, ${this.alpha})`;
      case "hsb":
        return this.toHSB().toString("hsb");
      case "rgb":
        return this.toRGB().toString("rgb");
      default:
        return this.toFormat(format).toString(format);
    }
  }

  toFormat(format: ColorFormat): Color {
    switch (format) {
      case "hsla":
        return this;
      case "hsba":
        return this.toHSB();
      case "rgba":
        return this.toRGB();
      default:
        throw new Error(`Unsupported color conversion: hsl -> ${format}`);
    }
  }

  toHSB(): HSBColor {
    const saturation = this.saturation / 100;
    const lightness = this.lightness / 100;
    const brightness = lightness + saturation * Math.min(lightness, 1 - lightness);
    const next = brightness === 0 ? 0 : 2 * (1 - lightness / brightness);
    return new HSBColor(
      toFixedNumber(this.hue, 2),
      toFixedNumber(next * 100, 2),
      toFixedNumber(brightness * 100, 2),
      toFixedNumber(this.alpha, 2),
    );
  }

  toRGB(): RGBColor {
    const hue = this.hue;
    const saturation = this.saturation / 100;
    const lightness = this.lightness / 100;
    const a = saturation * Math.min(lightness, 1 - lightness);
    const fn = (n: number, k = (n + hue / 30) % 12): number =>
      lightness - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return new RGBColor(
      Math.round(fn(0) * 255),
      Math.round(fn(8) * 255),
      Math.round(fn(4) * 255),
      toFixedNumber(this.alpha, 2),
    );
  }

  clone(): Color {
    return new HSLColor(this.hue, this.saturation, this.lightness, this.alpha);
  }

  getChannelRange(channel: ColorChannel): ColorChannelRange {
    switch (channel) {
      case "hue":
        return { minValue: 0, maxValue: 360, step: 1, pageSize: 15 };
      case "saturation":
      case "lightness":
        return { minValue: 0, maxValue: 100, step: 1, pageSize: 10 };
      case "alpha":
        return { minValue: 0, maxValue: 1, step: 0.01, pageSize: 0.1 };
      default:
        throw new Error(`Unknown color channel: ${channel}`);
    }
  }

  toJSON(): Record<string, number> {
    return { h: this.hue, s: this.saturation, l: this.lightness, a: this.alpha };
  }

  getFormat(): ColorFormat {
    return "hsla";
  }
}

const HSL_REGEX =
  /hsl\(([-+]?\d+(?:.\d+)?\s*,\s*[-+]?\d+(?:.\d+)?%\s*,\s*[-+]?\d+(?:.\d+)?%)\)|hsla\(([-+]?\d+(?:.\d+)?\s*,\s*[-+]?\d+(?:.\d+)?%\s*,\s*[-+]?\d+(?:.\d+)?%\s*,\s*[-+]?\d(.\d+)?)\)/;

class HSBColor extends ColorBase {
  readonly hue: number;
  readonly saturation: number;
  readonly brightness: number;
  readonly alpha: number;

  constructor(hue: number, saturation: number, brightness: number, alpha: number) {
    super();
    this.hue = hue;
    this.saturation = saturation;
    this.brightness = brightness;
    this.alpha = alpha;
  }

  static parse(value: string): HSBColor | undefined {
    const match = value.match(HSB_REGEX);
    if (match === null) return undefined;
    const [h, s, b, a] = (match[1] ?? match[2] ?? "").split(",").map((n) =>
      Number(n.trim().replace("%", ""))
    );
    return new HSBColor(
      mod(h ?? 0, 360),
      clampValue(s ?? 0, 0, 100),
      clampValue(b ?? 0, 0, 100),
      clampValue(a ?? 1, 0, 1),
    );
  }

  override toString(format: ColorStringFormat = "css"): string {
    switch (format) {
      case "css":
        return this.toHSL().toString("css");
      case "hex":
        return this.toRGB().toString("hex");
      case "hexa":
        return this.toRGB().toString("hexa");
      case "hsb":
        return `hsb(${this.hue}, ${toFixedNumber(this.saturation, 2)}%, ${toFixedNumber(this.brightness, 2)}%)`;
      case "hsba":
        return `hsba(${this.hue}, ${toFixedNumber(this.saturation, 2)}%, ${toFixedNumber(this.brightness, 2)}%, ${this.alpha})`;
      case "hsl":
        return this.toHSL().toString("hsl");
      case "rgb":
        return this.toRGB().toString("rgb");
      default:
        return this.toFormat(format).toString(format);
    }
  }

  toFormat(format: ColorFormat): Color {
    switch (format) {
      case "hsba":
        return this;
      case "hsla":
        return this.toHSL();
      case "rgba":
        return this.toRGB();
      default:
        throw new Error(`Unsupported color conversion: hsb -> ${format}`);
    }
  }

  toHSL(): HSLColor {
    const saturation = this.saturation / 100;
    const brightness = this.brightness / 100;
    const lightness = brightness * (1 - saturation / 2);
    const next = lightness === 0 || lightness === 1
      ? 0
      : (brightness - lightness) / Math.min(lightness, 1 - lightness);
    return new HSLColor(
      toFixedNumber(this.hue, 2),
      toFixedNumber(next * 100, 2),
      toFixedNumber(lightness * 100, 2),
      toFixedNumber(this.alpha, 2),
    );
  }

  toRGB(): RGBColor {
    const hue = this.hue;
    const saturation = this.saturation / 100;
    const brightness = this.brightness / 100;
    const fn = (n: number, k = (n + hue / 60) % 6): number =>
      brightness - saturation * brightness * Math.max(Math.min(k, 4 - k, 1), 0);
    return new RGBColor(
      Math.round(fn(5) * 255),
      Math.round(fn(3) * 255),
      Math.round(fn(1) * 255),
      toFixedNumber(this.alpha, 2),
    );
  }

  clone(): Color {
    return new HSBColor(this.hue, this.saturation, this.brightness, this.alpha);
  }

  getChannelRange(channel: ColorChannel): ColorChannelRange {
    switch (channel) {
      case "hue":
        return { minValue: 0, maxValue: 360, step: 1, pageSize: 15 };
      case "saturation":
      case "brightness":
        return { minValue: 0, maxValue: 100, step: 1, pageSize: 10 };
      case "alpha":
        return { minValue: 0, maxValue: 1, step: 0.01, pageSize: 0.1 };
      default:
        throw new Error(`Unknown color channel: ${channel}`);
    }
  }

  toJSON(): Record<string, number> {
    return {
      h: this.hue,
      s: this.saturation,
      b: this.brightness,
      a: this.alpha,
    };
  }

  getFormat(): ColorFormat {
    return "hsba";
  }
}

const HSB_REGEX =
  /hsb\(([-+]?\d+(?:.\d+)?\s*,\s*[-+]?\d+(?:.\d+)?%\s*,\s*[-+]?\d+(?:.\d+)?%)\)|hsba\(([-+]?\d+(?:.\d+)?\s*,\s*[-+]?\d+(?:.\d+)?%\s*,\s*[-+]?\d+(?:.\d+)?%\s*,\s*[-+]?\d(.\d+)?)\)/;

/** Parse any supported color string; named colors resolve to hex first. */
export function parseColor(value: string): Color {
  const native = nativeColorMap.get(value);
  if (native !== undefined) return parseColor(native);
  const result = RGBColor.parse(value) ?? HSBColor.parse(value) ??
    HSLColor.parse(value);
  if (result === undefined) throw new Error(`Invalid color value: ${value}`);
  return result;
}
