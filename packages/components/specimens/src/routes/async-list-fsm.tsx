import { createSignal } from "solid-js";
import { createSpin } from "@spin/hooks/solid";
import type { LoadDetails, LoadResult } from "../../../src/spin-async-list/async-list.bridge.ts";
import type { AsyncListFailure, AsyncListSuccess } from "../../../src/spin-async-list/async-list.bridge.ts";
import type { SortDetails } from "../../../src/spin-async-list/async-list.bridge.ts";
import type { SortDescriptor } from "../../../src/spin-async-list/async-list.machine.ts";

interface AsyncListCommands {
  abort(): void;
  reload(): void;
  loadMore(): void;
  sort(sortDescriptor: SortDescriptor): void;
  setFilterText(filterText: string): void;
  clearFilter(): void;
}

interface Row {
  readonly value: string;
  readonly label: string;
}

/** A field off a host item, the way the recipe's rows read one. */
const text = (item: unknown, field: string): string => {
  if (typeof item !== "object" || item === null) return "";
  const value: unknown = Reflect.get(item, field);
  return typeof value === "string" ? value : "";
};

/** Wait `ms`, or fail with an AbortError the moment the fetch is aborted. */
const wait = (ms: number, signal: AbortSignal | undefined): Promise<void> => {
  const { promise, resolve, reject } = Promise.withResolvers<void>();
  const timer = setTimeout(resolve, ms);
  signal?.addEventListener("abort", () => {
    clearTimeout(timer);
    const error = new Error("aborted");
    error.name = "AbortError";
    reject(error);
  }, { once: true });
  return promise;
};

/**
 * A tiny cursor server over a fixed source: one page of `pageSize` items at a
 * time, filtered on the way out, and a client-side sort. The cursor is the
 * offset the next page starts from, which is the whole contract the machine
 * needs — it never looks inside an item.
 */
function createServer(source: readonly Row[], pageSize: number, latency = 60) {
  const load = async (details: LoadDetails): Promise<LoadResult> => {
    await wait(latency, details.signal);
    const query = details.filterText.trim().toLowerCase();
    const matching = query.length === 0
      ? source
      : source.filter((row) => row.label.toLowerCase().includes(query));
    const offset = typeof details.cursor === "number" ? details.cursor : 0;
    const next = offset + pageSize;
    return {
      items: matching.slice(offset, next),
      cursor: next < matching.length ? next : null,
    };
  };
  const sort = (details: SortDetails): SortDescriptor extends never ? never : { items: readonly unknown[] } => {
    const direction = details.descriptor?.direction === "descending" ? -1 : 1;
    const sorted = [...details.items].sort((left, right) =>
      text(left, "label").localeCompare(text(right, "label")) * direction
    );
    return { items: sorted };
  };
  return { load, sort };
}

const LAND: Row[] = [
  { value: "deno", label: "Deno" },
  { value: "bun", label: "Bun" },
  { value: "node", label: "Node" },
  { value: "workerd", label: "Workerd" },
  { value: "graalvm", label: "GraalVM" },
  { value: "quickjs", label: "QuickJS" },
];

const RIFT: Row[] = [
  { value: "luna", label: "Luna" },
  { value: "mujs", label: "MuJS" },
  { value: "xs", label: "xs" },
];

const CREW: Row[] = [
  { value: "ada", label: "Ada" },
  { value: "grace", label: "Grace" },
  { value: "alan", label: "Alan" },
  { value: "edsger", label: "Edsger" },
  { value: "barbara", label: "Barbara" },
  { value: " Donald", label: " Donald" },
  { value: "radia", label: "Radia" },
  { value: "katherine", label: "Katherine" },
  { value: "margaret", label: "Margaret" },
  { value: "frances", label: "Frances" },
  { value: "jean", label: "Jean" },
  { value: "kay", label: "Kay" },
  { value: "vera", label: "Vera" },
  { value: "mary", label: "Mary" },
  { value: "carol", label: "Carol" },
  { value: "dorothy", label: "Dorothy" },
  { value: "henrietta", label: "Henrietta" },
  { value: "linda", label: "Linda" },
];

const LAND_SERVER = createServer(LAND, 2);
const RIFT_SERVER = createServer(RIFT, 2);
const CREW_SERVER = createServer(CREW, 6, 90);

const button =
  "rounded-lg border border-border bg-surface-raised px-3 py-1.5 text-sm font-medium text-text shadow-sm transition-colors hover:bg-surface";

/**
 * Async list on the forked FSM: the load lifecycle a host drives.
 *
 * The claim under test: Zag's three states survive config-first authoring,
 * and everything Zag puts in refs and entry actions — the fetch, the abort
 * controller, the sequence that drops a stale resolution — lives in the
 * bridge, so the machine stays pure. The paged instance loads on mount and
 * again whenever its dependency changes; the crew instance is driven by hand
 * through the same api.
 */
export default function AsyncListFsm() {
  const [fragment, setFragment] = createSignal("land");
  const [loads, setLoads] = createSignal(0);
  const [failures, setFailures] = createSignal(0);
  const [crewLoads, setCrewLoads] = createSignal(0);

  const onSuccess = (event: CustomEvent<AsyncListSuccess>): void => {
    setLoads((count) => count + 1 + event.detail.items.length * 0);
  };
  const onFailure = (): void => {
    setFailures((count) => count + 1);
  };

  const paged = createSpin<
    {
      load: (details: LoadDetails) => Promise<LoadResult>;
      sortFn: (details: SortDetails) => { items: readonly unknown[] };
      autoReload: boolean;
      dependencies: readonly unknown[];
    },
    AsyncListCommands
  >(
    "spin-async-list-fsm",
    () => ({
      load: fragment() === "land" ? LAND_SERVER.load : RIFT_SERVER.load,
      sortFn: fragment() === "land" ? LAND_SERVER.sort : RIFT_SERVER.sort,
      autoReload: true,
      dependencies: [fragment()],
    }),
    {
      "load-success": onSuccess,
      "load-error": onFailure,
    },
  );

  const crew = createSpin<
    {
      load: (details: LoadDetails) => Promise<LoadResult>;
      sortFn: (details: SortDetails) => { items: readonly unknown[] };
    },
    AsyncListCommands
  >(
    "spin-async-list-fsm",
    () => ({ load: CREW_SERVER.load, sortFn: CREW_SERVER.sort }),
    {
      "load-success": () => setCrewLoads((count) => count + 1),
      "load-error": onFailure,
    },
  );

  return (
    <section>
      <h2 class="mb-1 text-xl">Async list — forked FSM</h2>
      <p class="mb-4 text-muted">
        Three states, and no fetch in any of them. <code>idle</code> holds what the last page produced,{" "}
        <code>loading</code> and <code>sorting</code> are work in flight, and the machine never sees a promise:
        the bridge owns the fetch, the abort controller and the sequence that drops a stale resolution, reporting
        back through success and error. Scroll the crew list to its end — the sentinel loads the next page while
        there is a cursor.
      </p>

      <div class="grid gap-6">
        <div>
          <h3 class="mb-2 text-sm font-medium text-text">Auto-reloading on a dependency</h3>
          <spin-async-list-fsm id="paged" ref={paged.ref} />
          <div class="mt-2 flex flex-wrap items-center gap-3">
            <button type="button" class={button} onClick={() => setFragment("land")}>Fragment: land</button>
            <button type="button" class={button} onClick={() => setFragment("rift")}>Fragment: rift</button>
          </div>
        </div>

        <div>
          <h3 class="mb-2 text-sm font-medium text-text">Driven by hand</h3>
          <spin-async-list-fsm id="crew" ref={crew.ref} />
          <div class="mt-2 flex flex-wrap items-center gap-3">
            <button type="button" class={button} onClick={() => crew.commands().reload()}>el.reload()</button>
            <button type="button" class={button} onClick={() => crew.commands().loadMore()}>el.loadMore()</button>
            <button type="button" class={button} onClick={() => crew.commands().sort({ column: "label", direction: "ascending" })}>el.sort(asc)</button>
            <button type="button" class={button} onClick={() => crew.commands().sort({ column: "label", direction: "descending" })}>el.sort(desc)</button>
            <button type="button" class={button} onClick={() => crew.commands().setFilterText("a")}>el.setFilterText("a")</button>
            <button type="button" class={button} onClick={() => crew.commands().abort()}>el.abort()</button>
          </div>
        </div>
      </div>

      <div class="mt-4 text-sm text-muted font-mono tabular-nums">
        <div>
          paged loads: <span id="async-list-loads">{loads()}</span> · failures:{" "}
          <span id="async-list-failures">{failures()}</span> · crew loads:{" "}
          <span id="async-list-crew-loads">{crewLoads()}</span>
        </div>
      </div>
    </section>
  );
}
