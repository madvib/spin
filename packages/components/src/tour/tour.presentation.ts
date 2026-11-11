import {
  type ApiOf,
  ariaHidden,
  type ComponentDef,
  defineComponent,
  type ViewFor,
} from "@spinjs/components/runtime";
import { tour as tourMachine } from "./tour.machine.ts";
import type { TourArgs, TourContext, TourState } from "./tour.state.ts";
import type { TourEvents } from "./tour.events.ts";
import type { TourDismissChange, TourStepChange } from "./tour.events.ts";
import type { TourStepRecord } from "./tour.state.ts";

export type {
  TourArgs,
  TourDismissChange,
  TourState,
  TourStepChange,
  TourStepRecord,
};

/**
 * Tour definition: the DOM contract as data. The machine owns the modes
 * (inactive/resolving/scrolling/active) and the step index; this file maps
 * props to channels, parts to attribute bags, and commands to sends.
 */

type ScopeLike = ViewFor<TourContext, TourEvents, TourState>;

const runningState = (state: string): boolean =>
  state === "resolving" || state === "scrolling" || state === "active";

/** The lookup's budget: two seconds, then the target counts as missing. */
const RESOLVE_BUDGET_MS = 2000;
/** The settle wait after a scroll, before the spotlight activates. */
const SCROLL_SETTLE_MS = 150;

/** The target's box, padded: the spotlight's own geometry. */
const measure = (
  el: HTMLElement,
  padding: number,
): TourContext["spotlight"] => {
  const rect = el.getBoundingClientRect();
  return {
    x: rect.left - padding,
    y: rect.top - padding,
    w: rect.width + padding * 2,
    h: rect.height + padding * 2,
  };
};

const resolveAndScroll = (
  send: (event: { readonly type: string } & Record<string, unknown>) => void,
  target: string,
  spotlightPadding: number,
): void => {
  const deadline = Date.now() + RESOLVE_BUDGET_MS;
  if (target === "") {
    const w = typeof window === "undefined" ? 0 : window.innerWidth;
    const h = typeof window === "undefined" ? 0 : window.innerHeight;
    const cardW = Math.min(320, w * 0.9);
    const cardH = 160;
    send({
      type: "SPOTLIGHT.SET",
      x: (w - cardW) / 2,
      y: (h - cardH) / 2,
      w: cardW,
      h: cardH,
    });
    send({ type: "TARGET.RESOLVED" });
    send({ type: "SCROLL.END" });
    return;
  }
  const attempt = (): void => {
    const el = typeof document === "undefined"
      ? null
      : document.querySelector(target);
    if (el instanceof HTMLElement) {
      const geo = measure(el, spotlightPadding);
      send({ type: "SPOTLIGHT.SET", x: geo.x, y: geo.y, w: geo.w, h: geo.h });
      send({ type: "TARGET.RESOLVED" });
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      setTimeout(() => {
        const settled = measure(el, spotlightPadding);
        send({
          type: "SPOTLIGHT.SET",
          x: settled.x,
          y: settled.y,
          w: settled.w,
          h: settled.h,
        });
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

export const def = {
  name: "tour",
  machine: (args: TourArgs, authored) => tourMachine(args, authored),
  start: "inactive",
  settled: ({ event, after, props, send }) => {
    void props;
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
    const padding = context.spotlightPadding;
    resolveAndScroll(send, step.target, padding);
  },
  parts: {
    root: {
      attrs: (scope: ScopeLike) => ({
        "data-state": runningState(scope.state) ? "running" : "closed",
      }),
    },
    backdrop: {
      attrs: (scope: ScopeLike) => ({
        ...ariaHidden(true),
        "data-state": runningState(scope.state) ? "open" : "closed",
      }),
    },
    spotlight: {
      attrs: (scope: ScopeLike) => {
        const geo = scope.context.spotlight;
        const ctx = scope.context;
        const step = ctx.steps[ctx.step] ?? null;
        const dialog = step !== null && step.target === "";
        const open = runningState(scope.state) && !dialog;
        return {
          ...ariaHidden(true),
          "data-state": open ? "open" : "closed",
          hidden: !open,
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
      attrs: (scope: ScopeLike) => {
        const geo = scope.context.spotlight;
        return {
          "data-state": scope.state === "active"
            ? "active"
            : runningState(scope.state)
            ? "running"
            : "closed",
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
      attrs: (scope: ScopeLike) => {
        const ctx = scope.context;
        const step = ctx.steps[ctx.step] ?? null;
        return {
          role: "dialog",
          "aria-label": step === null ? ctx.label : step.title,
          "data-state": scope.state === "active" ? "open" : "closed",
          hidden: !runningState(scope.state),
        };
      },
    },
    title: {
      attrs: (_scope: ScopeLike) => ({}),
    },
    description: {
      attrs: (_scope: ScopeLike) => ({}),
    },
    progressText: {
      id: "progress",
      attrs: (scope: ScopeLike) => {
        const ctx = scope.context;
        return {
          text: `${ctx.step + 1} of ${ctx.steps.length}`,
        };
      },
    },
    startTrigger: {
      id: "start",
      attrs: (scope: ScopeLike) => ({
        "aria-label": "Start tour",
        onClick: (): void => scope.send({ type: "START" }),
      }),
    },
    prevTrigger: {
      id: "prev",
      attrs: (scope: ScopeLike) => ({
        "aria-label": "Previous step",
        hidden: scope.context.step <= 0,
        onClick: (): void => scope.send({ type: "STEP.PREV" }),
      }),
    },
    nextTrigger: {
      id: "next",
      attrs: (scope: ScopeLike) => ({
        "aria-label": "Next step",
        onClick: (): void => scope.send({ type: "STEP.NEXT" }),
      }),
    },
    dismissTrigger: {
      id: "dismiss",
      attrs: (scope: ScopeLike) => ({
        "aria-label": "End tour",
        onClick: (): void => scope.send({ type: "DISMISS" }),
      }),
    },
    skipTrigger: {
      id: "skip",
      attrs: (scope: ScopeLike) => ({
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
    setStep: {
      event: ([step]: [step: number]) => ({ type: "STEP.SET", step }),
    },
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
      call: (context: TourContext) => {
        const ctx = context;
        const step = ctx.steps[ctx.step] ?? null;
        const holders = {
          title: step === null ? ctx.label : step.title,
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
        if (
          states === undefined || runningState(states.was) ||
          !runningState(states.is)
        ) return null;
        void event;
        return { step: after.step };
      },
    },
    "step-change": {
      prop: "onStepChange",
      watch: () => [],
      detail: () => ({ step: -1 }),
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
        if (
          states === undefined || !runningState(states.was) ||
          runningState(states.is)
        ) return null;
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
} satisfies ComponentDef<
  TourContext,
  TourEvents,
  Record<string, unknown>,
  TourArgs,
  TourState
>;

export type TourApi = ApiOf<typeof def>;
export const tour = defineComponent<
  TourContext,
  TourEvents,
  TourApi,
  TourArgs,
  TourState
>(def);
