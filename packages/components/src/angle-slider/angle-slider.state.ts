import { defaultTwin } from "@spinjs/runtime";

export type AngleSliderState = "idle" | "focused" | "dragging";

export interface AngleSliderContext {
  value: number;
  step: number;
  largeStep: number;
  dir: "ltr" | "rtl";
  disabled: boolean;
  readOnly: boolean;
  invalid: boolean;
  dragOffset: number | null;
  name: string;
  ariaLabel: string;
}

export interface AngleSliderArgs {
  value?: string;
  step?: string;
  largeStep?: string;
  dir?: string;
  disabled?: boolean;
  readOnly?: boolean;
  invalid?: boolean;
  defaultInvalid?: boolean;
  name?: string;
  ariaLabel?: string;
}

const asCount = (raw: unknown): number | null => {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  if (typeof raw === "string" && raw.trim().length > 0) {
    const n = Number(raw.trim());
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

export function initial(
  args: AngleSliderArgs,
  authored: (name: string) => boolean,
): AngleSliderContext {
  const written = (field: string): boolean =>
    authored(field) ||
    authored(defaultTwin(field)) ||
    (args as Record<string, unknown>)[defaultTwin(field)] !== undefined;
  const step = written("step") ? (asCount(args.step) ?? 1) : 1;
  return {
    value: written("value") ? (asCount(args.value) ?? 0) : 0,
    step,
    largeStep: written("largeStep")
      ? (asCount(args.largeStep) ?? 10 * step)
      : 10 * step,
    dir: written("dir") ? (args.dir === "rtl" ? "rtl" : "ltr") : "ltr",
    disabled: written("disabled") ? args.disabled === true : false,
    readOnly: written("readOnly") ? args.readOnly === true : false,
    invalid: written("invalid") ? args.invalid === true : false,
    dragOffset: null,
    name: args.name ?? "",
    ariaLabel: args.ariaLabel ?? "",
  };
}

export function isInteractive(ctx: AngleSliderContext): boolean {
  return !ctx.disabled && !ctx.readOnly;
}

export const MIN_VALUE = 0;
export const MAX_VALUE = 359;

function mirrorAngle(angle: number): number {
  return (360 - angle) % 360;
}

export function pointAngle(
  centerX: number,
  centerY: number,
  clientX: number,
  clientY: number,
): number {
  const x = clientX - centerX;
  const y = clientY - centerY;
  const deg = Math.atan2(x, y) * (180 / Math.PI) + 180;
  return 360 - deg;
}

export function pointerAngle(
  centerX: number,
  centerY: number,
  clientX: number,
  clientY: number,
  angularOffset: number | null,
  dir: "ltr" | "rtl",
): number {
  const angle = pointAngle(centerX, centerY, clientX, clientY);
  if (angularOffset !== null) return angle - angularOffset;
  return dir === "rtl" ? mirrorAngle(angle) : angle;
}

export function resolveValue(
  rawAngle: number,
  angularOffset: number | null,
  value: number,
  dir: "ltr" | "rtl",
): number {
  if (angularOffset === null) {
    return dir === "rtl" ? mirrorAngle(rawAngle) : rawAngle;
  }
  const clickAngle = value + angularOffset;
  return dir === "rtl"
    ? value + clickAngle - rawAngle
    : rawAngle - angularOffset;
}

export function displayAngle(value: number, dir: "ltr" | "rtl"): number {
  return dir === "rtl" ? mirrorAngle(value) : value;
}

export function clampAngle(degree: number): number {
  return Math.min(Math.max(degree, MIN_VALUE), MAX_VALUE);
}

export function constrainAngle(degree: number, step: number): number {
  const clamped = clampAngle(degree);
  const upper = Math.ceil(clamped / step);
  const nearest = Math.round(clamped / step);
  return upper >= clamped / step
    ? (upper * step === MAX_VALUE ? MIN_VALUE : upper * step)
    : nearest * step;
}

export function snapAngle(value: number, step: number): number {
  const min = MIN_VALUE;
  const remainder = (value - min) % step;
  const snapped = Math.abs(remainder) * 2 >= step
    ? value + Math.sign(remainder) * (step - Math.abs(remainder))
    : value - remainder;
  return clampAngle(snapped);
}

export function valueAsDegree(value: number): string {
  return `${value}deg`;
}
