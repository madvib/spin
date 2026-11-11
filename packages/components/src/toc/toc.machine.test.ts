import { test } from "bun:test";
import { deepStrictEqual } from "node:assert/strict";
import { parseHTML } from "@spinjs/components/testing";
import { signal } from "@spinjs/components/runtime";
import { interpret, type Service } from "@spinjs/components/fsm";
import { toc as tocMachine } from "./toc.machine.ts";
import { toc as tocComponent, type TocApi } from "./toc.presentation.ts";
import type { TocArgs, TocContext, TocItem } from "./toc.state.ts";
import type { TocEvents } from "./toc.events.ts";

function toc(args: TocArgs = {}): Service<TocContext, TocEvents> {
  return interpret(tocMachine(args, () => true)).start("idle");
}

const contextOf = (svc: Service<TocContext, TocEvents>): TocContext =>
  svc.state.context;

test("toc starts idle with first heading active when uncontrolled", () => {
  const svc = toc({
    items: [
      { value: "intro", label: "Introduction", depth: 2 },
      { value: "setup", label: "Setup", depth: 2 },
    ],
  });
  deepStrictEqual(svc.state.value, "idle");
  deepStrictEqual(contextOf(svc).activeIds, ["intro"]);
});

test("toc shapes items with fallback label and default depth 2", () => {
  const svc = toc({
    items: [
      { value: "intro" },
      { value: "nested", label: "Nested", depth: 3 },
      { value: "" },
    ],
  });
  deepStrictEqual(contextOf(svc).items, [
    { value: "intro", label: "intro", depth: 2 },
    { value: "nested", label: "Nested", depth: 3 },
  ]);
});

test("toc clamps activeIds to a single heading when multiple is false", () => {
  const svc = toc({
    items: [
      { value: "a", label: "A", depth: 2 },
      { value: "b", label: "B", depth: 2 },
    ],
    activeIds: ["a", "b"],
    multiple: false,
  });
  deepStrictEqual(contextOf(svc).activeIds, ["a"]);

  const multi = toc({
    items: [
      { value: "a", label: "A", depth: 2 },
      { value: "b", label: "B", depth: 2 },
    ],
    activeIds: ["a", "b"],
    multiple: true,
  });
  deepStrictEqual(contextOf(multi).activeIds, ["a", "b"]);
});

test("toc ITEM.SELECT activates the chosen heading", () => {
  const svc = toc({
    items: [
      { value: "intro", label: "Intro", depth: 2 },
      { value: "usage", label: "Usage", depth: 2 },
    ],
  });
  svc.send({ type: "ITEM.SELECT", value: "usage" });
  deepStrictEqual(contextOf(svc).activeIds, ["usage"]);
});

test("toc ITEMS.SET preserves valid active heading or falls back to first", () => {
  const svc = toc({
    items: [
      { value: "intro", label: "Intro", depth: 2 },
      { value: "usage", label: "Usage", depth: 2 },
    ],
    activeIds: ["usage"],
  });
  svc.send({
    type: "ITEMS.SET",
    items: [
      { value: "usage", label: "Usage", depth: 2 },
      { value: "api", label: "API", depth: 2 },
    ],
  });
  deepStrictEqual(contextOf(svc).activeIds, ["usage"]);

  svc.send({
    type: "ITEMS.SET",
    items: [{ value: "fresh", label: "Fresh", depth: 2 }],
  });
  deepStrictEqual(contextOf(svc).activeIds, ["fresh"]);
});

const win = parseHTML(
  "<!doctype html><html><body></body></html>",
) as unknown as Record<string, unknown>;
declare const globalThis: Record<string, unknown>;
globalThis.document = win.document;
globalThis.CustomEvent = win.CustomEvent;
globalThis.HTMLElement = win.HTMLElement;
globalThis.Element = win.Element;

const SAMPLE_ITEMS: readonly TocItem[] = [
  { value: "overview", label: "Overview", depth: 2 },
  { value: "install", label: "Install", depth: 2 },
  { value: "vite", label: "Vite", depth: 3 },
];

function mountToc(initialProps: Record<string, unknown> = {}): {
  readonly api: TocApi;
  readonly changes: (readonly string[])[];
  dispose(): void;
} {
  const changes: (readonly string[])[] = [];
  const authored = new Set(Object.keys(initialProps));
  const store = signal<Record<string, unknown>>({
    items: SAMPLE_ITEMS,
    ...initialProps,
    "@@authored": (name: string) => authored.has(name) || name === "items",
    onActiveChange: (e: { activeIds: readonly string[] }) =>
      changes.push(e.activeIds),
  });
  const root = (win.document as Document).createElement("div");
  const bridge = tocComponent.createBridge(() => store(), () => root, "toc1");
  return { api: bridge.api, changes, dispose: () => bridge.dispose() };
}

test("mounted toc exposes link href, aria-current, depth, and active item state", () => {
  const h = mountToc({ defaultActiveIds: ["install"] });
  const overviewLink = h.api.getLinkProps(SAMPLE_ITEMS[0]!) as Record<
    string,
    unknown
  >;
  const installLink = h.api.getLinkProps(SAMPLE_ITEMS[1]!) as Record<
    string,
    unknown
  >;
  const viteItem = h.api.getItemProps(SAMPLE_ITEMS[2]!) as Record<
    string,
    unknown
  >;

  deepStrictEqual(overviewLink["href"], "#overview");
  deepStrictEqual(overviewLink["aria-current"], undefined);
  deepStrictEqual(installLink["href"], "#install");
  deepStrictEqual(installLink["aria-current"], "location");
  deepStrictEqual(viteItem["data-depth"], "3");
  deepStrictEqual(viteItem["data-last"], "");

  deepStrictEqual(h.api.getItemState("install"), {
    value: "install",
    active: true,
    depth: 2,
    first: false,
    last: false,
  });

  h.api.scrollTo("vite");
  deepStrictEqual(h.api.value, "vite");
  deepStrictEqual(h.changes, [["vite"]]);
  h.dispose();
});
