import type { EventUnion } from "@spinjs/components/fsm";
import type { ModeChoice, ResolvedMode } from "./mode-picker.state.ts";

export interface ModePickerEvents {
  "CYCLE": {};
  "VALUE.SET": { readonly value: ModeChoice };
  "MODES.SET": { readonly modes: readonly string[] | string };
  "SYSTEM.SET": { readonly systemMode: ResolvedMode };
}

export type ModePickerEvent = EventUnion<ModePickerEvents>;

export type ModePickerValueChange = {
  readonly value: ModeChoice;
  readonly resolvedMode: ResolvedMode;
};
