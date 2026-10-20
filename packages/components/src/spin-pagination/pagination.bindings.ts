import {
  dataAttr,
  defineComponent,
  textProp,
  type ComponentDef,
  type PartScope,
  type SlotScope,
} from "@spin/runtime";
import {
  nextPage,
  pageItems,
  pageRange,
  pagination as paginationMachine,
  previousPage,
  totalPages,
  type PaginationArgs,
  type PaginationContext,
  type PaginationEvent,
  type PaginationPageChange,
  type PaginationPageItem,
} from "./pagination.machine.ts";

/**
 * Pagination definition: the DOM contract as data. The machine owns the
 * page, the page size, the count, the window math, and the guards; this
 * file maps props to channels, parts to attribute bags, commands to sends,
 * and page moves to their event. Templates have no conditional, so the
 * recipe renders button + span twins and the wrong kind hides itself.
 */

export interface PaginationApi {
  setPage(page: number): void;
  setPageSize(size: number): void;
  goToFirstPage(): void;
  goToLastPage(): void;
  goToNextPage(): void;
  goToPrevPage(): void;
  readonly page: number;
  readonly pageSize: number;
  readonly count: number;
  readonly totalPages: number;
  readonly previousPage: number | null;
  readonly nextPage: number | null;
  readonly firstPage: boolean;
  readonly lastPage: boolean;
  getItems(): readonly PaginationPageItem[];
  getItemLabel(value: number): string;
  getRootProps(): Record<string, unknown>;
  getItemProps(slot: PaginationPageItem): Record<string, unknown>;
  getEllipsisProps(slot: PaginationPageItem): Record<string, unknown>;
  getFirstTriggerProps(): Record<string, unknown>;
  getPrevTriggerProps(): Record<string, unknown>;
  getNextTriggerProps(): Record<string, unknown>;
  getLastTriggerProps(): Record<string, unknown>;
}

/** A string prop off the bag: parsed text arrives as a string, anything
 * else is absent. Named once; the grammar owns the parse. */
const textOf = (props: Record<string, unknown>, name: string): string | undefined => {
  const value: unknown = props[name];
  return typeof value === "string" ? value : undefined;
};

interface ScopeLike extends PartScope<unknown, PaginationContext> {}

interface SlotLike<R> extends SlotScope<R, PaginationContext> {}

type ItemSlot = PaginationPageItem;

/** Stable item-array identity per window signature: the recipe's `for`
 * re-stamps rows when the source identity moves. */
const itemsCache = new Map<string, readonly PaginationPageItem[]>();
const windowItems = (context: PaginationContext): readonly PaginationPageItem[] => {
  const sig = [context.page, context.pageSize, context.count, context.siblingCount, context.boundaryCount].join("|");
  const hit = itemsCache.get(sig);
  if (hit !== undefined) return hit;
  const made = pageItems(context);
  itemsCache.set(sig, made);
  return made;
};

const def: ComponentDef<PaginationContext, PaginationEvent> = {
  name: "pagination",
  // The machine: a factory over the element's props. The machine builds
  // its own context from the arguments it wants; the element decides
  // which of its props reach the machine.
  machine: (props) => paginationMachine(props as PaginationArgs),
  start: "idle",
  parts: {
    root: {
      sig: (scope) => [scope.props["label"], scope.props["dir"], scope.context.page].join("|"),
      attrs: (scope) => ({
        id: scope.id(""),
        dir: scope.props["dir"],
        role: "navigation",
        "aria-label": scope.props["label"],
        "data-scope": "pagination",
        "data-part": "root",
      }),
    },
    firstTrigger: {
      id: "first",
      sig: (scope) => [textOf(scope.props, "firstLabel"), scope.context.page !== 1].join("|"),
      attrs: (scope) => triggerBag(scope, "firstTrigger", "first-trigger", textOf(scope.props, "firstLabel"), scope.context.page !== 1, "FIRST_PAGE"),
    },
    prevTrigger: {
      id: "prev",
      sig: (scope) => [textOf(scope.props, "prevLabel"), previousPage(scope.context) !== null].join("|"),
      attrs: (scope) => triggerBag(scope, "prevTrigger", "prev-trigger", textOf(scope.props, "prevLabel"), previousPage(scope.context) !== null, "PREVIOUS_PAGE"),
    },
    nextTrigger: {
      id: "next",
      sig: (scope) => [textOf(scope.props, "nextLabel"), nextPage(scope.context) !== null].join("|"),
      attrs: (scope) => triggerBag(scope, "nextTrigger", "next-trigger", textOf(scope.props, "nextLabel"), nextPage(scope.context) !== null, "NEXT_PAGE"),
    },
    lastTrigger: {
      id: "last",
      sig: (scope) => {
        const ctx = scope.context;
        return [textOf(scope.props, "lastLabel"), ctx.page < totalPages(ctx)].join("|");
      },
      attrs: (scope) => {
        const ctx = scope.context;
        return triggerBag(scope, "lastTrigger", "last-trigger", textOf(scope.props, "lastLabel"), ctx.page < totalPages(ctx), "LAST_PAGE");
      },
    },
  },
  slots: {
    item: {
      indexes: (context: PaginationContext) => windowItems(context),
      sig: (scope: SlotLike<ItemSlot>) => {
        const item = scope.slot;
        if (item.type !== "page") return "hidden";
        return [item.value === scope.context.page, item.value].join("|");
      },
      attrs: (scope: SlotLike<ItemSlot>) => {
        const item = scope.slot;
        // Templates have no conditional: the recipe renders button + span
        // twins and the wrong kind hides itself.
        if (item.type !== "page") return { "data-hidden": "", "aria-hidden": "true", tabindex: "-1" };
        const current = item.value === scope.context.page;
        return {
          id: scope.id("item", item.value),
          type: "button",
          dir: scope.props["dir"],
          "data-scope": "pagination",
          "data-part": "item",
          "data-index": String(item.value),
          "data-selected": scope.attr(current),
          "aria-current": current ? "page" : undefined,
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
      sig: (scope: SlotLike<ItemSlot>) => {
        const item = scope.slot;
        if (item.type !== "ellipsis") return "hidden";
        return `ellipsis:${item.index}`;
      },
      attrs: (scope: SlotLike<ItemSlot>) => {
        const item = scope.slot;
        if (item.type !== "ellipsis") return { "data-hidden": "", "aria-hidden": "true" };
        return {
          id: scope.id("ellipsis", item.index),
          dir: scope.props["dir"],
          "data-scope": "pagination",
          "data-part": "ellipsis",
          "aria-hidden": "true",
        };
      },
    },
  },
  commands: {
    setPage: { event: (args) => ({ type: "SET_PAGE", page: typeof args[0] === "number" ? args[0] : 1 }) },
    setPageSize: { event: (args) => ({ type: "SET_PAGE_SIZE", pageSize: typeof args[0] === "number" ? args[0] : 10 }) },
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
    nextPage: { read: (context) => nextPage(context) },
    firstPage: { read: (context) => context.page === 1 },
    lastPage: { read: (context) => context.page >= totalPages(context) },
  },
  methods: {
    getItems: {
      call: (context) => windowItems(context),
    },
    getItemLabel: {
      call: (context, _state, args) => {
        const value = typeof args[0] === "number" ? args[0] : 1;
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
      detail: (_watched, _event, _props, context: PaginationContext) => ({ page: context.page, pageSize: context.pageSize }),
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
};

const triggerBag = (
  scope: ScopeLike,
  key: string,
  part: string,
  label: string | undefined,
  enabled: boolean,
  type: string,
): Record<string, unknown> => ({
  id: scope.id(key),
  type: "button",
  dir: scope.props["dir"],
  "aria-label": label,
  "data-scope": "pagination",
  "data-part": part,
  "data-disabled": scope.attr(!enabled),
  disabled: enabled ? undefined : true,
  onClick: (e: MouseEvent) => {
    if (e.defaultPrevented) return;
    scope.send({ type });
  },
});

export const pagination = defineComponent<PaginationContext, PaginationEvent, PaginationApi>(def);
