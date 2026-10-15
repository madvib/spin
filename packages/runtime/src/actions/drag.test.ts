import { assertEquals } from "@std/assert";
import { parseHTML } from "@spin/runtime/testing";
import { drag, type DragDelta } from "./drag.ts";

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

Deno.test("Given an armed handle / When the pointer moves / Then the delta is from the press point", () => {
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
  assertEquals(moves.length, 2, "one report per move");
  assertEquals(moves[0]?.dx, 30, "x delta is from the press point");
  assertEquals(moves[0]?.dy, -10, "y delta is signed");
  assertEquals(moves[1]?.dx, 60, "the second move reports from the same origin");
  fireDoc("pointerup", 160, 90);
  assertEquals(ended, [false], "pointerup ends without a cancel");
  result?.destroy?.();
});

Deno.test("Given an armed handle / When Escape arrives / Then the gesture cancels", () => {
  const node = document.createElement("button");
  document.body.appendChild(node);
  const ended: boolean[] = [];
  const result = drag(node, { onEnd: (end) => ended.push(end.cancelled) });
  node.dispatchEvent(pointerEvent(win["window"], "pointerdown", 10, 10) as unknown as Event);
  fireDoc("keydown", 0, 0, { key: "Escape" });
  assertEquals(ended, [true], "escape reports a cancelled end");
  // And the listeners are gone: a later move reports nothing.
  fireDoc("pointermove", 50, 50);
  fireDoc("pointerup", 50, 50);
  assertEquals(ended.length, 1, "no second end after the cancel");
  result?.destroy?.();
});

Deno.test("Given a press on a button inside the handle / When it lands / Then the gesture does not start", () => {
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
  assertEquals(starts, 0, "an inner control keeps its click");
  result?.destroy?.();
});

Deno.test("Given a disabled handle / When pressed / Then no gesture starts", () => {
  const node = document.createElement("button");
  document.body.appendChild(node);
  let starts = 0;
  const result = drag(node, { enabled: false, onStart: () => starts++ });
  node.dispatchEvent(pointerEvent(win["window"], "pointerdown", 10, 10) as unknown as Event);
  assertEquals(starts, 0, "the disabled handle never arms");
  result?.destroy?.();
});

Deno.test("Given a right press / When it lands on the handle / Then it is ignored", () => {
  const node = document.createElement("button");
  document.body.appendChild(node);
  const moves: DragDelta[] = [];
  const result = drag(node, { onMove: (delta) => moves.push(delta) });
  node.dispatchEvent(pointerEvent(win["window"], "pointerdown", 10, 10, { button: 2 }) as unknown as Event);
  fireDoc("pointermove", 40, 40);
  assertEquals(moves.length, 0, "a right-press never drags");
  result?.destroy?.();
});

Deno.test("Given an armed handle / When it unmounts mid-gesture / Then the listeners detach", () => {
  const node = document.createElement("button");
  document.body.appendChild(node);
  const moves: DragDelta[] = [];
  const result = drag(node, { onMove: (delta) => moves.push(delta) });
  node.dispatchEvent(pointerEvent(win["window"], "pointerdown", 10, 10) as unknown as Event);
  result?.destroy?.();
  fireDoc("pointermove", 40, 40);
  assertEquals(moves.length, 0, "destroy detaches the document listeners");
});
