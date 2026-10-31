/** Motion-stage machine: idle/reset/running/paused for specimen races. */

import { createMachine, type Machine } from "@spinjs/runtime/fsm";
import type { MotionStageContext, MotionStageState } from "./motion-stage.state.ts";
import { initial } from "./motion-stage.state.ts";
import type { MotionStageEvents } from "./motion-stage.events.ts";
import {
  isLooping,
  setLanes,
  setSpeed,
  toggleLoop,
} from "./motion-stage.transitions.ts";

export function motionStage(
  args: Partial<MotionStageContext> = {},
  authored: (name: string) => boolean = () => false,
): Machine<MotionStageContext, MotionStageEvents, MotionStageState> {
  void authored;
  const context = { ...initial(), ...args };
  return createMachine<MotionStageContext, MotionStageEvents, MotionStageState>(
    {
      id: "motion-stage",
      initial: "idle",
      context,
      fields: {
        lanes: { event: "LANES.SET" },
        speed: { event: "SPEED.SET" },
        loop: {},
      },
      states: {
        idle: {
          on: {
            PLAY: { target: "reset" },
            "LOOP.TOGGLE": { target: "reset", assign: toggleLoop },
            "LANES.SET": { assign: setLanes },
            "SPEED.SET": { assign: setSpeed },
          },
        },
        reset: {
          on: {
            "STEP.RUN": { target: "running" },
            STOP: { target: "idle" },
            "LANES.SET": { assign: setLanes },
            "SPEED.SET": { assign: setSpeed },
          },
        },
        running: {
          on: {
            PAUSE: { target: "paused" },
            STOP: { target: "idle" },
            "CYCLE.END": [
              { cond: isLooping, target: "reset" },
              { target: "idle" },
            ],
            "LANES.SET": { assign: setLanes },
            "SPEED.SET": { assign: setSpeed },
          },
        },
        paused: {
          on: {
            PLAY: { target: "running" },
            STOP: { target: "idle" },
            "LANES.SET": { assign: setLanes },
            "SPEED.SET": { assign: setSpeed },
          },
        },
      },
    },
  );
}
