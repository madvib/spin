import type { AssignFor } from "@spin/runtime/fsm";
import type { NavigationMenuEvents } from "./navigation-menu.events.ts";
import type { NavigationMenuContext } from "./navigation-menu.state.ts";
import { asText } from "./navigation-menu.state.ts";

type NavigationMenuAssign<K extends keyof NavigationMenuEvents = keyof NavigationMenuEvents> = AssignFor<
  NavigationMenuContext,
  NavigationMenuEvents,
  K
>;

export const toggleOpen: NavigationMenuAssign<"ITEM.TOGGLE"> = (ctx, event) =>
  event.value === ctx.value
    ? { previousValue: ctx.value, value: "" }
    : { previousValue: ctx.value, value: event.value };

export const closeAll: NavigationMenuAssign<"CLOSE"> = (ctx, _event) => ({
  previousValue: ctx.value,
  value: "",
});

export const setValue: NavigationMenuAssign<"VALUE.SET"> = (ctx, event) => {
  const value = asText(event.value);
  if (value === null || value === ctx.value) return {};
  return { previousValue: ctx.value, value };
};

export const openItem: NavigationMenuAssign<"ITEM.ENTER"> = (ctx, event) => ({
  previousValue: ctx.value,
  value: event.value,
});

export const swapItem: NavigationMenuAssign<"ITEM.ENTER"> = (ctx, event) =>
  event.value === ctx.value ? {} : { previousValue: ctx.value, value: event.value };