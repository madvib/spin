import {
  type ApiOf,
  ariaControls,
  ariaLabelledBy,
  type ComponentDef,
  defineComponent,
  optionRow,
  type ScopeFor,
} from "@spin/runtime";
import { ROVING_KEYS } from "../shared/keyboard.ts";
import { tabs as tabsMachine } from "./tabs.machine.ts";
import type {
  TabsArgs,
  TabsContext,
  TabsItem,
  TabsState,
} from "./tabs.state.ts";
import type { TabsEvents } from "./tabs.events.ts";

export type { TabsArgs, TabsState };

/** Tabs definition: the DOM contract (data). */
export type { TabsItem };

const enabledValues = (context: TabsContext): string[] =>
  context.items.map((item) => item.value);

const neighbor = (
  context: TabsContext,
  value: string,
  direction: 1 | -1,
): string | null => {
  const items = context.items;
  const idx = items.findIndex((item) => item.value === value);
  if (idx === -1) return null;
  const next = idx + direction;
  if (next < 0 || next >= items.length) {
    return context.loopFocus
      ? (items[(next + items.length) % items.length]?.value ?? null)
      : null;
  }
  return items[next]?.value ?? null;
};

export const def = {
  name: "tabs",
  machine: (args: TabsArgs, authored) => tabsMachine(args, authored),
  start: "idle",
  parts: {
    root: {},
    list: {
      attrs: () => ({ role: "tablist" }),
    },
    trigger: {
      attrs: (
        scope: ScopeFor<TabsContext, TabsEvents, TabsState> & {
          readonly slot: TabsItem;
        },
      ) => {
        const row = scope.slot;
        const isSelected = scope.context.value === row.value;
        return {
          id: scope.id("trigger", row.value),
          type: "button",
          role: "tab",
          "data-state": isSelected ? "active" : "inactive",
          ...optionRow({ selected: isSelected ? "true" : "false" }),
          ...ariaControls(scope, { part: "content", slot: row.value }),
          tabindex: isSelected ? 0 : -1,
          onClick: () => {
            scope.send({ type: "TAB.SELECT", value: row.value });
          },
          onKeydown: (event: KeyboardEvent) => {
            if (event.defaultPrevented) return;
            const intent = ROVING_KEYS[event.key];
            if (intent === undefined) return;
            const order = enabledValues(scope.context);
            const target = intent.intent === "next"
              ? neighbor(scope.context, row.value, 1)
              : intent.intent === "prev"
              ? neighbor(scope.context, row.value, -1)
              : intent.intent === "first"
              ? (order[0] ?? null)
              : (order[order.length - 1] ?? null);
            if (target === null) return;
            event.preventDefault();
            scope.send({ type: "TAB.SELECT", value: target });
          },
        };
      },
    },
    content: {
      attrs: (
        scope: ScopeFor<TabsContext, TabsEvents, TabsState> & {
          readonly slot: TabsItem;
        },
      ) => {
        const row = scope.slot;
        const isSelected = scope.context.value === row.value;
        return {
          id: scope.id("content", row.value),
          role: "tabpanel",
          "data-state": isSelected ? "active" : "inactive",
          ...ariaLabelledBy(scope, { part: "trigger", slot: row.value }),
          hidden: isSelected ? undefined : true,
        };
      },
    },
  },
  commands: {
    select: {
      event: ([value]: [value: string]) => ({ type: "TAB.SELECT", value }),
    },
  },
  readers: {
    value: { read: (context: TabsContext) => context.value },
    items: { read: (context: TabsContext) => context.items },
  },
  events: {
    "value-change": {
      prop: "onValueChange",
      watch: (context: TabsContext) => [context.value],
      detail: (watched: readonly [string]) => ({ value: watched[0] }),
    },
  },
  settled: ({ event, focus }) => {
    if (event.type !== "TAB.SELECT") return;
    const value = event["value"];
    if (typeof value === "string") focus("trigger", value);
  },
} satisfies ComponentDef<
  TabsContext,
  TabsEvents,
  Record<string, unknown>,
  TabsArgs,
  TabsState
>;

export type TabsApi = ApiOf<typeof def>;
export const tabs = defineComponent<
  TabsContext,
  TabsEvents,
  TabsApi,
  TabsArgs,
  TabsState
>(def);
