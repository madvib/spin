import type { AssignFor } from "@spin/runtime/fsm";
import type { TabsEvents } from "./tabs.events.ts";
import type { TabsContext } from "./tabs.state.ts";

type TabsAssign<K extends keyof TabsEvents = keyof TabsEvents> = AssignFor<
  TabsContext,
  TabsEvents,
  K
>;

export const setValue: TabsAssign<"VALUE.SET"> = (_ctx, event) => ({
  value: event.value,
});

export const selectTab: TabsAssign<"TAB.SELECT"> = (ctx, event) =>
  event.value.length === 0 || event.value === ctx.value ? {} : { value: event.value };
