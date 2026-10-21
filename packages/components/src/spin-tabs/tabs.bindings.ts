import { ariaControls, ariaLabelledBy, defineComponent, optionRow, type ComponentDef, type PartScope } from "@spin/runtime";
import { ROVING_KEYS } from "../shared/keyboard.ts";
import {
  tabs as tabsMachine,
  type TabsArgs,
  type TabsContext,
  type TabsEvents,
  type TabsItem,
  type TabsValueChange,
} from "./tabs.machine.ts";

/** Tabs definition: the DOM contract (data). */
export type { TabsItem, TabsValueChange };

const enabledValues = (scope: PartScope<TabsItem, TabsContext>): string[] =>
  scope.context.items.map((item) => item.value);

const neighbor = (scope: PartScope<TabsItem, TabsContext>, value: string, direction: 1 | -1): string | null => {
  const items = scope.context.items;
  const idx = items.findIndex((item) => item.value === value);
  if (idx === -1) return null;
  const next = (idx + direction + items.length) % items.length;
  return items[next]?.value ?? null;
};

const def: ComponentDef<TabsContext, TabsEvents> = {
  name: "tabs",
  machine: (props, authored) => tabsMachine(props as TabsArgs, authored),
  parts: {
    root: {
      attrs: () => ({ "data-scope": "tabs", "data-part": "root" }),
    },
    list: {
      attrs: () => ({ role: "tablist", "data-scope": "tabs", "data-part": "list" }),
    },
    trigger: {
      attrs: (scope: PartScope<TabsItem, TabsContext>) => {
        const row = scope.slot;
        const isSelected = scope.context.value === row.value;
        return {
          id: scope.id("trigger", row.value),
          role: "tab",
          "data-scope": "tabs",
          "data-part": "trigger",
          "data-state": isSelected ? "active" : "inactive",
          ...optionRow({ selected: isSelected ? "true" : "false" }),
          ...ariaControls(scope, { part: "content", slot: row.value }),
          tabindex: isSelected ? 0 : -1,
          onKeydown: (event: KeyboardEvent) => {
            if (event.defaultPrevented) return;
            const intent = ROVING_KEYS[event.key];
            if (intent === undefined) return;
            const order = enabledValues(scope);
            const target =
              intent.intent === "next"
                ? neighbor(scope, row.value, 1)
                : intent.intent === "prev"
                  ? neighbor(scope, row.value, -1)
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
      attrs: (scope: PartScope<TabsItem, TabsContext>) => {
        const row = scope.slot;
        const isSelected = scope.context.value === row.value;
        return {
          id: scope.id("content", row.value),
          role: "tabpanel",
          "data-scope": "tabs",
          "data-part": "panel",
          "data-state": isSelected ? "active" : "inactive",
          ...ariaLabelledBy(scope, { part: "trigger", slot: row.value }),
          hidden: isSelected ? undefined : true,
        };
      },
    },
  },
  commands: {
    select: { event: (args: readonly unknown[]) => ({ type: "TAB.SELECT", value: typeof args[0] === "string" ? args[0] : "" }) },
  },
  readers: {
    value: { read: (context: TabsContext) => context.value },
  },
  methods: {},
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
};

export const tabs = defineComponent<TabsContext, TabsEvents>(def);
