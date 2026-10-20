import { assertEquals } from "jsr:@std/assert";
import { interpret, type Service } from "@spin/runtime/fsm";
import {
  tabs as tabsMachine,
  type TabsArgs,
  type TabsContext,
  type TabsEvent,
} from "./tabs.machine.ts";

/**
 * The tabs machine, through the fork's public API.
 *
 * A service is built the way the bridge builds it: the factory, with the
 * arguments the host would set. Everything asserted after that is what
 * a host observes.
 */
function tabs(args: TabsArgs = {}): Service<TabsContext, TabsEvent> {
  return interpret(tabsMachine(args, () => true)).start("idle");
}

const contextOf = (
  svc: Service<TabsContext, TabsEvent>,
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
    items: [{ label: "no value" }, { value: "" }, "nope", { value: "ok" }],
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
