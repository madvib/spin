import { assertEquals } from "@std/assert";
import type { TourApi } from "./tour.presentation.ts";

Deno.test("TourApi promises the component's surface", () => {
  const keys: (keyof TourApi)[] = [
    "step",
    "steps",
    "running",
    "active",
    "state",
    "start",
    "next",
    "prev",
    "dismiss",
    "skip",
    "setStep",
    "notifyTargetResolved",
    "notifyTargetNotFound",
    "notifyScrollEnd",
    "getRootProps",
    "getSpotlightProps",
    "getContentProps",
    "getTitleProps",
    "getDescriptionProps",
    "getPositionerProps",
    "getProgressTextProps",
    "getTextRows",
    "getPrevTriggerProps",
    "getNextTriggerProps",
    "getDismissTriggerProps",
    "getSkipTriggerProps",
    "getBackdropProps",
  ];
  assertEquals(keys.length, 27);
  type AssertExact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false)
    : false;
  const stateTyped: AssertExact<
    TourApi["state"],
    "inactive" | "resolving" | "scrolling" | "active"
  > = true;
  const setStepTyped: AssertExact<TourApi["setStep"], (step: number) => void> =
    true;
  const startTyped: AssertExact<TourApi["start"], () => void> = true;
  assertEquals(
    [stateTyped, setStepTyped, startTyped].every(Boolean),
    true,
  );
});
