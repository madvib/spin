import { defaultTwin, isRecord } from "@spinjs/runtime";

export type TourState = "inactive" | "resolving" | "scrolling" | "active";

export interface TourStepRecord {
  readonly id: string;
  readonly target: string;
  readonly title: string;
  readonly description: string;
}

/** The spotlight's box, in the viewport's coordinates. */
export interface TourSpotlight {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface TourContext {
  steps: readonly TourStepRecord[];
  /** -1 when the tour is not running. */
  step: number;
  /** Where the last transition came from; the overlay's entry. */
  previousStep: number;
  /** The resolved target's box, padded: the spotlight's own geometry. */
  spotlight: TourSpotlight;
  disabled: boolean;
  spotlightPadding: number;
  label: string;
}

/** The tour's arguments: the values the host may set. */
export interface TourArgs {
  /** JSON text, one entry per step. */
  readonly steps?: string;
  readonly step?: number;
  readonly disabled?: boolean;
  readonly spotlightPadding?: number;
  readonly label?: string;
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
  const list: readonly unknown[] = Array.isArray(raw)
    ? raw
    : parseJsonList(raw);
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

/** The machine's context from its arguments. */
export function initial(
  args: TourArgs,
  authored: (name: string) => boolean = () => true,
): Pick<
  TourContext,
  | "steps"
  | "step"
  | "previousStep"
  | "spotlight"
  | "disabled"
  | "spotlightPadding"
  | "label"
> {
  const steps = stepsOf(args.steps);
  const step = authored("step") || authored(defaultTwin("step"))
    ? stepOf(args.step, steps.length)
    : -1;
  return {
    steps,
    step,
    previousStep: -1,
    spotlight: { x: 0, y: 0, w: 0, h: 0 },
    disabled: args.disabled ?? false,
    spotlightPadding: args.spotlightPadding ?? 8,
    label: args.label ?? "",
  };
}

export function stepOf(raw: unknown, count: number): number {
  return typeof raw === "number" && Number.isInteger(raw) && raw >= 0 &&
      raw < count
    ? raw
    : -1;
}

export const bailStep = (ctx: TourContext): Partial<TourContext> => ({
  previousStep: ctx.step,
  step: -1,
});
