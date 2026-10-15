import { dataAttr } from "../spin-select/select.shared.ts";
import {
  displayAngle,
  isInteractive,
  pointAngle,
  valueAsDegree,
  type AngleSliderContext,
} from "./angle-slider.machine.ts";

/**
 * Angle-slider connect: the DOM contract, the view-owned geometry, and the
 * reflexes the parts carry.
 *
 * What the machine owns stays there: the three phases, the degree value,
 * the step grid, the grab offset. Everything that needs a node lives here
 * — the pointer-to-angle measurement (reported in as a raw dial angle,
 * because the machine never touches the DOM), pointer capture (an
 * off-dial release still ends the drag), the thumb-over test for relative
 * drags, and the thumb focus after a press.
 */

export interface AngleSliderConnectProps {
  readonly disabled: boolean;
  readonly readOnly: boolean;
  readonly invalid: boolean;
  readonly required: boolean;
  readonly name: string;
  readonly dir: "ltr" | "rtl";
  readonly label: string;
  readonly ariaLabel: string;
}

export interface AngleSliderMarkerSlotProps {
  readonly value: number;
}

/** Zag's api methods, narrowed to the command surface the element exposes. */
export interface AngleSliderCommands {
  setValue(value: number): void;
  focus(): void;
}

export interface AngleSliderApi extends AngleSliderCommands {
  readonly value: number;
  readonly valueAsDegree: string;
  readonly dragging: boolean;
  /** The marker values, for the recipe's iteration. */
  getMarkers(): readonly number[];
  getMarkerState(value: number): "under-value" | "over-value" | "at-value";
  getRootProps(): Record<string, unknown>;
  getLabelProps(): Record<string, unknown>;
  getHiddenInputProps(): Record<string, unknown>;
  getControlProps(): Record<string, unknown>;
  getThumbProps(): Record<string, unknown>;
  getValueTextProps(value: string): Record<string, unknown>;
  getMarkerGroupProps(): Record<string, unknown>;
  getMarkerProps(slot: AngleSliderMarkerSlotProps): Record<string, unknown>;
}

/** The service the connect reads: the fork's, narrowed to what it needs. */
export interface AngleSliderService {
  readonly context: AngleSliderContext;
  /** The machine's state: idle, focused, or dragging. */
  readonly state: string;
  send(event: { type: string } & Record<string, unknown>): void;
}

export interface BagMemo {
  sig: string;
  bag: Record<string, unknown>;
}

/** A bag cached until the signature of the fields it reads moves. One memo
 * holds the single bag of one part (there is one root, one thumb, one
 * control per element), so a single slot is the whole cache. */
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

/** Markers are stable slots, so the memo dies with the slot it came from. */
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

const MARKERS = [0, 45, 90, 135, 180, 225, 270, 315];

/** Rim placement: dial degrees (zero top, clockwise) to a center-based
 * left/top pair on a 100-unit dial. Positioning tracks the value, so the
 * bag owns it — the slider thumb precedent. */
function rimPlacement(angle: number, radius: number): { left: string; top: string } {
  const radians = ((angle - 90) * Math.PI) / 180;
  const left = 50 + radius * Math.cos(radians);
  const top = 50 + radius * Math.sin(radians);
  return { left: `${left}%`, top: `${top}%` };
}

export function connectAngleSlider(
  service: AngleSliderService,
  readProps: () => AngleSliderConnectProps,
  id: string,
): AngleSliderApi {
  // Live accessor, never a snapshot: the fork replaces the context object
  // on every assign, so a destructured copy would freeze the first read.
  const ctx = (): AngleSliderContext => service.context;
  const send = service.send;
  const rootId = `angle-slider:${id}`;
  const controlId = `angle-slider:${id}:control`;
  const thumbId = `angle-slider:${id}:thumb`;
  const labelId = `angle-slider:${id}:label`;
  const hiddenInputId = `angle-slider:${id}:input`;
  const valueTextId = `angle-slider:${id}:value-text`;
  const markerId = (value: number): string => `angle-slider:${id}:marker:${value}`;

  const rootBag = memo();
  const labelBag = memo();
  const hiddenInputBag = memo();
  const controlBag = memo();
  const thumbBag = memo();
  const valueTextBag = memo();
  const markerGroupBag = memo();
  const markerBags = new WeakMap<{ value: number }, BagMemo>();

  /** The view reflex: after a press or keyboard move the thumb takes focus. */
  const focusThumb = (): void => {
    if (typeof document === "undefined") return;
    document.getElementById(thumbId)?.focus({ preventScroll: true });
  };

  /** The raw pointer angle around the control center, in degrees. */
  const rawAngle = (clientX: number, clientY: number): number | null => {
    if (typeof document === "undefined") return null;
    const control = document.getElementById(controlId);
    if (control === null || typeof control.getBoundingClientRect !== "function") return null;
    const rect = control.getBoundingClientRect();
    return pointAngle(rect.left + rect.width / 2, rect.top + rect.height / 2, clientX, clientY);
  };

  /** Whether the press landed on the thumb: relative drags grab, elsewhere
   * jumps. */
  const overThumb = (target: EventTarget | null): boolean => {
    if (target === null || typeof document === "undefined") return false;
    const thumb = document.getElementById(thumbId);
    if (thumb === null || !(target instanceof Element)) return false;
    return thumb === target || thumb.contains(target);
  };

  return {
    get value() {
      return ctx().value;
    },
    get valueAsDegree() {
      return valueAsDegree(ctx().value);
    },
    get dragging() {
      return service.state === "dragging";
    },
    setValue: (value: number) => {
      send({ type: "VALUE.SET", value });
    },
    focus: () => {
      if (!isInteractive(ctx())) return;
      focusThumb();
    },
    getMarkers: () => MARKERS,
    getMarkerState: (value: number) => {
      if (value < ctx().value) return "under-value";
      if (value > ctx().value) return "over-value";
      return "at-value";
    },
    getRootProps: () => {
      const props = readProps();
      const shown = displayAngle(ctx().value, ctx().dir);
      return rootBag([ctx().value, props.disabled, props.invalid, props.readOnly].join("|"), () => ({
        id: rootId,
        dir: props.dir,
        "data-scope": "angle-slider",
        "data-part": "root",
        "data-disabled": dataAttr(props.disabled),
        "data-invalid": dataAttr(props.invalid),
        "data-readonly": dataAttr(props.readOnly),
        style: { "--angle-value": String(ctx().value), "--angle": `${shown}deg` },
      }));
    },
    getLabelProps: () => {
      const props = readProps();
      return labelBag([props.label, props.disabled].join("|"), () => ({
        id: labelId,
        dir: props.dir,
        "data-scope": "angle-slider",
        "data-part": "label",
        "data-disabled": dataAttr(props.disabled),
        "data-invalid": dataAttr(props.invalid),
        "data-readonly": dataAttr(props.readOnly),
        for: hiddenInputId,
        onClick: (event: MouseEvent) => {
          if (!isInteractive(ctx())) return;
          event.preventDefault();
          focusThumb();
        },
      }));
    },
    getHiddenInputProps: () => {
      const props = readProps();
      return hiddenInputBag([props.name, ctx().value].join("|"), () => ({
        id: hiddenInputId,
        type: "hidden",
        name: props.name.length > 0 ? props.name : undefined,
        value: String(ctx().value),
      }));
    },
    getControlProps: () => {
      const props = readProps();
      return controlBag(
        [props.disabled, props.invalid, props.readOnly, service.state].join("|"),
        () => ({
          id: controlId,
          role: "presentation",
          dir: props.dir,
          "data-scope": "angle-slider",
          "data-part": "control",
          "data-disabled": dataAttr(props.disabled),
          "data-invalid": dataAttr(props.invalid),
          "data-readonly": dataAttr(props.readOnly),
          style: { position: "relative", touchAction: "none", userSelect: "none" },
          onPointerdown: (event: PointerEvent) => {
            if (!isInteractive(ctx())) return;
            if (event.pointerType === "mouse" && event.button !== 0) return;
            const angle = rawAngle(event.clientX, event.clientY);
            if (angle === null) return;
            // A press on the thumb drags relative (grab offset); elsewhere
            // the dial jumps to the pointer.
            const angularOffset = overThumb(event.target) ? angle - ctx().value : null;
            event.stopPropagation();
            (event.currentTarget as Capturable | null)?.setPointerCapture?.(event.pointerId);
            send({ type: "CONTROL.POINTER_DOWN", rawAngle: angle, angularOffset });
            focusThumb();
          },
          onPointermove: (event: PointerEvent) => {
            if (service.state !== "dragging") return;
            const angle = rawAngle(event.clientX, event.clientY);
            if (angle === null) return;
            send({ type: "DOC.POINTER_MOVE", rawAngle: angle });
          },
          onPointerup: () => {
            if (service.state !== "dragging") return;
            send({ type: "DOC.POINTER_UP" });
          },
        }),
      );
    },
    getThumbProps: () => {
      const props = readProps();
      const shown = displayAngle(ctx().value, ctx().dir);
      return thumbBag(
        [ctx().value, props.disabled, props.readOnly, props.invalid, service.state].join("|"),
        () => ({
          id: thumbId,
          role: "slider",
          dir: props.dir,
          "aria-label": props.ariaLabel.length > 0 ? props.ariaLabel : undefined,
          "aria-labelledby": props.ariaLabel.length > 0 ? undefined : labelId,
          "aria-valuemax": "360",
          "aria-valuemin": "0",
          "aria-valuenow": String(ctx().value),
          tabindex: props.readOnly || isInteractive(ctx()) ? "0" : undefined,
          "data-scope": "angle-slider",
          "data-part": "thumb",
          "data-disabled": dataAttr(props.disabled),
          "data-invalid": dataAttr(props.invalid),
          "data-readonly": dataAttr(props.readOnly),
          style: {
            "--thumb-angle": `${shown}deg`,
            ...rimPlacement(shown, 42),
            marginLeft: "-10px",
            marginTop: "-10px",
          },
          onFocus: () => {
            send({ type: "THUMB.FOCUS" });
          },
          onBlur: () => {
            send({ type: "THUMB.BLUR" });
          },
          onKeydown: (event: KeyboardEvent) => {
            if (event.defaultPrevented) return;
            if (!isInteractive(ctx())) return;
            if (isComposing(event)) return;
            const large = event.shiftKey ? ctx().largeStep : undefined;
            const keyed = (type: string): boolean => {
              event.preventDefault();
              send({ type, ...(large !== undefined ? { step: large } : {}) });
              focusThumb();
              return true;
            };
            switch (event.key) {
              case "ArrowLeft":
              case "ArrowUp":
                keyed("THUMB.ARROW_DEC");
                break;
              case "ArrowRight":
              case "ArrowDown":
                keyed("THUMB.ARROW_INC");
                break;
              case "Home":
                keyed("THUMB.HOME");
                break;
              case "End":
                keyed("THUMB.END");
                break;
              default:
                break;
            }
          },
        }),
      );
    },
    getValueTextProps: (value: string) => {
      const props = readProps();
      return valueTextBag([value].join("|"), () => ({
        id: valueTextId,
        dir: props.dir,
        "data-scope": "angle-slider",
        "data-part": "value-text",
      }));
    },
    getMarkerGroupProps: () => {
      const props = readProps();
      return markerGroupBag([props.dir].join("|"), () => ({
        dir: props.dir,
        "data-scope": "angle-slider",
        "data-part": "marker-group",
      }));
    },
    getMarkerProps: (slot: AngleSliderMarkerSlotProps) => {
      const props = readProps();
      const context = ctx();
      const shown = displayAngle(slot.value, context.dir);
      const state = slot.value < context.value
        ? "under-value"
        : slot.value > context.value
        ? "over-value"
        : "at-value";
      return keyed(markerBags, slot, [slot.value, context.value].join("|"), () => ({
        id: markerId(slot.value),
        dir: props.dir,
        "data-scope": "angle-slider",
        "data-part": "marker",
        "data-value": String(slot.value),
        "data-state": state,
        "data-disabled": dataAttr(props.disabled),
        style: {
          "--marker-angle": `${shown}deg`,
          ...rimPlacement(shown, 46),
        },
      }));
    },
  };
}
