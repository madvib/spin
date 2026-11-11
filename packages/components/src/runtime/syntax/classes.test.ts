import { test } from "bun:test";
import { deepStrictEqual } from "node:assert/strict";
import { classTokens } from "./classes.ts";
import { parse } from "./parse.ts";

test("the class tokens of a static class attribute", () => {
  const ir = parse(`<div class="bg-surface p-2"></div>`);
  deepStrictEqual(classTokens(ir), ["bg-surface", "p-2"]);
});

test("the class tokens of an expression come from its literals", () => {
  const ir = parse(
    `<div class={"bg-surface" + (slider.dragging ? " scale-110" : "")}></div>`,
  );
  deepStrictEqual(classTokens(ir), ["bg-surface", "scale-110"]);
});

test("the class tokens of a nested node", () => {
  const ir = parse(`<div><span class="p-1"></span></div>`);
  deepStrictEqual(classTokens(ir), ["p-1"]);
});

test("a text expression is content, not a class", () => {
  const ir = parse(`<span>{getChannelValue("hue")}</span>`);
  deepStrictEqual(classTokens(ir), []);
});

test("a class object's tokens are its keys, not its values' literals", () => {
  const ir = parse(
    `<div class={{ "bg-surface": true, "text-primary": slider.state === "focus" }}></div>`,
  );
  deepStrictEqual(classTokens(ir), ["bg-surface", "text-primary"]);
});

test("a class list's tokens are its strings and its objects' keys", () => {
  const ir = parse(
    `<button class={["p-72", { "rounded-md": true }]}>Go</button>`,
  );
  deepStrictEqual(classTokens(ir), ["p-72", "rounded-md"]);
});
