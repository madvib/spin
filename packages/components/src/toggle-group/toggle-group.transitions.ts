import type { AssignFor } from "@spinjs/components/fsm";
import { parseValues } from "./toggle-group.state.ts";
import type { ToggleGroupEvents } from "./toggle-group.events.ts";
import type { ToggleGroupContext } from "./toggle-group.state.ts";

type ToggleGroupAssign<
  K extends keyof ToggleGroupEvents = keyof ToggleGroupEvents,
> = AssignFor<
  ToggleGroupContext,
  ToggleGroupEvents,
  K
>;

export const clearClickFocus: () => Partial<ToggleGroupContext> = () => ({
  clickFocus: false,
});

export const setTabbingBackward: () => Partial<ToggleGroupContext> = () => ({
  tabbingBackward: true,
});

export const setFocusedId: ToggleGroupAssign<"TOGGLE.FOCUS"> = (
  _ctx,
  event,
) => ({
  focusedId: event.id,
});

export const setValue: ToggleGroupAssign<"VALUE.SET"> = (_ctx, event) => ({
  value: parseValues(event.value) ?? [],
});
