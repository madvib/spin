import {
  defineComponent,
  textProp,
  type ComponentDef,
} from "@spin/runtime";
import {
  config,
  implementations,
  nextPage,
  pageItems,
  pageRange,
  previousPage,
  totalPages,
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

// Scope props arrive as strings; hooks write numbers. Accept both — a
// string-authored `defaultValue="45"` seeds 45, not 0.
const numProp = (raw: unknown): number | null => {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  if (typeof raw === "string" && raw.trim().length > 0) {
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

type Ctx = PaginationContext;

const asCtx = (context: Record<string, unknown>): Ctx => context as unknown as Ctx;

/** Stable item-array identity per window signature: the recipe's `for`
 * re-stamps rows when the source identity moves. */
const itemsCache = new Map<string, readonly PaginationPageItem[]>();
const windowItems = (context: Ctx): readonly PaginationPageItem[] => {
  const sig = [context.page, context.pageSize, context.count, context.siblingCount, context.boundaryCount].join("|");
  const hit = itemsCache.get(sig);
  if (hit !== undefined) return hit;
  const made = pageItems(context);
  itemsCache.set(sig, made);
  return made;
};

const def: ComponentDef<PaginationContext, PaginationEvent> = {
  name: "pagination",
  config,
  implementations,
  start: "idle",
  seed: (props, authored) => ({
    page: numProp(authored("page") ? props["page"] : props["defaultPage"]) ?? 1,
    pageSize: numProp(authored("pageSize") ? props["pageSize"] : props["defaultPageSize"]) ?? 10,
    count: numProp(props["count"]) ?? 0,
    siblingCount: numProp(props["siblingCount"]) ?? 1,
    boundaryCount: numProp(props["boundaryCount"]) ?? 1,
  }),
  channels: {
    page: {
      controlled: true,
      parse: numProp,
      event: (value: number) => ({ type: "SET_PAGE", page: value }),
    },
    defaultPage: { parse: numProp },
    pageSize: {
      controlled: true,
      parse: numProp,
      event: (value: number) => ({ type: "SET_PAGE_SIZE", size: value }),
    },
    defaultPageSize: { parse: numProp },
    count: { parse: numProp },
    siblingCount: { parse: numProp },
    boundaryCount: { parse: numProp },
    dir: { parse: (raw) => (raw === "rtl" ? "rtl" : "ltr") },
    label: { parse: textProp },
    firstLabel: { parse: textProp },
    prevLabel: { parse: textProp },
    nextLabel: { parse: textProp },
    lastLabel: { parse: textProp },
  },
  scalars: ["count", "siblingCount", "boundaryCount"],
  parts: {
    root: {
      sig: (scope) => [scope.props["label"], scope.props["dir"], asCtx(scope.context).page].join("|"),
      attrs: (scope) => ({
        id: scope.id("root"),
        dir: scope.props["dir"],
        role: "navigation",
        "aria-label": scope.props["label"],
        "data-scope": "pagination",
        "data-part": "root",
      }),
    },
    firstTrigger: {
      id: "first",
      sig: (scope) => [scope.props["firstLabel"], asCtx(scope.context).page !== 1].join("|"),
      attrs: (scope) => triggerBag(scope, "firstTrigger", "first-trigger", scope.props["firstLabel"] as string, asCtx(scope.context).page !== 1, "FIRST_PAGE"),
    },
    prevTrigger: {
      id: "prev",
      sig: (scope) => [scope.props["prevLabel"], previousPage(asCtx(scope.context)) !== null].join("|"),
      attrs: (scope) => triggerBag(scope, "prevTrigger", "prev-trigger", scope.props["prevLabel"] as string, previousPage(asCtx(scope.context)) !== null, "PREVIOUS_PAGE"),
    },
    nextTrigger: {
      id: "next",
      sig: (scope) => [scope.props["nextLabel"], nextPage(asCtx(scope.context)) !== null].join("|"),
      attrs: (scope) => triggerBag(scope, "nextTrigger", "next-trigger", scope.props["nextLabel"] as string, nextPage(asCtx(scope.context)) !== null, "NEXT_PAGE"),
    },
    lastTrigger: {
      id: "last",
      sig: (scope) => {
        const ctx = asCtx(scope.context);
        return [scope.props["lastLabel"], ctx.page < totalPages(ctx)].join("|");
      },
      attrs: (scope) => {
        const ctx = asCtx(scope.context);
        return triggerBag(scope, "lastTrigger", "last-trigger", scope.props["lastLabel"] as string, ctx.page < totalPages(ctx), "LAST_PAGE");
      },
    },
  },
  slots: {
    item: {
      indexes: (context) => windowItems(asCtx(context)),
      sig: (scope) => {
        const item = scope.slot as unknown as PaginationPageItem;
        if (item.type !== "page") return "hidden";
        return [item.value === asCtx(scope.context).page, item.value].join("|");
      },
      attrs: (scope) => {
        const item = scope.slot as unknown as PaginationPageItem;
        // Templates have no conditional: the recipe renders button + span
        // twins and the wrong kind hides itself.
        if (item.type !== "page") return { "data-hidden": "", "aria-hidden": "true", tabindex: "-1" };
        const current = item.value === asCtx(scope.context).page;
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
      indexes: (context) => windowItems(asCtx(context)),
      sig: (scope) => {
        const item = scope.slot as unknown as PaginationPageItem;
        if (item.type !== "ellipsis") return "hidden";
        return `ellipsis:${item.index}`;
      },
      attrs: (scope) => {
        const item = scope.slot as unknown as PaginationPageItem;
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
    setPage: { event: (args) => ({ type: "SET_PAGE", page: args[0] as number }) },
    setPageSize: { event: (args) => ({ type: "SET_PAGE_SIZE", size: args[0] as number }) },
    goToFirstPage: { event: () => ({ type: "FIRST_PAGE" }) },
    goToLastPage: { event: () => ({ type: "LAST_PAGE" }) },
    goToNextPage: { event: () => ({ type: "NEXT_PAGE" }) },
    goToPrevPage: { event: () => ({ type: "PREVIOUS_PAGE" }) },
  },
  readers: {
    page: { read: (context) => asCtx(context).page },
    pageSize: { read: (context) => asCtx(context).pageSize },
    count: { read: (context) => asCtx(context).count },
    totalPages: { read: (context) => totalPages(asCtx(context)) },
    pageRange: { read: (context) => ({ ...pageRange(asCtx(context)) }) },
    previousPage: { read: (context) => previousPage(asCtx(context)) },
    nextPage: { read: (context) => nextPage(asCtx(context)) },
    firstPage: { read: (context) => asCtx(context).page === 1 },
    lastPage: { read: (context) => asCtx(context).page >= totalPages(asCtx(context)) },
  },
  methods: {
    getItems: {
      call: (context) => windowItems(asCtx(context)),
    },
    getItemLabel: {
      call: (context, _state, args) => {
        const value = args[0] as number;
        const total = totalPages(asCtx(context));
        const last = total > 1 && value === total ? "last page, " : "";
        return `${last}page ${value}`;
      },
    },
  },
  events: {
    "page-change": {
      prop: "onPageChange",
      watch: (context) => [asCtx(context).page, asCtx(context).pageSize],
      detail: (_watched, _event, _props, context) => {
        const ctx = asCtx(context as Record<string, unknown>);
        return { page: ctx.page, pageSize: ctx.pageSize };
      },
    },
    "page-size-change": {
      prop: "onPageSizeChange",
      watch: (context) => [asCtx(context).pageSize],
      detail: (watched) => ({ pageSize: watched[0] as number }),
      select: (event, before, after) => {
        if (event.type !== "SET_PAGE_SIZE") return null;
        const beforeSize = (before as unknown as Ctx).pageSize;
        const afterSize = (after as unknown as Ctx).pageSize;
        if (beforeSize === afterSize) return null;
        return { pageSize: afterSize };
      },
    },
  },
};

type ScopeLike = {
  readonly props: Record<string, unknown>;
  readonly context: Record<string, unknown>;
  readonly state: string;
  readonly id: (part: string, slot?: unknown) => string;
  readonly send: (event: { type: string } & Record<string, unknown>) => void;
  readonly attr: (value: boolean) => string | undefined;
};

const triggerBag = (
  scope: ScopeLike,
  key: string,
  part: string,
  label: string,
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
