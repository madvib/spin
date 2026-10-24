import type { AssignFor } from "@spin/runtime/fsm";
import type { ListboxEvents } from "./listbox.events.ts";
import type { ListboxContext } from "./listbox.state.ts";
import { parseKeys, rowsOf as rowsOfState } from "./listbox.state.ts";

type ListboxAssign<K extends keyof ListboxEvents = keyof ListboxEvents> =
  AssignFor<
    ListboxContext,
    ListboxEvents,
    K
  >;

const orderOf = (ctx: ListboxContext): string[] =>
  rowsOfState(ctx.items).map((row) => row.value);

const select = (
  ctx: ListboxContext,
  value: string,
  metaKey: boolean,
): string[] => {
  if (!orderOf(ctx).includes(value)) return ctx.value;
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
  const indexOf = (v: string) => orderOf(ctx).indexOf(v);
  const anchor = indexOf(anchorValue);
  const end = indexOf(value);
  if (anchor < 0 || end < 0) return ctx.value;
  const [from, to] = anchor < end ? [anchor, end] : [end, anchor];
  return orderOf(ctx).slice(from, to + 1);
};

const search = (ctx: ListboxContext, key: string): string | null => {
  const order = orderOf(ctx);
  const labels = Object.fromEntries(
    rowsOfState(ctx.items).map((row) => [row.value, row.label]),
  );
  const needle = key.toLowerCase();
  const start = ctx.highlightedValue === null
    ? 0
    : order.indexOf(ctx.highlightedValue) + 1;
  const rotated = [...order.slice(start), ...order.slice(0, start)];
  for (const value of rotated) {
    const label = (labels[value] ?? value).toLowerCase();
    if (label.startsWith(needle)) return value;
  }
  return null;
};

export const setFocused = (): Partial<ListboxContext> => ({ focused: true });

export const clearHighlightedValue = (): Partial<ListboxContext> => ({
  highlightedValue: null,
});

export const setHighlightedItem = (
  ctx: ListboxContext,
  event: ListboxEvents["ITEM.CLICK"] | ListboxEvents["NAVIGATE"],
): Partial<ListboxContext> => {
  const value = (event as { value?: string }).value;
  if (typeof value !== "string") return {};
  return orderOf(ctx).includes(value) ? { highlightedValue: value } : {};
};

export const syncSelectedItems: ListboxAssign<"SELECTED_ITEMS.SYNC"> = (
  ctx,
) => ({
  value: ctx.value.filter((v) => orderOf(ctx).includes(v)),
  highlightedValue:
    ctx.highlightedValue !== null && orderOf(ctx).includes(ctx.highlightedValue)
      ? ctx.highlightedValue
      : null,
});

export const setHighlightedValue: ListboxAssign<"HIGHLIGHTED_VALUE.SET"> = (
  ctx,
  event,
) => {
  const raw = event.highlightedValue !== undefined
    ? event.highlightedValue
    : event.value;
  const value = typeof raw === "string" ? raw : null;
  if (value === null || !orderOf(ctx).includes(value)) return {};
  return { highlightedValue: value };
};

export const selectItem: ListboxAssign<"ITEM.SELECT"> = (ctx, event) => ({
  value: select(ctx, event.value, false),
});

export const clearItem: ListboxAssign<"ITEM.CLEAR"> = (ctx, event) => ({
  value: ctx.value.filter((v) => v !== event.value),
});

export const setValue: ListboxAssign<"VALUE.SET"> = (ctx, event) => ({
  value: parseKeys(event.value).filter((v) => orderOf(ctx).includes(v)),
});

export const clearValue: ListboxAssign<"VALUE.CLEAR"> = () => ({ value: [] });

export const itemClickInner: ListboxAssign<"ITEM.CLICK"> = (ctx, event) => {
  const value = event.value ?? ctx.highlightedValue;
  if (value === null || value === undefined || !orderOf(ctx).includes(value)) {
    return {};
  }
  if (
    event.shiftKey === true && ctx.multiple && event.anchorValue !== undefined
  ) {
    return { value: extendSelection(ctx, event.anchorValue, value) };
  }
  return { value: select(ctx, value, event.metaKey === true) };
};

export const contentFocusAssigns = (
  ctx: ListboxContext,
): Partial<ListboxContext>[] => {
  if (ctx.value.length > 0 || ctx.highlightedValue !== null) {
    return [setFocused()];
  }
  return [setFocused(), { highlightedValue: orderOf(ctx)[0] ?? null }];
};

export const typeaheadInner: ListboxAssign<"CONTENT.TYPEAHEAD"> = (
  ctx,
  event,
) => {
  const found = search(ctx, event.key);
  return found === null ? {} : { highlightedValue: found };
};

export const pointerMove: ListboxAssign<"ITEM.POINTER_MOVE"> = (ctx, event) =>
  orderOf(ctx).includes(event.value) ? { highlightedValue: event.value } : {};

export const navigateInner: ListboxAssign<"NAVIGATE"> = (ctx, event) => {
  if (!orderOf(ctx).includes(event.value)) return {};
  if (
    event.shiftKey === true && ctx.multiple && event.anchorValue !== undefined
  ) {
    return { value: extendSelection(ctx, event.anchorValue, event.value) };
  }
  if (ctx.selectOnHighlight) return { value: [event.value] };
  return {};
};
