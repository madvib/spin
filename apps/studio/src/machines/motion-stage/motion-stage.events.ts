import type { EventUnion } from "@spinjs/runtime/fsm";
import type { MotionLane, MotionSpeed } from "./motion-stage.state.ts";

export interface MotionStageEvents {
  "PLAY": {};
  "PAUSE": {};
  "STOP": {};
  "STEP.RESET": {};
  "STEP.RUN": {};
  "CYCLE.END": {};
  "LOOP.TOGGLE": {};
  "SPEED.SET": { readonly speed: MotionSpeed };
  "LANES.SET": { readonly lanes: readonly MotionLane[] };
}

export type MotionStageEvent = EventUnion<MotionStageEvents>;
