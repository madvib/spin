import { computed, effect, machineTick, scope, signal, untrack } from "@spin/runtime";
import { createMachine, interpret, type Service } from "@spin/runtime/fsm";
import {
  config,
  implementations,
  type AsyncListContext,
  type AsyncListEvent,
  type SortDescriptor,
} from "./async-list.machine.ts";
import {
  connectRobotAsyncList,
  type AsyncListApi,
  type AsyncListService,
} from "./async-list.connect.ts";

export interface AsyncListSuccess {
  readonly items: readonly unknown[];
}

export interface AsyncListFailure {
  readonly error: unknown;
}

export interface AsyncListCallbacks {
  readonly onSuccess: ((details: AsyncListSuccess) => void) | undefined;
  readonly onError: ((details: AsyncListFailure) => void) | undefined;
}

/** Zag's `LoadDetails`: the signal the bridge's abort fires, the cursor the
 * page starts from, and the filter and sort the fetch honors. */
export interface LoadDetails {
  readonly signal: AbortSignal | undefined;
  readonly filterText: string;
  readonly cursor: unknown;
  readonly sortDescriptor: SortDescriptor | undefined;
}

export interface LoadResult {
  readonly items: readonly unknown[];
  readonly cursor?: unknown;
}

export type LoadFn = (details: LoadDetails) => Promise<LoadResult>;

/** Zag's `SortDetails`, and the two shapes its sort function may answer in. */
export interface SortDetails {
  readonly items: readonly unknown[];
  readonly descriptor: SortDescriptor | undefined;
  readonly filterText: string;
}

export type SortResult = { readonly items: readonly unknown[] } | undefined;

export type SortFn = (details: SortDetails) => SortResult | Promise<SortResult>;

/** A host function is not something the scope grammar can type, so it rides
 * the prop channel as a property write the way the tree-view's `loadChildren`
 * does: declared, read live, checked before it is called. */
function isLoadFn(value: unknown): value is LoadFn {
  return typeof value === "function";
}

function isSortFn(value: unknown): value is SortFn {
  return typeof value === "function";
}

function isSuccessFn(value: unknown): value is (details: AsyncListSuccess) => void {
  return typeof value === "function";
}

function isFailureFn(value: unknown): value is (details: AsyncListFailure) => void {
  return typeof value === "function";
}

function isSortDescriptor(value: unknown): value is SortDescriptor {
  if (typeof value !== "object" || value === null) return false;
  const column: unknown = Reflect.get(value, "column");
  const direction: unknown = Reflect.get(value, "direction");
  return typeof column === "string" &&
    (direction === "ascending" || direction === "descending");
}

/** Zag's `isAbortError`: a fetch the host was told to stop is not a failure. */
function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

/** An array off the prop channel, whatever actually arrived. The grammar's
 * `string[]` coerces an attribute; a property write lands verbatim. */
function asArray(raw: unknown): readonly unknown[] {
  if (!Array.isArray(raw)) return [];
  const out: unknown[] = [];
  for (const entry of raw) out.push(entry);
  return out;
}

/** A load the host resolved with. A result missing its items is an empty
 * page rather than a crash inside the assign. */
function asLoadResult(raw: unknown): LoadResult {
  if (typeof raw !== "object" || raw === null) return { items: [] };
  const cursor: unknown = Reflect.get(raw, "cursor");
  return {
    items: asArray(Reflect.get(raw, "items")),
    ...(cursor === undefined ? {} : { cursor }),
  };
}

/** Zag's sort resolution: no result keeps the items that were sorted. */
function asSortResult(raw: unknown): SortResult {
  if (typeof raw !== "object" || raw === null) return undefined;
  return { items: asArray(Reflect.get(raw, "items")) };
}

/**
 * The async-list bridge: scope values in, machine state out, and the fetch
 * itself.
 *
 * Five jobs. Seed the lifecycle from the host's `initial*` values; keep the
 * one prop-derived scalar (`hasSortFn`) in step with the props; answer
 * Zag's `watch` on `dependencies` with a reload; drive the async work — the
 * fetch, the sort, and the abort — reporting back through SUCCESS/ERROR; and
 * publish the connect api through the live-view proxy.
 *
 * The fetch lives here and nowhere else. Zag holds an AbortController and a
 * sequence number in refs and runs performFetch as a state entry action;
 * both are reflexes over host data, so the bridge owns them and the machine
 * stays pure. The sequence is what makes a stale resolution a no-op instead
 * of a write over newer data, and the controller is what tells a superseded
 * fetch to stop.
 */
export function createAsyncListBridge(
  props: () => Record<string, unknown>,
  _root: () => Element,
  id: string,
): { readonly api: AsyncListApi; dispose(): void } {
  const owner = scope();
  const tick = signal(0);
  // The fork's `config.context` is ONE object, and its interpreter starts on
  // it without copying: every list on the page would otherwise share one set
  // of items.
  const machine = createMachine<AsyncListContext, AsyncListEvent>(
    { ...config, context: { ...config.context } },
    implementations,
  );

  let service: Service<AsyncListContext, AsyncListEvent> | undefined;
  let aborting: AbortController | undefined;
  let seq = 0;
  let lastDependencies: string | undefined;

  const readLoad = (): LoadFn | undefined => {
    const value = props()["load"];
    return isLoadFn(value) ? value : undefined;
  };

  const readSort = (): SortFn | undefined => {
    const value = props()["sortFn"];
    return isSortFn(value) ? value : undefined;
  };

  const readCallbacks = (): AsyncListCallbacks => {
    const p = props();
    return {
      onSuccess: isSuccessFn(p["onSuccess"]) ? p["onSuccess"] : undefined,
      onError: isFailureFn(p["onError"]) ? p["onError"] : undefined,
    };
  };

  const ensureService = (): Service<AsyncListContext, AsyncListEvent> => {
    if (service) return service;
    const p = props();
    if (!isLoadFn(p["load"])) {
      throw new Error(
        "[async-list] load is required: pass a function resolving { items, cursor }",
      );
    }
    service = owner.run(() => {
      const svc = interpret(machine).start();
      Object.assign(svc.state.context, {
        items: asArray(p["initialItems"]),
        cursor: null,
        filterText: typeof p["initialFilterText"] === "string" ? p["initialFilterText"] : "",
        sortDescriptor: isSortDescriptor(p["initialSortDescriptor"]) ? p["initialSortDescriptor"] : null,
        error: undefined,
        hasSortFn: isSortFn(p["sortFn"]),
      });
      return svc;
    });
    // Zag's root entry `loadIfNeeded`: an autoReload mount loads once, and
    // the watcher below answers every dependency change after it.
    if (p["autoReload"] === true) untrack(() => send({ type: "RELOAD" }));
    return service;
  };

  /** Advance past the work in flight. A resolution from an earlier sequence
   * is dropped where it lands, and the previous fetch is told to stop. */
  function advanceSequence(): number {
    seq += 1;
    aborting?.abort();
    aborting = undefined;
    return seq;
  }

  function startFetch(
    event: AsyncListEvent,
    svc: Service<AsyncListContext, AsyncListEvent>,
  ): void {
    const load = readLoad();
    if (load === undefined) return;
    const mine = advanceSequence();
    const controller = new AbortController();
    aborting = controller;
    const context = svc.state.context;
    const loadMore = event.type === "LOAD_MORE";
    const details: LoadDetails = {
      signal: controller.signal,
      filterText: event.type === "FILTER" ? event.filterText : context.filterText,
      cursor: loadMore ? context.cursor : null,
      sortDescriptor: event.type === "SORT"
        ? event.sortDescriptor
        : context.sortDescriptor ?? undefined,
    };
    void load(details).then(
      (result: unknown) => {
        if (mine !== seq) return;
        const resolved = asLoadResult(result);
        send({
          type: "SUCCESS",
          items: resolved.items,
          cursor: resolved.cursor,
          append: loadMore,
        });
      },
      (error: unknown) => {
        if (mine !== seq) return;
        if (isAbortError(error)) return;
        send({ type: "ERROR", error });
      },
    );
  }

  function startSort(
    event: AsyncListEvent,
    svc: Service<AsyncListContext, AsyncListEvent>,
  ): void {
    const sort = readSort();
    if (sort === undefined) return;
    const mine = advanceSequence();
    const context = svc.state.context;
    const details: SortDetails = {
      items: context.items,
      descriptor: event.type === "SORT" ? event.sortDescriptor : context.sortDescriptor ?? undefined,
      filterText: context.filterText,
    };
    let settled: SortResult | Promise<SortResult>;
    try {
      settled = sort(details);
    } catch (error: unknown) {
      if (mine === seq) send({ type: "ERROR", error });
      return;
    }
    void Promise.resolve(settled).then(
      (result: unknown) => {
        if (mine !== seq) return;
        const resolved = asSortResult(result);
        send({
          type: "SUCCESS",
          items: resolved?.items ?? context.items,
          cursor: null,
          append: false,
        });
      },
      (error: unknown) => {
        if (mine !== seq) return;
        send({ type: "ERROR", error });
      },
    );
  }

  /** The reflex table: which event needs which piece of async work. */
  function drive(event: AsyncListEvent, before: string): void {
    // Zag's cancelFetch/cancelSort, on the only events that reach them.
    if (event.type === "ABORT") {
      if (before !== "idle") advanceSequence();
      return;
    }
    if (event.type === "SUCCESS" || event.type === "ERROR") return;
    const svc = ensureService();
    if (svc.state.value === "sorting") startSort(event, svc);
    else if (svc.state.value === "loading") startFetch(event, svc);
  }

  /** Zag's invokeOnSuccess/invokeOnError: the outcome, reported outward. */
  function report(event: AsyncListEvent): void {
    if (event.type !== "SUCCESS" && event.type !== "ERROR") return;
    const callbacks = readCallbacks();
    if (event.type === "SUCCESS") callbacks.onSuccess?.({ items: event.items });
    else callbacks.onError?.({ error: event.error });
  }

  const send = (event: AsyncListEvent): void => {
    const svc = ensureService();
    const before = svc.state.value;
    Object.assign(svc.state.context, { hasSortFn: isSortFn(props()["sortFn"]) });
    svc.send(event);
    drive(event, before);
    report(event);
    tick(tick() + 1);
    machineTick(machineTick() + 1);
  };

  /**
   * Zag's `watch` on `dependencies`, plus the scalar sync, in one owned
   * effect: it reads the live prop signals, so a host write reloads the list
   * without a machine event.
   *
   * The mount hash is captured, never dispatched — Zag's watcher fires on a
   * change only, and the mount load is `autoReload`'s job. The effect writes
   * no tick of its own that it also reads, so a later send never re-runs it.
   */
  owner.run(() =>
    effect(() => {
      const svc = ensureService();
      let moved = false;
      const hasSortFn = isSortFn(props()["sortFn"]);
      if (svc.state.context.hasSortFn !== hasSortFn) {
        svc.state.context.hasSortFn = hasSortFn;
        moved = true;
      }
      // Zag's hashDeps: the scalars, joined, with the empty ones dropped.
      const dependencies = asArray(props()["dependencies"])
        .filter((dependency) => Boolean(dependency))
        .join(",");
      if (lastDependencies === undefined) lastDependencies = dependencies;
      else if (dependencies !== lastDependencies) {
        lastDependencies = dependencies;
        untrack(() => send({ type: "RELOAD" }));
      }
      if (moved) {
        tick(tick() + 1);
        machineTick(machineTick() + 1);
      }
    }),
  );

  /** The service surface the connect reads. Built once: the connect lives as
   * long as the bridge does, so this is the stable accessor it caches
   * against. */
  const serviceApi: AsyncListService = {
    send,
    get context() {
      return ensureService().state.context;
    },
    get state() {
      return ensureService().state;
    },
  };

  /** One connect per element, not one per machine move: its bags are cached
   * against machine state. */
  let asyncListConnect: AsyncListApi | undefined;
  const ensureConnect = (): AsyncListApi => {
    asyncListConnect ??= connectRobotAsyncList(serviceApi, id);
    return asyncListConnect;
  };

  /** The api is read on every machine move, so this depends on the tick and
   * hands out the same connect each time. */
  const connected = computed(() => {
    tick();
    return ensureConnect();
  });

  const api = new Proxy({} as AsyncListApi, {
    get: (_target, key) => Reflect.get(connected(), key),
    has: (_target, key) => Reflect.has(connected(), key),
    ownKeys: () => Reflect.ownKeys(connected()),
    getOwnPropertyDescriptor: (_target, key) => {
      const descriptor = Reflect.getOwnPropertyDescriptor(connected(), key);
      return descriptor && { ...descriptor, configurable: true };
    },
  });

  return {
    api,
    dispose: () => {
      service?.stop();
      owner.dispose();
    },
  };
}
