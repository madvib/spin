import type { AssignFor, GuardFor } from "@spin/runtime/fsm";
import type { StepsEvents } from "./steps.events.ts";
import type { StepsContext } from "./steps.state.ts";

type StepsAssign<K extends keyof StepsEvents = keyof StepsEvents> = AssignFor<
  StepsContext,
  StepsEvents,
  K
>;

export const setCount: StepsAssign<"SET_COUNT"> = (_ctx, event) => ({
  count: Math.max(1, Math.floor(event.count)),
});

export const canSetStep: GuardFor<StepsContext, StepsEvents> = (ctx, event) => {
  if (event.type !== "STEP.SET") return false;
  const current = ctx.step;
  if (event.value <= current) return true;
  if (ctx.isStepSkippable?.(current) === true) return true;
  const valid = ctx.isStepValid;
  return valid === undefined ? true : valid(current);
};

export const applySetStep: StepsAssign<"STEP.SET"> = (ctx, event) => {
  const clamped = Math.min(ctx.count, Math.max(0, event.value));
  return clamped === ctx.step ? {} : { step: clamped };
};

export const recordInvalidSet: StepsAssign<"STEP.SET"> = (ctx, event) => ({
  invalidAttempts: ctx.invalidAttempts + 1,
  lastInvalid: {
    action: "set",
    targetStep: event.value,
  },
});

export const canNextStep: GuardFor<StepsContext, StepsEvents> = (ctx, event) => {
  if (event.type !== "STEP.NEXT") return false;
  const current = ctx.step;
  if (ctx.isStepSkippable?.(current) === true) return true;
  const valid = ctx.isStepValid;
  return valid === undefined ? true : valid(current);
};

export const applyNextStep: StepsAssign<"STEP.NEXT"> = (ctx) => ({
  step: Math.min(ctx.step + 1, ctx.count),
});

export const recordInvalidNext: StepsAssign<"STEP.NEXT"> = (ctx) => ({
  invalidAttempts: ctx.invalidAttempts + 1,
  lastInvalid: {
    action: "next",
    targetStep: Math.min(ctx.step + 1, ctx.count),
  },
});

export const prevStep: StepsAssign<"STEP.PREV"> = (ctx) => ({
  step: Math.max(ctx.step - 1, 0),
});

export const resetStep: StepsAssign<"STEP.RESET"> = () => ({ step: 0 });
