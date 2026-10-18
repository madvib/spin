import { assertEquals } from "jsr:@std/assert";
import { config, implementations } from "./tabs.machine.ts";
import type { TabsContext, TabsEvent } from "./tabs.machine.ts";

const ctx = (value = "tab1"): TabsContext => ({ value, defaultValue: "tab1" });
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
