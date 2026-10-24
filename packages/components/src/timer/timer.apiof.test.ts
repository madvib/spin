import { test } from "bun:test";
import { deepStrictEqual } from "node:assert/strict";
import type { TimerApi } from "./timer.presentation.ts";

test("TimerApi promises the component's surface", () => {
  const keys: (keyof TimerApi)[] = [
    "state",
    "running",
    "paused",
    "time",
    "formattedTime",
    "progressPercent",
    "getUnits",
    "start",
    "pause",
    "resume",
    "reset",
    "restart",
    "getRootProps",
    "getAreaProps",
    "getProgressProps",
    "getControlProps",
    "getItemProps",
    "getItemValueProps",
    "getItemLabelProps",
    "getSeparatorProps",
    "getActionTriggerProps",
    "getItemIndexes",
    "getItemValueIndexes",
    "getItemLabelIndexes",
    "getSeparatorIndexes",
    "getActionTriggerIndexes",
  ];
  deepStrictEqual(keys.length, 26);
  type AssertExact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false)
    : false;
  const stateTyped: AssertExact<
    TimerApi["state"],
    "idle" | "running" | "paused"
  > = true;
  const startTyped: AssertExact<TimerApi["start"], () => void> = true;
  const pauseTyped: AssertExact<TimerApi["pause"], () => void> = true;
  const resumeTyped: AssertExact<TimerApi["resume"], () => void> = true;
  const resetTyped: AssertExact<TimerApi["reset"], () => void> = true;
  const restartTyped: AssertExact<TimerApi["restart"], () => void> = true;
  deepStrictEqual(
    [stateTyped, startTyped, pauseTyped, resumeTyped, resetTyped, restartTyped]
      .every(Boolean),
    true,
  );
});
