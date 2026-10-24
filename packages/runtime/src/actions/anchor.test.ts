import { test } from "bun:test";
import { deepStrictEqual } from "node:assert/strict";
import { parseHTML } from "@spinjs/runtime/testing";
import { anchor, type AnchorGeometry } from "./anchor.ts";

const win = parseHTML("<!doctype html><html><body></body></html>") as unknown as Record<string, unknown>;
declare const globalThis: Record<string, unknown>;
globalThis.document = win.document;
globalThis.HTMLElement = win.HTMLElement;
globalThis.Element = win.Element;

function rect(left: number, top: number, width: number, bottom: number): DOMRect {
  return { left, top, width, height: 10, bottom, right: left + width, x: left, y: top, toJSON: () => ({}) };
}

test("Given room below / When attached / Then geometry sits the panel under the anchor", () => {
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
  deepStrictEqual(seen.length, 1, "one report for the initial measure");
  deepStrictEqual(seen[0]?.x, 40, "x is the anchor's left edge against the host");
  deepStrictEqual(seen[0]?.y, 128, "y is the anchor's bottom edge plus the gap");
  deepStrictEqual(seen[0]?.w, 120, "w matches the anchor for min-width");
  deepStrictEqual(seen[0]?.placement, "bottom", "the preferred side holds with room");
});

test("Given no room below / When attached / Then the panel flips above", () => {
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
  deepStrictEqual(seen[0]?.placement, "top", "the viewport's veto wins");
  deepStrictEqual(seen[0]?.y, 392, "y is the anchor's top edge minus panel height and gap");
});

test("Given identical geometry / When re-measured / Then no second report fires", () => {
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
  deepStrictEqual(seen.length, 1, "the param change re-measures but identical geometry stays quiet");
  result?.destroy?.();
});

test("Given a top-layer panel / When attached / Then geometry is viewport-relative", () => {
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
  deepStrictEqual(seen.length, 1, "the open panel measures once");
  deepStrictEqual(seen[0]?.x, 40, "x is the anchor's client left with no host offset");
  deepStrictEqual(seen[0]?.y, 128, "y is the anchor's client bottom plus the gap");
  result?.destroy?.();
});

test("Given room below / When attached / Then the action writes literal styles to the node", () => {
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

  anchor(panel, { placement: "bottom", offset: 8 });
  deepStrictEqual((panel as HTMLElement).style.left, "40px", "left is the anchor's left edge");
  deepStrictEqual((panel as HTMLElement).style.top, "128px", "top is the anchor's bottom plus gap");
  deepStrictEqual((panel as HTMLElement).style.minWidth, "120px", "min-width matches the anchor");
});

test("Given no room below / When attached / Then the written styles place the flipped panel", () => {
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

  anchor(panel, { placement: "bottom", offset: 8 });
  deepStrictEqual((panel as HTMLElement).style.top, "392px", "top is the anchor's top minus panel height and gap");
});
