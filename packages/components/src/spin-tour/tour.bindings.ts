import {
  ariaHidden,
  dataAttr,
  defineComponent,
  factAttrs,
  type ComponentDef,
  type PartScope,
  type SlotScope,
} from "@spin/runtime";
import {
  tour as tourMachine,
  type TourArgs,
  type TourContext,
  type TourDismissChange,
  type TourEvents,
  type TourStepChange,
  type TourSpotlight,
  type TourStepRecord,
} from "./tour.machine.ts";

/**
 * Tour definition: the DOM contract as data. The machine owns the modes
 * (inactive/resolving/scrolling/active) and the step index; this file maps
 * props to channels, parts to attribute bags, and commands to sends.
 */

export type { TourDismissChange, TourStepChange, TourStepRecord };

export interface TourApi {
  readonly step: number;
  readonly steps: readonly TourStepRecord[];
  readonly running: boolean;
  readonly active: boolean;
  /** The machine's phase: inactive, resolving, scrolling, or active. */
  readonly state: string;
  start(): void;
  next(): void;
  prev(): void;
  dismiss(): void;
  skip(): void;
  setStep(step: number): void;
  notifyTargetResolved(): void;
  notifyTargetNotFound(): void;
  notifyScrollEnd(): void;
  getRootProps(): Record<string, unknown>;
  getSpotlightProps(): Record<string, unknown>;
  getContentProps(): Record<string, unknown>;
  getTitleProps(): Record<string, unknown>;
  getDescriptionProps(): Record<string, unknown>;
  getPositionerProps(): Record<string, unknown>;
  getProgressTextProps(): Record<string, unknown>;
  /**
   * The step's texts as one row. A compiled `{row.title}` closes over the
   * render-time row, so the row carries getters over stable holders the
   * step rewrites.
   */
  getTextRows(): readonly { readonly key: string; readonly title: string; readonly description: string; readonly progress: string }[];
  getPrevTriggerProps(): Record<string, unknown>;
  getNextTriggerProps(): Record<string, unknown>;
  getDismissTriggerProps(): Record<string, unknown>;
  getSkipTriggerProps(): Record<string, unknown>;
  getBackdropProps(): Record<string, unknown>;
}

interface ScopeLike extends PartScope<unknown, TourContext> {}

interface SlotLike<R> extends SlotScope<R, TourContext> {}

const textOf = (props: Record<string, unknown>): string => {
  const label: unknown = props["label"];
  return typeof label === "string" ? label : "";
};

/** The lookup's budget: two seconds, then the target counts as missing. */
const RESOLVE_BUDGET_MS = 2000;
/** The settle wait after a scroll, before the spotlight activates. */
const SCROLL_SETTLE_MS = 150;

const runningState = (state: string): boolean =>
  state === "resolving" || state === "scrolling" || state === "active";

/** The target's box, padded: the spotlight's own geometry. */
const measure = (el: HTMLElement, padding: number): TourSpotlight => {
  const rect = el.getBoundingClientRect();
  return {
    x: rect.left - padding,
    y: rect.top - padding,
    w: rect.width + padding * 2,
    h: rect.height + padding * 2,
  };
};

/**
 * The target lookup: one timer per check, capped, then NOT_FOUND. The
 * scroll reports SCROLL.END once the target settles.
 */
const resolveAndScroll = (
  send: (event: { readonly type: string } & Record<string, unknown>) => void,
  target: string,
  spotlightPadding: number,
): void => {
  const deadline = Date.now() + RESOLVE_BUDGET_MS;
  // A rAF poll throttles in a hidden tab (a frames-based budget would
  // never run out), so the retries are timers against a wall clock.
  if (target === "") {
    const w = typeof window === "undefined" ? 0 : window.innerWidth;
    const h = typeof window === "undefined" ? 0 : window.innerHeight;
    const cardW = Math.min(320, w * 0.9);
    const cardH = 160;
    send({ type: "SPOTLIGHT.SET", x: (w - cardW) / 2, y: (h - cardH) / 2, w: cardW, h: cardH });
    send({ type: "TARGET.RESOLVED" });
    send({ type: "SCROLL.END" });
    return;
  }
  const attempt = (): void => {
    const el = typeof document === "undefined" ? null : document.querySelector(target);
    if (el instanceof HTMLElement) {
      // Measure before the send: the bags carry the target's rect.
      const geo = measure(el, spotlightPadding);
      send({ type: "SPOTLIGHT.SET", x: geo.x, y: geo.y, w: geo.w, h: geo.h });
      send({ type: "TARGET.RESOLVED" });
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      setTimeout(() => {
        const settled = measure(el, spotlightPadding);
        send({ type: "SPOTLIGHT.SET", x: settled.x, y: settled.y, w: settled.w, h: settled.h });
        send({ type: "SCROLL.END" });
      }, SCROLL_SETTLE_MS);
      return;
    }
    if (Date.now() >= deadline) {
      send({ type: "TARGET.NOT_FOUND" });
      return;
    }
    setTimeout(attempt, 50);
  };
  attempt();
};

/** The component's public state: the names the markup may key on. */
export const facts = {
  disabled: (scope: ScopeLike) => scope.props["disabled"] === true,
};

const def: ComponentDef<TourContext, TourEvents> = {
  name: "tour",
  machine: (props, authored) => tourMachine(props as TourArgs, authored),
  // Every command that enters the resolving phase drives the lookup and
  // scroll right after its send.
  settled: ({ event, after, props, send }) => {
    if (
      event.type !== "START" &&
      event.type !== "STEP.NEXT" &&
      event.type !== "STEP.PREV" &&
      event.type !== "STEP.SET"
    ) {
      return;
    }
    if (after.state !== "resolving") return;
    const context = after.context;
    const step = context.steps[context.step] ?? null;
    if (step === null) return;
    const padding = typeof props["spotlightPadding"] === "number" ? props["spotlightPadding"] : 8;
    resolveAndScroll(send, step.target, padding);
  },
  parts: {
    root: {
      attrs: (scope) => ({
        id: scope.id(""),
        "data-state": runningState(scope.state) ? "running" : "closed",
        ...factAttrs(scope, facts, "disabled"),
      }),
    },
    backdrop: {
      attrs: (scope) => ({
        id: scope.id("backdrop"),
          "data-scope": "tour",
          "data-part": "backdrop",
        ...ariaHidden(true),
        "data-state": runningState(scope.state) ? "open" : "closed",
        ...factAttrs(scope, facts, "disabled"),
      }),
    },
    spotlight: {
      attrs: (scope) => {
        const geo = scope.context.spotlight;
        const ctx = scope.context;
        const step = ctx.steps[ctx.step] ?? null;
        const dialog = step !== null && step.target === "";
        const open = runningState(scope.state) && !dialog;
        return {
          id: scope.id("spotlight"),
            "data-scope": "tour",
            "data-part": "spotlight",
          ...ariaHidden(true),
          "data-state": open ? "open" : "closed",
          hidden: !open,
          // The spotlight's own box: the target's rect, padded. The
          // recipe names no var — the bag carries the geometry.
          style: {
            left: `${geo.x}px`,
            top: `${geo.y}px`,
            width: `${geo.w}px`,
            height: `${geo.h}px`,
          },
        };
      },
    },
    positioner: {
      attrs: (scope) => {
        const geo = scope.context.spotlight;
        return {
          id: scope.id("positioner"),
            "data-scope": "tour",
            "data-part": "positioner",
          "data-state": scope.state === "active" ? "active" : runningState(scope.state) ? "running" : "closed",
          // The card's own box: it stands under the spotlight it frames.
          // The recipe names no var — the bag carries the geometry.
          style: {
            left: `${geo.x}px`,
            top: `calc(${geo.y}px + ${geo.h}px + 0.5rem)`,
          },
          "use:dismissable": {
            onOutside: (): void => scope.send({ type: "DISMISS" }),
            onEscape: (): void => scope.send({ type: "DISMISS" }),
          },
        };
      },
    },
    content: {
      attrs: (scope) => {
        const ctx = scope.context;
        const step = ctx.steps[ctx.step] ?? null;
        return {
          id: scope.id("content"),
            "data-scope": "tour",
            "data-part": "content",
          role: "dialog",
          "aria-label": step === null ? scope.props["label"] : step.title,
          "data-state": scope.state === "active" ? "open" : "closed",
          hidden: !runningState(scope.state),
        };
      },
    },
    title: {
      attrs: (scope) => ({
        id: scope.id("title"),
          "data-scope": "tour",
          "data-part": "title",
      }),
    },
    description: {
      attrs: (scope) => ({
        id: scope.id("description"),
          "data-scope": "tour",
          "data-part": "description",
      }),
    },
    progressText: {
      id: "progress",
      attrs: (scope) => {
        const ctx = scope.context;
        return {
          id: scope.id("progressText"),
            "data-scope": "tour",
            "data-part": "progress-text",
          text: `${ctx.step + 1} of ${ctx.steps.length}`,
        };
      },
    },
    prevTrigger: {
      id: "prev",
      attrs: (scope) => ({
        id: scope.id("prevTrigger"),
          "data-scope": "tour",
          "data-part": "prev-trigger",
        "aria-label": "Previous step",
        hidden: scope.context.step <= 0,
        onClick: (): void => scope.send({ type: "STEP.PREV" }),
      }),
    },
    nextTrigger: {
      id: "next",
      attrs: (scope) => ({
        id: scope.id("nextTrigger"),
          "data-scope": "tour",
          "data-part": "next-trigger",
        "aria-label": "Next step",
        onClick: (): void => scope.send({ type: "STEP.NEXT" }),
      }),
    },
    dismissTrigger: {
      id: "dismiss",
      attrs: (scope) => ({
        id: scope.id("dismissTrigger"),
          "data-scope": "tour",
          "data-part": "dismiss-trigger",
        "aria-label": "End tour",
        onClick: (): void => scope.send({ type: "DISMISS" }),
      }),
    },
    skipTrigger: {
      id: "skip",
      attrs: (scope) => ({
        id: scope.id("skipTrigger"),
          "data-scope": "tour",
          "data-part": "skip-trigger",
        "aria-label": "Skip tour",
        onClick: (): void => scope.send({ type: "SKIP" }),
      }),
    },
  },
  commands: {
    start: { event: () => ({ type: "START" }) },
    next: { event: () => ({ type: "STEP.NEXT" }) },
    prev: { event: () => ({ type: "STEP.PREV" }) },
    dismiss: { event: () => ({ type: "DISMISS" }) },
    skip: { event: () => ({ type: "SKIP" }) },
    setStep: { event: (args) => ({ type: "STEP.SET", step: typeof args[0] === "number" ? args[0] : -1 }) },
    notifyTargetResolved: { event: () => ({ type: "TARGET.RESOLVED" }) },
    notifyTargetNotFound: { event: () => ({ type: "TARGET.NOT_FOUND" }) },
    notifyScrollEnd: { event: () => ({ type: "SCROLL.END" }) },
  },
  readers: {
    step: { read: (context) => context.step },
    steps: { read: (context) => context.steps },
    running: { read: (_context, state) => runningState(state) },
    active: { read: (_context, state) => state === "active" },
    state: { read: (_context, state) => state },
  },
  methods: {
    getTextRows: {
      call: (context: TourContext, _state, _args, props) => {
        const ctx = context;
        const step = ctx.steps[ctx.step] ?? null;
        // Stable holders the row's getters read; the step rewrites them.
        const holders = {
          title: step === null ? textOf(props) : step.title,
          description: step === null ? "" : step.description,
          progress: `${ctx.step + 1} of ${ctx.steps.length}`,
        };
        return [{
          key: "step",
          get title(): string {
            return holders.title;
          },
          get description(): string {
            return holders.description;
          },
          get progress(): string {
            return holders.progress;
          },
        }];
      },
    },
  },
  events: {
    start: {
      prop: "onStart",
      watch: () => [],
      detail: () => ({ step: -1 }),
      select: (event, _before, after: TourContext, states) => {
        if (states === undefined || runningState(states.was) || !runningState(states.is)) return null;
        void event;
        return { step: after.step };
      },
    },
    "step-change": {
      prop: "onStepChange",
      watch: () => [],
      detail: () => ({ step: -1 }),
      // A real step move only: the closing reset (step -1) reports through
      // dismiss/complete, and reporting it here would overwrite that reason.
      select: (event, before: TourContext, after: TourContext) => {
        void event;
        if (after.step === before.step || after.step < 0) return null;
        return {
          step: after.step,
          stepId: after.steps[after.step]?.id ?? "",
        };
      },
    },
    dismiss: {
      prop: "onDismiss",
      watch: () => [],
      detail: () => ({ reason: "dismiss" }),
      select: (event, before: TourContext, after: TourContext, states) => {
        if (states === undefined || !runningState(states.was) || runningState(states.is)) return null;
        const reason = event.type === "SKIP"
          ? "skip"
          : event.type === "TARGET.NOT_FOUND"
          ? "not-found"
          : states.was === "active" &&
              before.step === after.steps.length - 1 &&
              event.type === "DISMISS"
          ? "complete"
          : "dismiss";
        return { reason, step: before.step };
      },
    },
    complete: {
      prop: "onComplete",
      watch: () => [],
      detail: () => ({}),
      select: (event, before: TourContext, after: TourContext, states) => {
        if (event.type !== "DISMISS" || states?.was !== "active") return null;
        if (before.step !== after.steps.length - 1) return null;
        return {};
      },
    },
  },
};

export const tour = defineComponent<TourContext, TourEvents, TourApi>(def);
