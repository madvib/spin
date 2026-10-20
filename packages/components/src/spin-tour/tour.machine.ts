/**
 * Tour machine: the inactive and running modes, and the three phases a
 * running step passes through.
 *
 * Zag nests these (`running{resolving, scrolling, active}`); the fork's
 * targets are flat names, so they are flat here without losing the
 * legality they gate — a step resolves its target, scrolls it into view,
 * and only then shows its spotlight, and the events that mean something
 * in each phase differ (a RESOLVED event is meaningless once active).
 *
 * The reflexes around the phases are the connect's: the target lookup
 * (a poll that reports RESOLVED or NOT_FOUND), the scroll (which reports
 * SCROLL.END), the focus trap, and the dismissable/escape wiring. This
 * machine owns the step index, the direction it moves, and what a
 * dismissal at the last step means (a completion rather than a bail).
 */

import { defaultTwin, isRecord } from "@spin/runtime";
import { createMachine, type Machine } from "@spin/runtime/fsm";

export interface TourStepRecord {
  readonly id: string;
  /** The selector the spotlight points at; the connect resolves it. */
  readonly target: string;
  readonly title: string;
  readonly description: string;
}

export interface TourContext {
  /** The step collection, synced from scope by the bridge. */
  steps: readonly TourStepRecord[];
  /** The index into the steps; -1 when the tour is not running. */
  step: number;
  /** The index the last transition came from, for the overlay's entry. */
  previousStep: number;
}

export interface TourStepChange {
  readonly step: number;
  readonly stepId: string;
}

export interface TourDismissChange {
  /** Why the tour stopped: the last step completed, or the host bailed. */
  readonly reason: "complete" | "dismiss" | "skip" | "not-found";
  readonly step: number;
}

/**
 * The tour's arguments: the values the host may set.
 *
 * The names are the element's prop names — the machine is instantiated
 * with the element's prop bag and picks what it wants. The twin
 * (`defaultSteps`) is resolved by the framework before the factory is
 * called, so the machine only ever sees the live value.
 */
export interface TourArgs {
  /** The steps, as the host wrote them: JSON text, one entry per step. */
  readonly steps?: string;
  /** The step the host points at: an index into the steps. */
  readonly step?: number;
}

/** A step entry: id names it, the rest is optional text. Malformed
 * entries drop; anything else is no steps. */

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

/** The machine's context, from its arguments: the steps the host wrote, the
 * step it points at (a legal index, else the tour starts unrunnning), and no
 * previous step yet. The twin (`defaultSteps`) was resolved by the framework
 * before the factory was called, so the arguments carry the live value.
 *
 * The step is the host's channel: the host's own write stands — the live
 * prop or its twin, which is the same write under the framework's
 * convention — else the machine's own default, the tour unrunnning (-1).
 * The steps are the element's data: the collection is taken as it is. */
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

/** A seeded step off the host: a legal index, or -1 for unrunnning. */
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
  // Root tier: a programmatic step move works from every phase, and it
  // re-enters resolving — the new target is looked up and scrolled to
  // before its spotlight shows.
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
        // A step move re-enters resolving: the new target is looked up
        // and scrolled to before its spotlight shows.
        "STEP.NEXT": [
          { cond: "hasNext", target: "resolving", actions: [{ assign: "advance" }] },
        ],
        "STEP.PREV": [
          { cond: "hasPrev", target: "resolving", actions: [{ assign: "retreat" }] },
        ],
        // A dismiss at the last step is the tour completing; anywhere else
        // it is a bail. Both report through the change channel.
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
      // The step arrives the way the host wrote it; the machine shapes it,
      // wherever it came from.
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
    /** The last step's dismiss: the index stays so the channel can report it. */
    complete: (ctx: TourContext): Partial<TourContext> => ({ previousStep: ctx.step, step: -1 }),
  },
};

/**
 * The tour machine: state and nothing else. It is headless — it knows its
 * own arguments, and nothing about props, markup, or the DOM.
 */
export function tour(
  args: TourArgs = {},
  authored: (name: string) => boolean = () => true,
): Machine<TourContext, TourEvent> {
  return createMachine<TourContext, TourEvent>({
    ...config,
    ...implementations,
    context: initial(args, authored),
    /**
     * The machine's contract with its hosts: the context fields a host
     * may write, and the event each write carries.
     *
     * A field with an event is REPORTED: the host's write is an event, the
     * machine decides, and the change reaches the host. A field without
     * one is SILENT: the host's write lands in the field, and nothing
     * reports.
     */
    fields: {
      step: { event: "STEP.SET" },
    },
  });
}
