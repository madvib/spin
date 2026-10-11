import { assertEquals } from "@std/assert";
import { parseHTML } from "@spin/runtime/testing";
import { createTabsBridge } from "./tabs.fsm.ts";
import type { TabsFsmBridgeApi } from "./tabs.fsm.ts";
import type { TreeNode } from "./tabs.fsm-connect.ts";

const win = parseHTML("<!doctype html><html><body></body></html>") as unknown as Record<string, unknown>;
declare const globalThis: Record<string, unknown>;
globalThis.document = win.document;
globalThis.CustomEvent = win.CustomEvent;

const rows: readonly TreeNode[] = [
  { value: "one", label: "One", content: "First panel" },
  { value: "two", label: "Two", content: "Second panel" },
];

/** Un-authored props: the host never writes `value`, so commands drive it. */
const props = (): Record<string, unknown> => ({
  items: rows,
  defaultValue: "one",
  activationMode: "automatic",
});

/** The bridge under test, with a root the connect can read. */
function harness(): { api: TabsFsmBridgeApi; dispose(): void } {
  const root = (win.document as { createElement(tag: string): Element }).createElement("div");
  return createTabsBridge(props, () => root, "test");
}

Deno.test("tabs api enumerates once, commands included", () => {
  const h = harness();
  // The element loader enumerates the api to forward reads onto the element;
  // a proxy that reports the same key twice throws from Object.keys.
  const keys = Object.keys(h.api);
  assertEquals(new Set(keys).size, keys.length, "every api key enumerates exactly once");
  h.dispose();
});

Deno.test("tabs commands select and focus", () => {
  const h = harness();
  assertEquals(h.api.value, "one", "seeded from defaultValue");
  h.api.select("two");
  assertEquals(h.api.value, "two", "select moves the value");
  h.api.focus("one");
  assertEquals(h.api.value, "one", "focus follows with automatic activation");
  h.dispose();
});
