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
  /** Configuration-that-never-changes: the shaped rows, supplied once at
   * instantiation via `initial` (the def declares no channels — the
   * transport owns prop coercion). Bags read this for keyboard navigation. */
  items: readonly TabsItem[];
}

export type TabsEvent =
  | { type: "VALUE.SET"; value: string }
  | { type: "TAB.SELECT"; value: string };

export type TabsValueChange = {
  readonly value: string;
};

/** A transport-coerced row: the scope prop grammar has decoded the JSON and
 * typed the fields. `label` may be absent — transport does not invent
 * labels, `initial` falls back to the value. */
export interface TabsRow {
  readonly value?: unknown;
  readonly label?: unknown;
  readonly content?: unknown;
}

/** The transport-coerced input to `initial`: every field optional, since a
 * host may author none of it. */
export interface TabsInitial {
  readonly value?: unknown;
  readonly defaultValue?: unknown;
  readonly items?: unknown;
}

/**
 * Shape the transport-coerced props into the machine's initial context.
 * Pure shaping only: label-from-value, content-to-empty, and the
 * first-selected fallback (authored `value`, then `defaultValue`, then the
 * first row). Items enter the context as config-that-never-changes. No
 * parsing and no casts — the transport owns prop coercion.
 */
export function initial(raw: TabsInitial): TabsContext {
  const rows: readonly unknown[] = Array.isArray(raw.items) ? raw.items : [];
  const items: TabsItem[] = [];
  for (const entry of rows) {
    if (typeof entry !== "object" || entry === null) continue;
    const row = entry as TabsRow;
    const value = row.value;
    if (typeof value !== "string" || value.length === 0) continue;
    items.push({
      value,
      label: typeof row.label === "string" ? row.label : value,
      content: typeof row.content === "string" ? row.content : "",
    });
  }
  const text = (field: unknown): string => (typeof field === "string" ? field : "");
  const defaultValue = text(raw.defaultValue);
  return {
    // An authored `value` wins outright; uncontrolled falls back to
    // `defaultValue`, then the first tab so a value is always selected.
    value: text(raw.value) || defaultValue || items[0]?.value || "",
    defaultValue,
    items,
  };
}

export const config = {
  id: "tabs",
  initial: "idle",
  context: {
    value: "",
    defaultValue: "",
    items: [],
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
