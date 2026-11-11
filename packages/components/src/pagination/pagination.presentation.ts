import {
  type ApiOf,
  ariaCurrent,
  ariaHidden,
  type ComponentDef,
  defineComponent,
  type ViewFor,
  type SlotViewFor,
} from "@spinjs/components/runtime";
import {
  nextPage as nextPageFn,
  pageItems,
  pageOptions,
  pageRange,
  type PaginationArgs,
  type PaginationContext,
  type PaginationState,
  previousPage,
  totalPages,
} from "./pagination.state.ts";
import { pagination as paginationMachine } from "./pagination.machine.ts";
import type { PaginationEvent, PaginationEvents } from "./pagination.events.ts";
export type { PaginationArgs, PaginationState };

type ScopeLike = ViewFor<PaginationContext, PaginationEvents, PaginationState>;
type SlotLike<R> = SlotViewFor<
  R,
  PaginationContext,
  PaginationEvents,
  PaginationState
>;

/** Stable item-array identity per window. */
const itemsCache = new Map<string, ReturnType<typeof pageItems>>();
const windowItems = (
  context: PaginationContext,
): ReturnType<typeof pageItems> => {
  const key = [
    context.page,
    context.pageSize,
    context.count,
    context.siblingCount,
    context.boundaryCount,
  ].join("|");
  const hit = itemsCache.get(key);
  if (hit !== undefined) return hit;
  const made = pageItems(context);
  itemsCache.set(key, made);
  return made;
};

const triggerBag = (
  scope: ScopeLike,
  key: string,
  part: string,
  label: string | undefined,
  enabled: boolean,
  type: keyof PaginationEvents,
): Record<string, unknown> => ({
  type: "button",
  "aria-label": label,
  disabled: enabled ? undefined : true,
  onClick: (e: MouseEvent) => {
    if (e.defaultPrevented) return;
    scope.send({ type } as PaginationEvent);
  },
});

export const def = {
  name: "pagination",
  machine: (args: PaginationArgs, authored: (name: string) => boolean) =>
    paginationMachine(args, authored),
  start: "idle",
  parts: {
    root: {
      attrs: (scope: ScopeLike) => ({
        role: "navigation",
        "aria-label": scope.context.label,
      }),
    },
    firstTrigger: {
      id: "first",
      attrs: (scope: ScopeLike) =>
        triggerBag(
          scope,
          "firstTrigger",
          "first-trigger",
          scope.context.firstLabel,
          scope.context.page !== 1,
          "FIRST_PAGE",
        ),
    },
    prevTrigger: {
      id: "prev",
      attrs: (scope: ScopeLike) =>
        triggerBag(
          scope,
          "prevTrigger",
          "prev-trigger",
          scope.context.prevLabel,
          previousPage(scope.context) !== null,
          "PREVIOUS_PAGE",
        ),
    },
    nextTrigger: {
      id: "next",
      attrs: (scope: ScopeLike) =>
        triggerBag(
          scope,
          "nextTrigger",
          "next-trigger",
          scope.context.nextLabel,
          nextPageFn(scope.context) !== null,
          "NEXT_PAGE",
        ),
    },
    lastTrigger: {
      id: "last",
      attrs: (scope: ScopeLike) => {
        const ctx = scope.context;
        return triggerBag(
          scope,
          "lastTrigger",
          "last-trigger",
          ctx.lastLabel,
          ctx.page < totalPages(ctx),
          "LAST_PAGE",
        );
      },
    },
  },
  slots: {
    item: {
      indexes: (context: PaginationContext) => windowItems(context),
      attrs: (scope: SlotLike<ReturnType<typeof pageItems>[number]>) => {
        const item = scope.slot;
        if (item.type !== "page") {
          return { hidden: true, ...ariaHidden("true"), tabindex: "-1" };
        }
        const current = item.value === scope.context.page;
        return {
          id: scope.id("item", item.value),
          type: "button",
          ...ariaCurrent(current ? "page" : undefined),
          "aria-label": `page ${item.value}`,
          onClick: (e: MouseEvent) => {
            if (e.defaultPrevented) return;
            scope.send({ type: "SET_PAGE", page: item.value });
          },
        };
      },
    },
    ellipsis: {
      indexes: (context: PaginationContext) => windowItems(context),
      attrs: (scope: SlotLike<ReturnType<typeof pageItems>[number]>) => {
        const item = scope.slot;
        if (item.type !== "ellipsis") {
          return { hidden: true, ...ariaHidden("true") };
        }
        return {
          id: scope.id("ellipsis", item.index),
          ...ariaHidden("true"),
        };
      },
    },
  },
  commands: {
    setPage: {
      event: ([page]: [page: number]) => ({ type: "SET_PAGE", page }),
    },
    setPageSize: {
      event: ([size]: [size: number]) => ({
        type: "SET_PAGE_SIZE",
        pageSize: size,
      }),
    },
    goToFirstPage: { event: () => ({ type: "FIRST_PAGE" }) },
    goToLastPage: { event: () => ({ type: "LAST_PAGE" }) },
    goToNextPage: { event: () => ({ type: "NEXT_PAGE" }) },
    goToPrevPage: { event: () => ({ type: "PREVIOUS_PAGE" }) },
  },
  readers: {
    page: { read: (context) => context.page },
    pageSize: { read: (context) => context.pageSize },
    count: { read: (context) => context.count },
    totalPages: { read: (context) => totalPages(context) },
    pageRange: { read: (context) => ({ ...pageRange(context) }) },
    previousPage: { read: (context) => previousPage(context) },
    nextPage: { read: (context) => nextPageFn(context) },
    firstPage: { read: (context) => context.page === 1 },
    lastPage: { read: (context) => context.page >= totalPages(context) },
    pageOptions: { read: (context) => pageOptions(context) },
  },
  methods: {
    getItems: {
      call: (context) => windowItems(context),
    },
    getItemLabel: {
      call: (context, _state, [value]: [value: number]) => {
        const total = totalPages(context);
        const last = total > 1 && value === total ? "last page, " : "";
        return `${last}page ${value}`;
      },
    },
  },
  events: {
    "page-change": {
      prop: "onPageChange",
      watch: (context) => [context.page, context.pageSize],
      detail: (_watched, _event, _props, context: PaginationContext) => ({
        page: context.page,
        pageSize: context.pageSize,
      }),
    },
    "page-size-change": {
      prop: "onPageSizeChange",
      watch: (context) => [context.pageSize],
      detail: (watched: readonly unknown[]) => {
        const size = watched[0];
        return { pageSize: typeof size === "number" ? size : 0 };
      },
      select: (event, before, after) => {
        if (event.type !== "SET_PAGE_SIZE") return null;
        const beforeSize = before.pageSize;
        const afterSize = after.pageSize;
        if (beforeSize === afterSize) return null;
        return { pageSize: afterSize };
      },
    },
  },
} satisfies ComponentDef<
  PaginationContext,
  PaginationEvents,
  Record<string, unknown>,
  PaginationArgs,
  PaginationState
>;

export type PaginationApi = ApiOf<typeof def>;

export const pagination = defineComponent<
  PaginationContext,
  PaginationEvents,
  PaginationApi,
  PaginationArgs,
  PaginationState
>(def);
