import { test } from "bun:test";
import { deepStrictEqual } from "node:assert/strict";
import { parseHTML } from "@spinjs/runtime/testing";

// The shim installs its own globals; declaring them here keeps linkedom's
// Window out of the shared program, exactly as element.test.ts does.
import unplugin from "./elements.ts";
import {
  attrParsers,
  bindActionProps,
  bindAttr,
  bindFor,
  bindSpread,
  bindText,
  coerceProps,
  controllerView,
  define,
  effect,
  machineTick,
  on,
  own,
  projectSlots,
  provideController,
  runAction,
  signal,
  text,
} from "@spinjs/runtime";

const { window } = parseHTML("<!doctype html><html><body></body></html>");
const { document, customElements, HTMLElement, Element, Node } = window;
Object.assign(globalThis, {
  document,
  customElements,
  HTMLElement,
  Element,
  Node,
});

const plugin = unplugin.raw({}, { framework: "vite", versions: {} }) as {
  transform(code: string, id: string): Promise<{ code: string } | null>;
};

/** The runtime symbols the generated module imports. */
const RUNTIME = {
  P: attrParsers,
  machineTick,
  define,
  coerceProps,
  own,
  runAction,
  on,
  bindAttr,
  bindText,
  bindFor,
  text,
  bindActionProps,
  bindSpread,
  projectSlots,
  signal,
  effect,
  controllerView,
  provideController,
};

const SOURCE = `<scope>props={ items: { label: string }[] = [] }</scope>
<template for={items} as={row}><p>{row.label}</p></template>`;

/** Compiles `SOURCE` through the plugin and registers it under `tag`. */
async function compile(tag: string): Promise<string> {
  const result = await plugin.transform(
    SOURCE,
    `/virtual/${tag}.html?spin-element`,
  );
  const generated = result!.code
    .replace(/^import .*$/gm, "")
    .replace(/^export default .*$/m, "")
    .replace("export function create", "function create");
  const names = Object.keys(RUNTIME);
  new Function(...names, generated)(
    ...names.map((name) => RUNTIME[name as keyof typeof RUNTIME]),
  );
  return tag;
}

type Item = { label: string };
type ListElement = HTMLElement & { items?: Item[] };

const rows = (el: HTMLElement) =>
  [...el.querySelectorAll("p")].map((p) => p.textContent);

test("a property written before connection is what the component renders", async () => {
  const tag = await compile("spin-seed-before");
  const el = document.createElement(tag) as ListElement;
  el.items = [{ label: "early" }];
  document.body.appendChild(el);
  deepStrictEqual(rows(el), ["early"]);
});

test("a property written after connection re-renders the component", async () => {
  const tag = await compile("spin-seed-after");
  const el = document.createElement(tag) as ListElement;
  document.body.appendChild(el);
  deepStrictEqual(rows(el), []);

  el.items = [{ label: "late" }];
  deepStrictEqual(rows(el), ["late"]);
});

test("an attribute is the initial path when no property is written", async () => {
  const tag = await compile("spin-seed-attr");
  const el = document.createElement(tag) as ListElement;
  el.setAttribute("items", JSON.stringify([{ label: "from-attribute" }]));
  document.body.appendChild(el);
  deepStrictEqual(rows(el), ["from-attribute"]);
});

test("a property write wins over the attribute on the same element", async () => {
  const tag = await compile("spin-seed-precedence");
  const el = document.createElement(tag) as ListElement;
  el.setAttribute("items", JSON.stringify([{ label: "from-attribute" }]));
  el.items = [{ label: "from-property" }];
  document.body.appendChild(el);
  deepStrictEqual(rows(el), ["from-property"]);
});
