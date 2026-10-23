import {
  ariaControls,
  ariaCurrent,
  ariaHidden,
  ariaLabelledBy,
  ariaOrientation,
  ariaOwns,
  defineComponent,
  optionRow,
  sliderThumb,
  type ApiOf,
  type ComponentDef,
  type ScopeFor,
  type SlotScopeFor,
} from "@spin/runtime";
import {
  hasNextStep,
  hasPrevStep,
  isCompleted,
  itemState,
  percent,
  type StepsArgs,
  type StepsContext,
  type StepsState,
} from "./steps.state.ts";
import { steps as stepsMachine } from "./steps.machine.ts";
import type { StepsEvents } from "./steps.events.ts";

export type { StepsArgs, StepsState };
export type StepsComplete = { readonly step: number };

type ScopeLike = ScopeFor<StepsContext, StepsEvents, StepsState>;
type SlotLike<R> = SlotScopeFor<R, StepsContext, StepsEvents, StepsState>;

const parseTitles = (raw: unknown): readonly string[] => {
  if (Array.isArray(raw)) return raw.filter((item): item is string => typeof item === "string");
  return [];
};

const indexCache = new Map<number, readonly number[]>();
const stepIndexes = (count: number): readonly number[] => {
  const hit = indexCache.get(count);
  if (hit !== undefined) return hit;
  const made = Array.from({ length: count }, (_, index) => index);
  indexCache.set(count, made);
  return made;
};

const onTriggerKeydown = (scope: ScopeLike, event: KeyboardEvent): void => {
  if (event.defaultPrevented) return;
  const order = stepIndexes(scope.context.count);
  const at = order.indexOf(scope.context.step);
  const move = (delta: 1 | -1): void => {
    const next = order[(at + delta + order.length) % order.length];
    if (next !== undefined) scope.send({ type: "STEP.SET", value: next });
  };
  switch (event.key) {
    case "ArrowRight":
    case "ArrowDown":
      event.preventDefault();
      move(1);
      break;
    case "ArrowLeft":
    case "ArrowUp":
      event.preventDefault();
      move(-1);
      break;
    case "Home":
      event.preventDefault();
      if (order[0] !== undefined) scope.send({ type: "STEP.SET", value: order[0] });
      break;
    case "End": {
      event.preventDefault();
      const last = order[order.length - 1];
      if (last !== undefined) scope.send({ type: "STEP.SET", value: last });
      break;
    }
    default:
      break;
  }
};

export const def = {
  name: "steps",
  machine: (args: StepsArgs, authored: (name: string) => boolean) => stepsMachine(args, authored),
  start: "idle",
  dispatch: (event, props) => {
    if (event.type !== "STEP.SET" && event.type !== "STEP.NEXT") return event;
    const result: { type: string } & Record<string, unknown> = { ...event };
    const valid = props["isStepValid"];
    const skippable = props["isStepSkippable"];
    if (typeof valid === "function") result["valid"] = valid;
    if (typeof skippable === "function") result["skippable"] = skippable;
    return result;
  },
  parts: {
    root: {
      attrs: (scope: ScopeLike) => ({
        "data-orientation": scope.context.orientation,
      }),
    },
    list: {
      attrs: (scope: ScopeLike) => {
        const items = stepIndexes(scope.context.count);
        return {
          role: "tablist",
          "data-orientation": scope.context.orientation,
          ...ariaOwns(scope, {
            parts: items.map((index) => ({ part: "trigger", slot: index })),
          }),
          ...ariaOrientation(
            scope.context.orientation === "horizontal" ||
              scope.context.orientation === "vertical"
              ? scope.context.orientation
              : undefined,
          ),
        };
      },
    },
    nextTrigger: {
      attrs: (scope: ScopeLike) => ({
        type: "button",
        disabled: hasNextStep(scope.context) ? undefined : true,
        onClick: (event: MouseEvent): void => {
          if (event.defaultPrevented) return;
          scope.send({ type: "STEP.NEXT" });
        },
      }),
    },
    prevTrigger: {
      attrs: (scope: ScopeLike) => ({
        type: "button",
        disabled: hasPrevStep(scope.context) ? undefined : true,
        onClick: (event: MouseEvent): void => {
          if (event.defaultPrevented) return;
          scope.send({ type: "STEP.PREV" });
        },
      }),
    },
    progress: {
      attrs: (scope: ScopeLike) => {
        const value = percent(scope.context);
        return {
          role: "progressbar",
          ...sliderThumb({
            now: String(Math.round(value)),
            min: "0",
            max: "100",
            text: `${Math.round(value)}% complete`,
          }),
          "data-complete": scope.attr(value === 100),
        };
      },
    },
    progressFill: {
      attrs: (scope: ScopeLike) => ({
        style: { width: `${percent(scope.context).toFixed(3)}%` },
      }),
    },
  },
  slots: {
    item: {
      indexes: (context: StepsContext) => stepIndexes(context.count),
      attrs: (scope: SlotLike<number>) => {
        const index = scope.slot;
        const state = itemState(scope.context, index);
        return {
          ...ariaCurrent(state.current ? "step" : undefined),
        };
      },
    },
    trigger: {
      indexes: (context: StepsContext) => stepIndexes(context.count),
      attrs: (scope: SlotLike<number>) => {
        const index = scope.slot;
        const state = itemState(scope.context, index);
        return {
          role: "tab",
          type: "button",
          tabindex: scope.context.linear !== true || state.current ? "0" : "-1",
          ...optionRow({ selected: state.current ? "true" : "false" }),
          ...ariaControls(scope, { part: "content", slot: index }),
          "data-state": state.current ? "open" : "closed",
          "data-complete": scope.attr(state.completed),
          "data-current": scope.attr(state.current),
          "data-incomplete": scope.attr(state.incomplete),
          onClick: (event: MouseEvent): void => {
            if (event.defaultPrevented) return;
            if (scope.context.linear === true) return;
            scope.send({ type: "STEP.SET", value: index });
          },
          onKeydown: (event: KeyboardEvent): void => onTriggerKeydown(scope, event),
        };
      },
    },
    content: {
      indexes: (context: StepsContext) => stepIndexes(context.count),
      attrs: (scope: SlotLike<number>) => {
        const index = scope.slot;
        const state = itemState(scope.context, index);
        return {
          role: "tabpanel",
          tabindex: "0",
          hidden: state.current ? undefined : true,
          "data-state": state.current ? "open" : "closed",
          ...ariaLabelledBy(scope, { part: "trigger", slot: index }),
        };
      },
    },
    indicator: {
      indexes: (context: StepsContext) => stepIndexes(context.count),
      attrs: (scope: SlotLike<number>) => {
        const state = itemState(scope.context, scope.slot);
        return {
          ...ariaHidden(true),
          "data-complete": scope.attr(state.completed),
          "data-current": scope.attr(state.current),
          "data-incomplete": scope.attr(state.incomplete),
        };
      },
    },
    separator: {
      indexes: (context: StepsContext) => stepIndexes(context.count),
      attrs: (scope: SlotLike<number>) => {
        const state = itemState(scope.context, scope.slot);
        return {
          "data-complete": scope.attr(state.completed),
          "data-current": scope.attr(state.current),
          "data-incomplete": scope.attr(state.incomplete),
        };
      },
    },
  },
  commands: {
    goToNextStep: { event: () => ({ type: "STEP.NEXT" }) },
    goToPrevStep: { event: () => ({ type: "STEP.PREV" }) },
    resetStep: { event: () => ({ type: "STEP.RESET" }) },
    setStep: { event: ([value]: [value: number]) => ({ type: "STEP.SET", value: Math.trunc(value) }) },
  },
  readers: {
    value: { read: (context: StepsContext) => context.step },
    count: { read: (context: StepsContext) => context.count },
    percent: { read: (context: StepsContext) => percent(context) },
    hasNextStep: { read: (context: StepsContext) => hasNextStep(context) },
    hasPrevStep: { read: (context: StepsContext) => hasPrevStep(context) },
    completed: { read: (context: StepsContext) => isCompleted(context) },
  },
  methods: {
    getItems: {
      call: (context: StepsContext) => stepIndexes(context.count),
    },
    getItemTitle: {
      call: (context: StepsContext, _state, [index]: [index: number]) => {
        const rows = parseTitles(context.titles);
        const i = Math.trunc(index);
        return rows[i] ?? `Step ${i + 1}`;
      },
    },
    getItemState: {
      call: (context: StepsContext, _state, [index]: [index: number]) => {
        return itemState(context, Math.trunc(index));
      },
    },
  },
  events: {
    "step-change": {
      prop: "onStepChange",
      watch: (context: StepsContext) => [context.step],
      detail: (watched: readonly [number]) => ({ step: watched[0] }),
    },
    "step-complete": {
      prop: "onStepComplete",
      watch: (context: StepsContext) => [isCompleted(context), context.step],
      detail: (watched: readonly [boolean, number]) => ({ step: watched[1] }),
    },
    "step-invalid": {
      prop: "onStepInvalid",
      watch: (context: StepsContext) => [context.invalidAttempts],
      detail: (_watched, _event, _props, context) => {
        if (context === undefined) return { step: 0, action: "next", targetStep: 0 };
        const ctx = context;
        const fallbackAction: "next" | "set" = "next";
        return {
          step: ctx.step,
          action: ctx.lastInvalid?.action ?? fallbackAction,
          targetStep: ctx.lastInvalid?.targetStep ?? 0,
        };
      },
    },
  },
} satisfies ComponentDef<StepsContext, StepsEvents, Record<string, unknown>, StepsArgs, StepsState>;

export type StepsApi = ApiOf<typeof def>;

export const steps = defineComponent<StepsContext, StepsEvents, StepsApi, StepsArgs, StepsState>(def);
