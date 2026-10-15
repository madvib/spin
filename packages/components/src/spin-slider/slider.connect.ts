import { dataAttr } from "../spin-select/select.shared.ts";
import {
  isInteractive,
  percentOf,
  thumbRange,
  valueOfPercent,
  type SliderContext,
} from "./slider.machine.ts";

/**
 * Slider connect: the DOM contract, the view-owned geometry, and the
 * reflexes the parts carry.
 *
 * What the machine owns stays there: the three phases, the values, the
 * focused index, the step/collision math. Everything that needs a node
 * lives here — the pointer-to-value measurement (reported in as a stepped
 * value, because the machine never touches the DOM), pointer capture (an
 * off-track release still ends the drag), the thumb-grab offset, and the
 * checked-thumb focus after a keyboard move.
 */

export interface SliderConnectProps {
  readonly disabled: boolean;
  readonly readOnly: boolean;
  readonly invalid: boolean;
  readonly required: boolean;
  readonly name: string;
  readonly form: string;
  readonly dir: "ltr" | "rtl";
  readonly orientation: "horizontal" | "vertical";
  readonly label: string;
  readonly ariaLabel: string;
  readonly thumbLabels: readonly string[];
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly largeStep: number;
}

export interface SliderThumbSlotProps {
  readonly index: number;
}

/** Zag's api methods, narrowed to the command surface the element exposes. */
export interface SliderCommands {
  setValue(value: readonly number[]): void;
  setThumbValue(index: number, value: number): void;
  increment(index?: number): void;
  decrement(index?: number): void;
  focus(): void;
}

export interface SliderApi extends SliderCommands {
  readonly value: readonly number[];
  readonly valueText: string;
  readonly dragging: boolean;
  readonly focused: boolean;
  getThumbValue(index: number): number;
  getThumbPercent(index: number): number;
  getThumbMin(index: number): number;
  getThumbMax(index: number): number;
  /** The thumb indexes, for the recipe's iteration. */
  getThumbIndexes(): readonly number[];
  getRootProps(): Record<string, unknown>;
  getLabelProps(): Record<string, unknown>;
  getValueTextProps(value: string): Record<string, unknown>;
  getControlProps(): Record<string, unknown>;
  getTrackProps(): Record<string, unknown>;
  getRangeProps(): Record<string, unknown>;
  getThumbProps(slot: SliderThumbSlotProps): Record<string, unknown>;
  getHiddenInputProps(slot: SliderThumbSlotProps): Record<string, unknown>;
}

/** The service the connect reads: the fork's, narrowed to what it needs. */
export interface SliderService {
  readonly context: SliderContext;
  /** The machine's state: idle, focus, or dragging. */
  readonly state: string;
  send(event: { type: string } & Record<string, unknown>): void;
}

export interface BagMemo {
  sig: string;
  bag: Record<string, unknown>;
}

/** A bag cached until the signature of the fields it reads moves. One memo
 * holds the single bag of one part (there is one root, one track, one
 * range per element), so a single slot is the whole cache. */
function memo(): (
  sig: string,
  build: () => Record<string, unknown>,
) => Record<string, unknown> {
  let sig = "";
  let bag: Record<string, unknown> | undefined;
  return (next, build) => {
    if (bag !== undefined && sig === next) return bag;
    sig = next;
    bag = build();
    return bag;
  };
}

/** Thumbs are stable slots, so the memo dies with the slot it came from. */
function keyed<K extends object>(
  store: WeakMap<K, BagMemo>,
  owner: K,
  sig: string,
  build: () => Record<string, unknown>,
): Record<string, unknown> {
  const hit = store.get(owner);
  if (hit !== undefined && hit.sig === sig) return hit.bag;
  const bag = build();
  store.set(owner, { sig, bag });
  return bag;
}

/** Zag's `isComposingEvent`: a composing keystroke is not a navigation. */
const isComposing = (event: KeyboardEvent): boolean =>
  event.isComposing === true || event.keyCode === 229;

type Capturable = Element & { setPointerCapture?: (id: number) => void };

export function connectSlider(
  service: SliderService,
  readProps: () => SliderConnectProps,
  id: string,
): SliderApi {
  // Live accessor, never a snapshot: the fork replaces the context object
  // on every assign, so a destructured copy would freeze the first read.
  const ctx = (): SliderContext => service.context;
  const send = service.send;
  const rootId = `slider:${id}`;
  const controlId = `slider:${id}:control`;
  const trackId = `slider:${id}:track`;
  const rangeId = `slider:${id}:range`;
  const labelId = `slider:${id}:label`;
  const valueTextId = `slider:${id}:value-text`;
  const thumbId = (index: number): string => `slider:${id}:thumb:${index}`;
  const hiddenInputId = (index: number): string => `slider:${id}:input:${index}`;

  const rootBag = memo();
  const labelBag = memo();
  const valueTextBag = memo();
  const controlBag = memo();
  const trackBag = memo();
  const rangeBag = memo();
  const thumbBags = new WeakMap<{ index: number }, BagMemo>();
  const hiddenInputBags = new WeakMap<{ index: number }, BagMemo>();

  /** The view reflex: after a keyboard move the focused thumb takes focus. */
  const focusThumb = (index: number): void => {
    if (typeof document === "undefined") return;
    document.getElementById(thumbId(index))?.focus({ preventScroll: true });
  };

  /** A client point as a stepped track value, measured off the track node. */
  const trackValue = (clientX: number, clientY: number): number | null => {
    if (typeof document === "undefined") return null;
    const track = document.getElementById(trackId);
    if (track === null || typeof track.getBoundingClientRect !== "function") return null;
    const rect = track.getBoundingClientRect();
    const props = readProps();
    const context = ctx();
    if (props.orientation === "vertical") {
      const percent = rect.height <= 0 ? 0 : (rect.bottom - clientY) / rect.height;
      return valueOfPercent(context, Math.min(1, Math.max(0, percent)));
    }
    const raw = rect.width <= 0 ? 0 : (clientX - rect.left) / rect.width;
    const percent = props.dir === "rtl" ? 1 - raw : raw;
    return valueOfPercent(context, Math.min(1, Math.max(0, percent)));
  };

  return {
    get value() {
      return ctx().value;
    },
    get valueText() {
      return ctx().value.join(", ");
    },
    get dragging() {
      return service.state === "dragging";
    },
    get focused() {
      return service.state === "focus";
    },
    setValue: (value: readonly number[]) => {
      send({ type: "SET_VALUE", value: [...value] });
    },
    setThumbValue: (index: number, value: number) => {
      const next = [...ctx().value];
      next[index] = value;
      send({ type: "SET_VALUE", value: next, index });
    },
    increment: (index?: number) => {
      send({ type: "INCREMENT", index });
    },
    decrement: (index?: number) => {
      send({ type: "DECREMENT", index });
    },
    focus: () => {
      if (!isInteractive(ctx())) return;
      send({ type: "FOCUS", index: 0 });
      focusThumb(0);
    },
    getThumbValue: (index: number) => ctx().value[index] ?? ctx().min,
    getThumbPercent: (index: number) => percentOf(ctx(), ctx().value[index] ?? ctx().min),
    getThumbMin: (index: number) => thumbRange(ctx(), index).min,
    getThumbMax: (index: number) => thumbRange(ctx(), index).max,
    getThumbIndexes: (() => {
      let count = -1;
      let indexes: readonly number[] = [];
      return () => {
        if (ctx().value.length !== count) {
          count = ctx().value.length;
          indexes = ctx().value.map((_, index) => index);
        }
        return indexes;
      };
    })(),
    getRootProps: () => {
      const props = readProps();
      return rootBag(
        [props.dir, props.orientation, props.disabled, props.invalid, service.state].join("|"),
        () => ({
          id: rootId,
          dir: props.dir,
          "data-scope": "slider",
          "data-part": "root",
          "data-disabled": dataAttr(props.disabled),
          "data-orientation": props.orientation,
          "data-dragging": dataAttr(service.state === "dragging"),
          "data-invalid": dataAttr(props.invalid),
          "data-focus": dataAttr(service.state === "focus"),
        }),
      );
    },
    getLabelProps: () => {
      const props = readProps();
      return labelBag([props.label, props.disabled, props.orientation].join("|"), () => ({
        id: labelId,
        dir: props.dir,
        "data-scope": "slider",
        "data-part": "label",
        "data-disabled": dataAttr(props.disabled),
        "data-orientation": props.orientation,
        "data-invalid": dataAttr(props.invalid),
        "data-dragging": dataAttr(service.state === "dragging"),
        "data-focus": dataAttr(service.state === "focus"),
        for: hiddenInputId(0),
        style: { userSelect: "none" },
        onClick: (event: MouseEvent) => {
          if (!isInteractive(ctx())) return;
          event.preventDefault();
          focusThumb(Math.max(0, ctx().focusedIndex));
        },
      }));
    },
    getValueTextProps: (value: string) => {
      const props = readProps();
      return valueTextBag(
        [value, props.disabled, props.orientation, props.invalid, service.state].join("|"),
        () => ({
          id: valueTextId,
          dir: props.dir,
          "data-scope": "slider",
          "data-part": "value-text",
          "data-disabled": dataAttr(props.disabled),
          "data-orientation": props.orientation,
          "data-invalid": dataAttr(props.invalid),
          "data-focus": dataAttr(service.state === "focus"),
        }),
      );
    },
    getControlProps: () => {
      const props = readProps();
      return controlBag(
        [props.disabled, props.orientation, props.invalid, service.state].join("|"),
        () => ({
          id: controlId,
          dir: props.dir,
          "data-scope": "slider",
          "data-part": "control",
          "data-dragging": dataAttr(service.state === "dragging"),
          "data-disabled": dataAttr(props.disabled),
          "data-orientation": props.orientation,
          "data-invalid": dataAttr(props.invalid),
          "data-focus": dataAttr(service.state === "focus"),
          style: { position: "relative", touchAction: "none" },
          onPointerdown: (event: PointerEvent) => {
            if (!isInteractive(ctx())) return;
            if (event.pointerType === "mouse" && event.button !== 0) return;
            if (event.metaKey || event.ctrlKey || event.altKey) return;
            const value = trackValue(event.clientX, event.clientY);
            if (value === null) return;
            event.preventDefault();
            event.stopPropagation();
            // Capture the pointer: a release off the track must still end
            // the drag, or the phase strands in dragging and later keys
            // silently no-op (the cropper's stranded-dragging lesson).
            (event.currentTarget as Capturable | null)?.setPointerCapture?.(event.pointerId);
            send({ type: "POINTER_DOWN", pointValue: value });
          },
          onPointermove: (event: PointerEvent) => {
            if (service.state !== "dragging") return;
            const value = trackValue(event.clientX, event.clientY);
            if (value === null) return;
            send({ type: "POINTER_MOVE", pointValue: value });
          },
          onPointerup: () => {
            if (service.state !== "dragging") return;
            send({ type: "POINTER_UP" });
          },
        }),
      );
    },
    getTrackProps: () => {
      const props = readProps();
      return trackBag(
        [props.disabled, props.invalid, props.orientation, service.state].join("|"),
        () => ({
          id: trackId,
          dir: props.dir,
          "data-scope": "slider",
          "data-part": "track",
          "data-disabled": dataAttr(props.disabled),
          "data-invalid": dataAttr(props.invalid),
          "data-dragging": dataAttr(service.state === "dragging"),
          "data-orientation": props.orientation,
          "data-focus": dataAttr(service.state === "focus"),
          style: { position: "relative" },
        }),
      );
    },
    getRangeProps: () => {
      const props = readProps();
      const context = ctx();
      const percents = context.value.map((value) => percentOf(context, value));
      const low = Math.min(...percents);
      const high = Math.max(...percents);
      return rangeBag(
        [context.value.join(","), props.orientation, props.disabled, props.invalid, service.state]
          .join("|"),
        () => ({
          id: rangeId,
          dir: props.dir,
          "data-scope": "slider",
          "data-part": "range",
          "data-dragging": dataAttr(service.state === "dragging"),
          "data-focus": dataAttr(service.state === "focus"),
          "data-invalid": dataAttr(props.invalid),
          "data-disabled": dataAttr(props.disabled),
          "data-orientation": props.orientation,
          style: {
            "--slider-range-low": `${low}%`,
            "--slider-range-high": `${high}%`,
            ...(props.orientation === "vertical"
              ? { bottom: "var(--slider-range-low)", height: "calc(var(--slider-range-high) - var(--slider-range-low))" }
              : { left: "var(--slider-range-low)", width: "calc(var(--slider-range-high) - var(--slider-range-low))" }),
          },
        }),
      );
    },
    getThumbProps: (slot: SliderThumbSlotProps) => {
      const props = readProps();
      const context = ctx();
      const value = context.value[slot.index] ?? context.min;
      const range = thumbRange(context, slot.index);
      const percent = percentOf(context, value);
      const focused = service.state === "focus" && context.focusedIndex === slot.index;
      const dragging = service.state === "dragging" && context.focusedIndex === slot.index;
      const thumbLabel = props.thumbLabels[slot.index] ?? props.ariaLabel;
      return keyed(
        thumbBags,
        slot,
        [
          value,
          context.focusedIndex,
          service.state,
          props.disabled,
          props.orientation,
          props.dir,
          thumbLabel,
        ].join("|"),
        () => ({
          id: thumbId(slot.index),
          dir: props.dir,
          "data-scope": "slider",
          "data-part": "thumb",
          "data-index": String(slot.index),
          "data-disabled": dataAttr(props.disabled),
          "data-orientation": props.orientation,
          "data-focus": dataAttr(focused),
          "data-dragging": dataAttr(dragging),
          draggable: "false",
          "aria-disabled": props.disabled ? "true" : undefined,
          "aria-label": thumbLabel.length > 0 ? thumbLabel : undefined,
          "aria-labelledby": thumbLabel.length > 0 ? undefined : labelId,
          "aria-orientation": props.orientation,
          "aria-valuemax": String(range.max),
          "aria-valuemin": String(range.min),
          "aria-valuenow": String(value),
          role: "slider",
          tabindex: props.disabled ? undefined : "0",
          style: {
            "--slider-thumb": `${percent}%`,
            ...(props.orientation === "vertical"
              ? { bottom: "var(--slider-thumb)" }
              : { [props.dir === "rtl" ? "right" : "left"]: "var(--slider-thumb)" }),
          },
          onPointerdown: (event: PointerEvent) => {
            if (!isInteractive(ctx())) return;
            if (event.pointerType === "mouse" && event.button !== 0) return;
            const target = event.currentTarget as Element | null;
            const rect = target?.getBoundingClientRect?.();
            const midpoint = rect !== undefined
              ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
              : null;
            event.stopPropagation();
            (event.currentTarget as Capturable | null)?.setPointerCapture?.(event.pointerId);
            send({
              type: "THUMB_POINTER_DOWN",
              index: slot.index,
              offset: midpoint === null
                ? undefined
                : (props.orientation === "vertical"
                  ? event.clientY - midpoint.y
                  : event.clientX - midpoint.x),
            });
          },
          onPointermove: (event: PointerEvent) => {
            if (service.state !== "dragging") return;
            const value = trackValue(event.clientX, event.clientY);
            if (value === null) return;
            send({ type: "POINTER_MOVE", pointValue: value });
          },
          onPointerup: () => {
            if (service.state !== "dragging") return;
            send({ type: "POINTER_UP" });
          },
          onBlur: () => {
            if (!isInteractive(ctx())) return;
            send({ type: "BLUR" });
          },
          onFocus: () => {
            if (!isInteractive(ctx())) return;
            send({ type: "FOCUS", index: slot.index });
          },
          onKeydown: (event: KeyboardEvent) => {
            if (event.defaultPrevented) return;
            if (!isInteractive(ctx())) return;
            if (isComposing(event)) return;
            const large = event.shiftKey ? props.largeStep : undefined;
            const keyed = (type: string): boolean => {
              event.preventDefault();
              event.stopPropagation();
              send({ type, step: large });
              focusThumb(slot.index);
              return true;
            };
            const horizontal = props.orientation === "horizontal";
            switch (event.key) {
              case "ArrowUp":
                if (!horizontal) keyed("ARROW_INC");
                break;
              case "ArrowDown":
                if (!horizontal) keyed("ARROW_DEC");
                break;
              case "ArrowLeft":
                if (horizontal) keyed(props.dir === "rtl" ? "ARROW_INC" : "ARROW_DEC");
                break;
              case "ArrowRight":
                if (horizontal) keyed(props.dir === "rtl" ? "ARROW_DEC" : "ARROW_INC");
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
        }),
      );
    },
    getHiddenInputProps: (slot: SliderThumbSlotProps) => {
      const props = readProps();
      const value = ctx().value[slot.index] ?? ctx().min;
      return keyed(
        hiddenInputBags,
        slot,
        [props.name, value, slot.index].join("|"),
        () => ({
          id: hiddenInputId(slot.index),
          name: props.name.length > 0
            ? (ctx().value.length > 1 ? `${props.name}[]` : props.name)
            : undefined,
          form: undefined,
          type: "text",
          hidden: true,
          value: String(value),
        }),
      );
    },
  };
}
