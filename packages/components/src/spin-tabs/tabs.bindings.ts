import { defineComponent, type ComponentDef, type PartScope } from "@spin/runtime";
import { ROVING_KEYS } from "../shared/keyboard.ts";
import {
  tabs as tabsMachine,
  type TabsArgs,
  type TabsContext,
  type TabsEvent,
  type TabsItem,
  type TabsValueChange,
} from "./tabs.machine.ts";

/**
 * Tabs definition: the DOM contract (data). Selection is component
 * state — the platform owns no tab selection — so this is a machine,
 * not a controller. Automatic activation: arrows/Home/End select and
 * move DOM focus together (the toggle-group reflex pattern).
 *
 * Bag names match the old controller exactly (getRootProps,
 * getListProps, getTriggerProps(row), getContentProps(row), select,
 * value), so the eleven examples render unchanged.
 *
 * Shipped shape: no channels (the transport's prop grammar owns prop
 * coercion), no parse helpers, no DOM access, no CSS custom properties
 * — the bags emit roles, ARIA pairing and `data-state`/`data-part` hooks
 * only; recipes own the visual chrome via `data-[state]` Uno variants.
 */
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

const def: ComponentDef<TabsContext, TabsEvent> = {
  name: "tabs",
  // The machine: a factory over the element's props. The machine builds
  // its own context from the arguments it wants; the element decides
  // which of its props reach the machine.
  machine: (props) => tabsMachine(props as TabsArgs),
  parts: {
    root: {
      sig: () => "",
      attrs: () => ({ "data-scope": "tabs", "data-part": "root" }),
    },
    list: {
      sig: () => "",
      attrs: () => ({ role: "tablist", "data-scope": "tabs", "data-part": "list" }),
    },
    trigger: {
      sig: (scope: PartScope<TabsItem, TabsContext>) => [scope.context.value, scope.slot.value].join("|"),
      attrs: (scope: PartScope<TabsItem, TabsContext>) => {
        const row = scope.slot;
        const isSelected = scope.context.value === row.value;
        return {
          id: scope.id("trigger", row.value),
          role: "tab",
          "data-scope": "tabs",
          "data-part": "trigger",
          "data-state": isSelected ? "active" : "inactive",
          "aria-selected": isSelected ? "true" : "false",
          "aria-controls": scope.id("content", row.value),
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
      sig: (scope: PartScope<TabsItem, TabsContext>) => [scope.context.value, scope.slot.value].join("|"),
      attrs: (scope: PartScope<TabsItem, TabsContext>) => {
        const row = scope.slot;
        const isSelected = scope.context.value === row.value;
        return {
          id: scope.id("content", row.value),
          role: "tabpanel",
          "data-scope": "tabs",
          "data-part": "panel",
          "data-state": isSelected ? "active" : "inactive",
          "aria-labelledby": scope.id("trigger", row.value),
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

export const tabs = defineComponent<TabsContext, TabsEvent>(def);
