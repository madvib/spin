import { assertEquals } from "@std/assert";
import { parseHTML } from "@spin/runtime/testing";
import { signal } from "@spin/runtime";
import { select } from "./select.def.ts";
const createSelectBridge = select.createBridge;
import type {
  SelectHighlightChange,
  SelectOpenChange,
  SelectSelect,
  SelectValueChange,
} from "./select.def.ts";
import type { SelectApi, SelectRow } from "./select.def.ts";

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
  modifiers: Readonly<
    { shift?: boolean; meta?: boolean; ctrl?: boolean; alt?: boolean }
  > = {},
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

const pointer = (pointerType: string): PointerEvent =>
  ({ pointerType }) as PointerEvent;

const click = (
  modifiers: Readonly<
    {
      shift?: boolean;
      meta?: boolean;
      ctrl?: boolean;
      alt?: boolean;
      button?: number;
    }
  > = {},
): MouseEvent =>
  ({
    shiftKey: modifiers.shift === true,
    metaKey: modifiers.meta === true,
    ctrlKey: modifiers.ctrl === true,
    altKey: modifiers.alt === true,
    button: modifiers.button ?? 0,
    defaultPrevented: false,
  }) as unknown as MouseEvent;

/** Items as the host writes them, so the bridge's normalization is under test. */
const FRUIT_ITEMS = [
  { value: "apple", label: "Apple" },
  { value: "banana", label: "Banana" },
  { value: "cherry", label: "Cherry", disabled: true },
  { value: "date", label: "Date" },
];

interface Harness {
  readonly api: SelectApi;
  readonly root: Element;
  readonly events: {
    readonly valueChange: SelectValueChange[];
    readonly highlightChange: SelectHighlightChange[];
    readonly openChange: SelectOpenChange[];
    readonly select: SelectSelect[];
  };
  row(value: string): SelectRow;
  /** The machine's phase, as the api's open and focused flags report it. */
  mode(): string;
  /** A keystroke on the trigger, the closed panel's focus point. */
  press(
    key: string,
    modifiers?: Readonly<
      { shift?: boolean; meta?: boolean; ctrl?: boolean; alt?: boolean }
    >,
  ): void;
  /** A keystroke on the content, the open panel's focus point. */
  pressContent(
    key: string,
    modifiers?: Readonly<
      { shift?: boolean; meta?: boolean; ctrl?: boolean; alt?: boolean }
    >,
  ): void;
  clickRow(
    value: string,
    modifiers?: Readonly<
      {
        shift?: boolean;
        meta?: boolean;
        ctrl?: boolean;
        alt?: boolean;
        button?: number;
      }
    >,
  ): void;
  hoverRow(value: string): void;
  leaveRow(value: string): void;
  focusTrigger(): void;
  blurTrigger(): void;
  clickTrigger(): void;
  clickClearTrigger(): void;
  pressOutside(target?: Element | null, button?: number): void;
  pressEscape(): void;
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
    valueChange: [] as SelectValueChange[],
    highlightChange: [] as SelectHighlightChange[],
    openChange: [] as SelectOpenChange[],
    select: [] as SelectSelect[],
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
  write(
    "onValueChange",
    (change: SelectValueChange) => events.valueChange.push(change),
  );
  write(
    "onHighlightChange",
    (change: SelectHighlightChange) => events.highlightChange.push(change),
  );
  write(
    "onOpenChange",
    (change: SelectOpenChange) => events.openChange.push(change),
  );
  write("onSelect", (change: SelectSelect) => events.select.push(change));
  const bridge = createSelectBridge(
    () => {
      const record: Record<string, unknown> = {};
      for (const [name, source] of Object.entries(values)) {
        record[name] = source();
      }
      record["@@authored"] = (name: string): boolean => authoredKeys.has(name);
      return record;
    },
    () => root,
    "frameworks",
  );
  const find = (value: string): SelectRow => {
    const found = bridge.api.getRows().find((row) => row.value === value);
    if (found === undefined) throw new Error(`no row ${value}`);
    return found;
  };
  const triggerBag = (): Record<string, unknown> =>
    bridge.api.getTriggerProps();
  const contentBag = (): Record<string, unknown> =>
    bridge.api.getContentProps();
  /** The layer's own callbacks, read out of the content bag the way the attach
   * pass hands them to the stdlib dismissable action. */
  const dismiss = (): {
    onEscape: () => void;
    onOutside: (event: PointerEvent) => void;
  } =>
    contentBag()["use:dismissable"] as unknown as {
      onEscape: () => void;
      onOutside: (event: PointerEvent) => void;
    };
  return {
    api: bridge.api,
    root,
    events,
    row: find,
    mode:
      () => (bridge.api.open
        ? "open"
        : bridge.api.focused
        ? "focused"
        : "idle"),
    press: (key, modifiers) => {
      const event = keydown(key, modifiers);
      handler<(event: KeyboardEvent) => void>(triggerBag(), "onKeyDown")(event);
    },
    pressContent: (key, modifiers) => {
      const event = keydown(key, modifiers);
      handler<(event: KeyboardEvent) => void>(contentBag(), "onKeyDown")(event);
    },
    clickRow: (value, modifiers) => {
      handler<(event: MouseEvent) => void>(
        bridge.api.getItemProps(find(value)),
        "onClick",
      )(
        click(modifiers),
      );
    },
    hoverRow: (value) => {
      handler<(event: PointerEvent) => void>(
        bridge.api.getItemProps(find(value)),
        "onPointerMove",
      )(
        pointer("mouse"),
      );
    },
    leaveRow: (value) => {
      handler<() => void>(
        bridge.api.getItemProps(find(value)),
        "onPointerLeave",
      )();
    },
    focusTrigger: () => handler<() => void>(triggerBag(), "onFocus")(),
    blurTrigger: () => handler<() => void>(triggerBag(), "onBlur")(),
    clickTrigger: () =>
      handler<(event: MouseEvent) => void>(triggerBag(), "onClick")(click()),
    clickClearTrigger: () =>
      handler<(event: MouseEvent) => void>(
        bridge.api.getClearTriggerProps(),
        "onClick",
      )(click()),
    pressOutside: (target: Element | null = null, button = 0): void => {
      dismiss().onOutside(
        { target, button, pointerType: "mouse" } as unknown as PointerEvent,
      );
    },
    pressEscape: () => dismiss().onEscape(),
    write,
  };
}

const HIGHLIGHTED = (h: Harness): string | null => h.api.highlightedValue;

const SELECTED = (h: Harness): readonly string[] => h.api.value;

/** The hidden select's option list, as the bag's action param builds it from
 * the collection and the selection. */
const selectOptions = (
  h: Harness,
): {
  rows: readonly SelectRow[];
  value: readonly string[];
  multiple: boolean;
} => {
  const bag = h.api.getHiddenSelectProps();
  const make = bag["use:select-options"] as () => {
    rows: readonly SelectRow[];
    value: readonly string[];
    multiple: boolean;
  };
  return make();
};

// ---- the start state ------------------------------------------------------

Deno.test("Given a fresh select / When it mounts / Then idle is the reachable start state", () => {
  const h = mount(FRUIT_ITEMS);
  assertEquals(h.mode(), "idle", "the machine starts unfocused and closed");
  assertEquals(h.api.open, false, "the api reports closed");
  assertEquals(h.api.focused, false, "and unfocused");
  assertEquals(
    h.api.getRootProps()["data-state"],
    "closed",
    "the root bag reports closed",
  );
  assertEquals(
    h.api.getTriggerProps()["data-state"],
    "closed",
    "so does the trigger",
  );
  assertEquals(
    h.api.getTriggerProps()["aria-expanded"],
    false,
    "and the trigger's aria agrees",
  );
  assertEquals(SELECTED(h), [], "nothing is selected");
  assertEquals(HIGHLIGHTED(h), null, "nothing is highlighted");
});

Deno.test("Given a select / When the hidden select's options are read / Then they carry the collection and the selection", () => {
  const h = mount(FRUIT_ITEMS);
  const options = selectOptions(h);
  assertEquals(
    options.rows.map((row) => row.value),
    ["apple", "banana", "cherry", "date"],
    "every row is an option",
  );
  assertEquals(
    options.rows.map((row) => row.label),
    ["Apple", "Banana", "Cherry", "Date"],
    "with its label",
  );
  assertEquals(options.value, [], "the empty selection is the select's value");
  assertEquals(options.multiple, false, "a single select posts one value");
  h.api.selectValue("banana");
  assertEquals(
    selectOptions(h).value,
    ["banana"],
    "a pick writes the hidden select's value",
  );
  const multi = mount(FRUIT_ITEMS, { multiple: true });
  assertEquals(
    selectOptions(multi).multiple,
    true,
    "a multiple select posts many",
  );
});

// ---- opening and closing ---------------------------------------------------

Deno.test("Given a select / When setOpen and close run / Then the panel follows and the bags report it", () => {
  const h = mount(FRUIT_ITEMS);
  h.api.setOpen(true);
  assertEquals(h.mode(), "open", "setOpen opens the panel");
  assertEquals(
    h.api.getRootProps()["data-state"],
    "open",
    "the root bag reports open",
  );
  assertEquals(
    h.api.getTriggerProps()["data-state"],
    "open",
    "so does the trigger",
  );
  assertEquals(
    h.api.getContentProps()["hidden"],
    false,
    "and the content is shown",
  );
  assertEquals(HIGHLIGHTED(h), "apple", "with the first row adopted");
  h.api.close();
  assertEquals(h.mode(), "idle", "close returns to idle");
  assertEquals(
    h.api.getRootProps()["data-state"],
    "closed",
    "the root bag reports closed",
  );
  assertEquals(
    h.api.getContentProps()["hidden"],
    true,
    "and the content is hidden",
  );
});

Deno.test("Given a closed select / When toggle runs / Then the panel flips both ways", () => {
  const h = mount(FRUIT_ITEMS);
  h.api.toggle();
  assertEquals(h.mode(), "open", "toggle opens the panel");
  assertEquals(
    h.api.getTriggerProps()["data-state"],
    "open",
    "the trigger reports open",
  );
  h.api.toggle();
  assertEquals(h.mode(), "idle", "and closes it again");
  assertEquals(
    h.api.getTriggerProps()["data-state"],
    "closed",
    "the trigger reports closed",
  );
});

// ---- the selection commands -------------------------------------------------

Deno.test("Given a single select / When selectValue runs / Then the value is replaced", () => {
  const h = mount(FRUIT_ITEMS);
  h.api.selectValue("apple");
  assertEquals(SELECTED(h), ["apple"], "the pick lands");
  assertEquals(
    h.events.valueChange.at(-1),
    {
      value: ["apple"],
      items: [{ value: "apple", label: "Apple", disabled: false }],
    },
    "value-change reports the pick with its item",
  );
  h.api.selectValue("date");
  assertEquals(SELECTED(h), ["date"], "the next pick replaces");
});

Deno.test("Given a multiple select / When selectValue runs twice / Then the values toggle", () => {
  const h = mount(FRUIT_ITEMS, { multiple: true });
  h.api.selectValue("apple");
  assertEquals(SELECTED(h), ["apple"], "the first pick lands");
  h.api.selectValue("date");
  assertEquals(SELECTED(h), ["apple", "date"], "the second accumulates");
  h.api.selectValue("apple");
  assertEquals(SELECTED(h), ["date"], "a repeat pick toggles the row off");
});

Deno.test("Given a select / When setValue and clearValue run / Then the array is assigned and cleared", () => {
  const h = mount(FRUIT_ITEMS);
  h.api.setValue(["date", "apple"]);
  assertEquals(
    SELECTED(h),
    ["date", "apple"],
    "the array is assigned verbatim",
  );
  h.api.clearValue();
  assertEquals(SELECTED(h), [], "clearValue empties the selection");
});

// ---- the row click ----------------------------------------------------------

Deno.test("Given an open select / When a row is clicked / Then the clicked row is selected, not the highlight", () => {
  const h = mount(FRUIT_ITEMS);
  h.api.setOpen(true);
  assertEquals(
    HIGHLIGHTED(h),
    "apple",
    "the open panel highlights the first row",
  );
  h.clickRow("date");
  assertEquals(SELECTED(h), ["date"], "the click selects the row it landed on");
  assertEquals(h.mode(), "focused", "and closeOnSelect closes the panel");
});

// ---- the trigger's keys ------------------------------------------------------

Deno.test("Given a focused select / When Enter or the arrows arrive / Then the panel opens with the highlight pre-placed", () => {
  const h = mount(FRUIT_ITEMS);
  h.focusTrigger();
  assertEquals(h.mode(), "focused", "the trigger takes the focus");
  h.press("Enter");
  assertEquals(h.mode(), "open", "Enter opens the panel");
  assertEquals(HIGHLIGHTED(h), "apple", "with the first row highlighted");
  h.api.close();
  h.focusTrigger();
  h.press("ArrowUp");
  assertEquals(h.mode(), "open", "ArrowUp opens the panel");
  assertEquals(HIGHLIGHTED(h), "date", "with the last row highlighted");
  h.api.close();
  h.focusTrigger();
  h.press("ArrowDown");
  assertEquals(HIGHLIGHTED(h), "apple", "and ArrowDown opens with the first");
});

Deno.test("Given a focused single select / When the closed arrows arrive / Then the selection moves in the collection", () => {
  const h = mount(FRUIT_ITEMS);
  h.focusTrigger();
  h.press("ArrowRight");
  assertEquals(
    SELECTED(h),
    ["apple"],
    "ArrowRight from empty takes the first row",
  );
  h.press("ArrowRight");
  assertEquals(SELECTED(h), ["banana"], "and walks forward");
  h.press("ArrowLeft");
  assertEquals(SELECTED(h), ["apple"], "ArrowLeft walks back");
  h.press("End");
  assertEquals(SELECTED(h), ["date"], "End takes the last row");
  h.press("Home");
  assertEquals(SELECTED(h), ["apple"], "and Home the first");
});

Deno.test("Given a focused multiple select / When the closed arrows arrive / Then the selection stays put", () => {
  const h = mount(FRUIT_ITEMS, { multiple: true });
  h.focusTrigger();
  h.api.selectValue("apple");
  assertEquals(SELECTED(h), ["apple"], "a pick lands");
  h.press("ArrowRight");
  h.press("Home");
  h.press("End");
  h.press("ArrowLeft");
  assertEquals(
    SELECTED(h),
    ["apple"],
    "the closed arrows move nothing in a multiple select",
  );
});

// ---- the content's keys ------------------------------------------------------

Deno.test("Given an open select / When the content arrows arrive / Then the highlight walks the collection", () => {
  const h = mount(FRUIT_ITEMS);
  h.api.setOpen(true);
  assertEquals(
    HIGHLIGHTED(h),
    "apple",
    "the open panel starts on the first row",
  );
  h.pressContent("ArrowDown");
  assertEquals(HIGHLIGHTED(h), "banana", "ArrowDown walks forward");
  h.pressContent("ArrowUp");
  assertEquals(HIGHLIGHTED(h), "apple", "ArrowUp walks back");
  h.pressContent("End");
  assertEquals(HIGHLIGHTED(h), "date", "End jumps to the last row");
  h.pressContent("Home");
  assertEquals(HIGHLIGHTED(h), "apple", "and Home to the first");
  h.pressContent("b");
  assertEquals(HIGHLIGHTED(h), "banana", "typeahead matches the label prefix");
  h.pressContent("B");
  assertEquals(HIGHLIGHTED(h), "banana", "case-insensitively");
});

Deno.test("Given an open select / When Enter arrives on the content / Then the highlight is picked and the panel closes", () => {
  const h = mount(FRUIT_ITEMS);
  h.api.setOpen(true);
  h.pressContent("ArrowDown");
  assertEquals(HIGHLIGHTED(h), "banana", "the highlight is on banana");
  h.pressContent("Enter");
  assertEquals(SELECTED(h), ["banana"], "Enter picks the highlight");
  assertEquals(h.mode(), "focused", "and closeOnSelect closes the panel");
});

// ---- closing on a pick -------------------------------------------------------

Deno.test("Given closeOnSelect false / When a row is picked / Then the panel stays open", () => {
  const h = mount(FRUIT_ITEMS, { closeOnSelect: false });
  h.api.setOpen(true);
  h.clickRow("date");
  assertEquals(SELECTED(h), ["date"], "the pick lands");
  assertEquals(h.mode(), "open", "and the panel stays up");
});

Deno.test("Given a multiple select / When a row is clicked / Then it accumulates and stays open", () => {
  const h = mount(FRUIT_ITEMS, { multiple: true });
  h.api.setOpen(true);
  h.clickRow("apple");
  h.clickRow("date");
  assertEquals(SELECTED(h), ["apple", "date"], "picks accumulate");
  assertEquals(h.mode(), "open", "and the panel stays up for the next pick");
});

// ---- the controlled channels ---------------------------------------------------
//
// A prop is authored when the HOST wrote it; a coerced default never is. The
// bridge's effect reads the live prop signals, so a write moves the machine
// without an event.

Deno.test("Given an authored value / When the host writes it / Then the machine follows", () => {
  const h = mount(FRUIT_ITEMS, { value: "apple" });
  assertEquals(
    SELECTED(h),
    ["apple"],
    "the authored value seeds the selection",
  );
  h.write("value", "banana");
  assertEquals(SELECTED(h), ["banana"], "the write moves the machine");
  assertEquals(
    h.events.valueChange.at(-1),
    {
      value: ["banana"],
      items: [{ value: "banana", label: "Banana", disabled: false }],
    },
    "and reports the write",
  );
  h.write("placeholder", "Pick one");
  assertEquals(
    SELECTED(h),
    ["banana"],
    "an unrelated write does not re-impose the value",
  );
  h.write("value", "date");
  assertEquals(SELECTED(h), ["date"], "and the next host write still wins");
});

Deno.test("Given a default value / When the host rewrites the default / Then the machine keeps its own moves", () => {
  const h = mount(FRUIT_ITEMS, { defaultValue: "apple" });
  assertEquals(SELECTED(h), ["apple"], "the default seeds the selection");
  h.api.selectValue("date");
  assertEquals(SELECTED(h), ["date"], "the machine moved");
  h.write("defaultValue", "banana");
  assertEquals(
    SELECTED(h),
    ["date"],
    "a coerced default is not a controlled value",
  );
});

Deno.test("Given an authored open / When the host writes it / Then the panel follows", () => {
  const h = mount(FRUIT_ITEMS, { open: false });
  assertEquals(h.mode(), "idle", "the authored false starts closed");
  h.write("open", true);
  assertEquals(h.api.open, true, "the write opens the panel");
  assertEquals(
    h.events.openChange.at(-1),
    { open: true, reason: "script" },
    "and reports the host's word as the reason",
  );
  h.write("open", false);
  assertEquals(h.api.open, false, "the write closes it again");
});

// ---- the collection change -----------------------------------------------------
//
// The bridge's collection effect keeps the machine's order in step and lets
// the machine's own sync event drop what the new collection no longer holds.

Deno.test("Given a select whose selection and highlight vanish / When the collection changes / Then both are dropped", () => {
  const h = mount(FRUIT_ITEMS, { defaultValue: "banana" });
  h.api.setOpen(true);
  assertEquals(HIGHLIGHTED(h), "banana", "the open panel adopts the selection");
  h.write("items", [
    { value: "apple", label: "Apple" },
    { value: "cherry", label: "Cherry" },
    { value: "date", label: "Date" },
  ]);
  assertEquals(SELECTED(h), [], "a vanished selection is dropped");
  assertEquals(HIGHLIGHTED(h), null, "and so is a vanished highlight");
});

Deno.test("Given a select whose highlight vanishes / When the collection changes / Then it falls back to the selection", () => {
  const h = mount(FRUIT_ITEMS, { defaultValue: "date" });
  h.api.setOpen(true);
  h.hoverRow("banana");
  assertEquals(HIGHLIGHTED(h), "banana", "the pointer adopted banana");
  assertEquals(SELECTED(h), ["date"], "the selection is date");
  h.write("items", [
    { value: "apple", label: "Apple" },
    { value: "cherry", label: "Cherry" },
    { value: "date", label: "Date" },
  ]);
  assertEquals(SELECTED(h), ["date"], "the selection survives");
  assertEquals(HIGHLIGHTED(h), "date", "and the highlight falls back to it");
});

// ---- the events -----------------------------------------------------------------

Deno.test("Given a select / When the selection moves / Then value-change fires with the items", () => {
  const h = mount(FRUIT_ITEMS);
  h.api.setValue(["apple", "date"]);
  assertEquals(
    h.events.valueChange.at(-1),
    {
      value: ["apple", "date"],
      items: [
        { value: "apple", label: "Apple", disabled: false },
        { value: "date", label: "Date", disabled: false },
      ],
    },
    "the event carries the value and its items",
  );
});

Deno.test("Given a select / When the panel moves / Then open-change fires with the reason", () => {
  const h = mount(FRUIT_ITEMS);
  h.clickTrigger();
  assertEquals(
    h.events.openChange.at(-1),
    { open: true, reason: "trigger-click" },
    "the trigger's click is the reason",
  );
  h.pressEscape();
  assertEquals(
    h.events.openChange.at(-1),
    { open: false, reason: "escape-key" },
    "the escape is too",
  );
  h.api.setOpen(true);
  assertEquals(
    h.events.openChange.at(-1),
    { open: true, reason: "script" },
    "and the host's command is a script",
  );
});

Deno.test("Given a select / When focus runs / Then the trigger's focus event moves the machine", () => {
  const h = mount(FRUIT_ITEMS);
  assertEquals(h.mode(), "idle", "the select starts unfocused");
  h.api.focus();
  assertEquals(h.mode(), "focused", "focus sends the trigger's focus event");
});

// ---- the layer -------------------------------------------------------------------

Deno.test("Given an open select / When Escape arrives / Then the panel closes to focused", () => {
  const h = mount(FRUIT_ITEMS);
  h.api.setOpen(true);
  h.pressEscape();
  assertEquals(h.mode(), "focused", "escape returns to the focused phase");
  assertEquals(HIGHLIGHTED(h), null, "and clears the highlight");
  assertEquals(
    h.events.openChange.at(-1),
    { open: false, reason: "escape-key" },
    "open-change reports the escape",
  );
});

Deno.test("Given an open select / When an outside press arrives / Then restoreFocus decides the landing", () => {
  const h = mount(FRUIT_ITEMS);
  h.api.setOpen(true);
  h.pressOutside(null, 0);
  assertEquals(
    h.mode(),
    "focused",
    "a plain press returns to the focused phase",
  );
  h.api.setOpen(true);
  h.pressOutside(null, 2);
  assertEquals(h.mode(), "idle", "a non-focusable press lands in idle");
});
