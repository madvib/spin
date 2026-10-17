import { defineComponent, isComposing, textProp, type ComponentDef } from "@spin/runtime";
import {
  config,
  implementations,
  isInteractive,
  percentOf,
  thumbRange,
  valueOfPercent,
  type SliderContext,
  type SliderEvent,
  type SliderFocusChange,
  type SliderValueChange,
  type SliderValueChangeEnd,
  type ThumbCollisionBehavior,
} from "./slider.machine.ts";

/**
 * Slider definition: the DOM contract as data. The machine owns the three
 * phases, the values, the focused index, and the step/collision math; this
 * file maps props to channels, parts to attribute bags, commands to sends,
 * and value/focus transitions to their events. Geometry that needs a node
 * (pointer-to-value measurement, pointer capture, thumb-grab offset, the
 * checked-thumb focus after a keyboard move) lives in the part bags —
 * reported in as stepped values, because the machine never touches the DOM.
 */

export interface SliderApi {
  setValue(value: readonly number[]): void;
  setThumbValue(index: number, value: number): void;
  increment(index?: number): void;
  decrement(index?: number): void;
  focus(): void;
  readonly value: readonly number[];
  readonly markers: readonly number[];
  readonly valueText: string;
  readonly dragging: boolean;
  readonly focused: boolean;
  getThumbValue(index: number): number;
  getThumbPercent(index: number): number;
  getThumbMin(index: number): number;
  getThumbMax(index: number): number;
  getThumbIndexes(): readonly { readonly index: number }[];
  getMarkers(): readonly number[];
  getRootProps(): Record<string, unknown>;
  getLabelProps(): Record<string, unknown>;
  getValueTextProps(): Record<string, unknown>;
  getControlProps(): Record<string, unknown>;
  getMarkerGroupProps(): Record<string, unknown>;
  getMarkerProps(slot: { readonly value: number }): Record<string, unknown>;
  getTrackProps(): Record<string, unknown>;
  getRangeProps(): Record<string, unknown>;
  getThumbProps(slot: { readonly index: number }): Record<string, unknown>;
  getHiddenInputProps(slot: { readonly index: number }): Record<string, unknown>;
}

// Scope props arrive as strings; hooks write numbers. Accept both — a
// string-authored `defaultValue="45"` seeds 45, not 0.
const numProp = (raw: unknown): number | null => {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  if (typeof raw === "string" && raw.trim().length > 0) {
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

/** Values travel the prop channel as JSON text: the scope grammar types an
 * array either as `string[]` (whose default coercion produces `["[]"]` for
 * `= []`) or as a JSON string, so both spellings parse. */
const valuesProp = (raw: unknown): number[] | null => {
  if (Array.isArray(raw)) {
    return raw.every((item) => typeof item === "number" && Number.isFinite(item))
      ? [...(raw as number[])]
      : null;
  }
  if (typeof raw !== "string") return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) &&
        parsed.every((item) => typeof item === "number" && Number.isFinite(item))
      ? [...(parsed as number[])]
      : null;
  } catch {
    return null;
  }
};

const sameValues = (a: readonly number[], b: readonly number[]): boolean =>
  a.length === b.length && a.every((value, index) => value === b[index]);

const collisionProp = (raw: unknown): ThumbCollisionBehavior => {
  if (raw === "push" || raw === "swap") return raw;
  return "none";
};

type Capturable = Element & { setPointerCapture?: (id: number) => void };

type Ctx = SliderContext;

const asCtx = (context: Record<string, unknown>): Ctx => context as unknown as Ctx;

const slotIndex = (slot: unknown): number => (slot as { readonly index: number }).index;

/** The view reflex: after a keyboard move the focused thumb takes focus. */
const focusThumb = (id: (part: string, slot?: number) => string, index: number): void => {
  if (typeof document === "undefined") return;
  document.getElementById(id("thumb", index))?.focus({ preventScroll: true });
};

/** A client point as a stepped track value, measured off the track node. */
const trackValue = (
  trackId: string,
  orientation: string,
  dir: string,
  context: Ctx,
  clientX: number,
  clientY: number,
): number | null => {
  if (typeof document === "undefined") return null;
  const track = document.getElementById(trackId);
  if (track === null || typeof track.getBoundingClientRect !== "function") return null;
  const rect = track.getBoundingClientRect();
  if (orientation === "vertical") {
    const percent = rect.height <= 0 ? 0 : (rect.bottom - clientY) / rect.height;
    return valueOfPercent(context, Math.min(1, Math.max(0, percent)));
  }
  const raw = rect.width <= 0 ? 0 : (clientX - rect.left) / rect.width;
  const percent = dir === "rtl" ? 1 - raw : raw;
  return valueOfPercent(context, Math.min(1, Math.max(0, percent)));
};

/** Thumb slots are a pure function of the thumb count: cache per length so
 * the recipe's iteration never re-stamps. Lengths are small; the map is bounded. */
const thumbIndexCache = new Map<number, readonly { readonly index: number }[]>();
const thumbIndexes = (length: number): readonly { readonly index: number }[] => {
  const hit = thumbIndexCache.get(length);
  if (hit !== undefined) return hit;
  const made = Array.from({ length }, (_, index) => ({ index }));
  thumbIndexCache.set(length, made);
  return made;
};

const minProp = (raw: unknown): number => numProp(raw) ?? 0;
const maxProp = (raw: unknown): number => numProp(raw) ?? 100;
const stepProp = (raw: unknown): number => numProp(raw) ?? 1;
const orientationProp = (raw: unknown): string => raw === "vertical" ? "vertical" : "horizontal";
const originProp = (raw: unknown): string =>
  raw === "center" || raw === "end" ? (raw as string) : "start";
const boolProp = (raw: unknown): boolean => raw === true;

const def: ComponentDef<SliderContext, SliderEvent> = {
  name: "slider",
  config,
  implementations,
  start: "idle",
  seed: (props) => {
    const seeded = (valuesProp(
      typeof props["value"] === "string" || Array.isArray(props["value"])
        ? props["value"]
        : props["defaultValue"],
    ) ?? [(minProp(props["min"]) as number)]) as number[];
    return {
      min: props["min"],
      max: props["max"],
      step: props["step"],
      largeStep: numProp(props["largeStep"]) ?? 10 * (stepProp(props["step"]) as number),
      minStepsBetweenThumbs: Math.max(0, Math.floor(numProp(props["minStepsBetweenThumbs"]) ?? 0)),
      origin: props["origin"],
      orientation: props["orientation"],
      thumbCollisionBehavior: props["thumbCollisionBehavior"],
      disabled: props["disabled"],
      readOnly: props["readOnly"],
      invalid: props["invalid"],
      value: seeded,
      markers: valuesProp(props["markers"]) ?? [],
    };
  },
  channels: {
    value: {
      controlled: true,
      parse: valuesProp,
      event: (value: readonly number[]) => ({ type: "SET_VALUE", value: [...value] }),
      equal: (current, outer) =>
        Array.isArray(current) &&
        Array.isArray(outer) &&
        sameValues(current as readonly number[], outer as readonly number[]),
    },
    defaultValue: { parse: valuesProp },
    markers: { parse: valuesProp },
    min: { parse: minProp },
    max: { parse: maxProp },
    step: { parse: stepProp },
    largeStep: { parse: numProp },
    minStepsBetweenThumbs: { parse: (raw) => Math.max(0, Math.floor(numProp(raw) ?? 0)) },
    origin: { parse: originProp },
    orientation: { parse: orientationProp },
    thumbCollisionBehavior: { parse: collisionProp },
    disabled: { parse: boolProp },
    readOnly: { parse: boolProp },
    invalid: { parse: boolProp },
    required: { parse: (raw) => raw === true },
    name: { parse: textProp },
    form: { parse: textProp },
    dir: { parse: (raw) => (raw === "rtl" ? "rtl" : "ltr") },
    label: { parse: textProp },
    "aria-label": { parse: textProp },
  },
  scalars: [
    "min",
    "max",
    "step",
    "largeStep",
    "minStepsBetweenThumbs",
    "origin",
    "orientation",
    "thumbCollisionBehavior",
    "disabled",
    "readOnly",
    "invalid",
  ],
  commitEvents: ["POINTER_UP", "ARROW_INC", "ARROW_DEC", "HOME", "END", "INCREMENT", "DECREMENT", "SET_VALUE"],
  parts: {
    root: {
      sig: (scope) => [scope.props["dir"], scope.props["orientation"], scope.props["disabled"], scope.props["invalid"], scope.state].join("|"),
      attrs: (scope) => ({
        id: scope.id("root"),
        dir: scope.props["dir"],
        "data-scope": "slider",
        "data-part": "root",
        "data-disabled": scope.attr(scope.props["disabled"] === true),
        "data-orientation": scope.props["orientation"],
        "data-dragging": scope.attr(scope.state === "dragging"),
        "data-invalid": scope.attr(scope.props["invalid"] === true),
        "data-focus": scope.attr(scope.state === "focus"),
      }),
    },
    label: {
      sig: (scope) => [scope.props["label"], scope.props["disabled"], scope.props["orientation"]].join("|"),
      attrs: (scope) => ({
        id: scope.id("label"),
        dir: scope.props["dir"],
        "data-scope": "slider",
        "data-part": "label",
        "data-disabled": scope.attr(scope.props["disabled"] === true),
        "data-orientation": scope.props["orientation"],
        "data-invalid": scope.attr(scope.props["invalid"] === true),
        "data-dragging": scope.attr(scope.state === "dragging"),
        "data-focus": scope.attr(scope.state === "focus"),
        for: scope.id("input", 0),
        style: { userSelect: "none" },
        onClick: (event: MouseEvent) => {
          if (!isInteractive(asCtx(scope.context))) return;
          event.preventDefault();
          focusThumb(scope.id, Math.max(0, asCtx(scope.context).focusedIndex));
        },
      }),
    },
    valueText: {
      id: "value-text",
      sig: (scope) => [(asCtx(scope.context).value as number[]).join(","), scope.props["disabled"], scope.props["orientation"], scope.props["invalid"], scope.state].join("|"),
      attrs: (scope) => ({
        id: scope.id("valueText"),
        dir: scope.props["dir"],
        "data-scope": "slider",
        "data-part": "value-text",
        "data-disabled": scope.attr(scope.props["disabled"] === true),
        "data-orientation": scope.props["orientation"],
        "data-invalid": scope.attr(scope.props["invalid"] === true),
        "data-focus": scope.attr(scope.state === "focus"),
      }),
    },
    control: {
      sig: (scope) => [scope.props["disabled"], scope.props["orientation"], scope.props["invalid"], scope.state].join("|"),
      attrs: (scope) => {
        const trackId = scope.id("track");
        return {
          id: scope.id("control"),
          dir: scope.props["dir"],
          "data-scope": "slider",
          "data-part": "control",
          "data-dragging": scope.attr(scope.state === "dragging"),
          "data-disabled": scope.attr(scope.props["disabled"] === true),
          "data-orientation": scope.props["orientation"],
          "data-invalid": scope.attr(scope.props["invalid"] === true),
          "data-focus": scope.attr(scope.state === "focus"),
          style: { position: "relative", touchAction: "none" },
          onPointerdown: (event: PointerEvent) => {
            const context = asCtx(scope.context);
            if (!isInteractive(context)) return;
            if (event.pointerType === "mouse" && event.button !== 0) return;
            if (event.metaKey || event.ctrlKey || event.altKey) return;
            const value = trackValue(trackId, scope.props["orientation"] as string, scope.props["dir"] as string, context, event.clientX, event.clientY);
            if (value === null) return;
            event.preventDefault();
            event.stopPropagation();
            // Capture the pointer: a release off the track must still end
            // the drag, or the phase strands in dragging and later keys
            // silently no-op (the cropper's stranded-dragging lesson).
            (event.currentTarget as Capturable | null)?.setPointerCapture?.(event.pointerId);
            scope.send({ type: "POINTER_DOWN", pointValue: value });
          },
          onPointermove: (event: PointerEvent) => {
            if (scope.state !== "dragging") return;
            const value = trackValue(trackId, scope.props["orientation"] as string, scope.props["dir"] as string, asCtx(scope.context), event.clientX, event.clientY);
            if (value === null) return;
            scope.send({ type: "POINTER_MOVE", pointValue: value });
          },
          onPointerup: () => {
            if (scope.state !== "dragging") return;
            scope.send({ type: "POINTER_UP" });
          },
        };
      },
    },
    track: {
      sig: (scope) => [scope.props["disabled"], scope.props["invalid"], scope.props["orientation"], scope.state].join("|"),
      attrs: (scope) => ({
        id: scope.id("track"),
        dir: scope.props["dir"],
        "data-scope": "slider",
        "data-part": "track",
        "data-disabled": scope.attr(scope.props["disabled"] === true),
        "data-invalid": scope.attr(scope.props["invalid"] === true),
        "data-dragging": scope.attr(scope.state === "dragging"),
        "data-orientation": scope.props["orientation"],
        "data-focus": scope.attr(scope.state === "focus"),
        style: { position: "relative" },
      }),
    },
    range: {
      sig: (scope) => [(asCtx(scope.context).value as number[]).join(","), scope.props["orientation"], scope.props["disabled"], scope.props["invalid"], scope.state].join("|"),
      attrs: (scope) => {
        const context = asCtx(scope.context);
        const percents = (context.value as number[]).map((value) => percentOf(context, value));
        const origin = scope.props["origin"];
        // Single-thumb ranges start at the origin edge, not the thumb: a
        // lone 50% value fills 0-50 (tark basic), not a zero-width band.
        const single = percents.length < 2;
        const low = single && origin === "start" ? 0 : Math.min(...percents);
        const high = single && origin === "end" ? 100 : Math.max(...percents);
        const vertical = scope.props["orientation"] === "vertical";
        return {
          id: scope.id("range"),
          dir: scope.props["dir"],
          "data-scope": "slider",
          "data-part": "range",
          "data-dragging": scope.attr(scope.state === "dragging"),
          "data-focus": scope.attr(scope.state === "focus"),
          "data-invalid": scope.attr(scope.props["invalid"] === true),
          "data-disabled": scope.attr(scope.props["disabled"] === true),
          "data-orientation": scope.props["orientation"],
          style: {
            "--slider-range-low": `${low}%`,
            "--slider-range-high": `${high}%`,
            ...(vertical
              ? { bottom: "var(--slider-range-low)", height: "calc(var(--slider-range-high) - var(--slider-range-low))" }
              : { left: "var(--slider-range-low)", width: "calc(var(--slider-range-high) - var(--slider-range-low))" }),
          },
        };
      },
    },
    markerGroup: {
      id: "marker-group",
      sig: (scope) => [`${scope.props["dir"]}`].join(" "),
      attrs: (scope) => ({
        dir: scope.props["dir"],
        "data-scope": "slider",
        "data-part": "marker-group",
      }),
    },
  },
  slots: {
    thumb: {
      indexes: (context) => thumbIndexes((asCtx(context).value as number[]).length),
      sig: (scope) => {
        const context = asCtx(scope.context);
        const value = (context.value as number[])[slotIndex(scope.slot)] ?? context.min;
        return [value, context.focusedIndex, scope.state, scope.props["disabled"], scope.props["orientation"], scope.props["dir"]].join("|");
      },
      attrs: (scope) => {
        const context = asCtx(scope.context);
        const value = (context.value as number[])[slotIndex(scope.slot)] ?? context.min;
        const range = thumbRange(context, slotIndex(scope.slot));
        const percent = percentOf(context, value);
        const focused = scope.state === "focus" && context.focusedIndex === slotIndex(scope.slot);
        const dragging = scope.state === "dragging" && context.focusedIndex === slotIndex(scope.slot);
        const vertical = scope.props["orientation"] === "vertical";
        return {
          id: scope.id("thumb", slotIndex(scope.slot)),
          dir: scope.props["dir"],
          "data-scope": "slider",
          "data-part": "thumb",
          "data-index": String(slotIndex(scope.slot)),
          "data-disabled": scope.attr(scope.props["disabled"] === true),
          "data-orientation": scope.props["orientation"],
          "data-focus": scope.attr(focused),
          "data-dragging": scope.attr(dragging),
          draggable: "false",
          "aria-disabled": scope.props["disabled"] === true ? "true" : undefined,
          "aria-orientation": scope.props["orientation"],
          "aria-valuemax": String(range.max),
          "aria-valuemin": String(range.min),
          "aria-valuenow": String(value),
          role: "slider",
          tabindex: scope.props["disabled"] === true ? undefined : "0",
          style: {
            "--slider-thumb": `${percent}%`,
            ...(vertical
              ? { bottom: "var(--slider-thumb)" }
              : { [(scope.props["dir"] as string) === "rtl" ? "right" : "left"]: "var(--slider-thumb)" }),
          },
          onPointerdown: (event: PointerEvent) => {
            if (!isInteractive(asCtx(scope.context))) return;
            if (event.pointerType === "mouse" && event.button !== 0) return;
            const target = event.currentTarget as Element | null;
            const rect = target?.getBoundingClientRect?.();
            const midpoint = rect !== undefined
              ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
              : null;
            event.stopPropagation();
            (event.currentTarget as Capturable | null)?.setPointerCapture?.(event.pointerId);
            scope.send({
              type: "THUMB_POINTER_DOWN",
              index: slotIndex(scope.slot),
              offset: midpoint === null
                ? undefined
                : (vertical ? event.clientY - midpoint.y : event.clientX - midpoint.x),
            });
          },
          onPointermove: (event: PointerEvent) => {
            if (scope.state !== "dragging") return;
            const value = trackValue(scope.id("track"), scope.props["orientation"] as string, scope.props["dir"] as string, asCtx(scope.context), event.clientX, event.clientY);
            if (value === null) return;
            scope.send({ type: "POINTER_MOVE", pointValue: value });
          },
          onPointerup: () => {
            if (scope.state !== "dragging") return;
            scope.send({ type: "POINTER_UP" });
          },
          onBlur: () => {
            if (!isInteractive(asCtx(scope.context))) return;
            scope.send({ type: "BLUR" });
          },
          onFocus: () => {
            if (!isInteractive(asCtx(scope.context))) return;
            scope.send({ type: "FOCUS", index: slotIndex(scope.slot) });
          },
          onKeydown: (event: KeyboardEvent) => {
            if (event.defaultPrevented) return;
            if (!isInteractive(asCtx(scope.context))) return;
            if (isComposing(event)) return;
            // Parsed, not raw: largeStep defaults to 10x step in the
            // channel parse, which raw props never see.
            const large = event.shiftKey ? asCtx(scope.context).largeStep : undefined;
            const keyed = (type: string): boolean => {
              event.preventDefault();
              event.stopPropagation();
              scope.send({ type, step: large });
              focusThumb(scope.id, slotIndex(scope.slot));
              return true;
            };
            const horizontal = scope.props["orientation"] === "horizontal";
            switch (event.key) {
              case "ArrowUp":
                if (!horizontal) keyed("ARROW_INC");
                break;
              case "ArrowDown":
                if (!horizontal) keyed("ARROW_DEC");
                break;
              case "ArrowLeft":
                if (horizontal) keyed((scope.props["dir"] as string) === "rtl" ? "ARROW_INC" : "ARROW_DEC");
                break;
              case "ArrowRight":
                if (horizontal) keyed((scope.props["dir"] as string) === "rtl" ? "ARROW_DEC" : "ARROW_INC");
                break;
              case "PageUp":
                keyed("ARROW_INC");
                break;
              case "PageDown":
                keyed("ARROW_DEC");
                break;
              case "Home":
                keyed("HOME");
                break;
              case "End":
                keyed("END");
                break;
              default:
                break;
            }
          },
        };
      },
    },
    marker: {
      indexes: (context) => asCtx(context).markers as unknown as readonly { readonly value: number }[],
      sig: (scope) => {
        const slot = scope.slot as unknown as { readonly value: number };
        return [slot.value, (asCtx(scope.context).value as number[]).join(",")].join(" ");
      },
      attrs: (scope) => {
        const slot = scope.slot as unknown as { readonly value: number };
        const context = asCtx(scope.context);
        const percent = percentOf(context, slot.value);
        const first = (context.value as number[])[0] ?? context.min;
        const state = slot.value < first ? "under-value" : slot.value > first ? "over-value" : "at-value";
        const vertical = scope.props["orientation"] === "vertical";
        return {
          id: scope.id("marker", slot.value),
          dir: scope.props["dir"],
          "data-scope": "slider",
          "data-part": "marker",
          "data-value": String(slot.value),
          "data-state": state,
          "data-orientation": scope.props["orientation"],
          style: vertical
            ? { "--marker-percent": `${percent}%`, bottom: "var(--marker-percent)" }
            : { "--marker-percent": `${percent}%`, left: "var(--marker-percent)" },
        };
      },
    },
    hiddenInput: {
      id: "input",
      indexes: (context) => (asCtx(context).value as number[]).map((_, index) => ({ index })),
      sig: (scope) => [scope.props["name"], (asCtx(scope.context).value as number[])[slotIndex(scope.slot)], slotIndex(scope.slot)].join("|"),
      attrs: (scope) => {
        const context = asCtx(scope.context);
        const value = (context.value as number[])[slotIndex(scope.slot)] ?? context.min;
        const name = scope.props["name"] as string;
        return {
          id: scope.id("input", slotIndex(scope.slot)),
          name: name.length > 0 ? ((context.value as number[]).length > 1 ? `${name}[]` : name) : undefined,
          form: undefined,
          type: "text",
          hidden: true,
          value: String(value),
        };
      },
    },
  },
  commands: {
    setValue: { event: (args) => ({ type: "SET_VALUE", value: [...(args[0] as readonly number[])] }) },
    setThumbValue: {
      event: (args, context) => {
        const next = [...(asCtx(context).value as number[])];
        next[args[0] as number] = args[1] as number;
        return { type: "SET_VALUE", value: next, index: args[0] as number };
      },
    },
    increment: { event: (args) => ({ type: "INCREMENT", index: args[0] as number | undefined }) },
    decrement: { event: (args) => ({ type: "DECREMENT", index: args[0] as number | undefined }) },
    focus: { event: () => ({ type: "FOCUS", index: 0 }) },
  },
  readers: {
    value: { read: (context) => asCtx(context).value },
    markers: { read: (context) => asCtx(context).markers },
    valueText: { read: (context) => (asCtx(context).value as number[]).join(", ") },
    dragging: { read: (_context, state) => state === "dragging" },
    focused: { read: (_context, state) => state === "focus" },
  },
  methods: {
    getThumbValue: {
      call: (context, _state, args) =>
        (asCtx(context).value as number[])[args[0] as number] ?? asCtx(context).min,
    },
    getThumbPercent: {
      call: (context, _state, args) => {
        const ctx = asCtx(context);
        return percentOf(ctx, (ctx.value as number[])[args[0] as number] ?? ctx.min);
      },
    },
    getThumbMin: {
      call: (context, _state, args) => thumbRange(asCtx(context), args[0] as number).min,
    },
    getThumbMax: {
      call: (context, _state, args) => thumbRange(asCtx(context), args[0] as number).max,
    },
    getMarkers: {
      call: (context) => asCtx(context).markers,
    },
  },
  events: {
    "value-change": {
      prop: "onValueChange",
      watch: (context) => [...(asCtx(context).value as number[])],
      detail: (watched) => ({ value: [...watched] as number[] }),
    },
    "value-change-end": {
      prop: "onValueChangeEnd",
      on: "commit",
      watch: (context) => [...(asCtx(context).value as number[])],
      detail: (watched) => ({ value: [...watched] as number[] }),
    },
    "focus-change": {
      prop: "onFocusChange",
      watch: (context) => [asCtx(context).focusedIndex, ...(asCtx(context).value as number[])],
      detail: (watched) => ({
        focusedIndex: watched[0] as number,
        value: [...(watched.slice(1) as number[])],
      }),
    },
  },
};

export const slider = defineComponent<SliderContext, SliderEvent, SliderApi>(def);
