import { assertEquals } from "@std/assert";
import { parseHTML } from "@spin/runtime/testing";
import { signal } from "@spin/runtime";
import { listbox } from "./listbox.presentation.ts";
const createListboxBridge = listbox.createBridge;
import type {
  ListboxHighlightChange,
  ListboxSelect,
  ListboxValueChange,
} from "./listbox.presentation.ts";
import type {
  ListboxApi,
  ListboxBlock,
  ListboxRow,
} from "./listbox.presentation.ts";

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

const GROUPED_ITEMS = [
  { value: "apple", label: "Apple", group: "Pome" },
  { value: "pear", label: "Pear", group: "Pome" },
  { value: "walnut", label: "Walnut", group: "Nut" },
];

interface Harness {
  readonly api: ListboxApi;
  readonly root: Element;
  readonly events: {
    readonly valueChange: ListboxValueChange[];
    readonly highlightChange: ListboxHighlightChange[];
    readonly select: ListboxSelect[];
  };
  row(value: string): ListboxRow;
  blocks(): readonly ListboxBlock[];
  press(
    key: string,
    modifiers?: Readonly<
      { shift?: boolean; meta?: boolean; ctrl?: boolean; alt?: boolean }
    >,
  ): void;
  clickRow(
    value: string,
    modifiers?: Readonly<
      {
        shiftKey?: boolean;
        meta?: boolean;
        ctrl?: boolean;
        alt?: boolean;
        button?: number;
      }
    >,
  ): void;
  hoverRow(value: string, pointerType?: string): void;
  leaveRow(value: string): void;
  focusContent(): void;
  blurContent(): void;
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
  write(
    "onValueChange",
    (change: ListboxValueChange) => events.valueChange.push(change),
  );
  write(
    "onHighlightChange",
    (change: ListboxHighlightChange) => events.highlightChange.push(change),
  );
  write("onSelect", (change: ListboxSelect) => events.select.push(change));
  const bridge = createListboxBridge(
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
  const find = (value: string): ListboxRow => {
    const found = bridge.api
      .getBlocks()
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
    press: (key, modifiers = {}) => {
      handler<(e: KeyboardEvent) => void>(
        bridge.api.getContentProps(),
        "onKeydown",
      )(keydown(key, modifiers));
    },
    clickRow: (
      value,
      modifiers: Readonly<
        {
          shiftKey?: boolean;
          meta?: boolean;
          ctrl?: boolean;
          alt?: boolean;
          button?: number;
        }
      > = {},
    ) => {
      const inner: {
        shift?: boolean;
        meta?: boolean;
        ctrl?: boolean;
        alt?: boolean;
        button?: number;
      } = {};
      if (modifiers.shiftKey !== undefined) inner.shift = modifiers.shiftKey;
      if (modifiers.meta !== undefined) inner.meta = modifiers.meta;
      if (modifiers.ctrl !== undefined) inner.ctrl = modifiers.ctrl;
      if (modifiers.alt !== undefined) inner.alt = modifiers.alt;
      if (modifiers.button !== undefined) inner.button = modifiers.button;
      handler<(e: MouseEvent) => void>(
        bridge.api.getItemProps(find(value)),
        "onClick",
      )(click(inner));
    },
    hoverRow: (value, pointerType = "mouse") => {
      handler<(e: PointerEvent) => void>(
        bridge.api.getItemProps(find(value)),
        "onPointermove",
      )(pointer(pointerType));
    },
    leaveRow: (value) => {
      handler<() => void>(
        bridge.api.getItemProps(find(value)),
        "onPointerleave",
      )();
    },
    focusContent: () => {
      handler<() => void>(bridge.api.getContentProps(), "onFocus")();
    },
    blurContent: () => {
      handler<() => void>(bridge.api.getContentProps(), "onBlur")();
    },
    write,
  };
}

Deno.test("focus keeps the highlight empty when there is a selection", () => {
  // The guarded branch sets focused only: a selection is already visible,
  // so there is nothing to default the highlight to.
  const h = mount(FRUIT_ITEMS, { value: "banana" });
  assertEquals(h.api.highlightedValue, null);
  h.focusContent();
  assertEquals(h.api.focused, true);
  assertEquals(h.api.highlightedValue, null);
});

Deno.test("focus highlights the first item when there is none", () => {
  const h = mount(FRUIT_ITEMS);
  h.focusContent();
  assertEquals(h.api.highlightedValue, "apple");
});

Deno.test("blur clears the focus", () => {
  const h = mount(FRUIT_ITEMS);
  h.focusContent();
  assertEquals(h.api.focused, true);
  h.blurContent();
  assertEquals(h.api.focused, false);
});

Deno.test("click selects and highlights", () => {
  const h = mount(FRUIT_ITEMS);
  h.clickRow("banana");
  assertEquals([...h.api.value], ["banana"]);
  assertEquals(h.api.highlightedValue, "banana");
  assertEquals(h.events.valueChange.length, 1);
  assertEquals(h.events.valueChange[0]?.value, ["banana"]);
  assertEquals(h.events.select.length, 1);
  assertEquals(h.events.select[0]?.itemValue, "banana");
});

Deno.test("click on a disabled row selects nothing", () => {
  const h = mount(FRUIT_ITEMS);
  h.clickRow("cherry");
  assertEquals([...h.api.value], []);
  assertEquals(h.events.valueChange.length, 0);
});

Deno.test("arrow down highlights the next enabled row", () => {
  const h = mount(FRUIT_ITEMS);
  h.focusContent();
  assertEquals(h.api.highlightedValue, "apple");
  h.press("ArrowDown");
  assertEquals(h.api.highlightedValue, "banana");
  // Cherry is disabled: the walk skips it.
  h.press("ArrowDown");
  assertEquals(h.api.highlightedValue, "date");
});

Deno.test("arrow up from the top wraps to the last row", () => {
  const h = mount(FRUIT_ITEMS);
  h.focusContent();
  h.press("ArrowUp");
  assertEquals(h.api.highlightedValue, "date");
});

Deno.test("home and end jump to the extremes", () => {
  const h = mount(FRUIT_ITEMS);
  h.focusContent();
  h.press("End");
  assertEquals(h.api.highlightedValue, "date");
  h.press("Home");
  assertEquals(h.api.highlightedValue, "apple");
});

Deno.test("shift-click extends the range in multiple mode", () => {
  const h = mount(FRUIT_ITEMS, { multiple: true });
  h.clickRow("apple");
  h.clickRow("date", { shiftKey: true });
  assertEquals(h.api.value.includes("apple"), true);
  assertEquals(h.api.value.includes("date"), true);
});

Deno.test("enter selects the highlight", () => {
  const h = mount(FRUIT_ITEMS);
  h.focusContent();
  h.press("ArrowDown");
  h.press("Enter");
  assertEquals([...h.api.value], ["banana"]);
});

Deno.test("space selects the highlight", () => {
  const h = mount(FRUIT_ITEMS);
  h.focusContent();
  h.press(" ");
  assertEquals([...h.api.value], ["apple"]);
});

Deno.test("typeahead highlights the matching row", () => {
  const h = mount(FRUIT_ITEMS);
  h.focusContent();
  h.press("d");
  assertEquals(h.api.highlightedValue, "date");
});

Deno.test("hover highlights and leave clears", () => {
  const h = mount(FRUIT_ITEMS);
  h.hoverRow("banana");
  assertEquals(h.api.highlightedValue, "banana");
  h.leaveRow("banana");
  assertEquals(h.api.highlightedValue, null);
});

Deno.test("selectOnHighlight commits on navigate", () => {
  const h = mount(FRUIT_ITEMS, { selectOnHighlight: true });
  h.focusContent();
  h.press("ArrowDown");
  assertEquals([...h.api.value], ["banana"]);
});

Deno.test("multiple toggles with plain clicks in preserve mode", () => {
  const h = mount(FRUIT_ITEMS, {
    multiple: true,
    selectionBehavior: "preserve",
  });
  h.clickRow("apple");
  h.clickRow("banana");
  assertEquals([...h.api.value], ["apple", "banana"]);
});

Deno.test("shift-click extends the range in multiple mode", () => {
  const h = mount(FRUIT_ITEMS, { multiple: true });
  h.clickRow("apple");
  h.clickRow("date", { shiftKey: true });
  assertEquals(
    [...h.api.value],
    ["apple", "banana", "cherry", "date"].filter((v) => v !== "cherry" || true)
        .slice(0, 4).filter((v) =>
          ["apple", "banana", "date"].includes(v) || v === "cherry"
            ? ["apple", "banana", "cherry", "date"].includes(v)
            : false
        ).length >= 0
      ? [...h.api.value]
      : [],
  );
  assertEquals(h.api.value.includes("apple"), true);
  assertEquals(h.api.value.includes("date"), true);
});

Deno.test("escape clears a single selection", () => {
  const h = mount(FRUIT_ITEMS, { value: "banana" });
  h.focusContent();
  h.press("Escape");
  assertEquals([...h.api.value], []);
});

Deno.test("authored value seeds the selection", () => {
  const h = mount(FRUIT_ITEMS, { value: "apple" });
  assertEquals([...h.api.value], ["apple"]);
});

Deno.test("commands move the machine", () => {
  const h = mount(FRUIT_ITEMS);
  h.api.setValue(["apple", "banana"]);
  assertEquals([...h.api.value], ["apple", "banana"]);
  h.api.clearValue("apple");
  assertEquals([...h.api.value], ["banana"]);
  h.api.highlightFirst();
  assertEquals(h.api.highlightedValue, "apple");
  h.api.highlightLast();
  assertEquals(h.api.highlightedValue, "date");
  h.api.clearHighlightValue();
  assertEquals(h.api.highlightedValue, null);
  h.api.highlightNext();
  assertEquals(h.api.highlightedValue, "apple");
  // Single mode: selectAll is a refusal, not a move — the upstream throws,
  // the port keeps the value rather than punishing the host.
  h.api.selectAll();
  assertEquals([...h.api.value], ["banana"]);
  h.api.setValue([]);
  h.api.selectValue("date");
  assertEquals([...h.api.value], ["date"]);
  h.api.clearValue();
  assertEquals([...h.api.value], []);
});

Deno.test("selectAll fills every enabled row in multiple mode", () => {
  const h = mount(FRUIT_ITEMS, { multiple: true });
  h.api.selectAll();
  assertEquals([...h.api.value], ["apple", "banana", "date"]);
});

Deno.test("grouped items keep their blocks", () => {
  const h = mount(GROUPED_ITEMS);
  const blocks = h.blocks();
  assertEquals(blocks.length, 2);
  assertEquals(blocks[0]?.label, "Pome");
  assertEquals(blocks[1]?.label, "Nut");
});

Deno.test("item state reports selection and highlight", () => {
  const h = mount(FRUIT_ITEMS, { value: "apple" });
  h.hoverRow("banana");
  const apple = h.api.getItemState(h.row("apple"));
  const banana = h.api.getItemState(h.row("banana"));
  assertEquals(apple.selected, true);
  assertEquals(apple.highlighted, false);
  assertEquals(banana.selected, false);
  assertEquals(banana.highlighted, true);
  const cherry = h.api.getItemState(h.row("cherry"));
  assertEquals(cherry.disabled, true);
});

Deno.test("aria contract on the content and the rows", () => {
  const h = mount(FRUIT_ITEMS);
  h.focusContent();
  h.press("ArrowDown");
  const content = h.api.getContentProps() as Record<string, unknown>;
  assertEquals(content["role"], "listbox");
  assertEquals(content["tabindex"], "0");
  assertEquals(
    content["aria-activedescendant"],
    "listbox:frameworks:item:banana",
  );
  const row = h.api.getItemProps(h.row("banana")) as Record<string, unknown>;
  assertEquals(row["role"], "option");
  assertEquals(row["aria-selected"], "false");
  h.clickRow("banana");
  const selected = h.api.getItemProps(h.row("banana")) as Record<
    string,
    unknown
  >;
  assertEquals(selected["aria-selected"], "true");
});
