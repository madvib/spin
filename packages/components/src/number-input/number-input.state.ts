import { defaultTwin } from "@spin/runtime";
import type { NumberInputHint, NumberInputPoint } from "./number-input.events.ts";

export type NumberInputState = "idle" | "focused" | "scrubbing";

export interface NumberInputContext {
  value: string;
  hint: NumberInputHint | null;
  cursorPoint: NumberInputPoint | null;
  fieldsetDisabled: boolean;
  disabled: boolean;
  readOnly: boolean;
  required: boolean;
  invalid: boolean | undefined;
  min: number;
  max: number;
  step: number;
  largeStep: number;
  smallStep: number;
  allowOverflow: boolean;
  allowMouseWheel: boolean;
  focusInputOnChange: boolean;
  clampValueOnBlur: boolean;
  spinOnPress: boolean;
  dir: "ltr" | "rtl";
  inputMode: string;
  pattern: string;
  name: string | undefined;
  form: string | undefined;
  incrementLabel: string;
  decrementLabel: string;
  initialValue: string;
  spin: "hold" | "repeat" | null;
}

export interface NumberInputArgs {
  value?: string;
  defaultValue?: string | undefined;
  min?: string | number;
  max?: string | number;
  step?: string | number;
  largeStep?: string | number;
  smallStep?: string | number;
  allowOverflow?: boolean;
  allowMouseWheel?: boolean;
  focusInputOnChange?: boolean;
  clampValueOnBlur?: boolean;
  spinOnPress?: boolean;
  dir?: "ltr" | "rtl";
  disabled?: boolean;
  readOnly?: boolean;
  required?: boolean;
  invalid?: boolean;
  inputMode?: string;
  pattern?: string;
  name?: string;
  form?: string;
  incrementLabel?: string;
  decrementLabel?: string;
}

const MIN_SAFE = Number.MIN_SAFE_INTEGER;
const MAX_SAFE = Number.MAX_SAFE_INTEGER;
const DEFAULT_STEP = 1;

export function asNumber(raw: unknown, fallback: number): number {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : fallback;
  if (typeof raw !== "string") return fallback;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return fallback;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function valueOf(raw: unknown): string | null {
  if (typeof raw === "string") return raw;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw.toString();
  return null;
}

export type NumberInputScalarKey =
  | "min"
  | "max"
  | "step"
  | "largeStep"
  | "smallStep"
  | "allowOverflow"
  | "clampValueOnBlur"
  | "spinOnPress";

export function numberInputScalars(
  args: NumberInputArgs,
  authored: (name: string) => boolean = () => false,
): Pick<NumberInputContext, NumberInputScalarKey> {
  const step = asNumber(args.step, DEFAULT_STEP);
  const allowOverflow = args.allowOverflow === true;
  return {
    min: asNumber(args.min, MIN_SAFE),
    max: asNumber(args.max, MAX_SAFE),
    step,
    largeStep: asNumber(args.largeStep, 10 * step),
    smallStep: asNumber(args.smallStep, step / 10),
    allowOverflow,
    // A coerced default is not a write: an unauthored clamp falls back to
    // the opposite of overflow, the way the legacy bridge seeded it.
    clampValueOnBlur: authored("clampValueOnBlur") ? args.clampValueOnBlur === true : !allowOverflow,
    spinOnPress: args.spinOnPress !== false,
  };
}

export function initial(
  args: NumberInputArgs,
  authored: (name: string) => boolean = () => true,
): NumberInputContext {
  const written = (field: string): boolean =>
    authored(field) ||
    authored(defaultTwin(field)) ||
    (args as Record<string, unknown>)[defaultTwin(field)] !== undefined;
  return {
    value: written("value") ? valueOf(args.value) ?? "" : "",
    hint: null,
    cursorPoint: null,
    fieldsetDisabled: false,
    disabled: args.disabled === true,
    readOnly: args.readOnly === true,
    required: args.required === true,
    invalid: authored("invalid") ? args.invalid === true : undefined,
    ...numberInputScalars(args, authored),
    allowMouseWheel: args.allowMouseWheel === true,
    focusInputOnChange: authored("focusInputOnChange") ? args.focusInputOnChange === true : true,
    dir: args.dir === "rtl" ? "rtl" : "ltr",
    inputMode: typeof args.inputMode === "string" && args.inputMode.length > 0 ? args.inputMode : "decimal",
    pattern: typeof args.pattern === "string" && args.pattern.length > 0 ? args.pattern : "-?[0-9]*(.[0-9]+)?",
    name: typeof args.name === "string" && args.name.length > 0 ? args.name : undefined,
    form: typeof args.form === "string" && args.form.length > 0 ? args.form : undefined,
    incrementLabel: typeof args.incrementLabel === "string" && args.incrementLabel.length > 0
      ? args.incrementLabel
      : "increment value",
    decrementLabel: typeof args.decrementLabel === "string" && args.decrementLabel.length > 0
      ? args.decrementLabel
      : "decrease value",
    initialValue: written("value") ? valueOf(args.value) ?? "" : valueOf(args.defaultValue) ?? "",
    spin: null,
  };
}

export const parseValue = (raw: string): number => Number.parseFloat(raw);

export const formatValue = (value: number): string => (Number.isNaN(value) ? "" : value.toString());

export const isValueWithinRange = (value: number, min: number, max: number): boolean => {
  const at = Number.isNaN(value) ? 0 : value;
  return at >= min && at <= max;
};

const countDecimals = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  let exponent = 1;
  let places = 0;
  while (Math.round(value * exponent) / exponent !== value) {
    exponent *= 10;
    places += 1;
  }
  return places;
};

const decimalOp = (a: number, op: "+" | "-", b: number): number => {
  if (a % 1 === 0 && b % 1 === 0) return op === "+" ? a + b : a - b;
  const multiplier = 10 ** Math.max(countDecimals(a), countDecimals(b));
  const left = Math.round(a * multiplier);
  const right = Math.round(b * multiplier);
  return (op === "+" ? left + right : left - right) / multiplier;
};

export const incrementValue = (value: number, step: number): number =>
  decimalOp(Number.isNaN(value) ? 0 : value, "+", step);

export const decrementValue = (value: number, step: number): number =>
  decimalOp(Number.isNaN(value) ? 0 : value, "-", step);

export const clampValue = (value: number, min: number, max: number): number =>
  Math.min(Math.max(Number.isNaN(value) ? 0 : value, min), max);

export { countDecimals, decimalOp };
