import { assertEquals } from "@std/assert";
import { defaultTwin, resolveTwins } from "./props.ts";

Deno.test("the twin of a prop is its default-prefixed name", () => {
  assertEquals(defaultTwin("value"), "defaultValue");
  assertEquals(defaultTwin("count"), "defaultCount");
});

Deno.test("a host that wrote the live prop keeps it", () => {
  const resolved = resolveTwins({ value: "3", defaultValue: "5" });
  assertEquals(resolved["value"], "3");
});

Deno.test("a host that wrote only the twin seeds the live prop", () => {
  const resolved = resolveTwins({ value: undefined, defaultValue: "5" });
  assertEquals(resolved["value"], "5");
});

Deno.test("a host that wrote the live prop keeps it, even beside a twin", () => {
  const resolved = resolveTwins({ value: "3", defaultValue: "5" }, () => true);
  assertEquals(resolved["value"], "3");
});

Deno.test("the twin does not override a prop the host wrote", () => {
  // The host wrote `value`; the twin is only a fallback.
  const resolved = resolveTwins(
    { value: "", defaultValue: "5" },
    (name) => name === "value",
  );
  assertEquals(resolved["value"], "");
});

Deno.test("the twin seeds a prop the host did not write", () => {
  const resolved = resolveTwins(
    { value: "", defaultValue: "5" },
    (name) => name !== "value",
  );
  assertEquals(resolved["value"], "5");
});

Deno.test("the resolution never mutates the host's bag", () => {
  const bag = { value: undefined, defaultValue: "5" };
  resolveTwins(bag);
  assertEquals(bag["value"], undefined);
});
