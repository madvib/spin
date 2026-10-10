/**
 * Slider connect: the DOM contract, the keyboard map and the pointer flows.
 *
 * The machine holds value and state; everything that needs layout lives
 * here. Pointers are read as rects and turned into VALUES — the machine's
 * events never carry coordinates — the keyboard map is here because it is a
 * view concern, and drag listeners are document-scoped for the gesture and
 * released on pointer-up.
 *
 * Geometry leaves as CSS custom properties on the part that consumes them
 * (the sanctioned channel for continuous values); the markup's utility
 * classes decide what each var feeds.
 */

import { percentToValue, valueToPercent, type SliderContext } from "./slider.machine.ts";

export interface SliderFsmConnectProps {
  readonly orientation: "horizontal" | "vertical";
  readonly thumbAlignment: "contain" | "center";
  readonly origin: "start" | "center" | "end";
  readonly disabled: boolean;
  readonly largeStep: number;
  readonly name: string | undefined;
  readonly thumbSize: { readonly width: number; readonly height: number } | null;
  readonly markers: readonly number[];
}

export interface SliderMarker {
  readonly value: number;
}

export interface SliderFsmApi {
  readonly value: number[];
  readonly dragging: boolean;
  readonly focused: boolean;
  readonly focusedIndex: number;
  getThumbValue(index: number): number;
  setValue(value: readonly number[]): void;
  setThumbValue(index: number, value: number): void;
  getValuePercent(value: number): number;
  getPercentValue(percent: number): number;
  getThumbPercent(index: number): number;
  getThumbMin(index: number): number;
  getThumbMax(index: number): number;
  increment(index?: number): void;
  decrement(index?: number): void;
  focus(): void;
  getMarkers(): readonly SliderMarker[];
  getValueText(): string;
  getLabelProps(): Record<string, unknown>;
  getRootProps(): Record<string, unknown>;
  getValueTextProps(): Record<string, unknown>;
  getTrackProps(): Record<string, unknown>;
  getThumbProps(props?: { index?: number }): Record<string, unknown>;
  getHiddenInputProps(props?: { index?: number }): Record<string, unknown>;
  getRangeProps(): Record<string, unknown>;
  getControlProps(): Record<string, unknown>;
  getMarkerGroupProps(): Record<string, unknown>;
  getMarkerProps(marker: SliderMarker): Record<string, unknown>;
  getDraggingIndicatorProps(props?: { index?: number }): Record<string, unknown>;
}

interface SliderService {
  readonly state: { readonly value: string };
  readonly context: SliderContext;
  send(event: { type: string } & Record<string, unknown>): void;
}

type Send = (event: { type: string } & Record<string, unknown>) => void;

interface Point {
  readonly x: number;
  readonly y: number;
}

/** A geometry position: the two var values a part's utilities consume. */
interface Position {
  readonly x: string;
  readonly y: string;
}

interface Size {
  readonly width: number;
  readonly height: number;
}

/** The thumb size the markup's own fallback literal declares (1rem). */
const THUMB_SIZE: Size = { width: 16, height: 16 };
/** The marker tick's size — the markup's `size-1` (0.25rem). */
const MARKER_SIZE = 4;
/** The drag indicator's width and its lift above the thumb — `w-8` / `mt-8`. */
const INDICATOR_WIDTH = 32;
const INDICATOR_LIFT = 32;

const ARROW_KEYS: Readonly<Record<string, true>> = {
  ArrowUp: true,
  ArrowDown: true,
  ArrowLeft: true,
  ArrowRight: true,
};
const PAGE_KEYS: Readonly<Record<string, true>> = { PageUp: true, PageDown: true };

const clampPercent = (percent: number): number => Math.min(Math.max(percent, 0), 1);

/** Per-thumb bounds: the neighbour, inset by the gap, else the range end. */
const thumbRanges = (
  values: readonly number[],
  min: number,
  max: number,
  gap: number,
): readonly { readonly min: number; readonly max: number }[] =>
  values.map((_value, index) => {
    const prev = values[index - 1];
    const next = values[index + 1];
    return {
      min: prev !== undefined ? prev + gap : min,
      max: next !== undefined ? next - gap : max,
    };
  });

export function connectRobotSlider(
  service: SliderService,
  props: SliderFsmConnectProps,
  root: Element,
  id: string,
  send: Send,
): SliderFsmApi {
  const ownerId = `slider:${id}`;
  const labelId = `${ownerId}:label`;
  const controlId = `${ownerId}:control`;
  const trackId = `${ownerId}:track`;
  const rangeId = `${ownerId}:range`;
  const valueTextId = `${ownerId}:value-text`;
  const thumbId = (index: number): string => `${ownerId}:thumb:${index}`;
  const hiddenInputId = (index: number): string => `${ownerId}:input:${index}`;
  const markerId = (value: number): string => `${ownerId}:marker:${value}`;

  const ctx = (): SliderContext => service.context;
  const dragging = (): boolean => service.state.value === "dragging";
  const focused = (): boolean => service.state.value === "focus";
  const interactive = (): boolean => !props.disabled;
  const isVertical = (): boolean => props.orientation === "vertical";
  const thumbSize = (): Size => props.thumbSize ?? THUMB_SIZE;
  const gap = (): number => ctx().step * ctx().minStepsBetweenThumbs;
  const ranges = (): readonly { readonly min: number; readonly max: number }[] =>
    thumbRanges(ctx().value, ctx().min, ctx().max, gap());
  const byId = (id: string): HTMLElement | null => document.getElementById(id);

  // ---------------------------------------------------------------- geometry

  /**
   * Where a value sits, as the two vars the markup consumes. The primary
   * axis follows the thumb's travel — a marker tick is centred on the
   * thumb's position, so both boxes state their own half-size on it — and
   * the cross axis centres a box of the caller's half-size. The halves are
   * passed in because each part brings its own, and the markup's literals
   * are the invariant (`THUMB_SIZE` for the thumb, `MARKER_SIZE` for a tick).
   */
  const travelPosition = (value: number, primaryHalf: number, crossHalf: number): Position => {
    const fraction = valueToPercent(value, ctx().min, ctx().max);
    const percent = fraction * 100;
    const size = thumbSize();
    if (isVertical()) {
      const span = props.thumbAlignment === "contain"
        ? size.height / 2 - fraction * size.height + primaryHalf
        : primaryHalf;
      return { x: `calc(50% - ${crossHalf}px)`, y: `calc(${100 - percent}% - ${span}px)` };
    }
    const span = props.thumbAlignment === "contain"
      ? fraction * size.width + primaryHalf - size.width / 2
      : primaryHalf;
    return { x: `calc(${percent}% - ${span}px)`, y: `calc(50% - ${crossHalf}px)` };
  };

  const thumbPosition = (value: number): Position => {
    const size = thumbSize();
    const primaryHalf = isVertical() ? size.height / 2 : size.width / 2;
    const crossHalf = isVertical() ? size.width / 2 : size.height / 2;
    return travelPosition(value, primaryHalf, crossHalf);
  };

  /** The fill's insets, origin-aware, as the four vars the markup consumes. */
  const fillInsets = (): { left: string; right: string; top: string; bottom: string } => {
    const values = ctx().value;
    const percents = values.map((value) => valueToPercent(value, ctx().min, ctx().max) * 100);
    const first = percents[0] ?? 0;
    const last = percents[percents.length - 1] ?? 0;
    let start: string;
    let end: string;
    if (values.length === 1 && props.origin === "center") {
      const negative = first < 50;
      start = negative ? `${first}%` : "50%";
      end = negative ? "50%" : `${100 - first}%`;
    } else if (values.length === 1 && props.origin === "end") {
      start = `${first}%`;
      end = "0%";
    } else {
      start = values.length === 1 ? "0%" : `${first}%`;
      end = `${100 - last}%`;
    }
    return isVertical()
      ? { left: "0%", right: "0%", top: end, bottom: start }
      : { left: start, right: end, top: "0%", bottom: "0%" };
  };

  /** The drag indicator rides above the thumb, or beside it when vertical. */
  const indicatorPosition = (value: number): Position => {
    const at = thumbPosition(value);
    const size = thumbSize();
    const shift = size.width / 2 - INDICATOR_WIDTH / 2;
    if (isVertical()) {
      return { x: `calc(${at.x} - ${INDICATOR_WIDTH + 8}px)`, y: at.y };
    }
    return { x: `calc(${at.x} + ${shift}px)`, y: `calc(${at.y} - ${size.height / 2 + INDICATOR_LIFT}px)` };
  };

  // ---------------------------------------------------------------- pointer

  /** A pointer position as a value: the track is inset by half a thumb when
   * the alignment contains it, so the ends stay reachable exactly. */
  const pointValue = (control: Element, point: Point, offset: Point | null): number | null => {
    const rect = control.getBoundingClientRect();
    const size = thumbSize();
    const inset = props.thumbAlignment === "contain"
      ? (isVertical() ? size.height / 2 : size.width / 2)
      : 0;
    const at: Point = { x: point.x - (offset?.x ?? 0), y: point.y - (offset?.y ?? 0) };
    if (isVertical()) {
      const height = rect.height - inset * 2;
      if (height <= 0) return null;
      const percent = clampPercent((rect.bottom - inset - at.y) / height);
      return percentToValue(percent, ctx().min, ctx().max, ctx().step);
    }
    const width = rect.width - inset * 2;
    if (width <= 0) return null;
    const percent = clampPercent((at.x - (rect.left + inset)) / width);
    return percentToValue(percent, ctx().min, ctx().max, ctx().step);
  };

  const focusThumbDom = (index: number): void => {
    byId(thumbId(index))?.focus();
  };

  /** Document-scoped drag: the pointer leaves the control, the gesture does
   * not. Listeners release themselves on up/cancel. */
  let detachDrag: (() => void) | undefined;
  const endDragGesture = (): void => {
    detachDrag?.();
    detachDrag = undefined;
  };
  const beginDragGesture = (control: Element, offset: Point | null): void => {
    endDragGesture();
    const onMove = (event: PointerEvent): void => {
      const value = pointValue(control, { x: event.clientX, y: event.clientY }, offset);
      if (value === null) return;
      send({ type: "POINTER_MOVE", value });
    };
    const onUp = (): void => {
      endDragGesture();
      focusThumbDom(ctx().focusedIndex);
      send({ type: "POINTER_UP" });
    };
    const onCancel = (): void => {
      endDragGesture();
      send({ type: "POINTER_CANCEL" });
    };
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onCancel);
    detachDrag = () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onCancel);
    };
  };

  const onControlPointerDown = (event: PointerEvent): void => {
    if (!interactive() || event.button !== 0) return;
    if (event.ctrlKey || event.altKey || event.metaKey) return;
    const control = event.currentTarget;
    if (!(control instanceof Element)) return;
    const value = pointValue(control, { x: event.clientX, y: event.clientY }, null);
    if (value === null) return;
    send({ type: "POINTER_DOWN", value });
    beginDragGesture(control, null);
    event.preventDefault();
    event.stopPropagation();
  };

  const onThumbPointerDown = (index: number) => (event: PointerEvent): void => {
    if (!interactive() || event.button !== 0) return;
    const thumb = event.currentTarget;
    if (!(thumb instanceof Element)) return;
    const rect = thumb.getBoundingClientRect();
    const offset: Point = {
      x: event.clientX - (rect.left + rect.width / 2),
      y: event.clientY - (rect.top + rect.height / 2),
    };
    send({ type: "THUMB_POINTER_DOWN", index });
    beginDragGesture(byId(controlId) ?? root, offset);
    event.preventDefault();
    event.stopPropagation();
  };

  // --------------------------------------------------------------- keyboard

  const onKeyDown = (index: number) => (event: KeyboardEvent): void => {
    if (event.defaultPrevented || !interactive()) return;
    const isArrow = ARROW_KEYS[event.key] === true;
    const large = PAGE_KEYS[event.key] === true || (event.shiftKey && isArrow);
    const step = large ? props.largeStep : ctx().step;
    switch (event.key) {
      case "ArrowUp":
        if (isVertical()) send({ type: "ARROW_INC", index, step });
        break;
      case "ArrowDown":
        if (isVertical()) send({ type: "ARROW_DEC", index, step });
        break;
      case "ArrowLeft":
        if (!isVertical()) send({ type: "ARROW_DEC", index, step });
        break;
      case "ArrowRight":
        if (!isVertical()) send({ type: "ARROW_INC", index, step });
        break;
      case "PageUp":
        send({ type: "ARROW_INC", index, step });
        break;
      case "PageDown":
        send({ type: "ARROW_DEC", index, step });
        break;
      case "Home":
        send({ type: "HOME" });
        break;
      case "End":
        send({ type: "END" });
        break;
      default:
        return;
    }
    event.preventDefault();
    event.stopPropagation();
  };

  // -------------------------------------------------------------- part bags

  const disabledAttrs = (): Record<string, unknown> =>
    props.disabled ? { "data-disabled": "" } : {};

  /** Root-level state: the machine's phase, shared by the frame parts. */
  const phaseAttrs = (): Record<string, unknown> => ({
    "data-orientation": props.orientation,
    "data-focus": focused() ? "" : undefined,
    "data-dragging": dragging() ? "" : undefined,
    ...disabledAttrs(),
  });

  const valueText = (): string => ctx().value.join(" / ");

  return {
    get value(): number[] {
      return ctx().value;
    },
    get dragging(): boolean {
      return dragging();
    },
    get focused(): boolean {
      return focused();
    },
    get focusedIndex(): number {
      return ctx().focusedIndex;
    },
    getThumbValue: (index) => ctx().value[index] ?? ctx().min,
    setValue: (value) => send({ type: "SET_VALUE", value: [...value] }),
    setThumbValue: (index, value) => send({ type: "SET_VALUE", index, value }),
    getValuePercent: (value) => valueToPercent(value, ctx().min, ctx().max),
    getPercentValue: (percent) => percentToValue(percent, ctx().min, ctx().max, ctx().step),
    getThumbPercent: (index) => valueToPercent(ctx().value[index] ?? ctx().min, ctx().min, ctx().max),
    getThumbMin: (index) => ranges()[index]?.min ?? ctx().min,
    getThumbMax: (index) => ranges()[index]?.max ?? ctx().max,
    increment: (index) =>
      send(index === undefined ? { type: "INCREMENT" } : { type: "INCREMENT", index }),
    decrement: (index) =>
      send(index === undefined ? { type: "DECREMENT" } : { type: "DECREMENT", index }),
    focus: () => {
      if (!interactive()) return;
      focusThumbDom(0);
      send({ type: "FOCUS", index: 0 });
    },
    getMarkers: () => props.markers.map((value) => ({ value })),
    getValueText: valueText,
    getLabelProps: () => ({
      id: labelId,
      htmlFor: hiddenInputId(0),
      ...phaseAttrs(),
      onClick: (event: MouseEvent) => {
        if (!interactive()) return;
        event.preventDefault();
        focusThumbDom(0);
      },
    }),
    getRootProps: () => ({ id: ownerId, ...phaseAttrs() }),
    getValueTextProps: () => ({ id: valueTextId, ...phaseAttrs() }),
    getTrackProps: () => ({ id: trackId, ...phaseAttrs() }),
    getThumbProps: (thumbProps?: { index?: number }) => {
      const index = thumbProps?.index ?? 0;
      const value = ctx().value[index] ?? ctx().min;
      const range = ranges()[index] ?? { min: ctx().min, max: ctx().max };
      const at = thumbPosition(value);
      const active = ctx().focusedIndex === index;
      return {
        id: thumbId(index),
        role: "slider",
        // Absent, not undefined: the spread assigns `tabIndex` as a property,
        // and an undefined property write coerces to 0 rather than removing
        // the attribute. Omitting the key lets the spread drop the stale one.
        ...(props.disabled ? {} : { tabIndex: 0 }),
        draggable: false,
        "aria-disabled": props.disabled ? true : undefined,
        "aria-labelledby": labelId,
        "aria-orientation": props.orientation,
        "aria-valuemin": range.min,
        "aria-valuemax": range.max,
        "aria-valuenow": value,
        "data-index": index,
        "data-orientation": props.orientation,
        "data-focus": focused() && active ? "" : undefined,
        "data-dragging": dragging() && active ? "" : undefined,
        ...disabledAttrs(),
        style: {
          "--slider-thumb-x": at.x,
          "--slider-thumb-y": at.y,
          "--slider-thumb-width": `${thumbSize().width}px`,
          "--slider-thumb-height": `${thumbSize().height}px`,
        },
        onPointerDown: onThumbPointerDown(index),
        onFocus: () => {
          if (!interactive()) return;
          send({ type: "FOCUS", index });
        },
        onBlur: () => {
          if (!interactive()) return;
          send({ type: "BLUR" });
        },
        onKeyDown: onKeyDown(index),
      };
    },
    getHiddenInputProps: (inputProps?: { index?: number }) => {
      const index = inputProps?.index ?? 0;
      const named = props.name === undefined || props.name === ""
        ? undefined
        : ctx().value.length > 1
        ? `${props.name}[]`
        : props.name;
      return {
        id: hiddenInputId(index),
        name: named,
        type: "text",
        hidden: true,
        defaultValue: ctx().value[index] ?? ctx().min,
        value: ctx().value[index] ?? ctx().min,
      };
    },
    getRangeProps: () => {
      const insets = fillInsets();
      return {
        id: rangeId,
        style: {
          "--slider-fill-left": insets.left,
          "--slider-fill-right": insets.right,
          "--slider-fill-top": insets.top,
          "--slider-fill-bottom": insets.bottom,
        },
        ...phaseAttrs(),
      };
    },
    getControlProps: () => ({
      id: controlId,
      ...phaseAttrs(),
      onPointerDown: onControlPointerDown,
    }),
    getMarkerGroupProps: () => ({
      role: "presentation",
      "aria-hidden": true,
      "data-orientation": props.orientation,
    }),
    getMarkerProps: (marker) => {
      // A tick is `size-1` in the markup: its own half on each axis, riding
      // the thumb's travel on the primary one.
      const at = travelPosition(marker.value, MARKER_SIZE / 2, MARKER_SIZE / 2);
      const values = ctx().value;
      const first = values[0] ?? 0;
      const last = values[values.length - 1] ?? 0;
      const markerState = marker.value < first
        ? "under-value"
        : marker.value > last
        ? "over-value"
        : "at-value";
      return {
        id: markerId(marker.value),
        role: "presentation",
        "aria-hidden": true,
        "data-value": marker.value,
        "data-state": markerState,
        "data-orientation": props.orientation,
        style: { "--slider-marker-x": at.x, "--slider-marker-y": at.y },
        ...disabledAttrs(),
      };
    },
    getDraggingIndicatorProps: (indicatorProps?: { index?: number }) => {
      const index = indicatorProps?.index ?? 0;
      const at = indicatorPosition(ctx().value[index] ?? ctx().min);
      const open = dragging() && ctx().focusedIndex === index;
      return {
        id: `${ownerId}:indicator`,
        role: "presentation",
        "aria-hidden": true,
        hidden: !open,
        "data-state": open ? "open" : "closed",
        "data-orientation": props.orientation,
        style: { "--slider-indicator-x": at.x, "--slider-indicator-y": at.y },
      };
    },
  };
}
