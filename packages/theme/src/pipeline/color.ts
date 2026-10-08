/**
 * Colour reading, conversion, and contrast.
 *
 * Everything the pipeline and the contract need: whether a value is a colour,
 * what a colour looks like in another space, and whether two are readable
 * against each other. It lives in `pipeline/` because validation depends on
 * it — a validator reaching into an authoring toolbox would depend upward on
 * the wrong layer.
 *
 * Alpha is accepted on input and kept in `parseColor` for callers that care.
 * `formatHex` drops it by default — a translucent token is authored as
 * `oklch(... / 50%)` in its own right — and emits `#rrggbbaa` only when asked.
 */

/**
 * CSS-wide color keywords. No token file declares them, so the theme owns the
 * list: they are color vocabulary, and a utility in a color position that
 * names one is a raw color, not a token reference.
 */
export const CSS_WIDE_COLORS = ["transparent", "currentColor"] as const;

/** A parsed color. Channels are 0-255; `a` is 0-1. */
export interface Rgb {
  r: number;
  g: number;
  b: number;
  a: number;
}

const HEX_DIGITS: Record<string, number> = {
  "0": 0,
  "1": 1,
  "2": 2,
  "3": 3,
  "4": 4,
  "5": 5,
  "6": 6,
  "7": 7,
  "8": 8,
  "9": 9,
  a: 10,
  b: 11,
  c: 12,
  d: 13,
  e: 14,
  f: 15,
};

/** Channel value as written in a hex literal — throws on a non-hex character. */
function hexDigit(char: string): number {
  const value = Object.hasOwn(HEX_DIGITS, char) ? HEX_DIGITS[char] : undefined;
  if (value === undefined) throw new RangeError(`invalid hex digit "${char}"`);
  return value;
}

function clampByte(value: number): number {
  const n = Math.round(value);
  return n < 0 ? 0 : n > 255 ? 255 : n;
}

function byteHex(value: number): string {
  return clampByte(value).toString(16).padStart(2, "0");
}

/** Parse hex, `rgb()`, `oklch()`, `oklab()` and `color(display-p3 …)`. */
export function parseColor(input: string): Rgb {
  const text = input.trim();
  const hex = /^#([0-9a-fA-F]{3,8})$/.exec(text);
  if (hex) return parseHexBody(hex[1] as string);

  const fn = /^rgba?\(([^)]*)\)$/i.exec(text);
  if (fn) {
    const parts = (fn[1] as string).split(/[\s,/]+/).filter(Boolean);
    if (parts.length < 3) {
      throw new SyntaxError(`invalid rgb() color "${input}"`);
    }
    const [r, g, b] = parts as [string, string, string];
    return {
      r: clampByte(parseChannel(r)),
      g: clampByte(parseChannel(g)),
      b: clampByte(parseChannel(b)),
      a: parts.length > 3 ? clampAlpha(parseChannel(parts[3] as string)) : 1,
    };
  }

  const oklch = /^oklch\(([^)]*)\)$/i.exec(text);
  if (oklch) return parseOklch(oklch[1] as string, input);

  const oklab = /^oklab\(([^)]*)\)$/i.exec(text);
  if (oklab) return parseOklab(oklab[1] as string, input);

  const p3 = /^color\(\s*display-p3\s+([^)]*)\)$/i.exec(text);
  if (p3) return parseDisplayP3(p3[1] as string, input);

  throw new SyntaxError(`unsupported color syntax "${input}"`);
}

function splitAlpha(body: string): [string, string | undefined] {
  const slash = body.indexOf("/");
  if (slash === -1) return [body, undefined];
  return [body.slice(0, slash), body.slice(slash + 1)];
}

function parseAlpha(text: string | undefined, input: string): number {
  if (text === undefined) return 1;
  const trimmed = text.trim();
  const n = trimmed.endsWith("%")
    ? parseFloat(trimmed) / 100
    : parseFloat(trimmed);
  if (!Number.isFinite(n)) {
    throw new SyntaxError(`invalid alpha in color "${input}"`);
  }
  return clampAlpha(n);
}

function parseHue(text: string, input: string): number {
  const trimmed = text.trim();
  if (/(turn|rad|grad)$/i.test(trimmed)) {
    throw new SyntaxError(`unsupported hue unit in color "${input}"`);
  }
  const degrees = parseFloat(trimmed);
  if (!Number.isFinite(degrees)) {
    throw new SyntaxError(`invalid hue in color "${input}"`);
  }
  return (degrees * Math.PI) / 180;
}

function parseOklch(body: string, input: string): Rgb {
  const [components, alpha] = splitAlpha(body);
  const parts = components.split(/\s+/).filter(Boolean);
  if (parts.length !== 3) {
    throw new SyntaxError(`invalid oklch() color "${input}"`);
  }
  const [l, c, h] = parts as [string, string, string];
  const lightness = l.endsWith("%") ? parseFloat(l) / 100 : parseFloat(l);
  const chroma = c.endsWith("%") ? (parseFloat(c) / 100) * 0.4 : parseFloat(c);
  if (!Number.isFinite(lightness) || !Number.isFinite(chroma)) {
    throw new SyntaxError(`invalid oklch() color "${input}"`);
  }
  const hue = parseHue(h, input);
  const { r, g, b } = oklabToRgb(
    lightness,
    chroma * Math.cos(hue),
    chroma * Math.sin(hue),
  );
  return { r, g, b, a: parseAlpha(alpha, input) };
}

function parseOklab(body: string, input: string): Rgb {
  const [components, alpha] = splitAlpha(body);
  const parts = components.split(/\s+/).filter(Boolean);
  if (parts.length !== 3) {
    throw new SyntaxError(`invalid oklab() color "${input}"`);
  }
  const values = parts.map((part) => parseFloat(part));
  if (values.some((value) => !Number.isFinite(value))) {
    throw new SyntaxError(`invalid oklab() color "${input}"`);
  }
  const [L, a, b] = values as [number, number, number];
  const { r, g, b: blue } = oklabToRgb(L, a, b);
  return { r, g, b: blue, a: parseAlpha(alpha, input) };
}

function parseDisplayP3(body: string, input: string): Rgb {
  const [components, alpha] = splitAlpha(body);
  const parts = components.split(/\s+/).filter(Boolean);
  if (parts.length !== 3) {
    throw new SyntaxError(`invalid display-p3 color "${input}"`);
  }
  const channels = parts.map((part) =>
    part.endsWith("%") ? parseFloat(part) / 100 : parseFloat(part)
  );
  if (channels.some((channel) => !Number.isFinite(channel))) {
    throw new SyntaxError(`invalid display-p3 color "${input}"`);
  }
  const [r, g, b] = channels as [number, number, number];
  const lr = decodeGamma(r);
  const lg = decodeGamma(g);
  const lb = decodeGamma(b);
  const x = 0.4865709 * lr + 0.2656677 * lg + 0.1982173 * lb;
  const y = 0.2289746 * lr + 0.6917385 * lg + 0.0792869 * lb;
  const z = 0.0451134 * lg + 1.0439443 * lb;
  return {
    r: channelFromLinear(3.2404542 * x - 1.5371385 * y - 0.4985314 * z),
    g: channelFromLinear(-0.969266 * x + 1.8760108 * y + 0.041556 * z),
    b: channelFromLinear(0.0556434 * x - 0.2040259 * y + 1.0572252 * z),
    a: parseAlpha(alpha, input),
  };
}

function parseHexBody(rawBody: string): Rgb {
  // CSS hex is case-insensitive and token files in the wild are mixed-case;
  // every table lookup below is lowercase, so fold once here.
  const body = rawBody.toLowerCase();
  const size = body.length;
  if (size !== 3 && size !== 4 && size !== 6 && size !== 8) {
    throw new SyntaxError(
      `hex color must have 3, 4, 6 or 8 digits, got ${size}`,
    );
  }
  const short = size < 6;
  const at = (index: number): number =>
    short
      ? hexDigit(body[index] as string) * 17
      : hexDigit(body[index * 2] as string) * 16 +
        hexDigit(body[index * 2 + 1] as string);
  return {
    r: at(0),
    g: at(1),
    b: at(2),
    a: size === 4 || size === 8 ? at(3) / 255 : 1,
  };
}

/** A numeric color channel: `255`, `40%`, or `0.5` for alpha. */
function parseChannel(text: string): number {
  return text.endsWith("%") ? (parseFloat(text) / 100) * 255 : parseFloat(text);
}

function clampAlpha(value: number): number {
  const n = Number.isFinite(value) ? value : 1;
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

/** Format parsed channels as lowercase `#rrggbb` (or `#rrggbbaa` if translucent). */
export function formatHex(color: Rgb, keepAlpha = false): string {
  const base = `#${byteHex(color.r)}${byteHex(color.g)}${byteHex(color.b)}`;
  if (!keepAlpha || color.a >= 1) return base;
  return base + byteHex(color.a * 255);
}

/** True when `input` is a color this module can parse. */
export function isColor(input: unknown): input is string {
  if (typeof input !== "string") return false;
  try {
    parseColor(input);
    return true;
  } catch {
    return false;
  }
}

/** Gamma-encoded channel 0-1 -> linear-light 0-1. */
export function decodeGamma(c: number): number {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** Linear-light 0-1 -> gamma-encoded 0-1. */
export function encodeGamma(c: number): number {
  return c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055;
}

/** An 8-bit gamma-encoded channel as linear light 0-1. */
function channelToLinear(byte: number): number {
  return decodeGamma(byte / 255);
}

/** Linear light 0-1 as an 8-bit gamma-encoded channel. */
function channelFromLinear(value: number): number {
  return clampByte(encodeGamma(value) * 255);
}

/** sRGB to OKLab. The perceptual space every ramp in this package walks. */
export function rgbToOklab(r: number, g: number, b: number) {
  const lr = decodeGamma(clampByte(r) / 255);
  const lg = decodeGamma(clampByte(g) / 255);
  const lb = decodeGamma(clampByte(b) / 255);

  const l = Math.cbrt(
    0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb,
  );
  const m = Math.cbrt(
    0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb,
  );
  const s = Math.cbrt(
    0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb,
  );

  return {
    L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  };
}

/** OKLab to sRGB, clipped to gamut on the way out. */
export function oklabToRgb(L: number, a: number, b: number): Rgb {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;

  return {
    r: channelFromLinear(
      4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    ),
    g: channelFromLinear(
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    ),
    b: channelFromLinear(
      -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
    ),
    a: 1,
  };
}

/** WCAG 2.1 relative luminance of a color, 0 (black) to 1 (white). */
export function relativeLuminance(input: string): number {
  const { r, g, b } = parseColor(input);
  return 0.2126 * channelToLinear(r) + 0.7152 * channelToLinear(g) +
    0.0722 * channelToLinear(b);
}

/**
 * WCAG 2.1 contrast ratio between two colors, 1 to 21, symmetric.
 *
 * Rounded to four decimals: the exact float for black against white is
 * 21.000000000000004, which no reader wants to see in a token report.
 */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return Math.round(((hi + 0.05) / (lo + 0.05)) * 10000) / 10000;
}
