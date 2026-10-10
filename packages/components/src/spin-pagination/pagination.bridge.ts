import { computed, effect, machineTick, scope, signal, untrack } from "@spin/runtime";
import { createMachine, interpret, type FsmService } from "@spin/runtime/fsm";
import {
  connectRobotPagination,
  type PaginationFsmApi,
  type PaginationFsmConnectProps,
  type PaginationService,
  type PaginationTranslations,
} from "./pagination.connect.ts";
import { config, implementations, type PaginationContext, type PaginationEvent } from "./pagination.machine.ts";

export interface PaginationPageChange {
  readonly page: number;
  readonly pageSize: number;
}

export interface PaginationPageSizeChange {
  readonly pageSize: number;
}

/**
 * The pagination bridge: scope values in, machine state out.
 *
 * Four jobs: normalize the props (the scalars the assigns read plus the
 * localized strings), seed the first state from `default*`, alternate the
 * page and the page size from AUTHORED props only, and publish the connect
 * api through the live-view proxy.
 *
 * The controlled channel is the authored-prop predicate (`@@authored`) — a
 * coerced default is never a write, which is the `page` vs `defaultPage`
 * distinction Zag gets from its bindables and the scope grammar cannot make
 * on its own. A page size that pushed the page out of range is repaired on
 * the next move, exactly as Zag's watch does.
 */

const DEFAULT_PAGE_SIZE = 10;
const ZERO_FLOOR = 0;

/** Zag's `defaultTranslations`. */
const defaultTranslations: PaginationTranslations = {
  rootLabel: "pagination",
  firstTriggerLabel: "first page",
  prevTriggerLabel: "previous page",
  nextTriggerLabel: "next page",
  lastTriggerLabel: "last page",
  itemLabel: ({ page, totalPages }) => {
    const isLastPage = totalPages > 1 && page === totalPages;
    return `${isLastPage ? "last page, " : ""}page ${page}`;
  },
};

/** A count that is not a non-negative integer cannot page anything. */
const toCount = (raw: unknown): number => {
  const value = typeof raw === "number" && Number.isFinite(raw) ? Math.trunc(raw) : 0;
  return value < 0 ? 0 : value;
};

/** A size below one divides by zero; the bridge floors it where the machine
 * would otherwise report Infinity pages. */
const toSize = (raw: unknown): number => {
  const value = typeof raw === "number" && Number.isFinite(raw) ? Math.trunc(raw) : DEFAULT_PAGE_SIZE;
  return value < 1 ? 1 : value;
};

const toSiblings = (raw: unknown, fallback: number): number => {
  const value = typeof raw === "number" && Number.isFinite(raw) ? Math.trunc(raw) : fallback;
  return value < 0 ? 0 : value;
};

const toPage = (raw: unknown): number | undefined => {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return undefined;
  return Math.trunc(raw);
};

/**
 * Zag's `mergeWithDefault`: a host overrides individual members and the rest
 * keep their English default. The shape is validated here rather than
 * trusted at every read.
 */
const parseTranslations = (raw: unknown): PaginationTranslations => {
  if (typeof raw !== "object" || raw === null) return defaultTranslations;
  const text = (key: string, fallback: string): string => {
    const value: unknown = Reflect.get(raw, key);
    return typeof value === "string" ? value : fallback;
  };
  const label = (key: string): PaginationTranslations["itemLabel"] => {
    const value: unknown = Reflect.get(raw, key);
    if (typeof value !== "function") return defaultTranslations.itemLabel;
    return (details: { page: number; totalPages: number }): string => {
      const made: unknown = (value as (details: { page: number; totalPages: number }) => string)(details);
      return typeof made === "string" ? made : defaultTranslations.itemLabel(details);
    };
  };
  return {
    rootLabel: text("rootLabel", defaultTranslations.rootLabel),
    firstTriggerLabel: text("firstTriggerLabel", defaultTranslations.firstTriggerLabel),
    prevTriggerLabel: text("prevTriggerLabel", defaultTranslations.prevTriggerLabel),
    nextTriggerLabel: text("nextTriggerLabel", defaultTranslations.nextTriggerLabel),
    lastTriggerLabel: text("lastTriggerLabel", defaultTranslations.lastTriggerLabel),
    itemLabel: label("itemLabel"),
  };
};

/** A prop the scope grammar cannot declare: `translations` is a nested
 * object holding a function, so it crosses as an element property that the
 * bridge reads off the root. */
const hostProp = (root: () => Element, name: string): unknown => Reflect.get(root(), name);

export function createPaginationFsmBridge(
  props: () => Record<string, unknown>,
  root: () => Element,
  id: string,
): { readonly api: PaginationFsmApi; dispose(): void } {
  const owner = scope();
  const tick = signal(0);
  const machine = createMachine<PaginationContext, PaginationEvent>(config, implementations);

  let service: FsmService<PaginationContext, PaginationEvent> | undefined;

  const authored = (name: string): boolean => {
    const predicate = props()["@@authored"];
    return typeof predicate === "function" ? (predicate as (n: string) => boolean)(name) : false;
  };

  const readConnectProps: () => PaginationFsmConnectProps = () => {
    const p = props();
    return {
      count: toCount(p["count"]),
      siblingCount: toSiblings(p["siblingCount"], 1),
      boundaryCount: toSiblings(p["boundaryCount"], 1),
      dir: typeof p["dir"] === "string" ? p["dir"] : "",
      translations: parseTranslations(hostProp(root, "translations")),
    };
  };

  const ensureService = (): FsmService<PaginationContext, PaginationEvent> => {
    if (service) return service;
    const p = props();
    const page = toPage(authored("page") ? p["page"] : p["defaultPage"]);
    const pageSize = toSize(authored("pageSize") ? p["pageSize"] : p["defaultPageSize"]);
    const seededPage = page === undefined ? 1 : Math.max(1, page);
    service = owner.run(() => {
      const svc = interpret(machine).start();
      Object.assign(svc.state.context, {
        page: seededPage,
        pageSize,
        count: toCount(p["count"]),
      });
      return svc;
    });
    return service;
  };

  let lastPage = ensureService().state.context.page;
  let lastPageSize = ensureService().state.context.pageSize;

  const reportIfMoved = (): void => {
    const svc = ensureService();
    const after = svc.state.context;
    const p = props();
    if (after.pageSize !== lastPageSize) {
      lastPageSize = after.pageSize;
      pickSizeCallback(p, "onPageSizeChange")?.({ pageSize: after.pageSize });
    }
    if (after.page !== lastPage) {
      lastPage = after.page;
      pickCallback(p, "onPageChange")?.({ page: after.page, pageSize: after.pageSize });
    }
  };

  /**
   * Controlled alternation plus the `count` sync, in one owned effect: it
   * reads the live prop signals, so a host write — property or attribute —
   * moves the machine without waiting for a machine event.
   *
   * It bumps the tick UNTRACKED: a tick read here would be a dependency, and
   * every later send would re-run this effect and re-impose the authored prop
   * over the machine's own move.
   */
  owner.run(() =>
    effect(() => {
      const svc = ensureService();
      let moved = false;
      const count = toCount(props()["count"]);
      if (svc.state.context.count !== count) {
        svc.state.context.count = count;
        moved = true;
      }
      if (authored("page")) {
        const outer = toPage(props()["page"]);
        if (outer !== undefined && outer >= 1 && outer !== svc.state.context.page) {
          untrack(() => svc.send({ type: "SET_PAGE", page: outer }));
          moved = true;
        }
      }
      if (authored("pageSize")) {
        const outer = toSize(props()["pageSize"]);
        if (outer !== svc.state.context.pageSize) {
          untrack(() => svc.send({ type: "SET_PAGE_SIZE", size: outer }));
          moved = true;
        }
      }
      if (moved) {
        reportIfMoved();
        untrack(() => {
          tick(tick() + 1);
          machineTick(machineTick() + 1);
        });
      }
    }),
  );

  const send = (event: PaginationEvent): void => {
    const svc = ensureService();
    svc.state.context.count = toCount(props()["count"]);
    svc.send(event);
    reportIfMoved();
    untrack(() => {
      tick(tick() + 1);
      machineTick(machineTick() + 1);
    });
  };

  /** The service surface the connect reads. Built once: the connect lives as
   * long as the bridge does, so this is the stable accessor it caches against. */
  const serviceApi: PaginationService = {
    send: send as (event: { type: string } & Record<string, unknown>) => void,
    get context() {
      return ensureService().state.context;
    },
  };

  /** One connect per element, not one per machine move: its bags are cached
   * against the fields they read, and rebuilding it per move would hand the
   * `for` loop fresh entries each tick. */
  let paginationConnect: PaginationFsmApi | undefined;
  const ensureConnect = (): PaginationFsmApi => {
    paginationConnect ??= connectRobotPagination(serviceApi, readConnectProps, id);
    return paginationConnect;
  };

  /** The api is read on every machine move, so this depends on the tick and
   * hands out the same connect each time. */
  const connected = computed(() => {
    tick();
    return ensureConnect();
  });

  const api = new Proxy({} as PaginationFsmApi, {
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

/** A host callback is a plain function on the prop bag; anything else is
 * no callback at all. */
type Callback = (details: PaginationPageChange) => void;
type SizeCallback = (details: PaginationPageSizeChange) => void;

function pickCallback(
  props: Record<string, unknown>,
  name: string,
): Callback | undefined {
  const value = props[name];
  return typeof value === "function" ? (value as Callback) : undefined;
}

function pickSizeCallback(
  props: Record<string, unknown>,
  name: string,
): SizeCallback | undefined {
  const value = props[name];
  return typeof value === "function" ? (value as SizeCallback) : undefined;
}
