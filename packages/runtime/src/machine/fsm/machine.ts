/**
 * The state machine core: a config-first FSM, forked from @xstate/fsm 2.1.0
 * (MIT, © Stately, https://github.com/statelyai/xstate).
 *
 * The machine is HEADLESS: state, transitions, and its own arguments. It
 * knows nothing about props, markup, or the DOM. The shape it is heading
 * toward — the arguments as the props, the signal-backed context, the
 * restricted `<script>` scope — is specified in `.agents/specs/`.
 *
 * Why fork rather than depend: the package is correct, tiny, MIT, and the
 * last stable was published in 2023 — a frozen base is a solid foundation
 * and a poor dependency. This fork adapts it to this runtime's needs and
 * keeps the config shape agents and the studio know:
 *
 *   const machine = createMachine({
 *     initial: "idle",
 *     context: { value: [] },
 *     states: {
 *       idle: { on: {
 *         TOGGLE: [
 *           { cond: "isOpen", actions: [{ assign: "collapse" }] },
 *           { actions: [{ assign: "expand" }] },
 *         ],
 *       } },
 *     },
 *   }, { conds: {...}, assigns: {...}, actions: {...} });
 *
 * Transition resolution is PURE (`machine.transition`), and `interpret`
 * executes the resolved actions. The delta from upstream, all deliberate:
 *
 * 1. **Named conds and assigns.** `cond: "name"` resolves from
 *    `implementations.conds`; `{ assign: "name" }` from
 *    `implementations.assigns`. Upstream allows only inline functions, which
 *    puts code inside the config — the config is meant to be data for the
 *    studio's visualizer, test derivation, and agent authoring. Assigns are
 *    pure context transforms, so naming them keeps the whole config
 *    serializable with a lookup table of reviewed pure functions beside it.
 * 2. **Signals instead of subscribers.** Upstream's `subscribe` is dropped:
 *    `send` bumps `machineTick`, and consumers read through a `computed`,
 *    matching every other reactive path in this runtime.
 * 3. **No status enum beyond stopped.** Scope disposal owns teardown;
 *    `stop()` is what `dispose()` calls.
 */

import { machineTick } from "../../core/signal.ts";

/** Any event object: a discriminant type plus any payload. */
export type EventObject = { type: string } & Record<string, unknown>;

/** The state a service holds: a value, the context, and the actions to run. */
export interface State<TContext extends object> {
  readonly value: string;
  readonly context: TContext;
  /** Non-assign actions resolved for the transition, awaiting execution. */
  readonly actions: readonly ResolvedAction<TContext>[];
  readonly matches: (value: string) => boolean;
}

interface ResolvedAction<TContext extends object> {
  readonly type: string;
  readonly exec: ((context: TContext, event: EventObject) => void) | undefined;
}

/** A transition target: a state name, or a record with an optional target. */
export type Transition<TContext extends object, TEvent extends EventObject> =
  | string
  | {
      target?: string;
      cond?: string | ((context: TContext, event: TEvent) => boolean);
      actions?: readonly Action<TContext, TEvent>[];
    };

/** What an `actions` entry may be. Plain strings and functions resolve from
 * the implementations; `{ assign: "name" }` is a context write. */
export type Action<TContext extends object, TEvent extends EventObject> =
  | string
  | ((context: TContext, event: TEvent) => void)
  | { readonly assign: string };

export interface Implementations<TContext extends object, TEvent extends EventObject> {
  /** Named conds referenced by `cond: "name"`. */
  readonly conds?: Record<string, (context: TContext, event: TEvent) => boolean>;
  /** Named pure context transforms referenced by `{ assign: "name" }`. */
  readonly assigns?: Record<string, (context: TContext, event: TEvent) => Partial<TContext>>;
  /** Named side-effect actions referenced by bare strings. */
  readonly actions?: Record<string, (context: TContext, event: TEvent) => void>;
}

export interface Config<TContext extends object, TEvent extends EventObject> {
  readonly id?: string;
  readonly initial: string;
  readonly context?: TContext;
  /** Root-level handlers: candidates in every state. State-level handlers
   * for the same event shadow these; everything else falls through here,
   * which states "this event works everywhere" once instead of duplicating
   * it across states. */
  readonly on?: Readonly<Record<string, readonly Transition<TContext, TEvent>[] | Transition<TContext, TEvent>>>;
  readonly states: Readonly<
    Record<
      string,
      {
        readonly entry?: readonly Action<TContext, TEvent>[];
        readonly exit?: readonly Action<TContext, TEvent>[];
        readonly on?: Readonly<Record<string, readonly Transition<TContext, TEvent>[] | Transition<TContext, TEvent>>>;
      }
    >
  >;
}

export interface Machine<TContext extends object, TEvent extends EventObject> {
  readonly config: Config<TContext, TEvent>;
  /** The implementations table, so `interpret`'s start() can fold entry
   * actions when reseeding, and a component can read the machine's own
   * tables. */
  readonly implementations: Implementations<TContext, TEvent>;
  readonly initialState: State<TContext>;
  transition(state: string | State<TContext>, event: TEvent["type"] | TEvent): State<TContext>;
}

export interface Service<TContext extends object, TEvent extends EventObject> {
  send(event: TEvent["type"] | TEvent): void;
  /**
   * Replace part of the context, the way a transition's assigns do: the
   * context object is replaced, so subscribers see it. The seed uses
   * this — it lands AFTER the entry actions, so a seed wins over an
   * entry (Zag seeds the value, the entry clears the highlight).
   */
  setContext(patch: Partial<TContext>): void;
  /** Start (or restart) at an optional state, running that state's entry
   * actions. This is how `defaultOpen`-style seeds work: the service's
   * first state is not always the config's `initial`. */
  start(state?: string | State<TContext>): Service<TContext, TEvent>;
  stop(): Service<TContext, TEvent>;
  readonly state: State<TContext>;
  readonly stopped: boolean;
}

const INIT = { type: "xstate.init" } as const;

function toArray<T>(value: readonly T[] | T | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? [...value] : [value as T];
}

function toEvent(event: string | { type: string } & Record<string, unknown>): { type: string } & Record<string, unknown> {
  return typeof event === "string" ? { type: event } : event;
}

function stateOf<TContext extends object>(value: string, context: TContext): State<TContext> {
  return { value, context, actions: [], matches: (v) => v === value };
}

/**
 * Resolve the implementation for an action entry. `{ assign }` entries are
 * NOT returned as actions — they are context writes, applied during the fold
 * below, so `state.actions` only ever holds side effects.
 */
function resolveAction<TContext extends object, TEvent extends EventObject>(
  entry: Action<TContext, TEvent>,
  impl: Implementations<TContext, TEvent>,
): ResolvedAction<TContext> {
  if (typeof entry === "string") {
    const fn = impl.actions?.[entry];
    return { type: entry, exec: fn ? (context, event) => fn(context, event as TEvent) : undefined };
  }
  if (typeof entry === "function") {
    return { type: entry.name || "anonymous", exec: (context, event) => entry(context, event as TEvent) };
  }
  // `{ assign: "name" }` — resolved by the caller during folding; this branch
  // is never returned as an action. See `fold` below.
  return { type: (entry as { assign: string }).assign, exec: undefined };
}

interface FoldResult<TContext extends object> {
  readonly actions: ResolvedAction<TContext>[];
  readonly context: TContext;
  readonly assigned: boolean;
}

/** Fold assign entries into the context; collect the rest as actions. */
function fold<TContext extends object, TEvent extends EventObject>(
  entries: readonly Action<TContext, TEvent>[],
  startContext: TContext,
  event: TEvent,
  impl: Implementations<TContext, TEvent>,
): FoldResult<TContext> {
  let context = startContext;
  let assigned = false;
  const actions: ResolvedAction<TContext>[] = [];
  for (const entry of entries) {
    if (typeof entry === "object" && entry !== null && "assign" in entry) {
      const name = entry.assign;
      const assigner = impl.assigns?.[name];
      if (!assigner) throw new Error(`[spin] no assign implementation "${name}"`);
      context = { ...context, ...assigner(context, event) };
      assigned = true;
      continue;
    }
    actions.push(resolveAction(entry, impl));
  }
  return { actions, context, assigned };
}

function resolveCond<TContext extends object, TEvent extends EventObject>(
  cond: string | ((context: TContext, event: TEvent) => boolean) | undefined,
  context: TContext,
  event: TEvent,
  impl: Implementations<TContext, TEvent>,
): boolean {
  if (cond === undefined) return true;
  const fn = typeof cond === "string" ? impl.conds?.[cond] : cond;
  if (typeof cond === "string" && !fn) {
    throw new Error(`[spin] no cond implementation "${cond}"`);
  }
  return (fn as (context: TContext, event: TEvent) => boolean)(context, event);
}

/**
 * The machine: one call, one object.
 *
 * The config says what the machine IS (its context, its states, its
 * transitions). The assigns and the guards say what it DOES, each bound
 * to the event it answers. The table keys are the names the config
 * refers to, so a name cannot drift from its implementation.
 */
export interface MachineSpec<TContext extends object, TEvent extends EventObject> {
  readonly id?: string;
  /** The machine's own defaults. No prop reaches this: a machine does
   * not know what a host is. */
  readonly context: TContext;
  readonly initial: string;
  readonly on?: Readonly<
    Record<string, readonly Transition<TContext, TEvent>[] | Transition<TContext, TEvent>>
  >;
  readonly states: Readonly<
    Record<
      string,
      {
        readonly entry?: readonly Action<TContext, TEvent>[];
        readonly exit?: readonly Action<TContext, TEvent>[];
        readonly on?: Readonly<
          Record<string, readonly Transition<TContext, TEvent>[] | Transition<TContext, TEvent>>
        >;
      }
    >
  >;
  /** The context transforms, referenced by name from the config. */
  readonly assigns?: Readonly<Record<string, (context: TContext, event: TEvent) => Partial<TContext>>>;
  /** The guards, referenced by name from the config. */
  readonly conds?: Readonly<Record<string, (context: TContext, event: TEvent) => boolean>>;
  /** The side-effect actions, referenced by name. */
  readonly actions?: Readonly<Record<string, (context: TContext, event: TEvent) => void>>;
}

export function createMachine<TContext extends object, TEvent extends EventObject>(
  spec: MachineSpec<TContext, TEvent>,
): Machine<TContext, TEvent> {
  const config: Config<TContext, TEvent> = {
    ...(spec.id === undefined ? {} : { id: spec.id }),
    initial: spec.initial,
    context: spec.context,
    ...(spec.on === undefined ? {} : { on: spec.on }),
    states: spec.states,
  };
  const implementations: Implementations<TContext, TEvent> = {
    ...(spec.conds === undefined
      ? {}
      : {
        conds: { ...spec.conds },
      }),
    ...(spec.assigns === undefined
      ? {}
      : {
        assigns: { ...spec.assigns },
      }),
    ...(spec.actions === undefined ? {} : { actions: spec.actions }),
  };
  const initial = fold(
    toArray(config.states[config.initial]?.entry),
    (config.context ?? ({} as TContext)),
    INIT as unknown as TEvent,
    implementations,
  );

  return {
    config,
    implementations,
    initialState: {
      value: config.initial,
      actions: initial.actions,
      context: initial.context,
      matches: (v) => v === config.initial,
    },
    transition(stateOrValue, eventOrType): State<TContext> {
      const event = toEvent(eventOrType);
      const from =
        typeof stateOrValue === "string"
          ? stateOf(stateOrValue, (config.context ?? ({} as TContext)))
          : stateOrValue;
      const current = from.value;
      const ctx = from.context;
      const stateDef = config.states[current];
      // No early return on a missing `on`: a state that declares nothing
      // still inherits the root tier. `stateDef` itself stays optional —
      // root handlers must work even for a state absent from the map.
      const candidates = [
        ...toArray(stateDef?.on?.[event.type]),
        ...toArray(stateDef?.on?.["*"]),
        // Root handlers are the fallback tier: a state-level handler for the
        // same event shadows them by ordering. One place states "this event
        // works everywhere" instead of a copy in every state.
        ...toArray(config.on?.[event.type]),
        ...toArray(config.on?.["*"]),
      ].filter((c) => c !== undefined);
      if (candidates.length === 0) return stateOf(current, ctx);
      for (const candidate of candidates) {
        const { target, cond, actions = [] } =
          typeof candidate === "string" ? { target: candidate, cond: undefined, actions: [] } : candidate;
        if (!resolveCond(cond, ctx, event as TEvent, implementations)) continue;

        // Internal transition (no target): only this transition's actions
        // run — no exit, no entry, no state change.
        if (target === undefined) {
          const folded = fold(actions, ctx, event as TEvent, implementations);
            return {
            value: current,
            context: folded.context,
            actions: folded.actions,
            matches: (v) => v === current,
          };
        }
        const nextDef = config.states[target];
        const chain = [
          ...toArray(stateDef?.exit).filter((a) => a !== undefined),
          ...actions,
          ...toArray(nextDef?.entry).filter((a) => a !== undefined),
        ];
        const folded = fold(chain, ctx, event as TEvent, implementations);
        return {
          value: target,
          context: folded.context,
          actions: folded.actions,
          matches: (v) => v === target,
        };
      }
      return stateOf(current, ctx);
    },
  };
}

export function interpret<TContext extends object, TEvent extends EventObject>(
  machine: Machine<TContext, TEvent>,
): Service<TContext, TEvent> {
  let current = machine.initialState;
  let stopped = false;
  // The same implementations table createMachine closed over, needed to
  // resolve entry actions when start() reseeds.
  const impl = machine.implementations ?? {};

  const runActions = (state: State<TContext>, event: EventObject): void => {
    for (const action of state.actions) action.exec?.(state.context, event);
  };

  const service: Service<TContext, TEvent> = {
    setContext(patch) {
      current = { ...current, context: { ...current.context, ...patch } };
      machineTick(machineTick() + 1);
    },
    send(event) {
      if (stopped) return;
      const normalized = toEvent(event);
      const next = machine.transition(current, normalized as unknown as TEvent["type"]);
      current = next;
      runActions(next, normalized);
      // The reactivity seam: consumers read this service through a
      // `computed` that subscribes to the tick, as every binding does.
      machineTick(machineTick() + 1);
    },
    start(next) {
      stopped = false;
      if (next !== undefined) {
        const value = typeof next === "string" ? next : next.value;
        const context = typeof next === "string" ? machine.initialState.context : next.context;
        const entry = fold(
          toArray(machine.config.states[value]?.entry),
          context,
          INIT as unknown as TEvent,
          impl,
        );
        current = {
          value,
          context: entry.context,
          actions: entry.actions,
          matches: (v) => v === value,
        };
      } else {
        current = machine.initialState;
      }
      runActions(current, INIT as unknown as TEvent);
      return service;
    },
    stop() {
      stopped = true;
      return service;
    },
    get state() {
      return current;
    },
    get stopped() {
      return stopped;
    },
  };
  return service;
}
