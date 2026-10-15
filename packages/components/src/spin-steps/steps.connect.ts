import { dataAttr } from "../spin-select/select.shared.ts";
import {
  hasNextStep,
  hasPrevStep,
  isCompleted,
  itemState,
  percent,
  type StepsContext,
  type StepsItemState,
} from "./steps.machine.ts";

/**
 * Steps connect: the DOM contract and the reflexes the parts carry.
 *
 * What the machine owns stays there: the step index, the count, the
 * navigation gating. The validators (`isStepValid`, `isStepSkippable`) are
 * host functions — they cannot cross the scope channel, so the bridge
 * attaches them to each navigation event and the machine's guards read
 * them off the event. Everything else here is bags: the tablist semantics,
 * the roving trigger, the progress geometry.
 */

export interface StepsConnectProps {
  readonly dir: "ltr" | "rtl";
  readonly orientation: "horizontal" | "vertical";
  readonly linear: boolean;
  readonly label: string;
  readonly titles: readonly string[];
}

export interface StepsItemSlotProps {
  readonly index: number;
}

/** Zag's api methods, narrowed to the command surface the element exposes. */
export interface StepsCommands {
  goToNextStep(): void;
  goToPrevStep(): void;
  resetStep(): void;
  setStep(value: number): void;
}

export interface StepsApi extends StepsCommands {
  readonly value: number;
  readonly count: number;
  readonly percent: number;
  readonly hasNextStep: boolean;
  readonly hasPrevStep: boolean;
  readonly completed: boolean;
  /** The item indexes, for the recipe's iteration. */
  getItems(): readonly number[];
  getItemTitle(index: number): string;
  getItemState(slot: StepsItemSlotProps): StepsItemState;
  getRootProps(): Record<string, unknown>;
  getListProps(): Record<string, unknown>;
  getItemProps(slot: StepsItemSlotProps): Record<string, unknown>;
  getTriggerProps(slot: StepsItemSlotProps): Record<string, unknown>;
  getContentProps(slot: StepsItemSlotProps): Record<string, unknown>;
  getIndicatorProps(slot: StepsItemSlotProps): Record<string, unknown>;
  getSeparatorProps(slot: StepsItemSlotProps): Record<string, unknown>;
  getNextTriggerProps(): Record<string, unknown>;
  getPrevTriggerProps(): Record<string, unknown>;
  getProgressProps(): Record<string, unknown>;
}

/** The service the connect reads: the fork's, narrowed to what it needs. */
export interface StepsService {
  readonly context: StepsContext;
  /** The machine's state: always idle. */
  readonly state: string;
  send(event: { type: string } & Record<string, unknown>): void;
}

export interface BagMemo {
  sig: string;
  bag: Record<string, unknown>;
}

/** A bag cached until the signature of the fields it reads moves. One memo
 * holds the single bag of one part (there is one root, one list, one
 * progress per element), so a single slot is the whole cache. */
function memo(): (
  sig: string,
  build: () => Record<string, unknown>,
) => Record<string, unknown> {
  let sig = "";
  let bag: Record<string, unknown> | undefined;
  return (next, build) => {
    if (bag !== undefined && sig === next) return bag;
    sig = next;
    bag = build();
    return bag;
  };
}

/** Items are stable slots, so the memo dies with the slot it came from. */
function keyed<K extends object>(
  store: WeakMap<K, BagMemo>,
  owner: K,
  sig: string,
  build: () => Record<string, unknown>,
): Record<string, unknown> {
  const hit = store.get(owner);
  if (hit !== undefined && hit.sig === sig) return hit.bag;
  const bag = build();
  store.set(owner, { sig, bag });
  return bag;
}

export function connectSteps(
  service: StepsService,
  readProps: () => StepsConnectProps,
  id: string,
): StepsApi {
  // Live accessor, never a snapshot: the fork replaces the context object
  // on every assign, so a destructured copy would freeze the first read.
  const ctx = (): StepsContext => service.context;
  const send = service.send;
  const rootId = `steps:${id}`;
  const listId = `steps:${id}:list`;
  const triggerId = (index: number): string => `steps:${id}:trigger:${index}`;
  const contentId = (index: number): string => `steps:${id}:content:${index}`;

  const rootBag = memo();
  const listBag = memo();
  const itemBags = new WeakMap<{ index: number }, BagMemo>();
  const triggerBags = new WeakMap<{ index: number }, BagMemo>();
  const contentBags = new WeakMap<{ index: number }, BagMemo>();
  const indicatorBags = new WeakMap<{ index: number }, BagMemo>();
  const separatorBags = new WeakMap<{ index: number }, BagMemo>();
  const nextTriggerBag = memo();
  const prevTriggerBag = memo();
  const progressBag = memo();

  /** Stable index-array identity: the recipe's `for` re-stamps rows when
   * the source identity moves (the slider's focus-loss lesson). */
  const indexes = (() => {
    let count = -1;
    let cached: readonly number[] = [];
    return () => {
      if (ctx().count !== count) {
        count = ctx().count;
        cached = Array.from({ length: count }, (_, index) => index);
      }
      return cached;
    };
  })();

  return {
    get value() {
      return ctx().step;
    },
    get count() {
      return ctx().count;
    },
    get percent() {
      return percent(ctx());
    },
    get hasNextStep() {
      return hasNextStep(ctx());
    },
    get hasPrevStep() {
      return hasPrevStep(ctx());
    },
    get completed() {
      return isCompleted(ctx());
    },
    goToNextStep: () => {
      send({ type: "STEP.NEXT" });
    },
    goToPrevStep: () => {
      send({ type: "STEP.PREV" });
    },
    resetStep: () => {
      send({ type: "STEP.RESET" });
    },
    setStep: (value: number) => {
      send({ type: "STEP.SET", value });
    },
    getItems: () => indexes(),
    getItemTitle: (index: number) => readProps().titles[index] ?? `Step ${index + 1}`,
    getItemState: (slot: StepsItemSlotProps) => itemState(ctx(), slot.index),
    getRootProps: () => {
      const props = readProps();
      return rootBag([props.orientation, props.dir, percent(ctx())].join("|"), () => ({
        id: rootId,
        dir: props.dir,
        "data-scope": "steps",
        "data-part": "root",
        "data-orientation": props.orientation,
        style: { "--steps-percent": `${percent(ctx())}%` },
      }));
    },
    getListProps: () => {
      const props = readProps();
      const items = indexes();
      return listBag([props.orientation, props.dir, items.length].join("|"), () => ({
        id: listId,
        dir: props.dir,
        role: "tablist",
        "aria-owns": items.map((index) => triggerId(index)).join(" "),
        "aria-orientation": props.orientation,
        "data-scope": "steps",
        "data-part": "list",
        "data-orientation": props.orientation,
      }));
    },
    getItemProps: (slot: StepsItemSlotProps) => {
      const props = readProps();
      const state = itemState(ctx(), slot.index);
      return keyed(
        itemBags,
        slot,
        [state.current, state.completed, state.incomplete, props.orientation].join("|"),
        () => ({
          dir: props.dir,
          "data-scope": "steps",
          "data-part": "item",
          "aria-current": state.current ? "step" : undefined,
          "data-orientation": props.orientation,
        }),
      );
    },
    getTriggerProps: (slot: StepsItemSlotProps) => {
      const props = readProps();
      const state = itemState(ctx(), slot.index);
      return keyed(
        triggerBags,
        slot,
        [state.current, state.completed, state.incomplete, props.linear, props.orientation].join("|"),
        () => ({
          id: triggerId(slot.index),
          role: "tab",
          type: "button",
          dir: props.dir,
          tabindex: !props.linear || state.current ? "0" : "-1",
          "aria-selected": state.current ? "true" : "false",
          "aria-controls": contentId(slot.index),
          "data-scope": "steps",
          "data-part": "trigger",
          "data-state": state.current ? "open" : "closed",
          "data-orientation": props.orientation,
          "data-complete": dataAttr(state.completed),
          "data-current": dataAttr(state.current),
          "data-incomplete": dataAttr(state.incomplete),
          onClick: (event: MouseEvent) => {
            if (event.defaultPrevented) return;
            if (props.linear) return;
            send({ type: "STEP.SET", value: slot.index });
          },
        }),
      );
    },
    getContentProps: (slot: StepsItemSlotProps) => {
      const props = readProps();
      const state = itemState(ctx(), slot.index);
      return keyed(
        contentBags,
        slot,
        [state.current, props.orientation].join("|"),
        () => ({
          id: contentId(slot.index),
          role: "tabpanel",
          tabindex: "0",
          dir: props.dir,
          hidden: state.current ? undefined : true,
          "data-scope": "steps",
          "data-part": "content",
          "data-state": state.current ? "open" : "closed",
          "data-orientation": props.orientation,
          "aria-labelledby": triggerId(slot.index),
        }),
      );
    },
    getIndicatorProps: (slot: StepsItemSlotProps) => {
      const props = readProps();
      const state = itemState(ctx(), slot.index);
      return keyed(
        indicatorBags,
        slot,
        [state.current, state.completed, state.incomplete].join("|"),
        () => ({
          dir: props.dir,
          "aria-hidden": "true",
          "data-scope": "steps",
          "data-part": "indicator",
          "data-complete": dataAttr(state.completed),
          "data-current": dataAttr(state.current),
          "data-incomplete": dataAttr(state.incomplete),
        }),
      );
    },
    getSeparatorProps: (slot: StepsItemSlotProps) => {
      const props = readProps();
      const state = itemState(ctx(), slot.index);
      return keyed(
        separatorBags,
        slot,
        [state.current, state.completed, state.incomplete, props.orientation].join("|"),
        () => ({
          dir: props.dir,
          "data-scope": "steps",
          "data-part": "separator",
          "data-orientation": props.orientation,
          "data-complete": dataAttr(state.completed),
          "data-current": dataAttr(state.current),
          "data-incomplete": dataAttr(state.incomplete),
        }),
      );
    },
    getNextTriggerProps: () => {
      const props = readProps();
      const enabled = hasNextStep(ctx());
      return nextTriggerBag([enabled].join("|"), () => ({
        dir: props.dir,
        type: "button",
        "data-scope": "steps",
        "data-part": "next-trigger",
        disabled: enabled ? undefined : true,
        onClick: (event: MouseEvent) => {
          if (event.defaultPrevented) return;
          send({ type: "STEP.NEXT" });
        },
      }));
    },
    getPrevTriggerProps: () => {
      const props = readProps();
      const enabled = hasPrevStep(ctx());
      return prevTriggerBag([enabled].join("|"), () => ({
        dir: props.dir,
        type: "button",
        "data-scope": "steps",
        "data-part": "prev-trigger",
        disabled: enabled ? undefined : true,
        onClick: (event: MouseEvent) => {
          if (event.defaultPrevented) return;
          send({ type: "STEP.PREV" });
        },
      }));
    },
    getProgressProps: () => {
      const props = readProps();
      const value = percent(ctx());
      return progressBag([value].join("|"), () => ({
        dir: props.dir,
        role: "progressbar",
        "aria-valuenow": String(Math.round(value)),
        "aria-valuemin": "0",
        "aria-valuemax": "100",
        "aria-valuetext": `${Math.round(value)}% complete`,
        "data-scope": "steps",
        "data-part": "progress",
        "data-complete": dataAttr(value === 100),
        style: { "--steps-progress": `${value}%` },
      }));
    },
  };
}
