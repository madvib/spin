import type { AssignFor, GuardFor } from "@spinjs/components/fsm";
import type { MotionStageEvents } from "./motion-stage.events.ts";
import type { MotionLane, MotionStageContext, MotionSpeed } from "./motion-stage.state.ts";
import { longestOf, withShares } from "./motion-stage.state.ts";

type MotionStageAssign<K extends keyof MotionStageEvents = keyof MotionStageEvents> =
  AssignFor<MotionStageContext, MotionStageEvents, K>;

type MotionStageGuard<K extends keyof MotionStageEvents = keyof MotionStageEvents> =
  GuardFor<MotionStageContext, MotionStageEvents, K>;

export const setLanes: MotionStageAssign<"LANES.SET"> = (_ctx, event) => {
  const lanes = (event as { lanes: readonly MotionLane[] }).lanes;
  if (!Array.isArray(lanes)) return {};
  const full = withShares(lanes);
  return { lanes: full, longestMs: longestOf(full) };
};

const SPEEDS: readonly MotionSpeed[] = [0.25, 0.5, 1, 2];

export const setSpeed: MotionStageAssign<"SPEED.SET"> = (_ctx, event) => {
  const speed = (event as { speed: unknown }).speed;
  if (typeof speed !== "number" || !(SPEEDS as readonly number[]).includes(speed)) {
    return {};
  }
  return { speed: speed as MotionSpeed };
};

export const toggleLoop: MotionStageAssign<"LOOP.TOGGLE"> = (ctx) => ({
  loop: !ctx.loop,
});

export const isLooping: MotionStageGuard<"CYCLE.END"> = (ctx) => ctx.loop === true;
