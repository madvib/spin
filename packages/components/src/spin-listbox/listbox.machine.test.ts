import { assertEquals } from "@std/assert";
import { parseHTML } from "@spin/runtime/testing";
import { signal } from "@spin/runtime";
import { createListboxFsmBridge } from "./listbox.bridge.ts";
import type { ListboxHighlightChange, ListboxSelect, ListboxValueChange } from "./listbox.bridge.ts";
import type { ListboxBlock, ListboxFsmApi, ListboxRow } from "./listbox.connect.ts";

/** A live writable read, as the element's prop store exposes one. */
type WriteSignal = { (): unknown; (value: unknown): void };

const win = parseHTML("<!doctype html><html><body></body></html>") as unknown as Record<string, unknown>;
declare const globalThis: Record<string, unknown>;
globalThis.document = win.document;
globalThis.CustomEvent = win.CustomEvent;
globalThis.HTMLElement = win.HTMLElement;
globalThis.Element = win.Element;

/**
 * Prop bags hand back `Record<string, unknown>`, so a handler read out of one is
 * checked here and typed once, instead of an unchecked cast at every call site.
 */
function handler<H>(bag: Record<string, unknown>, key: string): H {
  const value: unknown = bag[key];
  if (typeof value !== "function") throw new Error(`no handler at ${key}`);
  return value as H;
}

/**
 * linkedom ships no KeyboardEvent/MouseEvent/PointerEvent constructors, so the
 * events the handlers need are synthesized here — one place, with the minimal
 * field set each handler reads.
 */
function keydown(
  key: string,
  modifiers: Readonly<{ shift?: boolean; meta?: boolean; ctrl?: boolean }> = {},
): KeyboardEvent {
  const made: Record<string, unknown> = {
    key,
    shiftKey: modifiers.shift === true,
    metaKey: modifiers.meta === true,
    ctrlKey: modifiers.ctrl === true,
    altKey: false,
    defaultPrevented: false,
  };
  made["preventDefault"] = (): void => {
    made["defaultPrevented"] = true;
  };
  return made as unknown as KeyboardEvent;
}

const pointer = (pointerType: string): PointerEvent => ({ pointerType }) as PointerEvent;

const click = (
  modifiers: Readonly<{ shift?: boolean; meta?: boolean; ctrl?: boolean }> = {},
): MouseEvent => ({ shiftKey: modifiers.shift === true, metaKey: modifiers.meta === true, ctrlKey: modifiers.ctrl === true, defaultPrevented: false }) as unknown as MouseEvent;

/** Items as the host writes them, so the bridge's normalization is under test. */
const FRUIT_ITEMS = [
  { value: "apple", label: "Apple" },
  { value: "banana", label: "Banana" },
  { value: "cherry", label: "Cherry", disabled: true },
  { value: "date", label: "Date" },
];

const GROUPED_ITEMS = [
  { value: "apple", label: "Apple", group: "Pome" },
  { value: "pear", label: "Pear", group: "Pome" },
  { value: "walnut", label: "Walnut", group: "Nut" },
];

const PREFIXED_ITEMS = [
  { value: "react", label: "React" },
  { value: "react-native", label: "React Native" },
  { value: "red", label: "Red" },
];

const GRID_ITEMS = [1, 2, 3, 4, 5, 6, 7].map((n) => ({ value: `v${n}`, label: `Value ${n}` }));

interface Harness {
  readonly api: ListboxFsmApi;
  readonly root: Element;
  readonly events: {
    readonly valueChange: ListboxValueChange[];
    readonly highlightChange: ListboxHighlightChange[];
    readonly select: ListboxSelect[];
  };
  row(value: string): ListboxRow;
  blocks(): readonly ListboxBlock[];
  /** The content bag's keydown handler, the keyboard contract's entry point. */
  press(key: string, modifiers?: Readonly<{ shift?: boolean; meta?: boolean; ctrl?: boolean }>): void;
  clickRow(value: string, modifiers?: Readonly<{ shift?: boolean; meta?: boolean; ctrl?: boolean }>): void;
  hoverRow(value: string, pointerType?: string): void;
  focusContent(): void;
  blurContent(): void;
  state(): unknown;
  write(name: string, value: unknown): void;
}

/** Props are signals, exactly as the element's prop store makes them, so a host
 * write re-runs the bridge's controlled-channel effect. A prop passed in
 * `overrides` is AUTHORED, which is the element's `@@authored` predicate. */
function mount(
  items: readonly Record<string, unknown>[],
  overrides: Readonly<Record<string, unknown>> = {},
): Harness {
  const root = document.createElement("div");
  document.body.appendChild(root);
  const events = {
    valueChange: [] as ListboxValueChange[],
    highlightChange: [] as ListboxHighlightChange[],
    select: [] as ListboxSelect[],
  };
  const values: Record<string, WriteSignal> = {};
  const authoredKeys = new Set(Object.keys(overrides));
  const write = (name: string, value: unknown): void => {
    const source = values[name];
    if (source === undefined) values[name] = signal<unknown>(value);
    else source(value);
  };
  write("items", items);
  for (const [name, value] of Object.entries(overrides)) write(name, value);
  write("onValueChange", (change: ListboxValueChange) => events.valueChange.push(change));
  write("onHighlightChange", (change: ListboxHighlightChange) => events.highlightChange.push(change));
  write("onSelect", (change: ListboxSelect) => events.select.push(change));
  const bridge = createListboxFsmBridge(
    () => {
      const record: Record<string, unknown> = {};
      for (const [name, source] of Object.entries(values)) record[name] = source();
      record["@@authored"] = (name: string): boolean => authoredKeys.has(name);
      return record;
    },
    () => root,
    "listbox",
  );
  const find = (value: string): ListboxRow => {
    const found = bridge.api.getBlocks()
      .flatMap((block) => bridge.api.getRows(block))
      .find((row) => row.value === value);
    if (found === undefined) throw new Error(`no row ${value}`);
    return found;
  };
  return {
    api: bridge.api,
    root,
    events,
    row: find,
    blocks: () => bridge.api.getBlocks(),
    press: (key, modifiers) => {
      const event = keydown(key, modifiers);
      handler<(event: KeyboardEvent) => void>(bridge.api.getContentProps(), "onKeydown")(event);
    },
    clickRow: (value, modifiers) => {
      handler<(event: MouseEvent) => void>(bridge.api.getItemProps(find(value)), "onClick")(click(modifiers));
    },
    hoverRow: (value, pointerType = "mouse") => {
      handler<(event: PointerEvent) => void>(bridge.api.getItemProps(find(value)), "onPointerMove")(pointer(pointerType));
    },
    focusContent: () => handler<() => void>(bridge.api.getContentProps(), "onFocus")(),
    blurContent: () => handler<() => void>(bridge.api.getContentProps(), "onBlur")(),
    state: () => bridge.api.focused,
    write,
  };
}

const ALL_VALUES = (h: Harness): readonly string[] =>
  h.blocks().flatMap((block) => h.api.getRows(block)).map((row) => row.value);

const HIGHLIGHTED = (h: Harness): string | null => h.api.highlightedValue;

const SELECTED = (h: Harness): readonly string[] => h.api.value;

Deno.test("Given a fresh listbox / When nothing is authored / Then idle is the reachable start state", () => {
  const h = mount(FRUIT_ITEMS);
  assertEquals(h.api.getRootProps()["id"], "listbox:listbox", "the root carries the namespaced id");
  assertEquals(h.api.disabled, false, "the api reports enabled");
  assertEquals(h.api.hasSelectedItems, false, "nothing is selected at the start");
  assertEquals(h.api.empty, false, "rows exist");
  assertEquals(h.api.focused, false, "the content does not hold focus");
  assertEquals(SELECTED(h), [], "the selection is empty");
  assertEquals(HIGHLIGHTED(h), null, "nothing is highlighted");
});

// ---- the two states -------------------------------------------------------
//
// `idle` is the start; `focused` is the content holding DOM focus, which is
// the only thing the machine transitions on. Both are reachable, and the
// events that work everywhere (the root tier) are exercised from both.

Deno.test("Given defaultValue and defaultHighlightedValue / When the listbox mounts / Then the seed is the start state", () => {
  const h = mount(FRUIT_ITEMS, { defaultValue: "date", defaultHighlightedValue: "banana" });
  assertEquals(SELECTED(h), ["date"], "defaultValue seeds the selection");
  assertEquals(HIGHLIGHTED(h), "banana", "defaultHighlightedValue seeds the highlight");
  assertEquals(h.api.hasSelectedItems, true, "the api reports a selection");
  assertEquals(h.events.valueChange, [], "seeding reports nothing");
});

Deno.test("Given a fresh listbox / When the content takes focus / Then the focused state is reachable", () => {
  const h = mount(FRUIT_ITEMS);
  h.focusContent();
  assertEquals(h.state(), true, "the api reports the content focused");
  assertEquals(h.api.getContentProps()["aria-activedescendant"], "listbox:listbox:item:apple", "the active descendant follows the highlight");
  assertEquals(h.api.getContentProps()["data-activedescendant"], "listbox:listbox:item:apple", "the data mirror follows the highlight");
});

Deno.test("Given a focused content with a highlighted value / When it blurs / Then the idle state is reachable again", () => {
  const h = mount(FRUIT_ITEMS, { defaultHighlightedValue: "banana", defaultValue: "banana" });
  h.focusContent();
  h.blurContent();
  assertEquals(h.state(), false, "the blur returns to idle");
  // Zag's CONTENT.BLUR clears focus but never the highlight.
  assertEquals(HIGHLIGHTED(h), "banana", "the blur keeps the highlight");
  assertEquals(SELECTED(h), ["banana"], "the blur keeps the selection");
});

Deno.test("Given a focused content / When a highlight arrives / Then the roving descendant moves without a focus event", () => {
  const h = mount(FRUIT_ITEMS);
  h.focusContent();
  h.hoverRow("date");
  assertEquals(HIGHLIGHTED(h), "date", "the pointer moves the highlight");
  assertEquals(h.api.getContentProps()["aria-activedescendant"], "listbox:listbox:item:date", "the active descendant is the new highlight");
});

// ---- HIGHLIGHTED_VALUE.SET ------------------------------------------------

Deno.test("Given a listbox / When the highlight is set to a value / Then the api reports it and reports the change", () => {
  const h = mount(FRUIT_ITEMS);
  h.api.highlightValue("cherry");
  assertEquals(HIGHLIGHTED(h), "cherry", "the highlight moves to the value");
  assertEquals(h.events.highlightChange, [{ highlightedValue: "cherry", highlightedIndex: 2 }], "highlight-change reports the move");
});

Deno.test("Given a listbox / When the highlight is set to the same value / Then nothing moves and nothing reports", () => {
  const h = mount(FRUIT_ITEMS, { defaultHighlightedValue: "apple" });
  h.api.highlightValue("apple");
  assertEquals(HIGHLIGHTED(h), "apple", "the highlight stays");
  assertEquals(h.events.highlightChange, [], "no change is reported");
});

Deno.test("Given a highlighted listbox / When the highlight is cleared / Then it reports null and index -1", () => {
  const h = mount(FRUIT_ITEMS, { defaultHighlightedValue: "apple" });
  h.api.clearHighlightedValue();
  assertEquals(HIGHLIGHTED(h), null, "the highlight is cleared");
  assertEquals(h.events.highlightChange, [{ highlightedValue: null, highlightedIndex: -1 }], "highlight-change reports the clear");
});

Deno.test("Given an empty collection / When the highlight is set / Then it still holds the value", () => {
  const h = mount([]);
  h.api.highlightValue("anything");
  assertEquals(HIGHLIGHTED(h), "anything", "the highlight holds what the host asked for");
});

// ---- ITEM.SELECT / ITEM.CLEAR --------------------------------------------

Deno.test("Given a single listbox / When a value is selected / Then it replaces the selection", () => {
  const h = mount(FRUIT_ITEMS, { defaultValue: "apple" });
  h.api.selectValue("banana");
  assertEquals(SELECTED(h), ["banana"], "single selection replaces");
  assertEquals(h.events.valueChange, [{ value: ["banana"], items: [h.row("banana")] }], "value-change reports the new value and its item");
  assertEquals(h.events.select, [{ value: "banana" }], "select fires once for the added value");
});

Deno.test("Given a multiple listbox / When a value is selected twice / Then it toggles on and off", () => {
  const h = mount(FRUIT_ITEMS, { selectionMode: "multiple" });
  h.api.selectValue("apple");
  h.api.selectValue("date");
  assertEquals(SELECTED(h), ["apple", "date"], "multiple selection accumulates in click order");
  h.api.selectValue("apple");
  assertEquals(SELECTED(h), ["date"], "a second pick removes the value");
  assertEquals(h.events.select, [{ value: "apple" }, { value: "date" }], "only additions report select");
  assertEquals(h.events.valueChange, [
    { value: ["apple"], items: [h.row("apple")] },
    { value: ["apple", "date"], items: [h.row("apple"), h.row("date")] },
    { value: ["date"], items: [h.row("date")] },
  ], "each move reports value-change");
});

Deno.test("Given an extended listbox / When a value is selected / Then it replaces unless meta is held", () => {
  const h = mount(FRUIT_ITEMS, { selectionMode: "extended", defaultValue: "apple" });
  h.clickRow("date");
  assertEquals(SELECTED(h), ["date"], "a plain pick replaces the selection");
  h.clickRow("banana", { meta: true });
  assertEquals(SELECTED(h), ["date", "banana"], "a meta pick toggles");
});

Deno.test("Given a single selection / When the same item is clicked / Then it clears because it is deselectable", () => {
  const h = mount(FRUIT_ITEMS, { defaultValue: "apple" });
  h.clickRow("apple");
  assertEquals(SELECTED(h), [], "the pick clears the selection");
});

Deno.test("Given a single selection with deselectable false / When the same item is clicked / Then it stays selected", () => {
  const h = mount(FRUIT_ITEMS, { defaultValue: "apple", deselectable: false });
  h.clickRow("apple");
  assertEquals(SELECTED(h), ["apple"], "the pick keeps the selection");
});

Deno.test("Given a multiple selection / When Escape arrives / Then it clears and reports", () => {
  const h = mount(FRUIT_ITEMS, { selectionMode: "multiple", defaultValue: "apple" });
  h.press("Escape");
  assertEquals(SELECTED(h), [], "Escape clears the selection");
  assertEquals(h.events.valueChange.at(-1), { value: [], items: [] }, "value-change reports the clear");
});

Deno.test("Given an empty selection / When Escape arrives / Then nothing moves", () => {
  const h = mount(FRUIT_ITEMS);
  h.press("Escape");
  assertEquals(SELECTED(h), [], "the selection stays empty");
});

Deno.test("Given a value selected / When clearValue runs without an argument / Then the whole selection clears", () => {
  const h = mount(FRUIT_ITEMS, { selectionMode: "multiple", defaultValue: "apple,date" });
  h.api.clearValue();
  assertEquals(SELECTED(h), [], "everything is cleared");
});

Deno.test("Given multiple values selected / When clearValue runs with a value / Then only that value clears", () => {
  const h = mount(FRUIT_ITEMS, { selectionMode: "multiple", defaultValue: "apple,date" });
  h.api.clearValue("apple");
  assertEquals(SELECTED(h), ["date"], "only the named value clears");
});

// ---- VALUE.SET / VALUE.CLEAR ---------------------------------------------

Deno.test("Given a listbox / When setValue runs / Then the selection is exactly what was set", () => {
  const h = mount(FRUIT_ITEMS);
  h.api.setValue(["date", "banana"]);
  assertEquals(SELECTED(h), ["date", "banana"], "the array is assigned verbatim, in the host's order");
  assertEquals(h.events.valueChange.at(-1), { value: ["date", "banana"], items: [h.row("date"), h.row("banana")] }, "value-change carries the new value and its items");
});

Deno.test("Given a single listbox / When setValue runs with several values / Then Zag keeps them all", () => {
  const h = mount(FRUIT_ITEMS, { defaultValue: "apple" });
  h.api.setValue(["date", "banana"]);
  assertEquals(SELECTED(h), ["date", "banana"], "VALUE.SET is not mode-aware, matching Zag's setSelectedItems");
});

Deno.test("Given a multiple listbox / When selectAll runs / Then every enabled value is selected", () => {
  const h = mount(FRUIT_ITEMS, { selectionMode: "multiple" });
  h.api.selectAll();
  assertEquals(SELECTED(h), ["apple", "banana", "date"], "the disabled row is not selectable");
});

Deno.test("Given a listbox / When ctrl+a arrives / Then select all runs only in a multi mode", () => {
  const h = mount(FRUIT_ITEMS, { selectionMode: "multiple" });
  h.press("a", { ctrl: true });
  assertEquals(SELECTED(h), ["apple", "banana", "date"], "ctrl+a selects all enabled values");
  const single = mount(FRUIT_ITEMS);
  single.press("a", { ctrl: true });
  assertEquals(SELECTED(single), [], "a single-mode listbox ignores ctrl+a");
});

Deno.test("Given a multiple listbox with disallowSelectAll / When ctrl+a arrives / Then the selection is untouched", () => {
  const h = mount(FRUIT_ITEMS, { selectionMode: "multiple", disallowSelectAll: true });
  h.press("a", { ctrl: true });
  assertEquals(SELECTED(h), [], "disallowSelectAll refuses the select-all key");
});

// ---- the keyboard map -----------------------------------------------------
//
// The view owns navigation: it computes the target and sends an event. Every
// expectation below is the highlight (and, with selectOnHighlight or a shift
// range, the selection) the keyboard is documented to produce.

Deno.test("Given a focused content / When ArrowDown arrives / Then the highlight walks the enabled rows", () => {
  const h = mount(FRUIT_ITEMS);
  h.focusContent();
  assertEquals(HIGHLIGHTED(h), "apple", "the focus adopts the first value");
  h.press("ArrowDown");
  assertEquals(HIGHLIGHTED(h), "banana", "ArrowDown moves to the next enabled value");
  // cherry is disabled, so the walk skips over it.
  h.press("ArrowDown");
  assertEquals(HIGHLIGHTED(h), "date", "a disabled value is skipped");
});

Deno.test("Given a focused content / When ArrowUp arrives / Then the highlight walks back", () => {
  const h = mount(FRUIT_ITEMS, { defaultHighlightedValue: "date" });
  h.focusContent();
  h.press("ArrowUp");
  assertEquals(HIGHLIGHTED(h), "banana", "ArrowUp moves to the previous enabled value");
});

Deno.test("Given a highlight with no loop / When the arrows run past the edges / Then the highlight clamps", () => {
  const h = mount(FRUIT_ITEMS, { defaultHighlightedValue: "apple" });
  h.focusContent();
  h.press("ArrowUp");
  assertEquals(HIGHLIGHTED(h), "apple", "the first value has nothing above it");
  h.api.highlightValue("date");
  h.press("ArrowDown");
  assertEquals(HIGHLIGHTED(h), "date", "the last value has nothing below it");
});

Deno.test("Given loopFocus / When the arrows run past the edges / Then the highlight wraps", () => {
  const h = mount(FRUIT_ITEMS, { loopFocus: true, defaultHighlightedValue: "date" });
  h.focusContent();
  h.press("ArrowDown");
  assertEquals(HIGHLIGHTED(h), "apple", "the wrap starts again at the first enabled value");
  h.press("ArrowUp");
  assertEquals(HIGHLIGHTED(h), "date", "the wrap ends at the last enabled value");
});

Deno.test("Given a highlight on a disabled value / When an arrow arrives / Then the walk starts from that position", () => {
  const h = mount(FRUIT_ITEMS, { defaultHighlightedValue: "cherry" });
  h.focusContent();
  h.press("ArrowDown");
  assertEquals(HIGHLIGHTED(h), "date", "the walk moves on from the disabled value");
  h.press("ArrowUp");
  assertEquals(HIGHLIGHTED(h), "banana", "and back the other way");
});

Deno.test("Given a vertical list / When Left and Right arrive / Then they are not navigation", () => {
  const h = mount(FRUIT_ITEMS, { defaultHighlightedValue: "banana" });
  h.focusContent();
  h.press("ArrowLeft");
  assertEquals(HIGHLIGHTED(h), "banana", "ArrowLeft does not move the highlight");
  h.press("ArrowRight");
  assertEquals(HIGHLIGHTED(h), "banana", "ArrowRight does not move the highlight");
});

Deno.test("Given a horizontal list / When Left and Right arrive / Then they walk the values", () => {
  const h = mount(FRUIT_ITEMS, { orientation: "horizontal", defaultHighlightedValue: "banana" });
  h.focusContent();
  h.press("ArrowLeft");
  assertEquals(HIGHLIGHTED(h), "apple", "ArrowLeft walks the previous value");
  h.press("ArrowRight");
  assertEquals(HIGHLIGHTED(h), "banana", "ArrowRight walks the next value");
});

Deno.test("Given a focused content / When Home and End arrive / Then the highlight jumps to the extremes", () => {
  const h = mount(FRUIT_ITEMS, { defaultHighlightedValue: "banana" });
  h.focusContent();
  h.press("End");
  assertEquals(HIGHLIGHTED(h), "date", "End takes the last value, disabled or not");
  h.press("Home");
  assertEquals(HIGHLIGHTED(h), "apple", "Home takes the first value, disabled or not");
});

Deno.test("Given selectOnHighlight / When an arrow moves the highlight / Then the selection follows", () => {
  const h = mount(FRUIT_ITEMS, { selectOnHighlight: true });
  h.focusContent();
  h.press("ArrowDown");
  assertEquals(HIGHLIGHTED(h), "banana", "the highlight moved once from the adopted first value");
  assertEquals(SELECTED(h), ["banana"], "the selection is replaced by the highlight");
  assertEquals(h.events.select.at(-1), { value: "banana" }, "select fires for the added value");
});

Deno.test("Given a multiple listbox / When Shift arrows extend / Then the range from the anchor is selected", () => {
  const h = mount(FRUIT_ITEMS, { selectionMode: "multiple", defaultValue: "apple", defaultHighlightedValue: "apple" });
  h.focusContent();
  assertEquals(HIGHLIGHTED(h), "apple", "the focus keeps the existing highlight");
  h.press("ArrowDown", { shift: true });
  assertEquals(HIGHLIGHTED(h), "banana", "the highlight moved to banana");
  assertEquals(SELECTED(h), ["apple", "banana"], "the range anchor..target is selected");
});

Deno.test("Given an extended listbox / When a shift click arrives / Then the range from the anchor is selected", () => {
  const h = mount(FRUIT_ITEMS, { selectionMode: "extended", defaultValue: "apple" });
  h.api.highlightValue("apple");
  h.clickRow("date", { shift: true });
  // Zag's canSelect never refuses for these modes, so the range crosses the
  // disabled cherry exactly as the collection order says.
  assertEquals(SELECTED(h), ["apple", "banana", "cherry", "date"], "the whole value range is selected");
  assertEquals(HIGHLIGHTED(h), "date", "the click moves the highlight to the clicked row");
});

Deno.test("Given a single listbox / When a shift click arrives / Then it replaces the selection", () => {
  const h = mount(FRUIT_ITEMS, { defaultValue: "apple" });
  h.clickRow("date", { shift: true });
  assertEquals(SELECTED(h), ["date"], "single mode replaces rather than extends");
});

Deno.test("Given a multiple listbox / When a meta click arrives / Then the value toggles without replacing", () => {
  const h = mount(FRUIT_ITEMS, { selectionMode: "multiple", defaultValue: "apple" });
  h.clickRow("date", { meta: true });
  assertEquals(SELECTED(h), ["apple", "date"], "the meta click adds to the selection");
});

Deno.test("Given a highlighted value / When Enter arrives / Then it selects", () => {
  const h = mount(FRUIT_ITEMS, { defaultHighlightedValue: "date" });
  h.focusContent();
  h.press("Enter");
  assertEquals(SELECTED(h), ["date"], "Enter selects the highlight");
});

Deno.test("Given a highlighted value / When Space arrives / Then it selects", () => {
  const h = mount(FRUIT_ITEMS, { defaultHighlightedValue: "date" });
  h.focusContent();
  h.press(" ");
  assertEquals(SELECTED(h), ["date"], "Space activates like Enter");
  h.clickRow("apple");
  assertEquals(SELECTED(h), ["apple"], "the click replaced the selection");
});

Deno.test("Given no highlight / When Enter or Space arrives / Then nothing is selected", () => {
  const h = mount(FRUIT_ITEMS);
  h.focusContent();
  h.api.clearHighlightedValue();
  h.press("Enter");
  h.press(" ");
  assertEquals(SELECTED(h), [], "an empty highlight activates nothing");
});

// ---- ITEM.CLICK from the pointer -----------------------------------------

Deno.test("Given a row / When it is clicked / Then it selects and moves the highlight", () => {
  const h = mount(FRUIT_ITEMS);
  h.clickRow("banana");
  assertEquals(HIGHLIGHTED(h), "banana", "the highlight follows the click's anchor");
  assertEquals(SELECTED(h), ["banana"], "the click selects");
});

Deno.test("Given a disabled row / When it is clicked / Then nothing is selected", () => {
  const h = mount(FRUIT_ITEMS);
  h.clickRow("cherry");
  assertEquals(SELECTED(h), [], "the disabled row ignores the click");
});

Deno.test("Given a disabled listbox / When a row is clicked / Then nothing is selected", () => {
  const h = mount(FRUIT_ITEMS, { disabled: true });
  h.clickRow("banana");
  assertEquals(SELECTED(h), [], "a disabled listbox ignores its rows");
});

Deno.test("Given a disabled listbox / When a key arrives on the content / Then it is ignored", () => {
  const h = mount(FRUIT_ITEMS, { disabled: true, defaultHighlightedValue: "apple" });
  h.focusContent();
  h.press("ArrowDown");
  assertEquals(HIGHLIGHTED(h), "apple", "the highlight does not move");
  h.press("Enter");
  assertEquals(SELECTED(h), [], "nothing selects");
});

Deno.test("Given a row / When the pointer moves over it / Then the highlight follows a mouse pointer", () => {
  const h = mount(FRUIT_ITEMS);
  h.hoverRow("apple");
  assertEquals(HIGHLIGHTED(h), "apple", "the pointer highlight moves");
});

Deno.test("Given a highlighted row / When the pointer leaves it / Then the highlight is cleared", () => {
  const h = mount(FRUIT_ITEMS, { defaultHighlightedValue: "banana" });
  handler<() => void>(h.api.getItemProps(h.row("banana")), "onPointerLeave")();
  assertEquals(HIGHLIGHTED(h), null, "the leave clears the highlight");
});

Deno.test("Given a highlighted row / When the pointer moves over it again / Then the highlight stays", () => {
  const h = mount(FRUIT_ITEMS, { defaultHighlightedValue: "apple" });
  h.hoverRow("apple");
  assertEquals(HIGHLIGHTED(h), "apple", "the highlight is already there");
});

Deno.test("Given highlightOnHover false / When the pointer moves over a row / Then the highlight does not follow", () => {
  const h = mount(FRUIT_ITEMS, { highlightOnHover: false });
  h.hoverRow("apple");
  assertEquals(HIGHLIGHTED(h), null, "the pointer does not highlight");
});

Deno.test("Given a touch pointer / When it moves over a row / Then the highlight does not follow", () => {
  const h = mount(FRUIT_ITEMS);
  h.hoverRow("apple", "touch");
  assertEquals(HIGHLIGHTED(h), null, "only a mouse pointer highlights");
});

// ---- typeahead ------------------------------------------------------------
//
// The buffer accumulates for 500ms, a run of one repeated character counts
// once, and the search starts AFTER the current highlight and wraps — so a
// key pressed on an item whose label starts with it moves to the NEXT such
// label rather than sitting still.

Deno.test("Given a listbox / When a printable key arrives / Then the highlight jumps to the matching label", () => {
  const h = mount(FRUIT_ITEMS);
  h.focusContent();
  h.press("b");
  assertEquals(HIGHLIGHTED(h), "banana", "b finds Banana");
});

Deno.test("Given a highlighted item / When its own first letter arrives / Then the highlight moves to the next match", () => {
  const h = mount(PREFIXED_ITEMS, { defaultHighlightedValue: "react" });
  h.focusContent();
  h.press("r");
  assertEquals(HIGHLIGHTED(h), "react-native", "the search starts after the current value");
  h.press("r");
  assertEquals(HIGHLIGHTED(h), "red", "and again, wrapping past the collection");
});

Deno.test("Given an open typeahead buffer / When two letters arrive / Then the match uses the whole buffer", () => {
  const h = mount(PREFIXED_ITEMS);
  h.focusContent();
  h.press("r");
  h.press("e");
  assertEquals(HIGHLIGHTED(h), "red", "re matches Red before React");
});

Deno.test("Given a disabled listbox / When a printable key arrives / Then the highlight does not move", () => {
  const h = mount(FRUIT_ITEMS, { disabled: true, defaultHighlightedValue: "apple" });
  h.focusContent();
  h.press("b");
  assertEquals(HIGHLIGHTED(h), "apple", "a disabled listbox ignores the keyboard");
});

Deno.test("Given typeahead false / When a printable key arrives / Then the highlight does not move", () => {
  const h = mount(FRUIT_ITEMS, { typeahead: false, defaultHighlightedValue: "apple" });
  h.focusContent();
  h.press("b");
  assertEquals(HIGHLIGHTED(h), "apple", "the prop turns typeahead off");
  h.press(" ");
  assertEquals(SELECTED(h), ["apple"], "space still activates the highlight, like Enter");
});

Deno.test("Given a live typeahead buffer / When Space arrives / Then it keeps searching instead of activating", () => {
  const h = mount(FRUIT_ITEMS);
  h.focusContent();
  h.press("b");
  assertEquals(HIGHLIGHTED(h), "banana", "b found Banana");
  h.press(" ");
  assertEquals(HIGHLIGHTED(h), "banana", "the space is part of the buffer and finds no other Banana");
  assertEquals(SELECTED(h), [], "nothing was activated");
});

// ---- the grid -------------------------------------------------------------
//
// `columnCount` turns the collection into a grid: one group of rows, the
// column count as a custom property, and the vertical axis walking a column
// down the rows. The keyboard map is otherwise identical.

Deno.test("Given a grid / When the blocks are read / Then the collection is one group and the column count is a class", () => {
  const h = mount(GRID_ITEMS, { columnCount: 3 });
  assertEquals(h.blocks().length, 1, "a grid renders as a single group of rows");
  assertEquals(h.api.getContentProps()["data-layout"], "grid", "the content reports the grid layout");
  const group = h.api.getItemGroupProps(h.blocks()[0]!);
  assertEquals(group["data-columns-3"], "", "the group carries the column count as a presence attribute");
  assertEquals(group["data-columns-2"], undefined, "and not the other counts");
  assertEquals(h.api.layout, "grid", "the api reports the grid layout");
});

Deno.test("Given a list / When the group props are read / Then no column count attribute is carried", () => {
  const h = mount(FRUIT_ITEMS);
  const group = h.api.getItemGroupProps(h.blocks()[0]!);
  assertEquals(group["data-columns-1"], undefined, "a list is one column by default");
  assertEquals(group["data-columns-3"], undefined, "and carries no grid count");
});

Deno.test("Given a grid / When ArrowDown and ArrowUp arrive / Then the highlight walks the column", () => {
  const h = mount(GRID_ITEMS, { columnCount: 3, defaultHighlightedValue: "v2" });
  h.focusContent();
  h.press("ArrowDown");
  assertEquals(HIGHLIGHTED(h), "v5", "the same column, one row down");
  h.press("ArrowUp");
  assertEquals(HIGHLIGHTED(h), "v2", "and back up");
});

Deno.test("Given a grid / When Left and Right arrive / Then the highlight walks the row order", () => {
  const h = mount(GRID_ITEMS, { columnCount: 3, defaultHighlightedValue: "v2" });
  h.focusContent();
  h.press("ArrowLeft");
  assertEquals(HIGHLIGHTED(h), "v1", "Left walks the previous value");
  h.press("ArrowRight");
  assertEquals(HIGHLIGHTED(h), "v2", "Right walks the next value");
});

Deno.test("Given a grid with a short final row / When the column runs past it / Then the row's last value stands in", () => {
  const h = mount(GRID_ITEMS, { columnCount: 3, defaultHighlightedValue: "v3" });
  h.focusContent();
  h.press("ArrowDown");
  assertEquals(HIGHLIGHTED(h), "v6", "the same column down");
  h.press("ArrowDown");
  // v6 is the last cell of row 2; the cell below it in column 3 does not
  // exist, so the short row's last value stands in.
  assertEquals(HIGHLIGHTED(h), "v7", "the short final row's last value stands in");
});

Deno.test("Given a list / When the blocks are read / Then the groups are the host's group field", () => {
  const h = mount(GROUPED_ITEMS);
  assertEquals(h.blocks().length, 2, "two groups render");
  assertEquals(h.blocks()[0]?.label, "Pome", "the first group is named");
  assertEquals(h.api.getRows(h.blocks()[0]!).map((row) => row.value), ["apple", "pear"], "and holds its rows");
  assertEquals(h.blocks()[1]?.label, "Nut", "the second group is named");
  assertEquals(h.api.getContentProps()["data-layout"], "list", "the content reports the list layout");
});

Deno.test("Given items with no group field / When the blocks are read / Then one unlabelled group renders", () => {
  const h = mount(FRUIT_ITEMS);
  assertEquals(h.blocks().length, 1, "one group renders");
  assertEquals(h.blocks()[0]?.label, null, "and it carries no label");
  assertEquals(h.api.getItemGroupLabelProps(h.blocks()[0]!)["hidden"], true, "so its label is hidden");
});

Deno.test("Given an empty collection / When the props are read / Then the empty state is exposed", () => {
  const h = mount([]);
  assertEquals(h.api.empty, true, "the api reports empty");
  assertEquals(h.api.getContentProps()["data-empty"], "", "the content carries the empty flag");
  assertEquals(h.api.getEmptyStateProps()["hidden"], false, "the notice is shown");
  assertEquals(h.api.valueAsString, "", "the value text is blank");
});

Deno.test("Given a collection / When the props are read / Then the empty state is hidden", () => {
  const h = mount(FRUIT_ITEMS);
  assertEquals(h.api.getEmptyStateProps()["hidden"], true, "the notice is hidden while rows exist");
});

Deno.test("Given a selection / When the value text is read / Then it is the labels joined by a comma", () => {
  const h = mount(FRUIT_ITEMS, { selectionMode: "multiple", defaultValue: "date,apple" });
  assertEquals(h.api.valueAsString, "Date, Apple", "the labels are joined in the selection's order");
});

// ---- the controlled channel ----------------------------------------------
//
// A prop is authored when the HOST wrote it; a coerced default never is. The
// bridge's effect reads the live prop signals, so a write moves the machine
// without an event.

Deno.test("Given an authored value / When the host writes it / Then the machine follows without an event", () => {
  const h = mount(FRUIT_ITEMS, { value: "apple" });
  assertEquals(SELECTED(h), ["apple"], "the authored value is imposed at mount");
  h.write("value", "banana,date");
  assertEquals(SELECTED(h), ["banana", "date"], "the write moves the machine");
  assertEquals(h.events.valueChange.at(-1), { value: ["banana", "date"], items: [h.row("banana"), h.row("date")] }, "and reports the move");
});

Deno.test("Given an authored value / When the machine itself moves / Then the next host write still wins", () => {
  const h = mount(FRUIT_ITEMS, { value: "apple" });
  h.clickRow("date");
  assertEquals(SELECTED(h), ["date"], "the click moves the machine");
  h.write("value", "banana");
  assertEquals(SELECTED(h), ["banana"], "the host write re-imposes the authored value");
});

Deno.test("Given a default value / When the host never writes it / Then the machine keeps its own moves", () => {
  const h = mount(FRUIT_ITEMS, { defaultValue: "apple" });
  h.clickRow("date");
  assertEquals(SELECTED(h), ["date"], "the click moves the machine");
  h.write("defaultValue", "banana");
  assertEquals(SELECTED(h), ["date"], "a default is not a controlled value");
});

Deno.test("Given an authored highlightedValue / When the host writes it / Then the highlight follows", () => {
  const h = mount(FRUIT_ITEMS, { highlightedValue: "apple" });
  assertEquals(HIGHLIGHTED(h), "apple", "the authored highlight is imposed at mount");
  h.write("highlightedValue", "date");
  assertEquals(HIGHLIGHTED(h), "date", "the write moves the highlight");
  h.write("highlightedValue", "");
  assertEquals(HIGHLIGHTED(h), null, "an empty string clears it");
});

Deno.test("Given items that change / When a highlighted value disappears / Then the highlight is dropped", () => {
  const h = mount([{ value: "apple", label: "Apple" }, { value: "banana", label: "Banana" }], {
    defaultHighlightedValue: "banana",
  });
  h.write("items", [{ value: "apple", label: "Apple" }]);
  assertEquals(HIGHLIGHTED(h), null, "the vanished item cannot stay highlighted");
  assertEquals(h.events.highlightChange.at(-1), { highlightedValue: null, highlightedIndex: -1 }, "and the clear is reported");
});

Deno.test("Given items that change / When the machine's order is stale / Then selection still works", () => {
  const h = mount([{ value: "apple", label: "Apple" }], { selectionMode: "multiple" });
  h.write("items", [{ value: "apple", label: "Apple" }, { value: "pear", label: "Pear" }]);
  h.api.selectValue("pear");
  assertEquals(SELECTED(h), ["pear"], "the machine reads the new collection order");
});

// ---- the aria contract ----------------------------------------------------

Deno.test("Given a multi-mode listbox / When the content props are read / Then the aria contract holds", () => {
  const h = mount(FRUIT_ITEMS, { selectionMode: "multiple", defaultHighlightedValue: "banana" });
  const content = h.api.getContentProps();
  assertEquals(content["role"], "listbox", "the content is a listbox");
  assertEquals(content["aria-multiselectable"], true, "a multi mode announces multiselectable");
  assertEquals(content["aria-activedescendant"], "listbox:listbox:item:banana", "the active descendant is the highlight");
  assertEquals(content["tabindex"], 0, "the content is one tab stop");
  const label = h.api.getLabelProps();
  assertEquals(content["aria-labelledby"], label["id"], "the content is labelled by the label part");
});

Deno.test("Given a single-mode listbox / When the content props are read / Then aria-multiselectable is absent", () => {
  const h = mount(FRUIT_ITEMS);
  assertEquals(h.api.getContentProps()["aria-multiselectable"], undefined, "a single mode does not announce it");
});

Deno.test("Given an item / When its props are read / Then the option semantics follow the state", () => {
  const h = mount(FRUIT_ITEMS, { defaultValue: "banana" });
  const selected = h.api.getItemProps(h.row("banana"));
  assertEquals(selected["role"], "option", "the row is an option");
  assertEquals(selected["aria-selected"], true, "the selected row announces it");
  assertEquals(selected["data-selected"], "", "and carries the data flag");
  assertEquals(selected["data-state"], "checked", "and the checked state");
  assertEquals(selected["id"], "listbox:listbox:item:banana", "the id is the namespaced item id");
  const disabled = h.api.getItemProps(h.row("cherry"));
  assertEquals(disabled["aria-disabled"], true, "the disabled row announces it");
  assertEquals(disabled["data-disabled"], "", "and carries the data flag");
  const plain = h.api.getItemProps(h.row("apple"));
  assertEquals(plain["aria-selected"], false, "an unselected row announces false, not absent");
  assertEquals(plain["data-state"], "unchecked", "and carries the unchecked state");
});

Deno.test("Given a highlighted and focused listbox / When the item props are read / Then the row reports the focus", () => {
  const h = mount(FRUIT_ITEMS, { defaultHighlightedValue: "apple" });
  assertEquals(h.api.getItemProps(h.row("apple"))["data-focused"], undefined, "an unfocused highlight is not focused");
  h.focusContent();
  assertEquals(h.api.getItemProps(h.row("apple"))["data-focused"], "", "the focused highlight reports it");
  assertEquals(h.api.getItemProps(h.row("banana"))["data-focused"], undefined, "another row does not");
});

Deno.test("Given a group / When its props are read / Then the group semantics hold", () => {
  const h = mount(GROUPED_ITEMS);
  const block = h.blocks()[0]!;
  const group = h.api.getItemGroupProps(block);
  assertEquals(group["role"], "group", "the block is a group");
  const label = h.api.getItemGroupLabelProps(block);
  assertEquals(group["aria-labelledby"], label["id"], "the group is labelled by its label part");
  assertEquals(label["role"], "presentation", "the label is presentational");
});

Deno.test("Given a disabled listbox / When the props are read / Then every part reports it", () => {
  const h = mount(FRUIT_ITEMS, { disabled: true });
  assertEquals(h.api.getRootProps()["data-disabled"], "", "the root reports it");
  assertEquals(h.api.getLabelProps()["data-disabled"], "", "the label reports it");
  assertEquals(h.api.getValueTextProps()["data-disabled"], "", "the value text reports it");
  assertEquals(h.api.getContentProps()["data-disabled"], "", "the content reports it");
  assertEquals(h.api.getItemGroupProps(h.blocks()[0]!)["data-disabled"], "", "the group reports it");
  assertEquals(h.api.disabled, true, "the api reports it");
});

Deno.test("Given a vertical listbox / When the props are read / Then the orientation is reported", () => {
  const h = mount(FRUIT_ITEMS);
  assertEquals(h.api.getRootProps()["data-orientation"], "vertical", "the root reports the orientation");
  assertEquals(h.api.getContentProps()["data-orientation"], "vertical", "so does the content");
  const horizontal = mount(FRUIT_ITEMS, { orientation: "horizontal" });
  assertEquals(horizontal.api.getRootProps()["data-orientation"], "horizontal", "and the horizontal orientation");
});

Deno.test("Given a row / When its indicator props are read / Then the mark follows the selection", () => {
  const h = mount(FRUIT_ITEMS, { defaultValue: "apple" });
  assertEquals(h.api.getItemIndicatorProps(h.row("apple"))["data-state"], "checked", "the selected row's mark is checked");
  assertEquals(h.api.getItemIndicatorProps(h.row("apple"))["hidden"], false, "and shown");
  assertEquals(h.api.getItemIndicatorProps(h.row("date"))["data-state"], "unchecked", "the other row's mark is unchecked");
  assertEquals(h.api.getItemIndicatorProps(h.row("date"))["hidden"], true, "and hidden");
  assertEquals(h.api.getItemIndicatorProps(h.row("apple"))["aria-hidden"], true, "the mark is decorative");
});

Deno.test("Given items the host sent without labels / When the rows are read / Then the value is the label", () => {
  const h = mount([{ value: "apple" }, { value: "banana", label: "" }]);
  assertEquals(h.row("apple").label, "apple", "a missing label falls back to the value");
  assertEquals(h.row("banana").label, "banana", "an empty label falls back too");
  assertEquals(h.row("apple").disabled, false, "a missing disabled field reads false");
});

Deno.test("Given items without a value / When the rows are read / Then they are dropped", () => {
  const h = mount([{ value: "apple", label: "Apple" }, { label: "no value" }, { value: "", label: "blank" }]);
  assertEquals(ALL_VALUES(h), ["apple"], "an entry without a usable value renders no row");
});

Deno.test("Given the row data / When the machine's order is read / Then it is the collection order", () => {
  const h = mount(FRUIT_ITEMS);
  assertEquals(h.api.value, [], "nothing is selected");
  h.clickRow("date");
  assertEquals(h.api.value, ["date"], "the api reports the selection");
});

// ---- stability across moves ----------------------------------------------
//
// The api proxy hands out one connect for the element's whole life, and its
// bags are cached against the context fields they read. A binding reads the
// api on every machine move, so a fresh bag (or a fresh row) per read has the
// `for` directive replace the row nodes on each move — detaching them from
// any gesture in flight.

Deno.test("Given an open listbox / When the highlight moves / Then the rows are the same object across reads", () => {
  const h = mount(FRUIT_ITEMS);
  const before = ALL_VALUES(h).map((value) => h.row(value));
  h.focusContent();
  h.press("ArrowDown");
  const after = ALL_VALUES(h).map((value) => h.row(value));
  assertEquals(after[0] === before[0], true, "the first row keeps its identity");
  assertEquals(after[1] === before[1], true, "so does the second");
});

Deno.test("Given an open listbox / When the highlight moves / Then the row handlers keep their identity", () => {
  const h = mount(FRUIT_ITEMS);
  const before = handler<(event: MouseEvent) => void>(h.api.getItemProps(h.row("banana")), "onClick");
  h.focusContent();
  h.press("ArrowDown");
  const after = handler<(event: MouseEvent) => void>(h.api.getItemProps(h.row("banana")), "onClick");
  assertEquals(after, before, "the click handler is the same function");
});

Deno.test("Given an open listbox / When nothing moves / Then re-reading the bags returns the same objects", () => {
  const h = mount(FRUIT_ITEMS, { defaultValue: "apple" });
  assertEquals(h.api.getItemProps(h.row("apple")), h.api.getItemProps(h.row("apple")), "the item bag is stable");
  assertEquals(h.api.getContentProps(), h.api.getContentProps(), "the content bag is stable");
  assertEquals(h.api.getRootProps(), h.api.getRootProps(), "the root bag is stable");
  assertEquals(
    h.api.getBlocks()[0],
    h.api.getBlocks()[0],
    "the block is stable",
  );
});

Deno.test("Given an open listbox / When the highlight moves / Then the item bag is rebuilt with the new fields", () => {
  const h = mount(FRUIT_ITEMS);
  const before = h.api.getItemProps(h.row("banana"));
  assertEquals(before["data-highlighted"], undefined, "banana starts unhighlighted");
  h.focusContent();
  h.press("ArrowDown");
  const after = h.api.getItemProps(h.row("banana"));
  assertEquals(after["data-highlighted"], "", "and reports the highlight");
  assertEquals(after === before, false, "the bag was rebuilt for the new state");
});

Deno.test("Given an open listbox / When the selection moves / Then the item bag follows", () => {
  const h = mount(FRUIT_ITEMS);
  h.clickRow("date");
  assertEquals(h.api.getItemProps(h.row("date"))["aria-selected"], true, "the clicked row is selected");
  assertEquals(h.api.getItemProps(h.row("apple"))["aria-selected"], false, "the other row is not");
});

Deno.test("Given a listbox whose items change / When the bags are read again / Then they follow the new rows", () => {
  const h = mount([{ value: "apple", label: "Apple" }]);
  const before = h.api.getItemProps(h.row("apple"));
  h.write("items", [{ value: "pear", label: "Pear" }]);
  assertEquals(ALL_VALUES(h), ["pear"], "the new collection renders");
  const after = h.api.getItemProps(h.row("pear"));
  assertEquals(after["data-value"], "pear", "the new row carries its value");
  assertEquals(after === before, false, "and is a different object");
});

Deno.test("Given a listbox / When the root id is handed an already-namespaced one / Then the parts are not double-prefixed", () => {
  const root = document.createElement("div");
  document.body.appendChild(root);
  const values: Record<string, { (): unknown; (v: unknown): void }> = {};
  const write = (n: string, v: unknown): void => {
    const s = values[n];
    if (s === undefined) values[n] = signal<unknown>(v);
    else s(v);
  };
  write("items", FRUIT_ITEMS);
  const bridge = createListboxFsmBridge(
    () => {
      const record: Record<string, unknown> = {};
      for (const [n, s] of Object.entries(values)) record[n] = s();
      return record;
    },
    () => root,
    "listbox:outer:item:1",
  );
  assertEquals(
    bridge.api.getContentProps()["id"],
    "listbox:outer:item:1:content",
    "an already-namespaced id is used verbatim",
  );
  bridge.api.highlightValue("apple");
  assertEquals(
    bridge.api.getContentProps()["aria-activedescendant"],
    "listbox:outer:item:1:item:apple",
    "and the item id follows it",
  );
});

// ---- the imperative surface ----------------------------------------------
//
// Zag's api methods, declared in the def's `commands`. Each is a send: the
// view decides which value the host's words resolve to before it sends it.

Deno.test("Given a listbox / When the highlight commands run / Then the highlight jumps to the collection's extremes", () => {
  const h = mount(FRUIT_ITEMS);
  h.api.highlightLast();
  assertEquals(HIGHLIGHTED(h), "date", "highlightLast takes the last value");
  h.api.highlightFirst();
  assertEquals(HIGHLIGHTED(h), "apple", "highlightFirst takes the first");
  h.api.highlightNext();
  assertEquals(HIGHLIGHTED(h), "banana", "highlightNext steps forward");
  h.api.highlightPrevious();
  assertEquals(HIGHLIGHTED(h), "apple", "highlightPrevious steps back");
});

Deno.test("Given a disabled row on the way / When highlightNext runs / Then the walk skips it", () => {
  const h = mount(FRUIT_ITEMS, { defaultHighlightedValue: "banana" });
  h.api.highlightNext();
  assertEquals(HIGHLIGHTED(h), "date", "the disabled cherry is skipped");
});

Deno.test("Given an empty collection / When the highlight commands run / Then nothing moves", () => {
  const h = mount([]);
  h.api.highlightFirst();
  h.api.highlightLast();
  h.api.highlightNext();
  h.api.highlightPrevious();
  assertEquals(HIGHLIGHTED(h), null, "there is nothing to highlight");
});

Deno.test("Given a listbox / When selectValue names a value the collection lacks / Then Zag still selects it", () => {
  const h = mount(FRUIT_ITEMS);
  h.api.selectValue("nope");
  // Zag's ITEM.SELECT has no collection guard (unlike ITEM.CLICK), so the
  // value is taken as given; it simply resolves to no item.
  assertEquals(SELECTED(h), ["nope"], "the selection is what the host asked for");
  assertEquals(h.events.valueChange.at(-1), { value: ["nope"], items: [] }, "and it resolves to no item");
});

Deno.test("Given a listbox / When a disabled row's handler is pressed / Then nothing moves", () => {
  const h = mount(FRUIT_ITEMS, { defaultHighlightedValue: "apple" });
  h.hoverRow("cherry");
  assertEquals(HIGHLIGHTED(h), "apple", "a disabled row does not take the pointer highlight");
});

Deno.test("Given a multiple selection / When values are added one at a time / Then select reports each addition in order", () => {
  const h = mount(FRUIT_ITEMS, { selectionMode: "multiple" });
  h.api.selectValue("date");
  h.api.selectValue("banana");
  h.api.selectValue("date");
  assertEquals(h.events.select, [{ value: "date" }, { value: "banana" }], "only the additions report, in addition order");
});
