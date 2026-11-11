import {
  type ApiOf,
  ariaLabelledBy,
  type ComponentDef,
  defineComponent,
  type ViewFor,
} from "@spinjs/components/runtime";
import { ROVING_KEYS } from "../shared/keyboard.ts";
import { toc as tocMachine } from "./toc.machine.ts";
import {
  itemState,
  type TocArgs,
  type TocContext,
  type TocItem,
  type TocItemState,
  type TocRow,
  type TocState,
} from "./toc.state.ts";
import type { TocEvents } from "./toc.events.ts";

export type { TocArgs, TocItem, TocItemState, TocRow, TocState };

const neighbor = (
  context: TocContext,
  value: string,
  direction: 1 | -1,
): string | null => {
  const items = context.items;
  const idx = items.findIndex((item) => item.value === value);
  if (idx === -1) return null;
  const next = idx + direction;
  if (next < 0 || next >= items.length) return null;
  return items[next]?.value ?? null;
};

export const def = {
  name: "toc",
  machine: (args: TocArgs, authored: (name: string) => boolean) =>
    tocMachine(args, authored),
  start: "idle",
  parts: {
    root: {},
    nav: {
      attrs: () => ({
        "aria-label": "On this page",
      }),
    },
    title: {
      attrs: (scope: ViewFor<TocContext, TocEvents, TocState>) => ({
        id: scope.id("title"),
      }),
    },
    list: {
      attrs: (scope: ViewFor<TocContext, TocEvents, TocState>) => ({
        role: "list",
        ...ariaLabelledBy(scope, { part: "title" }),
      }),
    },
    indicator: {
      attrs: (scope: ViewFor<TocContext, TocEvents, TocState>) => ({
        "aria-hidden": "true",
        "data-active": scope.context.activeIds.length > 0 ? "" : undefined,
      }),
    },
    item: {
      attrs: (
        scope: ViewFor<TocContext, TocEvents, TocState> & {
          readonly slot: TocItem;
        },
      ) => {
        const row = scope.slot;
        const st = itemState(scope.context, row);
        return {
          "data-value": row.value,
          "data-depth": String(row.depth),
          "data-active": st.active ? "" : undefined,
          "data-first": st.first ? "" : undefined,
          "data-last": st.last ? "" : undefined,
        };
      },
    },
    link: {
      attrs: (
        scope: ViewFor<TocContext, TocEvents, TocState> & {
          readonly slot: TocItem;
        },
      ) => {
        const row = scope.slot;
        const st = itemState(scope.context, row);
        return {
          id: scope.id("link", row.value),
          href: `#${row.value}`,
          "aria-current": st.active ? "location" : undefined,
          "data-value": row.value,
          "data-depth": String(row.depth),
          // Nested rows indent via `data-[deep]:ps-6`: a numeric
          // `data-[depth=3]` never survives both the extractor (which
          // splits on quotes) and the minifier (which rejects unquoted
          // numbers), so depth past the top level gets its own flag.
          "data-deep": st.depth > 2 ? "" : undefined,
          "data-active": st.active ? "" : undefined,
          onClick: (event: MouseEvent) => {
            if (event.defaultPrevented) return;
            scope.send({ type: "ITEM.SELECT", value: row.value });
          },
          onKeydown: (event: KeyboardEvent) => {
            if (event.defaultPrevented) return;
            const intent = ROVING_KEYS[event.key];
            if (intent === undefined) return;
            const items = scope.context.items;
            const target = intent.intent === "next"
              ? neighbor(scope.context, row.value, 1)
              : intent.intent === "prev"
              ? neighbor(scope.context, row.value, -1)
              : intent.intent === "first"
              ? (items[0]?.value ?? null)
              : (items[items.length - 1]?.value ?? null);
            if (target === null) return;
            event.preventDefault();
            scope.send({ type: "ITEM.SELECT", value: target });
          },
        };
      },
    },
  },
  commands: {
    scrollTo: {
      event: ([value]: [value: string]) => ({ type: "ITEM.SELECT", value }),
    },
    setActiveIds: {
      event: ([activeIds]: [activeIds: readonly string[]]) => ({
        type: "ACTIVE.SET",
        activeIds,
      }),
    },
    setItems: {
      event: ([items]: [items: readonly TocRow[]]) => ({
        type: "ITEMS.SET",
        items,
      }),
    },
  },
  readers: {
    items: { read: (context: TocContext) => context.items },
    activeIds: { read: (context: TocContext) => context.activeIds },
    activeItems: {
      read: (context: TocContext) =>
        context.items.filter((item) => context.activeIds.includes(item.value)),
    },
    value: { read: (context: TocContext) => context.activeIds[0] ?? "" },
  },
  methods: {
    getItemState: {
      call: (
        context: TocContext,
        _state: TocState,
        [row]: [row: TocItem | string],
      ) => itemState(context, row),
    },
  },
  events: {
    "active-change": {
      prop: "onActiveChange",
      watch: (context: TocContext) => [context.activeIds.join("\0")],
      detail: (watched: readonly unknown[]) => {
        const joined = typeof watched[0] === "string" ? watched[0] : "";
        const activeIds = joined.length > 0 ? joined.split("\0") : [];
        return {
          activeIds,
          value: activeIds[0] ?? "",
        };
      },
    },
  },
  settled: ({ event, focus }) => {
    if (event.type !== "ITEM.SELECT") return;
    const value = event["value"];
    if (typeof value === "string") focus("link", value);
  },
} satisfies ComponentDef<
  TocContext,
  TocEvents,
  Record<string, unknown>,
  TocArgs,
  TocState
>;

export type TocApi = ApiOf<typeof def>;

export const toc = defineComponent<
  TocContext,
  TocEvents,
  TocApi,
  TocArgs,
  TocState
>(def);
