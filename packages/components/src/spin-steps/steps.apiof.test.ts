import { assertEquals } from "@std/assert";
import type { StepsApi } from "./steps.presentation.ts";
import type { StepsItemState } from "./steps.state.ts";

Deno.test("StepsApi promises the component's surface", () => {
  const keys: (keyof StepsApi)[] = [
    "state",
    "value",
    "count",
    "percent",
    "hasNextStep",
    "hasPrevStep",
    "completed",
    "goToNextStep",
    "goToPrevStep",
    "resetStep",
    "setStep",
    "getItems",
    "getItemTitle",
    "getItemState",
    "getRootProps",
    "getListProps",
    "getItemProps",
    "getTriggerProps",
    "getContentProps",
    "getIndicatorProps",
    "getSeparatorProps",
    "getNextTriggerProps",
    "getPrevTriggerProps",
    "getProgressProps",
    "getProgressFillProps",
  ];
  assertEquals(keys.length, 25);
  type AssertExact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
  const stateTyped: AssertExact<StepsApi["state"], "idle"> = true;
  const setStepTyped: AssertExact<StepsApi["setStep"], (value: number) => void> = true;
  const getItemStateTyped: AssertExact<StepsApi["getItemState"], (index: number) => StepsItemState> = true;
  const getTriggerPropsTyped: AssertExact<StepsApi["getTriggerProps"], (slot: number) => Record<string, unknown>> = true;
  assertEquals([stateTyped, setStepTyped, getItemStateTyped, getTriggerPropsTyped].every(Boolean), true);
});
