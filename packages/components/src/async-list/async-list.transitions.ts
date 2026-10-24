import type { AssignFor, GuardFor } from "@spinjs/runtime/fsm";
import type { AsyncListEvents } from "./async-list.events.ts";
import type { AsyncListContext } from "./async-list.state.ts";

type AsyncListAssign<K extends keyof AsyncListEvents = keyof AsyncListEvents> =
  AssignFor<
    AsyncListContext,
    AsyncListEvents,
    K
  >;

export const clearItems: AsyncListAssign = () => ({ items: [] });

export const setItems: AsyncListAssign<"SUCCESS"> = (ctx, event) => {
  const loaded = [...event.items];
  return { items: event.append ? [...ctx.items, ...loaded] : loaded };
};

export const setCursor: AsyncListAssign<"SUCCESS"> = (_ctx, event) => ({
  cursor: event.cursor ?? null,
});

export const setError: AsyncListAssign<"ERROR"> = (_ctx, event) => ({
  error: event.error,
});

export const clearError: AsyncListAssign = () => ({ error: undefined });

export const setFilterText: AsyncListAssign<"FILTER"> = (_ctx, event) => ({
  filterText: event.filterText,
});

export const setSortDescriptor: AsyncListAssign<"SORT"> = (_ctx, event) => ({
  sortDescriptor: event.sortDescriptor,
});

export const clearCursor: AsyncListAssign = () => ({ cursor: null });

export const hasSortFn: GuardFor<AsyncListContext, AsyncListEvents> = (
  ctx,
  _event,
) => ctx.hasSortFn;

export const hasCursor: GuardFor<AsyncListContext, AsyncListEvents> = (
  ctx,
  _event,
) => ctx.cursor != null;
