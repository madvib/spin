import { test } from "bun:test";
import { deepStrictEqual } from "node:assert/strict";
import { parseHTML } from "@spin/runtime/testing";
import { signal } from "@spin/runtime";
import { dateInput } from "./date-input.presentation.ts";
const createDateInputBridge = dateInput.createBridge;
import type { DateInputValueChange } from "./date-input.presentation.ts";
import type { DateInputApi } from "./date-input.presentation.ts";

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
 * place, with the minimal field set each handler reads.
 */
const keydown = (key: string): KeyboardEvent => {
  const made: Record<string, unknown> = {
    key,
    shiftKey: false,
    ctrlKey: false,
    altKey: false,
    metaKey: false,
    isComposing: false,
    keyCode: 0,
    defaultPrevented: false,
  };
  made["preventDefault"] = (): void => {
    made["defaultPrevented"] = true;
  };
  return made as unknown as KeyboardEvent;
};

const beforeInput = (data: string): InputEvent =>
  ({ data, preventDefault: (): void => undefined }) as unknown as InputEvent;

const clipboard = (text: string): ClipboardEvent =>
  ({
    preventDefault: (): void => undefined,
    clipboardData: { getData: (): string => text },
  }) as unknown as ClipboardEvent;

interface Harness {
  readonly api: DateInputApi;
  readonly changes: DateInputValueChange[];
  readonly props: Record<string, WriteSignal>;
  dispose(): void;
}

/** A bridge over a writable prop store, with value-change collected. */
function harness(initial: Record<string, unknown> = {}): Harness {
  const root = document.createElement("div");
  document.body.appendChild(root);
  const changes: DateInputValueChange[] = [];
  const store = new Map<string, WriteSignal>();
  const props = (): Record<string, unknown> => {
    const bag: Record<string, unknown> = {};
    for (const [name, cell] of store) bag[name] = cell();
    bag["@@authored"] = (name: string): boolean => store.has(name);
    bag["onValueChange"] = (change: DateInputValueChange): void => {
      changes.push(change);
    };
    return bag;
  };
  for (const [name, value] of Object.entries(initial)) {
    const cell = signal(value) as unknown as WriteSignal;
    store.set(name, cell);
  }
  const bridge = createDateInputBridge(props, () => root, "test");
  return {
    api: bridge.api,
    changes,
    props: Object.fromEntries(store) as Record<string, WriteSignal>,
    dispose: () => bridge.dispose(),
  };
}

/** The segment texts the view renders, in locale order. */
function texts(api: DateInputApi): string[] {
  return api.getSegments().filter((segment) => segment.field !== null).map((
    segment,
  ) => segment.text);
}

test("Given no value / When read / Then every segment shows its placeholder", () => {
  const h = harness();
  deepStrictEqual(
    texts(h.api),
    ["mm", "dd", "yyyy"],
    "month, day, year placeholders",
  );
  deepStrictEqual(h.api.valueAsString, "", "no string without a date");
  h.dispose();
});

test("Given a default ISO value / When started / Then the fields fill from it", () => {
  const h = harness({ defaultValue: "2024-02-29" });
  deepStrictEqual(
    texts(h.api),
    ["02", "29", "2024"],
    "the leap day fills month, day, year",
  );
  deepStrictEqual(h.api.valueAsString, "2024-02-29", "and the string round-trips");
  h.dispose();
});

test("Given focus on the month / When digits type / Then the segment fills and advances", () => {
  const h = harness();
  handler<() => void>(h.api.getSegmentProps(0), "onFocus")();
  handler<(e: InputEvent) => void>(h.api.getSegmentProps(0), "onBeforeInput")(
    beforeInput("1"),
  );
  deepStrictEqual(texts(h.api)[0], "01", "a partial digit shows padded");
  handler<(e: InputEvent) => void>(h.api.getSegmentProps(0), "onBeforeInput")(
    beforeInput("2"),
  );
  deepStrictEqual(texts(h.api)[0], "12", "the second digit completes the segment");
  h.dispose();
});

test("Given February 2024 / When the day exceeds the month / Then it clamps to the leap day", () => {
  const h = harness({ defaultValue: "2024-02-15" });
  // Month is segment 0, day is segment 1: focus the day and type 30.
  handler<() => void>(h.api.getSegmentProps(1), "onFocus")();
  handler<(e: InputEvent) => void>(h.api.getSegmentProps(1), "onBeforeInput")(
    beforeInput("3"),
  );
  handler<(e: InputEvent) => void>(h.api.getSegmentProps(1), "onBeforeInput")(
    beforeInput("0"),
  );
  deepStrictEqual(texts(h.api)[1], "29", "February 2024 holds 29 days, not 30");
  h.dispose();
});

test("Given a focused segment / When ArrowUp fires / Then the field cycles within its limits", () => {
  const h = harness({ defaultValue: "2024-12-15" });
  handler<() => void>(h.api.getSegmentProps(0), "onFocus")();
  handler<(e: KeyboardEvent) => void>(h.api.getSegmentProps(0), "onKeyDown")(
    keydown("ArrowUp"),
  );
  deepStrictEqual(texts(h.api)[0], "01", "December cycles to January");
  handler<(e: KeyboardEvent) => void>(h.api.getSegmentProps(0), "onKeyDown")(
    keydown("ArrowDown"),
  );
  deepStrictEqual(texts(h.api)[0], "12", "and back down to December");
  h.dispose();
});

test("Given a complete date / When the value moves / Then value-change reports the ISO string", () => {
  const h = harness({ defaultValue: "2024-01-15" });
  handler<() => void>(h.api.getSegmentProps(2), "onFocus")();
  handler<(e: KeyboardEvent) => void>(h.api.getSegmentProps(2), "onKeyDown")(
    keydown("ArrowUp"),
  );
  deepStrictEqual(h.changes.length, 1, "one change for the year move");
  deepStrictEqual(
    h.changes[0]?.valueAsString,
    "2025-01-15",
    "and the string names the new year",
  );
  h.dispose();
});

test("Given a pasted ISO date / When it parses / Then the value replaces wholesale", () => {
  const h = harness();
  handler<() => void>(h.api.getSegmentProps(0), "onFocus")();
  handler<(e: ClipboardEvent) => void>(h.api.getSegmentProps(0), "onPaste")(
    clipboard("2025-07-04"),
  );
  deepStrictEqual(h.api.valueAsString, "2025-07-04", "the pasted date lands");
  handler<(e: ClipboardEvent) => void>(h.api.getSegmentProps(0), "onPaste")(
    clipboard("not a date"),
  );
  deepStrictEqual(
    h.api.valueAsString,
    "2025-07-04",
    "an unparseable paste is refused",
  );
  h.dispose();
});

test("Given a min bound / When a paste lands below it / Then the value clamps to the bound", () => {
  const h = harness({ min: "2024-06-01" });
  handler<() => void>(h.api.getSegmentProps(0), "onFocus")();
  handler<(e: ClipboardEvent) => void>(h.api.getSegmentProps(0), "onPaste")(
    clipboard("2024-01-15"),
  );
  deepStrictEqual(h.api.valueAsString, "2024-06-01", "the floor holds");
  h.dispose();
});

test("Given an empty segment / When Backspace fires / Then focus steps to the previous segment", () => {
  const h = harness({ defaultValue: "2024-01-15" });
  handler<() => void>(h.api.getSegmentProps(1), "onFocus")();
  handler<(e: KeyboardEvent) => void>(h.api.getSegmentProps(1), "onKeyDown")(
    keydown("Backspace"),
  );
  // Day holds 15, so backspace clears it first; a second backspace steps back.
  deepStrictEqual(texts(h.api)[1], "dd", "the filled day clears first");
  handler<(e: KeyboardEvent) => void>(h.api.getSegmentProps(1), "onKeyDown")(
    keydown("Backspace"),
  );
  h.dispose();
});

test("Given an imperative setValue / When called / Then the fields fill without focus", () => {
  const h = harness();
  h.api.setValue({
    year: 2025,
    month: 7,
    day: 4,
    hour: 0,
    minute: 0,
    second: 0,
  });
  deepStrictEqual(
    texts(h.api),
    ["07", "04", "2025"],
    "the command writes every segment",
  );
  h.api.clearValue();
  deepStrictEqual(
    texts(h.api),
    ["mm", "dd", "yyyy"],
    "clear returns the placeholders",
  );
  deepStrictEqual(h.api.valueAsString, "", "and the string empties");
  h.dispose();
});

test("Given an authored value prop / When it changes / Then the machine alternates to it", () => {
  const h = harness({ value: "2024-03-10" });
  deepStrictEqual(h.api.valueAsString, "2024-03-10", "the authored seed lands");
  h.dispose();
});
