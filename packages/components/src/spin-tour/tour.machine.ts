/**
 * Tour machine: the inactive and running modes, and the three phases a
 * running step passes through — a step resolves its target, scrolls it
 * into view, then shows its spotlight.
 */

import { defaultTwin, isRecord } from "@spin/runtime";
import { createMachine, type Machine, type EventUnion, type MachineSpec } from "@spin/runtime/fsm";
const bailStep = (ctx: TourContext) : Partial<TourContext> => { return ({ previousStep: ctx.step, step: -1 }); };



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

export interface TourEvents {
  "START": {};
  "STEP.SET": { step: number };
  "STEP.NEXT": {};
  "STEP.PREV": {};
  "TARGET.RESOLVED": {};
  "TARGET.NOT_FOUND": {};
  "SCROLL.END": {};
  "DISMISS": {};
  "SKIP": {};
}

export type TourEvent = EventUnion<TourEvents>;


const config: MachineSpec<TourContext, TourEvents> = {
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
      { cond: (ctx, e) => { return e.type === "STEP.SET" && e.step >= 0 && e.step < ctx.steps.length; }, target: "resolving", assign: (ctx, e) => {
      if (e.type !== "STEP.SET") return {};
      return { previousStep: ctx.step, step: stepOf(e.step, ctx.steps.length) };
    } },
    ],
  },
  states: {
    inactive: {
      on: {
        "START": [
          { cond: (ctx) => { return ctx.steps.length > 0; }, target: "resolving", assign: () => { return ({ previousStep: -1, step: 0 }); } },
        ],
      },
    },
    resolving: {
      on: {
        "TARGET.NOT_FOUND": [{ target: "inactive", assign: bailStep }],
        "TARGET.RESOLVED": [{ target: "scrolling" }],
        "DISMISS": [{ target: "inactive", assign: bailStep }],
        "SKIP": [{ target: "inactive" }],
      },
    },
    scrolling: {
      on: {
        "SCROLL.END": [{ target: "active" }],
        "DISMISS": [{ target: "inactive", assign: bailStep }],
        "SKIP": [{ target: "inactive" }],
      },
    },
    active: {
      on: {
        "STEP.NEXT": [
          { cond: (ctx) => { return ctx.step + 1 < ctx.steps.length; }, target: "resolving", assign: (ctx) => {
      if (ctx.step + 1 >= ctx.steps.length) return {};
      return { previousStep: ctx.step, step: ctx.step + 1 };
    } },
        ],
        "STEP.PREV": [
          { cond: (ctx) => { return ctx.step > 0; }, target: "resolving", assign: (ctx) => {
      if (ctx.step <= 0) return {};
      return { previousStep: ctx.step, step: ctx.step - 1 };
    } },
        ],
        // In active, a dismiss is the tour completing (the last step);
        // elsewhere it is a bail.
        "DISMISS": [{ target: "inactive", assign: (ctx) => { return ({ previousStep: ctx.step, step: -1 }); } }],
        "SKIP": [{ target: "inactive" }],
      },
    },
  },
};

const implementations = {};

export function tour(
  args: TourArgs = {},
  authored: (name: string) => boolean = () => true,
): Machine<TourContext, TourEvents> {
  return createMachine<TourContext, TourEvents>({
    ...config,
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
