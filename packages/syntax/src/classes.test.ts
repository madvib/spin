import { assertEquals } from "@std/assert";
import { classTokens } from "./classes.ts";
import { parse } from "./parse.ts";

Deno.test("the class tokens of a static class attribute", () => {
  const ir = parse(`<div class="bg-surface p-2"></div>`);
  assertEquals(classTokens(ir), ["bg-surface", "p-2"]);
});

Deno.test("the class tokens of an expression come from its literals", () => {
  const ir = parse(
    `<div class={"bg-surface" + (slider.dragging ? " scale-110" : "")}></div>`,
  );
  assertEquals(classTokens(ir), ["bg-surface", "scale-110"]);
});

Deno.test("the class tokens of a nested node", () => {
  const ir = parse(`<div><span class="p-1"></span></div>`);
  assertEquals(classTokens(ir), ["p-1"]);
});

Deno.test("a text expression is content, not a class", () => {
  const ir = parse(`<span>{getChannelValue("hue")}</span>`);
  assertEquals(classTokens(ir), []);
});

Deno.test("a class object's tokens are its keys, not its values' literals", () => {
  const ir = parse(
    `<div class={{ "bg-surface": true, "text-primary": slider.state === "focus" }}></div>`,
  );
  assertEquals(classTokens(ir), ["bg-surface", "text-primary"]);
});

Deno.test("a class list's tokens are its strings and its objects' keys", () => {
  const ir = parse(
    `<button class={["p-72", { "rounded-md": true }]}>Go</button>`,
  );
  assertEquals(classTokens(ir), ["p-72", "rounded-md"]);
});
