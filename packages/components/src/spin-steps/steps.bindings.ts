import {
  defineComponent,
  type ComponentDef,
  type PartScope,
  type SlotScope,
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
 * Steps bindings: the DOM contract as data. The machine owns the step
 * index, the count, and the guarded transitions; this file maps transport
 * values to seed, parts to attribute bags, and navigation to sends.
 *
 * No channels: the transport owns prop coercion. No parsing, no DOM
 * access, no CSS custom properties. Progress is a literal bag style
 * computed from context, not a var. Navigation events carry host
 * validators (functions cannot cross the scope channel, so the machine's
 * guards read them off the event).
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

interface ScopeLike extends PartScope<unknown, StepsContext> {}
interface SlotLike<R> extends SlotScope<R, StepsContext> {}

/** A millisecond-free numeric prop: numbers pass, numeric strings parse,
 * everything else is absent. Named once; transport owns the grammar. */
const asCount = (raw: unknown, fallback: number): number => {
  const n = typeof raw === "number" ? raw : typeof raw === "string" && raw.trim() !== "" ? Number(raw.trim()) : NaN;
  return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : fallback;
};

const countOf = (raw: unknown): number => Math.max(1, Math.floor(asCount(raw, 1)));

/** Titles arrive as an array (transport-coerced); anything else is empty. */
const parseTitles = (raw: unknown): readonly string[] => {
  if (Array.isArray(raw)) return raw.filter((item): item is string => typeof item === "string");
  return [];
};

type Validator = (index: number) => boolean;

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

/** A step index slot: numbers in, numbers out. Rows iterate these. */
const slotIndex = (slot: SlotLike<{ readonly index: number }>): number => slot.slot.index;

/** Trigger keys move the selection: arrows step, Home/End jump. */
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

const def: ComponentDef<StepsContext, StepsEvent> = {
  name: "steps",
  config,
  implementations,
  start: "idle",
  seed: (raw) => {
    const count = countOf(raw["count"]);
    const seeded = typeof raw["step"] === "number" && Number.isFinite(raw["step"])
      ? Math.trunc(raw["step"])
      : typeof raw["defaultStep"] === "number" && Number.isFinite(raw["defaultStep"])
        ? Math.trunc(raw["defaultStep"])
        : 0;
    return {
      count,
      step: Math.min(count, Math.max(0, seeded)),
      invalidAttempts: 0,
      lastInvalid: null,
    };
  },
  scalars: ["count"],
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
      sig: (scope: ScopeLike) => [scope.props["orientation"], scope.props["dir"], percent(scope.context)].join("|"),
      attrs: (scope: ScopeLike) => ({
        id: scope.id(""),
        dir: typeof scope.props["dir"] === "string" ? scope.props["dir"] : undefined,
        "data-scope": "steps",
        "data-part": "root",
        "data-orientation": scope.props["orientation"],
      }),
    },
    list: {
      sig: (scope: ScopeLike) => [scope.props["orientation"], scope.props["dir"], scope.context.count].join("|"),
      attrs: (scope: ScopeLike) => {
        const items = stepIndexes(scope.context.count);
        return {
          id: scope.id("list"),
          dir: typeof scope.props["dir"] === "string" ? scope.props["dir"] : undefined,
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
      sig: (scope: ScopeLike) => [hasNextStep(scope.context)].join("|"),
      attrs: (scope: ScopeLike) => ({
        dir: typeof scope.props["dir"] === "string" ? scope.props["dir"] : undefined,
        type: "button",
        "data-scope": "steps",
        "data-part": "next-trigger",
        disabled: hasNextStep(scope.context) ? undefined : true,
        onClick: (event: MouseEvent): void => {
          if (event.defaultPrevented) return;
          scope.send({ type: "STEP.NEXT" });
        },
      }),
    },
    prevTrigger: {
      id: "prev-trigger",
      sig: (scope: ScopeLike) => [hasPrevStep(scope.context)].join("|"),
      attrs: (scope: ScopeLike) => ({
        dir: typeof scope.props["dir"] === "string" ? scope.props["dir"] : undefined,
        type: "button",
        "data-scope": "steps",
        "data-part": "prev-trigger",
        disabled: hasPrevStep(scope.context) ? undefined : true,
        onClick: (event: MouseEvent): void => {
          if (event.defaultPrevented) return;
          scope.send({ type: "STEP.PREV" });
        },
      }),
    },
    progress: {
      sig: (scope: ScopeLike) => [percent(scope.context)].join("|"),
      attrs: (scope: ScopeLike) => {
        const value = percent(scope.context);
        return {
          dir: typeof scope.props["dir"] === "string" ? scope.props["dir"] : undefined,
          role: "progressbar",
          "aria-valuenow": String(Math.round(value)),
          "aria-valuemin": "0",
          "aria-valuemax": "100",
          "aria-valuetext": `${Math.round(value)}% complete`,
          "data-scope": "steps",
          "data-part": "progress",
          "data-complete": scope.attr(value === 100),
          style: { width: `${value.toFixed(3)}%` },
        };
      },
    },
  },
  slots: {
    item: {
      indexes: (context: StepsContext) => stepIndexes(context.count),
      sig: (scope: SlotLike<{ readonly index: number }>) => {
        const state = itemState(scope.context, slotIndex(scope));
        return [state.current, state.completed, state.incomplete, scope.props["orientation"]].join("|");
      },
      attrs: (scope: SlotLike<{ readonly index: number }>) => {
        const state = itemState(scope.context, slotIndex(scope));
        return {
          dir: typeof scope.props["dir"] === "string" ? scope.props["dir"] : undefined,
          "data-scope": "steps",
          "data-part": "item",
          "aria-current": state.current ? "step" : undefined,
          "data-orientation": scope.props["orientation"],
        };
      },
    },
    trigger: {
      indexes: (context: StepsContext) => stepIndexes(context.count),
      sig: (scope: SlotLike<{ readonly index: number }>) => {
        const state = itemState(scope.context, slotIndex(scope));
        return [state.current, state.completed, state.incomplete, scope.props["linear"], scope.props["orientation"]].join("|");
      },
      attrs: (scope: SlotLike<{ readonly index: number }>) => {
        const index = slotIndex(scope);
        const state = itemState(scope.context, index);
        return {
          id: scope.id("trigger", index),
          role: "tab",
          type: "button",
          dir: typeof scope.props["dir"] === "string" ? scope.props["dir"] : undefined,
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
          onClick: (event: MouseEvent): void => {
            if (event.defaultPrevented) return;
            if (scope.props["linear"] === true) return;
            scope.send({ type: "STEP.SET", value: index });
          },
          onKeydown: (event: KeyboardEvent): void => onTriggerKeydown(scope, event),
        };
      },
    },
    content: {
      indexes: (context: StepsContext) => stepIndexes(context.count),
      sig: (scope: SlotLike<{ readonly index: number }>) => {
        const state = itemState(scope.context, slotIndex(scope));
        return [state.current, scope.props["orientation"]].join("|");
      },
      attrs: (scope: SlotLike<{ readonly index: number }>) => {
        const index = slotIndex(scope);
        const state = itemState(scope.context, index);
        return {
          id: scope.id("content", index),
          role: "tabpanel",
          tabindex: "0",
          dir: typeof scope.props["dir"] === "string" ? scope.props["dir"] : undefined,
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
      indexes: (context: StepsContext) => stepIndexes(context.count),
      sig: (scope: SlotLike<{ readonly index: number }>) => {
        const state = itemState(scope.context, slotIndex(scope));
        return [state.current, state.completed, state.incomplete].join("|");
      },
      attrs: (scope: SlotLike<{ readonly index: number }>) => {
        const state = itemState(scope.context, slotIndex(scope));
        return {
          dir: typeof scope.props["dir"] === "string" ? scope.props["dir"] : undefined,
          "aria-hidden": true,
          "data-scope": "steps",
          "data-part": "indicator",
          "data-complete": scope.attr(state.completed),
          "data-current": scope.attr(state.current),
          "data-incomplete": scope.attr(state.incomplete),
        };
      },
    },
    separator: {
      indexes: (context: StepsContext) => stepIndexes(context.count),
      sig: (scope: SlotLike<{ readonly index: number }>) => {
        const state = itemState(scope.context, slotIndex(scope));
        return [state.current, state.completed, state.incomplete, scope.props["orientation"]].join("|");
      },
      attrs: (scope: SlotLike<{ readonly index: number }>) => {
        const state = itemState(scope.context, slotIndex(scope));
        return {
          dir: typeof scope.props["dir"] === "string" ? scope.props["dir"] : undefined,
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
    setStep: { event: (args: readonly unknown[]) => { const v = args[0]; return { type: "STEP.SET", value: typeof v === "number" ? Math.trunc(v) : 0 }; } },
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
      call: (_context: StepsContext, _state: string, args: readonly unknown[], props: Record<string, unknown>) => {
        const rows = parseTitles(props["titles"]);
        const i = args[0];
        return typeof i === "number" ? (rows[Math.trunc(i)] ?? `Step ${Math.trunc(i) + 1}`) : "Step 1";
      },
    },
    getItemState: {
      call: (context: StepsContext, _state: string, args: readonly unknown[]) => {
        const slot = args[0];
        if (typeof slot !== "object" || slot === null || !("index" in slot) || typeof slot.index !== "number") {
          throw new Error("[steps] getItemState requires a {index} slot");
        }
        return itemState(context, slot.index);
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
};

export const steps = defineComponent<StepsContext, StepsEvent, StepsApi>(def);
