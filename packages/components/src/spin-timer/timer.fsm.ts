import type { MachineDef } from "@spin/runtime";
import { createTimerFsmBridge } from "./timer.bridge.ts";
import type { TimerTickChange } from "./timer.bridge.ts";

/**
 * The timer's seam: the bridge, the element's imperative commands and the
 * CustomEvents the host reads.
 *
 * `machine`/`connect` are inert placeholders — the def's `createBridge` routes
 * straight to the fork, which is what makes this interpreter a drop-in behind
 * the `<name>.machine-def.ts` contract the plugin consumes.
 *
 * Events are faithful to Zag's callbacks: `tick` carries `onTick` with the
 * new count and its parts, `complete` carries `onComplete` once the run
 * reaches its target.
 */

export type { TimerTickChange };

export const timer: MachineDef = {
  machine: {},
  connect: (() => {
    throw new Error("timer fsm runs through createTimerFsmBridge");
  }) as never,
  createBridge: createTimerFsmBridge,
  commands: ["start", "pause", "resume", "reset", "restart"],
  events: {
    tick: {
      on: "onTick",
      detail: (change: TimerTickChange) => ({
        value: change.value,
        time: change.time,
        formattedTime: change.formattedTime,
      }),
    },
    complete: {
      on: "onComplete",
      detail: () => ({}),
    },
  },
};
