import { ariaControls, ariaLabelledBy, defineComponent, isRecord, optionRow, type ComponentDef, type PartScope } from "@spin/runtime";
import { ROVING_KEYS } from "../shared/keyboard.ts";
import { tabs as tabsMachine } from "./tabs.machine.ts";
import type { TabsArgs, TabsContext, TabsItem, TabsRow } from "./tabs.state.ts";
import type { TabsEvents, TabsValueChange } from "./tabs.events.ts";

export type { TabsArgs };

/** Tabs definition: the DOM contract (data). */
export type { TabsItem, TabsValueChange };

/** A string the host set, or absent when it did not. The boundary between
 * the host's values and the machine's domain: one place, beside the map. */
const asString = (raw: unknown): string | undefined =>
  typeof raw === "string" ? raw : undefined;

/** The rows the host set: plain records, each field narrowed to its own
 * type. A row without a usable value is left to the machine's own shaping. */
const asRows = (raw: unknown): readonly TabsRow[] | undefined => {
  if (!Array.isArray(raw)) return undefined;
  const rows: TabsRow[] = [];
  for (const entry of raw) {
    if (!isRecord(entry)) continue;
    const row: { value?: string; label?: string; content?: string } = {};
    const value = asString(entry["value"]);
    if (value !== undefined) row.value = value;
    const label = asString(entry["label"]);
    if (label !== undefined) row.label = label;
    const content = asString(entry["content"]);
    if (content !== undefined) row.content = content;
    rows.push(row);
  }
  return rows;
};

const enabledValues = (scope: PartScope<TabsItem, TabsContext>): string[] =>
  scope.context.items.map((item) => item.value);

const neighbor = (scope: PartScope<TabsItem, TabsContext>, value: string, direction: 1 | -1): string | null => {
  const items = scope.context.items;
  const idx = items.findIndex((item) => item.value === value);
  if (idx === -1) return null;
  const next = (idx + direction + items.length) % items.length;
  return items[next]?.value ?? null;
};

const def: ComponentDef<TabsContext, TabsEvents, Record<string, unknown>, TabsArgs> = {
  name: "tabs",
  machine: (args: TabsArgs, authored) => tabsMachine(args, authored),
  args: (props): TabsArgs => {
    const mapped: TabsArgs = {};
    const items = asRows(props.items);
    if (items !== undefined) mapped.items = items;
    const value = asString(props.value);
    if (value !== undefined) mapped.value = value;
    const defaultValue = asString(props.defaultValue);
    if (defaultValue !== undefined) mapped.defaultValue = defaultValue;
    return mapped;
  },
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

export const tabs = defineComponent<TabsContext, TabsEvents, Record<string, unknown>, TabsArgs>(def);
