import { defaultTwin } from "@spin/runtime";

export type RatingGroupState = "idle" | "focus" | "hover";

export interface RatingGroupContext {
  value: number;
  hoveredValue: number;
  count: number;
  allowHalf: boolean;
  disabled: boolean;
  readOnly: boolean;
  required: boolean;
  name: string;
  label: string;
}

export interface RatingGroupArgs {
  value?: string | number;
  defaultValue?: string | number;
  count?: number;
  allowHalf?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  required?: boolean;
  name?: string;
  label?: string;
  defaultReadOnly?: boolean;
}

export interface RatingItemState {
  readonly highlighted: boolean;
  readonly half: boolean;
  readonly checked: boolean;
}

export function ratingValue(raw: unknown): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(n) ? n : -1;
}

export function isInteractive(ctx: RatingGroupContext): boolean {
  return !ctx.disabled && !ctx.readOnly;
}

export function isHovering(ctx: RatingGroupContext): boolean {
  return ctx.hoveredValue > -1;
}

export function itemState(
  ctx: RatingGroupContext,
  index: number,
): RatingItemState {
  const current = isHovering(ctx) ? ctx.hoveredValue : ctx.value;
  const equal = Math.ceil(current) === index;
  return {
    highlighted: index <= current || equal,
    half: equal && Math.abs(current - index) === 0.5,
    checked: equal || (ctx.value <= 0 && index === 1),
  };
}

export function step(ctx: RatingGroupContext): number {
  return ctx.allowHalf ? 0.5 : 1;
}

export function initial(
  args: RatingGroupArgs = {},
  authored: (name: string) => boolean = () => false,
): RatingGroupContext {
  const written = (field: string): boolean =>
    authored(field) ||
    authored(defaultTwin(field)) ||
    (args as Record<string, unknown>)[field] !== undefined ||
    (args as Record<string, unknown>)[defaultTwin(field)] !== undefined;
  return {
    value: written("value")
      ? ratingValue(
        (args as Record<string, unknown>).value ??
          (args as Record<string, unknown>).defaultValue,
      )
      : -1,
    hoveredValue: -1,
    count: Math.max(1, Math.floor(args.count ?? 5)),
    allowHalf: args.allowHalf === true,
    disabled: args.disabled === true,
    readOnly: args.readOnly === true,
    required: args.required === true,
    name: args.name ?? "",
    label: args.label ?? "",
  };
}
