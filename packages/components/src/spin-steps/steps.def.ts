import {
  defineComponent,
  textProp,
  type ComponentDef,
} from "@spin/runtime";
import {
  config,
  hasNextStep,
  hasPrevStep,
  implementations,
  isCompleted,
  itemState,
  percent,
  type StepsContext,
  type StepsEvent,
  type StepsInvalid,
  type StepsItemState,
  type StepsStepChange,
} from "./steps.machine.ts";

/**
 * Steps definition: the DOM contract as data. The machine owns the single
 * idle state, the step index, the count, and the guarded transitions; this
 * file maps props to channels, parts to attribute bags, commands to sends,
 * and step/complete/invalid transitions to their events. Navigation events
 * carry the host validators (functions cannot cross the scope channel, so
 * the machine's guards read them off the event).
 */

export interface StepsComplete {
  readonly step: number;
}

export interface StepsApi {
  goToNextStep(): void;
  goToPrevStep(): void;
  resetStep(): void;
  setStep(value: number): void;
  readonly value: number;
  readonly count: number;
  readonly percent: number;
  readonly hasNextStep: boolean;
  readonly hasPrevStep: boolean;
  readonly completed: boolean;
  getItems(): readonly number[];
  getItemTitle(index: number): string;
  getItemState(slot: { readonly index: number }): StepsItemState;
  getRootProps(): Record<string, unknown>;
  getListProps(): Record<string, unknown>;
  getItemProps(slot: { readonly index: number }): Record<string, unknown>;
  getTriggerProps(slot: { readonly index: number }): Record<string, unknown>;
  getContentProps(slot: { readonly index: number }): Record<string, unknown>;
  getIndicatorProps(slot: { readonly index: number }): Record<string, unknown>;
  getSeparatorProps(slot: { readonly index: number }): Record<string, unknown>;
  getNextTriggerProps(): Record<string, unknown>;
  getPrevTriggerProps(): Record<string, unknown>;
  getProgressProps(): Record<string, unknown>;
}

// Scope props arrive as strings; hooks write numbers. Accept both — a
// string-authored `defaultValue="45"` seeds 45, not 0.
const numProp = (raw: unknown): number | null => {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  if (typeof raw === "string" && raw.trim().length > 0) {
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

const countProp = (raw: unknown): number => Math.max(1, Math.floor(numProp(raw) ?? 1));

const parseTitles = (raw: unknown): readonly string[] => {
  if (typeof raw === "string") {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.filter((item): item is string => typeof item === "string");
    } catch {
      return [];
    }
  }
  return Array.isArray(raw) ? raw.filter((item): item is string => typeof item === "string") : [];
};

type Validator = (index: number) => boolean;

type Ctx = StepsContext;

const asCtx = (context: Record<string, unknown>): Ctx => context as unknown as Ctx;

const slotIndex = (slot: unknown): number => (slot as { readonly index: number }).index;

/** Stable index-array identity per count: the recipe's `for` re-stamps rows
 * when the source identity moves (the slider's focus-loss lesson). */
const indexCache = new Map<number, readonly number[]>();
const stepIndexes = (count: number): readonly number[] => {
  const hit = indexCache.get(count);
  if (hit !== undefined) return hit;
  const made = Array.from({ length: count }, (_, index) => index);
  indexCache.set(count, made);
  return made;
};

const def: ComponentDef<StepsContext, StepsEvent> = {
  name: "steps",
  config,
  implementations,
  start: "idle",
  seed: (props, authored) => {
    const count = countProp(props["count"]);
    const seeded = authored("step") ? numProp(props["step"]) : numProp(props["defaultStep"]);
    return {
      count,
      step: Math.min(count, Math.max(0, seeded ?? 0)),
    };
  },
  channels: {
    step: {
      controlled: true,
      parse: numProp,
      event: (value: number) => ({ type: "STEP.SET", value }),
    },
    defaultStep: { parse: numProp },
    count: { parse: countProp },
    titles: { parse: parseTitles },
    linear: { parse: (raw) => raw === true },
    orientation: { parse: (raw) => (raw === "vertical" ? "vertical" : "horizontal") },
    dir: { parse: (raw) => (raw === "rtl" ? "rtl" : "ltr") },
    label: { parse: textProp },
    isStepValid: { parse: (raw) => raw },
    isStepSkippable: { parse: (raw) => raw },
  },
  scalars: ["count"],
  dispatch: (event, props) => {
    if (event.type !== "STEP.SET" && event.type !== "STEP.NEXT") return event;
    const valid = props["isStepValid"];
    const skippable = props["isStepSkippable"];
    return {
      ...event,
      ...(typeof valid === "function" ? { valid } : {}),
      ...(typeof skippable === "function" ? { skippable } : {}),
    };
  },
  parts: {
    root: {
      sig: (scope) => [scope.props["orientation"], scope.props["dir"], percent(asCtx(scope.context))].join("|"),
      attrs: (scope) => ({
        id: scope.id("root"),
        dir: scope.props["dir"],
        "data-scope": "steps",
        "data-part": "root",
        "data-orientation": scope.props["orientation"],
        style: { "--steps-percent": `${percent(asCtx(scope.context))}%` },
      }),
    },
    list: {
      sig: (scope) => [scope.props["orientation"], scope.props["dir"], asCtx(scope.context).count].join("|"),
      attrs: (scope) => {
        const items = stepIndexes(asCtx(scope.context).count);
        return {
          id: scope.id("list"),
          dir: scope.props["dir"],
          role: "tablist",
          "aria-owns": items.map((index) => scope.id("trigger", index)).join(" "),
          "aria-orientation": scope.props["orientation"],
          "data-scope": "steps",
          "data-part": "list",
          "data-orientation": scope.props["orientation"],
        };
      },
    },
    nextTrigger: {
      id: "next-trigger",
      sig: (scope) => [hasNextStep(asCtx(scope.context))].join("|"),
      attrs: (scope) => ({
        dir: scope.props["dir"],
        type: "button",
        "data-scope": "steps",
        "data-part": "next-trigger",
        disabled: hasNextStep(asCtx(scope.context)) ? undefined : true,
        onClick: (event: MouseEvent) => {
          if (event.defaultPrevented) return;
          scope.send({ type: "STEP.NEXT" });
        },
      }),
    },
    prevTrigger: {
      id: "prev-trigger",
      sig: (scope) => [hasPrevStep(asCtx(scope.context))].join("|"),
      attrs: (scope) => ({
        dir: scope.props["dir"],
        type: "button",
        "data-scope": "steps",
        "data-part": "prev-trigger",
        disabled: hasPrevStep(asCtx(scope.context)) ? undefined : true,
        onClick: (event: MouseEvent) => {
          if (event.defaultPrevented) return;
          scope.send({ type: "STEP.PREV" });
        },
      }),
    },
    progress: {
      sig: (scope) => [percent(asCtx(scope.context))].join("|"),
      attrs: (scope) => {
        const value = percent(asCtx(scope.context));
        return {
          dir: scope.props["dir"],
          role: "progressbar",
          "aria-valuenow": String(Math.round(value)),
          "aria-valuemin": "0",
          "aria-valuemax": "100",
          "aria-valuetext": `${Math.round(value)}% complete`,
          "data-scope": "steps",
          "data-part": "progress",
          "data-complete": scope.attr(value === 100),
          style: { "--steps-progress": `${value}%` },
        };
      },
    },
  },
  slots: {
    item: {
      indexes: (context) => stepIndexes(asCtx(context).count),
      sig: (scope) => {
        const state = itemState(asCtx(scope.context), slotIndex(scope.slot));
        return [state.current, state.completed, state.incomplete, scope.props["orientation"]].join("|");
      },
      attrs: (scope) => {
        const state = itemState(asCtx(scope.context), slotIndex(scope.slot));
        return {
          dir: scope.props["dir"],
          "data-scope": "steps",
          "data-part": "item",
          "aria-current": state.current ? "step" : undefined,
          "data-orientation": scope.props["orientation"],
        };
      },
    },
    trigger: {
      indexes: (context) => stepIndexes(asCtx(context).count),
      sig: (scope) => {
        const state = itemState(asCtx(scope.context), slotIndex(scope.slot));
        return [state.current, state.completed, state.incomplete, scope.props["linear"], scope.props["orientation"]].join("|");
      },
      attrs: (scope) => {
        const index = slotIndex(scope.slot);
        const state = itemState(asCtx(scope.context), index);
        return {
          id: scope.id("trigger", index),
          role: "tab",
          type: "button",
          dir: scope.props["dir"],
          tabindex: scope.props["linear"] !== true || state.current ? "0" : "-1",
          "aria-selected": state.current ? "true" : "false",
          "aria-controls": scope.id("content", index),
          "data-scope": "steps",
          "data-part": "trigger",
          "data-state": state.current ? "open" : "closed",
          "data-orientation": scope.props["orientation"],
          "data-complete": scope.attr(state.completed),
          "data-current": scope.attr(state.current),
          "data-incomplete": scope.attr(state.incomplete),
          onClick: (event: MouseEvent) => {
            if (event.defaultPrevented) return;
            if (scope.props["linear"] === true) return;
            scope.send({ type: "STEP.SET", value: index });
          },
        };
      },
    },
    content: {
      indexes: (context) => stepIndexes(asCtx(context).count),
      sig: (scope) => {
        const state = itemState(asCtx(scope.context), slotIndex(scope.slot));
        return [state.current, scope.props["orientation"]].join("|");
      },
      attrs: (scope) => {
        const index = slotIndex(scope.slot);
        const state = itemState(asCtx(scope.context), index);
        return {
          id: scope.id("content", index),
          role: "tabpanel",
          tabindex: "0",
          dir: scope.props["dir"],
          hidden: state.current ? undefined : true,
          "data-scope": "steps",
          "data-part": "content",
          "data-state": state.current ? "open" : "closed",
          "data-orientation": scope.props["orientation"],
          "aria-labelledby": scope.id("trigger", index),
        };
      },
    },
    indicator: {
      indexes: (context) => stepIndexes(asCtx(context).count),
      sig: (scope) => {
        const state = itemState(asCtx(scope.context), slotIndex(scope.slot));
        return [state.current, state.completed, state.incomplete].join("|");
      },
      attrs: (scope) => {
        const state = itemState(asCtx(scope.context), slotIndex(scope.slot));
        return {
          dir: scope.props["dir"],
          "aria-hidden": "true",
          "data-scope": "steps",
          "data-part": "indicator",
          "data-complete": scope.attr(state.completed),
          "data-current": scope.attr(state.current),
          "data-incomplete": scope.attr(state.incomplete),
        };
      },
    },
    separator: {
      indexes: (context) => stepIndexes(asCtx(context).count),
      sig: (scope) => {
        const state = itemState(asCtx(scope.context), slotIndex(scope.slot));
        return [state.current, state.completed, state.incomplete, scope.props["orientation"]].join("|");
      },
      attrs: (scope) => {
        const state = itemState(asCtx(scope.context), slotIndex(scope.slot));
        return {
          dir: scope.props["dir"],
          "data-scope": "steps",
          "data-part": "separator",
          "data-orientation": scope.props["orientation"],
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
    setStep: { event: (args) => ({ type: "STEP.SET", value: args[0] as number }) },
  },
  readers: {
    value: { read: (context) => asCtx(context).step },
    count: { read: (context) => asCtx(context).count },
    percent: { read: (context) => percent(asCtx(context)) },
    hasNextStep: { read: (context) => hasNextStep(asCtx(context)) },
    hasPrevStep: { read: (context) => hasPrevStep(asCtx(context)) },
    completed: { read: (context) => isCompleted(asCtx(context)) },
  },
  methods: {
    getItems: {
      call: (context) => stepIndexes(asCtx(context).count),
    },
    getItemTitle: {
      call: (_context, _state, args, props) =>
        ((props["titles"] as readonly string[])[args[0] as number] ?? `Step ${(args[0] as number) + 1}`),
    },
    getItemState: {
      call: (context, _state, args) => itemState(asCtx(context), (args[0] as { readonly index: number }).index),
    },
  },
  events: {
    "step-change": {
      prop: "onStepChange",
      watch: (context) => [asCtx(context).step],
      detail: (watched) => ({ step: watched[0] as number }),
    },
    "step-complete": {
      prop: "onStepComplete",
      watch: (context) => [isCompleted(asCtx(context)), asCtx(context).step],
      detail: (watched) => ({ step: watched[1] as number }),
    },
    "step-invalid": {
      prop: "onStepInvalid",
      watch: (context) => [asCtx(context).invalidAttempts],
      detail: (_watched, _event, _props, context) => {
        const ctx = asCtx(context as Record<string, unknown>);
        return {
          step: ctx.step,
          action: ctx.lastInvalid?.action ?? ("next" as const),
          targetStep: ctx.lastInvalid?.targetStep ?? 0,
        };
      },
    },
  },
};

export const steps = defineComponent<StepsContext, StepsEvent, StepsApi>(def);
