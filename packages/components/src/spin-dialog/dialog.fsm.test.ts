import { assertEquals } from "@std/assert";
import { parseHTML } from "@spin/runtime/testing";
import { createDialogFsmBridge } from "./dialog.fsm.ts";
import type { DialogFsmBridgeApi } from "./dialog.fsm.ts";

const win = parseHTML("<!doctype html><html><body></body></html>") as unknown as Record<string, unknown>;
declare const globalThis: Record<string, unknown>;
globalThis.document = win.document;
globalThis.CustomEvent = win.CustomEvent;

/** Un-authored props: the host never writes `open`, so only events move it. */
const props = (): Record<string, unknown> => ({
  modal: true,
  trapFocus: true,
  preventScroll: true,
  closeOnEscape: true,
  closeOnInteractOutside: true,
  restoreFocus: true,
  role: "dialog",
  defaultOpen: false,
});

/** The bridge under test, with a root the connect can read. */
function harness(): { api: DialogFsmBridgeApi; dispose(): void } {
  const root = (win.document as { createElement(tag: string): Element }).createElement("div");
  (win.document as unknown as { body: Element }).body.appendChild(root);
  return createDialogFsmBridge(props, () => root, "test");
}

Deno.test("dialog api enumerates once, commands included", () => {
  const h = harness();
  // The element loader enumerates the api to forward reads onto the element;
  // a proxy that reports the same key twice throws from Object.keys.
  const keys = Object.keys(h.api);
  assertEquals(new Set(keys).size, keys.length, "every api key enumerates exactly once");
  h.dispose();
});

Deno.test("dialog commands move the machine", () => {
  const h = harness();
  assertEquals(h.api.open, false, "starts closed");
  h.api.show();
  assertEquals(h.api.open, true, "show opens");
  assertEquals(h.api.getTriggerProps()["data-state"], "open", "the trigger bag follows the state");
  h.api.hide("escape");
  assertEquals(h.api.open, false, "hide closes");
  h.dispose();
});
