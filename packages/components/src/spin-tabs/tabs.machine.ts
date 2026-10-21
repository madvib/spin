/** Tabs machine: selection is component state, not platform state. */

import { defaultTwin } from "@spin/runtime";
import { createMachine, type EventUnion, type Machine } from "@spin/runtime/fsm";

export interface TabsItem {
  readonly value: string;
  readonly label: string;
  readonly content: string;
}

export interface TabsContext {
  value: string;
  defaultValue: string;
  /** Configuration-that-never-changes: the shaped rows, supplied once at
   * instantiation. Bags read this for keyboard navigation. */
  items: readonly TabsItem[];
}

/**
 * The tabs' events, as a MAP: the contract with the outside. The spec's
 * `on` map is typed over it, so a transition's KEY narrows the event it
 * receives — an assign reads its payload with no guard and no cast.
 */
export interface TabsEvents {
  "VALUE.SET": { value: string };
  "TAB.SELECT": { value: string };
}

export type TabsEvent = EventUnion<TabsEvents>;

export type TabsValueChange = {
  readonly value: string;
};

/** A transport-coerced row: `label` may be absent — transport does not
 * invent labels, `initial` falls back to the value. */
export interface TabsRow {
  readonly value?: unknown;
  readonly label?: unknown;
  readonly content?: unknown;
}

/**
 * The tabs' arguments: the values the host may set.
 *
 * The twin (`defaultValue`) is resolved by the framework before the factory
 * is called, so the machine only ever sees the live value; the machine
 * keeps the twin's own text in its context, so it also reads it when the
 * factory is called on its own.
 */
export interface TabsArgs {
  items?: readonly unknown[];
  value?: string;
  defaultValue?: string;
}

/**
 * Shape the arguments into the machine's initial context.
 * Pure shaping only: label-from-value, content-to-empty, and the
 * first-selected fallback (the host's write, then `defaultValue`, then the
 * first row).
 *
 * The seed twin (`defaultValue`) is the host's write of the selection —
 * the framework resolved it into the args — so it counts as a write too.
 */
export function initial(args: TabsArgs = {}, authored: (name: string) => boolean): TabsContext {
  // A host that wrote `defaultValue` wrote the channel too.
  const written = (field: string): boolean =>
    authored(field) ||
    authored(defaultTwin(field)) ||
    (args as Record<string, unknown>)[defaultTwin(field)] !== undefined;
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
  const hostValue = typeof args.value === "string" ? args.value : "";
  const defaultValue = typeof args.defaultValue === "string" ? args.defaultValue : "";
  return {
    // The host's write wins outright; uncontrolled falls back to the first
    // tab, so a value is always selected.
    value: written("value")
      ? hostValue || defaultValue || items[0]?.value || ""
      : items[0]?.value || "",
    defaultValue,
    items,
  };
}

export function tabs(
  args: TabsArgs = {},
  authored: (name: string) => boolean,
): Machine<TabsContext, TabsEvents> {
  return createMachine<TabsContext, TabsEvents>({
    id: "tabs",
    initial: "idle",
    context: initial(args, authored),
    /**
     * The machine's contract with its hosts: the context fields a host may
     * write, and the event each write carries. A field with an event is
     * REPORTED — the machine decides, and the change reaches the host; a
     * field without one is SILENT.
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
          "VALUE.SET": {
            // The KEY narrows the event: `event.value` is a string.
            assign: (_ctx, event) => ({
              value: typeof event.value === "string" ? event.value : "",
            }),
          },
          "TAB.SELECT": {
            assign: (ctx, event) =>
              event.value.length === 0 || event.value === ctx.value ? {} : { value: event.value },
          },
        },
      },
    },
  });
}
