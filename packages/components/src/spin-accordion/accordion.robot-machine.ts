import { action, createMachine, interpret, state, transition } from "robot3";

/**
 * The robot3 accordion: disclosure state with zero framework machinery.
 *
 * States mirror what the component actually renders: `idle` (nothing
 * focused) and `focused` (keyboard navigation live). Value/focus live in
 * robot context, mutated by transitions — no bindables, no computed, no
 * effects, no track. The service sends synchronously, so no microtask
 * deferral and no `machineTick` subscription: alien-signals writes inside
 * actions notify readers directly.
 *
 * Focus movement is NOT here: roving order is a view concern, and the DOM
 * queries live in `connectRobotAccordion`, which moves real focus and then
 * sends the event so the machine's `focusedValue` follows. The machine never
 * touches the DOM.
 *
 * Contrast with the Zag machine this replaces: the same two states, reached
 * through `prop`/`bindable`/`computed`/`scope` params, `send` deferred
 * through `queueMicrotask`, and `connect` recomputed behind a `computed`
 * memo per tick. Same UI state — one dependency instead of five packages,
 * 0.9kB instead of ~20kB of interpreter.
 */

export interface AccordionRobotContext {
  /** Open item values, in order. */
  value: string[];
  /** Focused item value, or null. */
  focusedValue: string | null;
  /** Component props the transitions read. Synced per send from scope values. */
  collapsible: boolean;
  multiple: boolean;
  onValueChange: ((details: { value: string[] }) => void) | undefined;
  onFocusChange: ((details: { value: string | null }) => void) | undefined;
}

export type AccordionRobotEvent =
  | { type: "TRIGGER.CLICK"; value: string }
  | { type: "TRIGGER.FOCUS"; value: string }
  | { type: "TRIGGER.BLUR" }
  | { type: "VALUE.SET"; value: string[] }
  | { type: "FOCUS.SET"; value: string | null };

function emitValue(ctx: AccordionRobotContext, next: string[]): void {
  if (next.length === ctx.value.length && next.every((v, i) => v === ctx.value[i])) return;
  ctx.value = next;
  ctx.onValueChange?.({ value: next });
}

function toggle(ctx: AccordionRobotContext, value: string): void {
  const expanded = ctx.value.includes(value);
  if (!expanded) {
    emitValue(ctx, ctx.multiple ? [...ctx.value, value] : [value]);
  } else if (ctx.collapsible || ctx.multiple) {
    emitValue(ctx, ctx.multiple ? ctx.value.filter((v) => v !== value) : []);
  }
}

function setValue(ctx: AccordionRobotContext, value: string[]): void {
  emitValue(ctx, value);
}

function setFocused(ctx: AccordionRobotContext, value: string | null): void {
  if (value === ctx.focusedValue) return;
  ctx.focusedValue = value;
  ctx.onFocusChange?.({ value });
}

const accordionStates = {
  idle: state(
    transition(
      "TRIGGER.FOCUS",
      "focused",
      action((ctx: AccordionRobotContext, event: { value: string }) => setFocused(ctx, event.value)),
    ),
    transition(
      "TRIGGER.CLICK",
      "idle",
      action((ctx: AccordionRobotContext, event: { value: string }) => toggle(ctx, event.value)),
    ),
    transition(
      "VALUE.SET",
      "idle",
      action((ctx: AccordionRobotContext, event: { value: string[] }) => setValue(ctx, event.value)),
    ),
    transition(
      "FOCUS.SET",
      "idle",
      action((ctx: AccordionRobotContext, event: { value: string | null }) => setFocused(ctx, event.value)),
    ),
  ),
  focused: state(
    transition(
      "TRIGGER.CLICK",
      "focused",
      action((ctx: AccordionRobotContext, event: { value: string }) => toggle(ctx, event.value)),
    ),
    transition(
      "TRIGGER.BLUR",
      "idle",
      action((ctx: AccordionRobotContext) => setFocused(ctx, null)),
    ),
    transition(
      "FOCUS.SET",
      "focused",
      action((ctx: AccordionRobotContext, event: { value: string | null }) =>
        setFocused(ctx, event.value),
      ),
    ),
    transition(
      "VALUE.SET",
      "focused",
      action((ctx: AccordionRobotContext, event: { value: string[] }) => setValue(ctx, event.value)),
    ),
  ),
};

export function createAccordionMachine(
  initial: Pick<AccordionRobotContext, "value" | "collapsible" | "multiple" | "onValueChange" | "onFocusChange">,
) {
  const machine = createMachine("idle", accordionStates, () => ({ ...initial, focusedValue: null }));
  return interpret(machine, () => undefined, undefined);
}

export type AccordionRobotService = ReturnType<typeof createAccordionMachine>;
