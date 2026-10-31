import { test } from "bun:test";
import { deepStrictEqual } from "node:assert/strict";
import { parseHTML } from "@spinjs/runtime/testing";
import { signal } from "@spinjs/runtime";
import { pagination } from "./pagination.presentation.ts";
const createPaginationBridge = pagination.createBridge;
import type { PaginationApi } from "./pagination.presentation.ts";
import type {
  PaginationPageChange,
  PaginationPageSizeChange,
} from "./pagination.machine.ts";

/** A live writable read, as the element's prop store exposes one. */
type WriteSignal = { (): unknown; (value: unknown): void };

const win = parseHTML(
  "<!doctype html><html><body></body></html>",
) as unknown as Record<string, unknown>;
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
  write(
    "onPageChange",
    (details: PaginationPageChange) => events.pageChange.push(details),
  );
  write(
    "onPageSizeChange",
    (details: PaginationPageSizeChange) => events.pageSizeChange.push(details),
  );
  const bridge = createPaginationBridge(
    () => {
      const record: Record<string, unknown> = {};
      for (const [name, source] of Object.entries(values)) {
        record[name] = source();
      }
      record["@@authored"] = (name: string): boolean => authoredKeys.has(name);
      return record;
    },
    () => root,
    "pages",
  );
  return { api: bridge.api, root, events, write };
}

test("next and prev walk within the pages", () => {
  const { api, events } = mount();
  deepStrictEqual(api.page, 1);
  deepStrictEqual(api.totalPages, 10);
  handler<(e: MouseEvent) => void>(api.getNextTriggerProps(), "onClick")(
    click(),
  );
  deepStrictEqual(api.page, 2);
  handler<(e: MouseEvent) => void>(api.getPrevTriggerProps(), "onClick")(
    click(),
  );
  deepStrictEqual(api.page, 1);
  deepStrictEqual(events.pageChange.map((change) => change.page), [2, 1]);
});

test("prev refuses page one and next refuses the last page", () => {
  const { api, events } = mount();
  handler<(e: MouseEvent) => void>(api.getPrevTriggerProps(), "onClick")(
    click(),
  );
  deepStrictEqual(api.page, 1);
  deepStrictEqual(events.pageChange.length, 0);
  api.setPage(10);
  handler<(e: MouseEvent) => void>(api.getNextTriggerProps(), "onClick")(
    click(),
  );
  deepStrictEqual(api.page, 10);
  deepStrictEqual(events.pageChange.length, 1);
});

test("out-of-range pages are refused", () => {
  const { api, events } = mount();
  api.setPage(99);
  deepStrictEqual(api.page, 1);
  api.setPage(0);
  deepStrictEqual(api.page, 1);
  deepStrictEqual(events.pageChange.length, 0);
});

test("first and last jump the ends", () => {
  const { api } = mount();
  handler<(e: MouseEvent) => void>(api.getLastTriggerProps(), "onClick")(
    click(),
  );
  deepStrictEqual(api.page, 10);
  handler<(e: MouseEvent) => void>(api.getFirstTriggerProps(), "onClick")(
    click(),
  );
  deepStrictEqual(api.page, 1);
});

test("a page-size change that strands the page resets to one", () => {
  const { api, events } = mount();
  api.setPage(9);
  deepStrictEqual(api.page, 9);
  api.setPageSize(20);
  deepStrictEqual(api.page, 1);
  deepStrictEqual(api.totalPages, 5);
  deepStrictEqual(events.pageSizeChange.length, 1);
  deepStrictEqual(events.pageSizeChange[0]?.pageSize, 20);
});

test("the window shows siblings, boundaries and ellipses", () => {
  const { api } = mount();
  api.setPage(5);
  const kinds = api.getItems().map((item) => item.type);
  deepStrictEqual(kinds, [
    "page",
    "ellipsis",
    "page",
    "page",
    "page",
    "ellipsis",
    "page",
  ]);
  deepStrictEqual(
    api.getItems().filter((item) => item.type === "page").map((item) =>
      item.type === "page" ? item.value : -1
    ),
    [1, 4, 5, 6, 10],
  );
});

test("authored page seeds the nav and a host write moves it", () => {
  const { api, events, write } = mount({ page: 3 });
  deepStrictEqual(api.page, 3);
  deepStrictEqual(events.pageChange.length, 0);
  write("page", 7);
  deepStrictEqual(api.page, 7);
  deepStrictEqual(events.pageChange.length, 1);
});

test("clicking a page item selects that page and updates pageRange", () => {
  const { api, events } = mount({ count: 95, pageSize: 10 });
  deepStrictEqual(api.pageRange, { start: 0, end: 10 });

  const itemBag = api.getItemProps({
    type: "page",
    value: 10,
    key: "page-10",
    label: "10",
  }) as Record<string, unknown>;
  handler<(e: MouseEvent) => void>(itemBag, "onClick")(click());
  deepStrictEqual(api.page, 10);
  deepStrictEqual(api.pageRange, { start: 90, end: 95 });
  deepStrictEqual(events.pageChange.map((e) => e.page), [10]);
});

test("host count write recalculates totalPages and resets a stranded page to one", () => {
  const { api, write } = mount({ count: 100, pageSize: 10 });
  api.setPage(8);
  deepStrictEqual(api.page, 8);
  write("count", 30);
  deepStrictEqual(api.totalPages, 3);
  deepStrictEqual(api.page, 1);
});

test("pageOptions lists every page for the select", () => {
  const { api } = mount({ count: 95, pageSize: 10 });
  deepStrictEqual(
    api.pageOptions.map((item) => item.type === "page" ? item.value : -1),
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  );
  api.setPageSize(20);
  deepStrictEqual(
    api.pageOptions.map((item) => item.type === "page" ? item.value : -1),
    [1, 2, 3, 4, 5],
  );
});

test("a string page coerces, for select values", () => {
  const { api } = mount({ count: 100, pageSize: 10 });
  api.setPage("7" as unknown as number);
  deepStrictEqual(api.page, 7);
  api.setPage("nope" as unknown as number);
  deepStrictEqual(api.page, 7);
});
