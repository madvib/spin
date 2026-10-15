import { assertEquals } from "@std/assert";
import { parseHTML } from "@spin/runtime/testing";
import { anchor, type AnchorGeometry } from "./anchor.ts";

const win = parseHTML("<!doctype html><html><body></body></html>") as unknown as Record<string, unknown>;
declare const globalThis: Record<string, unknown>;
globalThis.document = win.document;
globalThis.HTMLElement = win.HTMLElement;
globalThis.Element = win.Element;

function rect(left: number, top: number, width: number, bottom: number): DOMRect {
  return { left, top, width, height: 10, bottom, right: left + width, x: left, y: top, toJSON: () => ({}) };
}

Deno.test("Given room below / When attached / Then geometry sits the panel under the anchor", () => {
  const host = document.createElement("div");
  const trigger = document.createElement("button");
  const panel = document.createElement("div");
  host.appendChild(trigger);
  host.appendChild(panel);
  document.body.appendChild(host);
  trigger.getBoundingClientRect = () => rect(40, 100, 120, 120);
  Object.defineProperty(host, "getBoundingClientRect", { value: () => rect(0, 0, 800, 600) });
  Object.defineProperty(panel, "offsetHeight", { value: 100 });
  Object.defineProperty(panel, "offsetParent", { value: host });

  const seen: AnchorGeometry[] = [];
  anchor(panel, { placement: "bottom", offset: 8, onGeometry: (g) => seen.push(g) });
  assertEquals(seen.length, 1, "one report for the initial measure");
  assertEquals(seen[0]?.x, 40, "x is the anchor's left edge against the host");
  assertEquals(seen[0]?.y, 128, "y is the anchor's bottom edge plus the gap");
  assertEquals(seen[0]?.w, 120, "w matches the anchor for min-width");
  assertEquals(seen[0]?.placement, "bottom", "the preferred side holds with room");
});

Deno.test("Given no room below / When attached / Then the panel flips above", () => {
  const host = document.createElement("div");
  const trigger = document.createElement("button");
  const panel = document.createElement("div");
  host.appendChild(trigger);
  host.appendChild(panel);
  document.body.appendChild(host);
  trigger.getBoundingClientRect = () => rect(40, 500, 120, 520);
  Object.defineProperty(host, "getBoundingClientRect", { value: () => rect(0, 0, 800, 600) });
  Object.defineProperty(panel, "offsetHeight", { value: 100 });
  Object.defineProperty(panel, "offsetParent", { value: host });

  const seen: AnchorGeometry[] = [];
  anchor(panel, { placement: "bottom", offset: 8, onGeometry: (g) => seen.push(g) });
  assertEquals(seen[0]?.placement, "top", "the viewport's veto wins");
  assertEquals(seen[0]?.y, 392, "y is the anchor's top edge minus panel height and gap");
});

Deno.test("Given identical geometry / When re-measured / Then no second report fires", () => {
  const host = document.createElement("div");
  const trigger = document.createElement("button");
  const panel = document.createElement("div");
  host.appendChild(trigger);
  host.appendChild(panel);
  document.body.appendChild(host);
  trigger.getBoundingClientRect = () => rect(40, 100, 120, 120);
  Object.defineProperty(host, "getBoundingClientRect", { value: () => rect(0, 0, 800, 600) });
  Object.defineProperty(panel, "offsetHeight", { value: 100 });
  Object.defineProperty(panel, "offsetParent", { value: host });

  const seen: AnchorGeometry[] = [];
  const result = anchor(panel, { onGeometry: (g) => seen.push(g) });
  result?.update?.({ onGeometry: (g) => seen.push(g) });
  assertEquals(seen.length, 1, "the param change re-measures but identical geometry stays quiet");
  result?.destroy?.();
});

Deno.test("Given a top-layer panel / When attached / Then geometry is viewport-relative", () => {
  globalThis.innerHeight = 600;
  const host = document.createElement("div");
  const trigger = document.createElement("button");
  const panel = document.createElement("div");
  host.appendChild(trigger);
  host.appendChild(panel);
  document.body.appendChild(host);
  trigger.getBoundingClientRect = () => rect(40, 100, 120, 120);
  Object.defineProperty(panel, "offsetHeight", { value: 60 });
  Object.defineProperty(panel, "matches", { value: (selector: string): boolean => selector === ":popover-open" });

  const seen: AnchorGeometry[] = [];
  const result = anchor(panel, { placement: "bottom", offset: 8, onGeometry: (g) => seen.push(g) });
  assertEquals(seen.length, 1, "the open panel measures once");
  assertEquals(seen[0]?.x, 40, "x is the anchor's client left with no host offset");
  assertEquals(seen[0]?.y, 128, "y is the anchor's client bottom plus the gap");
  result?.destroy?.();
});
