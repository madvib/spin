import { test } from "bun:test";
import assert, { deepStrictEqual } from "node:assert/strict";
import { parseHTML } from "@spinjs/components/testing";
import { signal } from "@spinjs/components/runtime";
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
  '[{"value":"minimal","label":"Silk"},{"value":"neobrutalist","label":"Neo Brutalism"}]';

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
  const { api, events } = mount({ value: "minimal" });
  deepStrictEqual(api.open, false);
  const trigger = api.getTriggerProps() as Record<string, unknown>;
  (trigger["onClick"] as () => void)();
  deepStrictEqual(api.open, true);
  (trigger["onClick"] as () => void)();
  deepStrictEqual(api.open, false);
  deepStrictEqual(events.openChange.map((change) => change.open), [true, false]);
});

test("keyboard highlight walks and Enter selects", () => {
  const { api } = mount({ value: "minimal" });
  const trigger = api.getTriggerProps() as Record<string, unknown>;
  (trigger["onClick"] as () => void)();
  const content = api.getContentProps() as Record<string, unknown>;
  const key = (keyName: string): void => {
    const made: Record<string, unknown> = { key: keyName, preventDefault: () => {} };
    (content["onKeyDown"] as (event: KeyboardEvent) => void)(made as unknown as KeyboardEvent);
  };
  key("ArrowDown");
  deepStrictEqual(api.highlightedValue, "neobrutalist");
  key("ArrowUp");
  deepStrictEqual(api.highlightedValue, "minimal");
  key("End");
  deepStrictEqual(api.highlightedValue, "neobrutalist");
  key("Home");
  deepStrictEqual(api.highlightedValue, "minimal");
  key("ArrowDown");
  key("Enter");
  deepStrictEqual(api.value, "neobrutalist");
  deepStrictEqual(api.open, false);
});

test("selecting an item commits value and closes", () => {
  const { api, events } = mount({ value: "minimal" });
  const trigger = api.getTriggerProps() as Record<string, unknown>;
  (trigger["onClick"] as () => void)();
  deepStrictEqual(api.selectedItem.value, "minimal");
  api.select("neobrutalist");
  deepStrictEqual(api.value, "neobrutalist");
  deepStrictEqual(api.open, false);
  deepStrictEqual(api.selectedItem.label, "Neo Brutalism");
  deepStrictEqual(events.valueChange.length, 1);
  assert(events.valueChange[0]?.item.value === "neobrutalist");
});

test("a disabled item refuses selection", () => {
  const { api } = mount({
    value: "minimal",
    themes:
      '[{"value":"minimal","label":"Silk"},{"value":"locked","label":"Locked","disabled":true}]',
  });
  const trigger = api.getTriggerProps() as Record<string, unknown>;
  (trigger["onClick"] as () => void)();
  api.select("locked");
  deepStrictEqual(api.value, "minimal");
  deepStrictEqual(api.open, true);
});

test("THEMES.SET replaces the items and clamps nothing", () => {
  const { api, write } = mount({ value: "minimal" });
  deepStrictEqual(api.items.length, 2);
  deepStrictEqual(api.empty, false);
  write("themes", [{ value: "console", label: "Console", modes: ["dark"] }]);
  deepStrictEqual(api.items.length, 1);
  deepStrictEqual(api.getItemState(api.items[0]!).dualMode, false);
  deepStrictEqual(api.getItemState({ value: "minimal", label: "Silk", modes: ["light", "dark"], disabled: false, index: 0 }).dualMode, true);
});

test("single-mode theme items report dualMode false", () => {
  const { api } = mount({
    themes: '[{"value":"console","label":"Console","modes":["dark"]}]',
  });
  deepStrictEqual(api.getItemState(api.items[0]!).dualMode, false);
});

test("selecting while closed commits without opening", () => {
  const { api, events } = mount({ value: "minimal" });
  deepStrictEqual(api.open, false);
  api.select("neobrutalist");
  deepStrictEqual(api.value, "neobrutalist");
  deepStrictEqual(api.open, false);
  deepStrictEqual(events.valueChange.length, 1);
});

test("syncDocument: false ignores stored theme in localStorage", () => {
  const prev = (globalThis as Record<string, unknown>)["localStorage"];
  (globalThis as Record<string, unknown>)["localStorage"] = {
    getItem: () => "minimal",
    setItem: () => {},
  };
  try {
    const { api } = mount({
      syncDocument: false,
      defaultValue: "silk",
      themes: [{ value: "silk", label: "Silk" }, { value: "nord", label: "Nord" }],
    });
    deepStrictEqual(api.value, "silk");
  } finally {
    (globalThis as Record<string, unknown>)["localStorage"] = prev;
  }
});
