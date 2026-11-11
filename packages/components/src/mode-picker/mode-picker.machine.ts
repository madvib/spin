/** Mode-picker machine: a single idle state cycling light → dark → system. */

import { createMachine, type Machine } from "@spinjs/components/fsm";
import type {
  ModePickerArgs,
  ModePickerContext,
  ModePickerState,
} from "./mode-picker.state.ts";
import { initial } from "./mode-picker.state.ts";
import type { ModePickerEvents } from "./mode-picker.events.ts";
import { canCycle, cycle, setModes, setSystem, setValue } from "./mode-picker.transitions.ts";

export function modePicker(
  args: ModePickerArgs = {},
  authored: (name: string) => boolean = () => false,
): Machine<ModePickerContext, ModePickerEvents, ModePickerState> {
  return createMachine<ModePickerContext, ModePickerEvents, ModePickerState>(
    {
      id: "mode-picker",
      initial: "idle",
      context: initial(args, authored),
      fields: {
        value: { event: "VALUE.SET" },
        modes: { event: "MODES.SET" },
        systemMode: { event: "SYSTEM.SET" },
      },
      states: {
        idle: {
          on: {
            CYCLE: { cond: canCycle, assign: cycle },
            "VALUE.SET": { assign: setValue },
            "MODES.SET": { assign: setModes },
            "SYSTEM.SET": { assign: setSystem },
          },
        },
      },
    },
  );
}
