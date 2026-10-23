import { assertEquals } from "@std/assert";
import { parseHTML } from "@spin/runtime/testing";
import { signal } from "@spin/runtime";
import { combobox } from "./combobox.presentation.ts";
const createComboboxBridge = combobox.createBridge;
import type {
  ComboboxApi,
  ComboboxBlock,
  ComboboxHighlightChange,
  ComboboxInputValueChange,
  ComboboxOpenChange,
  ComboboxRow,
  ComboboxSelect,
  ComboboxValueChange,
} from "./combobox.presentation.ts";

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
  modifiers: Readonly<{ shift?: boolean; meta?: boolean; ctrl?: boolean; alt?: boolean }> = {},
): KeyboardEvent {
  const made: Record<string, unknown> = {
    key,
    shiftKey: modifiers.shift === true,
    metaKey: modifiers.meta === true,
    ctrlKey: modifiers.ctrl === true,
    altKey: modifiers.alt === true,
    defaultPrevented: false,
  };
  made["preventDefault"] = (): void => {
    made["defaultPrevented"] = true;
  };
  return made as unknown as KeyboardEvent;
}

const pointer = (pointerType: string): PointerEvent => ({ pointerType }) as PointerEvent;

const click = (
  modifiers: Readonly<{ shift?: boolean; meta?: boolean; ctrl?: boolean; alt?: boolean; button?: number }> = {},
): MouseEvent =>
  ({
    shiftKey: modifiers.shift === true,
    metaKey: modifiers.meta === true,
    ctrlKey: modifiers.ctrl === true,
    altKey: modifiers.alt === true,
    button: modifiers.button ?? 0,
    defaultPrevented: false,
  }) as unknown as MouseEvent;

/** What the input's change handler reads out of an input event. */
const typing = (text: string): InputEvent =>
  ({ currentTarget: { value: text } }) as unknown as InputEvent;

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

interface Harness {
  readonly api: ComboboxApi;
  readonly root: Element;
  readonly events: {
    readonly valueChange: ComboboxValueChange[];
    readonly highlightChange: ComboboxHighlightChange[];
    readonly inputValueChange: ComboboxInputValueChange[];
    readonly openChange: ComboboxOpenChange[];
    readonly select: ComboboxSelect[];
  };
  row(value: string): ComboboxRow;
  blocks(): readonly ComboboxBlock[];
  /** The machine's phase, as the recipe's state attribute reports it. */
  phase(): string;
  press(key: string, modifiers?: Readonly<{ shift?: boolean; meta?: boolean; ctrl?: boolean; alt?: boolean }>): void;
  type(text: string): void;
  clickRow(value: string, modifiers?: Readonly<{ shift?: boolean; meta?: boolean; ctrl?: boolean; alt?: boolean; button?: number }>): void;
  hoverRow(value: string, pointerType?: string): void;
  leaveRow(value: string): void;
  focusInput(): void;
  blurInput(): void;
  clickTrigger(): void;
  clickClearTrigger(): void;
  pressOutside(): void;
  pressEscape(): void;
  /** The input's keydown reported a keystroke the machine consumed. */
  prevented(): boolean;
  focused(): boolean;
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
    valueChange: [] as ComboboxValueChange[],
    highlightChange: [] as ComboboxHighlightChange[],
    inputValueChange: [] as ComboboxInputValueChange[],
    openChange: [] as ComboboxOpenChange[],
    select: [] as ComboboxSelect[],
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
  write("onValueChange", (change: ComboboxValueChange) => events.valueChange.push(change));
  write("onHighlightChange", (change: ComboboxHighlightChange) => events.highlightChange.push(change));
  write("onInputValueChange", (change: ComboboxInputValueChange) => events.inputValueChange.push(change));
  write("onOpenChange", (change: ComboboxOpenChange) => events.openChange.push(change));
  write("onSelect", (change: ComboboxSelect) => events.select.push(change));
  const bridge = createComboboxBridge(
    () => {
      const record: Record<string, unknown> = {};
      for (const [name, source] of Object.entries(values)) record[name] = source();
      record["@@authored"] = (name: string): boolean => authoredKeys.has(name);
      return record;
    },
    () => root,
    "frameworks",
  );
  const find = (value: string): ComboboxRow => {
    const found = bridge.api
      .getBlocks()
      .flatMap((block) => bridge.api.getRows(block))
      .find((row) => row.value === value);
    if (found === undefined) throw new Error(`no row ${value}`);
    return found;
  };
  const inputBag = (): Record<string, unknown> => bridge.api.getInputProps();
  let consumed = false;
  return {
    api: bridge.api,
    root,
    events,
    row: find,
    blocks: () => bridge.api.getBlocks(),
    phase: () => bridge.api.getRootProps()["data-phase"] as string,
    press: (key, modifiers) => {
      const event = keydown(key, modifiers);
      handler<(event: KeyboardEvent) => void>(inputBag(), "onKeydown")(event);
      consumed = event.defaultPrevented === true;
    },
    type: (text) => handler<(event: InputEvent) => void>(inputBag(), "onInput")(typing(text)),
    clickRow: (value, modifiers) => {
      handler<(event: MouseEvent) => void>(bridge.api.getItemProps(find(value)), "onClick")(
        click(modifiers),
      );
    },
    hoverRow: (value, pointerType = "mouse") => {
      handler<(event: PointerEvent) => void>(bridge.api.getItemProps(find(value)), "onPointerMove")(
        pointer(pointerType),
      );
    },
    leaveRow: (value) => {
      handler<() => void>(bridge.api.getItemProps(find(value)), "onPointerLeave")();
    },
    focusInput: () => handler<() => void>(inputBag(), "onFocus")(),
    blurInput: () => handler<() => void>(inputBag(), "onBlur")(),
    clickTrigger: () => handler<(event: MouseEvent) => void>(bridge.api.getTriggerProps(), "onClick")(
      click(),
    ),
    clickClearTrigger: () =>
      handler<(event: MouseEvent) => void>(bridge.api.getClearTriggerProps(), "onClick")(click()),
    pressOutside: () => handler<() => void>(bridge.api.getRootProps(), "use:dismissable" as never)(),
    pressEscape: () => handler<() => void>(bridge.api.getRootProps(), "use:dismissable" as never)(),
    prevented: () => consumed,
    focused: () => bridge.api.focused,
    write,
  };
}

const ALL_VALUES = (h: Harness): readonly string[] =>
  h.blocks().flatMap((block) => h.api.getRows(block)).map((row) => row.value);

const HIGHLIGHTED = (h: Harness): string | null => h.api.highlightedValue;

const SELECTED = (h: Harness): readonly string[] => h.api.value;

const INPUT_TEXT = (h: Harness): string => h.api.inputValue;

/** The layer's own callbacks, read out of the root bag the way the attach pass
 * hands them to the stdlib dismissable action. */
const layer = (h: Harness): { onEscape: () => void; onOutside: () => void } =>
  h.api.getRootProps()["use:dismissable"] as unknown as {
    onEscape: () => void;
    onOutside: () => void;
};

// ---- the start state ------------------------------------------------------

Deno.test("Given a fresh combobox / When nothing is authored / Then idle is the reachable start state", () => {
  const h = mount(FRUIT_ITEMS);
  assertEquals(h.phase(), "idle", "the machine starts unfocused and closed");
  assertEquals(h.api.open, false, "the api reports closed");
  assertEquals(h.api.focused, false, "and unfocused");
  assertEquals(h.api.getInputProps()["aria-expanded"], false, "the input agrees");
  assertEquals(SELECTED(h), [], "nothing is selected");
  assertEquals(INPUT_TEXT(h), "", "the field is empty");
  assertEquals(HIGHLIGHTED(h), null, "nothing is highlighted");
  assertEquals(h.api.getBlocks().length, 1, "the collection renders as one unlabelled group");
  assertEquals(h.api.empty, false, "rows exist");
  assertEquals(h.events.valueChange, [], "mounting reports nothing");
  assertEquals(h.events.openChange, [], "and no open change");
});

Deno.test("Given a seeded combobox / When it mounts / Then the defaults are the start state", () => {
  const h = mount(FRUIT_ITEMS, {
    defaultValue: "banana",
    defaultInputValue: "Ban",
    defaultHighlightedValue: "date",
  });
  assertEquals(SELECTED(h), ["banana"], "defaultValue seeds the selection");
  assertEquals(INPUT_TEXT(h), "Ban", "defaultInputValue seeds the field");
  assertEquals(HIGHLIGHTED(h), "date", "defaultHighlightedValue seeds the highlight");
  assertEquals(h.events.valueChange, [], "seeding reports nothing");
});

Deno.test("Given a single-mode combobox with a value and no text / When it mounts / Then the field holds the selection", () => {
  const h = mount(FRUIT_ITEMS, { defaultValue: "banana" });
  assertEquals(INPUT_TEXT(h), "Banana", "the default replace behaviour writes the value's string");
});

Deno.test("Given a multiple-mode combobox with a value and no text / When it mounts / Then the field stays empty", () => {
  const h = mount(FRUIT_ITEMS, { multiple: true, defaultValue: "banana,date" });
  assertEquals(INPUT_TEXT(h), "", "a multi field holds no text of its own");
});

Deno.test("Given a clear selectionBehaviour / When a single combobox mounts with a value / Then the field is empty", () => {
  const h = mount(FRUIT_ITEMS, { defaultValue: "banana", selectionBehavior: "clear" });
  assertEquals(INPUT_TEXT(h), "", "clear empties the field whatever the selection is");
});

Deno.test("Given defaultOpen / When the combobox mounts / Then suggesting is the reachable start state", () => {
  const h = mount(FRUIT_ITEMS, { defaultOpen: true });
  assertEquals(h.phase(), "suggesting", "the initial state opens into suggesting");
  assertEquals(h.api.open, true, "the api reports open");
  assertEquals(h.api.getInputProps()["aria-expanded"], true, "the input agrees");
});

Deno.test("Given an authored value / When the combobox mounts / Then the selection is imposed at mount", () => {
  const h = mount(FRUIT_ITEMS, { value: "date" });
  assertEquals(SELECTED(h), ["date"], "the authored value is imposed");
  assertEquals(INPUT_TEXT(h), "Date", "and the field's replace behaviour follows it");
  assertEquals(h.events.valueChange, [], "imposing the seeded value reports nothing");
});

// ---- idle -----------------------------------------------------------------

Deno.test("Given a closed unfocused combobox / When the input takes focus / Then focused is reachable", () => {
  const h = mount(FRUIT_ITEMS, { defaultHighlightedValue: "apple" });
  h.focusInput();
  assertEquals(h.phase(), "focused", "the focus arrives in the focused phase");
  assertEquals(h.focused(), true, "the api reports the field focused");
  assertEquals(HIGHLIGHTED(h), null, "the focused phase's entry clears the highlight");
});

Deno.test("Given a focused combobox / When the input blurs / Then idle is reachable again", () => {
  const h = mount(FRUIT_ITEMS);
  h.focusInput();
  h.blurInput();
  assertEquals(h.phase(), "idle", "the blur returns to idle");
  assertEquals(h.focused(), false, "and the api reports it");
});

Deno.test("Given a closed unfocused combobox / When the trigger is clicked / Then interacting is reachable", () => {
  const h = mount(FRUIT_ITEMS);
  h.clickTrigger();
  assertEquals(h.phase(), "interacting", "the trigger opens the panel");
  assertEquals(h.api.open, true, "the api reports open");
  assertEquals(HIGHLIGHTED(h), "apple", "and the first row is adopted");
  assertEquals(
    h.events.openChange,
    [{ open: true, reason: "trigger-click", value: [] }],
    "open-change reports the gesture's reason",
  );
});

Deno.test("Given a closed unfocused combobox with a selection / When the trigger is clicked / Then the selected row is adopted", () => {
  const h = mount(FRUIT_ITEMS, { defaultValue: "date" });
  h.clickTrigger();
  assertEquals(HIGHLIGHTED(h), "date", "the selection's first row, in collection order");
});

Deno.test("Given a closed unfocused combobox / When the input is clicked / Then interacting is reachable with the input-click reason", () => {
  const h = mount(FRUIT_ITEMS);
  handler<(event: MouseEvent) => void>(h.api.getInputProps(), "onClick")(click());
  assertEquals(h.phase(), "interacting", "the input click opens the panel");
  assertEquals(h.events.openChange.at(-1), { open: true, reason: "input-click", value: [] }, "and reports why");
});

Deno.test("Given a closed unfocused combobox / When Enter arrives / Then nothing moves", () => {
  const h = mount(FRUIT_ITEMS);
  h.press("Enter");
  assertEquals(h.phase(), "idle", "a closed unfocused field has no panel to act on");
  assertEquals(SELECTED(h), [], "and selects nothing");
});

Deno.test("Given openOnClick false / When the input is clicked / Then the panel stays closed", () => {
  const h = mount(FRUIT_ITEMS, { openOnClick: false });
  handler<(event: MouseEvent) => void>(h.api.getInputProps(), "onClick")(click());
  assertEquals(h.phase(), "idle", "the click is not a request to open");
});

// ---- focused --------------------------------------------------------------

Deno.test("Given a focused combobox / When text is typed / Then suggesting is reachable", () => {
  const h = mount(FRUIT_ITEMS);
  h.focusInput();
  h.type("ban");
  assertEquals(h.phase(), "suggesting", "typing opens the panel over the suggestion");
  assertEquals(h.api.open, true, "the api reports open");
  assertEquals(INPUT_TEXT(h), "ban", "the field holds what was typed");
  assertEquals(
    h.events.inputValueChange,
    [{ inputValue: "ban", reason: "input-change" }],
    "input-value-change reports the move and its reason",
  );
  assertEquals(
    h.events.openChange,
    [{ open: true, reason: "input-change", value: [] }],
    "open-change reports the input as the reason",
  );
});

Deno.test("Given openOnChange false / When text is typed / Then the panel stays closed", () => {
  const h = mount(FRUIT_ITEMS, { openOnChange: false });
  h.focusInput();
  h.type("ban");
  assertEquals(h.phase(), "focused", "the field takes the text without opening");
  assertEquals(INPUT_TEXT(h), "ban", "the text is the machine's");
});

Deno.test("Given the autohighlight behaviour / When text is typed / Then the first row is adopted", () => {
  const h = mount(FRUIT_ITEMS, { inputBehavior: "autohighlight" });
  h.focusInput();
  h.type("b");
  assertEquals(h.phase(), "suggesting", "the panel opens over the suggestion");
  assertEquals(HIGHLIGHTED(h), "apple", "the auto highlight adopts the first row");
});

Deno.test("Given the none behaviour / When text is typed / Then no row is adopted", () => {
  const h = mount(FRUIT_ITEMS);
  h.focusInput();
  h.type("b");
  assertEquals(HIGHLIGHTED(h), null, "the highlight stays empty");
});

Deno.test("Given a focused combobox with custom text / When Escape arrives / Then the text reverts to the selection", () => {
  const h = mount(FRUIT_ITEMS, { defaultValue: "banana" });
  h.api.setOpen(true);
  h.focusInput();
  h.type("zzz");
  h.press("Escape");
  assertEquals(INPUT_TEXT(h), "Banana", "the authored value's string comes back");
});

Deno.test("Given a focused combobox with a custom value allowed / When Escape arrives / Then the text is kept", () => {
  const h = mount(FRUIT_ITEMS, { allowCustomValue: true });
  h.api.setOpen(true);
  h.type("zzz");
  h.press("Escape");
  assertEquals(INPUT_TEXT(h), "zzz", "a permitted custom value is the user's");
});

Deno.test("Given a focused combobox / When the field blurs / Then idle is reachable and the text is kept", () => {
  const h = mount(FRUIT_ITEMS, { defaultValue: "banana", openOnChange: false });
  h.focusInput();
  h.type("zzz");
  assertEquals(h.phase(), "focused", "typing without opening stays put");
  h.blurInput();
  assertEquals(h.phase(), "idle", "losing the field closes the unfocused panel");
  assertEquals(INPUT_TEXT(h), "zzz", "and the focused phase never reverts the text");
});

Deno.test("Given a focused combobox / When ArrowDown arrives / Then interacting is reachable with the first row", () => {
  const h = mount(FRUIT_ITEMS);
  h.focusInput();
  h.press("ArrowDown");
  assertEquals(h.phase(), "interacting", "the arrow opens the panel and hands control over");
  assertEquals(HIGHLIGHTED(h), "apple", "the first row is adopted");
});

Deno.test("Given a focused combobox with a selection / When ArrowUp arrives / Then the selection's first row is adopted", () => {
  const h = mount(FRUIT_ITEMS, { defaultValue: "date" });
  h.focusInput();
  h.press("ArrowUp");
  assertEquals(HIGHLIGHTED(h), "date", "the selection answers before the collection's last row");
});

Deno.test("Given a focused multiple combobox with a selection / When ArrowUp arrives / Then the selection's first row is adopted", () => {
  const h = mount(FRUIT_ITEMS, { multiple: true, defaultValue: "date,apple" });
  h.focusInput();
  h.press("ArrowUp");
  assertEquals(HIGHLIGHTED(h), "apple", "the selection is sorted into collection order");
});

Deno.test("Given a focused combobox completing inline / When an arrow arrives / Then the panel opens with no highlight", () => {
  const h = mount(FRUIT_ITEMS, { inputBehavior: "autocomplete" });
  h.focusInput();
  h.press("ArrowDown");
  assertEquals(h.phase(), "interacting", "the panel opens");
  assertEquals(HIGHLIGHTED(h), null, "and the completion has adopted nothing yet");
});

// ---- interacting ----------------------------------------------------------

/** An open combobox the user is driving, reached the way a user reaches it. */
const driving = (
  h: Harness,
): void => {
  h.focusInput();
  h.press("ArrowDown");
};

Deno.test("Given an interacting combobox / When ArrowDown arrives / Then the highlight walks the enabled rows", () => {
  const h = mount(FRUIT_ITEMS);
  driving(h);
  assertEquals(HIGHLIGHTED(h), "apple", "the opening arrow adopts the first row");
  h.press("ArrowDown");
  assertEquals(HIGHLIGHTED(h), "banana", "ArrowDown walks to the next enabled row");
  // cherry is disabled, so the walk steps over it.
  h.press("ArrowDown");
  assertEquals(HIGHLIGHTED(h), "date", "a disabled row is skipped");
  h.press("ArrowDown");
  assertEquals(HIGHLIGHTED(h), "date", "the last row has nothing below it");
  h.press("ArrowUp");
  assertEquals(HIGHLIGHTED(h), "banana", "ArrowUp walks back");
});

Deno.test("Given loopFocus / When the arrows run past the edges / Then the highlight wraps", () => {
  const h = mount(FRUIT_ITEMS, { loopFocus: true });
  driving(h);
  h.press("ArrowDown");
  h.press("ArrowDown");
  h.press("ArrowDown");
  assertEquals(HIGHLIGHTED(h), "apple", "the wrap starts again at the first row");
  h.press("ArrowUp");
  assertEquals(HIGHLIGHTED(h), "date", "and ends at the last");
});

Deno.test("Given an interacting combobox / When Home and End arrive / Then the extremes are adopted, disabled or not", () => {
  const h = mount(FRUIT_ITEMS, { defaultHighlightedValue: "banana" });
  h.focusInput();
  h.press("ArrowDown");
  h.press("End");
  assertEquals(HIGHLIGHTED(h), "date", "End takes the last row");
  h.press("Home");
  assertEquals(HIGHLIGHTED(h), "apple", "Home takes the first");
});

Deno.test("Given an inline completion on the last row / When ArrowDown arrives / Then the completion is given back", () => {
  const h = mount(FRUIT_ITEMS, { inputBehavior: "autocomplete" });
  h.focusInput();
  h.press("ArrowDown");
  assertEquals(HIGHLIGHTED(h), null, "the opening arrow leaves the highlight alone");
  h.press("ArrowDown");
  assertEquals(HIGHLIGHTED(h), "apple", "the walk starts at the first row");
  h.press("ArrowDown");
  h.press("ArrowDown");
  assertEquals(HIGHLIGHTED(h), "date", "the walk reaches the last row");
  h.press("ArrowDown");
  assertEquals(HIGHLIGHTED(h), null, "and the next arrow clears the completion");
  assertEquals(h.phase(), "interacting", "the panel stays up");
});

Deno.test("Given an inline completion on the first row / When ArrowUp arrives / Then the completion is given back", () => {
  const h = mount(FRUIT_ITEMS, { inputBehavior: "autocomplete" });
  h.focusInput();
  h.press("ArrowDown");
  h.press("ArrowDown");
  assertEquals(HIGHLIGHTED(h), "apple", "the first row");
  h.press("ArrowUp");
  assertEquals(HIGHLIGHTED(h), null, "and the next arrow clears it");
});

Deno.test("Given an interacting combobox / When text is typed / Then suggesting is reachable", () => {
  const h = mount(FRUIT_ITEMS);
  driving(h);
  h.type("dat");
  assertEquals(h.phase(), "suggesting", "typing hands the panel to the input");
  assertEquals(HIGHLIGHTED(h), null, "and drops the highlight the collection no longer explains");
});

Deno.test("Given an inline completion / When text is typed / Then the highlight is kept", () => {
  const h = mount(FRUIT_ITEMS, { inputBehavior: "autocomplete" });
  driving(h);
  h.press("ArrowDown");
  h.type("app");
  assertEquals(h.phase(), "suggesting", "the panel stays in the suggesting phase");
  assertEquals(HIGHLIGHTED(h), "apple", "and the completion's row survives the typing");
});

Deno.test("Given an interacting combobox / When the pointer moves over a row / Then the highlight follows", () => {
  const h = mount(FRUIT_ITEMS);
  driving(h);
  h.hoverRow("date");
  assertEquals(HIGHLIGHTED(h), "date", "the pointer adopts the row");
  h.hoverRow("date");
  assertEquals(HIGHLIGHTED(h), "date", "and a second move over the same row changes nothing");
});

Deno.test("Given an interacting combobox / When a touch pointer moves over a row / Then the highlight stays", () => {
  const h = mount(FRUIT_ITEMS);
  driving(h);
  h.hoverRow("date", "touch");
  assertEquals(HIGHLIGHTED(h), "apple", "only a mouse pointer highlights");
});

Deno.test("Given an interacting combobox / When the pointer leaves a row / Then the highlight clears", () => {
  const h = mount(FRUIT_ITEMS);
  driving(h);
  h.hoverRow("date");
  h.leaveRow("date");
  assertEquals(HIGHLIGHTED(h), null, "the leave clears it");
});

Deno.test("Given an interacting combobox / When a row is clicked / Then it selects and closes", () => {
  const h = mount(FRUIT_ITEMS);
  driving(h);
  h.clickRow("date");
  assertEquals(SELECTED(h), ["date"], "the click selects");
  assertEquals(INPUT_TEXT(h), "Date", "and the replace behaviour writes the label");
  assertEquals(h.phase(), "focused", "closeOnSelect lands the panel in the focused phase");
  assertEquals(
    h.events.openChange.at(-1),
    { open: false, reason: "item-select", value: ["date"] },
    "open-change reports the selection as the reason",
  );
  assertEquals(
    h.events.select,
    [{ value: ["date"], itemValue: "date" }],
    "select reports the value the pick landed on",
  );
});

Deno.test("Given a multiple combobox with closeOnSelect false / When a row is clicked / Then it accumulates and stays open", () => {
  const h = mount(FRUIT_ITEMS, { multiple: true, closeOnSelect: false });
  driving(h);
  h.clickRow("apple");
  h.clickRow("date");
  assertEquals(SELECTED(h), ["apple", "date"], "picks accumulate in click order");
  assertEquals(h.phase(), "interacting", "the panel stays open for the next pick");
  assertEquals(
    h.events.select,
    [
      { value: ["apple"], itemValue: "apple" },
      { value: ["apple", "date"], itemValue: "date" },
    ],
    "each pick reports the value it landed on",
  );
});

Deno.test("Given a multiple combobox / When a selected row is clicked / Then it toggles off and reports", () => {
  const h = mount(FRUIT_ITEMS, { multiple: true, defaultValue: "apple,date" });
  driving(h);
  h.clickRow("apple");
  assertEquals(SELECTED(h), ["date"], "a second pick removes the row");
  assertEquals(
    h.events.select,
    [{ value: ["date"], itemValue: "apple" }],
    "and select reports the removal too",
  );
});

Deno.test("Given an interacting combobox / When Escape arrives / Then focused is reachable", () => {
  const h = mount(FRUIT_ITEMS);
  driving(h);
  layer(h).onEscape();
  assertEquals(h.phase(), "focused", "the layer's escape closes the panel");
  assertEquals(HIGHLIGHTED(h), null, "and the focused phase's entry clears the highlight");
  assertEquals(
    h.events.openChange.at(-1),
    { open: false, reason: "escape-key", value: [] },
    "open-change reports the escape",
  );
});

Deno.test("Given an interacting combobox / When the trigger is clicked / Then the panel closes", () => {
  const h = mount(FRUIT_ITEMS);
  driving(h);
  h.clickTrigger();
  assertEquals(h.phase(), "focused", "the trigger toggles the panel shut");
});

Deno.test("Given an interacting combobox / When an outside press arrives / Then idle is reachable", () => {
  const h = mount(FRUIT_ITEMS);
  driving(h);
  layer(h).onOutside();
  assertEquals(h.phase(), "idle", "the outside press dismisses to the unfocused phase");
  assertEquals(
    h.events.openChange.at(-1),
    { open: false, reason: "interact-outside", value: [] },
    "open-change reports the outside press",
  );
});

Deno.test("Given an interacting combobox with custom text / When an outside press arrives / Then the text reverts", () => {
  const h = mount(FRUIT_ITEMS, { defaultValue: "banana" });
  h.api.setOpen(true);
  h.type("zzz");
  layer(h).onOutside();
  assertEquals(INPUT_TEXT(h), "Banana", "the outside press puts the authored value back");
});

Deno.test("Given an interacting combobox with a custom value allowed / When an outside press arrives / Then the text is kept", () => {
  const h = mount(FRUIT_ITEMS, { allowCustomValue: true });
  h.api.setOpen(true);
  h.type("zzz");
  layer(h).onOutside();
  assertEquals(INPUT_TEXT(h), "zzz", "a permitted custom value survives the dismissal");
});

Deno.test("Given a disabled combobox / When a row is clicked or a key arrives / Then nothing moves", () => {
  const h = mount(FRUIT_ITEMS, { disabled: true });
  h.api.setOpen(true);
  assertEquals(h.phase(), "interacting", "the host's open word still opens the panel");
  h.clickRow("apple");
  h.press("ArrowDown");
  h.press("Enter");
  assertEquals(SELECTED(h), [], "the keyboard and the pointer are both inert");
  assertEquals(HIGHLIGHTED(h), null, "and the highlight does not move");
  assertEquals(h.api.getItemState(h.row("apple")).disabled, true, "every row reports disabled");
});

// ---- suggesting -----------------------------------------------------------

Deno.test("Given a suggesting combobox / When the arrows arrive / Then interacting is reachable", () => {
  const h = mount(FRUIT_ITEMS);
  h.focusInput();
  h.type("a");
  assertEquals(h.phase(), "suggesting", "typing reaches the suggestion");
  h.press("ArrowDown");
  assertEquals(h.phase(), "interacting", "the arrow hands control to the user");
  assertEquals(HIGHLIGHTED(h), "apple", "and walks from nothing to the first row");
  h.press("ArrowDown");
  assertEquals(HIGHLIGHTED(h), "banana", "the next arrow walks from the highlight");
  h.press("ArrowUp");
  assertEquals(HIGHLIGHTED(h), "apple", "and ArrowUp walks back");
});

Deno.test("Given a suggesting combobox / When Home and End arrive / Then interacting is reachable with the extreme", () => {
  const h = mount(FRUIT_ITEMS, { defaultHighlightedValue: "banana" });
  h.focusInput();
  h.type("a");
  h.press("End");
  assertEquals(h.phase(), "interacting", "End hands control over");
  assertEquals(HIGHLIGHTED(h), "date", "and takes the last row");
  h.press("Home");
  assertEquals(HIGHLIGHTED(h), "apple", "Home takes the first");
});

Deno.test("Given a suggesting combobox / When the collection changes / Then the auto highlight adopts the first row", () => {
  const h = mount(FRUIT_ITEMS, { inputBehavior: "autohighlight" });
  h.focusInput();
  h.type("a");
  h.write("items", [{ value: "apple", label: "Apple" }, { value: "pear", label: "Pear" }]);
  assertEquals(HIGHLIGHTED(h), "apple", "the new collection's first row is adopted");
});

Deno.test("Given a suggesting combobox whose highlight vanished / When the collection changes / Then it is dropped", () => {
  const h = mount(FRUIT_ITEMS, { defaultHighlightedValue: "banana" });
  h.focusInput();
  h.type("a");
  h.press("ArrowDown");
  h.press("ArrowDown");
  assertEquals(HIGHLIGHTED(h), "banana", "the walk reached banana");
  h.write("items", [{ value: "apple", label: "Apple" }]);
  assertEquals(HIGHLIGHTED(h), null, "a row the collection no longer holds is dropped");
});

Deno.test("Given a suggesting combobox / When the pointer moves over a row / Then interacting is reachable", () => {
  const h = mount(FRUIT_ITEMS);
  h.focusInput();
  h.type("a");
  h.hoverRow("date");
  assertEquals(h.phase(), "interacting", "the pointer hands control to the user");
  assertEquals(HIGHLIGHTED(h), "date", "and adopts the row");
});

Deno.test("Given a suggesting combobox / When Escape arrives / Then the panel closes with no revert", () => {
  const h = mount(FRUIT_ITEMS, { defaultValue: "banana" });
  h.focusInput();
  h.type("zzz");
  layer(h).onEscape();
  assertEquals(h.phase(), "focused", "the suggestion's escape closes the panel");
  assertEquals(INPUT_TEXT(h), "zzz", "and the text is the user's");
});

// ---- the selection and the input's text -----------------------------------

Deno.test("Given a combobox / When selectValue runs / Then the value is replaced and the field follows", () => {
  const h = mount(FRUIT_ITEMS, { defaultValue: "apple" });
  h.api.selectValue("date");
  assertEquals(SELECTED(h), ["date"], "a single-mode pick replaces");
  assertEquals(INPUT_TEXT(h), "Date", "the replace behaviour writes the label");
  assertEquals(
    h.events.select,
    [{ value: ["date"], itemValue: "date" }],
    "select reports the landed value",
  );
  assertEquals(
    h.events.valueChange,
    [{ value: ["date"], items: [h.row("date")] }],
    "value-change carries the new value and its items",
  );
});

Deno.test("Given a multiple combobox / When selectValue runs twice / Then the values toggle", () => {
  const h = mount(FRUIT_ITEMS, { multiple: true });
  h.api.selectValue("apple");
  h.api.selectValue("date");
  assertEquals(SELECTED(h), ["apple", "date"], "picks accumulate in order");
  h.api.selectValue("apple");
  assertEquals(SELECTED(h), ["date"], "and a repeat removes");
});

Deno.test("Given a preserve selectionBehaviour / When a pick runs / Then the field keeps its own text", () => {
  const h = mount(FRUIT_ITEMS, { selectionBehavior: "preserve" });
  h.api.setInputValue("keep me");
  h.api.selectValue("date");
  assertEquals(SELECTED(h), ["date"], "the pick lands");
  assertEquals(INPUT_TEXT(h), "keep me", "and the field's text is untouched");
});

Deno.test("Given a clear selectionBehaviour / When a pick runs / Then the field empties", () => {
  const h = mount(FRUIT_ITEMS, { selectionBehavior: "clear" });
  h.api.setInputValue("keep me");
  h.api.selectValue("date");
  assertEquals(INPUT_TEXT(h), "", "the field empties on every value move");
});

Deno.test("Given a combobox / When setValue runs / Then the array is assigned verbatim", () => {
  const h = mount(FRUIT_ITEMS);
  h.api.setValue(["date", "banana"]);
  assertEquals(SELECTED(h), ["date", "banana"], "the value set is not mode-aware");
  assertEquals(INPUT_TEXT(h), "Date, Banana", "and the field's replace behaviour follows");
});

Deno.test("Given a combobox / When clearValue runs without an argument / Then everything clears", () => {
  const h = mount(FRUIT_ITEMS, { multiple: true, defaultValue: "apple,date" });
  h.api.clearValue();
  assertEquals(SELECTED(h), [], "the selection empties");
  assertEquals(INPUT_TEXT(h), "", "and so does the field");
  assertEquals(h.api.getClearTriggerProps()["hidden"], true, "the clear trigger hides itself");
});

Deno.test("Given a multiple combobox / When clearValue runs with a value / Then only that value clears", () => {
  const h = mount(FRUIT_ITEMS, { multiple: true, defaultValue: "apple,date" });
  h.api.clearValue("apple");
  assertEquals(SELECTED(h), ["date"], "only the named value clears");
});

Deno.test("Given a combobox / When the clear trigger is clicked / Then the panel closes and the field empties", () => {
  const h = mount(FRUIT_ITEMS, { defaultValue: "apple" });
  h.api.setOpen(true);
  h.clickClearTrigger();
  assertEquals(SELECTED(h), [], "the selection empties");
  assertEquals(INPUT_TEXT(h), "", "and the field with it");
  assertEquals(h.phase(), "focused", "the panel lands in the focused phase");
  assertEquals(
    h.events.openChange.at(-1),
    { open: false, reason: "clear-trigger", value: [] },
    "open-change reports the clear trigger",
  );
});

Deno.test("Given a combobox with nothing selected / When the clear trigger's props are read / Then it is hidden", () => {
  const h = mount(FRUIT_ITEMS);
  assertEquals(h.api.getClearTriggerProps()["hidden"], true, "an empty selection hides the trigger");
  h.api.selectValue("apple");
  assertEquals(h.api.getClearTriggerProps()["hidden"], false, "a selection shows it");
});

Deno.test("Given a combobox / When setHighlightValue and clearHighlightValue run / Then the highlight moves and reports", () => {
  const h = mount(FRUIT_ITEMS);
  h.api.setHighlightValue("cherry");
  assertEquals(HIGHLIGHTED(h), "cherry", "the value is adopted even though it is disabled");
  assertEquals(
    h.events.highlightChange.at(-1),
    { highlightedValue: "cherry", highlightedItem: h.row("cherry") },
    "highlight-change carries the row it names",
  );
  h.api.clearHighlightValue();
  assertEquals(HIGHLIGHTED(h), null, "the clear empties it");
  assertEquals(
    h.events.highlightChange.at(-1),
    { highlightedValue: null, highlightedItem: null },
    "and the clear reports a null row",
  );
});

Deno.test("Given a combobox / When syncSelectedItems runs / Then the field is recomputed from the selection", () => {
  const h = mount(FRUIT_ITEMS, { selectionBehavior: "replace" });
  h.api.setInputValue("other text");
  h.api.setValue(["date"]);
  h.api.setInputValue("other text");
  h.api.syncSelectedItems();
  assertEquals(INPUT_TEXT(h), "Date", "the watch's recomputation puts the label back");
});

Deno.test("Given items whose labels are missing / When a pick runs / Then the value is the label", () => {
  const h = mount([{ value: "apple" }, { value: "banana", label: "" }]);
  h.api.selectValue("apple");
  assertEquals(INPUT_TEXT(h), "apple", "a missing label falls back to the value");
  assertEquals(h.api.valueAsString, "apple", "the api's string does too");
});

Deno.test("Given items without a value / When the rows are read / Then they are dropped", () => {
  const h = mount([{ value: "apple", label: "Apple" }, { label: "no value" }, { value: "", label: "blank" }]);
  assertEquals(ALL_VALUES(h), ["apple"], "an entry without a usable value renders no row");
});

// ---- the inline completion ------------------------------------------------
//
// The completion is context rather than a DOM write: the field shows the
// highlighted row's label while `inputValue` keeps what the user typed, which
// is what makes `isCustomValue` answer about the typed text.

Deno.test("Given an inline completion / When arrows move the highlight / Then the field completes and the text stays", () => {
  const h = mount(FRUIT_ITEMS, { inputBehavior: "autocomplete" });
  h.focusInput();
  h.type("b");
  h.press("ArrowDown");
  h.press("ArrowDown");
  assertEquals(HIGHLIGHTED(h), "banana", "the walk reached banana");
  assertEquals(h.api.inputValue, "Banana", "the field shows the completed label");
  h.api.setInputValue("b");
  assertEquals(h.api.inputValue, "b", "the machine's own text is what the host wrote");
});

Deno.test("Given an inline completion / When the pointer moves over a row / Then nothing is completed", () => {
  const h = mount(FRUIT_ITEMS, { inputBehavior: "autocomplete" });
  h.focusInput();
  h.type("b");
  h.press("ArrowDown");
  h.hoverRow("date");
  assertEquals(HIGHLIGHTED(h), "date", "the pointer moves the highlight");
  assertEquals(h.api.inputValue, "b", "but the pointer never completes into the field");
});

Deno.test("Given a completion whose row has no label / When the arrow arrives / Then the row's value completes the field", () => {
  const h = mount([{ value: "zz" }], { inputBehavior: "autocomplete" });
  h.focusInput();
  h.type("q");
  h.press("ArrowDown");
  assertEquals(HIGHLIGHTED(h), "zz", "the row is adopted");
  assertEquals(h.api.inputValue, "zz", "and the value stands in for the missing label");
});

// ---- the keyboard map -----------------------------------------------------

Deno.test("Given an open combobox / When Enter arrives / Then the highlight selects and the field follows", () => {
  const h = mount(FRUIT_ITEMS);
  driving(h);
  h.press("Enter");
  assertEquals(SELECTED(h), ["apple"], "Enter selects the highlight");
  assertEquals(INPUT_TEXT(h), "Apple", "and the field's replace behaviour follows");
  assertEquals(h.phase(), "focused", "closeOnSelect closes the panel");
});

Deno.test("Given an open combobox with closeOnSelect false / When Enter arrives / Then the panel stays up", () => {
  const h = mount(FRUIT_ITEMS, { closeOnSelect: false });
  driving(h);
  h.press("Enter");
  assertEquals(SELECTED(h), ["apple"], "the selection lands");
  assertEquals(h.phase(), "interacting", "and the panel stays up");
});

Deno.test("Given an open combobox / When Enter arrives / Then the keystroke is consumed", () => {
  const h = mount(FRUIT_ITEMS);
  driving(h);
  h.press("Enter");
  assertEquals(h.prevented(), true, "a consumed Enter does not submit the host's form");
});

Deno.test("Given alwaysSubmitOnEnter / When Enter arrives / Then the keystroke is the host's", () => {
  const h = mount(FRUIT_ITEMS, { alwaysSubmitOnEnter: true });
  driving(h);
  h.press("Enter");
  assertEquals(SELECTED(h), ["apple"], "the selection still lands");
  assertEquals(h.prevented(), false, "and the keystroke reaches the form");
});

Deno.test("Given an open combobox with custom text and no highlight / When Enter arrives / Then the text reverts and the panel closes", () => {
  const h = mount(FRUIT_ITEMS);
  h.focusInput();
  h.type("zzz");
  h.press("Enter");
  assertEquals(SELECTED(h), [], "nothing is selected");
  assertEquals(INPUT_TEXT(h), "", "the refused text reverts to the selection's string");
  assertEquals(h.phase(), "focused", "and the panel closes");
});

Deno.test("Given a closed focused combobox with custom text / When Enter arrives / Then nothing moves", () => {
  const h = mount(FRUIT_ITEMS, { defaultValue: "banana", openOnChange: false });
  h.focusInput();
  h.type("zzz");
  assertEquals(h.phase(), "focused", "typing without opening stays put");
  h.press("Enter");
  assertEquals(h.phase(), "focused", "the phase does not change");
  assertEquals(INPUT_TEXT(h), "zzz", "and the text is the user's");
});

Deno.test("Given a closed combobox / When alt ArrowDown arrives / Then the panel opens", () => {
  const h = mount(FRUIT_ITEMS);
  h.focusInput();
  h.press("ArrowDown", { alt: true });
  assertEquals(h.phase(), "interacting", "the modifier key opens the panel");
  assertEquals(HIGHLIGHTED(h), null, "and adopts no row, which the arrows do");
});

Deno.test("Given an open combobox / When alt ArrowUp arrives / Then the panel closes", () => {
  const h = mount(FRUIT_ITEMS);
  driving(h);
  h.press("ArrowUp", { alt: true });
  assertEquals(h.api.open, false, "the modifier key closes the panel");
});

Deno.test("Given openOnKeyPress false / When a closed combobox sees an arrow / Then nothing happens", () => {
  const h = mount(FRUIT_ITEMS, { openOnKeyPress: false });
  h.focusInput();
  h.press("ArrowDown");
  assertEquals(h.phase(), "focused", "the arrow is not a request to open");
  h.press("ArrowDown");
  assertEquals(h.phase(), "focused", "and it stays that way");
});

Deno.test("Given a modified keystroke / When an arrow with ctrl arrives / Then the map is not consulted", () => {
  const h = mount(FRUIT_ITEMS);
  h.focusInput();
  h.press("ArrowDown", { ctrl: true });
  assertEquals(h.phase(), "focused", "a modifier key belongs to the host");
});

Deno.test("Given a disabled combobox / When a key arrives on the input / Then it is ignored", () => {
  const h = mount(FRUIT_ITEMS, { disabled: true });
  h.focusInput();
  assertEquals(h.phase(), "idle", "a disabled field takes no focus");
  h.press("ArrowDown");
  assertEquals(h.phase(), "idle", "the arrow does not open the panel");
  h.type("b");
  assertEquals(INPUT_TEXT(h), "", "and the field takes no text of its own");
});

Deno.test("Given a readOnly combobox / When a key arrives on the input / Then it is ignored", () => {
  const h = mount(FRUIT_ITEMS, { readOnly: true });
  h.focusInput();
  h.press("ArrowDown");
  assertEquals(h.phase(), "focused", "a read-only field does not open the panel");
});

Deno.test("Given a closed combobox / When Home and End arrive / Then the panel does not open", () => {
  const h = mount(FRUIT_ITEMS);
  h.focusInput();
  h.press("Home");
  h.press("End");
  assertEquals(h.phase(), "focused", "the extremes are caret moves while the panel is shut");
});

Deno.test("Given an RTL combobox / When the props are read / Then every part reports the direction", () => {
  const h = mount(FRUIT_ITEMS, { dir: "rtl" });
  assertEquals(h.api.getRootProps()["dir"], "rtl", "the root reports it");
  assertEquals(h.api.getInputProps()["dir"], "rtl", "so does the input");
  assertEquals(h.api.getContentProps()["dir"], "rtl", "and the panel");
  const ltr = mount(FRUIT_ITEMS);
  assertEquals(ltr.api.getInputProps()["dir"], "ltr", "and the default is ltr");
});

// ---- the aria contract ----------------------------------------------------

Deno.test("Given a combobox / When the input's props are read / Then the combobox semantics hold", () => {
  const h = mount(FRUIT_ITEMS, { defaultHighlightedValue: "banana", placeholder: "Search" });
  const input = h.api.getInputProps();
  assertEquals(input["role"], "combobox", "the input is the combobox");
  assertEquals(input["type"], "text", "and a text field");
  assertEquals(input["aria-expanded"], false, "a closed panel reports it");
  assertEquals(input["aria-autocomplete"], "list", "and the inline behaviour off");
  assertEquals(input["aria-controls"], "combobox:frameworks:content", "the input controls the panel");
  assertEquals(input["placeholder"], "Search", "the host's placeholder is the field's");
  assertEquals(input["autoComplete"], "off", "the browser's own completion is off");
  h.api.setOpen(true);
  assertEquals(h.api.getInputProps()["aria-expanded"], true, "an open panel reports it");
  assertEquals(
    h.api.getInputProps()["aria-activedescendant"],
    "combobox:frameworks:item:banana",
    "and the active descendant follows the highlight",
  );
});

Deno.test("Given an inline completion / When the input's props are read / Then aria-autocomplete is both", () => {
  const h = mount(FRUIT_ITEMS, { inputBehavior: "autocomplete" });
  assertEquals(h.api.getInputProps()["aria-autocomplete"], "both", "an inline completion announces both");
});

Deno.test("Given an open combobox / When the content's props are read / Then the listbox semantics hold", () => {
  const h = mount(FRUIT_ITEMS, { multiple: true });
  h.api.setOpen(true);
  const content = h.api.getContentProps();
  assertEquals(content["role"], "listbox", "the composite panel is a listbox");
  assertEquals(content["aria-labelledby"], "combobox:frameworks:label", "labelled by the label part");
  assertEquals(content["aria-multiselectable"], true, "a multi mode announces it");
  assertEquals(content["data-state"], "open", "and reports the state");
  assertEquals(content["data-empty"], undefined, "a collection is not empty");
});

Deno.test("Given an empty collection / When the content's props are read / Then the empty flag is carried", () => {
  const h = mount([]);
  assertEquals(h.api.empty, true, "the api reports empty");
  assertEquals(h.api.getContentProps()["data-empty"], "", "and the panel carries the flag");
  assertEquals(h.api.getListProps()["data-empty"], "", "so does the list");
});

Deno.test("Given a non-composite combobox / When the content's props are read / Then the panel is a dialog", () => {
  const h = mount(FRUIT_ITEMS, { composite: false, multiple: true });
  h.api.setOpen(true);
  assertEquals(h.api.getContentProps()["role"], "dialog", "the non-composite panel is a dialog");
  assertEquals(h.api.getContentProps()["aria-multiselectable"], undefined, "and announces nothing");
  assertEquals(h.api.getListProps()["role"], "listbox", "the list carries the listbox role");
  assertEquals(h.api.getListProps()["aria-multiselectable"], true, "and the multi announcement");
  assertEquals(h.api.getTriggerProps()["aria-haspopup"], "dialog", "the trigger announces a dialog");
});

Deno.test("Given a row / When its props are read / Then the option semantics follow the state", () => {
  const h = mount(FRUIT_ITEMS, { defaultValue: "banana" });
  h.api.setOpen(true);
  const selected = h.api.getItemProps(h.row("banana"));
  assertEquals(selected["role"], "option", "the row is an option");
  assertEquals(selected["aria-selected"], true, "the selected row announces it");
  assertEquals(selected["data-selected"], "", "and carries the selection");
  assertEquals(selected["id"], "combobox:frameworks:item:banana", "the id is the namespaced item id");
  const disabled = h.api.getItemProps(h.row("cherry"));
  assertEquals(disabled["aria-disabled"], true, "the disabled row announces it");
  assertEquals(disabled["data-disabled"], "", "and carries the data flag");
  const plain = h.api.getItemProps(h.row("apple"));
  assertEquals(plain["aria-selected"], false, "an unselected row announces false, not absent");
  assertEquals(plain["data-highlighted"], undefined, "and is not highlighted");
});

Deno.test("Given a highlighted row / When its props are read / Then the highlight is carried", () => {
  const h = mount(FRUIT_ITEMS, { defaultHighlightedValue: "date" });
  h.api.setOpen(true);
  assertEquals(h.api.getItemProps(h.row("date"))["data-highlighted"], "", "the row carries it");
  assertEquals(h.api.getItemProps(h.row("apple"))["data-highlighted"], undefined, "another row does not");
  assertEquals(
    h.api.getItemState(h.row("date")),
    { value: "date", disabled: false, highlighted: true, selected: false },
    "and the item state reports all four facts",
  );
});

Deno.test("Given a group / When its props are read / Then the group semantics hold", () => {
  const h = mount(GROUPED_ITEMS);
  const block = h.blocks()[0]!;
  const group = h.api.getItemGroupProps(block);
  assertEquals(group["role"], "group", "the block is a group");
  const label = h.api.getItemGroupLabelProps(block);
  assertEquals(group["aria-labelledby"], label["id"], "labelled by its label part");
  assertEquals(label["role"], "presentation", "the label is presentational");
  assertEquals(h.api.getRows(block).map((row) => row.value), ["apple", "pear"], "and holds its rows");
  assertEquals(h.blocks()[1]?.label, "Nut", "the second group is the host's");
});

Deno.test("Given an unlabelled group / When its label's props are read / Then the label is hidden", () => {
  const h = mount(FRUIT_ITEMS);
  assertEquals(h.api.getItemGroupLabelProps(h.blocks()[0]!)["hidden"], true, "no label is hidden");
});

Deno.test("Given a combobox / When the trigger's props are read / Then the disclosure semantics hold", () => {
  const h = mount(FRUIT_ITEMS);
  const trigger = h.api.getTriggerProps();
  assertEquals(trigger["type"], "button", "the trigger is a button");
  assertEquals(trigger["aria-haspopup"], "listbox", "announcing a listbox");
  assertEquals(trigger["aria-expanded"], false, "collapsed while the panel is shut");
  assertEquals(trigger["aria-controls"], undefined, "and controlling nothing");
  assertEquals(trigger["tabIndex"], -1, "the field is the tab stop, not the trigger");
  assertEquals(trigger["data-state"], "closed", "and it reports the state");
  h.api.setOpen(true);
  const open = h.api.getTriggerProps();
  assertEquals(open["aria-expanded"], true, "expanded while the panel is up");
  assertEquals(open["aria-controls"], "combobox:frameworks:content", "and controlling the panel");
  assertEquals(open["data-state"], "open", "with the state to match");
});

Deno.test("Given a focusable trigger / When its props are read / Then it is a tab stop", () => {
  const h = mount(FRUIT_ITEMS);
  assertEquals(h.api.getTriggerProps({ focusable: true })["tabIndex"], undefined, "a focusable trigger is reachable");
  assertEquals(
    h.api.getTriggerProps({ focusable: true })["data-focusable"],
    "",
    "and announces it",
  );
});

Deno.test("Given a combobox / When the label's props are read / Then it names the input", () => {
  const h = mount(FRUIT_ITEMS, { invalid: true, required: true });
  const label = h.api.getLabelProps();
  assertEquals(label["htmlFor"], "combobox:frameworks:input", "the label is for the input");
  assertEquals(label["data-invalid"], "", "and carries the invalid state");
  assertEquals(label["data-required"], "", "and the required state");
});

Deno.test("Given a disabled combobox / When the props are read / Then every part reports it", () => {
  const h = mount(FRUIT_ITEMS, { disabled: true });
  assertEquals(h.api.getRootProps()["data-disabled"], "", "the root reports it");
  assertEquals(h.api.getInputProps()["disabled"], true, "the input is disabled");
  assertEquals(h.api.getInputProps()["data-disabled"], "", "and carries the flag");
  assertEquals(h.api.getTriggerProps()["disabled"], true, "the trigger is disabled");
  assertEquals(h.api.getContentProps()["data-disabled"], "", "the panel reports it");
  assertEquals(h.api.disabled, true, "the api reports it");
});

Deno.test("Given a readOnly combobox / When the props are read / Then every part reports it", () => {
  const h = mount(FRUIT_ITEMS, { readOnly: true });
  assertEquals(h.api.getRootProps()["data-readonly"], "", "the root reports it");
  assertEquals(h.api.getInputProps()["readOnly"], true, "the field is read-only");
});

Deno.test("Given an open combobox / When the trigger's indicator props are read / Then the disclosure indicator rotates", () => {
  const h = mount(FRUIT_ITEMS);
  assertEquals(h.api.getTriggerIndicatorProps()["data-state"], "closed", "shut, the indicator is closed");
  h.api.setOpen(true);
  assertEquals(
    h.api.getTriggerIndicatorProps()["data-state"],
    "open",
    "and open, it rotates — the utility engine keys on the state",
  );
  assertEquals(h.api.getTriggerIndicatorProps()["aria-hidden"], true, "the indicator is decorative");
});

Deno.test("Given a combobox / When the positioner's props are read / Then the placement is the state the theme keys on", () => {
  const h = mount(FRUIT_ITEMS);
  const closed = h.api.getPositionerProps();
  assertEquals(closed["data-state"], "closed", "the positioner reports the panel's state");
  assertEquals(closed["data-placement"], "bottom", "and the authored placement");
  assertEquals(closed["data-side"], "bottom", "with the side it implies");
  const sided = mount(FRUIT_ITEMS, { placement: "top-start" });
  assertEquals(sided.api.getPositionerProps()["data-side"], "top", "a compound placement reports its side");
});

Deno.test("Given a combobox / When the api's strings are read / Then they are the labels joined in selection order", () => {
  const h = mount(FRUIT_ITEMS, { multiple: true, defaultValue: "date,apple" });
  assertEquals(h.api.valueAsString, "Date, Apple", "the labels are joined in the selection's order");
  assertEquals(h.api.hasSelectedItems, true, "the api reports a selection");
  assertEquals(h.api.multiple, true, "and the mode");
  assertEquals(h.api.selectedItems.map((row) => row.value), ["date", "apple"], "the rows resolve in order");
});

// ---- the reflexes ---------------------------------------------------------
//
// The layer and the scroll reflex are stdlib actions, attached by name from
// the bags the parts carry.

Deno.test("Given a closed combobox / When the layer's callbacks fire / Then nothing happens", () => {
  const h = mount(FRUIT_ITEMS);
  layer(h).onOutside();
  layer(h).onEscape();
  assertEquals(h.phase(), "idle", "a closed panel has no layer to dismiss");
  assertEquals(h.events.openChange, [], "and reports nothing");
});

Deno.test("Given an open combobox / When the scroll reflex's active id is read / Then it is the highlighted row's id", () => {
  const h = mount(FRUIT_ITEMS, { defaultHighlightedValue: "banana" });
  h.api.setOpen(true);
  const reveal = h.api.getContentProps()["use:scroll-into-view"] as unknown as {
    activeId: () => string;
  };
  assertEquals(reveal.activeId(), "combobox:frameworks:item:banana", "the active descendant is revealed");
  h.api.clearHighlightValue();
  assertEquals(reveal.activeId(), "", "and nothing is revealed with no highlight");
});

Deno.test("Given a closed combobox with a highlight / When the scroll reflex's active id is read / Then nothing is revealed", () => {
  const h = mount(FRUIT_ITEMS, { defaultHighlightedValue: "banana" });
  const reveal = h.api.getContentProps()["use:scroll-into-view"] as unknown as {
    activeId: () => string;
  };
  assertEquals(reveal.activeId(), "", "a shut panel reveals nothing");
});

Deno.test("Given a combobox / When the focus command runs / Then no node is required", () => {
  const h = mount(FRUIT_ITEMS);
  // The element is not in the document here, so the id resolves to nothing:
  // the command must be a no-op rather than a throw.
  h.api.focus();
  assertEquals(h.phase(), "idle", "the machine is untouched");
});

// ---- two instances --------------------------------------------------------

Deno.test("Given two comboboxes on one page / When one moves / Then the other keeps its own context", () => {
  const first = mount(FRUIT_ITEMS, { defaultValue: "apple" });
  const second = mount(FRUIT_ITEMS, { multiple: true, defaultValue: "date" });
  first.api.selectValue("banana");
  assertEquals(SELECTED(first), ["banana"], "the first moved");
  assertEquals(SELECTED(second), ["date"], "the second kept its own selection");
  first.api.setOpen(true);
  assertEquals(second.api.open, false, "and its own panel state");
  first.api.setInputValue("typed");
  assertEquals(second.api.inputValue, "", "and its own field");
  assertEquals(first.api.multiple, false, "the first is single");
  assertEquals(second.api.multiple, true, "the second is multiple");
  assertEquals(ALL_VALUES(second), ["apple", "banana", "cherry", "date"], "both render the same rows");
});

// ---- stability across moves ----------------------------------------------
//
// The api proxy hands out one connect for the element's whole life, and its
// bags are cached against the context fields they read. A binding reads the
// api on every machine move, so a fresh bag (or a fresh row) per read has the
// `for` directive replace the row nodes on each move.

Deno.test("Given an open combobox / When the highlight moves / Then the rows and their handlers keep identity", () => {
  const h = mount(FRUIT_ITEMS);
  driving(h);
  const before = h.api.getItemProps(h.row("banana"));
  const rowsBefore = ALL_VALUES(h).map((value) => h.row(value));
  h.press("ArrowDown");
  const rowsAfter = ALL_VALUES(h).map((value) => h.row(value));
  assertEquals(rowsAfter[0] === rowsBefore[0], true, "the first row keeps its identity");
  assertEquals(rowsAfter[1] === rowsBefore[1], true, "so does the second");
  assertEquals(
    handler<(event: MouseEvent) => void>(h.api.getItemProps(h.row("banana")), "onClick"),
    handler<(event: MouseEvent) => void>(before, "onClick"),
    "and the click handler is the same function",
  );
});

Deno.test("Given an open combobox / When the highlight moves / Then the item bag is rebuilt with the new fields", () => {
  const h = mount(FRUIT_ITEMS);
  driving(h);
  const before = h.api.getItemProps(h.row("banana"));
  assertEquals(before["data-highlighted"], undefined, "banana starts unhighlighted");
  h.press("ArrowDown");
  const after = h.api.getItemProps(h.row("banana"));
  assertEquals(after["data-highlighted"], "", "and reports the highlight");
  assertEquals(after === before, false, "so the bag was rebuilt");
});

Deno.test("Given an open combobox / When nothing moves / Then re-reading a bag returns the same object", () => {
  const h = mount(FRUIT_ITEMS, { defaultValue: "apple" });
  h.api.setOpen(true);
  assertEquals(h.api.getItemProps(h.row("apple")), h.api.getItemProps(h.row("apple")), "the item bag is stable");
  assertEquals(h.api.getInputProps(), h.api.getInputProps(), "so is the input bag");
  assertEquals(h.api.getRootProps(), h.api.getRootProps(), "and the root bag");
  assertEquals(h.api.getBlocks()[0], h.api.getBlocks()[0], "and the block");
});

Deno.test("Given a combobox whose items change / When the bags are read again / Then they follow the new rows", () => {
  const h = mount([{ value: "apple", label: "Apple" }]);
  const before = h.api.getItemProps(h.row("apple"));
  h.write("items", [{ value: "pear", label: "Pear" }]);
  assertEquals(ALL_VALUES(h), ["pear"], "the new collection renders");
  const after = h.api.getItemProps(h.row("pear"));
  assertEquals(after["data-value"], "pear", "the new row carries its value");
  assertEquals(after === before, false, "and is a different object");
});

Deno.test("Given a combobox / When the root id is handed an already-namespaced one / Then the parts are not double-prefixed", () => {
  const root = document.createElement("div");
  document.body.appendChild(root);
  const values: Record<string, WriteSignal> = {};
  const write = (n: string, v: unknown): void => {
    const s = values[n];
    if (s === undefined) values[n] = signal<unknown>(v);
    else s(v);
  };
  write("items", FRUIT_ITEMS);
  const bridge = createComboboxBridge(
    () => {
      const record: Record<string, unknown> = {};
      for (const [n, s] of Object.entries(values)) record[n] = s();
      return record;
    },
    () => root,
    "combobox:outer:item:1",
  );
  assertEquals(
    bridge.api.getContentProps()["id"],
    "combobox:outer:item:1:content",
    "an already-namespaced id is used verbatim",
  );
  bridge.api.setHighlightValue("apple");
  assertEquals(
    bridge.api.getInputProps()["aria-activedescendant"],
    "combobox:outer:item:1:item:apple",
    "and the item id follows it",
  );
});

// ---- the imperative surface ----------------------------------------------

Deno.test("Given a combobox / When setOpen runs / Then the panel follows the host's word", () => {
  const h = mount(FRUIT_ITEMS);
  h.api.setOpen(true);
  assertEquals(h.api.open, true, "the command opens the panel");
  assertEquals(h.phase(), "interacting", "in the phase setOpen reaches");
  h.api.setOpen(false);
  assertEquals(h.api.open, false, "and closes it");
  assertEquals(h.phase(), "focused", "landing in the focused phase");
});

Deno.test("Given an open combobox / When setOpen runs with what is already true / Then nothing moves", () => {
  const h = mount(FRUIT_ITEMS);
  h.api.setOpen(true);
  const before = h.events.openChange.length;
  h.api.setOpen(true);
  assertEquals(h.events.openChange.length, before, "asking for the open panel reports nothing");
});

Deno.test("Given a combobox / When the host's commands run / Then every imperative word works", () => {
  const h = mount(FRUIT_ITEMS);
  h.api.setHighlightValue("date");
  assertEquals(HIGHLIGHTED(h), "date", "setHighlightValue moves the highlight");
  h.api.setOpen(true);
  assertEquals(h.api.open, true, "setOpen opens the panel");
  h.api.clearHighlightValue();
  assertEquals(HIGHLIGHTED(h), null, "clearHighlightValue empties it");
  h.api.setValue(["apple"]);
  assertEquals(SELECTED(h), ["apple"], "setValue writes the selection");
  h.api.setInputValue("search");
  assertEquals(h.api.inputValue, "search", "setInputValue writes the field");
  h.api.focus();
  assertEquals(h.phase(), "interacting", "focus touches no state");
});

Deno.test("Given a combobox with items the host changed / When the machine's order is stale / Then selection still works", () => {
  const h = mount([{ value: "apple", label: "Apple" }], { multiple: true });
  h.write("items", [{ value: "apple", label: "Apple" }, { value: "pear", label: "Pear" }]);
  h.api.selectValue("pear");
  assertEquals(SELECTED(h), ["pear"], "the machine reads the new collection order");
  h.api.setOpen(true);
  h.write("items", [{ value: "pear", label: "Pear" }]);
  assertEquals(HIGHLIGHTED(h), null, "and the open panel re-homes itself over the new rows");
});



