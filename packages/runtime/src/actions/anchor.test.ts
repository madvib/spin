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

test("Given a panel wider than the room right / When attached / Then x shifts the panel into the viewport", () => {
  const host = document.createElement("div");
  const trigger = document.createElement("button");
  const panel = document.createElement("div");
  host.appendChild(trigger);
  host.appendChild(panel);
  document.body.appendChild(host);
  trigger.getBoundingClientRect = () => rect(700, 100, 32, 132);
  Object.defineProperty(host, "getBoundingClientRect", { value: () => rect(0, 0, 800, 600) });
  Object.defineProperty(panel, "offsetHeight", { value: 100 });
  Object.defineProperty(panel, "offsetWidth", { value: 152 });
  Object.defineProperty(panel, "offsetParent", { value: host });
  const prior = globalThis.innerWidth;
  globalThis.innerWidth = 800;
  try {
    const seen: AnchorGeometry[] = [];
    anchor(panel, { placement: "bottom", offset: 8, onGeometry: (g) => seen.push(g) });
    deepStrictEqual(seen[0]?.x, 640, "x is viewport width minus panel width minus gap");
    deepStrictEqual((panel as HTMLElement).style.left, "640px", "the written left matches the shift");
  } finally {
    globalThis.innerWidth = prior;
  }
});

test("Given a host with no room below but viewport room / When attached / Then the panel stays below", () => {
  const host = document.createElement("div");
  const trigger = document.createElement("button");
  const panel = document.createElement("div");
  host.appendChild(trigger);
  host.appendChild(panel);
  document.body.appendChild(host);
  trigger.getBoundingClientRect = () => rect(1021, 15, 154, 41);
  Object.defineProperty(host, "getBoundingClientRect", { value: () => rect(1021, 15, 154, 26) });
  Object.defineProperty(panel, "offsetHeight", { value: 155 });
  Object.defineProperty(panel, "offsetWidth", { value: 174 });
  Object.defineProperty(panel, "offsetParent", { value: host });
  const priorH = globalThis.innerHeight;
  globalThis.innerHeight = 800;
  try {
    const seen: AnchorGeometry[] = [];
    anchor(panel, { placement: "bottom", offset: 8, onGeometry: (g) => seen.push(g) });
    deepStrictEqual(seen[0]?.placement, "bottom", "viewport room wins over the host's veto");
    deepStrictEqual(seen[0]?.y, 34, "y is the anchor's bottom edge plus the gap against the host");
  } finally {
    globalThis.innerHeight = priorH;
  }
});
test("Given a settled measure / When the document scrolls / Then the panel re-measures", () => {
  const host = document.createElement("div");
  const trigger = document.createElement("button");
  const panel = document.createElement("div");
  host.appendChild(trigger);
  host.appendChild(panel);
  document.body.appendChild(host);
  let anchorTop = 100;
  trigger.getBoundingClientRect = () => rect(40, anchorTop, 120, anchorTop + 20);
  Object.defineProperty(host, "getBoundingClientRect", { value: () => rect(0, 0, 800, 600) });
  Object.defineProperty(panel, "offsetHeight", { value: 100 });
  Object.defineProperty(panel, "offsetParent", { value: host });

  const seen: AnchorGeometry[] = [];
  const result = anchor(panel, { placement: "bottom", offset: 8, onGeometry: (g) => seen.push(g) });
  deepStrictEqual(seen.length, 1, "one report for the initial measure");
  anchorTop = 200;
  const WindowEvent = (win["window"] as Record<string, unknown>)["Event"] as new (type: string) => Event;
  document.dispatchEvent(new WindowEvent("scroll"));
  deepStrictEqual(seen.length, 2, "the scroll re-measures");
  deepStrictEqual(seen[1]?.y, 228, "y follows the anchor's new bottom edge plus the gap");
  result?.destroy?.();
  document.dispatchEvent(new WindowEvent("scroll"));
  deepStrictEqual(seen.length, 2, "destroy stops the re-measure");
});

test("Given a panel shown after attach / When hidden lifts / Then x re-shifts into the viewport", async () => {
  const host = document.createElement("div");
  const trigger = document.createElement("button");
  const panel = document.createElement("div");
  host.appendChild(trigger);
  host.appendChild(panel);
  document.body.appendChild(host);
  trigger.getBoundingClientRect = () => rect(700, 100, 32, 132);
  Object.defineProperty(host, "getBoundingClientRect", { value: () => rect(0, 0, 800, 600) });
  Object.defineProperty(panel, "offsetParent", { value: host });
  let width = 0;
  Object.defineProperty(panel, "offsetWidth", { get: () => width });
  Object.defineProperty(panel, "offsetHeight", { value: 100 });
  panel.setAttribute("hidden", "");
  const prior = globalThis.innerWidth;
  globalThis.innerWidth = 800;
  try {
    const seen: AnchorGeometry[] = [];
    const result = anchor(panel, { placement: "bottom", offset: 8, onGeometry: (g) => seen.push(g) });
    deepStrictEqual(seen.length, 1, "one report for the closed measure");
    deepStrictEqual(seen[0]?.x, 700, "the closed measure cannot shift against no width");
    width = 152;
    panel.removeAttribute("hidden");
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
    deepStrictEqual(seen.length, 2, "lifting hidden re-measures against the painted width");
    deepStrictEqual(seen[1]?.x, 640, "x shifts the open panel into the viewport");
    result?.destroy?.();
  } finally {
    globalThis.innerWidth = prior;
  }
});
