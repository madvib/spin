import { createMachine, type Machine } from "@spinjs/components/fsm";
import type { TimerArgs, TimerContext, TimerState } from "./timer.state.ts";
import { initial } from "./timer.state.ts";
import type { TimerEvents } from "./timer.events.ts";
import {
  isComplete,
  resetTime,
  restartChanged,
  setCurrentMs,
  tick,
} from "./timer.transitions.ts";

export function timer(
  args: TimerArgs = {},
  authored: (name: string) => boolean = () => false,
): Machine<TimerContext, TimerEvents, TimerState> {
  return createMachine<TimerContext, TimerEvents, TimerState>({
    id: "timer",
    initial: "idle",
    context: initial(args, authored),
    fields: {
      startMs: { event: "RESTART" },
      currentMs: { event: "CURRENT_MS.SET" },
      targetMs: {},
      countdown: {},
      interval: {},
    },
    on: {
      RESTART: { target: "running", cond: restartChanged, assign: resetTime },
      "CURRENT_MS.SET": { assign: setCurrentMs },
    },
    states: {
      idle: {
        on: {
          START: { target: "running" },
          RESET: { assign: resetTime },
        },
      },
      running: {
        on: {
          PAUSE: { target: "paused" },
          RESET: { assign: resetTime },
          TICK: [
            { target: "idle", cond: isComplete },
            { assign: tick },
          ],
        },
      },
      paused: {
        on: {
          RESUME: { target: "running" },
          RESET: { target: "idle", assign: resetTime },
        },
      },
    },
  });
}
