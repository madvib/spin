import { test } from "bun:test";
import { deepStrictEqual } from "node:assert/strict";
import { parseHTML } from "@spinjs/components/testing";
import { attachHoverCard } from "./hover-card.controller-def.ts";

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

function mount(attrs: string): { el: HTMLElement; panel: HTMLElement; stub: PopoverStub } {
  const wrap = document.createElement("div");
  wrap.innerHTML =
    `<div id="hc" ${attrs}><span id="t">trigger</span><div id="p" popover>card</div></div>`;
  const el = wrap.firstElementChild as HTMLElement;
  const panel = el.querySelector("#p") as HTMLElement & {
    showPopover(): void;
    hidePopover(): void;
    matches(selector: string): boolean;
  };
  // linkedom has no top layer: a boolean carries the open flag, the way the
  // browser's :popover-open does, and show/hide fire the toggle event the
  // attach listens for.
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
  return { el, panel, stub };
}

test("show opens the card and reports open", () => {
  const { el } = mount("");
  const api = attachHoverCard(el);
  api.show();
  deepStrictEqual(api.open, true);
  el.remove();
});

test("hide closes the card and reports closed", () => {
  const { el } = mount("");
  const api = attachHoverCard(el);
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
  const api = attachHoverCard(el);
  api.show();
  api.hide();
  deepStrictEqual(seen, [true, false]);
  el.remove();
});

test("placement reports the anchor's latest measure, not the seed", () => {
  const { el } = mount("");
  const api = attachHoverCard(el);
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
  anchor.onGeometry({ x: 10, y: 20, w: 89, h: 32, placement: "top" });
  const fresh = api.getContentProps() as Record<string, unknown>;
  deepStrictEqual(fresh["data-placement"], "top");
  const held = content["data-placement"];
  deepStrictEqual(held, "top");
  el.remove();
});

test("the trigger names the panel it describes", () => {
  const { el } = mount("");
  const api = attachHoverCard(el);
  const trigger = api.getTriggerProps() as Record<string, unknown>;
  const content = api.getContentProps() as Record<string, unknown>;
  deepStrictEqual(trigger["aria-details"], content["id"]);
  deepStrictEqual(trigger["aria-haspopup"], "dialog");
  el.remove();
});

test("the content is a dialog", () => {
  const { el } = mount("");
  const api = attachHoverCard(el);
  const content = api.getContentProps() as Record<string, unknown>;
  deepStrictEqual(content["role"], "dialog");
  el.remove();
});

test("setPlacement feeds the anchor's next measure", () => {
  const { el } = mount("");
  const api = attachHoverCard(el);
  api.setPlacement("top");
  const content = api.getContentProps() as Record<string, unknown>;
  const anchor = content["use:anchor"] as Record<string, unknown>;
  deepStrictEqual(anchor["placement"], "top");
  el.remove();
});

test("a disabled card never opens", () => {
  const { el } = mount("disabled");
  const api = attachHoverCard(el);
  api.show();
  deepStrictEqual(api.open, false);
  const root = api.getRootProps() as Record<string, unknown>;
  deepStrictEqual("use:hover-delay" in root, false);
  el.remove();
});
