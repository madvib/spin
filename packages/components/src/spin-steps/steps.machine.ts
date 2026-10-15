/**
 * Steps machine: one idle state with guarded transitions, over Zag's
 * single-state machine.
 *
 * The gating is the whole component: forward motion validates the current
 * step (skippable steps bypass), backward motion is always legal, reset
 * returns to zero. The validators are host callbacks the guards read on
 * demand — the machine holds no validation logic of its own, only the
 * step index and the count it is clamped against.
 *
 * Context stays serializable for the scope channel: two numbers. There is
 * one state because there is one mode; the events are all legal, always,
 * subject to the guards.
 */

export interface StepsContext {
  step: number;
  count: number;
  /** Refused navigation attempts: the bridge notifies invalid when this
   * moves. A counter, not a flag, so two refusals in a row both report. */
  invalidAttempts: number;
  /** The last refused navigation: (action, targetStep). */
  lastInvalid: { readonly action: "next" | "set"; readonly targetStep: number } | null;
}

export type StepsEvent =
  | { type: "STEP.SET"; value: number }
  | { type: "STEP.NEXT" }
  | { type: "STEP.PREV" }
  | { type: "STEP.RESET" }
  | { type: "SET_COUNT"; count: number };

export type StepsStepChange = {
  readonly step: number;
};

export type StepsInvalid = {
  readonly step: number;
  readonly action: "next" | "set";
  readonly targetStep: number;
};

export function hasNextStep(ctx: StepsContext): boolean {
  return ctx.step < ctx.count;
}

export function hasPrevStep(ctx: StepsContext): boolean {
  return ctx.step > 0;
}

export function isCompleted(ctx: StepsContext): boolean {
  return ctx.step === ctx.count;
}

export function percent(ctx: StepsContext): number {
  return ctx.count <= 0 ? 0 : (ctx.step / ctx.count) * 100;
}

export interface StepsItemState {
  readonly current: boolean;
  readonly completed: boolean;
  readonly incomplete: boolean;
  readonly first: boolean;
  readonly last: boolean;
}

/** Zag's getItemState, pure: position relative to the current step. */
export function itemState(ctx: StepsContext, index: number): StepsItemState {
  return {
    current: index === ctx.step,
    completed: index < ctx.step,
    incomplete: index > ctx.step,
    first: index === 0,
    last: index === ctx.count - 1,
  };
}

export const config = {
  id: "steps",
  initial: "idle",
  context: {
    step: 0,
    count: 1,
    invalidAttempts: 0,
    lastInvalid: null,
  },
  on: {
    SET_COUNT: { actions: [{ assign: "setCount" }] },
  },
  states: {
    idle: {
      on: {
        "STEP.SET": [
          { cond: "canNavigate", actions: [{ assign: "setStep" }] },
          { actions: [{ assign: "reportInvalidSet" }] },
        ],
        "STEP.NEXT": [
          { cond: "canAdvance", actions: [{ assign: "goToNext" }] },
          { actions: [{ assign: "reportInvalidNext" }] },
        ],
        "STEP.PREV": { actions: [{ assign: "goToPrev" }] },
        "STEP.RESET": { actions: [{ assign: "resetStep" }] },
      },
    },
  },
};

export const implementations = {
  conds: {
    // Backward motion is always legal; forward motion validates the
    // current step unless it is skippable. The validators ride the event:
    // functions cannot cross the scope channel, so the bridge attaches
    // them to each navigation event it sends.
    canNavigate: (_ctx: StepsContext, event: StepsEvent & Record<string, unknown>): boolean => {
      if (event.type !== "STEP.SET") return false;
      const current = _ctx.step;
      if ((event["value"] as number) <= current) return true;
      if ((event["skippable"] as ((index: number) => boolean) | undefined)?.(current) === true) {
        return true;
      }
      const valid = event["valid"] as ((index: number) => boolean) | undefined;
      return valid === undefined ? true : valid(current);
    },
    canAdvance: (_ctx: StepsContext, event: StepsEvent & Record<string, unknown>): boolean => {
      if (event.type !== "STEP.NEXT") return false;
      const current = _ctx.step;
      if ((event["skippable"] as ((index: number) => boolean) | undefined)?.(current) === true) {
        return true;
      }
      const valid = event["valid"] as ((index: number) => boolean) | undefined;
      return valid === undefined ? true : valid(current);
    },
  },
  assigns: {
    setStep: (ctx: StepsContext, event: StepsEvent): Partial<StepsContext> => {
      if (event.type !== "STEP.SET") return {};
      const clamped = Math.min(ctx.count, Math.max(0, event.value));
      return clamped === ctx.step ? {} : { step: clamped };
    },
    goToNext: (ctx: StepsContext): Partial<StepsContext> => ({
      step: Math.min(ctx.step + 1, ctx.count),
    }),
    goToPrev: (ctx: StepsContext): Partial<StepsContext> => ({
      step: Math.max(ctx.step - 1, 0),
    }),
    resetStep: (): Partial<StepsContext> => ({ step: 0 }),
    setCount: (ctx: StepsContext, event: StepsEvent): Partial<StepsContext> => {
      if (event.type !== "SET_COUNT") return {};
      void ctx;
      const count = Math.max(1, Math.floor(event.count));
      return { count };
    },
    // Invalid attempts report through the invalid channel: the bridge
    // reads the pending report after the send and notifies once.
    reportInvalidNext: (ctx: StepsContext, event: StepsEvent): Partial<StepsContext> => ({
      invalidAttempts: ctx.invalidAttempts + 1,
      lastInvalid: {
        action: "next",
        targetStep: event.type === "STEP.NEXT" ? Math.min(ctx.step + 1, ctx.count) : ctx.step,
      },
    }),
    reportInvalidSet: (ctx: StepsContext, event: StepsEvent): Partial<StepsContext> => ({
      invalidAttempts: ctx.invalidAttempts + 1,
      lastInvalid: {
        action: "set",
        targetStep: event.type === "STEP.SET" ? event.value : ctx.step,
      },
    }),
  },
};
