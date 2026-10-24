import { test } from "bun:test";
import { deepStrictEqual } from "node:assert/strict";
import { parseHTML } from "@spin/runtime/testing";
import { drag, type DragDelta, type DragPress } from "./drag.ts";

const win = parseHTML("<!doctype html><html><body></body></html>") as unknown as Record<string, unknown>;
declare const globalThis: Record<string, unknown>;
globalThis.document = win.document;
globalThis.CustomEvent = win.CustomEvent;
globalThis.HTMLElement = win.HTMLElement;
globalThis.Element = win.Element;

function pointerEvent(
  source: unknown,
  type: string,
  x: number,
  y: number,
  extras: Record<string, unknown> = {},
): PointerEvent {
  const winLocal = source as Record<string, unknown>;
  if (typeof winLocal.Event !== "function") throw new Error("no Event");
  const made = new (winLocal.Event as new (type: string, init?: unknown) => Event)(type) as unknown as Record<string, unknown>;
  made["clientX"] = x;
  made["clientY"] = y;
  made["button"] = 0;
  made["altKey"] = false;
  made["shiftKey"] = false;
  made["preventDefault"] = (): void => undefined;
  made["key"] = "";
  Object.assign(made, extras);
  return made as unknown as PointerEvent;
}

/**
 * linkedom ships no PointerEvent constructor, so the doc-level events are
 * the window's Event with the pointer fields set on it.
 */
const fireDoc = (type: string, x: number, y: number, extras: Record<string, unknown> = {}): void => {
  const event = pointerEvent(win["window"], type, x, y, extras);
  document.dispatchEvent(event as unknown as Event);
};

test("Given an armed handle / When the pointer moves / Then the delta is from the press point", () => {
  const node = document.createElement("button");
  document.body.appendChild(node);
  const moves: DragDelta[] = [];
  const ended: boolean[] = [];
  const result = drag(node, {
    onMove: (delta) => moves.push(delta),
    onEnd: (end) => ended.push(end.cancelled),
  });
  node.dispatchEvent(pointerEvent(win["window"], "pointerdown", 100, 100) as unknown as Event);
  fireDoc("pointermove", 130, 90);
  fireDoc("pointermove", 160, 90);
  deepStrictEqual(moves.length, 2, "one report per move");
  deepStrictEqual(moves[0]?.dx, 30, "x delta is from the press point");
  deepStrictEqual(moves[0]?.dy, -10, "y delta is signed");
  deepStrictEqual(moves[1]?.dx, 60, "the second move reports from the same origin");
  fireDoc("pointerup", 160, 90);
  deepStrictEqual(ended, [false], "pointerup ends without a cancel");
  result?.destroy?.();
});

test("Given an armed handle / When Escape arrives / Then the gesture cancels", () => {
  const node = document.createElement("button");
  document.body.appendChild(node);
  const ended: boolean[] = [];
  const result = drag(node, { onEnd: (end) => ended.push(end.cancelled) });
  node.dispatchEvent(pointerEvent(win["window"], "pointerdown", 10, 10) as unknown as Event);
  fireDoc("keydown", 0, 0, { key: "Escape" });
  deepStrictEqual(ended, [true], "escape reports a cancelled end");
  // And the listeners are gone: a later move reports nothing.
  fireDoc("pointermove", 50, 50);
  fireDoc("pointerup", 50, 50);
  deepStrictEqual(ended.length, 1, "no second end after the cancel");
  result?.destroy?.();
});

test("Given a press on a button inside the handle / When it lands / Then the gesture does not start", () => {
  const node = document.createElement("div");
  const child = document.createElement("button");
  node.appendChild(child);
  document.body.appendChild(node);
  let starts = 0;
  const result = drag(node, { onStart: () => starts++ });
  // The press's target is the inner button (linkedom's dispatchEvent keeps
  // the target on the way up).
  const event = pointerEvent(win["window"], "pointerdown", 10, 10);
  child.dispatchEvent(event as unknown as Event);
  deepStrictEqual(starts, 0, "an inner control keeps its click");
  result?.destroy?.();
});

test("Given a disabled handle / When pressed / Then no gesture starts", () => {
  const node = document.createElement("button");
  document.body.appendChild(node);
  let starts = 0;
  const result = drag(node, { enabled: false, onStart: () => starts++ });
  node.dispatchEvent(pointerEvent(win["window"], "pointerdown", 10, 10) as unknown as Event);
  deepStrictEqual(starts, 0, "the disabled handle never arms");
  result?.destroy?.();
});

test("Given a right press / When it lands on the handle / Then it is ignored", () => {
  const node = document.createElement("button");
  document.body.appendChild(node);
  const moves: DragDelta[] = [];
  const result = drag(node, { onMove: (delta) => moves.push(delta) });
  node.dispatchEvent(pointerEvent(win["window"], "pointerdown", 10, 10, { button: 2 }) as unknown as Event);
  fireDoc("pointermove", 40, 40);
  deepStrictEqual(moves.length, 0, "a right-press never drags");
  result?.destroy?.();
});

test("Given an armed handle / When it unmounts mid-gesture / Then the listeners detach", () => {
  const node = document.createElement("button");
  document.body.appendChild(node);
  const moves: DragDelta[] = [];
  const result = drag(node, { onMove: (delta) => moves.push(delta) });
  node.dispatchEvent(pointerEvent(win["window"], "pointerdown", 10, 10) as unknown as Event);
  result?.destroy?.();
  fireDoc("pointermove", 40, 40);
  deepStrictEqual(moves.length, 0, "destroy detaches the document listeners");
});

test("Given an armed handle / When the pointer moves / Then the report carries the place and the box", () => {
  const node = document.createElement("button");
  document.body.appendChild(node);
  node.getBoundingClientRect = () =>
    ({ left: 5, top: 6, width: 20, height: 30 }) as DOMRect;
  const presses: DragPress[] = [];
  const moves: DragDelta[] = [];
  const result = drag(node, {
    onStart: (press) => presses.push(press),
    onMove: (delta) => moves.push(delta),
  });
  node.dispatchEvent(pointerEvent(win["window"], "pointerdown", 10, 10, { pointerId: 7 }) as unknown as Event);
  fireDoc("pointermove", 30, 40, { pointerId: 7 });
  deepStrictEqual(presses[0]?.x, 10, "the press reports its point");
  deepStrictEqual(presses[0]?.y, 10, "the press reports its point");
  deepStrictEqual(presses[0]?.pointerId, 7, "the press reports its pointer");
  deepStrictEqual(presses[0]?.rect?.width, 20, "the press reports the handle's box");
  deepStrictEqual(moves[0]?.x, 30, "the move reports where the pointer is");
  deepStrictEqual(moves[0]?.y, 40, "the move reports where the pointer is");
  deepStrictEqual(moves[0]?.dx, 20, "the delta still counts from the press");
  result?.destroy?.();
});

test("Given a handle that can capture / When the gesture starts / Then the pointer is captured and released", () => {
  const node = document.createElement("button");
  document.body.appendChild(node);
  const captured: number[] = [];
  const released: number[] = [];
  (node as unknown as { setPointerCapture: (id: number) => void }).setPointerCapture = (id) => {
    captured.push(id);
  };
  (node as unknown as { releasePointerCapture: (id: number) => void }).releasePointerCapture = (id) => {
    released.push(id);
  };
  const result = drag(node, {});
  node.dispatchEvent(pointerEvent(win["window"], "pointerdown", 10, 10, { pointerId: 3 }) as unknown as Event);
  deepStrictEqual(captured, [3], "the handle takes the pointer");
  fireDoc("pointerup", 10, 10, { pointerId: 3 });
  deepStrictEqual(released, [3], "the release hands it back");
  result?.destroy?.();
});

test("Given a handle that goes disabled / When the param updates / Then the next press does not arm", () => {
  const node = document.createElement("button");
  document.body.appendChild(node);
  let starts = 0;
  const result = drag(node, { enabled: true, onStart: () => starts++ });
  result?.update?.({ enabled: false, onStart: () => starts++ });
  node.dispatchEvent(pointerEvent(win["window"], "pointerdown", 10, 10) as unknown as Event);
  deepStrictEqual(starts, 0, "the live param keeps the handle from arming");
  result?.destroy?.();
});
