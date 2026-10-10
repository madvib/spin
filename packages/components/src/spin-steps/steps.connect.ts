/**
 * Steps connect: the DOM contract for the stepper's ten parts.
 *
 * The machine owns one number; everything a part renders is derived from it
 * here, exactly as Zag's `computed` block does. Per-index bags are memoized
 * in a map keyed by step index (the connect outlives any machine move, and
 * a fresh bag per read would detach and re-attach every listener each move).
 *
 * The one continuous value — completion, a percentage — leaves as the
 * `--steps-percent` custom property on the root (the sanctioned geometry
 * channel); the markup's utility classes decide what the var feeds.
 *
 * Two conventions, both Zag's: part ids are `steps:<element id>:<part>`, and
 * the trigger/content pair are wired with `aria-controls`/`aria-labelledby`.
 */

import type { StepsContext, StepValidity } from "./steps.machine.ts";

export interface StepsFsmConnectProps {
  readonly count: number;
  readonly linear: boolean;
  readonly orientation: "horizontal" | "vertical";
  /** Per-step captions. Zag leaves the trigger's children to the host; the
   * recipe has no host-authored children, so the captions are a prop. */
  readonly labels: readonly string[];
  /** The two behavioral host predicates, read live off the root: a host may
   * write them at any time, and Zag reads them on every call. */
  readonly isValid: StepValidity;
  readonly isSkippable: StepValidity;
}

/** Zag's ItemState: the per-step derivation the api hands out. */
export interface StepsItemState {
  readonly index: number;
  readonly triggerId: string;
  readonly contentId: string;
  readonly current: boolean;
  readonly completed: boolean;
  readonly incomplete: boolean;
  readonly first: boolean;
  readonly last: boolean;
  readonly skippable: boolean;
  /** Zag's lazy validity read — evaluated only when the host calls it. */
  readonly isValid: () => boolean;
}

/** The element's imperative surface — Zag's api methods. Every one is a send. */
export interface StepsCommands {
  setStep(step: number): void;
  goToNextStep(): void;
  goToPrevStep(): void;
  resetStep(): void;
}

export interface StepsFsmApi extends StepsCommands {
  readonly value: number;
  readonly count: number;
  readonly percent: number;
  readonly hasNextStep: boolean;
  readonly hasPrevStep: boolean;
  readonly isCompleted: boolean;
  readonly linear: boolean;
  readonly orientation: "horizontal" | "vertical";
  isStepValid(index: number): boolean;
  isStepSkippable(index: number): boolean;
  /** The step indices, in order — what the markup's `for` iterates. */
  getSteps(): readonly number[];
  /** The caption the host authored for a step, or the empty string. */
  getLabel(index: number): string;
  getItemState(index: number): StepsItemState;
  getRootProps(): Record<string, unknown>;
  getListProps(): Record<string, unknown>;
  getItemProps(index: number): Record<string, unknown>;
  getTriggerProps(index: number): Record<string, unknown>;
  getIndicatorProps(index: number): Record<string, unknown>;
  getSeparatorProps(index: number): Record<string, unknown>;
  getContentProps(index: number): Record<string, unknown>;
  getNextTriggerProps(): Record<string, unknown>;
  getPrevTriggerProps(): Record<string, unknown>;
  getProgressProps(): Record<string, unknown>;
  /** The recipe's reset control. Zag has no part for it — its `resetStep` is
   * an api command the host wires to whatever it likes — but this markup
   * owns the DOM, so the control gets a bag like any other. */
  getResetTriggerProps(): Record<string, unknown>;
}

type Send = (event: { type: string } & Record<string, unknown>) => void;

const NAMESPACE = "steps";

export interface StepsService {
  readonly context: StepsContext;
  send(event: { type: string } & Record<string, unknown>): void;
}

/** The behavioural props, read live: a snapshot would freeze the first
 * read's values inside the handlers the connect caches. */
export type ReadStepsProps = () => StepsFsmConnectProps;

/** A bag cached until the signature of the fields it reads moves. */
interface BagMemo {
  sig: string;
  bag: Record<string, unknown>;
}

/** Re-read on every machine move, so a fresh bag per read would detach and
 * re-attach every listener each move. Only a signature change rebuilds it. */
function cached(): (sig: string, build: () => Record<string, unknown>) => Record<string, unknown> {
  let sig = "";
  let bag: Record<string, unknown> | undefined;
  return (next: string, build: () => Record<string, unknown>): Record<string, unknown> => {
    if (bag !== undefined && sig === next) return bag;
    sig = next;
    bag = build();
    return bag;
  };
}

/** Zag's dataAttr: present when the condition holds, absent otherwise. */
function dataAttr(value: boolean): string | undefined {
  return value ? "" : undefined;
}

export function connectRobotSteps(
  service: StepsService,
  readProps: ReadStepsProps,
  id: string,
): StepsFsmApi {
  const ownerId = id.startsWith(`${NAMESPACE}:`) ? id : `${NAMESPACE}:${id}`;
  const listId = `${ownerId}:list`;
  const triggerId = (index: number): string => `${ownerId}:trigger:${index}`;
  const contentId = (index: number): string => `${ownerId}:content:${index}`;
  const prevTriggerId = `${ownerId}:prev-trigger`;
  const nextTriggerId = `${ownerId}:next-trigger`;
  const progressId = `${ownerId}:progress`;
  const resetTriggerId = `${ownerId}:reset-trigger`;
  const ctx = (): StepsContext => service.context;
  const send: Send = (event): void => {
    service.send(event);
  };

  // ---- derived values ----------------------------------------------------

  /** Zag's computed percent: step over count, unbounded by the ends. */
  const percent = (): number => (ctx().step / ctx().count) * 100;

  /** Memoized on the count: the `for` directive iterates this array, and a
   * fresh one per read would re-key every cell on each machine move. */
  let stepsSource = -1;
  let stepsCache: readonly number[] = [];
  const steps = (): readonly number[] => {
    const total = ctx().count;
    if (stepsSource === total) return stepsCache;
    stepsSource = total;
    const built: number[] = [];
    for (let index = 0; index < total; index += 1) built.push(index);
    stepsCache = built;
    return built;
  };

  /** Zag's getItemState, with the lazy validity read kept lazy. Both
   * predicates are read live off the root through the connect props, exactly
   * as Zag reads its props on every call. */
  const getItemState = (index: number): StepsItemState => {
    const step = ctx().step;
    const total = ctx().count;
    const props = readProps();
    return {
      index,
      triggerId: triggerId(index),
      contentId: contentId(index),
      current: index === step,
      completed: index < step,
      incomplete: index > step,
      first: index === 0,
      last: index === total - 1,
      skippable: props.isSkippable(index),
      isValid: (): boolean => props.isValid(index),
    };
  };

  // ---- cached bags -------------------------------------------------------

  const rootBag = cached();
  const listBag = cached();
  const prevBag = cached();
  const nextBag = cached();
  const progressBag = cached();
  const resetBag = cached();
  /** Keyed by step index: a count change retires nothing, it just stops
   * being read, and the maps are per-connect, not per-move. */
  const itemBags = new Map<number, BagMemo>();
  const triggerBags = new Map<number, BagMemo>();
  const indicatorBags = new Map<number, BagMemo>();
  const separatorBags = new Map<number, BagMemo>();
  const contentBags = new Map<number, BagMemo>();

  const keyed = (
    store: Map<number, BagMemo>,
    index: number,
    sig: string,
    build: () => Record<string, unknown>,
  ): Record<string, unknown> => {
    const hit = store.get(index);
    if (hit !== undefined && hit.sig === sig) return hit.bag;
    const bag = build();
    store.set(index, { sig, bag });
    return bag;
  };

  /** The phase flags every step part keys on, encoded for a bag signature. */
  const phase = (index: number): string =>
    `${index < ctx().step}\u0000${index === ctx().step}\u0000${index > ctx().step}`;

  /**
   * Trigger handlers, built once per index: they read the behavioural props
   * live, so a cached closure is never a stale snapshot of one. A handler
   * rebuilt on every bag rebuild would be detached and re-attached on every
   * machine move, because a binding re-reads the api each move.
   */
  const triggerHandlers = new Map<number, (event: MouseEvent) => void>();
  const handlerFor = (index: number): ((event: MouseEvent) => void) => {
    const hit = triggerHandlers.get(index);
    if (hit !== undefined) return hit;
    const made = (event: MouseEvent): void => {
      if (event.defaultPrevented) return;
      // A linear stepper walks with prev/next only: its triggers are not a
      // navigation surface, so a click is inert even backward.
      if (readProps().linear) return;
      send({ type: "STEP.SET", value: index });
    };
    triggerHandlers.set(index, made);
    return made;
  };

  const onStepControlClick = (event: MouseEvent, type: "STEP.NEXT" | "STEP.PREV"): void => {
    if (event.defaultPrevented) return;
    send({ type });
  };

  return {
    get value(): number {
      return ctx().step;
    },
    get count(): number {
      return ctx().count;
    },
    get percent(): number {
      return percent();
    },
    get hasNextStep(): boolean {
      return ctx().step < ctx().count;
    },
    get hasPrevStep(): boolean {
      return ctx().step > 0;
    },
    get isCompleted(): boolean {
      return ctx().step === ctx().count;
    },
    get linear(): boolean {
      return readProps().linear;
    },
    get orientation(): "horizontal" | "vertical" {
      return readProps().orientation;
    },
    isStepValid: (index: number): boolean => readProps().isValid(index),
    isStepSkippable: (index: number): boolean => readProps().isSkippable(index),
    getSteps: steps,
    getLabel: (index: number): string => readProps().labels[index] ?? "",
    getItemState,
    getRootProps: () => {
      const props = readProps();
      return rootBag(`${props.orientation}\u0000${percent()}`, () => ({
        id: ownerId,
        "data-orientation": props.orientation,
        style: { "--steps-percent": `${percent()}%` },
      }));
    },
    getListProps: () => {
      const props = readProps();
      return listBag(`${props.orientation}\u0000${ctx().count}`, () => ({
        id: listId,
        role: "tablist",
        "aria-owns": steps().map((index) => triggerId(index)).join(" "),
        "aria-orientation": props.orientation,
        "data-orientation": props.orientation,
      }));
    },
    getItemProps: (index: number) => {
      const props = readProps();
      const state = getItemState(index);
      return keyed(
        itemBags,
        index,
        `${state.current}\u0000${state.skippable}\u0000${props.orientation}`,
        () => ({
          "aria-current": state.current ? "step" : undefined,
          "data-orientation": props.orientation,
          "data-skippable": dataAttr(state.skippable),
        }),
      );
    },
    getTriggerProps: (index: number) => {
      const props = readProps();
      const state = getItemState(index);
      return keyed(
        triggerBags,
        index,
        [phase(index), props.linear, props.orientation, state.skippable].join("\u0000"),
        () => ({
          id: state.triggerId,
          role: "tab",
          type: "button",
          // A linear stepper is one tab stop: the current step alone.
          tabIndex: !props.linear || state.current ? 0 : -1,
          "aria-selected": state.current,
          "aria-controls": state.contentId,
          "data-state": state.current ? "open" : "closed",
          "data-orientation": props.orientation,
          "data-skippable": dataAttr(state.skippable),
          "data-complete": dataAttr(state.completed),
          "data-current": dataAttr(state.current),
          "data-incomplete": dataAttr(state.incomplete),
          onClick: handlerFor(index),
        }),
      );
    },
    getIndicatorProps: (index: number) =>
      keyed(indicatorBags, index, phase(index), () => {
        const state = getItemState(index);
        return {
          "aria-hidden": true,
          "data-complete": dataAttr(state.completed),
          "data-current": dataAttr(state.current),
          "data-incomplete": dataAttr(state.incomplete),
        };
      }),
    getSeparatorProps: (index: number) => {
      const props = readProps();
      const state = getItemState(index);
      return keyed(
        separatorBags,
        index,
        `${phase(index)}\u0000${props.orientation}\u0000${state.last}`,
        () => ({
          "aria-hidden": true,
          "data-orientation": props.orientation,
          // The recipe renders one separator per step; the last step's rail
          // has nothing to connect to, so it hides itself.
          hidden: state.last,
          "data-complete": dataAttr(state.completed),
          "data-current": dataAttr(state.current),
          "data-incomplete": dataAttr(state.incomplete),
        }),
      );
    },
    getContentProps: (index: number) => {
      const props = readProps();
      const state = getItemState(index);
      return keyed(contentBags, index, `${state.current}\u0000${props.orientation}`, () => ({
        id: state.contentId,
        role: "tabpanel",
        tabIndex: 0,
        hidden: !state.current,
        "data-state": state.current ? "open" : "closed",
        "data-orientation": props.orientation,
        "aria-labelledby": state.triggerId,
      }));
    },
    getNextTriggerProps: () => {
      const props = readProps();
      const enabled = ctx().step < ctx().count;
      return nextBag(`${props.orientation}\u0000${enabled}`, () => ({
        id: nextTriggerId,
        type: "button",
        disabled: !enabled,
        onClick: (event: MouseEvent) => onStepControlClick(event, "STEP.NEXT"),
      }));
    },
    getPrevTriggerProps: () => {
      const props = readProps();
      const enabled = ctx().step > 0;
      return prevBag(`${props.orientation}\u0000${enabled}`, () => ({
        id: prevTriggerId,
        type: "button",
        disabled: !enabled,
        onClick: (event: MouseEvent) => onStepControlClick(event, "STEP.PREV"),
      }));
    },
    getProgressProps: () => {
      const props = readProps();
      const value = percent();
      return progressBag(`${props.orientation}\u0000${value}`, () => ({
        id: progressId,
        role: "progressbar",
        "aria-valuenow": value,
        "aria-valuemin": 0,
        "aria-valuemax": 100,
        "aria-valuetext": `${value}% complete`,
        "data-complete": dataAttr(value === 100),
      }));
    },
    getResetTriggerProps: () => {
      const props = readProps();
      return resetBag(props.orientation, () => ({
        id: resetTriggerId,
        type: "button",
        onClick: (event: MouseEvent) => {
          if (event.defaultPrevented) return;
          send({ type: "STEP.RESET" });
        },
      }));
    },
    setStep: (step: number): void => send({ type: "STEP.SET", value: step }),
    goToNextStep: (): void => send({ type: "STEP.NEXT" }),
    goToPrevStep: (): void => send({ type: "STEP.PREV" }),
    resetStep: (): void => send({ type: "STEP.RESET" }),
  };
}
