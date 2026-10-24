import { test } from "bun:test";
import { deepStrictEqual } from "node:assert/strict";
import { parseHTML } from "@spinjs/runtime/testing";
import { provideController, type SpinController } from "@spinjs/runtime";
import { spinComponentCtl } from "./controller.ts";

const win = parseHTML(
  "<!doctype html><html><body></body></html>",
) as unknown as Record<string, unknown>;
declare const globalThis: Record<string, unknown>;
globalThis.document = win.document;
globalThis.CustomEvent = win.CustomEvent;

/**
 * The ctl is available the moment the host holds the element — `bind`
 * writes props and subscribes events with no wait, so a seed lands before
 * the component's build reads it. `commands` and `state` resolve through the
 * registered controller once it exists; before then they read empty.
 */

function element(): Element {
  return document.createElement("div");
}

test("spinComponentCtl binds before any controller registers", () => {
  const el = element();
  const ctl = spinComponentCtl(el);
  const seen: string[] = [];
  const unbind = ctl.bind({ items: [1, 2] }, {
    "value-change": () => seen.push("event"),
  });
  deepStrictEqual((el as unknown as Record<string, unknown>)["items"], [1, 2]);
  el.dispatchEvent(new CustomEvent("value-change"));
  deepStrictEqual(seen, ["event"]);
  unbind();
  el.dispatchEvent(new CustomEvent("value-change"));
  deepStrictEqual(seen, ["event"], "unbind detaches the subscription");
});

test("spinComponentCtl reads empty commands and state before connect", () => {
  const el = element();
  const ctl = spinComponentCtl(el);
  deepStrictEqual(Object.keys(ctl.commands).length, 0);
  deepStrictEqual(Object.keys(ctl.state).length, 0);
});

test("spinComponentCtl resolves commands and state once provided", () => {
  const el = element();
  const ctl = spinComponentCtl(el);
  let open = false;
  const controller: SpinController = {
    commands: {
      show: () => {
        open = true;
      },
    },
    state: { open: () => open },
  };
  provideController(el, () => controller);
  deepStrictEqual(
    typeof (ctl.commands as Record<string, unknown>)["show"],
    "function",
  );
  (ctl.commands as { show(): void }).show();
  deepStrictEqual(open, true);
  deepStrictEqual(ctl.state["open"]?.(), true);
});
