/**
 * Tour machine: the inactive and running modes, and the three phases a
 * running step passes through — a step resolves its target, scrolls it
 * into view, then shows its spotlight.
 */

import { defaultTwin, isRecord } from "@spin/runtime";
import { createMachine, type Machine } from "@spin/runtime/fsm";

export interface TourStepRecord {
  readonly id: string;
  readonly target: string;
  readonly title: string;
  readonly description: string;
}

export interface TourContext {
  steps: readonly TourStepRecord[];
  /** -1 when the tour is not running. */
  step: number;
  /** Where the last transition came from; the overlay's entry. */
  previousStep: number;
}

export interface TourStepChange {
  readonly step: number;
  readonly stepId: string;
}

export interface TourDismissChange {
  readonly reason: "complete" | "dismiss" | "skip" | "not-found";
  readonly step: number;
}

/** The tour's arguments: the values the host may set. */
export interface TourArgs {
  /** JSON text, one entry per step. */
  readonly steps?: string;
  readonly step?: number;
}

const parseJsonList = (raw: unknown): readonly unknown[] => {
  if (typeof raw !== "string" || raw.length === 0) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

/** The step collection off any transport: well-shaped entries only. The
 * scope grammar coerces `= []` to `["[]"]`, so JSON text parses too. */
export function stepsOf(raw: unknown): TourStepRecord[] {
  const list: readonly unknown[] = Array.isArray(raw) ? raw : parseJsonList(raw);
  const steps: TourStepRecord[] = [];
  for (const entry of list) {
    if (!isRecord(entry)) continue;
    const id: unknown = entry["id"];
    if (typeof id !== "string") continue;
    const target: unknown = entry["target"];
    const title: unknown = entry["title"];
    const description: unknown = entry["description"];
    steps.push({
      id,
      target: typeof target === "string" ? target : "",
      title: typeof title === "string" ? title : "",
      description: typeof description === "string" ? description : "",
    });
  }
  return steps;
}

/** The machine's context from its arguments: the steps the host wrote and
 * the step it points at (a legal index, else the tour starts unrunnning).
 * The twin is resolved by the framework before the factory runs. */
export function initial(
  args: TourArgs,
  authored: (name: string) => boolean = () => true,
): Pick<TourContext, "steps" | "step" | "previousStep"> {
  const steps = stepsOf(args.steps);
  const step = authored("step") || authored(defaultTwin("step"))
    ? stepOf(args.step, steps.length)
    : -1;
  return {
    steps,
    step,
    previousStep: -1,
  };
}

export function stepOf(raw: unknown, count: number): number {
  return typeof raw === "number" && Number.isInteger(raw) && raw >= 0 && raw < count ? raw : -1;
}

export type TourEvent =
  | { type: "START" }
  | { type: "STEP.SET"; step: number }
  | { type: "STEP.NEXT" }
  | { type: "STEP.PREV" }
  | { type: "TARGET.RESOLVED" }
  | { type: "TARGET.NOT_FOUND" }
  | { type: "SCROLL.END" }
  | { type: "DISMISS" }
  | { type: "SKIP" };

const config = {
  id: "tour",
  initial: "inactive",
  context: {
    steps: [] as readonly TourStepRecord[],
    step: -1,
    previousStep: -1,
  },
  // A programmatic step move works from every phase and re-enters
  // resolving: the new target is looked up and scrolled to first.
  on: {
    "STEP.SET": [
      { cond: "isValidStep", target: "resolving", actions: [{ assign: "setStep" }] },
    ],
  },
  states: {
    inactive: {
      on: {
        "START": [
          { cond: "hasSteps", target: "resolving", actions: [{ assign: "startAtZero" }] },
        ],
      },
    },
    resolving: {
      on: {
        "TARGET.NOT_FOUND": [{ target: "inactive", actions: [{ assign: "bailStep" }] }],
        "TARGET.RESOLVED": [{ target: "scrolling" }],
        "DISMISS": [{ target: "inactive", actions: [{ assign: "bailStep" }] }],
        "SKIP": [{ target: "inactive" }],
      },
    },
    scrolling: {
      on: {
        "SCROLL.END": [{ target: "active" }],
        "DISMISS": [{ target: "inactive", actions: [{ assign: "bailStep" }] }],
        "SKIP": [{ target: "inactive" }],
      },
    },
    active: {
      on: {
        "STEP.NEXT": [
          { cond: "hasNext", target: "resolving", actions: [{ assign: "advance" }] },
        ],
        "STEP.PREV": [
          { cond: "hasPrev", target: "resolving", actions: [{ assign: "retreat" }] },
        ],
        // In active, a dismiss is the tour completing (the last step);
        // elsewhere it is a bail.
        "DISMISS": [{ target: "inactive", actions: [{ assign: "complete" }] }],
        "SKIP": [{ target: "inactive" }],
      },
    },
  },
};

const implementations = {
  conds: {
    hasSteps: (ctx: TourContext): boolean => ctx.steps.length > 0,
    isValidStep: (ctx: TourContext, e: TourEvent): boolean =>
      e.type === "STEP.SET" && e.step >= 0 && e.step < ctx.steps.length,
    hasNext: (ctx: TourContext): boolean => ctx.step + 1 < ctx.steps.length,
    hasPrev: (ctx: TourContext): boolean => ctx.step > 0,
    isLastStep: (ctx: TourContext): boolean => ctx.steps.length > 0 && ctx.step === ctx.steps.length - 1,
  },
  assigns: {
    startAtZero: (): Partial<TourContext> => ({ previousStep: -1, step: 0 }),
    setStep: (ctx: TourContext, e: TourEvent): Partial<TourContext> => {
      if (e.type !== "STEP.SET") return {};
      return { previousStep: ctx.step, step: stepOf(e.step, ctx.steps.length) };
    },
    advance: (ctx: TourContext): Partial<TourContext> => {
      if (ctx.step + 1 >= ctx.steps.length) return {};
      return { previousStep: ctx.step, step: ctx.step + 1 };
    },
    retreat: (ctx: TourContext): Partial<TourContext> => {
      if (ctx.step <= 0) return {};
      return { previousStep: ctx.step, step: ctx.step - 1 };
    },
    bailStep: (ctx: TourContext): Partial<TourContext> => ({ previousStep: ctx.step, step: -1 }),
    /** The last step's dismiss: previousStep keeps the index for the report. */
    complete: (ctx: TourContext): Partial<TourContext> => ({ previousStep: ctx.step, step: -1 }),
  },
};

export function tour(
  args: TourArgs = {},
  authored: (name: string) => boolean = () => true,
): Machine<TourContext, TourEvent> {
  return createMachine<TourContext, TourEvent>({
    ...config,
    ...implementations,
    context: initial(args, authored),
    /**
     * The contract with its hosts: the context fields a host may write, and
     * the event each write carries. A field with an event is reported.
     */
    fields: {
      step: { event: "STEP.SET" },
    },
  });
}
