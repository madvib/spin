/**
 * Tabs machine: selection is component state, not platform state.
 *
 * The platform owns no tab selection (unlike popover open-ness or input
 * value), so per the state-ownership rule this is a machine, not a
 * controller. It is deliberately small: a single value, VALUE.SET for
 * outer writes, TAB.SELECT for picks, arrow/Home/End navigation with
 * automatic activation (select + focus move together, Zag's model).
 * Roving tabindex falls out of the value: the selected tab is tabbable.
 *
 * The machine is a FACTORY over the element's props: it builds its own
 * context from the arguments it wants, and it declares its contract — the
 * context fields a host may write, and the event each write carries.
 */

import { createMachine, type Machine } from "@spin/runtime/fsm";

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

/**
 * The tabs' arguments: the values the host may set.
 *
 * The names are the element's prop names — the machine is instantiated
 * with the element's prop bag and picks what it wants. The twin
 * (`defaultValue`) is resolved by the framework before the factory is
 * called, so the machine only ever sees the live value; the machine keeps
 * the twin's own text in its context, so it also reads it when the
 * factory is called on its own.
 */
export interface TabsArgs {
  /** The selected tab, as the host wrote it. */
  value?: string;
  /** The tab the flow starts at, as the host wrote it. */
  defaultValue?: string;
  /** The rows, as the transport decoded them. */
  items?: readonly unknown[];
}

/**
 * Shape the arguments into the machine's initial context.
 * Pure shaping only: label-from-value, content-to-empty, and the
 * first-selected fallback (authored `value`, then `defaultValue`, then the
 * first row). Items enter the context as config-that-never-changes. No
 * parsing and no casts — the transport owns prop coercion.
 */
export function initial(args: TabsArgs): TabsContext {
  const rows: readonly unknown[] = Array.isArray(args.items) ? args.items : [];
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
  const written = typeof args.value === "string" ? args.value : "";
  const defaultValue = typeof args.defaultValue === "string" ? args.defaultValue : "";
  return {
    // An authored `value` wins outright; uncontrolled falls back to
    // `defaultValue`, then the first tab so a value is always selected.
    value: written || defaultValue || items[0]?.value || "",
    defaultValue,
    items,
  };
}

/**
 * The tabs machine: state and nothing else. It is headless — it knows
 * its own arguments, and nothing about props, markup, or the DOM.
 */
export function tabs(
  args: TabsArgs = {},
): Machine<TabsContext, TabsEvent> {
  return createMachine<TabsContext, TabsEvent>({
    id: "tabs",
    initial: "idle",
    context: initial(args),
    /**
     * The machine's contract with its hosts: the context fields a host
     * may write, and the event each write carries.
     *
     * A field with an event is REPORTED: the host's write is an event,
     * the machine decides, and the change reaches the host. A field
     * without one is SILENT: the host's write lands in the field, and
     * nothing reports.
     *
     * The rows are the machine's own configuration: they never change
     * while the tabs live, so the host may not write them.
     */
    fields: {
      value: { event: "VALUE.SET" },
    },
    states: {
      idle: {
        on: {
          "VALUE.SET": { actions: [{ assign: "setValue" }] },
          "TAB.SELECT": { actions: [{ assign: "selectTab" }] },
        },
      },
    },
    assigns: {
      // Outer writes win outright; the seed resolves default-vs-value once.
      setValue: (ctx: TabsContext, event: TabsEvent): Partial<TabsContext> => {
        if (event.type !== "VALUE.SET") return {};
        void ctx;
        // The value arrives the way the host wrote it; the machine shapes
        // it, wherever it came from.
        return { value: typeof event.value === "string" ? event.value : "" };
      },
      selectTab: (ctx: TabsContext, event: TabsEvent): Partial<TabsContext> => {
        if (event.type !== "TAB.SELECT") return {};
        if (event.value.length === 0 || event.value === ctx.value) return {};
        return { value: event.value };
      },
    },
  });
}
