import { defaultTwin } from "@spinjs/runtime";

export type StepsState = "idle";

export interface StepsContext {
  step: number;
  count: number;
  invalidAttempts: number;
  lastInvalid:
    | { readonly action: "next" | "set"; readonly targetStep: number }
    | null;
  titles: unknown;
  orientation: string | undefined;
  linear: boolean | undefined;
  isStepValid: ((index: number) => boolean) | undefined;
  isStepSkippable: ((index: number) => boolean) | undefined;
}

export interface StepsArgs {
  count?: number;
  step?: string | number;
  defaultCount?: number;
  titles?: unknown;
  orientation?: string;
  linear?: boolean;
  isStepValid?: (index: number) => boolean;
  isStepSkippable?: (index: number) => boolean;
}

const asCount = (raw: unknown, fallback: number): number => {
  const n = typeof raw === "number"
    ? raw
    : typeof raw === "string" && raw.trim() !== ""
    ? Number(raw.trim())
    : NaN;
  return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : fallback;
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

export function initial(
  args: StepsArgs = {},
  authored: (name: string) => boolean,
): StepsContext {
  const written = (field: string): boolean =>
    authored(field) ||
    authored(defaultTwin(field)) ||
    (args as Record<string, unknown>)[defaultTwin(field)] !== undefined;
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
    titles: args.titles,
    orientation: args.orientation,
    linear: args.linear,
    isStepValid: args.isStepValid,
    isStepSkippable: args.isStepSkippable,
  };
}
