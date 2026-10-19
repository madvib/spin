import { assert, assertEquals } from "@std/assert";
import { parseHTML } from "@spin/runtime/testing";
import { signal } from "@spin/runtime";
import { pagination } from "./pagination.bindings.ts";
const createPaginationBridge = pagination.createBridge;
import type { PaginationApi } from "./pagination.bindings.ts";
import type {
  PaginationPageChange,
  PaginationPageSizeChange,
} from "./pagination.machine.ts";

/** A live writable read, as the element's prop store exposes one. */
type WriteSignal = { (): unknown; (value: unknown): void };

const win = parseHTML("<!doctype html><html><body></body></html>") as unknown as Record<string, unknown>;
declare const globalThis: Record<string, unknown>;
globalThis.document = win.document;
globalThis.CustomEvent = win.CustomEvent;
globalThis.HTMLElement = win.HTMLElement;
globalThis.Element = win.Element;

/**
 * Prop bags hand back `Record<string, unknown>`, so a handler read out of one is
 * checked here and typed once, instead of an unchecked cast at every call site.
 */
function handler<H>(bag: Record<string, unknown>, key: string): H {
  const value: unknown = bag[key];
  if (typeof value !== "function") throw new Error(`no handler at ${key}`);
  return value as H;
}

const click = (): MouseEvent =>
  ({ defaultPrevented: false }) as unknown as MouseEvent;

interface Harness {
  readonly api: PaginationApi;
  readonly root: Element;
  readonly events: {
    readonly pageChange: PaginationPageChange[];
    readonly pageSizeChange: PaginationPageSizeChange[];
  };
  write(name: string, value: unknown): void;
}

/** Props are signals, exactly as the element's prop store makes them, so a host
 * write re-runs the bridge's controlled-channel effect. A prop passed in
 * `overrides` is AUTHORED, which is the element's `@@authored` predicate. */
function mount(overrides: Readonly<Record<string, unknown>> = {}): Harness {
  const root = document.createElement("div");
  document.body.appendChild(root);
  const events = {
    pageChange: [] as PaginationPageChange[],
    pageSizeChange: [] as PaginationPageSizeChange[],
  };
  const values: Record<string, WriteSignal> = {};
  const authoredKeys = new Set(Object.keys(overrides));
  const write = (name: string, value: unknown): void => {
    const source = values[name];
    if (source === undefined) values[name] = signal<unknown>(value);
    else source(value);
  };
  for (const [name, value] of Object.entries(overrides)) write(name, value);
  write("count", 95);
  write("onPageChange", (details: PaginationPageChange) => events.pageChange.push(details));
  write("onPageSizeChange", (details: PaginationPageSizeChange) => events.pageSizeChange.push(details));
  const bridge = createPaginationBridge(
    () => {
      const record: Record<string, unknown> = {};
      for (const [name, source] of Object.entries(values)) record[name] = source();
      record["@@authored"] = (name: string): boolean => authoredKeys.has(name);
      return record;
    },
    () => root,
    "pages",
  );
  return { api: bridge.api, root, events, write };
}

Deno.test("next and prev walk within the pages", () => {
  const { api, events } = mount();
  assertEquals(api.page, 1);
  assertEquals(api.totalPages, 10);
  handler<(e: MouseEvent) => void>(api.getNextTriggerProps(), "onClick")(click());
  assertEquals(api.page, 2);
  handler<(e: MouseEvent) => void>(api.getPrevTriggerProps(), "onClick")(click());
  assertEquals(api.page, 1);
  assertEquals(events.pageChange.map((change) => change.page), [2, 1]);
});

Deno.test("prev refuses page one and next refuses the last page", () => {
  const { api, events } = mount();
  handler<(e: MouseEvent) => void>(api.getPrevTriggerProps(), "onClick")(click());
  assertEquals(api.page, 1);
  assertEquals(events.pageChange.length, 0);
  api.setPage(10);
  handler<(e: MouseEvent) => void>(api.getNextTriggerProps(), "onClick")(click());
  assertEquals(api.page, 10);
  assertEquals(events.pageChange.length, 1);
});

Deno.test("out-of-range pages are refused", () => {
  const { api, events } = mount();
  api.setPage(99);
  assertEquals(api.page, 1);
  api.setPage(0);
  assertEquals(api.page, 1);
  assertEquals(events.pageChange.length, 0);
});

Deno.test("first and last jump the ends", () => {
  const { api } = mount();
  handler<(e: MouseEvent) => void>(api.getLastTriggerProps(), "onClick")(click());
  assertEquals(api.page, 10);
  handler<(e: MouseEvent) => void>(api.getFirstTriggerProps(), "onClick")(click());
  assertEquals(api.page, 1);
});

Deno.test("a page-size change that strands the page resets to one", () => {
  const { api, events } = mount();
  api.setPage(9);
  assertEquals(api.page, 9);
  api.setPageSize(20);
  assertEquals(api.page, 1);
  assertEquals(api.totalPages, 5);
  assertEquals(events.pageSizeChange.length, 1);
  assertEquals(events.pageSizeChange[0]?.pageSize, 20);
});

Deno.test("the window shows siblings, boundaries and ellipses", () => {
  const { api } = mount();
  api.setPage(5);
  const kinds = api.getItems().map((item) => item.type);
  assertEquals(kinds, ["page", "ellipsis", "page", "page", "page", "ellipsis", "page"]);
  assertEquals(
    api.getItems().filter((item) => item.type === "page").map((item) =>
      item.type === "page" ? item.value : -1
    ),
    [1, 4, 5, 6, 10],
  );
});

Deno.test("authored page seeds the nav and a host write moves it", () => {
  const { api, events, write } = mount({ page: 3 });
  assertEquals(api.page, 3);
  assertEquals(events.pageChange.length, 0);
  write("page", 7);
  assertEquals(api.page, 7);
  assertEquals(events.pageChange.length, 1);
});
