/**
 * Listbox machine: a single idle state with guards.
 *
 * Zag ships one state — every event is legal always — so the gating lives
 * in named conds. The machine reads `order` and `labels`, synced from scope
 * by the bridge, because highlight targets and the selection's string form
 * are statements about positions, not rows.
 *
 * Navigation is NOT here: arrows/Home/End/typeahead compute their target
 * against the rows the view holds and send NAVIGATE carrying that value.
 */

import { defaultTwin } from "@spin/runtime";
import { createMachine, type Machine } from "@spin/runtime/fsm";

export interface ListboxContext {
  value: string[];
  highlightedValue: string | null;
  focused: boolean;
  order: string[];
  labels: Record<string, string>;
  disabledValues: readonly string[];
  multiple: boolean;
  selectOnHighlight: boolean;
  loopFocus: boolean;
  selectionBehavior: "replace" | "preserve" | "clear";
}

export type ListboxEvent =
  | { type: "SELECTED_ITEMS.SYNC" }
  | {
    type: "HIGHLIGHTED_VALUE.SET";
    value?: string | null;
    highlightedValue?: string | null;
  }
  | { type: "HIGHLIGHTED_VALUE.CLEAR" }
  | { type: "ITEM.SELECT"; value: string }
  | { type: "ITEM.CLEAR"; value: string }
  | { type: "VALUE.SET"; value: readonly string[] }
  | { type: "VALUE.CLEAR" }
  | { type: "ITEM.CLICK"; value: string; shiftKey?: boolean; anchorValue?: string; metaKey?: boolean }
  | { type: "CONTENT.FOCUS" }
  | { type: "CONTENT.BLUR" }
  | { type: "CONTENT.TYPEAHEAD"; key: string }
  | { type: "ITEM.POINTER_MOVE"; value: string }
  | { type: "ITEM.POINTER_LEAVE" }
  | { type: "NAVIGATE"; value: string; shiftKey?: boolean; anchorValue?: string; metaKey?: boolean };

const config = {
  id: "listbox",
  initial: "idle",
  context: {
    value: [] as string[],
    highlightedValue: null as string | null,
    focused: false,
    order: [] as string[],
    labels: {} as Record<string, string>,
    disabledValues: [] as readonly string[],
    multiple: false,
    selectOnHighlight: false,
    loopFocus: true,
    selectionBehavior: "replace" as "replace" | "preserve" | "clear",
  },
  on: {
    "SELECTED_ITEMS.SYNC": { actions: [{ assign: "syncSelectedItems" }] },
    "HIGHLIGHTED_VALUE.SET": { actions: [{ assign: "setHighlightedValue" }] },
    "HIGHLIGHTED_VALUE.CLEAR": { actions: [{ assign: "clearHighlightedValue" }] },
    "ITEM.SELECT": { actions: [{ assign: "selectItem" }] },
    "ITEM.CLEAR": { actions: [{ assign: "clearItem" }] },
    "VALUE.SET": { actions: [{ assign: "setValue" }] },
    "VALUE.CLEAR": { actions: [{ assign: "clearValue" }] },
  },
  states: {
    idle: {
      on: {
        "CONTENT.FOCUS": [
          {
            cond: "hasSelectedOrHighlighted",
            actions: [{ assign: "setFocused" }],
          },
          {
            actions: [{ assign: "setFocused" }, { assign: "setDefaultHighlightedValue" }],
          },
        ],
        "CONTENT.BLUR": { actions: [{ assign: "clearFocused" }] },
        "ITEM.CLICK": { actions: [{ assign: "setHighlightedItem" }, { assign: "selectHighlightedItem" }] },
        "CONTENT.TYPEAHEAD": { actions: [{ assign: "setFocused" }, { assign: "highlightMatchingItem" }] },
        "ITEM.POINTER_MOVE": { actions: [{ assign: "highlightItem" }] },
        "ITEM.POINTER_LEAVE": { actions: [{ assign: "clearHighlightedValue" }] },
        NAVIGATE: { actions: [{ assign: "setFocused" }, { assign: "setHighlightedItem" }, { assign: "selectWithKeyboard" }] },
      },
    },
  },
};

const indexOf = (order: readonly string[], value: string): number => order.indexOf(value);

const select = (
  ctx: ListboxContext,
  value: string,
  metaKey: boolean,
): string[] => {
  if (!ctx.order.includes(value)) return ctx.value;
  if (!ctx.multiple) return [value];
  if (metaKey) {
    return ctx.value.includes(value)
      ? ctx.value.filter((v) => v !== value)
      : [...ctx.value, value];
  }
  if (ctx.selectionBehavior === "clear") return [value];
  if (ctx.selectionBehavior === "preserve") {
    return ctx.value.includes(value) ? ctx.value : [...ctx.value, value];
  }
  return [value];
};

const extendSelection = (
  ctx: ListboxContext,
  anchorValue: string,
  value: string,
): string[] => {
  const anchor = indexOf(ctx.order, anchorValue);
  const end = indexOf(ctx.order, value);
  if (anchor < 0 || end < 0) return ctx.value;
  const [from, to] = anchor < end ? [anchor, end] : [end, anchor];
  return ctx.order.slice(from, to + 1);
};

const search = (ctx: ListboxContext, key: string): string | null => {
  const needle = key.toLowerCase();
  const start = ctx.highlightedValue === null ? 0 : indexOf(ctx.order, ctx.highlightedValue) + 1;
  const rotated = [...ctx.order.slice(start), ...ctx.order.slice(0, start)];
  for (const value of rotated) {
    const label = (ctx.labels[value] ?? value).toLowerCase();
    if (label.startsWith(needle)) return value;
  }
  return null;
};

const implementations = {
  conds: {
    hasSelectedOrHighlighted: (ctx: ListboxContext): boolean =>
      ctx.value.length > 0 || ctx.highlightedValue !== null,
  },
  assigns: {
    syncSelectedItems: (ctx: ListboxContext): Partial<ListboxContext> => ({
      value: ctx.value.filter((v) => ctx.order.includes(v)),
      highlightedValue:
        ctx.highlightedValue !== null && ctx.order.includes(ctx.highlightedValue)
          ? ctx.highlightedValue
          : null,
    }),
    setHighlightedValue: (ctx: ListboxContext, event: ListboxEvent): Partial<ListboxContext> => {
      if (event.type !== "HIGHLIGHTED_VALUE.SET") return {};
      // The highlight arrives the way the host wrote it: the command names
      // the value, the host write names the field.
      const raw = event.highlightedValue !== undefined
        ? event.highlightedValue
        : event.value;
      const value = typeof raw === "string" ? raw : null;
      if (value === null || !ctx.order.includes(value)) return {};
      return { highlightedValue: value };
    },
    clearHighlightedValue: (): Partial<ListboxContext> => ({ highlightedValue: null }),
    selectItem: (ctx: ListboxContext, event: ListboxEvent): Partial<ListboxContext> => {
      if (event.type !== "ITEM.SELECT") return {};
      return { value: select(ctx, event.value, false) };
    },
    clearItem: (ctx: ListboxContext, event: ListboxEvent): Partial<ListboxContext> => {
      if (event.type !== "ITEM.CLEAR") return {};
      return { value: ctx.value.filter((v) => v !== event.value) };
    },
    setValue: (ctx: ListboxContext, event: ListboxEvent): Partial<ListboxContext> => {
      if (event.type !== "VALUE.SET") return {};
      return { value: event.value.filter((v) => ctx.order.includes(v)) };
    },
    clearValue: (): Partial<ListboxContext> => ({ value: [] }),
    setFocused: (): Partial<ListboxContext> => ({ focused: true }),
    clearFocused: (): Partial<ListboxContext> => ({ focused: false }),
    setDefaultHighlightedValue: (ctx: ListboxContext): Partial<ListboxContext> => ({
      highlightedValue: ctx.order[0] ?? null,
    }),
    setHighlightedItem: (ctx: ListboxContext, event: ListboxEvent): Partial<ListboxContext> => {
      if (event.type !== "ITEM.CLICK" && event.type !== "NAVIGATE") return {};
      return ctx.order.includes(event.value) ? { highlightedValue: event.value } : {};
    },
    selectHighlightedItem: (ctx: ListboxContext, event: ListboxEvent): Partial<ListboxContext> => {
      if (event.type !== "ITEM.CLICK") return {};
      const value = event.value ?? ctx.highlightedValue;
      if (value === null || value === undefined || !ctx.order.includes(value)) return {};
      if (event.shiftKey === true && ctx.multiple && event.anchorValue !== undefined) {
        return { value: extendSelection(ctx, event.anchorValue, value) };
      }
      return { value: select(ctx, value, event.metaKey === true) };
    },
    selectWithKeyboard: (ctx: ListboxContext, event: ListboxEvent): Partial<ListboxContext> => {
      if (event.type !== "NAVIGATE") return {};
      if (!ctx.order.includes(event.value)) return {};
      if (event.shiftKey === true && ctx.multiple && event.anchorValue !== undefined) {
        return { value: extendSelection(ctx, event.anchorValue, event.value) };
      }
      if (ctx.selectOnHighlight) return { value: [event.value] };
      return {};
    },
    highlightItem: (ctx: ListboxContext, event: ListboxEvent): Partial<ListboxContext> => {
      if (event.type !== "ITEM.POINTER_MOVE") return {};
      return ctx.order.includes(event.value) ? { highlightedValue: event.value } : {};
    },
    highlightMatchingItem: (ctx: ListboxContext, event: ListboxEvent): Partial<ListboxContext> => {
      if (event.type !== "CONTENT.TYPEAHEAD") return {};
      const found = search(ctx, event.key);
      return found === null ? {} : { highlightedValue: found };
    },
  },
};

export const hasValue = (ctx: ListboxContext): boolean => ctx.value.length > 0;

/** The selected values as a comma-joined string for the hidden input. */
export const stringifyValues = (ctx: ListboxContext): string => ctx.value.join(",");

/** A type alias, so it carries the implicit index signature the machine's own reader expects. */
export type ListboxArgsItem = {
  readonly value: string;
  readonly label?: string | undefined;
  readonly disabled?: boolean | undefined;
  readonly group?: string | undefined;
};

/**
 * The listbox's arguments: the values the host may set. The names are the
 * element's prop names — the machine is instantiated with the element's
 * prop bag and picks what it wants.
 */
export interface ListboxArgs {
  items?: readonly ListboxArgsItem[];
  value?: string | readonly string[];
  highlightedValue?: string;
  multiple?: boolean;
  selectOnHighlight?: boolean;
  loopFocus?: boolean;
  selectionBehavior?: string;
  defaultHighlightedValue?: string;
}

interface ListboxRowData {
  value: string;
  label: string;
  disabled: boolean;
  group: string;
}

const rowsOf = (items: unknown): ListboxRowData[] => {
  const rows: ListboxRowData[] = [];
  for (const entry of Array.isArray(items) ? items : []) {
    if (typeof entry !== "object" || entry === null) continue;
    const record: Record<string, unknown> = entry;
    const value = record["value"];
    if (typeof value !== "string" || value.length === 0) continue;
    const label = typeof record["label"] === "string" && record["label"].length > 0
      ? record["label"]
      : value;
    rows.push({
      value,
      label,
      disabled: record["disabled"] === true,
      group: typeof record["group"] === "string" ? record["group"] : "",
    });
  }
  return rows;
};

const parseKeys = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === "string");
  if (typeof value !== "string") return [];
  const list = value.startsWith("[") && value.endsWith("]") ? value.slice(1, -1) : value;
  return list.split(",").map((part) => part.trim()).filter((part) => part.length > 0);
};

export function initial(args: ListboxArgs = {}, authored: (name: string) => boolean): ListboxContext {
  // A channel: the host's write, or the machine's own default. A host that
  // wrote `defaultHighlightedValue` wrote the channel too, and the
  // framework has already resolved the twin into the argument.
  const written = (field: string): boolean =>
    authored(field) ||
    authored(defaultTwin(field)) ||
    (args as Record<string, unknown>)[defaultTwin(field)] !== undefined;
  const rows = rowsOf(args.items);
  const order = rows.map((row) => row.value);
  const labels = Object.fromEntries(rows.map((row) => [row.value, row.label]));
  const multiple = args.multiple === true;
  const selection = args.selectionBehavior;
  const selectionBehavior: ListboxContext["selectionBehavior"] =
    selection === "preserve" || selection === "clear"
      ? selection
      : multiple
        ? "clear"
        : "replace";
  return {
    // The selection is the element's data: the framework has already
    // resolved the twin into it, so it is taken as it is.
    value: parseKeys(args.value),
    disabledValues: rows.filter((row) => row.disabled).map((row) => row.value),
    highlightedValue: written("highlightedValue") &&
        typeof args.highlightedValue === "string" &&
        args.highlightedValue.length > 0
      ? args.highlightedValue
      : null,
    focused: false,
    order,
    labels,
    multiple,
    selectOnHighlight: args.selectOnHighlight === true,
    loopFocus: args.loopFocus !== false,
    selectionBehavior,
  };
}

export function listbox(
  args: ListboxArgs = {},
  authored: (name: string) => boolean,
): Machine<ListboxContext, ListboxEvent> {
  return createMachine<ListboxContext, ListboxEvent>({
    ...config,
    context: initial(args, authored),
    assigns: implementations.assigns,
    conds: implementations.conds,
    /**
     * The machine's contract with its hosts: a field with an event is
     * REPORTED (the host's write becomes an event, the machine decides,
     * the change reaches the host); a field without one is SILENT (the
     * write lands in the field and nothing reports).
     */
    fields: {
      highlightedValue: { event: "HIGHLIGHTED_VALUE.SET" },
    },
  });
}
