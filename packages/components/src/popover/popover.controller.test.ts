import { test } from "bun:test";
import { deepStrictEqual } from "node:assert/strict";
import { parseHTML } from "@spinjs/runtime/testing";
import { attachPopover } from "./popover.controller-def.ts";

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

function mount(): { el: HTMLElement; stub: PopoverStub } {
  const wrap = document.createElement("div");
  wrap.innerHTML =
    `<div id="po"><button id="t">trigger</button><div id="p" popover>card</div></div>`;
  const el = wrap.firstElementChild as HTMLElement;
  const panel = el.querySelector("#p") as HTMLElement & {
    showPopover(): void;
    hidePopover(): void;
    togglePopover(options?: boolean): boolean;
    matches(selector: string): boolean;
  };
  // linkedom has no top layer: a boolean carries the open flag, the way the
  // browser's :popover-open does, and show/hide/toggle fire the toggle event
  // the attach listens for, with newState on the event itself.
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
  panel.togglePopover = (force?: boolean): boolean => {
    stub.open = force ?? !stub.open;
    fireToggle(stub.open ? "open" : "closed");
    return stub.open;
  };
  document.body.appendChild(el);
  return { el, stub };
}

test("show opens the panel and reports open", () => {
  const { el } = mount();
  const api = attachPopover(el);
  api.show();
  deepStrictEqual(api.open, true);
  el.remove();
});

test("hide closes the panel and reports closed", () => {
  const { el } = mount();
  const api = attachPopover(el);
  api.show();
  api.hide();
  deepStrictEqual(api.open, false);
  el.remove();
});

test("toggle flips the panel both ways", () => {
  const { el } = mount();
  const api = attachPopover(el);
  api.toggle();
  deepStrictEqual(api.open, true);
  api.toggle();
  deepStrictEqual(api.open, false);
  el.remove();
});

test("the toggle reports through open-change", () => {
  const { el } = mount();
  const seen: boolean[] = [];
  el.addEventListener("open-change", (event) => {
    seen.push((event as CustomEvent).detail.open);
  });
  const api = attachPopover(el);
  api.show();
  api.hide();
  deepStrictEqual(seen, [true, false]);
  el.remove();
});

test("the trigger targets and describes the panel", () => {
  const { el } = mount();
  const api = attachPopover(el);
  const trigger = api.getTriggerProps() as Record<string, unknown>;
  const content = api.getContentProps() as Record<string, unknown>;
  deepStrictEqual(trigger["popovertarget"], content["id"]);
  deepStrictEqual(trigger["aria-details"], content["id"]);
  deepStrictEqual(trigger["aria-haspopup"], "dialog");
  el.remove();
});

test("the content is a dialog", () => {
  const { el } = mount();
  const api = attachPopover(el);
  const content = api.getContentProps() as Record<string, unknown>;
  deepStrictEqual(content["role"], "dialog");
  el.remove();
});
