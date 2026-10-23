import { defineComponent, type ApiOf, type ComponentDef, type ScopeFor } from "@spin/runtime";
import { numberInput as numberInputMachine } from "./number-input.machine.ts";
import type { NumberInputArgs, NumberInputContext, NumberInputState } from "./number-input.state.ts";
import { isValueWithinRange, parseValue } from "./number-input.state.ts";
import type { NumberInputEvents } from "./number-input.events.ts";
import type {
  NumberInputFocusChange,
  NumberInputInvalidReason,
  NumberInputValueChange,
  NumberInputValueCommit,
  NumberInputValueInvalid,
} from "./number-input.events.ts";

export type { NumberInputArgs, NumberInputState };
export type {
  NumberInputFocusChange,
  NumberInputInvalidReason,
  NumberInputValueChange,
  NumberInputValueCommit,
  NumberInputValueInvalid,
};

type ScopeLike = ScopeFor<NumberInputContext, NumberInputEvents, NumberInputState>;

type Ctx = NumberInputContext;

const SPIN_DWELL = 300;
const SPIN_REPEAT = 50;
const CURSOR_HALF = 7.5;
const PARTIAL_NUMBER = /^-?\d*\.?\d*$/;

const valueAsNumber = (context: Ctx): number => parseValue(context.value);

/** Focus the input and leave the caret at the end of what it holds. */
const focusInput = (scope: ScopeLike): void => {
  if (!scope.context.focusInputOnChange) return;
  const node = scope.root().ownerDocument?.getElementById(scope.id("input"));
  if (node === null || node === undefined) return;
  if (typeof (node as HTMLElement).focus !== "function") return;
  (node as HTMLElement).focus({ preventScroll: true });
  const text = node as HTMLInputElement;
  if (typeof text.setSelectionRange === "function" && typeof text.value === "string") {
    const end = text.value.length;
    text.setSelectionRange(end, end);
  }
};

const disabledOf = (context: Ctx): boolean => context.disabled || context.fieldsetDisabled;

const invalidOf = (context: Ctx): boolean => {
  if (context.invalid !== undefined) return context.invalid;
  const at = valueAsNumber(context);
  return (Number.isNaN(at) ? 0 : at) < context.min || (Number.isNaN(at) ? 0 : at) > context.max;
};

const canIncrement = (context: Ctx): boolean => {
  if (context.allowOverflow) return true;
  const at = valueAsNumber(context);
  return (Number.isNaN(at) ? 0 : at) < context.max;
};

const canDecrement = (context: Ctx): boolean => {
  if (context.allowOverflow) return true;
  const at = valueAsNumber(context);
  return (Number.isNaN(at) ? 0 : at) > context.min;
};

const roundToDpr = (value: number, dpr: number): number => Math.floor(value * dpr + 0.5) / dpr;

const wrapPoint = (x: number, width: number): number =>
  width > 0 ? ((x % width) + width) % width : x;

let lastScrubX: number | null = null;

/** Element-lifetime handlers: created once per root, so a bag rebuild hands
 * the element the same listener identity instead of re-attaching every
 * move. The captured scope's context proxy reads live signals, so a
 * first-build scope never goes stale. */
type HandlerTable = {
  readonly onInputFocus: () => void;
  readonly onInputBlur: () => void;
  readonly onInput: (event: { readonly currentTarget: { readonly value: string } }) => void;
  readonly onBeforeInput: (event: {
    readonly currentTarget: {
      readonly selectionStart: number | null;
      readonly selectionEnd: number | null;
      readonly value: string;
    };
    readonly data: string | null;
    preventDefault(): void;
  }) => void;
  readonly onInputKeydown: (event: KeyboardEvent) => void;
  readonly onInputWheel: (event: WheelEvent) => void;
  readonly onScrubberDown: (event: PointerEvent) => void;
  readonly onScrubberMove: (event: PointerEvent) => void;
  readonly onScrubberUp: () => void;
  readonly onDecrementDown: (event: PointerEvent) => void;
  readonly onIncrementDown: (event: PointerEvent) => void;
  readonly onTriggerUp: () => void;
  readonly onLabelClick: () => void;
};
const handlerTables = new WeakMap<Element, HandlerTable>();

const handlersOf = (scope: ScopeLike): HandlerTable => {
  const root = scope.root();
  const found = handlerTables.get(root);
  if (found !== undefined) return found;
  const made: HandlerTable = {
    onInputFocus: (): void => {
      scope.send({ type: "INPUT.FOCUS" });
    },
    onInputBlur: (): void => {
      scope.send({ type: "INPUT.BLUR" });
    },
    onInput: (event: { readonly currentTarget: { readonly value: string } }): void => {
      scope.send({ type: "INPUT.CHANGE", value: event.currentTarget.value });
    },
    onBeforeInput: (event: {
      readonly currentTarget: {
        readonly selectionStart: number | null;
        readonly selectionEnd: number | null;
        readonly value: string;
      };
      readonly data: string | null;
      preventDefault(): void;
    }): void => {
      const current = event.currentTarget;
      const start = current.selectionStart ?? 0;
      const end = current.selectionEnd ?? 0;
      const next = current.value.slice(0, start) + (event.data ?? "") + current.value.slice(end);
      if (!PARTIAL_NUMBER.test(next)) event.preventDefault();
    },
    onInputKeydown: (event: KeyboardEvent): void => {
      if (event.defaultPrevented) return;
      if (scope.context.readOnly) return;
      if (event.isComposing) return;
      const context = scope.context;
      const isArrow = event.key === "ArrowUp" || event.key === "ArrowDown";
      const step = event.altKey && isArrow
        ? context.smallStep
        : event.shiftKey && isArrow
        ? context.largeStep
        : context.step;
      const naked = !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey;
      switch (event.key) {
        case "ArrowUp":
          scope.send({ type: "INPUT.ARROW_UP", step });
          event.preventDefault();
          break;
        case "ArrowDown":
          scope.send({ type: "INPUT.ARROW_DOWN", step });
          event.preventDefault();
          break;
        case "Home":
          if (!naked) return;
          scope.send({ type: "INPUT.HOME" });
          event.preventDefault();
          break;
        case "End":
          if (!naked) return;
          scope.send({ type: "INPUT.END" });
          event.preventDefault();
          break;
        case "Enter":
          scope.send({ type: "INPUT.ENTER" });
          break;
        default:
          break;
      }
    },
    onInputWheel: (event: WheelEvent): void => {
      if (!scope.context.allowMouseWheel) return;
      event.preventDefault();
      const direction = Math.sign(event.deltaY) * -1;
      if (direction === 1) scope.send({ type: "VALUE.INCREMENT" });
      else if (direction === -1) scope.send({ type: "VALUE.DECREMENT" });
    },
    onScrubberDown: (event: PointerEvent): void => {
      if (scope.context.disabled) return;
      if (event.button !== 0) return;
      const doc = typeof document === "undefined" ? undefined : document;
      const dpr = doc?.defaultView?.devicePixelRatio ?? 1;
      const half = roundToDpr(CURSOR_HALF, dpr);
      lastScrubX = event.clientX;
      scope.send({
        type: "SCRUBBER.PRESS_DOWN",
        point: { x: event.clientX - half, y: event.clientY - half },
      });
      event.preventDefault();
      focusInput(scope);
    },
    onScrubberMove: (event: PointerEvent): void => {
      const point = scope.context.cursorPoint;
      const from = lastScrubX;
      lastScrubX = event.clientX;
      if (point === null || from === null) return;
      const doc = typeof document === "undefined" ? undefined : document;
      const dpr = doc?.defaultView?.devicePixelRatio ?? 1;
      const step = roundToDpr(event.clientX - from, dpr);
      if (step === 0) return;
      const hint = step > 0 ? "increment" : "decrement";
      const width = doc?.defaultView?.innerWidth ?? 0;
      const rtl = scope.context.dir === "rtl";
      scope.send({
        type: "SCRUBBER.POINTER_MOVE",
        hint: rtl ? (hint === "increment" ? "decrement" : "increment") : hint,
        point: { x: wrapPoint(point.x + step, width), y: point.y },
      });
      event.preventDefault();
    },
    onScrubberUp: (): void => {
      lastScrubX = null;
      scope.send({ type: "SCRUBBER.POINTER_UP" });
    },
    onDecrementDown: (event: PointerEvent): void => {
      if (event.button !== 0) return;
      scope.send({ type: "TRIGGER.PRESS_DOWN", hint: "decrement" });
      if (event.pointerType === "mouse") event.preventDefault();
      focusInput(scope);
    },
    onIncrementDown: (event: PointerEvent): void => {
      if (event.button !== 0) return;
      scope.send({ type: "TRIGGER.PRESS_DOWN", hint: "increment" });
      if (event.pointerType === "mouse") event.preventDefault();
      focusInput(scope);
    },
    onTriggerUp: (): void => {
      scope.send({ type: "TRIGGER.PRESS_UP" });
    },
    onLabelClick: (): void => {
      focusInput(scope);
    },
  };
  handlerTables.set(root, made);
  return made;
};

export const def = {
  name: "number-input",
  machine: (args: NumberInputArgs, authored: (name: string) => boolean) => numberInputMachine(args, authored),
  start: "idle",
  parts: {
    root: {
      attrs: (scope: ScopeLike) => ({
        dir: scope.context.dir,
        "data-disabled": scope.attr(disabledOf(scope.context)),
        "data-focus": scope.attr(scope.state === "focused"),
        "data-invalid": scope.attr(invalidOf(scope.context)),
        "data-scrubbing": scope.attr(scope.state === "scrubbing"),
        "use:form-control": {
          onDisabledChange: (value: boolean): void => {
            scope.send({ type: "FIELDSET.DISABLED", value });
          },
          onFormReset: (): void => {
            scope.send({ type: "VALUE.SET", value: scope.context.initialValue });
          },
        },
      }),
    },
    label: {
      attrs: (scope: ScopeLike) => ({
        dir: scope.context.dir,
        "data-required": scope.attr(scope.context.required),
        for: scope.id("input"),
        onClick: (): void => {
          focusInput(scope);
        },
      }),
    },
    control: {
      attrs: (scope: ScopeLike) => {
        const context = scope.context;
        const spinning = context.spin !== null;
        return {
          dir: context.dir,
          role: "group",
          "data-disabled": scope.attr(disabledOf(context)),
          "data-focus": scope.attr(scope.state === "focused"),
          "data-invalid": scope.attr(invalidOf(context)),
          "data-scrubbing": scope.attr(scope.state === "scrubbing"),
          "aria-disabled": disabledOf(context),
          "aria-invalid": invalidOf(context),
          "use:autoplay": {
            interval: context.spin === "repeat" ? SPIN_REPEAT : SPIN_DWELL,
            enabled: spinning,
            onTick: (): void => {
              scope.send(context.spin === "repeat" ? { type: "SPIN" } : { type: "CHANGE_DELAY" });
            },
          },
        };
      },
    },
    valueText: {
      attrs: (scope: ScopeLike) => ({
        dir: scope.context.dir,
        "data-disabled": scope.attr(disabledOf(scope.context)),
        "data-focus": scope.attr(scope.state === "focused"),
      }),
    },
    input: {
      id: "input",
      attrs: (scope: ScopeLike) => {
        const context = scope.context;
        const number = valueAsNumber(context);
        return {
          dir: context.dir,
          type: "text",
          role: "spinbutton",
          name: context.name,
          form: context.form,
          inputMode: context.inputMode,
          pattern: context.pattern,
          autoComplete: "off",
          autoCorrect: "off",
          spellCheck: false,
          value: context.value,
          disabled: disabledOf(context),
          readOnly: context.readOnly,
          required: context.required,
          "aria-invalid": invalidOf(context),
          "aria-valuemin": context.min,
          "aria-valuemax": context.max,
          "aria-valuenow": Number.isNaN(number) ? undefined : number,
          "aria-roledescription": "numberfield",
          onFocus: handlersOf(scope).onInputFocus,
          onBlur: handlersOf(scope).onInputBlur,
          onInput: handlersOf(scope).onInput,
          onBeforeInput: handlersOf(scope).onBeforeInput,
          onKeydown: handlersOf(scope).onInputKeydown,
          onWheel: handlersOf(scope).onInputWheel,
        };
      },
    },
    decrementTrigger: {
      id: "decrement",
      attrs: (scope: ScopeLike) => {
        const off = disabledOf(scope.context) || !canDecrement(scope.context) || scope.context.readOnly;
        return {
          dir: scope.context.dir,
          type: "button",
          disabled: off,
          tabIndex: -1,
          "aria-label": scope.context.decrementLabel,
          "aria-controls": scope.id("input"),
          onPointerDown: handlersOf(scope).onDecrementDown,
          onPointerUp: handlersOf(scope).onTriggerUp,
          onPointerLeave: handlersOf(scope).onTriggerUp,
        };
      },
    },
    incrementTrigger: {
      id: "increment",
      attrs: (scope: ScopeLike) => {
        const off = disabledOf(scope.context) || !canIncrement(scope.context) || scope.context.readOnly;
        return {
          dir: scope.context.dir,
          type: "button",
          disabled: off,
          tabIndex: -1,
          "aria-label": scope.context.incrementLabel,
          "aria-controls": scope.id("input"),
          onPointerDown: handlersOf(scope).onIncrementDown,
          onPointerUp: handlersOf(scope).onTriggerUp,
          onPointerLeave: handlersOf(scope).onTriggerUp,
        };
      },
    },
    scrubber: {
      attrs: (scope: ScopeLike) => ({
        dir: scope.context.dir,
        role: "presentation",
        onPointerDown: handlersOf(scope).onScrubberDown,
        onPointerMove: handlersOf(scope).onScrubberMove,
        onPointerUp: handlersOf(scope).onScrubberUp,
      }),
    },
    cursor: {
      attrs: (scope: ScopeLike) => {
        const point = scope.context.cursorPoint;
        const scrubbing = scope.state === "scrubbing";
        return {
          "aria-hidden": true,
          hidden: !scrubbing,
          style: {
            left: `${point === null ? 0 : point.x}px`,
            top: `${point === null ? 0 : point.y}px`,
          },
        };
      },
    },
  },
  readers: {
    value: { read: (ctx: NumberInputContext) => ctx.value },
    valueAsNumber: { read: (ctx: NumberInputContext) => parseValue(ctx.value) },
    focused: { read: (_ctx: NumberInputContext, state: NumberInputState) => state === "focused" },
    scrubbing: { read: (_ctx: NumberInputContext, state: NumberInputState) => state === "scrubbing" },
    invalid: { read: (ctx: NumberInputContext) => {
      if (ctx.invalid !== undefined) return ctx.invalid;
      const at = Number.isNaN(Number.parseFloat(ctx.value)) ? 0 : Number.parseFloat(ctx.value);
      return at < ctx.min || at > ctx.max;
    } },
    disabled: { read: (ctx: NumberInputContext) => ctx.disabled || ctx.fieldsetDisabled },
    empty: { read: (ctx: NumberInputContext) => ctx.value === "" },
    canIncrement: { read: (ctx: NumberInputContext) => {
      if (ctx.allowOverflow) return true;
      const at = Number.isNaN(Number.parseFloat(ctx.value)) ? 0 : Number.parseFloat(ctx.value);
      return at < ctx.max;
    } },
    canDecrement: { read: (ctx: NumberInputContext) => {
      if (ctx.allowOverflow) return true;
      const at = parseValue(ctx.value);
      return (Number.isNaN(at) ? 0 : at) > ctx.min;
    } },
    required: { read: (ctx: NumberInputContext) => ctx.required },
  },
  commands: {
    setValue: { event: ([value]: [value: number | string]) => ({ type: "VALUE.SET", value }) },
    clearValue: { event: () => ({ type: "VALUE.CLEAR" }) },
    increment: { event: () => ({ type: "VALUE.INCREMENT" }) },
    decrement: { event: () => ({ type: "VALUE.DECREMENT" }) },
    setToMax: { event: (_args: readonly unknown[], ctx) => ({ type: "VALUE.SET", value: ctx.max }) },
    setToMin: { event: (_args: readonly unknown[], ctx) => ({ type: "VALUE.SET", value: ctx.min }) },
    focus: {
      view: ({ focus }: {
        readonly args: readonly unknown[];
        readonly id: (part: string, slot?: unknown) => string;
        readonly focus: (part: string, slot?: unknown) => void;
        readonly measure: (part: string, slot?: unknown) => DOMRect | null;
        readonly root: () => Element;
      }) => focus("input"),
    },
  },
  events: {
    "value-change": {
      prop: "onValueChange",
      watch: (ctx: NumberInputContext) => [ctx.value],
      detail: (watched: readonly unknown[]) => ({
        value: watched[0],
        valueAsNumber: parseValue(String(watched[0] ?? "")),
      }),
      // A move that leaves the value alone reports nothing.
      select: (_event, before: NumberInputContext, after: NumberInputContext) =>
        after.value === before.value ? null : {
          value: after.value,
          valueAsNumber: parseValue(after.value),
        },
    },
    "value-commit": {
      prop: "onValueCommit",
      watch: (ctx: NumberInputContext) => [ctx.value],
      detail: (watched: readonly unknown[]) => ({
        value: watched[0],
        valueAsNumber: parseValue(String(watched[0] ?? "")),
      }),
      select: (event, _before: NumberInputContext, after: NumberInputContext) =>
        event.type === "INPUT.BLUR" || event.type === "INPUT.ENTER" ? {
          value: after.value,
          valueAsNumber: parseValue(after.value),
        } : null,
    },
    "value-invalid": {
      prop: "onValueInvalid",
      watch: (ctx: NumberInputContext) => [ctx.value],
      detail: (watched: readonly unknown[], _event, _props, ctx: NumberInputContext) => {
        const v = parseValue(String(watched[0] ?? ""));
        const reason = v > ctx.max ? "rangeOverflow" : "rangeUnderflow";
        return { reason, value: watched[0], valueAsNumber: v };
      },
      select: (event, _before: NumberInputContext, after: NumberInputContext) => {
        const out = !isValueWithinRange(parseValue(after.value), after.min, after.max);
        if (!out) return null;
        // Only the blur branch that leaves an out-of-range value standing
        // reports: a range flip caused by typing waits for the commit.
        if (event.type === "INPUT.BLUR") {
          return {
            reason: (parseValue(after.value) > after.max ? "rangeOverflow" : "rangeUnderflow") as NumberInputInvalidReason,
            value: after.value,
            valueAsNumber: parseValue(after.value),
          };
        }
        if (event.type === "INPUT.CHANGE") return null;
        const wasOut = !isValueWithinRange(parseValue(_before.value), _before.min, _before.max);
        if (out === wasOut) return null;
        return {
          reason: (parseValue(after.value) > after.max ? "rangeOverflow" : "rangeUnderflow") as NumberInputInvalidReason,
          value: after.value,
          valueAsNumber: parseValue(after.value),
        };
      },
    },
    "focus-change": {
      prop: "onFocusChange",
      watch: (ctx: NumberInputContext, state: NumberInputState) => [state === "focused", ctx.value],
      detail: (watched: readonly unknown[]) => ({
        focused: watched[0],
        value: watched[1],
        valueAsNumber: parseValue(String(watched[1] ?? "")),
      }),
      select: (
        event,
        _before: NumberInputContext,
        after: NumberInputContext,
        states?: { readonly was: string; readonly is: string },
      ) => {
        const was = states?.was ?? "idle";
        const is = states?.is ?? "idle";
        if (was === "idle" && is !== "idle") {
          return { focused: true, value: after.value, valueAsNumber: parseValue(after.value) };
        }
        if (was !== "idle" && (is === "idle" || event.type === "INPUT.BLUR" || event.type === "INPUT.ENTER")) {
          return { focused: false, value: after.value, valueAsNumber: parseValue(after.value) };
        }
        return null;
      },
    },
  },
} satisfies ComponentDef<NumberInputContext, NumberInputEvents, Record<string, unknown>, NumberInputArgs, NumberInputState>;

export type NumberInputApi = ApiOf<typeof def>;
export const numberInput = defineComponent<NumberInputContext, NumberInputEvents, NumberInputApi, NumberInputArgs, NumberInputState>(def);
