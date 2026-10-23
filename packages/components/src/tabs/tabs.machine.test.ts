import { assertEquals } from "jsr:@std/assert";
import { parseHTML } from "@spin/runtime/testing";
import { signal } from "@spin/runtime";
import { interpret, type Service } from "@spin/runtime/fsm";
import { tabs as tabsMachine } from "./tabs.machine.ts";
import { tabs as tabsComponent, type TabsApi } from "./tabs.presentation.ts";
import type { TabsArgs, TabsContext } from "./tabs.state.ts";
import type { TabsEvents } from "./tabs.events.ts";

/**
 * The tabs machine, through the fork's public API.
 *
 * A service is built the way the bridge builds it: the factory, with the
 * arguments the host would set. Everything asserted after that is what
 * a host observes.
 */
function tabs(args: TabsArgs = {}): Service<TabsContext, TabsEvents> {
  return interpret(tabsMachine(args, () => true)).start("idle");
}

const contextOf = (
  svc: Service<TabsContext, TabsEvents>,
): TabsContext => svc.state.context;

Deno.test("tabs starts idle with seeded value", () => {
  const svc = tabs({ value: "tab1" });
  assertEquals(svc.state.value, "idle");
  assertEquals(contextOf(svc).value, "tab1");
});

Deno.test("tabs select changes value, ignores same value", () => {
  const svc = tabs({ value: "tab1" });
  svc.send({ type: "TAB.SELECT", value: "tab2" });
  assertEquals(contextOf(svc).value, "tab2");
  svc.send({ type: "TAB.SELECT", value: "tab2" });
  assertEquals(contextOf(svc).value, "tab2", "the same value changes nothing");
  svc.send({ type: "TAB.SELECT", value: "" });
  assertEquals(contextOf(svc).value, "tab2", "an empty value changes nothing");
});

Deno.test("tabs outer set wins outright", () => {
  const svc = tabs({ value: "tab1" });
  svc.send({ type: "VALUE.SET", value: "tab3" });
  assertEquals(contextOf(svc).value, "tab3");
});

Deno.test("tabs initial shapes rows: label falls back to the value, content to empty", () => {
  const shaped = contextOf(tabs({
    items: [{ value: "a" }, { value: "b", label: "Bee", content: "x" }],
  }));
  assertEquals(shaped.items, [
    { value: "a", label: "a", content: "" },
    { value: "b", label: "Bee", content: "x" },
  ]);
});

Deno.test("tabs initial skips rows without a usable value", () => {
  const shaped = contextOf(tabs({
    items: [{ label: "no value" }, { value: "" }, { value: "ok" }],
  }));
  assertEquals(shaped.items, [{ value: "ok", label: "ok", content: "" }]);
});

Deno.test("tabs initial falls back value, then defaultValue, then the first row", () => {
  const items = [{ value: "a", label: "A", content: "" }, { value: "b", label: "B", content: "" }];
  assertEquals(contextOf(tabs({ value: "b", defaultValue: "a", items })).value, "b");
  assertEquals(contextOf(tabs({ defaultValue: "b", items })).value, "b");
  assertEquals(contextOf(tabs({ items })).value, "a");
});

Deno.test("tabs initial with empty items stays empty and unselected", () => {
  const shaped = contextOf(tabs({ items: [] }));
  assertEquals(shaped.items, []);
  assertEquals(shaped.value, "");
  assertEquals(contextOf(tabs({})).value, "");
});

const win = parseHTML("<!doctype html><html><body></body></html>") as unknown as Record<string, unknown>;
declare const globalThis: Record<string, unknown>;
globalThis.document = win.document;
globalThis.CustomEvent = win.CustomEvent;
globalThis.HTMLElement = win.HTMLElement;
globalThis.Element = win.Element;

function mountTabs(initialProps: Record<string, unknown> = {}): {
  readonly api: TabsApi;
  readonly changes: string[];
  dispose(): void;
} {
  const changes: string[] = [];
  const authored = new Set(Object.keys(initialProps));
  const store = signal<Record<string, unknown>>({
    items: [
      { value: "overview", label: "Overview", content: "Overview panel" },
      { value: "metrics", label: "Metrics", content: "Metrics panel" },
      { value: "settings", label: "Settings", content: "Settings panel" },
    ],
    ...initialProps,
    "@@authored": (name: string) => authored.has(name) || name === "items",
    onValueChange: (e: { value: string }) => changes.push(e.value),
  });
  const root = (win.document as Document).createElement("div");
  const bridge = tabsComponent.createBridge(() => store(), () => root, "t1");
  return { api: bridge.api, changes, dispose: () => bridge.dispose() };
}

function keydown(key: string): KeyboardEvent {
  const made: Record<string, unknown> = {
    key,
    defaultPrevented: false,
  };
  made["preventDefault"] = (): void => {
    made["defaultPrevented"] = true;
  };
  return made as unknown as KeyboardEvent;
}

Deno.test("tabs bridge stamps per-slot trigger and content ids, roles, and aria links", () => {
  const h = mountTabs({ defaultValue: "overview" });
  const first = h.api.items[0]!;
  const second = h.api.items[1]!;

  const trig1 = h.api.getTriggerProps(first);
  const trig2 = h.api.getTriggerProps(second);
  const panel1 = h.api.getContentProps(first);
  const panel2 = h.api.getContentProps(second);

  assertEquals(trig1["id"], "tabs:t1:trigger:overview");
  assertEquals(trig2["id"], "tabs:t1:trigger:metrics");
  assertEquals(trig1["aria-controls"], "tabs:t1:content:overview");
  assertEquals(trig1["aria-selected"], "true");
  assertEquals(trig2["aria-selected"], "false");
  assertEquals(trig1["tabindex"], 0);
  assertEquals(trig2["tabindex"], -1);

  assertEquals(panel1["id"], "tabs:t1:content:overview");
  assertEquals(panel2["id"], "tabs:t1:content:metrics");
  assertEquals(panel1["aria-labelledby"], "tabs:t1:trigger:overview");
  assertEquals(panel1["hidden"], undefined);
  assertEquals(panel2["hidden"], true);
  h.dispose();
});

Deno.test("tabs bridge trigger click and keyboard roving navigation update active tab and emit value-change", () => {
  const h = mountTabs({ defaultValue: "overview" });
  const [, second, third] = h.api.items;

  const clickSecond = h.api.getTriggerProps(second!)["onClick"] as () => void;
  clickSecond();
  assertEquals(h.api.value, "metrics");
  assertEquals(h.changes, ["metrics"]);

  // ArrowRight from "metrics" selects "settings"
  const keySecond = h.api.getTriggerProps(second!)["onKeydown"] as (e: KeyboardEvent) => void;
  keySecond(keydown("ArrowRight"));
  assertEquals(h.api.value, "settings");

  // With loopFocus: true (default), ArrowRight from last wraps to "overview"
  const keyThird = h.api.getTriggerProps(third!)["onKeydown"] as (e: KeyboardEvent) => void;
  keyThird(keydown("ArrowRight"));
  assertEquals(h.api.value, "overview");

  // End jumps to "settings", Home jumps back to "overview"
  const keyFirst = h.api.getTriggerProps(h.api.items[0]!)["onKeydown"] as (e: KeyboardEvent) => void;
  keyFirst(keydown("End"));
  assertEquals(h.api.value, "settings");
  keyThird(keydown("Home"));
  assertEquals(h.api.value, "overview");
  h.dispose();
});

Deno.test("tabs bridge loopFocus false stops at first and last tab boundaries", () => {
  const h = mountTabs({ defaultValue: "overview", loopFocus: false });
  const [first, , third] = h.api.items;

  const keyFirst = h.api.getTriggerProps(first!)["onKeydown"] as (e: KeyboardEvent) => void;
  keyFirst(keydown("ArrowLeft"));
  assertEquals(h.api.value, "overview");

  h.api.select("settings");
  const keyThird = h.api.getTriggerProps(third!)["onKeydown"] as (e: KeyboardEvent) => void;
  keyThird(keydown("ArrowRight"));
  assertEquals(h.api.value, "settings");
  h.dispose();
});
