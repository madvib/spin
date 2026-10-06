/**
 * Colour authoring: inverting, mixing, and building ramps.
 *
 * The toolbox a theme author reaches for, as opposed to the parser and the
 * contrast oracle that validation uses. Reading a colour is pipeline work;
 * composing a new one is authoring work. Everything here depends downward on
 * `pipeline/color.ts` and on nothing else.
 *
 * `generateScale` interpolates in OKLab: lightness is a perceptual axis, so
 * stepping it produces a ramp that stays evenly stepped to the eye, and gamut
 * clipping cannot reorder two neighbouring steps.
 */

import {
  formatHex,
  oklabToRgb,
  parseColor,
  rgbToOklab,
} from "../pipeline/color.ts";
import type { Rgb } from "../pipeline/color.ts";

/** Invert a color: `#000000` -> `#ffffff`. Involution — applying twice is identity. */
export function invertColor(input: string): string {
  const { r, g, b } = parseColor(input);
  return formatHex({ r: 255 - r, g: 255 - g, b: 255 - b, a: 1 });
}

/**
 * Mix `a` toward `b` by `amount` (0 keeps `a`, 1 gives `b`) in gamma-encoded
 * sRGB, matching CSS `color-mix(in srgb, A, B)` channel for channel.
 *
 * Gamma space, not linear light: the output of this package is CSS a browser
 * renders, so the arithmetic has to agree with the arithmetic the browser will
 * do. A designer picking a hover tint in Figma gets the same number.
 * Linear-light blending is still used where it is genuinely the right space —
 * see `relativeLuminance` for WCAG contrast.
 */
export function mixColors(a: string, b: string, amount = 0.5): string {
  if (a === b) return formatHex(parseColor(a));
  const from = parseColor(a);
  const to = parseColor(b);
  const t = Math.max(0, Math.min(1, Number.isFinite(amount) ? amount : 1));
  const mix = (x: number, y: number): number => x + (y - x) * t;
  return formatHex({
    r: mix(from.r, to.r),
    g: mix(from.g, to.g),
    b: mix(from.b, to.b),
    a: 1,
  });
}

/**
 * Build a `steps`-long ramp from black to white tinted with `base`'s hue.
 *
 * Lightness walks OKLab L linearly from 0 to 1, so the ends are exactly black
 * and white and relative luminance rises strictly across the array whatever
 * `base` is. Chroma follows a sine hump — the base's chroma at mid-ramp, fading
 * to nothing at both ends — which keeps the near-black and near-white steps
 * from reading as saturated navy and pale cyan.
 */
export function generateScale(base: string, steps = 11): string[] {
  if (!Number.isInteger(steps) || steps < 0) {
    throw new RangeError(`steps must be a non-negative integer, got ${steps}`);
  }
  if (steps === 0) return [];

  const { r, g, b } = parseColor(base);
  const lab = rgbToOklab(r, g, b);
  const chroma = Math.hypot(lab.a, lab.b);
  const hue = Math.atan2(lab.b, lab.a);

  const out: string[] = [];
  for (let i = 0; i < steps; i++) {
    const t = steps === 1 ? 0 : i / (steps - 1);
    const c = chroma * Math.sin(Math.PI * t);
    const srgb: Rgb = oklabToRgb(t, c * Math.cos(hue), c * Math.sin(hue));
    out.push(formatHex(srgb));
  }
  return out;
}
