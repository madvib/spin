import { assert, assertEquals } from "@std/assert";
import { parseHTML } from "@spin/runtime/testing";
import { signal } from "@spin/runtime";
import { toggle } from "./toggle.def.ts";
const createToggleBridge = toggle.createBridge;
import type { ToggleApi } from "./toggle.def.ts";
import type {
  TogglePressedChange,
} from "./toggle.machine.ts";

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

function mount(overrides: Readonly<Record<string, unknown>> = {}): {
  api: ToggleApi;
  events: { pressedChange: TogglePressedChange[] };
} {
  const root = document.createElement("div");
  document.body.appendChild(root);
  const events = {
    pressedChange: [] as TogglePressedChange[],
  };
  const values: Record<string, WriteSignal> = {};
  const authoredKeys = new Set(Object.keys(overrides));
  const write = (name: string, value: unknown): void => {
    const source = values[name];
    if (source === undefined) values[name] = signal<unknown>(value);
    else source(value);
  };
  for (const [name, value] of Object.entries(overrides)) write(name, value);
  write("onPressedChange", (details: TogglePressedChange) => events.pressedChange.push(details));
  const bridge = createToggleBridge(
    () => {
      const record: Record<string, unknown> = {};
      for (const [name, source] of Object.entries(values)) record[name] = source();
      record["@@authored"] = (name: string): boolean => authoredKeys.has(name);
      return record;
    },
    () => root,
    "toggle",
  );
  const api = bridge.api as unknown as ToggleApi;
  return { api, events };
}

const click = (): MouseEvent => ({ defaultPrevented: false }) as unknown as MouseEvent;

function root(api: ToggleApi): Record<string, unknown> {
  return api.getRootProps();
}

Deno.test("an unpressed toggle presses and releases on click", () => {
  const { api, events } = mount();
  assertEquals(api.pressed, false);
  handler<(e: MouseEvent) => void>(root(api), "onClick")(click());
  assertEquals(api.pressed, true);
  assert(api.isPressed());
  assertEquals(events.pressedChange.map((change) => change.pressed), [true]);
  handler<(e: MouseEvent) => void>(root(api), "onClick")(click());
  assertEquals(api.pressed, false);
  assertEquals(events.pressedChange.map((change) => change.pressed), [true, false]);
});

Deno.test("an authored defaultPressed alone presses (uncontrolled seed)", () => {
  const { api } = mount({ defaultPressed: true });
  assertEquals(api.pressed, true);
  assert(api.isPressed());
});

Deno.test("a disabled toggle ignores clicks", () => {
  const { api, events } = mount({ disabled: true });
  handler<(e: MouseEvent) => void>(root(api), "onClick")(click());
  assertEquals(api.pressed, false);
  assertEquals(events.pressedChange.length, 0);
});

Deno.test("setPressed drives the bit (controlled host)", () => {
  const { api } = mount({ pressed: false });
  api.setPressed(true);
  assertEquals(api.pressed, true);
  assert(api.isPressed());
});
