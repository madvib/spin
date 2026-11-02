import type { AssignFor } from "@spinjs/runtime/fsm";
import type { TocEvents } from "./toc.events.ts";
import {
  clampActiveIds,
  parseItems,
  type TocContext,
} from "./toc.state.ts";

type TocAssign<K extends keyof TocEvents = keyof TocEvents> = AssignFor<
  TocContext,
  TocEvents,
  K
>;

function sameIds(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

export const setItems: TocAssign<"ITEMS.SET"> = (ctx, event) => {
  const items = parseItems(event.items);
  const valid = ctx.activeIds.filter((id) =>
    items.some((item) => item.value === id)
  );
  const nextActive =
    valid.length > 0
      ? clampActiveIds(valid, ctx.multiple)
      : items[0] !== undefined
      ? [items[0].value]
      : [];
  return {
    items,
    activeIds: nextActive,
  };
};

export const setActiveIds: TocAssign<"ACTIVE.SET"> = (ctx, event) => {
  const next = clampActiveIds(event.activeIds, ctx.multiple);
  return sameIds(ctx.activeIds, next) ? {} : { activeIds: next };
};

export const selectItem: TocAssign<"ITEM.SELECT"> = (ctx, event) => {
  if (event.value.length === 0) return {};
  const next = [event.value];
  return sameIds(ctx.activeIds, next) ? {} : { activeIds: next };
};
