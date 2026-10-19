import { assertEquals } from "@std/assert";
import { parseHTML } from "@spin/runtime/testing";
import { signal } from "@spin/runtime";
import { pinInput } from "./pin-input.bindings.ts";
const createPinInputBridge = pinInput.createBridge;
import type { PinInputApi } from "./pin-input.bindings.ts";
import type {
  PinInputValueChange,
  PinInputValueComplete,
  PinInputValueInvalid,
} from "./pin-input.machine.ts";

/** A live writable read, as the element's prop store exposes one. */
type WriteSignal = { (): unknown; (value: unknown): void };

const win = parseHTML("<!doctype html><html><body></body></html>") as unknown as Record<string, unknown>;
declare const globalThis: Record<string, unknown>;
globalThis.document = win.document;
globalThis.CustomEvent = win.CustomEvent;
globalThis.HTMLElement = win.HTMLElement;
globalThis.Element = win.Element;
globalThis.HTMLInputElement = win.HTMLInputElement;

/**
 * Prop bags hand back `Record<string, unknown>`, so a handler read out of one
 * is checked here and typed once, instead of an unchecked cast at every call
 * site.
 */
function handler<H>(bag: Record<string, unknown>, key: string): H {
  const value: unknown = bag[key];
  if (typeof value !== "function") throw new Error(`no handler at ${key}`);
  return value as H;
}

/**
 * linkedom ships no KeyboardEvent/InputEvent/ClipboardEvent/FocusEvent
 * constructors, so the events the handlers read are synthesized here — one
 * place, with the minimal field set each handler reads. The input events
 * carry a REAL input element as `currentTarget`: the handlers narrow on it.
 */
const keydown = (
  key: string,
  modifiers: Readonly<{ ctrl?: boolean; alt?: boolean; meta?: boolean; shift?: boolean }> = {},
): KeyboardEvent => {
  const made: Record<string, unknown> = {
    key,
    shiftKey: modifiers.shift === true,
    ctrlKey: modifiers.ctrl === true,
    altKey: modifiers.alt === true,
    metaKey: modifiers.meta === true,
    isComposing: false,
    keyCode: 0,
    defaultPrevented: false,
  };
  made["preventDefault"] = (): void => {
    made["defaultPrevented"] = true;
  };
  return made as unknown as KeyboardEvent;
};

const clipboard = (text: string): ClipboardEvent => {
  const made: Record<string, unknown> = {
    clipboardData: { getData: (_kind: string): string => text },
    defaultPrevented: false,
  };
  made["preventDefault"] = (): void => {
    made["defaultPrevented"] = true;
  };
  return made as unknown as ClipboardEvent;
};

const beforeInput = (target: HTMLInputElement, data: string, inputType = "insertText"): InputEvent => {
  const made: Record<string, unknown> = { currentTarget: target, data, inputType, defaultPrevented: false };
  made["preventDefault"] = (): void => {
    made["defaultPrevented"] = true;
  };
  return made as unknown as InputEvent;
};

const typing = (target: HTMLInputElement, inputType: string): InputEvent =>
  ({ currentTarget: target, inputType }) as unknown as InputEvent;

const focusOut = (relatedTarget: unknown): FocusEvent => ({ relatedTarget }) as unknown as FocusEvent;

interface Harness {
  readonly api: PinInputApi;
  readonly root: HTMLDivElement;
  readonly events: {
    readonly value: PinInputValueChange[];
    readonly complete: PinInputValueComplete[];
    readonly invalid: PinInputValueInvalid[];
  };
  /** The cells the DOM holds, created with the ids the bags hand out. */
  cell(index: number): HTMLInputElement;
  bag(index: number): Record<string, unknown>;
  hidden(): HTMLInputElement;
  /** Which cells the view focused, in order (linkedom's focus dispatches). */
  focused(): readonly number[];
  state(): string;
  typeIn(index: number, char: string, inputType?: string): void;
  beforeType(index: number, data: string, from?: number, to?: number): void;
  press(
    index: number,
    key: string,
    modifiers?: Readonly<{ ctrl?: boolean; alt?: boolean; meta?: boolean; shift?: boolean }>,
  ): void;
  focusIn(index: number): void;
  blurOut(index: number, relatedTarget?: unknown): void;
  pasteIn(index: number, text: string): void;
  /** Presses the label; returns whether its own activation was cancelled. */
  pressLabel(): boolean;
  write(name: string, value: unknown): void;
  dispose(): void;
}

/**
 * Mounts the bridge the way the element does: props as signals (so a host
 * write re-runs the controlled-channel effect), a root element, and the cell
 * inputs the connect reaches for by id — the element's markup provides them
 * for real. The machine id differs per mount, as the element's `uniqueId`
 * gives it, so a node left behind by an earlier test can never be found by
 * id.
 */
let mounts = 0;

function mount(overrides: Readonly<Record<string, unknown>> = {}): Harness {
  const root = document.createElement("div");
  document.body.appendChild(root);
  const count = typeof overrides["count"] === "number" ? (overrides["count"] as number) : 4;

  const events = {
    value: [] as PinInputValueChange[],
    complete: [] as PinInputValueComplete[],
    invalid: [] as PinInputValueInvalid[],
  };
  const values: Record<string, WriteSignal> = {};
  const authoredKeys = new Set(Object.keys(overrides));
  const write = (name: string, value: unknown): void => {
    const source = values[name];
    if (source === undefined) values[name] = signal<unknown>(value);
    else source(value);
  };
  for (const [name, value] of Object.entries(overrides)) write(name, value);
  write("onValueChange", (change: PinInputValueChange) => events.value.push(change));
  write("onValueComplete", (change: PinInputValueComplete) => events.complete.push(change));
  write("onValueInvalid", (change: PinInputValueInvalid) => events.invalid.push(change));

  const bridge = createPinInputBridge(
    () => {
      const record: Record<string, unknown> = {};
      for (const [name, source] of Object.entries(values)) record[name] = source();
      record["@@authored"] = (name: string): boolean => authoredKeys.has(name);
      return record;
    },
    () => root,
    `pin-${++mounts}`,
  );

  // The cells, with the ids the bags hand out. The bag's handlers are
  // attached as real listeners, exactly as the markup's spread does, so a
  // linkedom focus() reaches the machine as an INPUT.FOCUS; linkedom's
  // focus() dispatches, so a listener records which cell the view moved to.
  // The handlers are memoized per cell by the connect, so attaching them
  // once is attaching the live ones.
  const cells: HTMLInputElement[] = [];
  const focused: number[] = [];
  for (let index = 0; index < count; index += 1) {
    const cell = document.createElement("input");
    cell.id = String(bridge.api.getInputProps({ index })["id"]);
    cell.addEventListener("focus", () => focused.push(index));
    const bag = bridge.api.getInputProps({ index });
    for (const name of ["onFocus", "onBlur", "onKeyDown", "onPaste", "onBeforeInput", "onInput"]) {
      cell.addEventListener(name.slice(2).toLowerCase(), handler<EventListener>(bag, name));
    }
    root.appendChild(cell);
    cells.push(cell);
  }
  const hidden = document.createElement("input");
  hidden.id = String(bridge.api.getHiddenInputProps()["id"]);
  root.appendChild(hidden);

  /** A cell's selection, stubbed the way the browser keeps it: the
   * beforeinput handler reads the prospective value off it. */
  const selectIn = (cell: HTMLInputElement, from: number, to: number): void => {
    Object.defineProperty(cell, "selectionStart", { value: from, configurable: true });
    Object.defineProperty(cell, "selectionEnd", { value: to, configurable: true });
  };

  const bag = (index: number): Record<string, unknown> => bridge.api.getInputProps({ index });

  return {
    api: bridge.api,
    root,
    events,
    cell: (index: number): HTMLInputElement => {
      const found = cells[index];
      if (found === undefined) throw new Error(`no cell ${index}`);
      return found;
    },
    bag,
    hidden: (): HTMLInputElement => hidden,
    focused: (): readonly number[] => focused,
    state: (): string => (bridge.api.focused ? "focused" : "idle"),
    typeIn: (index: number, value: string, inputType = "insertText"): void => {
      const cell = cells[index];
      if (cell === undefined) throw new Error(`no cell ${index}`);
      // The browser's cell holds the character the bag wrote into it.
      cell.value = value;
      handler<(event: InputEvent) => void>(bag(index), "onInput")(typing(cell, inputType));
    },
    beforeType: (index: number, data: string, from = 0, to = from): void => {
      const cell = cells[index];
      if (cell === undefined) throw new Error(`no cell ${index}`);
      cell.value = String(bag(index)["value"]);
      selectIn(cell, from, to);
      handler<(event: InputEvent) => void>(bag(index), "onBeforeInput")(beforeInput(cell, data));
    },
    press: (
      index: number,
      key: string,
      modifiers: Readonly<{ ctrl?: boolean; alt?: boolean; meta?: boolean; shift?: boolean }> = {},
    ): void => {
      handler<(event: KeyboardEvent) => void>(bag(index), "onKeyDown")(keydown(key, modifiers));
    },
    focusIn: (index: number): void => {
      handler<() => void>(bag(index), "onFocus")();
    },
    blurOut: (index: number, relatedTarget: unknown = null): void => {
      handler<(event: FocusEvent) => void>(bag(index), "onBlur")(focusOut(relatedTarget));
    },
    pasteIn: (index: number, text: string): void => {
      handler<(event: ClipboardEvent) => void>(bag(index), "onPaste")(clipboard(text));
    },
    pressLabel: (): boolean => {
      let stopped = false;
      const made: Record<string, unknown> = { defaultPrevented: false };
      made["preventDefault"] = (): void => {
        stopped = true;
      };
      handler<(event: MouseEvent) => void>(
        bridge.api.getLabelProps(),
        "onClick",
      )(made as unknown as MouseEvent);
      return stopped;
    },
    write,
    dispose: (): void => {
      bridge.dispose();
      root.remove();
    },
  };
}

/** The cells, read through the api the markup iterates. */
const CELLS = (h: Harness): readonly number[] => h.api.items;

/** The characters the api reports. */
const CHARS = (h: Harness): readonly string[] => h.api.value;

// ---- the two states -------------------------------------------------------
//
// `idle` is the start; `focused` is a cell holding DOM focus. Both are
// reachable, and the value events (the root tier) are exercised from both.

Deno.test("Given a fresh pin / When nothing is authored / Then idle is the reachable start state", () => {
  const h = mount();
  assertEquals(h.state(), "idle", "no cell holds focus at the start");
  assertEquals(CHARS(h), ["", "", "", ""], "the value is empty and filled to the count");
  assertEquals(h.api.count, 4, "the cell count is the element default");
  assertEquals(CELLS(h), [0, 1, 2, 3], "the items are the cell indices");
  assertEquals(h.api.valueAsString, "", "the joined string is empty");
  assertEquals(h.api.complete, false, "an empty pin is not complete");
  assertEquals(h.events.value, [], "seeding reports nothing");
  assertEquals(h.events.complete, [], "and nothing completes");
  h.dispose();
});

Deno.test("Given defaultValue / When the pin mounts / Then the seed is the start state", () => {
  const h = mount({ defaultValue: ["1", "2"] });
  assertEquals(CHARS(h), ["1", "2", "", ""], "defaultValue seeds the cells, padded to the count");
  assertEquals(h.api.valueAsString, "12", "the joined string follows the seed");
  assertEquals(h.api.complete, false, "two of four cells is not complete");
  assertEquals(h.events.value, [], "a seed is not a change");
  h.dispose();
});

Deno.test("Given a value that fills every cell / When the pin mounts / Then it is complete without a report", () => {
  const h = mount({ defaultValue: ["9", "8", "7", "6"] });
  assertEquals(h.api.complete, true, "every cell is filled");
  assertEquals(h.api.valueAsString, "9876", "the joined string is the whole pin");
  assertEquals(h.events.complete, [], "the mount is not a completion edge");
  h.dispose();
});

Deno.test("Given the grammar's own default for an array prop / When the pin mounts / Then it seeds no characters", () => {
  // The scope grammar's default for `string[] = []` arrives as the string
  // "[]" coerced into one cell; a cell holds one character, so it is not one.
  const h = mount({ defaultValue: ["[]"] });
  assertEquals(h.api.value, ["", "", "", ""], "the artifact seeds nothing");
  assertEquals(h.api.valueAsString, "", "and the pin reads as empty");
  h.dispose();
});

Deno.test("Given a pin / When a cell takes focus / Then the focused state is reachable", () => {
  const h = mount({ defaultValue: ["1", "2"] });
  h.focusIn(0);
  assertEquals(h.state(), "focused", "the api reports the cell focused");
  h.dispose();
});

Deno.test("Given a focused cell / When focus leaves the pin / Then the idle state is reachable again", () => {
  const h = mount({ defaultValue: ["1", "2"] });
  h.focusIn(1);
  assertEquals(h.state(), "focused", "the cell holds focus");
  h.blurOut(1);
  assertEquals(h.state(), "idle", "the blur returns to idle");
  assertEquals(CHARS(h), ["1", "2", "", ""], "the blur keeps the value");
  h.dispose();
});

Deno.test("Given a focused cell / When focus moves to another cell of the pin / Then it is not a blur", () => {
  const h = mount({ defaultValue: ["1", "2"] });
  h.focusIn(0);
  h.blurOut(0, h.cell(1));
  assertEquals(h.state(), "focused", "focus inside the pin keeps the focused state");
  h.focusIn(1);
  assertEquals(h.state(), "focused", "and the new cell is focused");
  h.dispose();
});

// ---- INPUT.FOCUS ----------------------------------------------------------

Deno.test("Given an empty pin / When a cell takes focus / Then the index parks on the first empty cell", () => {
  const h = mount();
  h.focusIn(2);
  assertEquals(h.state(), "focused", "the focused state is reached");
  assertEquals(h.focused(), [0], "the view moved focus to the first cell");
  assertEquals(h.bag(0)["placeholder"], "", "the focused cell hides its placeholder");
  h.dispose();
});

Deno.test("Given a half-filled pin / When a filled cell takes focus / Then the index follows the focus", () => {
  const h = mount({ defaultValue: ["1", "2"] });
  h.focusIn(1);
  assertEquals(h.focused(), [1], "focus stays where the host put it");
  assertEquals(h.bag(1)["placeholder"], "", "the focused cell hides its placeholder");
  assertEquals(h.bag(0)["placeholder"], "\u25CB", "an unfocused cell keeps the placeholder");
  h.dispose();
});

Deno.test("Given a half-filled pin / When a cell beyond the fill takes focus / Then the first empty cell takes it", () => {
  const h = mount({ defaultValue: ["1", "2"] });
  h.focusIn(0);
  h.focusIn(3);
  assertEquals(h.focused(), [0, 2], "focus is moved to the first cell the value has not filled");
  h.dispose();
});

// ---- INPUT.CHANGE / INPUT.ADVANCE -----------------------------------------

Deno.test("Given a focused empty cell / When a character is typed / Then the cell fills and focus advances", () => {
  const h = mount({ defaultValue: ["1", "2"] });
  h.focusIn(2);
  h.typeIn(2, "3");
  assertEquals(CHARS(h), ["1", "2", "3", ""], "the typed character lands in the focused cell");
  assertEquals(h.bag(2)["value"], "3", "the bag carries the new character");
  assertEquals(h.focused().at(-1), 3, "focus advances to the next cell");
  assertEquals(h.api.valueAsString, "123", "the joined string follows");
  assertEquals(
    h.events.value,
    [{ value: ["1", "2", "3", ""], valueAsString: "123" }],
    "value-change reports the new value",
  );
  h.dispose();
});

Deno.test("Given a filled cell / When a second character is typed over it / Then the new character replaces it", () => {
  const h = mount({ defaultValue: ["1", "2"] });
  h.focusIn(1);
  h.typeIn(1, "23");
  assertEquals(CHARS(h), ["1", "3", "", ""], "the character that differs from the current one wins");
  assertEquals(h.focused().at(-1), 2, "focus advances past the overwritten cell");
  h.dispose();
});

Deno.test("Given a focused cell / When the same character is re-typed / Then the advance key moves on instead", () => {
  const h = mount({ defaultValue: ["1", "2"] });
  h.focusIn(1);
  h.press(1, "2");
  assertEquals(CHARS(h), ["1", "2", "", ""], "the cell keeps its character");
  assertEquals(h.focused().at(-1), 2, "the view reported the advance, and focus followed it");
  assertEquals(h.events.value, [], "no value change is reported");
  h.dispose();
});

Deno.test("Given a value / When the browser reports the character the machine already holds / Then nothing is written", () => {
  const h = mount({ defaultValue: ["1", "2"] });
  h.focusIn(1);
  h.typeIn(1, "2");
  assertEquals(CHARS(h), ["1", "2", "", ""], "the cell keeps its character");
  assertEquals(h.events.value, [], "no change is reported");
  h.dispose();
});

Deno.test("Given the last empty cell / When it is filled / Then the pin completes and reports once", () => {
  const h = mount({ defaultValue: ["1", "2", "3"] });
  h.focusIn(3);
  h.typeIn(3, "4");
  assertEquals(CHARS(h), ["1", "2", "3", "4"], "the last cell fills");
  assertEquals(h.api.complete, true, "the api reports complete");
  assertEquals(h.events.complete, [{ value: ["1", "2", "3", "4"], valueAsString: "1234" }], "value-complete reports the edge once");
  assertEquals(h.bag(0)["data-complete"], "", "the root reports complete through the bag");
  assertEquals(h.api.getRootProps()["data-complete"], "", "and through the root bag");
  h.dispose();
});

Deno.test("Given a complete pin / When a cell is edited again / Then the completion does not re-report", () => {
  const h = mount({ defaultValue: ["1", "2", "3", "4"] });
  h.focusIn(3);
  h.typeIn(3, "5");
  assertEquals(CHARS(h), ["1", "2", "3", "5"], "the cell edits");
  assertEquals(h.api.complete, true, "the pin is still complete");
  assertEquals(h.events.complete, [], "and the completion edge does not re-fire");
  h.dispose();
});

// ---- INPUT.PASTE ----------------------------------------------------------

Deno.test("Given a half-filled pin / When a paste lands at the first empty cell / Then it distributes forward", () => {
  const h = mount({ defaultValue: ["1", "2"] });
  h.focusIn(2);
  h.pasteIn(2, "34");
  assertEquals(CHARS(h), ["1", "2", "3", "4"], "the paste fills the empty cells from the focused one");
  assertEquals(h.api.complete, true, "the paste completes the pin");
  assertEquals(h.events.complete.length, 1, "the completion edge fired once");
  h.dispose();
});

Deno.test("Given an empty pin / When a paste longer than the pin lands / Then the pin holds its first cells", () => {
  const h = mount();
  h.focusIn(0);
  h.pasteIn(0, "123456");
  assertEquals(CHARS(h), ["1", "2", "3", "4"], "the paste is truncated to the cell count");
  assertEquals(h.api.valueAsString, "1234", "the joined string is the whole pin");
  h.dispose();
});

Deno.test("Given a focused cell inside the fill / When a paste lands / Then the characters ahead of it stay", () => {
  const h = mount({ defaultValue: ["1", "2"] });
  h.focusIn(1);
  h.pasteIn(1, "9");
  assertEquals(CHARS(h), ["1", "9", "", ""], "the paste starts at the focused cell");
  h.dispose();
});

// ---- the keyboard map -----------------------------------------------------

Deno.test("Given a filled cell / When Backspace arrives / Then the cell clears and focus steps back", () => {
  const h = mount({ defaultValue: ["1", "2", "3"] });
  h.focusIn(2);
  h.press(2, "Backspace");
  assertEquals(CHARS(h), ["1", "2", "", ""], "the focused cell clears and the tail shifts up");
  assertEquals(h.focused().at(-1), 1, "focus steps back one cell");
  h.dispose();
});

Deno.test("Given an empty cell / When Backspace arrives / Then focus steps back and the cell behind clears", () => {
  const h = mount({ defaultValue: ["1", "2"] });
  h.focusIn(2);
  h.press(2, "Backspace");
  assertEquals(CHARS(h), ["1", "", "", ""], "the character behind the empty cell is taken");
  assertEquals(h.focused().at(-1), 1, "focus steps back one cell");
  h.dispose();
});

Deno.test("Given a filled cell / When Delete arrives / Then only the cell clears", () => {
  const h = mount({ defaultValue: ["1", "2", "3"] });
  h.focusIn(1);
  h.press(1, "Delete");
  assertEquals(CHARS(h), ["1", "3", "", ""], "the focused cell clears and the tail shifts up");
  assertEquals(h.focused().at(-1), 1, "focus does not move");
  h.dispose();
});

Deno.test("Given an empty cell / When Delete arrives / Then nothing moves", () => {
  const h = mount({ defaultValue: ["1", "2"] });
  h.focusIn(3);
  h.press(3, "Delete");
  assertEquals(CHARS(h), ["1", "2", "", ""], "the value is untouched");
  h.dispose();
});

Deno.test("Given a middle cell / When ArrowLeft arrives / Then the previous cell takes focus", () => {
  const h = mount({ defaultValue: ["1", "2", "3"] });
  h.focusIn(2);
  h.press(2, "ArrowLeft");
  assertEquals(h.focused().at(-1), 1, "the view focused the previous cell");
  assertEquals(CHARS(h), ["1", "2", "3", ""], "the value is untouched");
  h.dispose();
});

Deno.test("Given the first cell / When ArrowLeft arrives / Then focus clamps", () => {
  const h = mount({ defaultValue: ["1", "2", "3"] });
  h.focusIn(0);
  h.press(0, "ArrowLeft");
  assertEquals(h.focused(), [0], "focus never moves before the first cell");
  h.dispose();
});

Deno.test("Given a middle cell / When ArrowRight arrives / Then the next cell takes focus", () => {
  const h = mount({ defaultValue: ["1", "2", "3"] });
  h.focusIn(1);
  h.press(1, "ArrowRight");
  assertEquals(h.focused().at(-1), 2, "the view focused the next cell");
  h.dispose();
});

Deno.test("Given the last filled cell / When ArrowRight arrives / Then focus clamps at the fill", () => {
  const h = mount({ defaultValue: ["1", "2", "3"] });
  h.focusIn(2);
  h.press(2, "ArrowRight");
  assertEquals(h.focused().at(-1), 3, "the cell one past the fill is reachable");
  h.press(3, "ArrowRight");
  assertEquals(h.focused().at(-1), 3, "and the cell after that is not");
  h.dispose();
});

Deno.test("Given a focused cell / When Home and End arrive / Then focus takes the extremes", () => {
  const h = mount({ defaultValue: ["1", "2", "3"] });
  h.focusIn(1);
  h.press(1, "Home");
  assertEquals(h.focused().at(-1), 0, "Home focuses the first cell");
  h.press(0, "End");
  assertEquals(h.focused().at(-1), 2, "End focuses the last filled cell");
  h.dispose();
});

Deno.test("Given a keydown with a modifier / When it arrives / Then the map ignores it", () => {
  const h = mount({ defaultValue: ["1", "2", "3"] });
  h.focusIn(1);
  h.press(1, "ArrowRight", { ctrl: true });
  assertEquals(h.focused(), [1], "the modified arrow moves nothing");
  h.dispose();
});

Deno.test("Given a right-to-left pin / When ArrowRight arrives / Then it walks backward", () => {
  const h = mount({ defaultValue: ["1", "2", "3"], dir: "rtl" });
  h.focusIn(1);
  h.press(1, "ArrowRight");
  assertEquals(h.focused().at(-1), 0, "ArrowRight is ArrowLeft in rtl");
  h.press(0, "ArrowLeft");
  assertEquals(h.focused().at(-1), 1, "and ArrowLeft is ArrowRight");
  h.dispose();
});

// ---- the validity gate ----------------------------------------------------

Deno.test("Given a numeric pin / When an invalid character arrives / Then the keystroke is refused and reported", () => {
  const h = mount();
  h.focusIn(0);
  h.beforeType(0, "a");
  assertEquals(CHARS(h), ["", "", "", ""], "nothing lands in the cell");
  assertEquals(h.events.invalid, [{ value: "a", index: 0 }], "value-invalid reports the refusal");
  assertEquals(h.events.value, [], "and no value change");
  h.dispose();
});

Deno.test("Given a numeric pin / When a valid character arrives / Then no refusal is reported", () => {
  const h = mount();
  h.focusIn(0);
  h.beforeType(0, "7");
  assertEquals(h.events.invalid, [], "a valid keystroke is not a refusal");
  assertEquals(CHARS(h), ["", "", "", ""], "the beforeinput gate reports nothing — the machine is not told yet");
  h.dispose();
});

Deno.test("Given a filled cell / When a character is typed over it / Then the prospective value is what is validated", () => {
  const h = mount({ defaultValue: ["1"] });
  h.focusIn(0);
  // A caret at the end of "1" appending "a" would make the cell "1a", which
  // is not a numeric character either: the whole cell is what is validated.
  h.beforeType(0, "a", 1, 1);
  assertEquals(h.events.invalid, [{ value: "1a", index: 0 }], "the refusal carries the prospective cell value");
  h.dispose();
});

Deno.test("Given a numeric pin / When an invalid paste arrives / Then it is refused and reported", () => {
  const h = mount();
  h.focusIn(0);
  h.pasteIn(0, "abcd");
  assertEquals(CHARS(h), ["", "", "", ""], "the paste lands nowhere");
  assertEquals(h.events.invalid, [{ value: "abcd", index: 0 }], "value-invalid reports the refusal");
  h.dispose();
});

Deno.test("Given an alphabetic pin / When letters arrive / Then they are the valid characters", () => {
  const h = mount({ type: "alphabetic" });
  h.focusIn(0);
  h.beforeType(0, "q");
  assertEquals(h.events.invalid, [], "a letter is valid");
  h.beforeType(0, "4");
  assertEquals(h.events.invalid, [{ value: "4", index: 0 }], "a digit is not");
  h.dispose();
});

Deno.test("Given a pattern pin / When the pattern is checked / Then it overrides the type", () => {
  const h = mount({ pattern: "[A-F]" });
  h.focusIn(0);
  h.beforeType(0, "C");
  assertEquals(h.events.invalid, [], "a character the pattern allows is valid");
  h.beforeType(0, "1");
  assertEquals(h.events.invalid, [{ value: "1", index: 0 }], "and a character it refuses is not");
  h.dispose();
});

// ---- the imperative surface ----------------------------------------------

Deno.test("Given a pin / When setValue runs / Then the value is exactly what was set", () => {
  const h = mount({ defaultValue: ["1", "2"] });
  h.api.setValue(["5", "6", "7"]);
  assertEquals(CHARS(h), ["5", "6", "7", ""], "the array is filled to the cell count");
  assertEquals(h.events.value.at(-1), { value: ["5", "6", "7", ""], valueAsString: "567" }, "value-change reports the new value");
  h.dispose();
});

Deno.test("Given a pin / When setValue is called from the idle state / Then the root tier takes it", () => {
  const h = mount();
  h.api.setValue(["1"]);
  assertEquals(CHARS(h), ["1", "", "", ""], "the value lands without a focused cell");
  assertEquals(h.state(), "idle", "the machine is still idle");
  h.dispose();
});

Deno.test("Given a pin / When setValueAtIndex runs / Then the named cell takes the character", () => {
  const h = mount({ defaultValue: ["1", "2"] });
  h.api.setValueAtIndex(2, "7");
  assertEquals(CHARS(h), ["1", "2", "7", ""], "the character lands in the named cell");
  assertEquals(h.api.valueAsString, "127", "the joined string follows");
  h.dispose();
});

Deno.test("Given a pin / When clearValue runs / Then every cell empties and the index parks on the first", () => {
  const h = mount({ defaultValue: ["1", "2", "3", "4"] });
  h.api.clearValue();
  assertEquals(CHARS(h), ["", "", "", ""], "every cell is empty");
  assertEquals(h.api.complete, false, "the pin is no longer complete");
  assertEquals(
    h.events.value.at(-1),
    { value: ["", "", "", ""], valueAsString: "" },
    "value-change reports the clear",
  );
  // Zag's VALUE.CLEAR parks the index on the first cell, and the cell's
  // placeholder is what reads it.
  assertEquals(h.bag(0)["placeholder"], "", "the first cell is the parked index");
  assertEquals(h.bag(1)["placeholder"], "\u25CB", "the others keep their placeholder");
  h.dispose();
});

Deno.test("Given a focused pin / When clearValue runs / Then focus stays and the value empties", () => {
  const h = mount({ defaultValue: ["1", "2"] });
  h.focusIn(1);
  h.api.clearValue();
  assertEquals(h.state(), "focused", "the focused state is kept");
  assertEquals(CHARS(h), ["", "", "", ""], "the value empties");
  h.dispose();
});

// ---- the controlled channel ----------------------------------------------

Deno.test("Given a controlled value / When the host writes it / Then the machine alternates", () => {
  const h = mount({ value: ["1"] });
  assertEquals(CHARS(h), ["1", "", "", ""], "the authored value seeds the pin");
  h.write("value", ["2", "3"]);
  assertEquals(CHARS(h), ["2", "3", "", ""], "a host write alternates the value");
  assertEquals(
    h.events.value.at(-1),
    { value: ["2", "3", "", ""], valueAsString: "23" },
    "the write is reported as a change",
  );
  h.dispose();
});

Deno.test("Given an uncontrolled pin / When the value prop is written / Then the machine does not alternate", () => {
  const h = mount({ defaultValue: ["1"] });
  h.write("value", ["9", "9"]);
  assertEquals(CHARS(h), ["1", "", "", ""], "the seed is not a controlled value");
  h.dispose();
});

Deno.test("Given a controlled value / When a keystroke moves the machine / Then the authored prop does not fight it", () => {
  const h = mount({ value: ["1"] });
  h.focusIn(0);
  h.typeIn(1, "5");
  assertEquals(CHARS(h), ["5", "", "", ""], "the keystroke lands");
  assertEquals(h.events.value.at(-1), { value: ["5", "", "", ""], valueAsString: "5" }, "and is reported once");
  h.dispose();
});

Deno.test("Given a controlled value that completes the pin / When the host writes it / Then the completion edge fires", () => {
  const h = mount({ value: ["1"] });
  h.write("value", ["1", "2", "3", "4"]);
  assertEquals(h.api.complete, true, "the pin is complete");
  assertEquals(h.events.complete, [{ value: ["1", "2", "3", "4"], valueAsString: "1234" }], "value-complete reports the edge");
  h.dispose();
});

// ---- the cell count -------------------------------------------------------

Deno.test("Given a pin / When the host changes the count / Then the cells follow", () => {
  const h = mount({ count: 4, defaultValue: ["1", "2"] });
  h.write("count", 6);
  assertEquals(h.api.count, 6, "the count prop is the machine's");
  assertEquals(CELLS(h), [0, 1, 2, 3, 4, 5], "the items are the new cell indices");
  assertEquals(h.bag(5)["value"], "", "the new cells are empty");
  assertEquals(h.bag(0)["value"], "1", "and the old cells keep their characters");
  assertEquals(h.events.value, [], "a count change reports no value change");
  h.dispose();
});

Deno.test("Given a pin with two cells / When the markup iterates / Then the bags follow the shorter count", () => {
  const h = mount({ count: 2 });
  assertEquals(CELLS(h), [0, 1], "two cells render");
  assertEquals(h.bag(1)["enterKeyHint"], "done", "the last cell announces the done hint");
  h.dispose();
});

// ---- the DOM contract -----------------------------------------------------

Deno.test("Given a pin / When the parts are read / Then every part id is namespaced off the root", () => {
  const h = mount();
  const rootId = String(h.api.getRootProps()["id"]);
  assertEquals(rootId.startsWith("pin-input:"), true, "the root carries the namespaced id");
  assertEquals(String(h.bag(0)["id"]), `${rootId}:input:0`, "a cell's id is the root's, indexed");
  assertEquals(String(h.api.getLabelProps()["id"]), `${rootId}:label`, "the label is a part");
  assertEquals(String(h.api.getControlProps()["id"]), `${rootId}:control`, "the control is a part");
  assertEquals(String(h.api.getHiddenInputProps()["id"]), `${rootId}:hidden`, "the hidden input is a part");
  assertEquals(h.api.getLabelProps()["for"], `${rootId}:hidden`, "the label names the hidden input");
  h.dispose();
});

Deno.test("Given a fresh pin / When the cell bag is read / Then it carries the aria contract", () => {
  const h = mount();
  const bag = h.bag(0);
  assertEquals(bag["aria-label"], "pin code 1 of 4", "each cell is labelled by its position");
  assertEquals(bag["tabIndex"], 0, "the first cell is the one tab stop");
  assertEquals(h.bag(1)["tabIndex"], -1, "the others are not");
  assertEquals(bag["inputMode"], "numeric", "a numeric pin asks for the numeric keyboard");
  assertEquals(bag["type"], "tel", "and a numeric cell is a telephone field, which does not spin");
  assertEquals(bag["placeholder"], "\u25CB", "an unfocused empty cell shows the placeholder");
  assertEquals(bag["autoComplete"], "off", "no autofill unless the host asks for otp");
  assertEquals(bag["autoCapitalize"], "none", "and no capitalization");
  assertEquals(bag["aria-invalid"], undefined, "a valid pin announces nothing");
  assertEquals(bag["data-filled"], undefined, "an empty cell is not filled");
  h.dispose();
});

Deno.test("Given a filled pin / When the cell bag is read / Then the filled cell reports it", () => {
  const h = mount({ defaultValue: ["1"] });
  assertEquals(h.bag(0)["data-filled"], "", "the filled cell reports filled");
  assertEquals(h.bag(0)["value"], "1", "the bag carries the character");
  assertEquals(h.bag(1)["data-filled"], undefined, "an empty cell does not");
  h.dispose();
});

Deno.test("Given a masked pin / When the cell bag is read / Then the cells are password fields", () => {
  const h = mount({ mask: true });
  assertEquals(h.bag(0)["type"], "password", "a masked pin hides its characters");
  h.dispose();
});

Deno.test("Given an otp pin / When the cell bag is read / Then it asks the platform for the code", () => {
  const h = mount({ otp: true });
  assertEquals(h.bag(0)["inputMode"], "numeric", "an otp pin is numeric");
  assertEquals(h.bag(0)["autoComplete"], "one-time-code", "and the platform may fill it");
  h.dispose();
});

Deno.test("Given a named pin / When the hidden input bag is read / Then the form value rides it", () => {
  const h = mount({ defaultValue: ["1", "2"], name: "pin", form: "checkout", required: true });
  const bag = h.api.getHiddenInputProps();
  assertEquals(bag["name"], "pin", "the name crosses");
  assertEquals(bag["form"], "checkout", "and the form it belongs to");
  assertEquals(bag["required"], true, "the required flag crosses");
  assertEquals(bag["value"], "12", "the value is the joined pin");
  assertEquals(bag["hidden"], true, "and the input is hidden from view");
  assertEquals(bag["type"], "text", "as a text field");
  assertEquals(bag["tabIndex"], -1, "out of the tab order");
  assertEquals(bag["aria-hidden"], true, "and out of the a11y tree");
  h.dispose();
});

Deno.test("Given a disabled pin / When the cell bag is read / Then the cells announce disabled", () => {
  const h = mount({ disabled: true });
  assertEquals(h.bag(0)["disabled"], true, "the cell is disabled");
  assertEquals(h.bag(0)["data-disabled"], "", "and reports it for the utilities");
  assertEquals(h.api.getRootProps()["data-disabled"], "", "the root reports it too");
  h.dispose();
});

Deno.test("Given a read-only pin / When the parts are read / Then the state leaves on the root and the cells", () => {
  const h = mount({ readOnly: true });
  assertEquals(h.api.getRootProps()["data-readonly"], "", "the root reports read-only");
  assertEquals(h.bag(0)["readOnly"], true, "the cells are read-only");
  h.dispose();
});

Deno.test("Given an invalid pin / When the parts are read / Then every part reports it", () => {
  const h = mount({ invalid: true });
  assertEquals(h.api.getRootProps()["data-invalid"], "", "the root reports invalid");
  assertEquals(h.api.getLabelProps()["data-invalid"], "", "the label does too");
  assertEquals(h.bag(0)["data-invalid"], "", "and each cell");
  assertEquals(h.bag(0)["aria-invalid"], true, "the cells announce it");
  h.dispose();
});

Deno.test("Given a complete pin / When the parts are read / Then every part reports completion", () => {
  const h = mount({ defaultValue: ["1", "2", "3", "4"] });
  assertEquals(h.api.getRootProps()["data-complete"], "", "the root reports complete");
  assertEquals(h.api.getLabelProps()["data-complete"], "", "the label does too");
  assertEquals(h.bag(0)["data-complete"], "", "and each cell");
  h.dispose();
});

// ---- host props the grammar cannot declare --------------------------------

Deno.test("Given a host sanitizeValue / When a paste lands / Then the transform runs before validation", () => {
  const h = mount({ type: "alphabetic" });
  const root = h.root as unknown as Record<string, unknown>;
  root["sanitizeValue"] = (value: string): string => value.toUpperCase();
  h.focusIn(0);
  h.pasteIn(0, "ab");
  assertEquals(CHARS(h), ["A", "B", "", ""], "the paste was sanitized, then distributed");
  h.dispose();
});

Deno.test("Given host translations / When a cell bag is read / Then the overridden label wins", () => {
  const h = mount();
  const root = h.root as unknown as Record<string, unknown>;
  root["translations"] = { inputLabel: (index: number, length: number): string => `digit ${index} of ${length}` };
  assertEquals(h.bag(1)["aria-label"], "digit 1 of 4", "the host's label replaces the default");
  h.dispose();
});

// ---- inertness ------------------------------------------------------------

Deno.test("Given a disabled pin / When a keystroke arrives / Then nothing moves", () => {
  const h = mount({ disabled: true, defaultValue: ["1"] });
  h.focusIn(0);
  h.typeIn(0, "5");
  h.pasteIn(0, "67");
  assertEquals(CHARS(h), ["1", "", "", ""], "the value is untouched");
  h.dispose();
});

Deno.test("Given a read-only pin / When a keystroke arrives / Then the value is untouched but focus still walks", () => {
  const h = mount({ readOnly: true, defaultValue: ["1", "2"] });
  h.focusIn(0);
  h.typeIn(1, "7");
  assertEquals(CHARS(h), ["1", "2", "", ""], "a read-only pin does not take characters");
  h.press(1, "ArrowRight");
  assertEquals(h.focused().at(-1), 1, "and the arrows still walk the cells");
  h.dispose();
});

// ---- the mount reflexes ---------------------------------------------------

Deno.test("Given autoFocus / When the pin mounts / Then the index parks on the first cell", () => {
  const h = mount({ autoFocus: true });
  assertEquals(h.bag(0)["placeholder"], "", "the first cell is the parked index");
  assertEquals(h.bag(1)["placeholder"], "\u25CB", "the others keep their placeholder");
  h.dispose();
});

Deno.test("Given autoFocus / When the fragment is inserted / Then the first cell takes focus", async () => {
  const h = mount({ autoFocus: true });
  await Promise.resolve();
  assertEquals(h.focused(), [0], "the view focused the first cell");
  assertEquals(h.state(), "focused", "and the machine followed the focus");
  h.dispose();
});

Deno.test("Given a pin / When the label is pressed / Then the first cell takes focus", () => {
  const h = mount();
  assertEquals(h.pressLabel(), true, "the label's own activation is cancelled");
  assertEquals(h.state(), "focused", "and the first cell is focused");
  h.dispose();
});

Deno.test("Given a pin / When the focus command runs / Then the first cell takes focus", () => {
  const h = mount({ defaultValue: ["1"] });
  h.api.focus();
  assertEquals(h.focused().at(-1), 0, "the first cell is focused");
  assertEquals(h.state(), "focused", "and the machine followed");
  h.dispose();
});
