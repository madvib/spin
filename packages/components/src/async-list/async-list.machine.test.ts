import { test } from "bun:test";
import { deepStrictEqual } from "node:assert/strict";
import { parseHTML } from "@spinjs/runtime/testing";
import { signal } from "@spinjs/runtime";
import { asyncList } from "./async-list.presentation.ts";
const createAsyncListBridge = asyncList.createBridge;
import type {
  AsyncListApi,
  AsyncListFailure,
  AsyncListRow,
  AsyncListSuccess,
  LoadDetails,
  SortDetails,
  SortTrigger,
} from "./async-list.presentation.ts";

/** A live writable read, as the element's prop store exposes one. */
type WriteSignal = { (): unknown; (value: unknown): void };

const win = parseHTML(
  "<!doctype html><html><body></body></html>",
) as unknown as Record<string, unknown>;
declare const globalThis: Record<string, unknown>;
globalThis.document = win.document;
globalThis.CustomEvent = win.CustomEvent;
globalThis.HTMLElement = win.HTMLElement;
globalThis.HTMLInputElement = win.HTMLInputElement;
globalThis.Element = win.Element;

/** A page a host's load or sort resolves with. */
interface Page {
  readonly items: readonly unknown[];
  readonly cursor?: unknown;
}

/** A promise the test settles, so a state can be observed while the work is
 * still in flight — which is the whole point of the loading state. */
interface Park {
  readonly promise: Promise<Page>;
  readonly resolve: (page: Page) => void;
  readonly reject: (error: unknown) => void;
}

const park = (): Park => {
  const { promise, resolve, reject } = Promise.withResolvers<Page>();
  return { promise, resolve, reject };
};

const MANIFEST = [
  { value: "deno", label: "Deno" },
  { value: "bun", label: "Bun" },
  { value: "node", label: "Node" },
];

/** One element under test, with the async work it starts parked until the
 * test settles it. */
interface Harness {
  readonly api: AsyncListApi;
  readonly loadCalls: readonly LoadDetails[];
  readonly sortCalls: readonly SortDetails[];
  readonly success: readonly AsyncListSuccess[];
  readonly failure: readonly AsyncListFailure[];
  /** Settle the Nth load with a page, then wait for the reported outcome. */
  resolveLoad(
    index: number,
    items: readonly unknown[],
    cursor?: unknown,
  ): Promise<void>;
  /** Settle the Nth sort with its sorted page. */
  resolveSort(index: number, items: readonly unknown[]): Promise<void>;
  /** Fail the Nth load, then wait for the reported failure. */
  rejectLoad(index: number, error: unknown): Promise<void>;
  /** Wait for the next reported outcome, however the host answered. */
  settled(): Promise<void>;
  write(name: string, value: unknown): void;
  dispose(): void;
}

function mount(overrides: Readonly<Record<string, unknown>> = {}): Harness {
  const root = document.createElement("div");
  document.body.appendChild(root);
  const loadCalls: LoadDetails[] = [];
  const sortCalls: SortDetails[] = [];
  const loadParks: Park[] = [];
  const sortParks: Park[] = [];
  const gates: Array<{ resolve: () => void }> = [];
  const success: AsyncListSuccess[] = [];
  const failure: AsyncListFailure[] = [];
  const values: Record<string, WriteSignal> = {};
  const written = new Set<string>();
  const write = (name: string, value: unknown): void => {
    written.add(name);
    const source = values[name];
    if (source === undefined) values[name] = signal<unknown>(value);
    else source(value);
  };
  write("load", (details: LoadDetails): Promise<Page> => {
    loadCalls.push(details);
    const entry = park();
    loadParks.push(entry);
    return entry.promise;
  });
  for (const [name, value] of Object.entries(overrides)) write(name, value);
  // After the overrides, so the parked handler is the one the bridge calls.
  if (typeof overrides["sortFn"] === "function") {
    write("sortFn", (details: SortDetails): Promise<Page> => {
      sortCalls.push(details);
      const entry = park();
      sortParks.push(entry);
      return entry.promise;
    });
  }
  write("onSuccess", (change: AsyncListSuccess) => {
    success.push(change);
    gates.shift()?.resolve();
  });
  write("onError", (change: AsyncListFailure) => {
    failure.push(change);
    gates.shift()?.resolve();
  });
  const bridge = createAsyncListBridge(
    () => {
      const record: Record<string, unknown> = {};
      for (const [name, source] of Object.entries(values)) {
        record[name] = source();
      }
      record["@@authored"] = (name: string): boolean => written.has(name);
      return record;
    },
    () => root,
    "list",
  );
  /** The bridge attached its own handler to the parked promise first, so
   * awaiting that promise runs every microtask between the resolution and
   * the machine's move — including the one where a stale result is dropped,
   * which reports nothing and so has no event to wait on. */
  const settle = (
    index: number,
    parks: readonly Park[],
    page: Page,
  ): Promise<void> => {
    const entry = parks[index];
    if (entry === undefined) throw new Error(`no parked work at ${index}`);
    entry.resolve(page);
    return entry.promise.then(() => undefined);
  };
  const fail = (
    index: number,
    parks: readonly Park[],
    error: unknown,
  ): Promise<void> => {
    const entry = parks[index];
    if (entry === undefined) throw new Error(`no parked work at ${index}`);
    entry.reject(error);
    return entry.promise.then(
      () => undefined,
      () => undefined,
    );
  };
  return {
    api: bridge.api,
    loadCalls,
    sortCalls,
    success,
    failure,
    resolveLoad: (index, items, cursor) =>
      settle(
        index,
        loadParks,
        cursor === undefined ? { items } : { items, cursor },
      ),
    resolveSort: (index, items) => settle(index, sortParks, { items }),
    rejectLoad: (index, error) => fail(index, loadParks, error),
    settled: () => {
      const gate = park();
      gates.push({ resolve: () => gate.resolve({ items: [] }) });
      return gate.promise.then(() => undefined);
    },
    write,
    dispose: () => bridge.dispose(),
  };
}

const state = (api: AsyncListApi): unknown => api.getRootProps()["data-state"];
const labels = (api: AsyncListApi): readonly string[] =>
  api.getRows().map((row: AsyncListRow) => row.label);
const values = (api: AsyncListApi): readonly string[] =>
  api.getRows().map((row: AsyncListRow) => row.value);

/** Prop bags hand back `Record<string, unknown>`, so a handler read out of one
 * is checked here and typed once, instead of an unchecked cast at every call
 * site. */
function handler<H>(bag: Record<string, unknown>, key: string): H {
  const value: unknown = bag[key];
  if (typeof value !== "function") throw new Error(`no handler at ${key}`);
  return value as H;
}

function click(bag: Record<string, unknown>): void {
  handler<(event: MouseEvent) => void>(bag, "onClick")(
    { defaultPrevented: false } as MouseEvent,
  );
}

/** The input event the filter field's handler reads. */
function typing(input: HTMLInputElement, value: string): InputEvent {
  input.value = value;
  return { currentTarget: input } as unknown as InputEvent;
}

// ---- the start state ------------------------------------------------------

test("Given a fresh list / When nothing is authored / Then idle holds nothing", () => {
  const h = mount();
  deepStrictEqual(state(h.api), "idle", "the mount state is idle");
  deepStrictEqual(h.api.items, [], "and it holds no items");
  deepStrictEqual(h.api.empty, true, "so the list is empty");
  deepStrictEqual(h.api.loading, false, "nothing is loading");
  deepStrictEqual(h.api.sorting, false, "and nothing is sorting");
  deepStrictEqual(h.api.filterText, "", "the filter text starts empty");
  deepStrictEqual(h.api.cursor, undefined, "there is no cursor");
  deepStrictEqual(h.api.error, undefined, "and no error");
  deepStrictEqual(h.api.hasMore, false, "so there is no next page");
  deepStrictEqual(h.api.sortDescriptor, undefined, "and no sort descriptor");
  deepStrictEqual(h.loadCalls.length, 0, "no load ran");
  h.dispose();
});

test("Given initial values / When the list mounts / Then the seed is the state", () => {
  const h = mount({
    initialItems: MANIFEST,
    initialFilterText: "deno",
    initialSortDescriptor: { column: "name", direction: "ascending" },
  });
  deepStrictEqual(
    values(h.api),
    ["deno", "bun", "node"],
    "the seeded items are the rows",
  );
  deepStrictEqual(h.api.empty, false, "so the list is not empty");
  deepStrictEqual(h.api.filterText, "deno", "the filter text is seeded");
  deepStrictEqual(
    h.api.sortDescriptor,
    { column: "name", direction: "ascending" },
    "the sort descriptor is seeded",
  );
  deepStrictEqual(
    labels(h.api),
    ["Deno", "Bun", "Node"],
    "and each row shows its label",
  );
  h.dispose();
});

test("Given autoReload / When the list mounts / Then the first page is fetched", async () => {
  const h = mount({ autoReload: true });
  deepStrictEqual(state(h.api), "loading", "an autoReload mount fetches on entry");
  deepStrictEqual(h.loadCalls.length, 1, "one load ran");
  deepStrictEqual(h.loadCalls[0]?.cursor, null, "and it starts from no cursor");
  deepStrictEqual(h.api.loading, true, "the api reports the load");
  deepStrictEqual(
    h.api.getListProps()["aria-busy"],
    true,
    "the list region announces it",
  );
  await h.resolveLoad(0, MANIFEST, "page-2");
  deepStrictEqual(
    state(h.api),
    "idle",
    "the resolved page returns the list to idle",
  );
  deepStrictEqual(values(h.api), ["deno", "bun", "node"], "and it holds the page");
  deepStrictEqual(h.api.hasMore, true, "a cursor means there is a next page");
  deepStrictEqual(h.success, [{ items: MANIFEST }], "onSuccess reports the page");
  h.dispose();
});

// ---- RELOAD ---------------------------------------------------------------

test("Given a loaded list / When reload runs / Then the items are replaced", async () => {
  const h = mount({ autoReload: true });
  await h.resolveLoad(0, MANIFEST, "page-2");
  h.api.reload();
  deepStrictEqual(state(h.api), "loading", "a reload fetches again");
  deepStrictEqual(h.api.items, [], "the held items are cleared while it runs");
  await h.resolveLoad(1, [{ value: "go", label: "Go" }], null);
  deepStrictEqual(values(h.api), ["go"], "the new page replaces the old one");
  deepStrictEqual(h.api.hasMore, false, "and a null cursor ends the paging");
  deepStrictEqual(
    h.loadCalls[1]?.cursor,
    null,
    "a reload restarts from no cursor",
  );
  deepStrictEqual(h.api.cursor, undefined, "the api reports no cursor");
  h.dispose();
});

test("Given a loading list / When reload runs again / Then the superseded fetch is dropped", async () => {
  const h = mount({ autoReload: true });
  h.api.reload();
  deepStrictEqual(h.loadCalls.length, 2, "the reload started a second fetch");
  // The superseded load resolves late and its page must land nowhere.
  await h.resolveLoad(0, MANIFEST, "late-cursor");
  deepStrictEqual(h.api.items, [], "the stale page is dropped");
  deepStrictEqual(
    state(h.api),
    "loading",
    "and the newest fetch is still in flight",
  );
  h.dispose();
});

// ---- LOAD_MORE ------------------------------------------------------------

test("Given a page with a cursor / When loadMore runs / Then the page is appended", async () => {
  const h = mount({ autoReload: true });
  await h.resolveLoad(0, [{ value: "a", label: "A" }], "cursor-2");
  h.api.loadMore();
  deepStrictEqual(state(h.api), "loading", "load-more fetches");
  deepStrictEqual(
    h.loadCalls[1]?.cursor,
    "cursor-2",
    "from the cursor the page left behind",
  );
  await h.resolveLoad(1, [{ value: "b", label: "B" }], null);
  deepStrictEqual(values(h.api), ["a", "b"], "the page is appended, not replaced");
  deepStrictEqual(h.api.hasMore, false, "the list is exhausted");
  deepStrictEqual(h.success.length, 2, "each page reports once");
  h.dispose();
});

test("Given an exhausted list / When loadMore runs / Then nothing is fetched", async () => {
  const h = mount({ autoReload: true });
  await h.resolveLoad(0, MANIFEST, null);
  h.api.loadMore();
  deepStrictEqual(state(h.api), "idle", "an exhausted list stays idle");
  deepStrictEqual(h.loadCalls.length, 1, "and no fetch started");
  h.dispose();
});

// ---- FILTER ---------------------------------------------------------------

test("Given a loaded list / When a filter is set / Then the fetch carries it", async () => {
  const h = mount({ autoReload: true });
  await h.resolveLoad(0, MANIFEST, "page-2");
  h.api.setFilterText("den");
  deepStrictEqual(state(h.api), "loading", "a filter fetches");
  deepStrictEqual(h.api.filterText, "den", "the filter text is the machine's now");
  deepStrictEqual(h.loadCalls[1]?.filterText, "den", "and the fetch carries it");
  deepStrictEqual(h.loadCalls[1]?.cursor, null, "a filter restarts the paging");
  await h.resolveLoad(1, [{ value: "deno", label: "Deno" }], null);
  deepStrictEqual(values(h.api), ["deno"], "the filtered page replaces the list");
  h.dispose();
});

test("Given a filtered list / When clearFilter runs / Then the filter empties", async () => {
  const h = mount({ initialFilterText: "deno", autoReload: true });
  deepStrictEqual(
    h.loadCalls[0]?.filterText,
    "deno",
    "the seed reaches the first fetch",
  );
  await h.resolveLoad(0, MANIFEST, null);
  h.api.clearFilter();
  deepStrictEqual(h.api.filterText, "", "the filter text empties");
  deepStrictEqual(
    h.loadCalls[1]?.filterText,
    "",
    "and the next fetch carries the empty filter",
  );
  h.dispose();
});

test("Given a filter typed in the field / When the input fires / Then the machine hears it", async () => {
  const h = mount({ autoReload: true });
  await h.resolveLoad(0, MANIFEST, null);
  const bag = h.api.getFilterInputProps();
  const input = document.createElement("input");
  handler<(event: InputEvent) => void>(bag, "onInput")(typing(input, "bun"));
  deepStrictEqual(h.api.filterText, "bun", "the typed text is the machine's");
  deepStrictEqual(state(h.api), "loading", "and it fetched");
  deepStrictEqual(
    h.loadCalls[1]?.filterText,
    "bun",
    "the fetch carries the typed text",
  );
  h.dispose();
});

test("Given a load in flight / When a filter arrives / Then the superseded fetch is dropped", async () => {
  const h = mount({ autoReload: true });
  h.api.setFilterText("b");
  deepStrictEqual(h.loadCalls.length, 2, "the filter started a second fetch");
  await h.resolveLoad(0, [{ value: "stale", label: "Stale" }], "stale-cursor");
  deepStrictEqual(values(h.api), [], "the stale page is dropped");
  deepStrictEqual(state(h.api), "loading", "and the list is still loading");
  deepStrictEqual(h.api.hasMore, false, "with no cursor from the dropped page");
  await h.resolveLoad(1, [{ value: "bun", label: "Bun" }], null);
  deepStrictEqual(values(h.api), ["bun"], "the newest page lands");
  h.dispose();
});

// ---- SORT -----------------------------------------------------------------

test("Given a sort function / When a sort runs / Then the host sorts and the cursor clears", async () => {
  const h = mount({
    autoReload: true,
    sortFn: (details: SortDetails) => ({ items: [...details.items].reverse() }),
  });
  await h.resolveLoad(0, MANIFEST, "page-2");
  h.api.sort({ column: "name", direction: "descending" });
  deepStrictEqual(state(h.api), "sorting", "a sort function sorts");
  deepStrictEqual(h.api.sorting, true, "and the api says so");
  // `loading` matches both `loading` and `sorting`: work is in flight.
  deepStrictEqual(h.api.loading, true, "the api reports the work in flight");
  deepStrictEqual(h.sortCalls.length, 1, "the host's sort ran once");
  deepStrictEqual(
    h.sortCalls[0]?.descriptor,
    { column: "name", direction: "descending" },
    "with the descriptor asked for",
  );
  deepStrictEqual(h.sortCalls[0]?.items, MANIFEST, "over the loaded items");
  deepStrictEqual(
    h.api.sortDescriptor,
    { column: "name", direction: "descending" },
    "the descriptor is the machine's now",
  );
  await h.resolveSort(0, [{ value: "node" }, { value: "bun" }, {
    value: "deno",
  }]);
  deepStrictEqual(
    labels(h.api),
    ["node", "bun", "deno"],
    "the sorted items replace the list",
  );
  deepStrictEqual(h.api.hasMore, false, "a sort clears the cursor");
  deepStrictEqual(state(h.api), "idle", "and returns to idle");
  h.dispose();
});

test("Given a sort function answering synchronously / When a sort runs / Then the items are replaced", async () => {
  const h = mount({ autoReload: true });
  await h.resolveLoad(0, MANIFEST, null);
  // A host may answer with a bare object; the bridge takes both shapes.
  h.write(
    "sortFn",
    (details: SortDetails) => ({ items: [...details.items].reverse() }),
  );
  h.api.sort({ column: "name", direction: "ascending" });
  deepStrictEqual(state(h.api), "sorting", "the synchronous answer sorts");
  await h.settled();
  deepStrictEqual(
    labels(h.api),
    ["Node", "Bun", "Deno"],
    "and the reversed items land",
  );
  h.dispose();
});

test("Given no sort function / When a sort runs / Then it becomes a fetch", async () => {
  const h = mount({ autoReload: true });
  await h.resolveLoad(0, MANIFEST, "page-2");
  h.api.sort({ column: "name", direction: "ascending" });
  deepStrictEqual(
    state(h.api),
    "loading",
    "without a sort function a sort fetches",
  );
  deepStrictEqual(h.sortCalls.length, 0, "nothing was sorted locally");
  deepStrictEqual(
    h.loadCalls[1]?.sortDescriptor,
    { column: "name", direction: "ascending" },
    "and the fetch carries the descriptor",
  );
  deepStrictEqual(h.loadCalls[1]?.cursor, null, "from no cursor");
  await h.resolveLoad(1, [{ value: "bun", label: "Bun" }], "next");
  deepStrictEqual(values(h.api), ["bun"], "the fetched page lands");
  h.dispose();
});

test("Given a sorting list / When another sort runs / Then the superseded sort is dropped", async () => {
  const h = mount({
    autoReload: true,
    sortFn: (details: SortDetails) => ({ items: [...details.items].reverse() }),
  });
  await h.resolveLoad(0, MANIFEST, null);
  h.api.sort({ column: "name", direction: "descending" });
  h.api.sort({ column: "name", direction: "ascending" });
  deepStrictEqual(h.sortCalls.length, 2, "the newest sort wins");
  await h.resolveSort(0, [{ value: "stale" }]);
  deepStrictEqual(
    values(h.api),
    ["deno", "bun", "node"],
    "the superseded sort's result is dropped and the held items stand",
  );
  await h.resolveSort(1, [{ value: "fresh" }]);
  deepStrictEqual(values(h.api), ["fresh"], "and the newest one lands");
  h.dispose();
});

// ---- ERROR and ABORT ------------------------------------------------------

test("Given a failing load / When it rejects / Then the error is held and reported", async () => {
  const h = mount({ autoReload: true });
  await h.rejectLoad(0, new Error("offline"));
  deepStrictEqual(state(h.api), "idle", "a failure returns the list to idle");
  deepStrictEqual(
    h.api.error instanceof Error,
    true,
    "the error is held on the api",
  );
  deepStrictEqual(
    (h.api.error as Error).message,
    "offline",
    "with the host's message",
  );
  deepStrictEqual(h.failure.length, 1, "and reported once");
  deepStrictEqual(
    h.api.getErrorProps()["data-state"],
    "error",
    "the error region states it",
  );
  h.api.reload();
  await h.resolveLoad(1, MANIFEST, null);
  deepStrictEqual(h.api.error, undefined, "a later load clears the error");
  deepStrictEqual(
    values(h.api),
    ["deno", "bun", "node"],
    "and the retried page lands",
  );
  h.dispose();
});

test("Given a failing load / When it is retried / Then the error clears on the way in", async () => {
  const h = mount({ autoReload: true });
  await h.rejectLoad(0, new Error("offline"));
  h.api.reload();
  deepStrictEqual(h.api.error, undefined, "the next fetch starts clean");
  deepStrictEqual(state(h.api), "loading", "and is loading");
  h.dispose();
});

test("Given a load in flight / When abort runs / Then the list returns to idle", async () => {
  const h = mount({ autoReload: true });
  h.api.abort();
  deepStrictEqual(state(h.api), "idle", "an abort returns to idle");
  deepStrictEqual(h.api.loading, false, "nothing is loading");
  deepStrictEqual(h.api.items, [], "and nothing was loaded");
  deepStrictEqual(h.success.length, 0, "no success was reported");
  deepStrictEqual(
    h.loadCalls[0]?.signal?.aborted,
    true,
    "the fetch's signal was fired",
  );
  // The abandoned load resolves late and lands nowhere.
  await h.resolveLoad(0, MANIFEST, "page-2");
  deepStrictEqual(h.api.items, [], "the abandoned page is dropped");
  deepStrictEqual(state(h.api), "idle", "and the list stays idle");
  h.dispose();
});

test("Given an idle list / When abort runs / Then it stays idle", () => {
  const h = mount();
  h.api.abort();
  deepStrictEqual(state(h.api), "idle", "an idle list ignores an abort");
  deepStrictEqual(h.api.loading, false, "and stays idle");
  h.dispose();
});

test("Given a sorting list / When abort runs / Then the sort is abandoned", async () => {
  const h = mount({
    autoReload: true,
    sortFn: (details: SortDetails) => ({ items: [...details.items] }),
  });
  await h.resolveLoad(0, MANIFEST, null);
  h.api.sort({ column: "name", direction: "ascending" });
  h.api.abort();
  deepStrictEqual(state(h.api), "idle", "an abort leaves sorting");
  deepStrictEqual(
    values(h.api),
    ["deno", "bun", "node"],
    "and keeps what the last load produced",
  );
  await h.resolveSort(0, MANIFEST);
  deepStrictEqual(
    values(h.api),
    ["deno", "bun", "node"],
    "the abandoned sort's result is dropped",
  );
  deepStrictEqual(h.success.length, 1, "and nothing was reported for it");
  h.dispose();
});

// ---- dependencies ---------------------------------------------------------

test("Given a dependency / When it changes / Then the list reloads", async () => {
  const h = mount({ autoReload: true, dependencies: ["a"] });
  await h.resolveLoad(0, MANIFEST, "page-2");
  h.write("dependencies", ["b"]);
  deepStrictEqual(state(h.api), "loading", "a changed dependency reloads");
  deepStrictEqual(h.loadCalls.length, 2, "a second fetch started");
  deepStrictEqual(h.api.items, [], "and the list cleared for it");
  h.write("dependencies", ["b"]);
  deepStrictEqual(
    h.loadCalls.length,
    2,
    "an unchanged dependency changes nothing",
  );
  await h.resolveLoad(1, MANIFEST, "page-2");
  deepStrictEqual(state(h.api), "idle", "the reloaded page lands");
  h.dispose();
});

test("Given no autoReload / When the dependencies are unchanged / Then nothing loads", () => {
  const h = mount({ dependencies: ["a"] });
  deepStrictEqual(state(h.api), "idle", "the mount state is idle");
  deepStrictEqual(h.loadCalls.length, 0, "and nothing was fetched");
  h.dispose();
});

// ---- the sentinel ---------------------------------------------------------

test("Given a list with a cursor / When the sentinel reports / Then the next page loads", async () => {
  const h = mount({ autoReload: true });
  await h.resolveLoad(0, MANIFEST, "page-2");
  const bag = h.api.getSentinelProps();
  deepStrictEqual(
    bag["data-more"],
    "",
    "the sentinel is armed while a cursor exists",
  );
  const param: unknown = bag["use:infinite-scroll"];
  if (typeof param !== "object" || param === null) {
    throw new Error("no sentinel param");
  }
  handler<() => void>(param as Record<string, unknown>, "onLoadMore")();
  deepStrictEqual(state(h.api), "loading", "the sentinel loads the next page");
  deepStrictEqual(h.loadCalls[1]?.cursor, "page-2", "from the cursor");
  h.dispose();
});

test("Given an exhausted list / When the sentinel is read / Then it is disarmed", async () => {
  const h = mount({ autoReload: true });
  await h.resolveLoad(0, MANIFEST, null);
  const bag = h.api.getSentinelProps();
  deepStrictEqual(bag["data-more"], undefined, "the sentinel is not armed");
  deepStrictEqual(bag["hidden"], true, "and it is hidden");
  h.dispose();
});

// ---- the parts ------------------------------------------------------------

test("Given a loaded list / When the rows are read / Then each row is addressed", async () => {
  const h = mount({ autoReload: true });
  await h.resolveLoad(0, MANIFEST, "page-2");
  const row = h.api.getRows()[0];
  if (row === undefined) throw new Error("no row");
  const bag = h.api.getItemProps(row);
  deepStrictEqual(
    bag["id"],
    "async-list:list:item:deno",
    "the row carries its part id",
  );
  deepStrictEqual(bag["role"], "listitem", "and its role");
  deepStrictEqual(bag["data-value"], "deno", "with the value it is addressed by");
  deepStrictEqual(bag["data-index"], 0, "and its position");
  const list = h.api.getListProps();
  deepStrictEqual(list["role"], "list", "the region is a list");
  deepStrictEqual(list["aria-busy"], false, "and idle");
  deepStrictEqual(list["data-empty"], undefined, "it is not empty");
  h.dispose();
});

test("Given a fresh list / When the parts are read / Then the empty state is armed", () => {
  const h = mount();
  deepStrictEqual(
    h.api.getListProps()["data-empty"],
    "",
    "the list reports empty",
  );
  deepStrictEqual(
    h.api.getEmptyProps()["data-empty"],
    "",
    "and so does the empty region",
  );
  deepStrictEqual(
    h.api.getLoadMoreProps()["data-more"],
    undefined,
    "load-more is not armed",
  );
  deepStrictEqual(
    h.api.getSortTriggerProps({
      column: "name",
      direction: "ascending",
    })["aria-pressed"],
    false,
    "no sort is active",
  );
  h.dispose();
});

test("Given a sorted list / When the sort trigger is read / Then it reports the active column", async () => {
  const h = mount({ autoReload: true });
  await h.resolveLoad(0, MANIFEST, null);
  const ascending: SortTrigger = { column: "name", direction: "ascending" };
  click(h.api.getSortTriggerProps(ascending));
  deepStrictEqual(state(h.api), "loading", "the trigger sorts");
  const bag = h.api.getSortTriggerProps(ascending);
  deepStrictEqual(bag["aria-pressed"], true, "the active direction is pressed");
  deepStrictEqual(bag["data-active"], "", "and marked");
  const other = h.api.getSortTriggerProps({
    column: "name",
    direction: "descending",
  });
  deepStrictEqual(other["aria-pressed"], false, "the other direction is not");
  h.dispose();
});

test("Given a loaded list / When the progress part is read / Then it states the phase", async () => {
  const h = mount({ autoReload: true });
  deepStrictEqual(
    h.api.getProgressProps()["data-state"],
    "loading",
    "the bar tracks the phase",
  );
  deepStrictEqual(h.api.getProgressProps()["aria-busy"], true, "and announces it");
  await h.resolveLoad(0, MANIFEST, null);
  deepStrictEqual(
    h.api.getProgressProps()["data-state"],
    "idle",
    "and follows it back",
  );
  h.dispose();
});

test("Given a filter / When the input part is read / Then it carries the text", () => {
  const h = mount({ initialFilterText: "deno" });
  const bag = h.api.getFilterInputProps();
  deepStrictEqual(
    bag["value"],
    "deno",
    "the field carries the machine's filter text",
  );
  deepStrictEqual(bag["type"], "text", "and is a text field");
  h.dispose();
});

test("Given no filter / When the clear trigger is read / Then it is hidden", () => {
  const h = mount();
  deepStrictEqual(
    h.api.getClearFilterProps()["hidden"],
    true,
    "an empty filter has nothing to clear",
  );
  const input = document.createElement("input");
  handler<(event: InputEvent) => void>(h.api.getFilterInputProps(), "onInput")(
    typing(input, "deno"),
  );
  deepStrictEqual(h.api.filterText, "deno", "the typed text is the machine's");
  deepStrictEqual(
    h.api.getClearFilterProps()["hidden"],
    false,
    "and a filled filter can be cleared",
  );
  h.dispose();
});

test("Given items without a value / When the rows are read / Then the index stands in", async () => {
  const h = mount({ autoReload: true });
  await h.resolveLoad(0, [{ label: "No value" }, {
    value: "",
    label: "Empty value",
  }], null);
  deepStrictEqual(
    values(h.api),
    ["0", "1"],
    "a value-less item keeps its position as its identity",
  );
  deepStrictEqual(
    labels(h.api),
    ["No value", "Empty value"],
    "and its label shows",
  );
  h.dispose();
});

// ---- two instances --------------------------------------------------------

test("Given two lists on one page / When one loads / Then the other keeps its own state", async () => {
  const first = mount({ autoReload: true });
  const second = mount({ autoReload: true, initialFilterText: "x" });
  await first.resolveLoad(0, [{ value: "a", label: "A" }], "cursor-2");
  deepStrictEqual(values(first.api), ["a"], "the first list holds its own page");
  deepStrictEqual(first.api.hasMore, true, "and its own cursor");
  deepStrictEqual(first.api.filterText, "", "with its own filter");
  deepStrictEqual(
    values(second.api),
    [],
    "the second list never received the first's items",
  );
  deepStrictEqual(second.api.filterText, "x", "and keeps its own seeded filter");
  deepStrictEqual(
    second.loadCalls[0]?.filterText,
    "x",
    "its own fetch carried it",
  );
  deepStrictEqual(
    state(second.api),
    "loading",
    "its own load is the one in flight",
  );
  await second.resolveLoad(0, [{ value: "b", label: "B" }], null);
  deepStrictEqual(values(second.api), ["b"], "and its own page landed");
  deepStrictEqual(values(first.api), ["a"], "which never reached the first list");
  deepStrictEqual(
    first.api.hasMore,
    true,
    "with the first list's cursor untouched",
  );
  first.dispose();
  second.dispose();
});

// ---- the load detail contract ---------------------------------------------

test("Given a seeded sort / When the first page loads / Then the fetch carries it", () => {
  const h = mount({
    initialSortDescriptor: { column: "name", direction: "ascending" },
  });
  h.api.reload();
  deepStrictEqual(
    h.loadCalls[0]?.sortDescriptor,
    { column: "name", direction: "ascending" },
    "the seeded descriptor reaches the fetch",
  );
  h.dispose();
});

test("Given a load / When it is parked / Then its signal is live", () => {
  const h = mount({ autoReload: true });
  const signal = h.loadCalls[0]?.signal;
  if (signal === undefined) throw new Error("no signal");
  deepStrictEqual(signal.aborted, false, "an in-flight fetch is not aborted");
  h.api.abort();
  deepStrictEqual(signal.aborted, true, "an abort fires it");
  h.dispose();
});

test("Given initial items and a sort function but no loader / When a sort runs / Then the sort completes without a fetch", async () => {
  const h = mount({
    initialItems: MANIFEST,
    load: undefined,
    sortFn: (details: SortDetails) => ({ items: [...details.items].reverse() }),
  });
  deepStrictEqual(labels(h.api), ["Deno", "Bun", "Node"], "the seed items show");
  h.api.sort({ column: "name", direction: "descending" });
  deepStrictEqual(state(h.api), "sorting", "a loaderless sort still sorts");
  await h.resolveSort(0, [...MANIFEST].reverse());
  deepStrictEqual(state(h.api), "idle", "and returns to idle");
  deepStrictEqual(
    labels(h.api),
    ["Node", "Bun", "Deno"],
    "the host's sort replaced the list",
  );
  deepStrictEqual(h.loadCalls.length, 0, "no fetch ran");
  h.dispose();
});
