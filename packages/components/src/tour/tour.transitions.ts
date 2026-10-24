import type { AssignFor, GuardFor } from "@spin/runtime/fsm";
import type { TourEvents } from "./tour.events.ts";
import type { TourContext } from "./tour.state.ts";
import { bailStep, stepOf } from "./tour.state.ts";

type TourAssign<K extends keyof TourEvents = keyof TourEvents> = AssignFor<
  TourContext,
  TourEvents,
  K
>;

export const setSpotlight: TourAssign<"SPOTLIGHT.SET"> = (_ctx, event) => ({
  spotlight: { x: event.x, y: event.y, w: event.w, h: event.h },
});

export const setStep: TourAssign<"STEP.SET"> = (ctx, event) => ({
  previousStep: ctx.step,
  step: stepOf(event.step, ctx.steps.length),
});

export const startTour: TourAssign<"START"> = () => ({
  previousStep: -1,
  step: 0,
});

export const nextStep: TourAssign<"STEP.NEXT"> = (ctx) => ({
  previousStep: ctx.step,
  step: ctx.step + 1,
});

export const prevStep: TourAssign<"STEP.PREV"> = (ctx) => ({
  previousStep: ctx.step,
  step: ctx.step - 1,
});

export const bail = (ctx: TourContext): Partial<TourContext> => bailStep(ctx);

export const hasSteps: GuardFor<TourContext, TourEvents> = (ctx) =>
  ctx.steps.length > 0;

export const validStep: GuardFor<TourContext, TourEvents> = (ctx, event) =>
  event.type === "STEP.SET" && event.step >= 0 && event.step < ctx.steps.length;

export const hasNext: GuardFor<TourContext, TourEvents> = (ctx) =>
  ctx.step + 1 < ctx.steps.length;

export const hasPrev: GuardFor<TourContext, TourEvents> = (ctx) => ctx.step > 0;
