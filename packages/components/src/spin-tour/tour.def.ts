import {
  dataAttr,
  defineComponent,
  type ComponentDef,
  type PartScope as ScopeLike,
} from "@spin/runtime";
import type { AnchorGeometry } from "@spin/runtime/actions";
import {
  config,
  implementations,
  type TourContext,
  type TourDismissChange,
  type TourEvent,
  type TourStepChange,
  type TourStepRecord,
} from "./tour.machine.ts";

/**
 * Tour definition: the DOM contract as data. The machine owns the modes
 * (inactive/resolving/scrolling/active) and the step index; this file maps
 * props to channels, parts to attribute bags, commands to sends, and
 * start/step/dismiss/complete transitions to their events.
 *
 * Everything that needs the DOM lives here:
 *
 *   - the target lookup — a poll (one timer per check, capped) that
 *     reports RESOLVED when the step's selector exists in the document and
 *     NOT_FOUND when it never does. Every command that can enter the
 *     resolving phase kicks it from `settled`, gated on the resulting
 *     state — the poll resolves the new target, scrolls it in, and reports
 *     SCROLL.END to wake the spotlight;
 *   - the scroll — `scrollIntoView` on the target, reporting SCROLL.END
 *     once it settles;
 *   - the spotlight — the target's rect through the geometry channel as
 *     custom properties, so the mask and the card are utilities;
 *   - the dismissable wiring — Escape and an outside press end the run.
 *
 * The overlay renders inside the root; the target itself is the host's
 * element elsewhere on the page.
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
  /** The target lookup's reports; the connect's poll and the host share them. */
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
   * The step's texts as one row, for the recipe's bindings. A compiled
   * `{row.title}` closes over the render-time row, so the row carries
   * getters over stable holders the step rewrites — the same live-row
   * pattern the date-input's segments use.
   */
  getTextRows(): readonly { readonly key: string; readonly title: string; readonly description: string; readonly progress: string }[];
  getPrevTriggerProps(): Record<string, unknown>;
  getNextTriggerProps(): Record<string, unknown>;
  getDismissTriggerProps(): Record<string, unknown>;
  getSkipTriggerProps(): Record<string, unknown>;
  getBackdropProps(): Record<string, unknown>;
}

/** The JSON transport for the step collection. */
const parseSteps = (raw: unknown): readonly TourStepRecord[] | null => {
  if (typeof raw !== "string" || raw.length === 0) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed)) return null;
  const steps: TourStepRecord[] = [];
  for (const entry of parsed) {
    if (typeof entry !== "object" || entry === null) continue;
    const bag = entry as Record<string, unknown>;
    const id = bag["id"];
    const target = bag["target"];
    const title = bag["title"];
    const description = bag["description"];
    if (typeof id !== "string") continue;
    steps.push({
      id,
      // A step without a target is a dialog: the card stands alone,
      // centered, with no spotlight. Tark's welcome step has none.
      target: typeof target === "string" ? target : "",
      title: typeof title === "string" ? title : "",
      description: typeof description === "string" ? description : "",
    });
  }
  return steps;
};

type Ctx = TourContext;

const asCtx = (context: Record<string, unknown>): Ctx => context as unknown as Ctx;

/** The lookup's budget: two seconds, then the target counts as missing. */
const RESOLVE_BUDGET_MS = 2000;
/** The settle wait after a scroll, before the spotlight activates. */
const SCROLL_SETTLE_MS = 150;

/** Per-bridge view memory, keyed by the root element the bridge owns. */
interface TourViewState {
  spotlight: AnchorGeometry;
  title: string;
  description: string;
  progress: string;
}
const viewByRoot = new WeakMap<Element, TourViewState>();
const viewOf = (root: Element): TourViewState => {
  let view = viewByRoot.get(root);
  if (view === undefined) {
    view = {
      spotlight: { x: 0, y: 0, w: 0, h: 0, placement: "bottom" },
      title: "",
      description: "",
      progress: "",
    };
    viewByRoot.set(root, view);
  }
  return view;
};

const runningState = (state: string): boolean =>
  state === "resolving" || state === "scrolling" || state === "active";

/**
 * The target lookup: one timer per check, capped, then NOT_FOUND. The
 * scroll reports SCROLL.END once the target settles (or immediately when
 * it needs no scrolling).
 */
const resolveAndScroll = (
  root: Element,
  send: (event: { readonly type: string } & Record<string, unknown>) => void,
  target: string,
  spotlightPadding: number,
): void => {
  viewOf(root);
  const deadline = Date.now() + RESOLVE_BUDGET_MS;
  // The first attempt is synchronous: the target is usually there. A
  // rAF poll throttles in a hidden tab (a frames-based budget would
  // never run out), so the retries are timers against a wall clock.
  if (target === "") {
    const w = typeof window === "undefined" ? 0 : window.innerWidth;
    const h = typeof window === "undefined" ? 0 : window.innerHeight;
    const cardW = Math.min(320, w * 0.9);
    const cardH = 160;
    viewOf(root).spotlight = {
      x: (w - cardW) / 2,
      y: (h - cardH) / 2,
      w: cardW,
      h: cardH,
      placement: "bottom",
    };
    send({ type: "TARGET.RESOLVED" });
    send({ type: "SCROLL.END" });
    return;
  }
  const attempt = (): void => {
    const el = typeof document === "undefined" ? null : document.querySelector(target);
    if (el instanceof HTMLElement) {
      // Resolve first (the machine scrolls), measuring the target so the
      // bags carry its rect, then scroll and report the end.
      measure(root, el, spotlightPadding);
      send({ type: "TARGET.RESOLVED" });
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      setTimeout(() => {
        measure(root, el, spotlightPadding);
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

/** The target's rect, reported through the spotlight view state. */
const measure = (root: Element, el: HTMLElement, padding: number): void => {
  const rect = el.getBoundingClientRect();
  viewOf(root).spotlight = {
    x: rect.left - padding,
    y: rect.top - padding,
    w: rect.width + padding * 2,
    h: rect.height + padding * 2,
    placement: "bottom",
  };
};

const def: ComponentDef<TourContext, TourEvent> = {
  name: "tour",
  config,
  implementations,
  seed: (props, authored) => {
    // Already parsed by the `steps` channel: a seeded `steps` beats
    // `defaultSteps`, exactly as the bridge read the authored collection
    // first.
    const steps = (props["steps"] as readonly TourStepRecord[]).length > 0
      ? (props["steps"] as readonly TourStepRecord[])
      : (props["defaultSteps"] as readonly TourStepRecord[]);
    const raw = authored("step") ? props["step"] : undefined;
    return {
      steps,
      step: typeof raw === "number" && raw >= 0 && raw < steps.length ? raw : -1,
      previousStep: -1,
    };
  },
  // Every command that can enter the resolving phase drives the lookup
  // and scroll right after its send: the poll resolves the new target,
  // scrolls it in, and reports SCROLL.END to wake the spotlight.
  settled: ({ event, after, props, root, send }) => {
    if (
      event.type !== "START" &&
      event.type !== "STEP.NEXT" &&
      event.type !== "STEP.PREV" &&
      event.type !== "STEP.SET"
    ) {
      return;
    }
    const state = (after as { readonly state?: string }).state;
    if (state !== "resolving") return;
    const context = (after as { readonly context?: Ctx }).context;
    if (context === undefined) return;
    const node = root();
    const step = context.steps[context.step] ?? null;
    if (step === null) return;
    const padding = typeof props["spotlightPadding"] === "number" ? props["spotlightPadding"] : 8;
    resolveAndScroll(node, send, step.target, padding);
  },
  channels: {
    steps: { parse: (raw) => parseSteps(raw) ?? [] },
    defaultSteps: { parse: (raw) => parseSteps(raw) ?? [] },
    step: {
      controlled: true,
      parse: (raw) => (typeof raw === "number" ? raw : -1),
      event: (value: number) => ({ type: "STEP.SET", step: value }),
    },
    label: { parse: (raw) => (typeof raw === "string" ? raw : "") },
    spotlightPadding: { parse: (raw) => (typeof raw === "number" ? raw : 8) },
    disabled: { parse: (raw) => raw === true },
  },
  parts: {
    root: {
      sig: (scope) => [`${runningState(scope.state)}`, `${scope.props["disabled"] === true}`].join(" "),
      attrs: (scope) => ({
        id: scope.id(""),
        "data-state": runningState(scope.state) ? "running" : "closed",
        "data-disabled": dataAttr(scope.props["disabled"] === true),
      }),
    },
    backdrop: {
      sig: (scope) => {
        const geo = viewOf(scope.root()).spotlight;
        return [`${runningState(scope.state)}`, `${scope.props["disabled"] === true}`, geo.x, geo.y, geo.w, geo.h].join(" ");
      },
      attrs: (scope) => {
        const geo = viewOf(scope.root()).spotlight;
        return {
          id: scope.id("backdrop"),
            "data-scope": "tour",
            "data-part": "backdrop",
          "aria-hidden": true,
          "data-state": runningState(scope.state) ? "open" : "closed",
          "data-disabled": dataAttr(scope.props["disabled"] === true),
          style: {
            "--tour-x": `${geo.x}px`,
            "--tour-y": `${geo.y}px`,
            "--tour-w": `${geo.w}px`,
            "--tour-h": `${geo.h}px`,
          },
        };
      },
    },
    spotlight: {
      sig: (scope) => {
        const geo = viewOf(scope.root()).spotlight;
        const ctx = asCtx(scope.context);
        const step = ctx.steps[ctx.step] ?? null;
        return [`${runningState(scope.state)}`, step?.target ?? "", geo.x, geo.y, geo.w, geo.h].join(" ");
      },
      attrs: (scope) => {
        const geo = viewOf(scope.root()).spotlight;
        const ctx = asCtx(scope.context);
        const step = ctx.steps[ctx.step] ?? null;
        const dialog = step !== null && step.target === "";
        const open = runningState(scope.state) && !dialog;
        return {
          id: scope.id("spotlight"),
            "data-scope": "tour",
            "data-part": "spotlight",
          "aria-hidden": true,
          "data-state": open ? "open" : "closed",
          hidden: !open,
          style: {
            "--tour-x": `${geo.x}px`,
            "--tour-y": `${geo.y}px`,
            "--tour-w": `${geo.w}px`,
            "--tour-h": `${geo.h}px`,
          },
        };
      },
    },
    positioner: {
      sig: (scope) => {
        const geo = viewOf(scope.root()).spotlight;
        return [scope.state, geo.x, geo.y].join(" ");
      },
      attrs: (scope) => {
        const geo = viewOf(scope.root()).spotlight;
        return {
          id: scope.id("positioner"),
            "data-scope": "tour",
            "data-part": "positioner",
          "data-state": scope.state === "active" ? "active" : runningState(scope.state) ? "running" : "closed",
          style: {
            "--tour-x": `${geo.x}px`,
            "--tour-y": `${geo.y}px`,
            "--tour-w": `${geo.w}px`,
            "--tour-h": `${geo.h}px`,
          },
          "use:dismissable": {
            onOutside: (): void => scope.send({ type: "DISMISS" }),
            onEscape: (): void => scope.send({ type: "DISMISS" }),
          },
        };
      },
    },
    content: {
      sig: (scope) => [scope.state, asCtx(scope.context).step].join(" "),
      attrs: (scope) => {
        const ctx = asCtx(scope.context);
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
      sig: (scope) => [`${asCtx(scope.context).step}`].join(" "),
      attrs: (scope) => ({
        id: scope.id("title"),
          "data-scope": "tour",
          "data-part": "title",
      }),
    },
    description: {
      sig: (scope) => [`${asCtx(scope.context).step}`].join(" "),
      attrs: (scope) => ({
        id: scope.id("description"),
          "data-scope": "tour",
          "data-part": "description",
      }),
    },
    progressText: {
      id: "progress",
      sig: (scope) => {
        const ctx = asCtx(scope.context);
        return [`${ctx.step}`, `${ctx.steps.length}`].join(" ");
      },
      attrs: (scope) => {
        const ctx = asCtx(scope.context);
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
      sig: (scope) => [`${asCtx(scope.context).step}`, scope.state].join(" "),
      attrs: (scope) => ({
        id: scope.id("prevTrigger"),
          "data-scope": "tour",
          "data-part": "prev-trigger",
        "aria-label": "Previous step",
        hidden: asCtx(scope.context).step <= 0,
        onClick: (): void => scope.send({ type: "STEP.PREV" }),
      }),
    },
    nextTrigger: {
      id: "next",
      sig: (scope) => {
        const ctx = asCtx(scope.context);
        return [`${ctx.step}`, `${ctx.steps.length}`, scope.state].join(" ");
      },
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
      sig: (scope) => [scope.state].join(" "),
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
      sig: (scope) => [scope.state].join(" "),
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
    setStep: { event: (args) => ({ type: "STEP.SET", step: args[0] as number }) },
    notifyTargetResolved: { event: () => ({ type: "TARGET.RESOLVED" }) },
    notifyTargetNotFound: { event: () => ({ type: "TARGET.NOT_FOUND" }) },
    notifyScrollEnd: { event: () => ({ type: "SCROLL.END" }) },
  },
  readers: {
    step: { read: (context) => asCtx(context).step },
    steps: { read: (context) => asCtx(context).steps },
    running: { read: (_context, state) => runningState(state) },
    active: { read: (_context, state) => state === "active" },
    state: { read: (_context, state) => state },
  },
  methods: {
    getTextRows: {
      call: (context, _state, _args, props, id) => {
        void id;
        const ctx = context as unknown as Ctx;
        const step = ctx.steps[ctx.step] ?? null;
        // Stable holders the row's getters read; the step rewrites them.
        // Keyed per call site is unnecessary — one row, rewritten per read.
        const holders = {
          title: step === null ? (props["label"] as string) : step.title,
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
      detail: (watched) => ({ step: watched[0] as number }),
      select: (event, _before, after, states) => {
        if (states === undefined || runningState(states.was) || !runningState(states.is)) return null;
        void event;
        return { step: (after as unknown as Ctx).step };
      },
    },
    "step-change": {
      prop: "onStepChange",
      watch: () => [],
      detail: (watched) => ({ step: watched[0] as number }),
      // A real step move only: the closing reset (step -1) reports through
      // dismiss/complete, and reporting it here would overwrite that reason
      // with an empty step id.
      select: (event, before, after) => {
        void event;
        const beforeCtx = before as unknown as Ctx;
        const afterCtx = after as unknown as Ctx;
        if (afterCtx.step === beforeCtx.step || afterCtx.step < 0) return null;
        return {
          step: afterCtx.step,
          stepId: afterCtx.steps[afterCtx.step]?.id ?? "",
        };
      },
    },
    dismiss: {
      prop: "onDismiss",
      watch: () => [],
      detail: (watched) => ({ reason: watched[0] as string }),
      select: (event, before, after, states) => {
        if (states === undefined || !runningState(states.was) || runningState(states.is)) return null;
        const beforeCtx = before as unknown as Ctx;
        const afterCtx = after as unknown as Ctx;
        // The run ended: the event that ended it names the reason.
        const reason = event.type === "SKIP"
          ? "skip"
          : event.type === "TARGET.NOT_FOUND"
          ? "not-found"
          : states.was === "active" &&
              beforeCtx.step === afterCtx.steps.length - 1 &&
              event.type === "DISMISS"
          ? "complete"
          : "dismiss";
        return { reason, step: beforeCtx.step };
      },
    },
    complete: {
      prop: "onComplete",
      watch: () => [],
      detail: () => ({}),
      select: (event, before, after, states) => {
        if (event.type !== "DISMISS" || states?.was !== "active") return null;
        const beforeCtx = before as unknown as Ctx;
        const afterCtx = after as unknown as Ctx;
        if (beforeCtx.step !== afterCtx.steps.length - 1) return null;
        return {};
      },
    },
  },
};

export const tour = defineComponent<TourContext, TourEvent, TourApi>(def);
