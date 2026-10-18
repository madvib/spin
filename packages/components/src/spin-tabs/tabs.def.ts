import {
  defineComponent,
  textProp,
  type ComponentDef,
} from "@spin/runtime";
import {
  config,
  implementations,
  type TabsContext,
  type TabsEvent,
  type TabsItem,
  type TabsValueChange,
} from "./tabs.machine.ts";

/**
 * Tabs definition: the DOM contract as data. Selection is component
 * state — the platform owns no tab selection — so this is a machine,
 * not a controller. Automatic activation: arrows/Home/End select and
 * move DOM focus together (the toggle-group reflex pattern).
 *
 * Bag names match the old controller exactly (getRootProps,
 * getListProps, getTriggerProps(row), getContentProps(row), select,
 * value), so the eleven examples render unchanged.
 */

export interface TabsApi {
  readonly value: string;
  select(value: string): void;
  getRootProps(): Record<string, unknown>;
  getListProps(): Record<string, unknown>;
  getTriggerProps(item: TabsItem): Record<string, unknown>;
  getContentProps(item: TabsItem): Record<string, unknown>;
}

export type { TabsItem, TabsValueChange };

const asCtx = (context: Record<string, unknown>): TabsContext =>
  context as unknown as TabsContext;

interface ScopeLike {
  readonly id: (part: string, slot?: unknown) => string;
  readonly props: Record<string, unknown>;
  readonly context: Record<string, unknown>;
  readonly send: (event: { type: string } & Record<string, unknown>) => void;
  readonly attr: (value: boolean) => string | undefined;
}

const parseItems = (raw: unknown): readonly TabsItem[] => {
  const list: unknown = typeof raw === "string"
    ? ((): unknown => {
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    })()
    : raw;
  if (!Array.isArray(list)) return [];
  const items: TabsItem[] = [];
  for (const entry of list) {
    if (typeof entry !== "object" || entry === null) continue;
    const record = entry as Record<string, unknown>;
    const value = record["value"];
    if (typeof value !== "string" || value.length === 0) continue;
    items.push({
      value,
      label: typeof record["label"] === "string" ? record["label"] : value,
      content: typeof record["content"] === "string" ? record["content"] : "",
    });
  }
  return items;
};

/** The view reflex: after a keyboard move the newly selected tab takes DOM focus. */
const focusTab = (id: (part: string, slot?: unknown) => string, value: string): void => {
  if (typeof document === "undefined") return;
  document.getElementById(id("trigger", value))?.focus({ preventScroll: true });
};

const enabledValues = (scope: ScopeLike): string[] =>
  parseItems(scope.props["items"]).map((item) => item.value);

/** Neighbor resolution with loop wrap (tabs always loop, Zag's model). */
const neighbor = (scope: ScopeLike, value: string, direction: 1 | -1): string | null => {
  const order = enabledValues(scope);
  const at = order.findIndex((entry) => entry === value);
  if (at < 0 || order.length === 0) return null;
  return order[(at + direction + order.length) % order.length] ?? null;
};

const def: ComponentDef<TabsContext, TabsEvent> = {
  name: "tabs",
  config,
  implementations,
  start: "idle",
  seed: (props) => {
    const defaultValue = textProp(props["defaultValue"] as string);
    const first = parseItems(props["items"])[0]?.value ?? "";
    return {
      // Controlled `value` wins; uncontrolled falls back to `defaultValue`,
      // then the first tab so a value is always selected.
      value: textProp(props["value"] as string) || defaultValue || first,
      defaultValue,
    };
  },
  channels: {
    items: { parse: parseItems },
    value: {
      controlled: true,
      parse: (raw) => textProp(raw as string),
      event: (value: string) => ({ type: "VALUE.SET", value }),
      equal: (current, outer) => current === outer,
    },
    defaultValue: { parse: (raw) => textProp(raw as string) },
  },
  scalars: [],
  parts: {
    root: {
      sig: () => "",
      attrs: (scope) => ({
        id: scope.id("root"),
        "data-scope": "tabs",
        "data-part": "root",
        "data-state": "idle",
      }),
    },
    list: {
      sig: () => "",
      attrs: (scope) => ({
        id: scope.id("list"),
        role: "tablist",
        "aria-orientation": "horizontal",
        "data-scope": "tabs",
        "data-part": "list",
      }),
    },
    trigger: {
      sig: (scope, slot) => [asCtx(scope.context).value, (slot as TabsItem).value].join("|"),
      attrs: (scope, slot) => {
        const row = slot as TabsItem;
        const isSelected = asCtx(scope.context).value === row.value;
        return {
          id: scope.id("trigger", row.value),
          role: "tab",
          "data-tabs-value": row.value,
          "aria-selected": isSelected ? "true" : "false",
          "data-scope": "tabs",
          "data-part": "trigger",
          "data-state": isSelected ? "active" : "inactive",
          tabindex: isSelected ? "0" : "-1",
          "aria-controls": scope.id("content", row.value),
          onClick: () => {
            scope.send({ type: "TAB.SELECT", value: row.value });
          },
          onKeydown: (event: KeyboardEvent) => {
            if (event.defaultPrevented) return;
            const move = (next: string | null): void => {
              if (next === null) return;
              event.preventDefault();
              scope.send({ type: "TAB.SELECT", value: next });
              focusTab(scope.id, next);
            };
            switch (event.key) {
              case "ArrowRight":
              case "ArrowDown":
                move(neighbor(scope, row.value, 1));
                break;
              case "ArrowLeft":
              case "ArrowUp":
                move(neighbor(scope, row.value, -1));
                break;
              case "Home":
                move(enabledValues(scope)[0] ?? null);
                break;
              case "End": {
                const order = enabledValues(scope);
                move(order[order.length - 1] ?? null);
                break;
              }
              default:
                break;
            }
          },
        };
      },
    },
    content: {
      sig: (scope, slot) => [asCtx(scope.context).value, (slot as TabsItem).value].join("|"),
      attrs: (scope, slot) => {
        const row = slot as TabsItem;
        const isSelected = asCtx(scope.context).value === row.value;
        return {
          id: scope.id("content", row.value),
          role: "tabpanel",
          "data-tabs-value": row.value,
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
    select: { event: (args) => ({ type: "TAB.SELECT", value: args[0] as string }) },
  },
  readers: {
    value: { read: (context) => asCtx(context).value },
  },
  methods: {},
  events: {
    "value-change": {
      prop: "onValueChange",
      watch: (context) => [asCtx(context).value],
      detail: (watched) => ({ value: watched[0] as string }),
    },
  },
};

export const tabs = defineComponent<TabsContext, TabsEvent, TabsApi>(def);
