import type { EventUnion } from "@spinjs/runtime/fsm";

export interface TimerEvents {
  "START": {};
  "PAUSE": {};
  "RESUME": {};
  "RESET": {};
  "RESTART": { startMs?: string | number };
  "TICK": { deltaMs: number };
  "CURRENT_MS.SET": { currentMs: string | number };
}

export type TimerEvent = EventUnion<TimerEvents>;
