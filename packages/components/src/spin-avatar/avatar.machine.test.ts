import { assert, assertEquals } from "@std/assert";
import { parseHTML } from "@spin/runtime/testing";
import { signal } from "@spin/runtime";
import { avatar } from "./avatar.bindings.ts";
const createAvatarBridge = avatar.createBridge;
import type { AvatarApi } from "./avatar.bindings.ts";
import type { AvatarStatusChange } from "./avatar.machine.ts";

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

interface Harness {
  readonly api: AvatarApi;
  readonly root: Element;
  readonly events: {
    readonly statusChange: AvatarStatusChange[];
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
    statusChange: [] as AvatarStatusChange[],
  };
  const values: Record<string, WriteSignal> = {};
  const authoredKeys = new Set(Object.keys(overrides));
  const write = (name: string, value: unknown): void => {
    const source = values[name];
    if (source === undefined) values[name] = signal<unknown>(value);
    else source(value);
  };
  for (const [name, value] of Object.entries(overrides)) write(name, value);
  write("onStatusChange", (details: AvatarStatusChange) => events.statusChange.push(details));
  const bridge = createAvatarBridge(
    () => {
      const record: Record<string, unknown> = {};
      for (const [name, source] of Object.entries(values)) record[name] = source();
      record["@@authored"] = (name: string): boolean => authoredKeys.has(name);
      return record;
    },
    () => root,
    "user",
  );
  return { api: bridge.api, root, events, write };
}

Deno.test("a load resolves to loaded and an error to error", () => {
  const { api, events } = mount();
  assertEquals(api.status, "loading");
  handler<() => void>(api.getImageProps(), "onLoad")();
  assert(api.loaded);
  assertEquals(api.status, "loaded");
  handler<() => void>(api.getImageProps(), "onError")();
  assert(!api.loaded);
  assertEquals(api.status, "error");
  assertEquals(events.statusChange.map((change) => change.status), ["loaded", "error"]);
});

Deno.test("an error recovers on load", () => {
  const { api } = mount();
  handler<() => void>(api.getImageProps(), "onError")();
  assertEquals(api.status, "error");
  handler<() => void>(api.getImageProps(), "onLoad")();
  assertEquals(api.status, "loaded");
});

Deno.test("a src change returns to loading", () => {
  const { api, events } = mount({ src: "a.png" });
  handler<() => void>(api.getImageProps(), "onLoad")();
  assertEquals(api.status, "loaded");
  api.setSrc("b.png");
  assertEquals(api.status, "loading");
  assertEquals(events.statusChange.map((change) => change.status), ["loaded", "loading"]);
});

Deno.test("the imperative reports drive the states", () => {
  const { api } = mount();
  api.setLoaded();
  assertEquals(api.status, "loaded");
  api.setError();
  assertEquals(api.status, "error");
});

Deno.test("authored src seeds the image and a host write reloads it", () => {
  const { api, events, write } = mount({ src: "a.png" });
  handler<() => void>(api.getImageProps(), "onLoad")();
  assertEquals(api.status, "loaded");
  assertEquals(events.statusChange.length, 1);
  write("src", "b.png");
  assertEquals(api.status, "loading");
});
