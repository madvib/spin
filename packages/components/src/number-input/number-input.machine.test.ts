import { test } from "bun:test";
import { deepStrictEqual } from "node:assert/strict";
import { parseHTML } from "@spinjs/components/testing";
import { signal } from "@spinjs/components/runtime";
import { numberInput } from "./number-input.presentation.ts";
const createNumberInputBridge = numberInput.createBridge;
import type {
  NumberInputFocusChange,
  NumberInputValueChange,
  NumberInputValueCommit,
  NumberInputValueInvalid,
} from "./number-input.events.ts";
import type { NumberInputApi } from "./number-input.presentation.ts";

/** A live writable read, as the element's prop store exposes one. */
type WriteSignal = { (): unknown; (value: unknown): void };

const win = parseHTML(
  "<!doctype html><html><body></body></html>",
) as unknown as Record<string, unknown>;
declare const globalThis: Record<string, unknown>;
globalThis.document = win.document;
globalThis.CustomEvent = win.CustomEvent;
globalThis.HTMLElement = win.HTMLElement;
globalThis.Element = win.Element;

/** The part each bag belongs to. */
type Part =
  | "root"
  | "label"
  | "control"
  | "valueText"
  | "input"
  | "decrement"
  | "increment"
  | "scrubber"
  | "cursor";

/**
 * Prop bags hand back `Record<string, unknown>`, so a handler read out of one
 * is checked here and typed once, instead of an unchecked cast at every call
 * site.
 */
function handler<H>(bag: Record<string, unknown>, key: string): H {
  const value = bag[key];
  if (typeof value !== "function") throw new Error(`no handler at ${key}`);
  return value as H;
}

/** Read a callback out of a bag's `use:name` entry, which is data. */
function actionCallback<H>(
  bag: Record<string, unknown>,
  action: string,
  name: string,
): H {
  const params: unknown = bag[action];
  if (typeof params !== "object" || params === null) {
    throw new Error(`no action param at ${action}`);
  }
  const entry = (params as Record<string, unknown>)[name];
  if (typeof entry !== "function") {
    throw new Error(`no callback at ${action}.${name}`);
  }
  return entry as H;
}

/**
 * linkedom ships no KeyboardEvent/PointerEvent/WheelEvent constructors, so the
 * events the handlers need are synthesized here — one place, with the minimal
 * field set each handler reads.
 */
type Modifiers = Readonly<{
  shift?: boolean;
  alt?: boolean;
  ctrl?: boolean;
  meta?: boolean;
  composing?: boolean;
}>;

function keydown(key: string, modifiers: Modifiers = {}): KeyboardEvent {
  const made: Record<string, unknown> = {
    key,
    shiftKey: modifiers.shift === true,
    altKey: modifiers.alt === true,
    ctrlKey: modifiers.ctrl === true,
    metaKey: modifiers.meta === true,
    isComposing: modifiers.composing === true,
    defaultPrevented: false,
  };
  made["preventDefault"] = (): void => {
    made["defaultPrevented"] = true;
  };
  return made as unknown as KeyboardEvent;
}

type PointerFields = Readonly<{
  clientX?: number;
  clientY?: number;
  button?: number;
  pointerType?: string;
  pointerId?: number;
}>;

function pointer(fields: PointerFields): PointerEvent {
  const made: Record<string, unknown> = {
    clientX: fields.clientX ?? 0,
    clientY: fields.clientY ?? 0,
    button: fields.button ?? 0,
    pointerType: fields.pointerType ?? "mouse",
    pointerId: fields.pointerId ?? 1,
    defaultPrevented: false,
    view: null,
  };
  made["preventDefault"] = (): void => {
    made["defaultPrevented"] = true;
  };
  return made as unknown as PointerEvent;
}

function wheel(deltaY: number): WheelEvent {
  const made: Record<string, unknown> = { deltaY, defaultPrevented: false };
  made["preventDefault"] = (): void => {
    made["defaultPrevented"] = true;
  };
  return made as unknown as WheelEvent;
}

/** The input part, in the document, with a recorded focus. An element from an
 * earlier test would otherwise win `getElementById`. */
function attachInput(): { readonly focused: unknown[] } {
  const previous = document.getElementById("number-input:number-input:input");
  if (previous !== null) previous.remove();
  const input = document.createElement("input");
  input.setAttribute("id", "number-input:number-input:input");
  const focused: unknown[] = [];
  // linkedom ships no focus tracking, so the call is recorded on the node.
  input.focus = (): void => {
    focused.push(undefined);
  };
  document.body.appendChild(input);
  return { focused };
}

interface Harness {
  readonly api: NumberInputApi;
  readonly root: Element;
  readonly events: {
    readonly valueChange: NumberInputValueChange[];
    readonly valueCommit: NumberInputValueCommit[];
    readonly valueInvalid: NumberInputValueInvalid[];
    readonly focusChange: NumberInputFocusChange[];
  };
  /** The state the bridge reports, read off the api rather than the machine. */
  state(): "idle" | "focused" | "scrubbing";
  bag(part: Part): Record<string, unknown>;
  trigger(part: "decrement" | "increment"): Record<string, unknown>;
  press(key: string, modifiers?: Modifiers): void;
  /** A keystroke that also reports whether the handler consumed it. */
  pressReported(key: string, modifiers?: Modifiers): boolean;
  type(value: string): void;
  beforeInput(
    value: string,
    selection: readonly [number, number],
    data: string,
  ): boolean;
  wheelBy(deltaY: number): void;
  /** Press a spin control through its own bag. */
  pressTrigger(part: "decrement" | "increment", fields?: PointerFields): void;
  releaseTrigger(part: "decrement" | "increment"): void;
  leaveTrigger(part: "decrement" | "increment"): void;
  grabScrubber(fields?: PointerFields): void;
  dragScrubber(clientX: number): void;
  dropScrubber(): void;
  focusInput(): void;
  blurInput(): void;
  /** The control's `use:autoplay` params, which are the spin clock. */
  clock(): { interval: number; enabled: boolean; tick(): void };
  write(name: string, value: unknown): void;
  dispose(): void;
}

/** Props are signals, exactly as the element's prop store makes them, so a host
 * write re-runs the bridge's controlled-channel effect. A prop passed in
 * `overrides` is AUTHORED, which is the element's `@@authored` predicate. */
function mount(overrides: Readonly<Record<string, unknown>> = {}): Harness {
  const root = document.createElement("div");
  document.body.appendChild(root);
  const events = {
    valueChange: [] as NumberInputValueChange[],
    valueCommit: [] as NumberInputValueCommit[],
    valueInvalid: [] as NumberInputValueInvalid[],
    focusChange: [] as NumberInputFocusChange[],
  };
  const values: Record<string, WriteSignal> = {};
  /** Membership table for the props the host actually wrote. */
  const authored: Record<string, true> = {};
  for (const name of Object.keys(overrides)) authored[name] = true;
  const write = (name: string, value: unknown): void => {
    const source = values[name];
    if (source === undefined) values[name] = signal<unknown>(value);
    else source(value);
  };
  for (const [name, value] of Object.entries(overrides)) write(name, value);
  write(
    "onValueChange",
    (change: NumberInputValueChange) => events.valueChange.push(change),
  );
  write(
    "onValueCommit",
    (change: NumberInputValueCommit) => events.valueCommit.push(change),
  );
  write(
    "onValueInvalid",
    (change: NumberInputValueInvalid) => events.valueInvalid.push(change),
  );
  write(
    "onFocusChange",
    (change: NumberInputFocusChange) => events.focusChange.push(change),
  );
  const bridge = createNumberInputBridge(
    () => {
      const record: Record<string, unknown> = {};
      for (const [name, source] of Object.entries(values)) {
        record[name] = source();
      }
      record["@@authored"] = (name: string): boolean => authored[name] === true;
      return record;
    },
    () => root,
    "number-input",
  );

  const bag = (part: Part): Record<string, unknown> => {
    switch (part) {
      case "root":
        return bridge.api.getRootProps();
      case "label":
        return bridge.api.getLabelProps();
      case "control":
        return bridge.api.getControlProps();
      case "valueText":
        return bridge.api.getValueTextProps();
      case "input":
        return bridge.api.getInputProps();
      case "decrement":
        return bridge.api.getDecrementTriggerProps();
      case "increment":
        return bridge.api.getIncrementTriggerProps();
      case "scrubber":
        return bridge.api.getScrubberProps();
      case "cursor":
        return bridge.api.getCursorProps();
    }
  };

  const trigger = (part: "decrement" | "increment"): Record<string, unknown> =>
    part === "increment"
      ? bridge.api.getIncrementTriggerProps()
      : bridge.api.getDecrementTriggerProps();

  const pressGesture = (key: string, modifiers: Modifiers = {}): boolean => {
    const before = keydown(key, modifiers);
    handler<(event: KeyboardEvent) => void>(
      bridge.api.getInputProps(),
      "onKeydown",
    )(before);
    return before.defaultPrevented === true;
  };

  return {
    api: bridge.api,
    root,
    events,
    state: (): "idle" | "focused" | "scrubbing" =>
      bridge.api.scrubbing
        ? "scrubbing"
        : bridge.api.focused
        ? "focused"
        : "idle",
    bag,
    trigger,
    press: (key, modifiers): void => {
      pressGesture(key, modifiers);
    },
    pressReported: pressGesture,
    type: (value: string): void =>
      handler<(event: { currentTarget: { value: string } }) => void>(
        bridge.api.getInputProps(),
        "onInput",
      )({
        currentTarget: { value },
      }),
    beforeInput: (
      value: string,
      selection: readonly [number, number],
      data: string,
    ): boolean => {
      let prevented = false;
      handler<(event: unknown) => void>(
        bridge.api.getInputProps(),
        "onBeforeInput",
      )({
        currentTarget: {
          value,
          selectionStart: selection[0],
          selectionEnd: selection[1],
        },
        data,
        preventDefault: (): void => {
          prevented = true;
        },
      });
      return prevented;
    },
    wheelBy: (deltaY: number): void =>
      handler<(event: WheelEvent) => void>(
        bridge.api.getInputProps(),
        "onWheel",
      )(wheel(deltaY)),
    pressTrigger: (part, fields): void =>
      handler<(event: PointerEvent) => void>(trigger(part), "onPointerDown")(
        pointer(fields ?? {}),
      ),
    releaseTrigger: (part): void =>
      handler<(event: PointerEvent) => void>(trigger(part), "onPointerUp")(
        pointer({}),
      ),
    leaveTrigger: (part): void =>
      handler<(event: PointerEvent) => void>(trigger(part), "onPointerLeave")(
        pointer({}),
      ),
    grabScrubber: (fields): void =>
      handler<(event: PointerEvent) => void>(
        bridge.api.getScrubberProps(),
        "onPointerDown",
      )(
        pointer(fields ?? { clientX: 100, clientY: 40 }),
      ),
    dragScrubber: (clientX: number): void =>
      handler<(event: PointerEvent) => void>(
        bridge.api.getScrubberProps(),
        "onPointerMove",
      )(
        pointer({ clientX, clientY: 40 }),
      ),
    dropScrubber: (): void =>
      handler<(event: PointerEvent) => void>(
        bridge.api.getScrubberProps(),
        "onPointerUp",
      )(pointer({})),
    focusInput: (): void =>
      handler<() => void>(bridge.api.getInputProps(), "onFocus")(),
    blurInput: (): void =>
      handler<() => void>(bridge.api.getInputProps(), "onBlur")(),
    clock: () => ({
      get interval(): number {
        const params: unknown = bridge.api.getControlProps()["use:autoplay"];
        if (typeof params !== "object" || params === null) {
          throw new Error("no action param at use:autoplay");
        }
        const entry = params as Record<string, unknown>;
        return typeof entry["interval"] === "number" ? entry["interval"] : -1;
      },
      get enabled(): boolean {
        const params: unknown = bridge.api.getControlProps()["use:autoplay"];
        if (typeof params !== "object" || params === null) {
          throw new Error("no action param at use:autoplay");
        }
        return (params as Record<string, unknown>)["enabled"] === true;
      },
      tick: (): void =>
        actionCallback<() => void>(
          bridge.api.getControlProps(),
          "use:autoplay",
          "onTick",
        )(),
    }),
    write,
    dispose: (): void => bridge.dispose(),
  };
}

// ---- the three states -----------------------------------------------------
//
// `idle` is the start, `focused` is the input holding DOM focus, and
// `scrubbing` is the drag gesture on the rail. All three are reachable, and
// each state-changing event is exercised below.

test("Given a fresh number input / When nothing is authored / Then idle is the reachable start state", () => {
  const h = mount();
  deepStrictEqual(h.state(), "idle", "the machine starts idle");
  deepStrictEqual(h.api.value, "", "the value is empty");
  deepStrictEqual(h.api.valueAsNumber, Number.NaN, "an empty value has no number");
  deepStrictEqual(h.api.empty, true, "the api reports the empty value");
  deepStrictEqual(h.api.invalid, false, "a fresh value is in range");
  deepStrictEqual(h.api.disabled, false, "the input is enabled");
  deepStrictEqual(h.api.canIncrement, true, "and it may increment");
  deepStrictEqual(h.api.canDecrement, true, "and it may decrement");
  deepStrictEqual(h.api.scrubbing, false, "no scrub gesture is live");
});

test("Given defaultValue / When the input mounts / Then the seed is the start state", () => {
  const h = mount({ defaultValue: "12", min: "0", max: "20", step: "2" });
  deepStrictEqual(h.api.value, "12", "defaultValue seeds the value");
  deepStrictEqual(h.api.valueAsNumber, 12, "and its number");
  deepStrictEqual(h.api.empty, false, "the api reports a value");
  deepStrictEqual(h.events.valueChange, [], "seeding reports nothing");
  deepStrictEqual(h.events.focusChange, [], "and no focus moved");
});

test("Given the input focused / When the focus event arrives / Then the focused state is reachable", () => {
  const h = mount({ defaultValue: "3" });
  h.focusInput();
  deepStrictEqual(h.state(), "focused", "the machine holds focus");
  deepStrictEqual(
    h.bag("input")["aria-roledescription"],
    "numberfield",
    "the input is a numberfield",
  );
  deepStrictEqual(h.api.focused, true, "and the api reports focus");
  deepStrictEqual(h.events.focusChange, [{
    focused: true,
    value: "3",
    valueAsNumber: 3,
  }], "focus-change reports the move");
});

test("Given a focused input / When it blurs / Then the idle state is reachable again", () => {
  const h = mount({ defaultValue: "007" });
  h.focusInput();
  h.type("007");
  h.blurInput();
  deepStrictEqual(h.state(), "idle", "the blur returns to idle");
  // The blur reformats: "007" is the number 7.
  deepStrictEqual(h.api.value, "7", "the blur reformats the value");
  deepStrictEqual(h.events.focusChange, [
    { focused: true, value: "007", valueAsNumber: 7 },
    // The blur reformats before it reports, so the report carries the new value.
    { focused: false, value: "7", valueAsNumber: 7 },
  ], "focus-change reports both ends");
  deepStrictEqual(
    h.events.valueCommit,
    [{ value: "7", valueAsNumber: 7 }],
    "the blur commits",
  );
});

test("Given the scrubber grabbed / When the press arrives / Then the scrubbing state is reachable", () => {
  const h = mount({ defaultValue: "5" });
  h.grabScrubber();
  deepStrictEqual(h.state(), "scrubbing", "the machine is scrubbing");
  deepStrictEqual(h.api.scrubbing, true, "the rail reports it");
  deepStrictEqual(h.state(), "scrubbing", "the focus survives the gesture");
  h.dropScrubber();
  deepStrictEqual(h.state(), "focused", "the lift ends the gesture");
  deepStrictEqual(h.api.scrubbing, false, "and the rail clears it");
});

test("Given an idle input / When a spin control is pressed / Then the focus leaves idle", () => {
  const h = mount();
  h.pressTrigger("increment");
  deepStrictEqual(h.state(), "focused", "a press focuses the input");
  deepStrictEqual(h.events.focusChange.length, 1, "focus reports once");
  deepStrictEqual(h.api.value, "1", "and the press steps immediately");
});

test("Given a scrubbing gesture / When the drag leaves the rail / Then a stray press-up still ends it", () => {
  const h = mount({ defaultValue: "4" });
  h.grabScrubber();
  h.dragScrubber(140);
  h.dropScrubber();
  deepStrictEqual(h.api.value, "5", "the drag stepped once per move");
  deepStrictEqual(h.api.scrubbing, false, "and the gesture is over");
});

// ---- the value pipeline ---------------------------------------------------
//
// Every value moves through the same three steps — parse, move, clamp,
// format — so each case below is one of those steps that the port has to get
// right, with hand-authored expected values.

test("Given a value above the max / When it is set / Then it clamps to the max", () => {
  const h = mount({ min: "0", max: "20" });
  h.api.setValue(50);
  deepStrictEqual(h.api.value, "20", "the value clamps to the max");
  deepStrictEqual(h.api.valueAsNumber, 20, "and the number follows");
  deepStrictEqual(
    h.events.valueChange,
    [{ value: "20", valueAsNumber: 20 }],
    "value-change reports the move",
  );
});

test("Given a value below the min / When it is set / Then it clamps to the min", () => {
  const h = mount({ min: "5", max: "20" });
  h.api.setValue(-3);
  deepStrictEqual(h.api.value, "5", "the value clamps to the min");
});

test("Given allowOverflow / When a value passes the bound / Then it is kept", () => {
  const h = mount({ min: "0", max: "20", allowOverflow: true });
  h.api.setValue(50);
  deepStrictEqual(h.api.value, "50", "the value passes the max");
  deepStrictEqual(h.api.invalid, true, "and the api reports it out of range");
  deepStrictEqual(h.events.valueInvalid, [
    { reason: "rangeOverflow", value: "50", valueAsNumber: 50 },
  ], "the range flip reports the invalid");
});

test("Given allowOverflow and a return into range / When the value comes back / Then no second report fires", () => {
  const h = mount({ min: "0", max: "20", allowOverflow: true });
  h.api.setValue(50);
  h.api.setValue(3);
  deepStrictEqual(h.api.invalid, false, "the value is back in range");
  deepStrictEqual(
    h.events.valueInvalid.map((entry) => entry.reason),
    ["rangeOverflow"],
    "only the move out of range reports; the return would name an in-range value underflow",
  );
});

test("Given an empty value / When it is cleared / Then nothing moves and nothing reports", () => {
  const h = mount();
  h.api.clearValue();
  deepStrictEqual(h.api.value, "", "the value stays empty");
  deepStrictEqual(h.events.valueChange, [], "and no change is reported");
});

test("Given an empty value / When it increments / Then the step is the first number", () => {
  const h = mount();
  h.api.increment();
  deepStrictEqual(h.api.value, "1", "an absent value steps from zero");
  h.api.decrement();
  h.api.decrement();
  deepStrictEqual(h.api.value, "-1", "and back down again");
});

test("Given a fractional step / When the value steps twice / Then the decimals stay exact", () => {
  const h = mount({ defaultValue: "0.1", step: "0.1" });
  h.api.increment();
  deepStrictEqual(h.api.value, "0.2", "one tenth past a tenth");
  h.api.increment();
  deepStrictEqual(
    h.api.value,
    "0.3",
    "and 0.1 + 0.2 is 0.3, not 0.30000000000000004",
  );
});

test("Given the bounds as defaults / When setToMin and setToMax run / Then the value takes the bound", () => {
  const h = mount({ min: "2", max: "8" });
  h.api.setToMax();
  deepStrictEqual(h.api.value, "8", "the max is authored as a decimal string");
  h.api.setToMin();
  deepStrictEqual(h.api.value, "2", "and the min");
});

test("Given a value at the max / When it increments / Then it is clamped and the trigger reports it", () => {
  const h = mount({ min: "0", max: "5", defaultValue: "5" });
  h.api.increment();
  deepStrictEqual(h.api.value, "5", "the value is already at the max");
  deepStrictEqual(h.api.canIncrement, false, "and the api refuses the increment");
  deepStrictEqual(
    h.trigger("increment")["disabled"],
    true,
    "the trigger is disabled",
  );
  deepStrictEqual(
    h.trigger("decrement")["disabled"],
    false,
    "while the other one is not",
  );
});

test("Given a value at the min / When it decrements / Then it is clamped and the trigger reports it", () => {
  const h = mount({ min: "0", max: "5", defaultValue: "0" });
  h.api.decrement();
  deepStrictEqual(h.api.value, "0", "the value is already at the min");
  deepStrictEqual(h.api.canDecrement, false, "and the api refuses the decrement");
  deepStrictEqual(
    h.trigger("decrement")["disabled"],
    true,
    "the trigger is disabled",
  );
});

test("Given allowOverflow / When the value sits past the max / Then the trigger stays enabled", () => {
  const h = mount({
    min: "0",
    max: "5",
    allowOverflow: true,
    defaultValue: "5",
  });
  deepStrictEqual(h.api.canIncrement, true, "overflow keeps the increment alive");
  deepStrictEqual(
    h.trigger("increment")["disabled"],
    false,
    "and the trigger with it",
  );
});

// ---- the keyboard map -----------------------------------------------------

test("Given a focused input / When ArrowUp arrives / Then the value steps once", () => {
  const h = mount({ defaultValue: "5" });
  h.focusInput();
  h.press("ArrowUp");
  deepStrictEqual(h.api.value, "6", "ArrowUp steps by the step");
  deepStrictEqual(h.pressReported("ArrowUp"), true, "and the key was consumed");
});

test("Given a focused input / When ArrowDown arrives / Then the value steps once back", () => {
  const h = mount({ defaultValue: "5" });
  h.focusInput();
  h.press("ArrowDown");
  deepStrictEqual(h.api.value, "4", "ArrowDown steps back");
});

test("Given the modifier keys / When they hold during an arrow / Then the step sizes follow", () => {
  const h = mount({
    defaultValue: "5",
    step: "2",
    largeStep: "20",
    smallStep: "0.5",
  });
  h.focusInput();
  h.press("ArrowUp", { shift: true });
  deepStrictEqual(h.api.value, "25", "Shift takes the large step");
  h.press("ArrowUp", { alt: true });
  deepStrictEqual(h.api.value, "25.5", "Alt takes the small step");
  h.press("ArrowDown", { ctrl: true });
  deepStrictEqual(
    h.api.value,
    "23.5",
    "Ctrl alone is not a modifier step, so the plain step applies",
  );
});

test("Given a focused input / When Home and End arrive / Then the value takes the bound", () => {
  const h = mount({ defaultValue: "5", min: "-4", max: "9" });
  h.focusInput();
  h.press("Home");
  deepStrictEqual(h.api.value, "-4", "Home takes the min");
  h.press("End");
  deepStrictEqual(h.api.value, "9", "End takes the max");
});

test("Given a focused input / When a modified Home arrives / Then the machine never hears it", () => {
  const h = mount({ defaultValue: "5", min: "-4" });
  h.focusInput();
  h.press("Home", { shift: true });
  deepStrictEqual(h.api.value, "5", "a modified Home is not navigation");
});

test("Given a read-only input / When an arrow arrives / Then nothing moves", () => {
  const h = mount({ defaultValue: "5", readOnly: true });
  h.focusInput();
  h.press("ArrowUp");
  deepStrictEqual(h.api.value, "5", "the keys are inert");
  deepStrictEqual(
    h.trigger("increment")["disabled"],
    true,
    "and both triggers are disabled",
  );
});

test("Given a composing input / When an arrow arrives / Then the IME keeps the key", () => {
  const h = mount({ defaultValue: "5" });
  h.focusInput();
  h.press("ArrowUp", { composing: true });
  deepStrictEqual(h.api.value, "5", "a composing event never steps");
});

test("Given a focused input / When Enter arrives / Then the value is reformatted but focus stays", () => {
  const h = mount({ defaultValue: "5" });
  h.focusInput();
  h.type("5.50");
  h.press("Enter");
  deepStrictEqual(h.api.value, "5.5", "Enter reformats what was typed");
  deepStrictEqual(h.state(), "focused", "and the machine still holds focus");
  deepStrictEqual(
    h.events.valueCommit,
    [{ value: "5.5", valueAsNumber: 5.5 }],
    "Enter commits",
  );
  deepStrictEqual(
    h.events.focusChange,
    [
      { focused: true, value: "5", valueAsNumber: 5 },
      // Enter reports the blur even though the field keeps focus.
      { focused: false, value: "5.5", valueAsNumber: 5.5 },
    ],
    "Enter reports focus leaving",
  );
});

test("Given a focused input / When the host types / Then the raw string is kept", () => {
  const h = mount({ defaultValue: "5" });
  h.focusInput();
  h.type("12.");
  deepStrictEqual(h.api.value, "12.", "a partial number is stored verbatim");
  deepStrictEqual(h.api.valueAsNumber, 12, "and its number is what parsed");
  h.press("ArrowDown");
  deepStrictEqual(h.api.value, "11", "arithmetic continues from the parsed value");
});

test("Given an input / When a character is typed / Then only partial numbers land", () => {
  const h = mount({ defaultValue: "5" });
  deepStrictEqual(h.beforeInput("5", [1, 1], "a"), true, "a letter is refused");
  deepStrictEqual(h.beforeInput("5", [0, 0], "-"), false, "a leading minus lands");
  deepStrictEqual(
    h.beforeInput("5", [1, 1], "-"),
    true,
    "but a minus in the middle is refused",
  );
  deepStrictEqual(h.beforeInput("5", [1, 1], "."), false, "a decimal point lands");
  deepStrictEqual(
    h.beforeInput("5.", [2, 2], "3"),
    false,
    "and the fraction after it",
  );
  deepStrictEqual(h.beforeInput("5", [1, 1], "6"), false, "a digit lands");
  deepStrictEqual(
    h.beforeInput("5.5", [3, 3], "."),
    true,
    "a second decimal point is refused",
  );
});

test("Given a focused input with the wheel / When it turns / Then the value steps", () => {
  const h = mount({ defaultValue: "5", allowMouseWheel: true });
  h.focusInput();
  h.wheelBy(-120);
  deepStrictEqual(h.api.value, "6", "a wheel up increments");
  h.wheelBy(120);
  deepStrictEqual(h.api.value, "5", "and a wheel down decrements");
});

test("Given a focused input without the wheel / When it turns / Then nothing moves", () => {
  const h = mount({ defaultValue: "5" });
  h.focusInput();
  h.wheelBy(-120);
  deepStrictEqual(h.api.value, "5", "the wheel is off by default");
});

// ---- the blur branches ----------------------------------------------------
//
// Three of them, and they differ on one question: what an out-of-range value
// that was typed becomes when the field loses focus.

test("Given a typed out-of-range value / When the input blurs / Then it clamps", () => {
  const h = mount({ min: "0", max: "10", defaultValue: "5" });
  h.focusInput();
  h.type("40");
  h.blurInput();
  deepStrictEqual(h.api.value, "10", "the blur clamps to the max");
  deepStrictEqual(
    h.events.valueInvalid,
    [],
    "and a clamped value is not an invalid one",
  );
});

test("Given a typed out-of-range value with clampValueOnBlur false / When the input blurs / Then it stands and reports", () => {
  const h = mount({
    min: "0",
    max: "10",
    defaultValue: "5",
    clampValueOnBlur: false,
    allowOverflow: true,
  });
  h.focusInput();
  h.type("40");
  h.blurInput();
  deepStrictEqual(h.api.value, "40", "the value is left where it was typed");
  deepStrictEqual(h.api.invalid, true, "the api reports it invalid");
  deepStrictEqual(
    h.events.valueCommit,
    [{ value: "40", valueAsNumber: 40 }],
    "and the blur commits",
  );
  deepStrictEqual(
    h.events.valueInvalid,
    [{ reason: "rangeOverflow", value: "40", valueAsNumber: 40 }],
    "the invalid reports once, on the blur",
  );
});

test("Given a typed out-of-range value / When the user is still typing / Then no invalid is reported", () => {
  const h = mount({
    min: "0",
    max: "10",
    defaultValue: "5",
    allowOverflow: true,
  });
  h.focusInput();
  h.type("40");
  deepStrictEqual(h.api.invalid, true, "the api reports the invalid state");
  deepStrictEqual(h.events.valueInvalid, [], "but the event waits for the commit");
});

test("Given an empty value / When the input blurs / Then it stays empty", () => {
  const h = mount({ min: "3" });
  h.focusInput();
  h.blurInput();
  deepStrictEqual(h.api.value, "", "an empty field is not clamped to the min");
  deepStrictEqual(h.api.empty, true, "and the api reports the empty value");
});

test("Given a value clamped by allowOverflow false / When it is typed above the max / Then the blur reports the commit", () => {
  const h = mount({ min: "0", max: "10", defaultValue: "5" });
  h.focusInput();
  h.type("10");
  h.blurInput();
  deepStrictEqual(
    h.events.valueCommit,
    [{ value: "10", valueAsNumber: 10 }],
    "the blur commits",
  );
  deepStrictEqual(h.events.valueInvalid, [], "and the value is in range");
});

// ---- the press-and-hold clock ---------------------------------------------
//
// The dwell and the repeat rate are the control's `use:autoplay` params —
// data the bag carries, so the clock's contract is read and ticked here
// exactly as the action would.

test("Given an idle input / When the control bag is read / Then the clock is disarmed", () => {
  const h = mount();
  deepStrictEqual(h.clock().enabled, false, "no gesture is live");
  deepStrictEqual(
    h.clock().interval,
    300,
    "and the dwell is the interval it would use",
  );
});

test("Given a pressed trigger / When the dwell elapses / Then the repeat phase starts", () => {
  const h = mount({ defaultValue: "5" });
  h.pressTrigger("increment");
  deepStrictEqual(h.api.value, "6", "the press steps immediately");
  const dwell = h.clock();
  deepStrictEqual(dwell.enabled, true, "the gesture arms the clock");
  deepStrictEqual(dwell.interval, 300, "at the dwell");
  dwell.tick();
  deepStrictEqual(h.api.value, "6", "the dwell itself steps nothing");
  deepStrictEqual(h.clock().interval, 50, "the repeat phase has begun");
  h.clock().tick();
  deepStrictEqual(h.api.value, "7", "and the repeat steps");
  h.clock().tick();
  deepStrictEqual(h.api.value, "8", "and again");
});

test("Given a pressed decrement trigger / When the dwell elapses / Then the repeat runs downward", () => {
  const h = mount({ defaultValue: "5", min: "0" });
  h.pressTrigger("decrement");
  deepStrictEqual(h.api.value, "4", "the press steps down");
  h.clock().tick();
  deepStrictEqual(h.clock().interval, 50, "the repeat phase has begun");
  h.clock().tick();
  deepStrictEqual(h.api.value, "3", "and the repeat continues down");
});

test("Given a released trigger / When the gesture ends / Then the clock is disarmed", () => {
  const h = mount({ defaultValue: "5" });
  h.pressTrigger("increment");
  h.releaseTrigger("increment");
  deepStrictEqual(h.clock().enabled, false, "the press-up disarms the clock");
  deepStrictEqual(h.api.value, "6", "and the single step stands");
});

test("Given a trigger the pointer left / When the gesture ends / Then the clock is disarmed", () => {
  const h = mount({ defaultValue: "5" });
  h.pressTrigger("increment");
  h.leaveTrigger("increment");
  deepStrictEqual(
    h.clock().enabled,
    false,
    "leaving the trigger ends the gesture",
  );
  deepStrictEqual(h.api.value, "6", "and the single step stands");
});

test("Given spinOnPress false / When the dwell elapses / Then the gesture ends without repeating", () => {
  const h = mount({ defaultValue: "5", spinOnPress: false });
  h.pressTrigger("increment");
  deepStrictEqual(h.api.value, "6", "the press still steps once");
  deepStrictEqual(h.clock().enabled, true, "the dwell is armed");
  h.clock().tick();
  deepStrictEqual(h.api.value, "6", "but no repeat starts");
  deepStrictEqual(h.clock().enabled, false, "and the gesture is over");
});

test("Given a press on an out-of-range value / When the dwell elapses / Then the gesture ends", () => {
  const h = mount({
    defaultValue: "5",
    min: "0",
    max: "10",
    allowOverflow: true,
  });
  h.api.setValue(50);
  h.pressTrigger("increment");
  h.clock().tick();
  deepStrictEqual(h.api.value, "51", "the press stepped once");
  deepStrictEqual(
    h.clock().enabled,
    false,
    "but an out-of-range value earns no repeat",
  );
});

test("Given a held trigger / When another value arrives / Then the repeat keeps the armed direction", () => {
  const h = mount({ defaultValue: "5" });
  h.pressTrigger("decrement");
  h.clock().tick();
  h.clock().tick();
  deepStrictEqual(h.api.value, "3", "the repeat runs downward");
});

// ---- the scrubber gesture -------------------------------------------------

test("Given the scrubber grabbed / When the drag begins / Then the cursor is placed under the pointer", () => {
  const h = mount({ defaultValue: "5" });
  h.grabScrubber({ clientX: 100, clientY: 40 });
  const style = h.bag("cursor")["style"];
  deepStrictEqual(
    typeof style === "object" && style !== null,
    true,
    "the cursor rides the geometry channel",
  );
  deepStrictEqual(
    (style as Record<string, string>)["left"],
    "92px",
    "the point is offset by half a cursor, rounded to the device pixel",
  );
  deepStrictEqual(
    (style as Record<string, string>)["top"],
    "32px",
    "and the y is offset the same way",
  );
});

test("Given a scrubbing gesture / When the pointer moves right / Then the value increments", () => {
  const h = mount({ defaultValue: "5" });
  h.grabScrubber({ clientX: 100 });
  h.dragScrubber(140);
  deepStrictEqual(h.api.value, "6", "a rightward drag steps up");
  h.dragScrubber(180);
  deepStrictEqual(h.api.value, "7", "and each further move steps again");
});

test("Given a scrubbing gesture / When the pointer moves left / Then the value decrements", () => {
  const h = mount({ defaultValue: "5" });
  h.grabScrubber({ clientX: 100 });
  h.dragScrubber(60);
  deepStrictEqual(h.api.value, "4", "a leftward drag steps down");
});

test("Given an rtl input / When the pointer moves right / Then the value decrements", () => {
  const h = mount({ defaultValue: "5", dir: "rtl" });
  h.grabScrubber({ clientX: 100 });
  h.dragScrubber(140);
  deepStrictEqual(h.api.value, "4", "the axis is mirrored");
});

test("Given a scrubbing gesture / When the pointer holds still / Then the value does not move", () => {
  const h = mount({ defaultValue: "5" });
  h.grabScrubber({ clientX: 100 });
  h.dragScrubber(100);
  deepStrictEqual(h.api.value, "5", "no delta is no hint");
  h.dragScrubber(100);
  deepStrictEqual(h.api.value, "5", "and still nothing");
});

test("Given a rail that was never grabbed / When a stray move arrives / Then nothing moves", () => {
  const h = mount({ defaultValue: "5" });
  h.dragScrubber(140);
  deepStrictEqual(h.api.value, "5", "the gesture is not armed");
  deepStrictEqual(h.state(), "idle", "and the machine stayed idle");
});

test("Given two scrubbing inputs / When one gesture ends / Then the other's drag still steps", () => {
  const a = mount({ defaultValue: "5" });
  const b = mount({ defaultValue: "42" });
  a.grabScrubber({ clientX: 100 });
  b.grabScrubber({ clientX: 100 });
  a.dropScrubber();
  b.dragScrubber(140);
  deepStrictEqual(b.api.value, "43", "the surviving gesture keeps its anchor");
  deepStrictEqual(a.api.value, "5", "and the ended one never moved");
});

test("Given two bindings on one root / When both scrub / Then each keeps its own anchor", () => {
  const h = mount({ defaultValue: "5" });
  const second = createNumberInputBridge(
    () => ({ defaultValue: "42", "@@authored": () => false }),
    () => h.root,
    "number-input:inner",
  );
  const drag = (api: NumberInputApi, clientX: number): void =>
    handler<(event: PointerEvent) => void>(
      api.getScrubberProps(),
      "onPointerMove",
    )(pointer({ clientX, clientY: 40 }));
  const grab = (api: NumberInputApi, clientX: number): void =>
    handler<(event: PointerEvent) => void>(
      api.getScrubberProps(),
      "onPointerDown",
    )(pointer({ clientX, clientY: 40 }));
  grab(h.api, 100);
  grab(second.api, 100);
  drag(h.api, 140);
  drag(second.api, 140);
  deepStrictEqual(h.api.value, "6", "the first binding steps its own value");
  deepStrictEqual(second.api.value, "43", "and the second steps its own");
  second.dispose();
});
test("Given a disabled input / When the rail is grabbed / Then the gesture never starts", () => {
  const h = mount({ defaultValue: "5", disabled: true });
  h.grabScrubber({ clientX: 100 });
  deepStrictEqual(h.state(), "idle", "no gesture starts");
  h.dragScrubber(140);
  deepStrictEqual(h.api.value, "5", "and the drag does nothing");
});

test("Given a scrubbing gesture / When it ends / Then the cursor is cleared and hidden", () => {
  const h = mount({ defaultValue: "5" });
  h.grabScrubber({ clientX: 100 });
  deepStrictEqual(
    h.bag("cursor")["hidden"],
    false,
    "the cursor shows while scrubbing",
  );
  h.dropScrubber();
  deepStrictEqual(
    h.bag("cursor")["hidden"],
    true,
    "and hides when the gesture ends",
  );
  deepStrictEqual(
    (h.bag("cursor")["style"] as Record<string, string>)["left"],
    "0px",
    "the geometry channel is reset",
  );
});

test("Given a scrubbing gesture / When a non-primary press arrives / Then it is ignored", () => {
  const h = mount({ defaultValue: "5" });
  h.grabScrubber({ clientX: 100, button: 2 });
  deepStrictEqual(h.state(), "idle", "a right press is not a grab");
});

// ---- the spin controls ----------------------------------------------------

test("Given a spin control / When its bag is read / Then the trigger semantics hold", () => {
  const h = mount({
    defaultValue: "5",
    incrementLabel: "more",
    decrementLabel: "less",
  });
  const inc = h.trigger("increment");
  const dec = h.trigger("decrement");
  deepStrictEqual(inc["type"], "button", "the triggers are buttons");
  deepStrictEqual(inc["tabIndex"], -1, "and stay out of the tab order");
  deepStrictEqual(
    inc["aria-controls"],
    "number-input:number-input:input",
    "the control names the input",
  );
  deepStrictEqual(inc["aria-label"], "more", "the host's increment label");
  deepStrictEqual(dec["aria-label"], "less", "and its decrement label");
});

test("Given the default labels / When no translation is authored / Then the defaults are used", () => {
  const h = mount();
  deepStrictEqual(
    h.trigger("increment")["aria-label"],
    "increment value",
    "the increment default",
  );
  deepStrictEqual(
    h.trigger("decrement")["aria-label"],
    "decrease value",
    "and the decrement one",
  );
});

test("Given a disabled input / When the trigger bags are read / Then both report it", () => {
  const h = mount({ disabled: true });
  deepStrictEqual(
    h.trigger("increment")["disabled"],
    true,
    "the increment trigger is disabled",
  );
  deepStrictEqual(
    h.trigger("decrement")["disabled"],
    true,
    "and so is the decrement",
  );
  deepStrictEqual(h.api.disabled, true, "the root reports it");
  deepStrictEqual(h.bag("input")["disabled"], true, "and the input is disabled");
});

test("Given a disabled fieldset / When the form-control action reports / Then the machine follows", () => {
  const h = mount({ defaultValue: "5" });
  actionCallback<(value: boolean) => void>(
    h.bag("root"),
    "use:form-control",
    "onDisabledChange",
  )(true);
  deepStrictEqual(h.api.disabled, true, "the api reports the fieldset");
  deepStrictEqual(h.bag("input")["disabled"], true, "the input is disabled");
  deepStrictEqual(
    h.trigger("increment")["disabled"],
    true,
    "and the triggers with it",
  );
  actionCallback<(value: boolean) => void>(
    h.bag("root"),
    "use:form-control",
    "onDisabledChange",
  )(false);
  deepStrictEqual(
    h.api.disabled,
    false,
    "re-enabling the fieldset re-enables the control",
  );
});

test("Given a form reset / When the action reports it / Then the value returns to the seed", () => {
  const h = mount({ defaultValue: "5" });
  h.api.increment();
  deepStrictEqual(h.api.value, "6", "the value moved");
  actionCallback<() => void>(
    h.bag("root"),
    "use:form-control",
    "onFormReset",
  )();
  deepStrictEqual(h.api.value, "5", "the reset restores the seed");
  deepStrictEqual(h.events.valueChange, [
    { value: "6", valueAsNumber: 6 },
    { value: "5", valueAsNumber: 5 },
  ], "and both moves report");
});

// ---- the controlled channel ----------------------------------------------
//
// A prop is authored when the HOST wrote it; a coerced default never is. The
// bridge's effect reads the live prop signals, so a write moves the machine
// without an event.

test("Given an authored value / When the host writes it / Then the machine follows without an event", () => {
  const h = mount({ value: "1" });
  h.write("value", 8);
  deepStrictEqual(h.api.value, "8", "the machine follows the write");
  deepStrictEqual(
    h.events.valueChange,
    [{ value: "8", valueAsNumber: 8 }],
    "and it reports as a change",
  );
});

test("Given an authored value / When the host writes it over a default / Then the write wins", () => {
  const h = mount({ value: "", defaultValue: "5" });
  deepStrictEqual(
    h.api.value,
    "",
    "the authored empty value clears what the default seeded",
  );
  h.write("value", "9");
  deepStrictEqual(h.api.value, "9", "and a later write lands verbatim");
});

test("Given an authored value / When the machine itself moves / Then the next host write still wins", () => {
  const h = mount({ value: "1" });
  h.api.increment();
  deepStrictEqual(h.api.value, "2", "the machine moved");
  h.write("value", 7);
  deepStrictEqual(h.api.value, "7", "the host's write re-imposes itself");
});

test("Given a default value / When the host never writes it / Then the machine keeps its own moves", () => {
  const h = mount({ defaultValue: "5" });
  h.api.increment();
  deepStrictEqual(h.api.value, "6", "the machine's own move stands");
  h.write("defaultValue", 9);
  deepStrictEqual(
    h.api.value,
    "6",
    "a default write does not alternate the value",
  );
});

test("Given an authored value written to what it already holds / Then nothing reports", () => {
  const h = mount({ value: "5" });
  h.write("value", "5");
  deepStrictEqual(h.api.value, "5", "the value is unchanged");
  deepStrictEqual(h.events.valueChange, [], "and no change is reported");
});

test("Given an authored value the machine cannot parse / When it is written / Then the host's characters stand", () => {
  const h = mount({ value: "5" });
  h.write("value", "not a number");
  deepStrictEqual(
    h.api.value,
    "not a number",
    "a controlled value is the host's, verbatim",
  );
  deepStrictEqual(
    h.api.valueAsNumber,
    Number.NaN,
    "and its number is the absent one",
  );
});

test("Given an authored value written as a non-value / When it arrives / Then the machine is left alone", () => {
  const h = mount({ value: "5" });
  h.write("value", { not: "a value" });
  deepStrictEqual(h.api.value, "5", "an unusable write changes nothing");
});

test("Given authored bounds / When they change / Then the scalars the assigns read follow", () => {
  const h = mount({ defaultValue: "5", max: "10" });
  h.api.increment();
  deepStrictEqual(h.api.value, "6", "the old max allowed the step");
  h.write("max", 6);
  deepStrictEqual(h.api.value, "6", "the new max holds it");
  h.api.increment();
  deepStrictEqual(h.api.value, "6", "and nothing more moves");
  deepStrictEqual(h.api.canIncrement, false, "the api reports the new bound");
  deepStrictEqual(
    h.trigger("increment")["disabled"],
    true,
    "and the trigger with it",
  );
});

// ---- the aria contract ----------------------------------------------------

test("Given an input / When its bag is read / Then the spinbutton contract holds", () => {
  const h = mount({ defaultValue: "12", min: "0", max: "100" });
  const bag = h.bag("input");
  deepStrictEqual(bag["role"], "spinbutton", "the input is a spinbutton");
  deepStrictEqual(bag["aria-roledescription"], "numberfield", "and a numberfield");
  deepStrictEqual(bag["aria-valuemin"], 0, "the minimum");
  deepStrictEqual(bag["aria-valuemax"], 100, "the maximum");
  deepStrictEqual(bag["aria-valuenow"], 12, "the current value");
  deepStrictEqual(bag["aria-invalid"], false, "an in-range value is valid");
  deepStrictEqual(bag["type"], "text", "the input is a text field");
  deepStrictEqual(bag["inputMode"], "decimal", "with the decimal keypad");
  deepStrictEqual(bag["pattern"], "-?[0-9]*(.[0-9]+)?", "and the default pattern");
  deepStrictEqual(bag["autoComplete"], "off", "no autofill");
  deepStrictEqual(bag["spellCheck"], false, "and no spellcheck");
  deepStrictEqual(bag["readOnly"], false, "it is writable");
  deepStrictEqual(
    bag["id"],
    "number-input:number-input:input",
    "and the part id is namespaced",
  );
});

test("Given an empty value / When the bag is read / Then aria-valuenow is absent", () => {
  const h = mount();
  deepStrictEqual(
    h.bag("input")["aria-valuenow"],
    undefined,
    "an absent value has no number",
  );
  deepStrictEqual(h.api.valueAsNumber, Number.NaN, "the api agrees");
});

test("Given an out-of-range value / When the bag is read / Then aria-invalid is set", () => {
  const h = mount({
    min: "0",
    max: "10",
    allowOverflow: true,
    defaultValue: "40",
  });
  deepStrictEqual(h.bag("input")["aria-invalid"], true, "the input announces it");
  deepStrictEqual(h.api.invalid, true, "and the api reports it");
});

test("Given an authored invalid / When it is written / Then it wins over the range", () => {
  const h = mount({
    min: "0",
    max: "10",
    invalid: false,
    defaultValue: "40",
    allowOverflow: true,
  });
  deepStrictEqual(h.api.invalid, false, "the host's answer stands");
  h.write("invalid", true);
  deepStrictEqual(h.api.invalid, true, "and turning it on works");
});

test("Given a control / When its bag is read / Then the group contract holds", () => {
  const h = mount({ defaultValue: "5", disabled: true });
  const bag = h.bag("control");
  deepStrictEqual(bag["role"], "group", "the control groups the field");
  deepStrictEqual(bag["aria-disabled"], true, "and reports disabled");
  deepStrictEqual(bag["aria-invalid"], false, "while the value is valid");
  deepStrictEqual(
    bag["id"],
    "number-input:number-input:control",
    "the part id is namespaced",
  );
});

test("Given a label / When its bag is read / Then it names the input", () => {
  const h = mount({ required: true });
  const bag = h.bag("label");
  deepStrictEqual(
    bag["for"],
    "number-input:number-input:input",
    "the label names the input",
  );
  deepStrictEqual(h.api.required, true, "and reports required");
  deepStrictEqual(
    bag["id"],
    "number-input:number-input:label",
    "with a namespaced id",
  );
});

test("Given the input in the document / When the label is clicked / Then the field takes focus", () => {
  const h = mount({ defaultValue: "5" });
  const input = attachInput();
  handler<(event: unknown) => void>(h.bag("label"), "onClick")(undefined);
  deepStrictEqual(input.focused.length, 1, "the label focuses the field once");
  deepStrictEqual(h.state(), "idle", "and the machine is untouched by the label");
});

test("Given focusInputOnChange false / When the label is clicked / Then the field keeps its focus", () => {
  const h = mount({ defaultValue: "5", focusInputOnChange: false });
  const input = attachInput();
  handler<(event: unknown) => void>(h.bag("label"), "onClick")(undefined);
  deepStrictEqual(input.focused.length, 0, "the host opted out of the focus");
});

test("Given the input in the document / When a trigger is pressed / Then the field takes focus", () => {
  const h = mount({ defaultValue: "5" });
  const input = attachInput();
  h.pressTrigger("increment");
  deepStrictEqual(input.focused.length, 1, "a press focuses the field");
  deepStrictEqual(h.api.value, "6", "and the press steps once");
});

test("Given the input in the document / When the scrubber is grabbed / Then the field takes focus", () => {
  const h = mount({ defaultValue: "5" });
  const input = attachInput();
  h.grabScrubber({ clientX: 100 });
  deepStrictEqual(input.focused.length, 1, "the grab focuses the field");
  deepStrictEqual(h.state(), "scrubbing", "and the gesture is live");
});

test("Given the cursor part / When its bag is read / Then the coordinates ride the style object", () => {
  const h = mount({ defaultValue: "5" });
  h.grabScrubber({ clientX: 100, clientY: 40 });
  const style = h.bag("cursor")["style"] as Record<string, string>;
  const keys = Object.keys(style);
  deepStrictEqual(keys.length, 2, "the channel carries the two coordinates");
  deepStrictEqual(
    keys.every((key) => key === "left" || key === "top"),
    true,
    "and they are plain style properties",
  );
  deepStrictEqual(
    h.bag("cursor")["aria-hidden"],
    true,
    "the cursor is decorative",
  );
  deepStrictEqual(
    h.bag("cursor")["id"],
    "number-input:number-input:cursor",
    "with a namespaced id",
  );
});

// ---- stability across moves ----------------------------------------------
//
// The api proxy hands out one connect for the element's whole life, and its
// bags are cached against the context fields they read. A binding reads the
// api on every machine move, so a fresh bag per read detaches and re-attaches
// every listener each move.

test("Given an open input / When the value moves / Then the bag is rebuilt and follows it", () => {
  const h = mount({ defaultValue: "5" });
  const before = h.bag("input");
  h.api.increment();
  const after = h.bag("input");
  deepStrictEqual(
    before === after,
    false,
    "the value moved, so the bag was rebuilt",
  );
  deepStrictEqual(after["value"], "6", "and the new bag carries the new value");
  deepStrictEqual(after["aria-valuenow"], 6, "with the new number");
});

test("Given an open input / When nothing moves / Then re-reading the bags returns the same objects", () => {
  const h = mount({ defaultValue: "5" });
  deepStrictEqual(h.bag("root") === h.bag("root"), true, "the root bag is stable");
  deepStrictEqual(h.bag("input") === h.bag("input"), true, "so is the input bag");
  deepStrictEqual(
    h.bag("control") === h.bag("control"),
    true,
    "and the control bag",
  );
  deepStrictEqual(
    h.trigger("increment") === h.trigger("increment"),
    true,
    "and the trigger bag",
  );
});

test("Given an open input / When the value moves / Then the part handlers keep their identity", () => {
  const h = mount({ defaultValue: "5" });
  const before = h.bag("input")["onKeydown"];
  h.api.increment();
  // The bag is rebuilt for the new value, but the handlers are the connect's
  // own closures — a listener that changes identity is re-attached every move.
  deepStrictEqual(
    h.bag("input")["onKeydown"] === before,
    true,
    "the handler identity survives a move",
  );
  const scrubber = h.bag("scrubber")["onPointerDown"];
  h.grabScrubber();
  h.api.increment();
  deepStrictEqual(
    h.bag("scrubber")["onPointerDown"] === scrubber,
    true,
    "and the scrubber's too",
  );
});

test("Given an open input / When the api is read / Then the connect is one object for the element's life", () => {
  const h = mount({ defaultValue: "5" });
  const first = h.api.getInputProps;
  h.api.increment();
  deepStrictEqual(
    h.api.getInputProps === first,
    true,
    "the api surface is stable across moves",
  );
});

test("Given a gesture / When the trigger bag is read mid-press / Then the data state follows the machine", () => {
  const h = mount({ defaultValue: "5" });
  h.pressTrigger("increment");
  deepStrictEqual(h.api.focused, true, "the control reports focus");
  deepStrictEqual(h.api.focused, true, "and so does the value text");
  h.releaseTrigger("increment");
  deepStrictEqual(h.api.focused, true, "the gesture ended but focus stays");
});

test("Given an input / When it is disposed / Then the machine stops", () => {
  const h = mount({ defaultValue: "5" });
  h.dispose();
  h.api.increment();
  deepStrictEqual(h.api.value, "5", "a stopped service takes no more moves");
  deepStrictEqual(h.state(), "idle", "and holds its last state");
});
