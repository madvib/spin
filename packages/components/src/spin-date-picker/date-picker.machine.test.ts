import { assertEquals } from "@std/assert";
import { parseHTML } from "@spin/runtime/testing";
import { signal } from "@spin/runtime";
import { createDatePickerBridge } from "./date-picker.bridge.ts";
import type { DatePickerApi } from "./date-picker.connect.ts";
import type { DatePickerValue } from "./date-picker.machine.ts";

const win = parseHTML("<!doctype html><html><body></body></html>") as unknown as Record<string, unknown>;
declare const globalThis: Record<string, unknown>;
globalThis.document = win.document;
globalThis.CustomEvent = win.CustomEvent;
globalThis.HTMLElement = win.HTMLElement;
globalThis.Element = win.Element;

type WriteSignal = { (): unknown; (value: unknown): void };

/** A bag read for one handler, checked and typed in one place. */
function handler<H>(bag: Record<string, unknown>, key: string): H {
  const value: unknown = bag[key];
  if (typeof value !== "function") throw new Error(`no handler at ${key}`);
  return value as H;
}

/** The keyboard events the handlers read, synthesized (linkedom ships none). */
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


interface Harness {
  readonly api: DatePickerApi;
  readonly changes: string[];
  readonly openChanges: boolean[];
  readonly props: Record<string, WriteSignal>;
  /** The day cells in the current grid, by ISO string. */
  readonly cells: Map<string, Record<string, unknown>>;
  dispose(): void;
}

function harness(initial: Record<string, unknown> = {}): Harness {
  const root = document.createElement("div");
  document.body.appendChild(root);
  const changes: string[] = [];
  const openChanges: boolean[] = [];
  const store = new Map<string, WriteSignal>();
  const props = (): Record<string, unknown> => {
    const bag: Record<string, unknown> = {};
    for (const [name, cell] of store) bag[name] = cell();
    bag["@@authored"] = (name: string): boolean => store.has(name);
    bag["onValueChange"] = (d: { valueAsString: readonly string[] }): void => {
      changes.push(d.valueAsString.join(","));
    };
    bag["onOpenChange"] = (d: { open: boolean }): void => {
      openChanges.push(d.open);
    };
    return bag;
  };
  for (const [name, value] of Object.entries(initial)) {
    store.set(name, signal(value) as unknown as WriteSignal);
  }
  const bridge = createDatePickerBridge(props, () => root, "test");
  return {
    api: bridge.api,
    changes,
    openChanges,
    props: Object.fromEntries(store) as Record<string, WriteSignal>,
    cells: null as unknown as Map<string, Record<string, unknown>>,
    dispose: () => bridge.dispose(),
  };
}

/** The trigger bag, read afresh — it is cached by the connect. */
const trigger = (h: Harness): Record<string, unknown> => h.api.getTriggerProps();
const cellBag = (h: Harness, day: string): Record<string, unknown> => {
  const hit = h.api.getCells().find((cell) => cellBagDay(cell) === day);
  if (hit === undefined) throw new Error(`no cell for ${day}`);
  return h.api.getCellProps(hit);
};
const cellBagDay = (cell: { value: DatePickerValue }): string =>
  `${`${cell.value.year}`.padStart(4, "0")}-${`${cell.value.month}`.padStart(2, "0")}-${`${cell.value.day}`.padStart(2, "0")}`;
const isoDay = (day: DatePickerValue): string =>
  `${`${day.year}`.padStart(4, "0")}-${`${day.month}`.padStart(2, "0")}-${`${day.day}`.padStart(2, "0")}`;

const strings = (api: DatePickerApi): string[] => [...api.valueAsString];

Deno.test("Given a default value / When started / Then the selection seeds and the trigger shows it", () => {
  const h = harness({ defaultValue: "[\"2024-02-15\"]" });
  assertEquals(strings(h.api), ["2024-02-15"], "the seed lands");
  assertEquals(h.api.getValueTextRows()[0]?.text, "Feb 15, 2024", "the trigger formats the day");
  h.dispose();
});

Deno.test("Given a closed panel / When the trigger clicks / Then it opens and reports", () => {
  const h = harness({ defaultValue: "[\"2024-02-15\"]" });
  handler<() => void>(trigger(h), "onClick")();
  assertEquals(h.api.isOpen, true, "the panel opens");
  assertEquals(h.openChanges, [true], "one open-change for the move");
  h.dispose();
});

Deno.test("Given an open single picker / When a day is clicked / Then it selects and closes", () => {
  const h = harness({ defaultValue: "[\"2024-02-15\"]" });
  handler<() => void>(trigger(h), "onClick")();
  handler<() => void>(cellBag(h, "2024-02-20"), "onClick")();
  assertEquals(strings(h.api), ["2024-02-20"], "the clicked day replaces the value");
  assertEquals(h.api.isOpen, false, "closeOnSelect closes the panel");
  assertEquals(h.changes, ["2024-02-20"], "one value-change with the ISO string");
  h.dispose();
});

Deno.test("Given an open range picker / When two days are clicked / Then the span selects, backwards included", () => {
  const h = harness({ defaultFocusedValue: "2024-02-01", selectionMode: "range" });
  handler<() => void>(trigger(h), "onClick")();
  handler<() => void>(cellBag(h, "2024-02-20"), "onClick")();
  assertEquals(strings(h.api), [], "the first click only arms the range");
  handler<() => void>(cellBag(h, "2024-02-14"), "onClick")();
  assertEquals(strings(h.api), ["2024-02-14", "2024-02-20"], "the earlier day sorts first");
  h.dispose();
});

Deno.test("Given an open range picker / When the pointer hovers after arming / Then the preview extends", () => {
  const h = harness({ defaultFocusedValue: "2024-02-01", selectionMode: "range" });
  handler<() => void>(trigger(h), "onClick")();
  handler<() => void>(cellBag(h, "2024-02-20"), "onClick")();
  handler<() => void>(cellBag(h, "2024-02-25"), "onPointerMove")();
  const mid = cellBag(h, "2024-02-23");
  assertEquals(mid["data-in-range"], "", "the hover preview covers the span");
  h.dispose();
});

Deno.test("Given an open multiple picker / When a day is clicked twice / Then it toggles in and out", () => {
  const h = harness({ defaultFocusedValue: "2024-02-01", selectionMode: "multiple" });
  handler<() => void>(trigger(h), "onClick")();
  handler<() => void>(cellBag(h, "2024-02-20"), "onClick")();
  handler<() => void>(cellBag(h, "2024-02-22"), "onClick")();
  assertEquals(strings(h.api), ["2024-02-20", "2024-02-22"], "both days select");
  handler<() => void>(cellBag(h, "2024-02-20"), "onClick")();
  assertEquals(strings(h.api), ["2024-02-22"], "the second click removes the day");
  h.dispose();
});

Deno.test("Given a focused day / When ArrowRight fires / Then focus moves one day and stays in month", () => {
  const h = harness({ defaultValue: "[\"2024-02-15\"]" });
  console.log("DBG isOpen:", h.api.isOpen, "focused:", JSON.stringify(h.api.focusedValue), "keys:", Object.keys(h.api).length);
  handler<() => void>(trigger(h), "onClick")();
  const day = cellBag(h, "2024-02-15");
  handler<(e: KeyboardEvent) => void>(day, "onKeyDown")(keydown("ArrowRight"));
  assertEquals(isoDay(h.api.focusedValue), "2024-02-16", "focus moved one day");
});

Deno.test("Given a focused day at a month start / When ArrowUp fires / Then focus crosses into the previous month", () => {
  const h = harness({ defaultValue: "[\"2024-03-01\"]" });
  handler<() => void>(trigger(h), "onClick")();
  const day = cellBag(h, "2024-03-01");
  handler<(e: KeyboardEvent) => void>(day, "onKeyDown")(keydown("ArrowUp"));
  assertEquals(isoDay(h.api.focusedValue), "2024-02-23", "a week back crosses the month edge");
});

Deno.test("Given the day view / When the view control clicks / Then it drills to months and back", () => {
  const h = harness({ defaultValue: "[\"2024-02-15\"]" });
  handler<() => void>(trigger(h), "onClick")();
  assertEquals(h.api.view, "day");
  handler<() => void>(h.api.getViewControlProps(), "onClick")();
  assertEquals(h.api.view, "month", "the view control climbs to months");
  handler<() => void>(h.api.getViewControlProps(), "onClick")();
  assertEquals(h.api.view, "year", "and to years");
  // A year cell click drills into that year's months.
  const yearCell = cellBag(h, "2026-01-01");
  handler<() => void>(yearCell, "onClick")();
  assertEquals(h.api.view, "month", "a year cell names its months");
  handler<() => void>(cellBag(h, "2026-06-01"), "onClick")();
  assertEquals(h.api.view, "day", "a month cell names its days");
  assertEquals(isoDay(h.api.focusedValue), "2026-06-01", "the focused day follows the drill");
});

Deno.test("Given a min bound / When a day before it is clicked / Then the click is refused", () => {
  const h = harness({ defaultFocusedValue: "2024-02-01", min: "2024-02-10" });
  handler<() => void>(trigger(h), "onClick")();
  const day = cellBag(h, "2024-02-05");
  assertEquals(day["aria-disabled"], true, "the cell reports itself disabled");
  handler<() => void>(day, "onClick")();
  assertEquals(strings(h.api), [], "the out-of-bounds click selects nothing");
  h.dispose();
});

Deno.test("Given a max bound / When arrows push past it / Then focus clamps to the bound", () => {
  const h = harness({ defaultValue: "[\"2024-02-28\"]", max: "2024-02-28" });
  handler<() => void>(trigger(h), "onClick")();
  const day = cellBag(h, "2024-02-28");
  handler<(e: KeyboardEvent) => void>(day, "onKeyDown")(keydown("ArrowRight"));
  assertEquals(isoDay(h.api.focusedValue), "2024-02-28", "focus cannot pass the max");
});

Deno.test("Given a leap February / When the grid builds / Then the 29th exists and the tail pads to weeks", () => {
  const h = harness({ defaultValue: "[\"2024-02-15\"]" });
  handler<() => void>(trigger(h), "onClick")();
  const days = h.api.getCells().filter((cell) => !cell.outside && cell.value.month === 2);
  assertEquals(days.length, 29, "February 2024 holds 29 days");
  assertEquals(h.api.getCells().length % 7, 0, "the grid is whole weeks");
});

Deno.test("Given an authored value prop / When it changes / Then the selection alternates", () => {
  const h = harness({ value: "[\"2024-01-10\"]" });
  assertEquals(strings(h.api), ["2024-01-10"], "the authored seed lands");
  const value = h.props["value"];
  if (value === undefined) throw new Error("no value cell");
  value("2024-03-20");
  assertEquals(strings(h.api), ["2024-03-20"], "the host's write alternates the machine");
});

Deno.test("Given an imperative setValue / When called / Then the selection replaces wholesale", () => {
  const h = harness({ value: "[\"2024-01-10\"]" });
  h.api.setValue([{ year: 2025, month: 7, day: 4 }]);
  assertEquals(strings(h.api), ["2025-07-04"], "setValue writes the selection");
  h.api.clear();
  assertEquals(strings(h.api), [], "clear empties it");
  h.dispose();
});

Deno.test("Given a closeOnSelect=false picker / When a day is clicked / Then the panel stays open", () => {
  const h = harness({ defaultFocusedValue: "2024-02-01", closeOnSelect: false });
  handler<() => void>(trigger(h), "onClick")();
  handler<() => void>(cellBag(h, "2024-02-20"), "onClick")();
  assertEquals(h.api.isOpen, true, "the picker stays open for the next pick");
  assertEquals(strings(h.api), ["2024-02-20"], "and the day selected");
  h.dispose();
});
