import { test } from "bun:test";
import assert, { deepStrictEqual } from "node:assert/strict";
import { parseHTML } from "@spinjs/runtime/testing";
import { signal } from "@spinjs/runtime";
import { themePicker } from "./theme-picker.presentation.ts";
const createThemePickerBridge = themePicker.createBridge;
import type { ThemePickerApi } from "./theme-picker.presentation.ts";
import type {
  ThemePickerOpenChange,
  ThemePickerValueChange,
} from "./theme-picker.events.ts";

const win = parseHTML(
  "<!doctype html><html><body></body></html>",
) as unknown as Record<string, unknown>;
declare const globalThis: Record<string, unknown>;
globalThis.document = win.document;
globalThis.CustomEvent = win.CustomEvent;
globalThis.HTMLElement = win.HTMLElement;
globalThis.Element = win.Element;
globalThis.localStorage = {
  getItem: () => null,
  setItem: () => {},
} as unknown as Storage;

interface WriteSignal {
  (): unknown;
  (value: unknown): void;
}

interface Harness {
  readonly api: ThemePickerApi;
  readonly root: Element;
  readonly events: {
    readonly valueChange: ThemePickerValueChange[];
    readonly openChange: ThemePickerOpenChange[];
  };
  write(name: string, value: unknown): void;
}

const THEMES =
  '[{"value":"silk","label":"Silk"},{"value":"neobrut","label":"Neo Brutalism"}]';

function mount(overrides: Readonly<Record<string, unknown>> = {}): Harness {
  const root = document.createElement("div");
  document.body.appendChild(root);
  const events = {
    valueChange: [] as ThemePickerValueChange[],
    openChange: [] as ThemePickerOpenChange[],
  };
  const values: Record<string, WriteSignal> = {};
  const authoredKeys = new Set(Object.keys(overrides));
  const write = (name: string, value: unknown): void => {
    const source = values[name];
    if (source === undefined) values[name] = signal<unknown>(value);
    else source(value);
  };
  for (const [name, value] of Object.entries(overrides)) write(name, value);
  if (!authoredKeys.has("themes")) {
    write("themes", THEMES);
    authoredKeys.add("themes");
  }
  write(
    "onValueChange",
    (details: ThemePickerValueChange) => events.valueChange.push(details),
  );
  write(
    "onOpenChange",
    (details: ThemePickerOpenChange) => events.openChange.push(details),
  );
  const bridge = createThemePickerBridge(
    () => {
      const record: Record<string, unknown> = {};
      for (const [name, source] of Object.entries(values)) {
        record[name] = source();
      }
      record["@@authored"] = (name: string): boolean => authoredKeys.has(name);
      return record;
    },
    () => root,
    "theme",
  );
  return { api: bridge.api, root, events, write };
}

test("trigger click opens and closes the listbox", () => {
  const { api, events } = mount({ value: "silk" });
  deepStrictEqual(api.open, false);
  const trigger = api.getTriggerProps() as Record<string, unknown>;
  (trigger["onClick"] as () => void)();
  deepStrictEqual(api.open, true);
  (trigger["onClick"] as () => void)();
  deepStrictEqual(api.open, false);
  deepStrictEqual(events.openChange.map((change) => change.open), [true, false]);
});

test("keyboard highlight walks and Enter selects", () => {
  const { api } = mount({ value: "silk" });
  const trigger = api.getTriggerProps() as Record<string, unknown>;
  (trigger["onClick"] as () => void)();
  const content = api.getContentProps() as Record<string, unknown>;
  const key = (keyName: string): void => {
    const made: Record<string, unknown> = { key: keyName, preventDefault: () => {} };
    (content["onKeyDown"] as (event: KeyboardEvent) => void)(made as unknown as KeyboardEvent);
  };
  key("ArrowDown");
  deepStrictEqual(api.highlightedValue, "neobrut");
  key("ArrowUp");
  deepStrictEqual(api.highlightedValue, "silk");
  key("End");
  deepStrictEqual(api.highlightedValue, "neobrut");
  key("Home");
  deepStrictEqual(api.highlightedValue, "silk");
  key("ArrowDown");
  key("Enter");
  deepStrictEqual(api.value, "neobrut");
  deepStrictEqual(api.open, false);
});

test("selecting an item commits value and closes", () => {
  const { api, events } = mount({ value: "silk" });
  const trigger = api.getTriggerProps() as Record<string, unknown>;
  (trigger["onClick"] as () => void)();
  deepStrictEqual(api.selectedItem.value, "silk");
  api.select("neobrut");
  deepStrictEqual(api.value, "neobrut");
  deepStrictEqual(api.open, false);
  deepStrictEqual(api.selectedItem.label, "Neo Brutalism");
  deepStrictEqual(events.valueChange.length, 1);
  assert(events.valueChange[0]?.item.value === "neobrut");
});

test("a disabled item refuses selection", () => {
  const { api } = mount({
    value: "silk",
    themes:
      '[{"value":"silk","label":"Silk"},{"value":"locked","label":"Locked","disabled":true}]',
  });
  const trigger = api.getTriggerProps() as Record<string, unknown>;
  (trigger["onClick"] as () => void)();
  api.select("locked");
  deepStrictEqual(api.value, "silk");
  deepStrictEqual(api.open, true);
});

test("THEMES.SET replaces the items and clamps nothing", () => {
  const { api, write } = mount({ value: "silk" });
  deepStrictEqual(api.items.length, 2);
  deepStrictEqual(api.empty, false);
  write("themes", [{ value: "console", label: "Console", modes: ["dark"] }]);
  deepStrictEqual(api.items.length, 1);
  deepStrictEqual(api.getItemState(api.items[0]!).dualMode, false);
  deepStrictEqual(api.getItemState({ value: "silk", label: "Silk", modes: ["light", "dark"], disabled: false, index: 0 }).dualMode, true);
});

test("single-mode theme items report dualMode false", () => {
  const { api } = mount({
    themes: '[{"value":"console","label":"Console","modes":["dark"]}]',
  });
  deepStrictEqual(api.getItemState(api.items[0]!).dualMode, false);
});

test("selecting while closed commits without opening", () => {
  const { api, events } = mount({ value: "silk" });
  deepStrictEqual(api.open, false);
  api.select("neobrut");
  deepStrictEqual(api.value, "neobrut");
  deepStrictEqual(api.open, false);
  deepStrictEqual(events.valueChange.length, 1);
});
