/** Steps machine: one idle state with guarded transitions. */

import { defaultTwin } from "@spin/runtime";
import { createMachine, type Machine } from "@spin/runtime/fsm";

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
  action: "next" | "set";
  targetStep: number;
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

export function itemState(ctx: StepsContext, index: number): StepsItemState {
  return {
    current: index === ctx.step,
    completed: index < ctx.step,
    incomplete: index > ctx.step,
    first: index === 0,
    last: index === ctx.count - 1,
  };
}

/** A numeric prop: numbers pass, numeric strings parse, everything else is
 * absent. */
const asCount = (raw: unknown, fallback: number): number => {
  const n = typeof raw === "number" ? raw : typeof raw === "string" && raw.trim() !== "" ? Number(raw.trim()) : NaN;
  return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : fallback;
};

/**
 * The steps' arguments: the values the host may set.
 *
 * The twin (`defaultStep`) is resolved by the framework before the factory
 * is called, so the machine only ever sees the live value.
 */
export interface StepsArgs {
  count?: number;
  step?: string | number;
  defaultCount?: number;
}

/**
 * The machine's context, built from its arguments: the count and the step
 * the host wrote, and the machine's own defaults for everything else.
 *
 * The seed twin (`defaultStep`) is the host's write of the step — the
 * framework resolved it into the args — so it counts as a write too.
 */
export function initial(args: StepsArgs = {}, authored: (name: string) => boolean): StepsContext {
  // A host that wrote `defaultStep` wrote the channel too.
  const written = (field: string): boolean =>
    authored(field) || authored(defaultTwin(field));
  // The host's count: a number, at least one.
  const count = Math.max(1, Math.floor(asCount(args.count, 1)));
  const seed = args.step;
  const seeded = written("step")
    ? (typeof seed === "number" && Number.isFinite(seed) ? Math.trunc(seed) : 0)
    : 0;
  return {
    count,
    step: Math.min(count, Math.max(0, seeded)),
    invalidAttempts: 0,
    lastInvalid: null,
  };
}

export function steps(
  args: StepsArgs = {},
  authored: (name: string) => boolean,
): Machine<StepsContext, StepsEvent> {
  return createMachine<StepsContext, StepsEvent>({
    id: "steps",
    initial: "idle",
    context: initial(args, authored),
    /**
     * The machine's contract with its hosts: the context fields a host may
     * write, and the event each write carries. A field with an event is
     * REPORTED — the machine decides, and the change reaches the host; a
     * field without one is SILENT.
     *
     * The step is NOT here: the selection travels by event (the guards
     * validate it), never by a host write.
     */
    fields: {
      count: {},
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
  });
}
