/**
 * Tour connect: the DOM contract, the spotlight, and the phase reflexes.
 *
 * The machine owns the modes (inactive/resolving/scrolling/active) and
 * the step index. Everything that needs the DOM lives here:
 *
 *   - the target lookup — a poll (one animation frame per check, capped)
 *     that reports RESOLVED when the step's selector exists in the
 *     document and NOT_FOUND when it never does;
 *   - the scroll — `scrollIntoView` on the target, reporting SCROLL.END
 *     once it settles;
 *   - the spotlight — the target's rect through the geometry channel as
 *     custom properties, so the mask and the card are utilities;
 *   - the dismissable wiring — Escape and an outside press end the run.
 *
 * The overlay renders inside the root; the target itself is the host's
 * element elsewhere on the page.
 */

import type { AnchorGeometry } from "@spin/runtime/actions";
import { signal } from "@spin/runtime";
import type {
  TourContext,
  TourEvent,
  TourStepRecord,
} from "./tour.machine.ts";

export interface TourConnectProps {
  readonly label: string;
  /** The spotlight's gap around the target, in pixels. */
  readonly spotlightPadding: number;
  readonly disabled: boolean;
}

export interface TourCommands {
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
}

export interface TourApi extends TourCommands {
  readonly step: number;
  readonly steps: readonly TourStepRecord[];
  readonly running: boolean;
  readonly active: boolean;
  /** The machine's phase: inactive, resolving, scrolling, or active. */
  readonly state: string;
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

export interface TourService {
  readonly context: TourContext;
  readonly state: string;
  send(event: TourEvent): void;
}

export type ReadTourProps = () => TourConnectProps;

export type { TourStepRecord };

const NAMESPACE = "tour";

function dataAttr(value: boolean): string | undefined {
  return value ? "" : undefined;
}

/** The lookup's budget: two seconds, then the target counts as missing. */
const RESOLVE_BUDGET_MS = 2000;
/** The settle wait after a scroll, before the spotlight activates. */
const SCROLL_SETTLE_MS = 150;

export function connectRobotTour(
  service: TourService,
  readProps: ReadTourProps,
  id: string,
): TourApi {
  const ownerId = id.startsWith(`${NAMESPACE}:`) ? id : `${NAMESPACE}:${id}`;

  const ctx = (): TourContext => service.context;
  const props = (): TourConnectProps => readProps();

  const send = (event: TourEvent): void => service.send(event);

  const spotlight = signal<AnchorGeometry>({ x: 0, y: 0, w: 0, h: 0, placement: "bottom" });
  /** The target's rect, reported through the spotlight signal. */
  const measure = (): void => {
    const el = targetEl();
    if (!(el instanceof HTMLElement)) return;
    const rect = el.getBoundingClientRect();
    const pad = props().spotlightPadding;
    spotlight({
      x: rect.left - pad,
      y: rect.top - pad,
      w: rect.width + pad * 2,
      h: rect.height + pad * 2,
      placement: "bottom",
    });
  };

  /** Stable holders the text row's getters read; the step rewrites them. */
  const textHolders = { title: "", description: "", progress: "" };

  const currentStep = (): TourStepRecord | null => ctx().steps[ctx().step] ?? null;

  /** The target element for the current step, or null while unresolved. */
  const targetEl = (): Element | null => {
    const step = currentStep();
    if (step === null) return null;
    return document.querySelector(step.target);
  };

  /**
   * The target lookup: one rAF per check, capped, then NOT_FOUND. The
   * scroll reports SCROLL.END once the target settles (or immediately
   * when it needs no scrolling).
   */
  const resolveAndScroll = (): void => {
    const deadline = Date.now() + RESOLVE_BUDGET_MS;
    // The first attempt is synchronous: the target is usually there. A
    // rAF poll throttles in a hidden tab (a frames-based budget would
    // never run out), so the retries are timers against a wall clock.
    const attempt = (): void => {
      const el = targetEl();
      if (el instanceof HTMLElement) {
        // Resolve first (the machine scrolls), measuring the target so the
        // bags carry its rect, then scroll and report the end.
        measure();
        api.notifyTargetResolved();
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        setTimeout(() => {
          measure();
          api.notifyScrollEnd();
        }, SCROLL_SETTLE_MS);
        return;
      }
      if (Date.now() >= deadline) {
        api.notifyTargetNotFound();
        return;
      }
      setTimeout(attempt, 50);
    };
    attempt();
  };

  const walk = (): { root: Element } => ({ root: document.documentElement });
  void walk;

  const caches = new Map<string, { sig: string; bag: Record<string, unknown> }>();
  const cached = (key: string, sig: string, build: () => Record<string, unknown>): Record<string, unknown> => {
    const hit = caches.get(key);
    if (hit !== undefined && hit.sig === sig) return hit.bag;
    const bag = build();
    caches.set(key, { sig, bag });
    return bag;
  };

  const running = (): boolean =>
    service.state === "resolving" || service.state === "scrolling" || service.state === "active";

  const api: TourApi = {
    get step(): number {
      return ctx().step;
    },
    get steps(): readonly TourStepRecord[] {
      return ctx().steps;
    },
    get running(): boolean {
      return running();
    },
    get active(): boolean {
      return service.state === "active";
    },
    get state(): string {
      return service.state;
    },
    // Every command that can enter the resolving phase drives the lookup
    // and scroll right after its send: the poll resolves the new target,
    // scrolls it in, and reports SCROLL.END to wake the spotlight.
    start: () => {
      send({ type: "START" });
      if (service.state === "resolving") resolveAndScroll();
    },
    next: () => {
      send({ type: "STEP.NEXT" });
      if (service.state === "resolving") resolveAndScroll();
    },
    prev: () => {
      send({ type: "STEP.PREV" });
      if (service.state === "resolving") resolveAndScroll();
    },
    dismiss: () => send({ type: "DISMISS" }),
    skip: () => send({ type: "SKIP" }),
    setStep: (step: number) => {
      send({ type: "STEP.SET", step });
      if (service.state === "resolving") resolveAndScroll();
    },
    notifyTargetResolved: () => send({ type: "TARGET.RESOLVED" }),
    notifyTargetNotFound: () => send({ type: "TARGET.NOT_FOUND" }),
    notifyScrollEnd: () => send({ type: "SCROLL.END" }),
    getRootProps: () =>
      cached("root", `${running()}\u0000${props().disabled}`, () => ({
        id: ownerId,
        "data-state": running() ? "running" : "closed",
        "data-disabled": dataAttr(props().disabled),
      })),
    getBackdropProps: () =>
      cached("backdrop", `${running()}\u0000${props().disabled}`, () => ({
        id: `${ownerId}:backdrop`,
        "aria-hidden": true,
        "data-state": running() ? "open" : "closed",
        "data-disabled": dataAttr(props().disabled),
        style: {
          "--tour-x": `${spotlight().x}px`,
          "--tour-y": `${spotlight().y}px`,
          "--tour-w": `${spotlight().w}px`,
          "--tour-h": `${spotlight().h}px`,
        },
      })),
    getSpotlightProps: () => ({
      id: `${ownerId}:spotlight`,
      "aria-hidden": true,
      "data-state": running() ? "open" : "closed",
      style: {
        "--tour-x": `${spotlight().x}px`,
        "--tour-y": `${spotlight().y}px`,
        "--tour-w": `${spotlight().w}px`,
        "--tour-h": `${spotlight().h}px`,
      },
    }),
    getPositionerProps: () =>
      cached("positioner", `${service.state}\u0000${spotlight().x}\u0000${spotlight().y}`, () => ({
        id: `${ownerId}:positioner`,
        "data-state": service.state === "active" ? "active" : running() ? "running" : "closed",
        style: {
          "--tour-x": `${spotlight().x}px`,
          "--tour-y": `${spotlight().y}px`,
          "--tour-w": `${spotlight().w}px`,
          "--tour-h": `${spotlight().h}px`,
        },
        "use:dismissable": {
          onOutside: () => send({ type: "DISMISS" }),
          onEscape: () => send({ type: "DISMISS" }),
        },
      })),
    getContentProps: () =>
      cached("content", `${service.state}\u0000${ctx().step}`, () => {
        const step = currentStep();
        return {
          id: `${ownerId}:content`,
          role: "dialog",
          "aria-label": step === null ? props().label : step.title,
          "data-state": service.state === "active" ? "open" : "closed",
          hidden: !running(),
        };
      }),
    getTitleProps: () =>
      cached("title", `${ctx().step}`, () => ({
        id: `${ownerId}:title`,
      })),
    getDescriptionProps: () =>
      cached("description", `${ctx().step}`, () => ({
        id: `${ownerId}:description`,
      })),
    getProgressTextProps: () =>
      cached("progress", `${ctx().step}\u0000${ctx().steps.length}`, () => ({
        id: `${ownerId}:progress`,
        text: `${ctx().step + 1} of ${ctx().steps.length}`,
      })),
    getTextRows: () => {
      const step = currentStep();
      textHolders.title = step === null ? props().label : step.title;
      textHolders.description = step === null ? "" : step.description;
      textHolders.progress = `${ctx().step + 1} of ${ctx().steps.length}`;
      return [{
        key: "step",
        get title(): string {
          return textHolders.title;
        },
        get description(): string {
          return textHolders.description;
        },
        get progress(): string {
          return textHolders.progress;
        },
      }];
    },
    getPrevTriggerProps: () =>
      cached("prev", `${ctx().step}\u0000${service.state}`, () => ({
        id: `${ownerId}:prev`,
        "aria-label": "Previous step",
        hidden: ctx().step <= 0,
        onClick: () => api.prev(),
      })),
    getNextTriggerProps: () =>
      cached("next", `${ctx().step}\u0000${ctx().steps.length}\u0000${service.state}`, () => ({
        id: `${ownerId}:next`,
        "aria-label": "Next step",
        onClick: () => api.next(),
      })),
    getDismissTriggerProps: () =>
      cached("dismiss", `${service.state}`, () => ({
        id: `${ownerId}:dismiss`,
        "aria-label": "End tour",
        onClick: () => api.dismiss(),
      })),
    getSkipTriggerProps: () =>
      cached("skip", `${service.state}`, () => ({
        id: `${ownerId}:skip`,
        "aria-label": "Skip tour",
        onClick: () => api.skip(),
      })),
  };

  return api;
}
