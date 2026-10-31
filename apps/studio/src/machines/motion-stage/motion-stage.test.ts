import { test } from "bun:test";
import { deepStrictEqual } from "node:assert/strict";
import { motionStage } from "./motion-stage.machine.ts";
import { longestOf, withShares } from "./motion-stage.state.ts";

const LANES = withShares([
  {
    id: "a",
    path: "motion.duration.base",
    utility: "duration-base",
    value: "250ms",
    durationMs: 250,
    variable: "--motion-duration-base",
    durationVar: "--motion-duration-base",
    easingVar: "--motion-easing-standard",
  },
  {
    id: "b",
    path: "motion.duration.fast",
    utility: "duration-fast",
    value: "150ms",
    durationMs: 150,
    variable: "--motion-duration-fast",
    durationVar: "--motion-duration-fast",
    easingVar: "--motion-easing-standard",
  },
]);

test("lanes carry shares of the longest duration", () => {
  deepStrictEqual(longestOf(LANES), 250);
  deepStrictEqual(LANES[0]?.sharePct, 100);
  deepStrictEqual(LANES[1]?.sharePct, 60);
});

test("a single run cycles idle → reset → running → idle", () => {
  const machine = motionStage({ lanes: LANES, longestMs: longestOf(LANES) });
  let state = machine.initialState;
  deepStrictEqual(state.value, "idle");
  state = machine.transition(state, { type: "PLAY" });
  deepStrictEqual(state.value, "reset");
  state = machine.transition(state, { type: "STEP.RUN" });
  deepStrictEqual(state.value, "running");
  state = machine.transition(state, { type: "CYCLE.END" });
  deepStrictEqual(state.value, "idle");
});

test("looping returns to reset at the cycle end", () => {
  const machine = motionStage({ lanes: LANES, longestMs: longestOf(LANES), loop: true });
  let state = machine.initialState;
  state = machine.transition(state, { type: "PLAY" });
  state = machine.transition(state, { type: "STEP.RUN" });
  state = machine.transition(state, { type: "CYCLE.END" });
  deepStrictEqual(state.value, "reset");
});

test("LOOP.TOGGLE flips the loop from any idle", () => {
  const machine = motionStage({ lanes: LANES, longestMs: longestOf(LANES) });
  let state = machine.initialState;
  state = machine.transition(state, { type: "LOOP.TOGGLE" });
  deepStrictEqual(state.value, "reset");
  deepStrictEqual(state.context.loop, true);
});

test("SPEED.SET clamps to the offered speeds", () => {
  const machine = motionStage({ lanes: LANES, longestMs: longestOf(LANES) });
  let state = machine.initialState;
  state = machine.transition(state, { type: "SPEED.SET", speed: 0.5 });
  deepStrictEqual(state.context.speed, 0.5);
});

test("pause and stop interrupt a run", () => {
  const machine = motionStage({ lanes: LANES, longestMs: longestOf(LANES) });
  let state = machine.initialState;
  state = machine.transition(state, { type: "PLAY" });
  state = machine.transition(state, { type: "STEP.RUN" });
  state = machine.transition(state, { type: "PAUSE" });
  deepStrictEqual(state.value, "paused");
  state = machine.transition(state, { type: "PLAY" });
  deepStrictEqual(state.value, "running");
  state = machine.transition(state, { type: "STOP" });
  deepStrictEqual(state.value, "idle");
});
