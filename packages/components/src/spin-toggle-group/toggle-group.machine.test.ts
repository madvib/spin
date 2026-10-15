import { assert, assertEquals } from "@std/assert";
import { parseHTML } from "@spin/runtime/testing";
import { signal } from "@spin/runtime";
import { toggleGroup } from "./toggle-group.def.ts";
const createToggleGroupBridge = toggleGroup.createBridge;
import type { ToggleGroupApi } from "./toggle-group.def.ts";
import type { ToggleGroupValueChange } from "./toggle-group.machine.ts";

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

const ITEMS = '[{"value":"bold","label":"Bold"},{"value":"italic","label":"Italic"},{"value":"underline","label":"Underline"}]';

const click = (defaultPrevented = false): MouseEvent =>
  ({ defaultPrevented }) as unknown as MouseEvent;

function keydown(key: string, shift = false): KeyboardEvent {
  const made: Record<string, unknown> = {
    key,
    shiftKey: shift,
    isComposing: false,
    keyCode: 0,
    defaultPrevented: false,
  };
  made["preventDefault"] = (): void => {
    made["defaultPrevented"] = true;
  };
  return made as unknown as KeyboardEvent;
}

interface Harness {
  readonly api: ToggleGroupApi;
  readonly root: Element;
  readonly events: {
    readonly valueChange: ToggleGroupValueChange[];
  };
  write(name: string, value: unknown): void;
}

/** Props are signals, exactly as the element's prop store makes them, so a host
 * write re-runs the bridge's controlled-channel effect. A prop passed in
 * `overrides` is AUTHORED, which is the element's `@@authored` predicate. */
function mount(overrides: Readonly<Record<string, unknown>> = {}): Harness {
  const root = document.createElement("div");
  document.body.appendChild(root);
  const events = {
    valueChange: [] as ToggleGroupValueChange[],
  };
  const values: Record<string, WriteSignal> = {};
  const authoredKeys = new Set(Object.keys(overrides));
  const write = (name: string, value: unknown): void => {
    const source = values[name];
    if (source === undefined) values[name] = signal<unknown>(value);
    else source(value);
  };
  for (const [name, value] of Object.entries(overrides)) write(name, value);
  if (!authoredKeys.has("items")) {
    write("items", ITEMS);
    authoredKeys.add("items");
  }
  write("onValueChange", (details: ToggleGroupValueChange) => events.valueChange.push(details));
  const bridge = createToggleGroupBridge(
    () => {
      const record: Record<string, unknown> = {};
      for (const [name, source] of Object.entries(values)) record[name] = source();
      record["@@authored"] = (name: string): boolean => authoredKeys.has(name);
      return record;
    },
    () => root,
    "format",
  );
  return { api: bridge.api, root, events, write };
}

function item(api: ToggleGroupApi, value: string): Record<string, unknown> {
  return api.getItemProps({ value }) as Record<string, unknown>;
}

Deno.test("a click toggles the value and a second click deselects", () => {
  const { api, events } = mount();
  assertEquals(api.value, []);
  handler<(e: MouseEvent) => void>(item(api, "bold"), "onClick")(click());
  assertEquals(api.value, ["bold"]);
  assert(api.isPressed("bold"));
  handler<(e: MouseEvent) => void>(item(api, "bold"), "onClick")(click());
  assertEquals(api.value, []);
  assertEquals(events.valueChange.map((change) => change.value), [["bold"], []]);
});

Deno.test("multiple mode accumulates values", () => {
  const { api, events } = mount({ multiple: true });
  handler<(e: MouseEvent) => void>(item(api, "bold"), "onClick")(click());
  handler<(e: MouseEvent) => void>(item(api, "italic"), "onClick")(click());
  assertEquals(api.value, ["bold", "italic"]);
  handler<(e: MouseEvent) => void>(item(api, "bold"), "onClick")(click());
  assertEquals(api.value, ["italic"]);
  assertEquals(events.valueChange.length, 3);
});

Deno.test("arrows move the focused id with loop wrap", () => {
  const { api } = mount();
  handler<() => void>(item(api, "bold"), "onFocus")();
  handler<(e: KeyboardEvent) => void>(item(api, "bold"), "onKeydown")(keydown("ArrowRight"));
  assertEquals(api.getItemState({ value: "italic" }).focused, true);
  handler<(e: KeyboardEvent) => void>(item(api, "italic"), "onKeydown")(keydown("ArrowRight"));
  assertEquals(api.getItemState({ value: "underline" }).focused, true);
  // Loop wraps past the last item.
  handler<(e: KeyboardEvent) => void>(item(api, "underline"), "onKeydown")(keydown("ArrowRight"));
  assertEquals(api.getItemState({ value: "bold" }).focused, true);
});

Deno.test("Home and End jump the focused id", () => {
  const { api } = mount();
  handler<() => void>(item(api, "italic"), "onFocus")();
  handler<(e: KeyboardEvent) => void>(item(api, "italic"), "onKeydown")(keydown("End"));
  assertEquals(api.getItemState({ value: "underline" }).focused, true);
  handler<(e: KeyboardEvent) => void>(item(api, "underline"), "onKeydown")(keydown("Home"));
  assertEquals(api.getItemState({ value: "bold" }).focused, true);
});

Deno.test("a disabled item refuses clicks and keys", () => {
  const { api, events } = mount({
    items: '[{"value":"bold","label":"Bold","disabled":true},{"value":"italic","label":"Italic"}]',
  });
  handler<(e: MouseEvent) => void>(item(api, "bold"), "onClick")(click());
  assertEquals(api.value, []);
  handler<(e: KeyboardEvent) => void>(item(api, "bold"), "onKeydown")(keydown("ArrowRight"));
  assertEquals(api.value, []);
  assertEquals(events.valueChange.length, 0);
});

Deno.test("authored value seeds the group and a host write moves it", () => {
  const { api, events, write } = mount({ value: ["italic"] });
  assertEquals(api.value, ["italic"]);
  assertEquals(events.valueChange.length, 0);
  write("value", ["bold"]);
  assertEquals(api.value, ["bold"]);
  assertEquals(events.valueChange.length, 1);
});
