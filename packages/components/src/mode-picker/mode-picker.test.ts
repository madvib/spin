import { test } from "bun:test";
import assert, { deepStrictEqual } from "node:assert/strict";
import { parseHTML } from "@spinjs/components/testing";
import { signal } from "@spinjs/components/runtime";
import { modePicker } from "./mode-picker.presentation.ts";
const createModePickerBridge = modePicker.createBridge;
import type { ModePickerApi } from "./mode-picker.presentation.ts";
import type { ModePickerValueChange } from "./mode-picker.events.ts";

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

type WriteSignal = { (): unknown; (value: unknown): void };

interface Harness {
  readonly api: ModePickerApi;
  readonly root: Element;
  readonly events: { readonly valueChange: ModePickerValueChange[] };
  write(name: string, value: unknown): void;
}

function mount(overrides: Readonly<Record<string, unknown>> = {}): Harness {
  const root = document.createElement("div");
  document.body.appendChild(root);
  const events = { valueChange: [] as ModePickerValueChange[] };
  const values: Record<string, WriteSignal> = {};
  const authoredKeys = new Set(Object.keys(overrides));
  const write = (name: string, value: unknown): void => {
    const source = values[name];
    if (source === undefined) values[name] = signal<unknown>(value);
    else source(value);
  };
  for (const [name, value] of Object.entries(overrides)) write(name, value);
  if (!authoredKeys.has("modes")) {
    write("modes", ["light", "dark"]);
    authoredKeys.add("modes");
  }
  write(
    "onValueChange",
    (details: ModePickerValueChange) => events.valueChange.push(details),
  );
  const bridge = createModePickerBridge(
    () => {
      const record: Record<string, unknown> = {};
      for (const [name, source] of Object.entries(values)) {
        record[name] = source();
      }
      record["@@authored"] = (name: string): boolean => authoredKeys.has(name);
      return record;
    },
    () => root,
    "mode",
  );
  return { api: bridge.api, root, events, write };
}

function trigger(api: ModePickerApi): Record<string, unknown> {
  return api.getTriggerProps() as Record<string, unknown>;
}

test("cycles light → dark → system → light", () => {
  const { api, events } = mount({ value: "light" });
  deepStrictEqual(api.value, "light");
  (trigger(api)["onClick"] as () => void)();
  deepStrictEqual(api.value, "dark");
  (trigger(api)["onClick"] as () => void)();
  deepStrictEqual(api.value, "system");
  (trigger(api)["onClick"] as () => void)();
  deepStrictEqual(api.value, "light");
  deepStrictEqual(
    events.valueChange.map((change) => change.value),
    ["dark", "system", "light"],
  );
});

test("single-mode themes disable the trigger and clamp the resolved mode", () => {
  const lightOnly = mount({ value: "system", modes: ["light"] });
  deepStrictEqual(lightOnly.api.disabled, true);
  deepStrictEqual(lightOnly.api.resolvedMode, "light");
  (trigger(lightOnly.api)["onClick"] as () => void)();
  deepStrictEqual(lightOnly.api.value, "system");

  const darkOnly = mount({ value: "light", modes: ["dark"] });
  deepStrictEqual(darkOnly.api.disabled, true);
  deepStrictEqual(darkOnly.api.resolvedMode, "dark");
  deepStrictEqual(darkOnly.api.label, "Only dark mode");
});

test("hideWhenSingle hides the root on single-mode themes only", () => {
  const single = mount({ modes: ["light"], hideWhenSingle: true });
  deepStrictEqual(single.api.hidden, true);
  const root = single.api.getRootProps() as Record<string, unknown>;
  deepStrictEqual(root["hidden"], true);
  const dual = mount({ modes: ["light", "dark"], hideWhenSingle: true });
  deepStrictEqual(dual.api.hidden, false);
});

test("hideWhenSingle hides the trigger itself, not just the root", () => {
  const single = mount({ modes: ["dark"], hideWhenSingle: true });
  deepStrictEqual(trigger(single.api)["hidden"], true);
  deepStrictEqual(trigger(single.api)["disabled"], true);
  const shown = mount({ modes: ["light", "dark"], hideWhenSingle: true });
  deepStrictEqual(trigger(shown.api)["hidden"], undefined);
  const kept = mount({ modes: ["dark"] });
  deepStrictEqual(trigger(kept.api)["hidden"], undefined);
  deepStrictEqual(trigger(kept.api)["disabled"], true);
});

test("an unauthored mount adopts the stylesheet's declared modes", () => {
  const seen = globalThis.getComputedStyle;
  globalThis.getComputedStyle = (() => ({
    getPropertyValue: (name: string) => name === "--spin-modes" ? "dark" : "",
  })) as unknown as typeof getComputedStyle;
  try {
    const root = document.createElement("div");
    document.body.appendChild(root);
    const bridge = createModePickerBridge(
      () => ({
        onValueChange: () => {},
        "@@authored": () => false,
      }),
      () => root,
      "mode",
    );
    deepStrictEqual(bridge.api.modes, ["dark"]);
    deepStrictEqual(bridge.api.disabled, true);
    deepStrictEqual(bridge.api.resolvedMode, "dark");
  } finally {
    if (seen === undefined) delete globalThis.getComputedStyle;
    else globalThis.getComputedStyle = seen;
  }
});

test("a late declaration wins over the early dual guess", () => {
  const seen = globalThis.getComputedStyle;
  let declared = "";
  globalThis.getComputedStyle = (() => ({
    getPropertyValue: (name: string) => name === "--spin-modes" ? declared : "",
  })) as unknown as typeof getComputedStyle;
  try {
    const root = document.createElement("div");
    document.body.appendChild(root);
    const bridge = createModePickerBridge(
      () => ({
        onValueChange: () => {},
        "@@authored": () => false,
      }),
      () => root,
      "mode",
    );
    deepStrictEqual(bridge.api.modes, ["light", "dark"]);
    declared = "dark";
    const onClick = (bridge.api.getTriggerProps() as Record<string, unknown>)["onClick"] as () => void;
    onClick();
    deepStrictEqual(bridge.api.modes, ["dark"]);
    deepStrictEqual(bridge.api.disabled, true);
  } finally {
    if (seen === undefined) delete globalThis.getComputedStyle;
    else globalThis.getComputedStyle = seen;
  }
});

test("resolvedMode follows systemMode while choice is system", () => {
  const { api, write } = mount({ value: "system", systemMode: "light" });
  deepStrictEqual(api.resolvedMode, "light");
  write("systemMode", "dark");
  deepStrictEqual(api.resolvedMode, "dark");
});

test("an authored value seeds the choice and a host write moves it", () => {
  const { api, events, write } = mount({ value: "dark" });
  deepStrictEqual(api.value, "dark");
  deepStrictEqual(events.valueChange.length, 0);
  write("value", "light");
  deepStrictEqual(api.value, "light");
  deepStrictEqual(events.valueChange.length, 1);
  assert(events.valueChange[0]?.resolvedMode === "light");
});

test("the trigger names the mode it switches to, not the one worn", () => {
  const { api } = mount({ value: "light" });
  deepStrictEqual(api.next, "dark");
  deepStrictEqual(api.label, "Switch to dark mode");
  deepStrictEqual(trigger(api)["aria-label"], "Switch to dark mode");
  (trigger(api)["onClick"] as () => void)();
  deepStrictEqual(api.next, "system");
  deepStrictEqual(api.label, "Switch to system mode");
});

test("a modes declaration identical to context assigns nothing", () => {
  const { api } = mount({ modes: ["light", "dark"] });
  const before = api.modes;
  api.setModes(["light", "dark"]);
  deepStrictEqual(api.modes, before);
  assert(api.modes === before, "the stylesheet observer must not churn context");
});
