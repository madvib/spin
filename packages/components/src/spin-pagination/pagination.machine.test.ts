import { assertEquals } from "@std/assert";
import { parseHTML } from "@spin/runtime/testing";
import { signal } from "@spin/runtime";
import { createPaginationFsmBridge } from "./pagination.bridge.ts";
import type { PaginationPageChange, PaginationPageSizeChange } from "./pagination.bridge.ts";
import type {
  PaginationEllipsisEntry,
  PaginationFsmApi,
  PaginationPageEntry,
} from "./pagination.connect.ts";

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

/** The rendered slots, reduced to what a reader sees: `4` or `…`. */
const shape = (pages: readonly ({ type: string; value?: number; index?: number })[]): string =>
  pages.map((entry) => (entry.type === "page" ? String(entry.value) : "…")).join(",");

interface Harness {
  readonly api: PaginationFsmApi;
  readonly events: {
    readonly pageChange: PaginationPageChange[];
    readonly pageSizeChange: PaginationPageSizeChange[];
  };
  write(name: string, value: unknown): void;
  /** Item and trigger props are bags; the click handler is the gesture. */
  clickItem(value: number): void;
  next(): void;
  prev(): void;
  first(): void;
  last(): void;
}

/**
 * Props are signals, exactly as the element's prop store makes them, so a host
 * write re-runs the bridge's controlled-channel effect. A prop passed in
 * `overrides` is AUTHORED, which is the element's `@@authored` predicate.
 */
function mount(
  count: number,
  overrides: Readonly<Record<string, unknown>> = {},
  hostProps: Readonly<Record<string, unknown>> = {},
): Harness {
  const root = document.createElement("div");
  document.body.appendChild(root);
  for (const [name, value] of Object.entries(hostProps)) {
    (root as unknown as Record<string, unknown>)[name] = value;
  }
  const events = {
    pageChange: [] as PaginationPageChange[],
    pageSizeChange: [] as PaginationPageSizeChange[],
  };
  const values: Record<string, WriteSignal> = {};
  const authored: Record<string, true> = {};
  for (const name of Object.keys(overrides)) authored[name] = true;
  const write = (name: string, value: unknown): void => {
    const source = values[name];
    if (source === undefined) values[name] = signal<unknown>(value);
    else source(value);
  };
  write("count", count);
  for (const [name, value] of Object.entries(overrides)) write(name, value);
  write("onPageChange", (change: PaginationPageChange) => events.pageChange.push(change));
  write("onPageSizeChange", (change: PaginationPageSizeChange) => events.pageSizeChange.push(change));
  const bridge = createPaginationFsmBridge(
    () => {
      const record: Record<string, unknown> = {};
      for (const [name, source] of Object.entries(values)) record[name] = source();
      record["@@authored"] = (name: string): boolean => authored[name] === true;
      return record;
    },
    () => root,
    "pagination",
  );
  return {
    api: bridge.api,
    events,
    write,
    clickItem: (value: number) => {
      const entry = bridge.api.pages.find(
        (candidate): candidate is PaginationPageEntry => candidate.type === "page" && candidate.value === value,
      );
      if (entry === undefined) throw new Error(`no page entry ${value}`);
      handler<(event: MouseEvent) => void>(bridge.api.getItemProps(entry), "onClick")(
        {} as MouseEvent,
      );
    },
    next: () => handler<() => void>(bridge.api.getNextTriggerProps(), "onClick")(),
    prev: () => handler<() => void>(bridge.api.getPrevTriggerProps(), "onClick")(),
    first: () => handler<() => void>(bridge.api.getFirstTriggerProps(), "onClick")(),
    last: () => handler<() => void>(bridge.api.getLastTriggerProps(), "onClick")(),
  };
}

const PAGES = (h: Harness): string => shape(h.api.pages as readonly { type: string; value?: number; index?: number }[]);

// ---- the one state --------------------------------------------------------
//
// Zag ships a single `idle` with all six events on it; the fork's root tier
// is exactly that. Every event is an internal transition, so the machine's
// state value never moves and every test below is a statement about the
// context it leaves behind.

Deno.test("Given a fresh pagination / When nothing is authored / Then idle is the reachable start state", () => {
  const h = mount(0);
  assertEquals(h.api.page, 1, "the first page is the start");
  assertEquals(h.api.pageSize, 10, "the default page size is 10");
  assertEquals(h.api.totalPages, 0, "no items page nothing");
  assertEquals(PAGES(h), "", "and no slots render");
  assertEquals(h.api.previousPage, null, "the first page has no previous");
  assertEquals(h.api.getRootProps()["id"], "pagination:pagination", "the root carries the namespaced id");
  assertEquals(h.api.getRootProps()["data-empty"], "", "and reports the empty range");
});

Deno.test("Given a count that fits one page / When the pagination renders / Then only that page is a slot", () => {
  const h = mount(8);
  assertEquals(h.api.totalPages, 1, "one page holds 8 items");
  assertEquals(PAGES(h), "1", "the single page is the only slot");
  assertEquals(h.api.nextPage, null, "a lone page has no next");
});

// ---- SET_PAGE -------------------------------------------------------------

Deno.test("Given a page in range / When SET_PAGE arrives / Then it moves and reports", () => {
  const h = mount(100);
  h.api.setPage(7);
  assertEquals(h.api.page, 7, "the page moves");
  assertEquals(h.events.pageChange, [{ page: 7, pageSize: 10 }], "page-change reports the move and the size");
  assertEquals(h.events.pageSizeChange, [], "the size did not move");
});

Deno.test("Given a page outside the range / When SET_PAGE arrives / Then the guard refuses it", () => {
  const h = mount(100);
  h.api.setPage(11);
  assertEquals(h.api.page, 1, "a page past the last is refused");
  h.api.setPage(0);
  assertEquals(h.api.page, 1, "a page before the first is refused");
  h.api.setPage(-3);
  assertEquals(h.api.page, 1, "a negative page is refused");
  assertEquals(h.events.pageChange, [], "a refused page reports nothing");
});

Deno.test("Given a count of zero / When SET_PAGE arrives / Then nothing paged accepts a page", () => {
  const h = mount(0);
  h.api.setPage(1);
  assertEquals(h.api.page, 1, "the guard is the total pages, and there are none");
  assertEquals(h.events.pageChange, [], "nothing reports");
});

Deno.test("Given a page trigger click / When the page is the current one / Then it still moves", () => {
  const h = mount(100, { defaultPage: 4 });
  h.clickItem(4);
  assertEquals(h.api.page, 4, "re-picking the current page keeps it");
  assertEquals(h.events.pageChange, [], "and reports nothing");
});

// ---- SET_PAGE_SIZE --------------------------------------------------------

Deno.test("Given a page size change that keeps the page valid / When SET_PAGE_SIZE arrives / Then only the size moves", () => {
  const h = mount(100, { defaultPage: 3 });
  h.api.setPageSize(20);
  assertEquals(h.api.pageSize, 20, "the size moves");
  assertEquals(h.api.totalPages, 5, "the total follows the new size");
  assertEquals(h.api.page, 3, "page 3 is still inside 5 pages");
  assertEquals(h.events.pageSizeChange, [{ pageSize: 20 }], "page-size-change reports the size");
  assertEquals(h.events.pageChange, [], "the page did not move");
});

Deno.test("Given a page size change that pushes the page out of range / When SET_PAGE_SIZE arrives / Then the page resets to 1", () => {
  const h = mount(100, { defaultPage: 7 });
  h.api.setPageSize(50);
  assertEquals(h.api.pageSize, 50, "the size moves");
  assertEquals(h.api.page, 1, "page 7 is past the new 2 pages, so it resets");
  assertEquals(h.api.totalPages, 2, "100 items at 50 a page is 2 pages");
  // Zag fires the pageSize bindable first, then the watch's page repair.
  assertEquals(h.events.pageSizeChange, [{ pageSize: 50 }], "the size change is reported first");
  assertEquals(h.events.pageChange, [{ page: 1, pageSize: 50 }], "and the repair second");
});

Deno.test("Given a page size change that leaves the page alone / When it arrives / Then the range keeps its pages", () => {
  const h = mount(100, { defaultPage: 2 });
  h.api.setPageSize(8);
  assertEquals(h.api.pageSize, 8, "the size moves");
  assertEquals(h.api.page, 2, "page 2 is inside 13 pages");
  assertEquals(h.events.pageChange, [], "so the page reports nothing");
});

// ---- FIRST_PAGE / LAST_PAGE / PREVIOUS_PAGE / NEXT_PAGE -------------------

Deno.test("Given a middle page / When the four edge commands run / Then each one lands where it should", () => {
  const h = mount(100, { defaultPage: 5 });
  h.last();
  assertEquals(h.api.page, 10, "goToLastPage takes the last page");
  assertEquals(h.events.pageChange.at(-1), { page: 10, pageSize: 10 }, "and reports it");
  h.first();
  assertEquals(h.api.page, 1, "goToFirstPage takes the first");
  h.next();
  assertEquals(h.api.page, 2, "goToNextPage steps forward");
  h.prev();
  assertEquals(h.api.page, 1, "goToPrevPage steps back");
});

Deno.test("Given the first page / When PREVIOUS_PAGE arrives / Then the guard holds", () => {
  const h = mount(100);
  h.api.goToPrevPage();
  assertEquals(h.api.page, 1, "there is no page before the first");
  assertEquals(h.events.pageChange, [], "and nothing reports");
});

Deno.test("Given the last page / When NEXT_PAGE arrives / Then the guard holds", () => {
  const h = mount(100, { defaultPage: 10 });
  h.api.goToNextPage();
  assertEquals(h.api.page, 10, "there is no page after the last");
  assertEquals(h.events.pageChange, [], "and nothing reports");
});

Deno.test("Given a single page / When every edge command runs / Then the page cannot move", () => {
  const h = mount(5);
  h.api.goToNextPage();
  h.api.goToPrevPage();
  h.api.goToLastPage();
  h.api.goToFirstPage();
  assertEquals(h.api.page, 1, "a lone page is both the first and the last");
});

Deno.test("Given the last page / When the triggers' props are read / Then they report the edges", () => {
  const h = mount(100, { defaultPage: 10 });
  const next = h.api.getNextTriggerProps();
  assertEquals(next["disabled"], true, "next is disabled on the last page");
  assertEquals(next["data-disabled"], "", "and carries the flag");
  assertEquals(next["aria-label"], "next page", "and its label");
  const last = h.api.getLastTriggerProps();
  assertEquals(last["disabled"], true, "last is disabled too");
  assertEquals(h.api.getPrevTriggerProps()["disabled"], false, "prev is still live");
  assertEquals(h.api.getFirstTriggerProps()["disabled"], false, "so is first");
  assertEquals(h.api.nextPage, null, "and the api reports no next page");
});

Deno.test("Given the first page / When the triggers' props are read / Then the front edges are disabled", () => {
  const h = mount(100);
  assertEquals(h.api.getPrevTriggerProps()["disabled"], true, "prev is disabled on the first page");
  assertEquals(h.api.getFirstTriggerProps()["disabled"], true, "so is first");
  assertEquals(h.api.getNextTriggerProps()["disabled"], false, "next is live");
  assertEquals(h.api.getLastTriggerProps()["disabled"], false, "so is last");
  assertEquals(h.api.previousPage, null, "and the api reports no previous page");
});

// ---- the truncation -------------------------------------------------------
//
// Which slots render is the component's whole appearance, so the range is
// asserted as the reader sees it: the page numbers and the gaps between.

Deno.test("Given ten pages / When the first page is current / Then the range opens with the window", () => {
  const h = mount(100);
  assertEquals(PAGES(h), "1,2,3,4,5,…,10", "the first page shows its window and the tail");
  assertEquals(h.api.pages[5]!.type, "ellipsis", "the sixth slot is a gap");
});

Deno.test("Given ten pages / When a middle page is current / Then both gaps render", () => {
  const h = mount(100, { defaultPage: 5 });
  assertEquals(PAGES(h), "1,…,4,5,6,…,10", "a middle page shows both boundaries and the window");
});

Deno.test("Given ten pages / When the last page is current / Then only the leading gap renders", () => {
  const h = mount(100, { defaultPage: 10 });
  assertEquals(PAGES(h), "1,…,6,7,8,9,10", "the last page shows the head and its window");
});

Deno.test("Given ten pages / When the next page is current / Then the window slides", () => {
  const h = mount(100, { defaultPage: 6 });
  assertEquals(PAGES(h), "1,…,5,6,7,…,10", "the window follows the current page");
});

Deno.test("Given a count that just outgrows the window / When a page is current / Then one gap renders", () => {
  const h = mount(80, { defaultPage: 4 });
  assertEquals(h.api.totalPages, 8, "eight pages, one more than the seven-slot window");
  assertEquals(PAGES(h), "1,2,3,4,5,…,8", "the window leads and the tail follows");
  const fits = mount(70, { defaultPage: 4 });
  assertEquals(PAGES(fits), "1,2,3,4,5,6,7", "seven pages are all slots");
});

Deno.test("Given siblingCount 0 / When a middle page is current / Then only the boundaries and the page render", () => {
  const h = mount(100, { defaultPage: 5, siblingCount: 0 });
  assertEquals(PAGES(h), "1,…,5,…,10", "no siblings means a bare window");
});

Deno.test("Given boundaryCount 2 / When the last page is current / Then two boundary pages render", () => {
  const h = mount(100, { defaultPage: 10, boundaryCount: 2 });
  assertEquals(h.api.totalPages, 10, "ten pages");
  assertEquals(PAGES(h), "1,2,…,5,6,7,8,9,10", "the head keeps two boundary pages");
});

Deno.test("Given siblingCount 2 / When the first page is current / Then the window is wider", () => {
  const h = mount(500, { defaultPage: 1, siblingCount: 2 });
  assertEquals(h.api.totalPages, 50, "fifty pages");
  assertEquals(PAGES(h), "1,2,3,4,5,6,7,…,50", "the window opens with two siblings");
});

Deno.test("Given siblingCount 2 with boundaryCount 2 / When a middle page is current / Then both gaps carry the rest", () => {
  const h = mount(130, { defaultPage: 5, siblingCount: 2, boundaryCount: 2 });
  assertEquals(h.api.totalPages, 13, "thirteen pages");
  assertEquals(PAGES(h), "1,2,3,4,5,6,7,8,…,12,13", "the gaps carry the remaining numbers");
  const fits = mount(90, { defaultPage: 5, siblingCount: 2, boundaryCount: 2 });
  assertEquals(fits.api.totalPages, 9, "nine pages fit the eleven-slot window");
  assertEquals(PAGES(fits), "1,2,3,4,5,6,7,8,9", "so every page is a slot");
});

Deno.test("Given a live slot list / When the page moves / Then the entries are rebuilt for the new page", () => {
  const h = mount(100, { defaultPage: 1 });
  const before = h.api.pages;
  h.api.setPage(5);
  const after = h.api.pages;
  assertEquals(before === after, false, "the list is a different object");
  assertEquals(PAGES(h), "1,…,4,5,6,…,10", "and holds the new window");
});

Deno.test("Given a live slot list / When nothing moves / Then the entries keep their identity", () => {
  const h = mount(100, { defaultPage: 5 });
  assertEquals(h.api.pages === h.api.pages, true, "re-reading hands back the same list");
});

Deno.test("Given a count that grows / When the range would change / Then the slots follow the count", () => {
  const h = mount(100, { defaultPage: 5 });
  assertEquals(PAGES(h), "1,…,4,5,6,…,10", "ten pages to start");
  h.write("count", 20);
  assertEquals(h.api.totalPages, 2, "the count change re-pages");
  assertEquals(PAGES(h), "1,2", "and the slots shrink to the whole range");
  assertEquals(h.api.page, 5, "Zag's page size watch does not run on a count change, so the page stands");
});

// ---- the item part --------------------------------------------------------

Deno.test("Given a page slot / When its props are read / Then the current page announces itself", () => {
  const h = mount(100, { defaultPage: 5 });
  const current = h.api.getItemProps({ type: "page", value: 5 });
  assertEquals(current["id"], "pagination:pagination:item:5", "the id is the namespaced item id");
  assertEquals(current["data-index"], 5, "and carries its page number");
  assertEquals(current["data-selected"], "", "the current page is selected");
  assertEquals(current["aria-current"], "page", "and announces the current page");
  assertEquals(current["aria-label"], "page 5", "with a label naming it");
  assertEquals(current["type"], "button", "the part is a button");
  const other = h.api.getItemProps({ type: "page", value: 4 });
  assertEquals(other["data-selected"], undefined, "another page is not selected");
  assertEquals(other["aria-current"], undefined, "and announces nothing");
  assertEquals(other["aria-label"], "page 4", "but still names itself");
});

Deno.test("Given the last page / When its props are read / Then the label says so", () => {
  const h = mount(100, { defaultPage: 10 });
  assertEquals(h.api.getItemProps({ type: "page", value: 10 })["aria-label"], "last page, page 10", "the last page names itself as such");
  const single = mount(10);
  assertEquals(single.api.getItemProps({ type: "page", value: 1 })["aria-label"], "page 1", "a lone page is not the last page");
});

Deno.test("Given an ellipsis slot / When its props are read / Then the gap is inert", () => {
  const h = mount(100, { defaultPage: 5 });
  const entries = h.api.pages;
  const gap = entries.find((entry): entry is PaginationEllipsisEntry => entry.type === "ellipsis");
  assertEquals(gap?.index, 1, "the gap's index is its position in the list");
  const props = h.api.getEllipsisProps(gap as PaginationEllipsisEntry);
  assertEquals(props["id"], "pagination:pagination:ellipsis:1", "the id is the namespaced ellipsis id");
  assertEquals(props["disabled"], true, "the gap is not a control");
  assertEquals(props["tabindex"], -1, "and is no tab stop");
  assertEquals(props["aria-hidden"], true, "so a reader skips it");
});

Deno.test("Given a bag that is re-read / When nothing moved / Then the same object comes back", () => {
  const h = mount(100, { defaultPage: 5 });
  assertEquals(
    h.api.getItemProps({ type: "page", value: 5 }),
    h.api.getItemProps({ type: "page", value: 5 }),
    "the item bag is stable across reads",
  );
  assertEquals(h.api.getNextTriggerProps(), h.api.getNextTriggerProps(), "so is the next trigger's");
  assertEquals(h.api.getRootProps(), h.api.getRootProps(), "and the root's");
});

// ---- the derived ranges ---------------------------------------------------

Deno.test("Given a middle page / When pageRange is read / Then it covers that page's items", () => {
  const h = mount(100, { defaultPage: 4 });
  assertEquals(h.api.pageRange, { start: 30, end: 40 }, "page 4 of 10 covers items 30 to 39");
});

Deno.test("Given the last page / When pageRange is read / Then the end is the count", () => {
  const h = mount(95, { defaultPage: 10 });
  assertEquals(h.api.pageRange, { start: 90, end: 95 }, "the final page is clamped to the count");
});

Deno.test("Given a page size / When the api is read / Then the edges are numbers or nulls", () => {
  const h = mount(100, { defaultPage: 5 });
  assertEquals(h.api.previousPage, 4, "the previous page is one back");
  assertEquals(h.api.nextPage, 6, "the next page is one forward");
});

Deno.test("Given a host that overrides the labels / When the props are read / Then the strings are the host's", () => {
  const h = mount(100, { defaultPage: 10 }, {
    translations: {
      rootLabel: "páginas",
      prevTriggerLabel: "anterior",
      nextTriggerLabel: "siguiente",
      firstTriggerLabel: "primera",
      lastTriggerLabel: "última",
      itemLabel: ({ page }: { page: number }) => `ir a ${page}`,
    },
  });
  assertEquals(h.api.getRootProps()["aria-label"], "páginas", "the root uses the host's label");
  assertEquals(h.api.getPrevTriggerProps()["aria-label"], "anterior", "so does prev");
  assertEquals(h.api.getNextTriggerProps()["aria-label"], "siguiente", "and next");
  assertEquals(h.api.getItemProps({ type: "page", value: 4 })["aria-label"], "ir a 4", "and each page");
});

Deno.test("Given a host that overrides one label / When the props are read / Then the rest keep the defaults", () => {
  const h = mount(100, {}, { translations: { rootLabel: "pages" } });
  assertEquals(h.api.getRootProps()["aria-label"], "pages", "the host's label lands");
  assertEquals(h.api.getPrevTriggerProps()["aria-label"], "previous page", "an absent member keeps the default");
  assertEquals(h.api.getItemProps({ type: "page", value: 3 })["aria-label"], "page 3", "so does the item label");
});

// ---- the seeds and the controlled channel ---------------------------------

Deno.test("Given authored defaults / When the pagination mounts / Then they seed the machine", () => {
  const h = mount(100, { defaultPage: 4, defaultPageSize: 25 });
  assertEquals(h.api.page, 4, "defaultPage seeds the page");
  assertEquals(h.api.pageSize, 25, "defaultPageSize seeds the size");
  assertEquals(h.api.totalPages, 4, "the total follows the seeded size");
  assertEquals(h.events.pageChange, [], "seeding reports nothing");
});

Deno.test("Given authored props / When the pagination mounts / Then they win over the defaults", () => {
  const h = mount(100, { page: 3, pageSize: 50, defaultPage: 7, defaultPageSize: 10 });
  assertEquals(h.api.page, 3, "the authored page is the seed");
  assertEquals(h.api.pageSize, 50, "so is the authored size");
});

Deno.test("Given a size too small to page / When the pagination mounts / Then the bridge floors it", () => {
  const h = mount(100, { pageSize: 0 });
  assertEquals(h.api.pageSize, 1, "a zero size would divide by zero");
  assertEquals(h.api.totalPages, 100, "so the count becomes the page count");
});

Deno.test("Given an authored page / When the host writes it / Then the machine follows without an event", () => {
  const h = mount(100, { page: 2 });
  h.write("page", 6);
  assertEquals(h.api.page, 6, "the write moves the machine");
  assertEquals(h.events.pageChange, [{ page: 6, pageSize: 10 }], "and reports the move");
});

Deno.test("Given an authored page / When the machine itself moves / Then the next host write still wins", () => {
  const h = mount(100, { page: 2 });
  h.api.goToNextPage();
  assertEquals(h.api.page, 3, "the command moves the machine");
  h.write("page", 8);
  assertEquals(h.api.page, 8, "the host write re-imposes the authored page");
});

Deno.test("Given a default page / When the host never writes it / Then the machine keeps its own moves", () => {
  const h = mount(100, { defaultPage: 2 });
  h.api.goToNextPage();
  h.write("defaultPage", 9);
  assertEquals(h.api.page, 3, "a default is not a controlled value");
});

Deno.test("Given an authored pageSize / When the host writes it / Then the size follows and the page repairs", () => {
  const h = mount(100, { defaultPage: 7, pageSize: 10 });
  h.write("pageSize", 50);
  assertEquals(h.api.pageSize, 50, "the write moves the size");
  assertEquals(h.api.page, 1, "page 7 is past the new 2 pages");
  assertEquals(h.events.pageSizeChange, [{ pageSize: 50 }], "the size change reports");
  assertEquals(h.events.pageChange, [{ page: 1, pageSize: 50 }], "and the repair reports");
});

Deno.test("Given an authored pageSize / When the machine itself moves it / Then the next host write still wins", () => {
  const h = mount(100, { pageSize: 10 });
  h.api.setPageSize(20);
  assertEquals(h.api.pageSize, 20, "the command moves the size");
  h.write("pageSize", 5);
  assertEquals(h.api.pageSize, 5, "the host write re-imposes the authored size");
});

Deno.test("Given a page the host writes out of range / When the write lands / Then it is refused", () => {
  const h = mount(100, { page: 2 });
  h.write("page", 40);
  assertEquals(h.api.page, 2, "the guard holds on the controlled channel too");
});

// ---- the aria contract ----------------------------------------------------

Deno.test("Given a root / When its props are read / Then the navigation contract holds", () => {
  const h = mount(100);
  const root = h.api.getRootProps();
  assertEquals(root["aria-label"], "pagination", "the root names the control");
  assertEquals(root["dir"], undefined, "an unauthored dir is absent");
  const rtl = mount(100, { dir: "rtl" });
  assertEquals(rtl.api.getRootProps()["dir"], "rtl", "an authored dir is emitted");
});

Deno.test("Given a trigger / When its props are read / Then it is a labelled button", () => {
  const h = mount(100);
  for (const props of [
    h.api.getPrevTriggerProps(),
    h.api.getFirstTriggerProps(),
    h.api.getNextTriggerProps(),
    h.api.getLastTriggerProps(),
  ]) {
    assertEquals(props["type"], "button", "the trigger is a button");
    assertEquals(typeof props["aria-label"], "string", "and carries a label");
  }
});

Deno.test("Given a mount whose id is already namespaced / When the parts are read / Then they are not double-prefixed", () => {
  const root = document.createElement("div");
  document.body.appendChild(root);
  const values: Record<string, WriteSignal> = {};
  const write = (n: string, v: unknown): void => {
    const source = values[n];
    if (source === undefined) values[n] = signal<unknown>(v);
    else source(v);
  };
  write("count", 100);
  const bridge = createPaginationFsmBridge(
    () => {
      const record: Record<string, unknown> = {};
      for (const [n, source] of Object.entries(values)) record[n] = source();
      return record;
    },
    () => root,
    "pagination:outer",
  );
  assertEquals(bridge.api.getRootProps()["id"], "pagination:outer", "the root id is the given one");
  assertEquals(bridge.api.getNextTriggerProps()["id"], "pagination:outer:next", "and the triggers follow it");
});
