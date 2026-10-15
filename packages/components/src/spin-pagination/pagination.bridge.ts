import { computed, effect, machineTick, scope, signal, untrack } from "@spin/runtime";
import { createMachine, interpret, type Service } from "@spin/runtime/fsm";
import {
  config,
  implementations,
  type PaginationContext,
  type PaginationEvent,
  type PaginationPageChange,
  type PaginationPageSizeChange,
} from "./pagination.machine.ts";
import {
  connectPagination,
  type PaginationApi,
  type PaginationConnectProps,
  type PaginationService,
} from "./pagination.connect.ts";

/**
 * The pagination bridge: scope values in, machine state out.
 *
 * Seed the page from `defaultPage` and the size from `defaultPageSize`;
 * alternate both authored channels against remembered shadows so a machine
 * move of its own is never undone by an unrelated prop change. Report
 * what moved through `page-change` (page or size) and `page-size-change`.
 * The callbacks live on the props surface — the def maps them to
 * CustomEvents.
 */

export interface PaginationCallbacks {
  readonly onPageChange: ((details: PaginationPageChange) => void) | undefined;
  readonly onPageSizeChange: ((details: PaginationPageSizeChange) => void) | undefined;
}

const numProp = (raw: unknown): number | null =>
  typeof raw === "number" && Number.isFinite(raw) ? raw : null;

const textProp = (raw: unknown, fallback: string): string => {
  if (typeof raw !== "string" || raw.length === 0) return fallback;
  return raw;
};

export function createPaginationBridge(
  props: () => Record<string, unknown>,
  _root: () => Element,
  id: string,
): { readonly api: PaginationApi; dispose(): void } {
  const owner = scope();
  const tick = signal(0);
  // The fork's `config.context` is ONE object, and its interpreter starts on
  // it without copying: every pagination on the page would otherwise share
  // one page.
  const machine = createMachine<PaginationContext, PaginationEvent>(
    { ...config, context: { ...config.context } },
    implementations,
  );

  let service: Service<PaginationContext, PaginationEvent> | undefined;

  const authored = (name: string): boolean => {
    const predicate = props()["@@authored"];
    return typeof predicate === "function" ? (predicate as (n: string) => boolean)(name) : false;
  };

  const readCallbacks = (): PaginationCallbacks => {
    const p = props();
    const pick = <T>(name: string): T | undefined => {
      const value = p[name];
      return typeof value === "function" ? (value as T) : undefined;
    };
    return {
      onPageChange: pick<(d: PaginationPageChange) => void>("onPageChange"),
      onPageSizeChange: pick<(d: PaginationPageSizeChange) => void>("onPageSizeChange"),
    };
  };

  const readScalars = (): Pick<
    PaginationContext,
    "count" | "siblingCount" | "boundaryCount"
  > => {
    const p = props();
    return {
      count: Math.max(0, Math.floor(numProp(p["count"]) ?? 0)),
      siblingCount: Math.max(0, Math.floor(numProp(p["siblingCount"]) ?? 1)),
      boundaryCount: Math.max(0, Math.floor(numProp(p["boundaryCount"]) ?? 1)),
    };
  };

  const readConnectProps = (): PaginationConnectProps => {
    const p = props();
    return {
      dir: p["dir"] === "rtl" ? "rtl" : "ltr",
      label: textProp(p["label"], "pagination"),
      firstLabel: textProp(p["firstLabel"], "first page"),
      prevLabel: textProp(p["prevLabel"], "previous page"),
      nextLabel: textProp(p["nextLabel"], "next page"),
      lastLabel: textProp(p["lastLabel"], "last page"),
    };
  };

  const ensureService = (): Service<PaginationContext, PaginationEvent> => {
    if (service) return service;
    const p = props();
    const scalars = readScalars();
    const page = Math.max(1, Math.floor(
      numProp(authored("page") ? p["page"] : p["defaultPage"]) ?? 1,
    ));
    const pageSize = Math.max(1, Math.floor(
      numProp(authored("pageSize") ? p["pageSize"] : p["defaultPageSize"]) ?? 10,
    ));
    service = owner.run(() => {
      const svc = interpret(machine).start("idle");
      Object.assign(svc.state.context, scalars, { page, pageSize });
      return svc;
    });
    return service;
  };

  /** What each controlled channel last imposed, seeded from the same place
   * the machine was, so a host that authors the seeded value writes
   * nothing. */
  const initial = ensureService().state.context;
  let lastPage = initial.page;
  let lastPageSize = initial.pageSize;

  let paginationConnect: PaginationApi | undefined;
  const ensureConnect = (): PaginationApi => {
    paginationConnect ??= connectPagination(serviceApi, readConnectProps, id);
    return paginationConnect;
  };

  /**
   * Report what moved. The cursors advance only after the callbacks: the
   * fork's send is synchronous, so a post-send check would already see the
   * new value.
   */
  const notify = (): void => {
    const after = ensureService().state.context;
    const callbacks = readCallbacks();
    if (lastPage !== after.page || lastPageSize !== after.pageSize) {
      lastPage = after.page;
      lastPageSize = after.pageSize;
      callbacks.onPageChange?.({ page: after.page, pageSize: after.pageSize });
    }
  };

  const notifySize = (): void => {
    const after = ensureService().state.context;
    if (lastPageSize !== after.pageSize) {
      lastPageSize = after.pageSize;
      readCallbacks().onPageSizeChange?.({ pageSize: after.pageSize });
    }
  };

  const send = (event: PaginationEvent): void => {
    const svc = ensureService();
    // The scalars are re-read on every send so an assign or a cond never
    // reads a stale one.
    Object.assign(svc.state.context, readScalars());
    svc.send(event);
    if (event.type === "SET_PAGE_SIZE") notifySize();
    notify();
    tick(tick() + 1);
    machineTick(machineTick() + 1);
  };

  /** The service surface the connect reads. Built once: the connect lives as
   * long as the bridge does, so this is the stable accessor it caches
   * against. */
  const serviceApi: PaginationService = {
    send: send as (event: { type: string } & Record<string, unknown>) => void,
    get context() {
      return ensureService().state.context;
    },
    get state() {
      return ensureService().state.value;
    },
  };

  /**
   * Controlled alternation in one owned effect: it reads the live prop
   * signals, so a host write moves the machine without waiting for a
   * machine event.
   *
   * It writes no tick of its own: `svc.send` bumps the machine tick, which
   * is what wakes the bindings, and a tick read here would re-run the
   * effect on every later move and re-impose the authored props over it.
   */
  owner.run(() =>
    effect(() => {
      const svc = ensureService();
      let moved = false;
      if (authored("page")) {
        const outer = numProp(props()["page"]);
        if (outer !== null && lastPage !== Math.floor(outer)) {
          untrack(() => svc.send({ type: "SET_PAGE", page: Math.floor(outer) }));
          moved = true;
        }
      }
      if (authored("pageSize")) {
        const outer = numProp(props()["pageSize"]);
        if (outer !== null && lastPageSize !== Math.floor(outer)) {
          untrack(() => svc.send({ type: "SET_PAGE_SIZE", size: Math.floor(outer) }));
          moved = true;
        }
      }
      if (moved) {
        notifySize();
        notify();
      }
    }),
  );

  /** The api is read on every machine move, so this depends on the tick and
   * hands out the same connect each time. */
  const connected = computed(() => {
    tick();
    return ensureConnect();
  });

  const api = new Proxy({} as PaginationApi, {
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
