import { test } from "bun:test";
import assert, { deepStrictEqual } from "node:assert/strict";
import { parseHTML } from "@spinjs/runtime/testing";
import { signal } from "@spinjs/runtime";
import { avatar } from "./avatar.presentation.ts";
const createAvatarBridge = avatar.createBridge;
import type { AvatarApi } from "./avatar.presentation.ts";
import type { AvatarStatusChange } from "./avatar.events.ts";

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
  write(
    "onStatusChange",
    (details: AvatarStatusChange) => events.statusChange.push(details),
  );
  const bridge = createAvatarBridge(
    () => {
      const record: Record<string, unknown> = {};
      for (const [name, source] of Object.entries(values)) {
        record[name] = source();
      }
      record["@@authored"] = (name: string): boolean => authoredKeys.has(name);
      return record;
    },
    () => root,
    "user",
  );
  return { api: bridge.api, root, events, write };
}

test("a load resolves to loaded and an error to error", () => {
  const { api, events } = mount();
  deepStrictEqual(api.status, "loading");
  handler<() => void>(api.getImageProps(), "onLoad")();
  assert(api.loaded);
  deepStrictEqual(api.status, "loaded");
  handler<() => void>(api.getImageProps(), "onError")();
  assert(!api.loaded);
  deepStrictEqual(api.status, "error");
  deepStrictEqual(events.statusChange.map((change) => change.status), [
    "loaded",
    "error",
  ]);
});

test("an error recovers on load", () => {
  const { api } = mount();
  handler<() => void>(api.getImageProps(), "onError")();
  deepStrictEqual(api.status, "error");
  handler<() => void>(api.getImageProps(), "onLoad")();
  deepStrictEqual(api.status, "loaded");
});

test("a src change returns to loading", () => {
  const { api, events } = mount({ src: "a.png" });
  handler<() => void>(api.getImageProps(), "onLoad")();
  deepStrictEqual(api.status, "loaded");
  api.setSrc("b.png");
  deepStrictEqual(api.status, "loading");
  deepStrictEqual(events.statusChange.map((change) => change.status), [
    "loaded",
    "loading",
  ]);
});

test("the imperative reports drive the states", () => {
  const { api } = mount();
  api.setLoaded();
  deepStrictEqual(api.status, "loaded");
  api.setError();
  deepStrictEqual(api.status, "error");
});

test("authored src seeds the image and a host write reloads it", () => {
  const { api, events, write } = mount({ src: "a.png" });
  handler<() => void>(api.getImageProps(), "onLoad")();
  deepStrictEqual(api.status, "loaded");
  deepStrictEqual(events.statusChange.length, 1);
  write("src", "b.png");
  deepStrictEqual(api.status, "loading");
});

test("image and fallback visibility invert across loading, loaded, and error states", () => {
  const { api } = mount({ src: "avatar.png" });
  deepStrictEqual(api.getImageProps()["data-state"], "hidden");
  deepStrictEqual(api.getFallbackProps()["data-state"], "visible");

  api.setLoaded();
  deepStrictEqual(api.getImageProps()["data-state"], "visible");
  deepStrictEqual(api.getFallbackProps()["data-state"], "hidden");

  api.setError();
  deepStrictEqual(api.status, "error");
  deepStrictEqual(api.getImageProps()["data-state"], "hidden");
  deepStrictEqual(api.getFallbackProps()["data-state"], "visible");
});

test("the observer reports the node's live src, not the bag's captured one", () => {
  const { api } = mount({ src: "a.png" });
  handler<() => void>(api.getImageProps(), "onLoad")();
  deepStrictEqual(api.src, "a.png");
  const params = api.getImageProps()["use:observe"] as {
    onAttributes: (node: { getAttribute(name: string): string | null }) => void;
  };
  params.onAttributes({ getAttribute: () => "b.png" });
  deepStrictEqual(api.src, "b.png");
  deepStrictEqual(api.status, "loading");
});

test("the fallback announces the label, not the initials", () => {
  const { api } = mount({ label: "Paula Aster", fallback: "PA" });
  deepStrictEqual(api.getFallbackProps()["aria-label"], "Paula Aster");
});
