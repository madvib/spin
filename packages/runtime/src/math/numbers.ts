/**
 * Value math: pure functions over numbers and arrays, typed to return
 * `number` (never `number | undefined`).
 *
 * Vendored from `@zag-js/utils` (`dist/number.mjs`, MIT) with two changes:
 * the NaN-guard is explicit (`nan` → 0 is preserved — a missing value is
 * the bound, not an error), and every function declares its real return
 * type so call sites need no `as number`. The logic is byte-identical;
 * only the types are tighter. If the upstream changes, re-vendor and
 * re-run this file's tests.
 *
 * Plus the generic shapes components kept re-deriving: `closestIndex`
 * (later wins ties — thumb stacking needs determinism), `round10`, and
 * `isInteractive` (structural: any context with the two flags).
 *
 * Rules for this module: pure functions only (no machine, DOM, or signal
 * imports), total (no `null` returns — a missing value is the bound), and
 * deterministic (same inputs, same outputs — testable without a machine).
 */

const { abs, floor, max, min, pow, round, sign } = Math;

const nan = (v: number): number => Number.isNaN(v) ? 0 : v;

/** Clamp into range; NaN reads as the lower bound. */
export function clampValue(v: number, vmin: number, vmax: number): number {
  return min(max(nan(v), vmin), vmax);
}

/** The position of a value in its range, as 0..1. */
export function getValuePercent(v: number, vmin: number, vmax: number): number {
  return (nan(v) - vmin) / (vmax - vmin);
}

function roundValue(v: number, vmin: number, step: number): number {
  return round((nan(v) - vmin) / step) * step + vmin;
}

/** The value at a percent of a stepped range, clamped. */
export function getPercentValue(p: number, vmin: number, vmax: number, step: number): number {
  return clampValue(roundValue(p * (vmax - vmin) + vmin, vmin, step), vmin, vmax);
}

function roundToStepPrecision(v: number, step: number): number {
  let rv = v;
  const ss = step.toString();
  const pi = ss.indexOf(".");
  const p = pi >= 0 ? ss.length - pi : 0;
  if (p > 0) {
    const pw = pow(10, p);
    rv = round(rv * pw) / pw;
  }
  return rv;
}

/** Snap to the step grid with float-precision correction, clamped to the
 * largest valid step (not just the max — `max` may not sit on the grid). */
export function snapValueToStep(v: number, vmin: number, vmax: number, step: number): number {
  const min2 = vmin != null ? Number(vmin) : 0;
  const max2 = Number(vmax);
  const remainder = (v - min2) % step;
  let snapped = abs(remainder) * 2 >= step ? v + sign(remainder) * (step - abs(remainder)) : v - remainder;
  snapped = roundToStepPrecision(snapped, step);
  if (!Number.isNaN(min2) && snapped < min2) {
    snapped = min2;
  } else if (!Number.isNaN(max2) && snapped > max2) {
    const stepsInRange = floor((max2 - min2) / step);
    const largestValidStep = min2 + stepsInRange * step;
    snapped = stepsInRange <= 0 || largestValidStep < min2 ? max2 : largestValidStep;
  }
  return roundToStepPrecision(snapped, step);
}

/** Per-thumb clamp windows from neighbors plus the gap. */
export function getValueRanges(
  vs: readonly number[],
  vmin: number,
  vmax: number,
  gap: number,
): readonly { readonly min: number; readonly max: number; readonly value: number }[] {
  return vs.map((v, i) => ({
    min: i === 0 ? vmin : (vs[i - 1] ?? vmin) + gap,
    max: i === vs.length - 1 ? vmax : (vs[i + 1] ?? vmax) - gap,
    value: v,
  }));
}

function getMinValueAtIndex(index: number, values: readonly number[], vmin: number): number {
  return index === 0 ? vmin : values[index - 1] ?? vmin;
}

function getMaxValueAtIndex(index: number, values: readonly number[], vmax: number): number {
  return index === values.length - 1 ? vmax : values[index + 1] ?? vmax;
}

/** Step the thumb at `index` up, clamped to its neighbors. */
export function getNextStepValue(
  index: number,
  ctx: { readonly values: readonly number[]; readonly min: number; readonly max: number; readonly step: number },
): readonly number[] {
  const next = [...ctx.values];
  next[index] = snapValueToStep(
    (ctx.values[index] ?? ctx.min) + ctx.step,
    getMinValueAtIndex(index, ctx.values, ctx.min),
    getMaxValueAtIndex(index, ctx.values, ctx.max),
    ctx.step,
  );
  return next;
}

/** Step the thumb at `index` down, clamped to its neighbors. */
export function getPreviousStepValue(
  index: number,
  ctx: { readonly values: readonly number[]; readonly min: number; readonly max: number; readonly step: number },
): readonly number[] {
  const next = [...ctx.values];
  next[index] = snapValueToStep(
    (ctx.values[index] ?? ctx.min) - ctx.step,
    getMinValueAtIndex(index, ctx.values, ctx.min),
    getMaxValueAtIndex(index, ctx.values, ctx.max),
    ctx.step,
  );
  return next;
}

/** Later thumbs win ties: deterministic under stacking. */
export function closestIndex(values: readonly number[], pointValue: number): number {
  let closest = 0;
  let distance = Math.abs((values[0] ?? 0) - pointValue);
  for (let i = 1; i < values.length; i += 1) {
    const next = Math.abs((values[i] ?? 0) - pointValue);
    if (next <= distance) {
      closest = i;
      distance = next;
    }
  }
  return closest;
}

/** Round to 10 decimal places: float-arithmetic residue cleanup. */
export function round10(value: number): number {
  return Math.round(value * 1e10) / 1e10;
}

/** An interactive context: neither read-only nor disabled. Structural —
 * any context with the two flags qualifies, no base type required. */
export function isInteractive<C extends { readonly readOnly?: boolean; readonly disabled?: boolean }>(
  context: C,
): boolean {
  return context.readOnly !== true && context.disabled !== true;
}
