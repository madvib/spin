/**
 * Angle-slider machine: idle/focused/dragging over Zag's three states.
 *
 * The angle math is Zag's own, vendored below (atan2 around the center, RTL
 * mirror, step snap). Context stays serializable for the scope channel.
 */

import { defaultTwin } from "@spin/runtime";
import { createMachine, type Machine } from "@spin/runtime/fsm";

export const MIN_VALUE = 0;
export const MAX_VALUE = 359;

export interface AngleSliderContext {
  value: number;
  step: number;
  largeStep: number;
  dir: "ltr" | "rtl";
  disabled: boolean;
  readOnly: boolean;
  invalid: boolean;
  /** The grab offset in degrees: raw click angle minus value at press.
   * Zag keeps it in a ref; the fork has no ref tier, so it is a value. */
  dragOffset: number | null;
}

export type AngleSliderEvent =
  | { type: "VALUE.SET"; value: number }
  | { type: "CONTROL.POINTER_DOWN"; rawAngle: number; angularOffset: number | null }
  | { type: "DOC.POINTER_MOVE"; rawAngle: number }
  | { type: "DOC.POINTER_UP" }
  | { type: "THUMB.FOCUS" }
  | { type: "THUMB.BLUR" }
  | { type: "THUMB.ARROW_DEC"; step?: number }
  | { type: "THUMB.ARROW_INC"; step?: number }
  | { type: "THUMB.HOME" }
  | { type: "THUMB.END" }
  | { type: "SET_STEP"; step: number }
  | { type: "SET_DISABLED"; disabled: boolean }
  | { type: "SET_READ_ONLY"; readOnly: boolean };

export type AngleSliderValueChange = {
  readonly value: number;
  readonly valueAsDegree: string;
};

export function isInteractive(ctx: AngleSliderContext): boolean {
  return !ctx.disabled && !ctx.readOnly;
}

/**
 * The angle-slider's arguments: the values the host may set.
 */
export interface AngleSliderArgs {
  value?: string;
  step?: string;
  largeStep?: string;
  dir?: string;
  disabled?: boolean;
  readOnly?: boolean;
  invalid?: boolean;
  defaultInvalid?: boolean;
}

const asCount = (raw: unknown): number | null => {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  if (typeof raw === "string" && raw.trim().length > 0) {
    const n = Number(raw.trim());
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

export function initial(args: AngleSliderArgs, authored: (name: string) => boolean): AngleSliderContext {
  // A host that wrote `defaultValue` wrote the channel too.
  const written = (field: string): boolean =>
    authored(field) || authored(defaultTwin(field));
  const step = written("step") ? (asCount(args.step) ?? 1) : 1;
  return {
    value: written("value") ? (asCount(args.value) ?? 0) : 0,
    step,
    largeStep: written("largeStep") ? (asCount(args.largeStep) ?? 10 * step) : 10 * step,
    dir: written("dir") ? (args.dir === "rtl" ? "rtl" : "ltr") : "ltr",
    disabled: written("disabled") ? args.disabled === true : false,
    readOnly: written("readOnly") ? args.readOnly === true : false,
    invalid: written("invalid") ? args.invalid === true : false,
    dragOffset: null,
  };
}

function mirrorAngle(angle: number): number {
  return (360 - angle) % 360;
}

/** @zag-js/rect-utils' getPointAngle, vendored: degrees around the center,
 * zero at the top, clockwise. */
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

/** Zag's getAngle: the raw pointer angle, offset for relative thumb drags. */
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

/** Zag's getPointerValue, pure half: with a grab offset the dial turns
 * relative to the grab, without one it jumps to the pointer. */
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
  return dir === "rtl" ? value + clickAngle - rawAngle : rawAngle - angularOffset;
}

export function displayAngle(value: number, dir: "ltr" | "rtl"): number {
  return dir === "rtl" ? mirrorAngle(value) : value;
}

export function clampAngle(degree: number): number {
  return Math.min(Math.max(degree, MIN_VALUE), MAX_VALUE);
}

/** Zag's constrainAngle: snap up to the step grid, wrapping 359 to 0. */
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
  const max = MAX_VALUE;
  const remainder = (value - min) % step;
  const snapped = Math.abs(remainder) * 2 >= step
    ? value + Math.sign(remainder) * (step - Math.abs(remainder))
    : value - remainder;
  return clampAngle(snapped);
}

export function valueAsDegree(value: number): string {
  return `${value}deg`;
}

const config = {
  id: "angle-slider",
  initial: "idle",
  on: {
    "VALUE.SET": { actions: [{ assign: "setValue" }] },
    SET_STEP: { actions: [{ assign: "setStep" }] },
    SET_DISABLED: { actions: [{ assign: "setDisabled" }] },
    SET_READ_ONLY: { actions: [{ assign: "setReadOnly" }] },
  },
  states: {
    idle: {
      on: {
        "CONTROL.POINTER_DOWN": {
          target: "dragging",
          actions: [{ assign: "setDragOffset" }, { assign: "setPointerValue" }],
        },
        "THUMB.FOCUS": { target: "focused" },
      },
    },
    focused: {
      on: {
        "CONTROL.POINTER_DOWN": {
          target: "dragging",
          actions: [{ assign: "setDragOffset" }, { assign: "setPointerValue" }],
        },
        "THUMB.ARROW_DEC": { actions: [{ assign: "decrementValue" }] },
        "THUMB.ARROW_INC": { actions: [{ assign: "incrementValue" }] },
        "THUMB.HOME": { actions: [{ assign: "setValueToMin" }] },
        "THUMB.END": { actions: [{ assign: "setValueToMax" }] },
        "THUMB.BLUR": { target: "idle" },
      },
    },
    dragging: {
      on: {
        "DOC.POINTER_UP": { target: "focused", actions: [{ assign: "clearDragOffset" }] },
        "DOC.POINTER_MOVE": { actions: [{ assign: "setPointerValue" }] },
      },
    },
  },
};

const implementations = {
  conds: {},
  assigns: {
    setValue: (ctx: AngleSliderContext, event: AngleSliderEvent): Partial<AngleSliderContext> => {
      if (event.type !== "VALUE.SET") return {};
      void ctx;
      const value = asCount(event.value);
      if (value === null) return {};
      return { value: clampAngle(value) };
    },
    setDragOffset: (ctx: AngleSliderContext, event: AngleSliderEvent): Partial<AngleSliderContext> => {
      if (event.type !== "CONTROL.POINTER_DOWN") return {};
      void ctx;
      return { dragOffset: event.angularOffset };
    },
    clearDragOffset: (): Partial<AngleSliderContext> => ({ dragOffset: null }),
    // The dial jumps to the pointer, or turns relative to the grab when the
    // press started on the thumb.
    setPointerValue: (
      ctx: AngleSliderContext,
      event: AngleSliderEvent,
    ): Partial<AngleSliderContext> => {
      if (event.type !== "CONTROL.POINTER_DOWN" && event.type !== "DOC.POINTER_MOVE") return {};
      const offset = event.type === "CONTROL.POINTER_DOWN" ? event.angularOffset : ctx.dragOffset;
      const dial = resolveValue(event.rawAngle, offset, ctx.value, ctx.dir);
      return { value: constrainAngle(dial, ctx.step) };
    },
    decrementValue: (
      ctx: AngleSliderContext,
      event: AngleSliderEvent,
    ): Partial<AngleSliderContext> => {
      if (event.type !== "THUMB.ARROW_DEC") return {};
      return { value: snapAngle(ctx.value - (event.step ?? ctx.step), event.step ?? ctx.step) };
    },
    incrementValue: (
      ctx: AngleSliderContext,
      event: AngleSliderEvent,
    ): Partial<AngleSliderContext> => {
      if (event.type !== "THUMB.ARROW_INC") return {};
      return { value: snapAngle(ctx.value + (event.step ?? ctx.step), event.step ?? ctx.step) };
    },
    setValueToMin: (ctx: AngleSliderContext): Partial<AngleSliderContext> => {
      void ctx;
      return { value: MIN_VALUE };
    },
    setValueToMax: (ctx: AngleSliderContext): Partial<AngleSliderContext> => {
      void ctx;
      return { value: MAX_VALUE };
    },
    setStep: (ctx: AngleSliderContext, event: AngleSliderEvent): Partial<AngleSliderContext> => {
      if (event.type !== "SET_STEP") return {};
      void ctx;
      return { step: event.step };
    },
    setDisabled: (
      ctx: AngleSliderContext,
      event: AngleSliderEvent,
    ): Partial<AngleSliderContext> => {
      if (event.type !== "SET_DISABLED") return {};
      void ctx;
      return { disabled: event.disabled };
    },
    setReadOnly: (
      ctx: AngleSliderContext,
      event: AngleSliderEvent,
    ): Partial<AngleSliderContext> => {
      if (event.type !== "SET_READ_ONLY") return {};
      void ctx;
      return { readOnly: event.readOnly };
    },
  },
};

export function angleSlider(
  args: AngleSliderArgs = {},
  authored: (name: string) => boolean,
): Machine<AngleSliderContext, AngleSliderEvent> {
  return createMachine<AngleSliderContext, AngleSliderEvent>({
    ...config,
    context: initial(args, authored),
    ...implementations,
    fields: {
      value: { event: "VALUE.SET" },
      step: {},
      largeStep: {},
      dir: {},
      disabled: {},
      readOnly: {},
      invalid: {},
    },
  });
}
