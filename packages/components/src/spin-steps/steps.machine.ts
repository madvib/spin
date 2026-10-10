/**
 * Steps machine: one index and the four moves that change it.
 *
 * Zag's chart is a single `idle` state with every event on it, so the fork's
 * root tier is the whole config and `idle` exists only because the fork
 * requires a states map. Nothing transitions: a step change is a context
 * write, exactly as Zag's own chart has it.
 *
 * `STEP.SYNC` is the one event beyond Zag's four. A host-authored `step` is
 * Zag's bindable read, which returns the prop verbatim and is therefore
 * never guarded, while Zag's `STEP.SET` (the api command and the trigger
 * click) is guarded. One event cannot be both, so the host write gets its
 * own unguarded command.
 *
 * `count`, `isStepValid` and `isStepSkippable` are context because the
 * guards read them. The two predicates are behavioral host functions, like
 * tags-input's `validate`.
 */

export type StepValidity = (index: number) => boolean;

export interface StepsContext {
  /** The current step index, zero-based. */
  step: number;
  /** The total number of steps. */
  count: number;
  /** Set when a guarded move was refused; the bridge reports and clears it. */
  refusal: "set" | "next" | null;
  /** Host predicate: a step the user may leave. Absent means every step is. */
  isStepValid: StepValidity;
  /** Host predicate: a step forward navigation may bypass. */
  isStepSkippable: StepValidity;
}

export type StepsEvent =
  | { type: "STEP.SET"; value: number }
  | { type: "STEP.NEXT" }
  | { type: "STEP.PREV" }
  | { type: "STEP.RESET" }
  | { type: "STEP.SYNC"; value: number };

const alwaysValid: StepValidity = (): boolean => true;
const neverSkippable: StepValidity = (): boolean => false;

export const config = {
  id: "steps",
  initial: "idle",
  context: {
    step: 0,
    count: 1,
    refusal: null as "set" | "next" | null,
    isStepValid: alwaysValid,
    isStepSkippable: neverSkippable,
  },
  // Root tier: every event is valid in the only state there is.
  on: {
    // A jump backward is always allowed; a jump forward asks whether the
    // step being LEFT is valid. A refused move records the refusal — the
    // bridge turns it into Zag's onStepInvalid.
    "STEP.SET": [
      { cond: "isValidStepNavigation", actions: [{ assign: "setStep" }] },
      { actions: [{ assign: "refuseStep" }] },
    ],
    "STEP.NEXT": [
      { cond: "isCurrentStepValid", actions: [{ assign: "goToNextStep" }] },
      { actions: [{ assign: "refuseStep" }] },
    ],
    "STEP.PREV": { actions: [{ assign: "goToPrevStep" }] },
    "STEP.RESET": { actions: [{ assign: "resetStep" }] },
    // The host's write: never guarded, never clamped.
    "STEP.SYNC": { actions: [{ assign: "syncStep" }] },
  },
  states: { idle: {} },
};

export const implementations = {
  conds: {
    /** Zag's isValidStepNavigation. */
    isValidStepNavigation: (ctx: StepsContext, e: StepsEvent): boolean => {
      if (e.type !== "STEP.SET") return false;
      if (e.value <= ctx.step) return true;
      if (ctx.isStepSkippable(ctx.step)) return true;
      return ctx.isStepValid(ctx.step);
    },
    /** Zag's isCurrentStepValid: the same question asked by STEP.NEXT. */
    isCurrentStepValid: (ctx: StepsContext): boolean => {
      if (ctx.isStepSkippable(ctx.step)) return true;
      return ctx.isStepValid(ctx.step);
    },
  },
  assigns: {
    // Zag's setStep: verbatim. The guard is the only protection, so a host
    // command may still land an index past `count`.
    setStep: (_ctx: StepsContext, e: StepsEvent): Partial<StepsContext> =>
      e.type === "STEP.SET" ? { step: e.value } : {},
    goToNextStep: (ctx: StepsContext): Partial<StepsContext> => ({
      step: Math.min(ctx.step + 1, ctx.count),
    }),
    goToPrevStep: (ctx: StepsContext): Partial<StepsContext> => ({
      step: Math.max(ctx.step - 1, 0),
    }),
    resetStep: (): Partial<StepsContext> => ({ step: 0 }),
    syncStep: (_ctx: StepsContext, e: StepsEvent): Partial<StepsContext> =>
      e.type === "STEP.SYNC" ? { step: e.value } : {},
    // Only STEP.SET and STEP.NEXT carry a refusal branch.
    refuseStep: (_ctx: StepsContext, e: StepsEvent): Partial<StepsContext> =>
      e.type === "STEP.NEXT" ? { refusal: "next" } : { refusal: "set" },
  },
};

/** Zag's validateStepIndex: an out-of-range seed is a host bug, not a state. */
export function validateStepIndex(count: number, step: number): void {
  if (step < 0 || step > count) {
    throw new RangeError(`[spin/steps] step index ${step} is out of bounds`);
  }
}
