import { assertEquals } from "jsr:@std/assert";
import { config, implementations, initial } from "./tabs.machine.ts";
import type { TabsContext, TabsEvent } from "./tabs.machine.ts";

const ctx = (value = "tab1"): TabsContext => ({ value, defaultValue: "tab1", items: [] });
const run = (
  name: "setValue" | "selectTab",
  c: TabsContext,
  event: TabsEvent,
): Partial<TabsContext> =>
  (implementations.assigns as Record<string, (c: TabsContext, e: TabsEvent) => Partial<TabsContext>>)[name]!(
    c,
    event,
  );

Deno.test("tabs starts idle with seeded value", () => {
  assertEquals(config.initial, "idle");
});

Deno.test("tabs select changes value, ignores same value", () => {
  assertEquals(run("selectTab", ctx("tab1"), { type: "TAB.SELECT", value: "tab2" }), { value: "tab2" });
  assertEquals(run("selectTab", ctx("tab1"), { type: "TAB.SELECT", value: "tab1" }), {});
  assertEquals(run("selectTab", ctx("tab1"), { type: "TAB.SELECT", value: "" }), {});
});

Deno.test("tabs outer set wins outright", () => {
  assertEquals(run("setValue", ctx("tab1"), { type: "VALUE.SET", value: "tab3" }), { value: "tab3" });
});

Deno.test("tabs initial shapes rows: label falls back to the value, content to empty", () => {
  const shaped = initial({ items: [{ value: "a" }, { value: "b", label: "Bee", content: "x" }] });
  assertEquals(shaped.items, [
    { value: "a", label: "a", content: "" },
    { value: "b", label: "Bee", content: "x" },
  ]);
});

Deno.test("tabs initial skips rows without a usable value", () => {
  const shaped = initial({ items: [{ label: "no value" }, { value: "" }, "nope", { value: "ok" }] });
  assertEquals(shaped.items, [{ value: "ok", label: "ok", content: "" }]);
});

Deno.test("tabs initial falls back value, then defaultValue, then the first row", () => {
  const items = [{ value: "a", label: "A", content: "" }, { value: "b", label: "B", content: "" }];
  assertEquals(initial({ value: "b", defaultValue: "a", items }).value, "b");
  assertEquals(initial({ defaultValue: "b", items }).value, "b");
  assertEquals(initial({ items }).value, "a");
});

Deno.test("tabs initial with empty items stays empty and unselected", () => {
  const shaped = initial({ items: [] });
  assertEquals(shaped.items, []);
  assertEquals(shaped.value, "");
  assertEquals(initial({}).value, "");
});
