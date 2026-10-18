/**
 * Tabs machine: selection is component state, not platform state.
 *
 * The platform owns no tab selection (unlike popover open-ness or input
 * value), so per the state-ownership rule this is a machine, not a
 * controller. It is deliberately small: a single value, VALUE.SET for
 * outer writes, TAB.SELECT for picks, arrow/Home/End navigation with
 * automatic activation (select + focus move together, Zag's model).
 * Roving tabindex falls out of the value: the selected tab is tabbable.
 */

export interface TabsItem {
  readonly value: string;
  readonly label: string;
  readonly content: string;
}

export interface TabsContext {
  value: string;
  defaultValue: string;
}

export type TabsEvent =
  | { type: "VALUE.SET"; value: string }
  | { type: "TAB.SELECT"; value: string };

export type TabsValueChange = {
  readonly value: string;
};

export const config = {
  id: "tabs",
  initial: "idle",
  context: {
    value: "",
    defaultValue: "",
  },
  states: {
    idle: {
      on: {
        "VALUE.SET": { actions: [{ assign: "setValue" }] },
        "TAB.SELECT": { actions: [{ assign: "selectTab" }] },
      },
    },
  },
} as const;

export const implementations = {
  assigns: {
    // Outer writes win outright; the seed resolves default-vs-value once.
    setValue: (ctx: TabsContext, event: TabsEvent): Partial<TabsContext> => {
      if (event.type !== "VALUE.SET") return {};
      void ctx;
      return { value: event.value };
    },
    selectTab: (ctx: TabsContext, event: TabsEvent): Partial<TabsContext> => {
      if (event.type !== "TAB.SELECT") return {};
      if (event.value.length === 0 || event.value === ctx.value) return {};
      return { value: event.value };
    },
  },
};
