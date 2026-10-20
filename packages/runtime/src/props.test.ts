import { assertEquals } from "@std/assert";
import { defaultTwin, resolveTwins } from "./props.ts";

Deno.test("the twin of a prop is its default-prefixed name", () => {
  assertEquals(defaultTwin("value"), "defaultValue");
  assertEquals(defaultTwin("count"), "defaultCount");
});

Deno.test("a host that wrote the live prop keeps it", () => {
  const resolved = resolveTwins({ value: "3", defaultValue: "5" }, (name) => name === "value");
  assertEquals(resolved["value"], "3");
});

Deno.test("a host that wrote only the twin seeds the live prop", () => {
  const resolved = resolveTwins(
    { value: undefined, defaultValue: "5" },
    (name) => name === "defaultValue",
  );
  assertEquals(resolved["value"], "5");
});

Deno.test("a host that wrote both keeps the live prop", () => {
  const resolved = resolveTwins(
    { value: "3", defaultValue: "5" },
    (name) => name === "value" || name === "defaultValue",
  );
  assertEquals(resolved["value"], "3");
});

Deno.test("the element's declared twin does not seed the live prop", () => {
  // The scope declares a twin for every prop. A declared default is the
  // element's business: it must not reach the machine, or the machine's
  // own default never stands.
  const resolved = resolveTwins({ value: "", defaultValue: "5" }, () => false);
  assertEquals(resolved["value"], "");
});

Deno.test("the twin does not override a prop the host wrote", () => {
  const resolved = resolveTwins(
    { value: "", defaultValue: "5" },
    (name) => name === "value" || name === "defaultValue",
  );
  assertEquals(resolved["value"], "");
});

Deno.test("the resolution never mutates the host's bag", () => {
  const bag = { value: undefined, defaultValue: "5" };
  resolveTwins(bag, (name) => name === "defaultValue");
  assertEquals(bag["value"], undefined);
});
