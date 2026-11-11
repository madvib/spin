import { test } from "bun:test";
import { deepStrictEqual } from "node:assert/strict";
import { parseHTML } from "@spinjs/components/testing";
import { attachTooltip } from "./tooltip.controller-def.ts";

const win = parseHTML("<!doctype html><html><body></body></html>") as unknown as Record<
  string,
  unknown
>;
declare const globalThis: Record<string, unknown>;
globalThis.document = win.document;
globalThis.CustomEvent = win.CustomEvent;
globalThis.HTMLElement = win.HTMLElement;
globalThis.Element = win.Element;

const document = win.document as Document;

interface PopoverStub {
  open: boolean;
}

function mount(attrs: string): { el: HTMLElement } {
  const wrap = document.createElement("div");
  wrap.innerHTML =
    `<div id="tt" ${attrs}><button id="t">trigger</button><div id="p" popover>tip</div></div>`;
  const el = wrap.firstElementChild as HTMLElement;
  const panel = el.querySelector("#p") as HTMLElement & {
    showPopover(): void;
    hidePopover(): void;
    matches(selector: string): boolean;
  };
  const stub: PopoverStub = { open: false };
  const nativeMatches = panel.matches.bind(panel);
  panel.matches = (selector: string): boolean =>
    selector === ":popover-open" ? stub.open : nativeMatches(selector);
  const fireToggle = (newState: string): void => {
    const event = new CustomEvent("toggle", { bubbles: true });
    (event as unknown as { newState: string }).newState = newState;
    panel.dispatchEvent(event);
  };
  panel.showPopover = (): void => {
    stub.open = true;
    fireToggle("open");
  };
  panel.hidePopover = (): void => {
    stub.open = false;
    fireToggle("closed");
  };
  document.body.appendChild(el);
  return { el };
}

test("show opens the tip and reports open", () => {
  const { el } = mount("");
  const api = attachTooltip(el);
  api.show();
  deepStrictEqual(api.open, true);
  el.remove();
});

test("hide closes the tip and reports closed", () => {
  const { el } = mount("");
  const api = attachTooltip(el);
  api.show();
  api.hide();
  deepStrictEqual(api.open, false);
  el.remove();
});

test("the toggle reports through open-change", () => {
  const { el } = mount("");
  const seen: boolean[] = [];
  el.addEventListener("open-change", (event) => {
    seen.push((event as CustomEvent).detail.open);
  });
  const api = attachTooltip(el);
  api.show();
  api.hide();
  deepStrictEqual(seen, [true, false]);
  el.remove();
});

test("the trigger describes itself through the panel", () => {
  const { el } = mount("");
  const api = attachTooltip(el);
  const trigger = api.getTriggerProps() as Record<string, unknown>;
  const content = api.getContentProps() as Record<string, unknown>;
  deepStrictEqual(trigger["aria-describedby"], content["id"]);
  el.remove();
});

test("the content is a tooltip", () => {
  const { el } = mount("");
  const api = attachTooltip(el);
  const content = api.getContentProps() as Record<string, unknown>;
  deepStrictEqual(content["role"], "tooltip");
  el.remove();
});

test("placement reports the anchor's latest measure, not the seed", () => {
  const { el } = mount("");
  const api = attachTooltip(el);
  const content = api.getContentProps() as Record<string, unknown>;
  const anchor = content["use:anchor"] as {
    onGeometry(next: {
      x: number;
      y: number;
      w: number;
      h: number;
      placement: "top" | "bottom" | "left" | "right";
    }): void;
  };
  anchor.onGeometry({ x: 10, y: 20, w: 81, h: 24, placement: "top" });
  const fresh = api.getContentProps() as Record<string, unknown>;
  deepStrictEqual(fresh["data-placement"], "top");
  deepStrictEqual(content["data-placement"], "top");
  el.remove();
});

test("setPlacement feeds the anchor's next measure", () => {
  const { el } = mount("");
  const api = attachTooltip(el);
  api.setPlacement("left");
  const content = api.getContentProps() as Record<string, unknown>;
  const anchor = content["use:anchor"] as Record<string, unknown>;
  deepStrictEqual(anchor["placement"], "left");
  el.remove();
});
