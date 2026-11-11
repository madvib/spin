import { test } from "bun:test";
import { deepStrictEqual } from "node:assert/strict";
import { parseHTML } from "@spinjs/components/testing";

// The shim installs its own globals; declaring them here keeps linkedom's
// Window out of the shared program, exactly as element.test.ts does.
import {
  renderComponentsDts,
  renderComponentsModule,
  resolveIncludes,
  tagForProjectFile,
  transformMarkup,
} from "./transform.ts";
import {
  bindActionProps,
  bindAttr,
  bindFor,
  bindSpread,
  bindText,
  controllerView,
  define,
  effect,
  on,
  own,
  projectSlots,
  provideController,
  runAction,
  signal,
  text,
  uniqueId,
} from "@spinjs/components/runtime";

const { window } = parseHTML("<!doctype html><html><body></body></html>");
const { document, customElements, HTMLElement, Element, Node } = window;
Object.assign(globalThis, {
  document,
  customElements,
  HTMLElement,
  Element,
  Node,
});

const EMPTY_ACTIONS = { imports: "", entries: [] as readonly string[] };

/** The runtime symbols the generated module imports. */
const RUNTIME = {
  define,
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
  uniqueId,
};

const SOURCE = `<script lang="ts">
import { list } from "./list.presentation.ts";

const machine = list({ items: [{ label: "seed" }] });
</script>
<template for={machine.getItems()} as={row}><p>{row.label}</p></template>`;

/** Compiles `SOURCE` through the transform and registers it under `tag`. */
async function compile(tag: string): Promise<string> {
  const id = `/virtual/${tag}.html?spin-component`;
  const code = transformMarkup(
    await resolveIncludes(SOURCE, id, async () => { throw new Error("no files in test"); }),
    { id, tag, actions: EMPTY_ACTIONS },
  );
  const generated = code
    .replace(/^import .*$/gm, "")
    .replace(/^export default .*$/m, "")
    .replace("export function create", "function create");
  // The script names a `./list.presentation.ts` module: stand in a stub
  // component with the same surface (fields, createBridge, commands,
  // events), so the generated build wires a live bridge.
  const names = [...Object.keys(RUNTIME), "list"];
  const args: unknown[] = [...Object.values(RUNTIME)];
  const listStub = (seed: { items: { label: string }[] }) => seed;
  Object.assign(listStub, {
    fields: ["items"],
    commands: [],
    events: {},
    createBridge: (
      props: () => Record<string, unknown>,
      _root: () => Element,
      _id: string,
    ) => {
      const items = signal<readonly { label: string }[]>(
        (props()["items"] as { label: string }[]) ?? [],
      );
      return {
        api: {
          getItems: () => items(),
        },
        dispose: () => {},
      };
    },
  });
  args.push(listStub);
  new Function(...names, generated)(...args);
  return tag;
}

type Item = { label: string };
type ListElement = HTMLElement & { items?: Item[] };

const rows = (el: HTMLElement) =>
  [...el.querySelectorAll("p")].map((p) => p.textContent);

test("a script-bound bridge renders its seed items", async () => {
  const tag = await compile("spin-script-seed");
  const el = document.createElement(tag) as ListElement;
  document.body.appendChild(el);
  deepStrictEqual(rows(el), ["seed"]);
});

test("project tags carry the prefix and the path under the components dir", () => {
  deepStrictEqual(
    tagForProjectFile("/root/src/lib/components/color-picker.html", "src/lib/components", "studio"),
    "studio-color-picker",
  );
  deepStrictEqual(
    tagForProjectFile("/root/src/lib/components/forms/login.html", "src/lib/components", "studio"),
    "studio-forms-login",
  );
  deepStrictEqual(
    tagForProjectFile("/root/src/lib/components/spin-modal.html", "src/lib/components", "studio"),
    "spin-modal",
  );
});

test("the registration module imports every file from the project root", () => {
  deepStrictEqual(
    renderComponentsModule(["src/lib/components/a.html", "src/lib/components/b.html"]),
    'import "/src/lib/components/a.html";\nimport "/src/lib/components/b.html";\n',
  );
});

test("the generated types name every tag in both the DOM map and Solid JSX", () => {
  const dts = renderComponentsDts(["studio-b", "studio-a"]);
  for (const tag of ["studio-a", "studio-b"]) {
    deepStrictEqual(dts.includes(`"${tag}": HTMLElement & SpinProjectComponentAttributes;`), true);
    deepStrictEqual(dts.includes(`"${tag}": SpinProjectComponentAttributes;`), true);
  }
  deepStrictEqual(dts.includes('declare module "spin/styles.css";'), true);
  deepStrictEqual(dts.includes('declare module "spin.css";'), true);
  deepStrictEqual(dts.includes('declare module "uno.css";'), true);
  deepStrictEqual(dts.includes('declare module "spin/components";'), true);
});

