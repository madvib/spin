import { test } from "bun:test";
import { deepStrictEqual } from "node:assert/strict";
import { parseHTML } from "@spinjs/components/testing";
import { hoverDelay } from "./hover-delay.ts";

const win = parseHTML("<!doctype html><html><body></body></html>") as unknown as Record<string, unknown>;
declare const globalThis: Record<string, unknown>;
globalThis.document = win.document;
globalThis.CustomEvent = win.CustomEvent;
globalThis.HTMLElement = win.HTMLElement;
globalThis.Element = win.Element;

function windowEvent(source: unknown): typeof Event {
  if (!(source instanceof Object) || !("Event" in source)) {
    throw new Error("the parsed document exposes no window");
  }
  const ctor: unknown = source.Event;
  if (typeof ctor !== "function") throw new Error("the window exposes no Event");
  return ctor as typeof Event;
}

const WindowEvent = windowEvent(win["window"]);

function pointer(type: string): Event {
  const event = new WindowEvent(type, { bubbles: true }) as unknown as Record<string, unknown>;
  event["pointerType"] = "mouse";
  return event as unknown as Event;
}

const tick = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

test("Given a rest past the open delay / When the pointer dwells / Then onOpen fires once", async () => {
  const node = document.createElement("button");
  document.body.appendChild(node);
  let opens = 0;
  const result = hoverDelay(node, { openDelay: 20, onOpen: () => opens++ });
  node.dispatchEvent(pointer("pointerenter"));
  await tick(60);
  deepStrictEqual(opens, 1, "the dwell opens once");
  result?.destroy?.();
});

test("Given a leave before the open delay / When the pointer exits early / Then onOpen never fires", async () => {
  const node = document.createElement("button");
  document.body.appendChild(node);
  let opens = 0;
  const result = hoverDelay(node, { openDelay: 50, onOpen: () => opens++ });
  node.dispatchEvent(pointer("pointerenter"));
  node.dispatchEvent(pointer("pointerleave"));
  await tick(90);
  deepStrictEqual(opens, 0, "leaving cancels the pending open");
  result?.destroy?.();
});

test("Given an open surface / When the pointer leaves past the close delay / Then onClose fires", async () => {
  const node = document.createElement("button");
  document.body.appendChild(node);
  let closes = 0;
  const result = hoverDelay(node, { openDelay: 0, closeDelay: 20, onClose: () => closes++ });
  node.dispatchEvent(pointer("pointerenter"));
  node.dispatchEvent(pointer("pointerleave"));
  await tick(60);
  deepStrictEqual(closes, 1, "the absence closes once");
  result?.destroy?.();
});

test("Given a pending close / When the pointer re-enters / Then onClose never fires", async () => {
  const node = document.createElement("button");
  document.body.appendChild(node);
  let closes = 0;
  const result = hoverDelay(node, { openDelay: 0, closeDelay: 50, onClose: () => closes++ });
  node.dispatchEvent(pointer("pointerenter"));
  node.dispatchEvent(pointer("pointerleave"));
  node.dispatchEvent(pointer("pointerenter"));
  await tick(90);
  deepStrictEqual(closes, 0, "re-entering cancels the pending close");
  result?.destroy?.();
});

test("Given a touch pointer / When it enters / Then no dwell clock starts", async () => {
  const node = document.createElement("button");
  document.body.appendChild(node);
  let opens = 0;
  const result = hoverDelay(node, { openDelay: 10, onOpen: () => opens++ });
  const event = new WindowEvent("pointerenter", { bubbles: true }) as unknown as Record<string, unknown>;
  event["pointerType"] = "touch";
  node.dispatchEvent(event as unknown as Event);
  await tick(40);
  deepStrictEqual(opens, 0, "touch never opens a hover surface");
  result?.destroy?.();
});
