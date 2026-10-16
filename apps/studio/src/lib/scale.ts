/**
 * What a group of numbers is worth together.
 *
 * Two questions the surfaces keep asking: can this value be stepped by a
 * slider, and what happens to a whole group of related values when one
 * factor moves them all. Both are arithmetic on authored strings, and both
 * have to respect the two things a theme already decided — the unit the
 * value was written in, and the precision it was written to. `9999px` stays
 * px, a spacing step stays on the sixteenth grid, `150ms` stays ms, and a
 * value authored to a tenth keeps its tenth.
 *
 * The outlier rule exists because of `radius.full`: a pill in a scale of
 * corners, absurd next to it, and the top of the group by 1250×. A ceiling
 * read off that would pin every other slider in the family at zero.
 */

/** What a value is, by shape — how it scales and what a slider steps it in. */
export interface Measure {
  readonly kind: "duration" | "length" | "number";
  readonly n: number;
  readonly unit: string;
}

/** Slider bounds, in the row's own number and unit. */
export interface Range {
  readonly min: number;
  readonly max: number;
  readonly step: number;
}

const DURATION = /^(-?[\d.]+)(ms|s)$/;
const LENGTH = /^(-?[\d.]+)(rem|em|px|%)$/;
const BARE = /^-?[\d.]+$/;

function matchOf(
  match: RegExpMatchArray,
  kind: Measure["kind"],
): Measure | undefined {
  const n = Number(match[1]);
  if (!Number.isFinite(n)) return undefined;
  return { kind, n, unit: match[2] ?? "" };
}

/**
 * Read a value into a number and the unit it speaks.
 *
 * Shape first, because shape is the only thing that tells `1000` (a layer
 * number) from `150ms` (a time) from `0.25rem` (a length) — and a value
 * with no number at all is exactly the value a slider cannot hold.
 */
export function measure(value: string): Measure | undefined {
  const text = value.trim();
  const duration = text.match(DURATION);
  if (duration !== null) return matchOf(duration, "duration");
  const length = text.match(LENGTH);
  if (length !== null) return matchOf(length, "length");
  if (BARE.test(text)) {
    const n = Number(text);
    if (Number.isFinite(n)) return { kind: "number", n, unit: "" };
  }
  return undefined;
}

/** The decimals the author wrote, capped so a pathological value stays sane. */
function decimals(text: string): number {
  const digits = text.trim().match(/-?[\d.]+/)?.[0] ?? "0";
  const dot = digits.indexOf(".");
  if (dot === -1) return 0;
  return Math.min(digits.length - dot - 1, 4);
}

/**
 * The quantum a value steps and rounds on.
 *
 * The system's grids win where there is one — sixteenths for lengths in
 * rem, whole milliseconds — and everywhere else the author's own written
 * precision is the grid, because their `0.5px` is a decision about halves.
 */
function quantumOf(raw: string, m: Measure): number {
  if (m.unit === "rem" || m.unit === "em") return 1 / 16;
  if (m.unit === "ms") return 1;
  if (m.unit === "s") return 0.001;
  const d = decimals(raw);
  return d > 0 ? 10 ** -d : 1;
}

/** Rounds away the binary noise a multiplied grid leaves behind. */
function clean(n: number): number {
  return Number(n.toFixed(4));
}

/** Rebuild a value from a number the slider reached, in the unit and grid it had. */
export function quantize(value: string, n: number): string {
  const m = measure(value);
  if (m === undefined || !Number.isFinite(n)) return value;
  const q = quantumOf(value, m);
  return `${clean(Math.round(n / q) * q)}${m.unit}`;
}

/**
 * The value with a factor applied, in its own unit — or `undefined` for a
 * value a factor cannot mean: a colour, a shadow, a curve. Refusing is the
 * point; scaling a colour by 1.5 would invent a colour nobody authored.
 */
export function scaleValue(value: string, factor: number): string | undefined {
  const m = measure(value);
  if (m === undefined || !Number.isFinite(factor) || factor <= 0) {
    return undefined;
  }
  return quantize(value, m.n * factor);
}

/**
 * The top of a ramp a caller can trust.
 *
 * Twice the second-largest positive value disqualifies the largest: the
 * spacing ramp doubles, so `4rem` above `2rem` stands, while `9999px`
 * above `8px` is the pill that would otherwise own every slider in the
 * family.
 */
export function robustMax(values: readonly number[]): number {
  const sorted = values
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => b - a);
  const top = sorted[0];
  if (top === undefined) return 0;
  const next = sorted.slice(1).find((n) => n > 0);
  if (next !== undefined && top > 4 * next) return next;
  return top;
}

/** One member of a group of numbers: the token's dotted path and its value. */
export interface ScaleStep {
  readonly path: string;
  readonly value: string;
}

/** What one step will be worth once a gesture lands: a DTCG path and a value. */
export interface ScaleEdit {
  readonly path: string[];
  readonly value: string;
}

/**
 * Every value a group moves to, when one row is set.
 *
 * Setting one step is setting the scale: the gesture produced a ratio, and
 * the ratio lands on every sibling, so the group keeps the shape it was
 * authored with instead of being nudged step by step. The result runs in the
 * group's own order and carries the row asked for; a sibling the grid rounds
 * back to its own value has not moved and is not written.
 *
 * Two ratios a scale cannot be built from answer with the row alone. A step
 * at zero holds no ratio — everything times zero is still zero — and a ratio
 * of zero scales the group out of existence.
 */
export function lockstepEdits(
  steps: readonly ScaleStep[],
  editedPath: string,
  next: string,
  linked: boolean,
): ScaleEdit[] {
  const own: ScaleEdit = { path: editedPath.split("."), value: next };
  const edited = steps.find((step) => step.path === editedPath);
  const before = measure(edited?.value ?? "");
  const proposed = measure(next);
  const ratio = before !== undefined && proposed !== undefined &&
      canonical(before) !== 0
    ? canonical(proposed) / canonical(before)
    : 0;
  if (!linked || !Number.isFinite(ratio) || ratio <= 0) return [own];
  const out: ScaleEdit[] = [];
  for (const step of steps) {
    const value = step.path === editedPath
      ? next
      : scaleValue(step.value, ratio);
    if (value !== undefined && value !== step.value) {
      out.push({ path: step.path.split("."), value });
    }
  }
  return out;
}

/** A value in px (or ms), so numbers of different units compare at all. */
function canonical(m: Measure): number {
  if (m.kind === "duration") return m.unit === "s" ? m.n * 1000 : m.n;
  if (m.unit === "rem" || m.unit === "em") return m.n * 16;
  return m.n;
}

/** The ceiling back into the unit the row speaks. */
function fromCanonical(n: number, unit: string): number {
  if (unit === "s") return n / 1000;
  if (unit === "rem" || unit === "em") return n / 16;
  return n;
}

/** What a dead track falls back to when the group is all zeroes. */
const FLOOR: Record<string, number> = {
  "": 16,
  px: 16,
  "%": 100,
  rem: 1,
  em: 1,
  ms: 400,
  s: 0.4,
};

/**
 * One row's slider bounds: twice the top of the group, in this row's unit.
 *
 * Every step of a scale shares the ceiling, so the sliders themselves read
 * as the ramp — and a row the outlier rule dropped takes headroom of its
 * own, which is how `radius.full` still has somewhere to go.
 */
export function sliderRange(value: string, group: readonly string[]): Range {
  const own = measure(value);
  if (own === undefined) return { min: 0, max: 100, step: 1 };
  const values = [own];
  for (const entry of group) {
    const parsed = measure(entry);
    if (parsed !== undefined) values.push(parsed);
  }
  const scaled = Math.max(
    2 * robustMax(values.map(canonical)),
    2 * canonical(own),
  );
  // The ramp's ceiling arrives in canonical space and goes back into the
  // row's unit; a floor is written in the row's own unit already — `1rem`,
  // not `1px` — because a track for a dead group still has to look like
  // something the theme could hold.
  const ceiling = scaled > 0
    ? fromCanonical(scaled, own.unit)
    : (FLOOR[own.unit] ?? 16);
  return { min: 0, max: clean(ceiling), step: quantumOf(value, own) };
}
