import { assertEquals } from "@std/assert";
import { parseHTML } from "@spin/runtime/testing";
import { signal } from "@spin/runtime";
import { navigationMenu } from "./navigation-menu.bindings.ts";
const createNavigationMenuBridge = navigationMenu.createBridge;
import type { NavigationMenuApi } from "./navigation-menu.bindings.ts";

const win = parseHTML("<!doctype html><html><body></body></html>") as unknown as Record<string, unknown>;
declare const globalThis: Record<string, unknown>;
globalThis.document = win.document;
globalThis.CustomEvent = win.CustomEvent;
globalThis.HTMLElement = win.HTMLElement;
globalThis.Element = win.Element;

/** A bag read for one handler, checked and typed in one place. */
function handler<H>(bag: Record<string, unknown>, key: string): H {
  const value: unknown = bag[key];
  if (typeof value !== "function") throw new Error(`no handler at ${key}`);
  return value as H;
}

/** The hover-delay param a bag carries, with its two reports. */
function hoverParam(bag: Record<string, unknown>): Record<string, unknown> {
  const param: unknown = bag["use:hover-delay"];
  if (typeof param !== "object" || param === null) throw new Error("no hover-delay param");
  return param as Record<string, unknown>;
}

type WriteSignal = { (): unknown; (value: unknown): void };

interface Harness {
  readonly api: NavigationMenuApi;
  readonly changes: string[];
  readonly items: readonly { value: string; label: string }[];
  dispose(): void;
}

const ITEMS = JSON.stringify([
  { value: "docs", label: "Docs" },
  { value: "guides", label: "Guides" },
]);

function harness(initial: Record<string, unknown> = {}): Harness {
  const root = document.createElement("div");
  document.body.appendChild(root);
  const changes: string[] = [];
  const store = new Map<string, WriteSignal>();
  const props = (): Record<string, unknown> => {
    const bag: Record<string, unknown> = { items: ITEMS, ...initial };
    for (const [name, cell] of store) bag[name] = cell();
    bag["@@authored"] = (name: string): boolean => store.has(name);
    bag["onValueChange"] = (d: { value: string; previousValue: string }): void => {
      changes.push(`${d.previousValue}>${d.value}`);
    };
    return bag;
  };
  for (const [name, value] of Object.entries(initial)) {
    store.set(name, signal(value) as unknown as WriteSignal);
  }
  const bridge = createNavigationMenuBridge(props, () => root, "test");
  return {
    api: bridge.api,
    changes,
    items: bridge.api.items,
    dispose: () => bridge.dispose(),
  };
}

const itemBag = (h: Harness, value: string): Record<string, unknown> => {
  const item = h.items.find((entry) => entry.value === value);
  if (item === undefined) throw new Error(`no item ${value}`);
  return h.api.getItemProps(item);
};

const open = (h: Harness, value: string): void => {
  handler<() => void>(hoverParam(itemBag(h, value)), "onOpen")();
};

const closeNow = (h: Harness): void => {
  h.api.hide();
};

Deno.test("Given a closed menu / When an item enters / Then it opens and reports", () => {
  const h = harness();
  assertEquals(h.api.open, false);
  open(h, "docs");
  assertEquals(h.api.value, "docs", "the item opens");
  assertEquals(h.api.open, true, "the menu is in its open mode");
  assertEquals(h.changes, [">docs"], "one value-change");
  h.dispose();
});

Deno.test("Given an open menu / When another item enters / Then the value swaps", () => {
  const h = harness();
  open(h, "docs");
  open(h, "guides");
  assertEquals(h.api.value, "guides", "the swap lands");
  assertEquals(h.changes, [">docs", "docs>guides"], "each move reports its origin");
  h.dispose();
});

Deno.test("Given a stale close from the left item / When another holds the value / Then it is ignored", () => {
  const h = harness();
  // Open docs, then swap to guides; docs' close report is now stale.
  open(h, "docs");
  open(h, "guides");
  const docsParam = hoverParam(itemBag(h, "docs"));
  handler<() => void>(docsParam, "onClose")();
  assertEquals(h.api.value, "guides", "the stale close does not close the menu");
  assertEquals(h.api.open, true, "and the mode holds");
  // The live item's close still closes.
  handler<() => void>(hoverParam(itemBag(h, "guides")), "onClose")();
  assertEquals(h.api.open, false, "the live close closes");
  h.dispose();
});

Deno.test("Given an open menu / When the same item re-enters / Then nothing changes", () => {
  const h = harness();
  open(h, "docs");
  open(h, "docs");
  assertEquals(h.changes, [">docs"], "a re-enter is a no-op");
  h.dispose();
});

Deno.test("Given an open menu / When close reports / Then it returns to idle", () => {
  const h = harness();
  open(h, "docs");
  closeNow(h);
  assertEquals(h.api.open, false, "the menu closes");
  assertEquals(h.api.value, "", "and the value clears");
  assertEquals(h.changes, [">docs", "docs>"], "the close reports the origin");
  h.dispose();
});

Deno.test("Given an open item / When its link is clicked / Then it toggles shut", () => {
  const h = harness();
  open(h, "docs");
  handler<() => void>(itemBag(h, "docs"), "onClick")();
  assertEquals(h.api.value, "", "the toggle closes the open item");
  assertEquals(h.api.open, false, "and the mode follows");
  h.dispose();
});

Deno.test("Given a closed item / When its link is clicked / Then it toggles open", () => {
  const h = harness();
  handler<() => void>(itemBag(h, "guides"), "onClick")();
  assertEquals(h.api.value, "guides", "the toggle opens the closed item");
  h.dispose();
});

Deno.test("Given the item bags / When read / Then the hover-delay carries both clocks", () => {
  const h = harness({ openDelay: 100, closeDelay: 50 });
  const param = hoverParam(itemBag(h, "docs"));
  assertEquals(param["openDelay"], 100, "the open clock comes from scope");
  assertEquals(param["closeDelay"], 50, "and the close clock");
  h.dispose();
});

Deno.test("Given the content bag / When the item is not open / Then the panel is hidden", () => {
  const h = harness();
  const item = h.items[0];
  if (item === undefined) throw new Error("no item");
  assertEquals(h.api.getItemContentProps(item)["hidden"], true, "the closed panel is hidden");
  open(h, "docs");
  assertEquals(h.api.getItemContentProps(item)["hidden"], false, "the open panel shows");
  h.dispose();
});

Deno.test("Given an authored value / When it changes / Then the machine alternates", () => {
  const h = harness({ value: "docs" });
  assertEquals(h.api.open, true, "the authored seed opens");
  h.dispose();
});

Deno.test("Given a disabled menu / When an item is clicked / Then nothing opens", () => {
  const h = harness({ disabled: true });
  handler<() => void>(itemBag(h, "docs"), "onClick")();
  assertEquals(h.api.open, false, "the disabled click is refused");
  h.dispose();
});
