/**
 * Number-input connect: the DOM contract, the keyboard map, and the two
 * gestures — the spin controls' press-and-hold and the scrubber's drag.
 *
 * What the machine owns stays there: the value, its range, and the phase of
 * the press gesture. What lives here is everything that needs a node: the
 * arrow/Home/End key map (with Zag's modifier-key step sizes), the wheel,
 * the partial-number guard on `beforeinput`, the focus the machine asks for
 * by changing state, the scrubber's drag arithmetic (client deltas, wrap,
 * RTL flip), and the geometry channel that places the virtual cursor.
 *
 * The press-and-hold clock is a stdlib reflex on the control, not a state:
 * `use:autoplay` armed while the gesture is in its dwell ticks once at the
 * dwell and then, once the machine has moved the phase to `repeat`, ticks at
 * the repeat rate. The machine's own states are only `idle`, `focused` and
 * `scrubbing`, so there is nothing to exit when the gesture ends — clearing
 * the phase is enough, and that is what disarms both clocks.
 */

import { parseValue } from "./number-input.machine.ts";
import type { NumberInputContext, NumberInputPoint } from "./number-input.machine.ts";

export interface NumberInputConnectProps {
  readonly dir: "ltr" | "rtl";
  /** The authored `disabled`, without the fieldset. */
  readonly disabled: boolean;
  readonly readOnly: boolean;
  readonly required: boolean;
  /** The authored `invalid`, or undefined to fall back to the range check. */
  readonly invalid: boolean | undefined;
  readonly allowMouseWheel: boolean;
  readonly allowOverflow: boolean;
  readonly focusInputOnChange: boolean;
  readonly inputMode: string;
  readonly pattern: string;
  readonly name: string | undefined;
  readonly form: string | undefined;
  readonly incrementLabel: string;
  readonly decrementLabel: string;
  /** What a form reset restores: the value the element was seeded with. */
  readonly initialValue: string;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly largeStep: number;
  readonly smallStep: number;
}

/** The element's imperative surface — Zag's api methods. Every one is a send:
 * the view resolves the host's words before the machine hears them. */
export interface NumberInputCommands {
  setValue(value: number | string): void;
  clearValue(): void;
  increment(): void;
  decrement(): void;
  setToMax(): void;
  setToMin(): void;
  focus(): void;
}

export interface NumberInputApi extends NumberInputCommands {
  readonly value: string;
  readonly valueAsNumber: number;
  readonly empty: boolean;
  readonly invalid: boolean;
  readonly disabled: boolean;
  readonly readOnly: boolean;
  readonly focused: boolean;
  readonly scrubbing: boolean;
  readonly canIncrement: boolean;
  readonly canDecrement: boolean;
  getRootProps(): Record<string, unknown>;
  getLabelProps(): Record<string, unknown>;
  getControlProps(): Record<string, unknown>;
  getValueTextProps(): Record<string, unknown>;
  getInputProps(): Record<string, unknown>;
  getDecrementTriggerProps(): Record<string, unknown>;
  getIncrementTriggerProps(): Record<string, unknown>;
  getScrubberProps(): Record<string, unknown>;
  getCursorProps(): Record<string, unknown>;
}

type Send = (event: { type: string } & Record<string, unknown>) => void;

export interface NumberInputService {
  readonly context: NumberInputContext;
  readonly focused: boolean;
  readonly scrubbing: boolean;
  send(event: { type: string } & Record<string, unknown>): void;
}

/** The behavioural props, read on demand: the connect lives as long as the
 * element does, so a snapshot would freeze the first read's values inside
 * the handlers it caches. */
export type ReadNumberInputProps = () => NumberInputConnectProps;

/** The part-id namespace. */
const NAMESPACE = "number-input";

/** The dwell before the auto-repeat starts, and the repeat rate itself —
 * Zag's `waitForChangeDelay` and `spinValue`. */
const SPIN_DWELL = 300;
const SPIN_REPEAT = 50;

/** The scrubber's virtual cursor is 15px wide: the offset that centers it
 * under the pointer that grabbed it. */
const CURSOR_HALF = 7.5;

/** Zag's `dataAttr`: the attribute is present when the condition holds and
 * absent otherwise, which is what the state utilities key on. */
function dataAttr(value: boolean): string | undefined {
  return value ? "" : undefined;
}

/** A bag cached until the signature of the fields it reads moves. */
interface BagMemo {
  sig: string;
  bag: Record<string, unknown>;
}

/** A binding re-reads the bag on every machine move, so a fresh bag per read
 * would detach and re-attach every listener each move. Only one of the
 * fields the signature enumerates moving rebuilds it. */
function cached(): (sig: string, build: () => Record<string, unknown>) => Record<string, unknown> {
  let sig = "";
  let bag: Record<string, unknown> | undefined;
  return (next: string, build: () => Record<string, unknown>): Record<string, unknown> => {
    if (bag !== undefined && sig === next) return bag;
    sig = next;
    bag = build();
    return bag;
  };
}

/** The input's change event, narrowed to the one field the machine reads. */
interface InputChangeEvent {
  readonly currentTarget: { readonly value: string };
}

/** What `beforeinput` reads to decide whether the next character may land. */
interface BeforeInputEvent {
  preventDefault(): void;
  readonly currentTarget: {
    readonly selectionStart: number | null;
    readonly selectionEnd: number | null;
    readonly value: string;
  };
  readonly data: string | null;
}

/**
 * The caret API a text input carries. The element is ours by id and is an
 * input, so the shape is structural rather than checked at runtime.
 */
type TextInput = HTMLElement & {
  readonly value: string;
  setSelectionRange(start: number, end: number): void;
};

/** `roundToDpr`: device-pixel rounding, so a fractional-scaled display does
 * not quantize a one-pixel drag into nothing. */
const roundToDpr = (value: number, dpr: number): number => Math.floor(value * dpr + 0.5) / dpr;

/** `wrap`: the virtual cursor wraps around the viewport width, and a view
 * with no width to wrap in is left alone. */
const wrapPoint = (x: number, width: number): number =>
  width > 0 ? ((x % width) + width) % width : x;

/**
 * The default `pattern` shape, allowed to be incomplete: a partial number
 * is one the user is still typing ("-", "1.", "1.2"). This is the local
 * stand-in for `parser.isValidPartialNumber`, which belongs to the formatter
 * the scope grammar cannot carry.
 */
const PARTIAL_NUMBER = /^-?\d*\.?\d*$/;

export function connectRobotNumberInput(
  service: NumberInputService,
  readProps: ReadNumberInputProps,
  id: string,
): NumberInputApi {
  const ownerId = id.startsWith(`${NAMESPACE}:`) ? id : `${NAMESPACE}:${id}`;
  const rootId = ownerId;
  const labelId = `${ownerId}:label`;
  const controlId = `${ownerId}:control`;
  const inputId = `${ownerId}:input`;
  const incrementId = `${ownerId}:increment`;
  const decrementId = `${ownerId}:decrement`;
  const scrubberId = `${ownerId}:scrubber`;
  const cursorId = `${ownerId}:cursor`;

  const ctx = (): NumberInputContext => service.context;
  const send: Send = (event): void => {
    service.send(event);
  };

  const inputEl = (): TextInput | null => document.getElementById(inputId) as TextInput | null;

  // ---- derived reads ------------------------------------------------------

  const valueAsNumber = (): number => parseValue(ctx().value);

  const disabled = (): boolean => readProps().disabled || ctx().fieldsetDisabled;

  /** The authored `invalid` wins; otherwise the range speaks. */
  const invalid = (): boolean => {
    const authored = readProps().invalid;
    if (authored !== undefined) return authored;
    const at = Number.isNaN(valueAsNumber()) ? 0 : valueAsNumber();
    return at < readProps().min || at > readProps().max;
  };

  const canIncrement = (): boolean => {
    const props = readProps();
    if (props.allowOverflow) return true;
    return (Number.isNaN(valueAsNumber()) ? 0 : valueAsNumber()) < props.max;
  };

  const canDecrement = (): boolean => {
    const props = readProps();
    if (props.allowOverflow) return true;
    return (Number.isNaN(valueAsNumber()) ? 0 : valueAsNumber()) > props.min;
  };

  /** Focus the input, and leave the caret at the end of what it holds. */
  const focusInput = (): void => {
    if (!readProps().focusInputOnChange) return;
    const el = inputEl();
    if (el === null) return;
    el.focus({ preventScroll: true });
    if (typeof el.setSelectionRange === "function") {
      const end = el.value.length;
      el.setSelectionRange(end, end);
    }
  };

  // ---- the press-and-hold clock ------------------------------------------

  /**
   * One `use:autoplay` entry carries both phases of the gesture: the phase
   * the machine holds picks the interval, so the control is the only part
   * that needs to know the clock exists. The tick reads the phase when it
   * fires rather than capturing it — a stdlib action keeps the callback it
   * was handed at setup, so a phase-dependent closure would send the dwell
   * event forever.
   */
  const spinClock = (): Record<string, unknown> => ({
    interval: ctx().spin === "repeat" ? SPIN_REPEAT : SPIN_DWELL,
    enabled: ctx().spin !== null,
    onTick: (): void => send(ctx().spin === "repeat" ? { type: "SPIN" } : { type: "CHANGE_DELAY" }),
  });

  // ---- the scrubber gesture ----------------------------------------------

  /** The gesture's last client X: the delta between two moves is the hint. */
  let lastClientX: number | null = null;

  const scrubberDown = (event: PointerEvent): void => {
    if (readProps().disabled) return;
    if (event.button !== 0) return;
    const dpr = document.defaultView?.devicePixelRatio ?? 1;
    const half = roundToDpr(CURSOR_HALF, dpr);
    const point = {
      x: event.clientX - half,
      y: event.clientY - half,
    } satisfies NumberInputPoint;
    lastClientX = event.clientX;
    send({ type: "SCRUBBER.PRESS_DOWN", point });
    event.preventDefault();
    // Capture keeps the gesture on this element: a move that leaves the
    // rail still reports here, and a lift anywhere ends it. Node's DOM
    // (the unit harness) ships no capture, so it is read rather than assumed.
    const el = document.getElementById(scrubberId);
    if (el !== null && typeof el.setPointerCapture === "function" && typeof event.pointerId === "number") {
      el.setPointerCapture(event.pointerId);
    }
    focusInput();
  };

  const scrubberMove = (event: PointerEvent): void => {
    const point = ctx().cursorPoint;
    const from = lastClientX;
    lastClientX = event.clientX;
    if (point === null || from === null) return;
    const dpr = document.defaultView?.devicePixelRatio ?? 1;
    const step = roundToDpr(event.clientX - from, dpr);
    // No horizontal movement is no hint, so the value does not move.
    if (step === 0) return;
    const hint: "increment" | "decrement" = step > 0 ? "increment" : "decrement";
    const width = document.defaultView?.innerWidth ?? 0;
    const next: NumberInputPoint = {
      x: wrapPoint(point.x + step, width),
      y: point.y,
    };
    // RTL mirrors the axis: a rightward drag decreases.
    send({
      type: "SCRUBBER.POINTER_MOVE",
      hint: readProps().dir === "rtl" ? (hint === "increment" ? "decrement" : "increment") : hint,
      point: next,
    });
    event.preventDefault();
  };

  const scrubberUp = (): void => {
    lastClientX = null;
    send({ type: "SCRUBBER.POINTER_UP" });
  };

  // ---- the keyboard map ---------------------------------------------------

  /** Zag's `getEventStepValue`: Alt takes the small step, Shift takes the
   * large one, and everything else takes `step`. */
  const stepFor = (event: KeyboardEvent): number => {
    const props = readProps();
    const isArrow = event.key === "ArrowUp" || event.key === "ArrowDown";
    if (event.altKey && isArrow) return props.smallStep;
    if (event.shiftKey && isArrow) return props.largeStep;
    return props.step;
  };

  const nakedKey = (event: KeyboardEvent): boolean =>
    !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey;

  const onInputKeydown = (event: KeyboardEvent): void => {
    if (event.defaultPrevented) return;
    if (readProps().readOnly) return;
    if (event.isComposing) return;
    switch (event.key) {
      case "ArrowUp":
        send({ type: "INPUT.ARROW_UP", step: stepFor(event) });
        event.preventDefault();
        break;
      case "ArrowDown":
        send({ type: "INPUT.ARROW_DOWN", step: stepFor(event) });
        event.preventDefault();
        break;
      case "Home":
        if (!nakedKey(event)) return;
        send({ type: "INPUT.HOME" });
        event.preventDefault();
        break;
      case "End":
        if (!nakedKey(event)) return;
        send({ type: "INPUT.END" });
        event.preventDefault();
        break;
      case "Enter":
        send({ type: "INPUT.ENTER" });
        break;
      default:
        break;
    }
  };

  const onBeforeInput = (event: BeforeInputEvent): void => {
    const current = event.currentTarget;
    const start = current.selectionStart ?? 0;
    const end = current.selectionEnd ?? 0;
    const next = current.value.slice(0, start) + (event.data ?? "") + current.value.slice(end);
    if (!PARTIAL_NUMBER.test(next)) event.preventDefault();
  };

  const onWheel = (event: WheelEvent): void => {
    if (!readProps().allowMouseWheel) return;
    event.preventDefault();
    const direction = Math.sign(event.deltaY) * -1;
    if (direction === 1) send({ type: "VALUE.INCREMENT" });
    else if (direction === -1) send({ type: "VALUE.DECREMENT" });
  };

  // ---- cached bags --------------------------------------------------------

  const rootBag = cached();
  const labelBag = cached();
  const controlBag = cached();
  const valueTextBag = cached();
  const inputBag = cached();
  const decrementBag = cached();
  const incrementBag = cached();
  const scrubberBag = cached();
  const cursorBag = cached();

  const stateAttrs = (): Record<string, unknown> => ({
    "data-disabled": dataAttr(disabled()),
    "data-focus": dataAttr(service.focused),
    "data-invalid": dataAttr(invalid()),
    "data-scrubbing": dataAttr(service.scrubbing),
  });

  return {
    get value(): string {
      return ctx().value;
    },
    get valueAsNumber(): number {
      return valueAsNumber();
    },
    get empty(): boolean {
      return ctx().value === "";
    },
    get invalid(): boolean {
      return invalid();
    },
    get disabled(): boolean {
      return disabled();
    },
    get readOnly(): boolean {
      return readProps().readOnly;
    },
    get focused(): boolean {
      return service.focused;
    },
    get scrubbing(): boolean {
      return service.scrubbing;
    },
    get canIncrement(): boolean {
      return canIncrement();
    },
    get canDecrement(): boolean {
      return canDecrement();
    },
    setValue: (value: number | string): void => send({ type: "VALUE.SET", value }),
    clearValue: (): void => send({ type: "VALUE.CLEAR" }),
    increment: (): void => send({ type: "VALUE.INCREMENT" }),
    decrement: (): void => send({ type: "VALUE.DECREMENT" }),
    setToMax: (): void => send({ type: "VALUE.SET", value: readProps().max }),
    setToMin: (): void => send({ type: "VALUE.SET", value: readProps().min }),
    focus: (): void => focusInput(),
    getRootProps: () => {
      const props = readProps();
      return rootBag(
        `${props.dir}\u0000${disabled()}\u0000${service.focused}\u0000${invalid()}\u0000${service.scrubbing}`,
        () => ({
          id: rootId,
          dir: props.dir,
          ...stateAttrs(),
          // The fieldset and the form are the platform's state: the action
          // reports both and the machine decides what they mean.
          "use:form-control": {
            onDisabledChange: (value: boolean): void => send({ type: "FIELDSET.DISABLED", value }),
            onFormReset: (): void => send({ type: "VALUE.SET", value: props.initialValue }),
          },
        }),
      );
    },
    getLabelProps: () => {
      const props = readProps();
      return labelBag(
        `${props.dir}\u0000${disabled()}\u0000${service.focused}\u0000${invalid()}\u0000${props.required}\u0000${service.scrubbing}`,
        () => ({
          id: labelId,
          dir: props.dir,
          ...stateAttrs(),
          "data-required": dataAttr(props.required),
          for: inputId,
          onClick: (): void => focusInput(),
        }),
      );
    },
    getControlProps: () => {
      const props = readProps();
      return controlBag(
        `${props.dir}\u0000${disabled()}\u0000${service.focused}\u0000${invalid()}\u0000${service.scrubbing}\u0000${ctx().spin}`,
        () => ({
          id: controlId,
          dir: props.dir,
          role: "group",
          "aria-disabled": disabled(),
          "aria-invalid": invalid(),
          ...stateAttrs(),
          "use:autoplay": spinClock(),
        }),
      );
    },
    getValueTextProps: () => {
      const props = readProps();
      return valueTextBag(
        `${props.dir}\u0000${disabled()}\u0000${service.focused}\u0000${invalid()}\u0000${service.scrubbing}`,
        () => ({
          id: `${ownerId}:value-text`,
          dir: props.dir,
          ...stateAttrs(),
        }),
      );
    },
    getInputProps: () => {
      const props = readProps();
      const number = valueAsNumber();
      return inputBag(
        [
          props.dir,
          props.name,
          props.form,
          props.inputMode,
          props.pattern,
          props.disabled,
          props.readOnly,
          props.required,
          props.allowMouseWheel,
          service.focused,
          service.scrubbing,
          invalid(),
          ctx().value,
          ctx().fieldsetDisabled,
          number,
          props.min,
          props.max,
        ].join("\u0000"),
        () => ({
          id: inputId,
          dir: props.dir,
          type: "text",
          role: "spinbutton",
          name: props.name,
          form: props.form,
          inputMode: props.inputMode,
          pattern: props.pattern,
          autoComplete: "off",
          autoCorrect: "off",
          spellCheck: false,
          // The bag carries the machine's value, so the platform's own value
          // setter keeps the field in step — including the caret, which a
          // same-value assignment leaves alone.
          value: ctx().value,
          disabled: disabled(),
          readOnly: props.readOnly,
          required: props.required,
          "aria-invalid": invalid(),
          "aria-valuemin": props.min,
          "aria-valuemax": props.max,
          "aria-valuenow": Number.isNaN(number) ? undefined : number,
          "aria-roledescription": "numberfield",
          "data-disabled": dataAttr(disabled()),
          "data-invalid": dataAttr(invalid()),
          "data-scrubbing": dataAttr(service.scrubbing),
          onFocus: (): void => send({ type: "INPUT.FOCUS" }),
          onBlur: (): void => send({ type: "INPUT.BLUR" }),
          onInput: (event: InputChangeEvent): void =>
            send({ type: "INPUT.CHANGE", value: event.currentTarget.value }),
          onBeforeInput: onBeforeInput,
          onKeydown: onInputKeydown,
          onWheel: onWheel,
        }),
      );
    },
    getDecrementTriggerProps: () => {
      const props = readProps();
      const off = disabled() || !canDecrement() || props.readOnly;
      return decrementBag(
        `${props.dir}\u0000${off}\u0000${service.focused}\u0000${service.scrubbing}`,
        () => ({
          id: decrementId,
          dir: props.dir,
          type: "button",
          disabled: off,
          tabIndex: -1,
          "aria-label": props.decrementLabel,
          "aria-controls": inputId,
          "data-disabled": dataAttr(off),
          "data-scrubbing": dataAttr(service.scrubbing),
          "data-focus": dataAttr(service.focused),
          // A press runs the gesture even when the trigger itself is off:
          // the button's own disabled attribute stops the click, and the
          // machine only hears about presses that got through.
          onPointerDown: (event: PointerEvent): void => {
            if (event.button !== 0) return;
            send({ type: "TRIGGER.PRESS_DOWN", hint: "decrement", pointerType: event.pointerType });
            if (event.pointerType === "mouse") event.preventDefault();
            focusInput();
          },
          onPointerUp: (event: PointerEvent): void =>
            send({ type: "TRIGGER.PRESS_UP", hint: "decrement", pointerType: event.pointerType }),
          onPointerLeave: (): void => send({ type: "TRIGGER.PRESS_UP", hint: "decrement" }),
        }),
      );
    },
    getIncrementTriggerProps: () => {
      const props = readProps();
      const off = disabled() || !canIncrement() || props.readOnly;
      return incrementBag(
        `${props.dir}\u0000${off}\u0000${service.focused}\u0000${service.scrubbing}`,
        () => ({
          id: incrementId,
          dir: props.dir,
          type: "button",
          disabled: off,
          tabIndex: -1,
          "aria-label": props.incrementLabel,
          "aria-controls": inputId,
          "data-disabled": dataAttr(off),
          "data-scrubbing": dataAttr(service.scrubbing),
          "data-focus": dataAttr(service.focused),
          onPointerDown: (event: PointerEvent): void => {
            if (event.button !== 0) return;
            send({ type: "TRIGGER.PRESS_DOWN", hint: "increment", pointerType: event.pointerType });
            if (event.pointerType === "mouse") event.preventDefault();
            focusInput();
          },
          onPointerUp: (event: PointerEvent): void =>
            send({ type: "TRIGGER.PRESS_UP", hint: "increment", pointerType: event.pointerType }),
          onPointerLeave: (): void => send({ type: "TRIGGER.PRESS_UP", hint: "increment" }),
        }),
      );
    },
    getScrubberProps: () => {
      const props = readProps();
      return scrubberBag(
        `${props.disabled}\u0000${props.dir}\u0000${service.scrubbing}\u0000${ctx().cursorPoint === null}`,
        () => ({
          id: scrubberId,
          dir: props.dir,
          role: "presentation",
          "data-disabled": dataAttr(props.disabled),
          "data-scrubbing": dataAttr(service.scrubbing),
          "data-armed": dataAttr(ctx().cursorPoint !== null),
          onPointerDown: scrubberDown,
          onPointerMove: scrubberMove,
          onPointerUp: scrubberUp,
        }),
      );
    },
    // The virtual cursor's position is continuous geometry, so it rides the
    // channel as custom properties; the markup's own placement utilities
    // decide what feeds off them.
    getCursorProps: () => {
      const point = ctx().cursorPoint;
      return cursorBag(
        `${service.scrubbing}\u0000${point === null ? "" : `${point.x}\u0000${point.y}`}`,
        () => ({
          id: cursorId,
          "aria-hidden": true,
          hidden: !service.scrubbing,
          "data-scrubbing": dataAttr(service.scrubbing),
          style: {
            "--number-input-cursor-x": `${point === null ? 0 : point.x}px`,
            "--number-input-cursor-y": `${point === null ? 0 : point.y}px`,
          },
        }),
      );
    },
  };
}
