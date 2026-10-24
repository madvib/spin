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

/**
 * The machine's events, as a MAP: one entry per event name, carrying that
 * event's payload.
 *
 * The map is the contract with the outside, so the author writes it by hand
 * — and the spec's `on` map is typed over it, so a transition's KEY
 * narrows the event it receives.
 */
export type EventMap = object;

/**
 * The map's keys, as NAMES. A map is an interface, so it has no index
 * signature — the names are extracted, not read off an index.
 */
export type EventNames<TMap extends EventMap> = Extract<keyof TMap, string>;

/**
 * The event a name names: its discriminant, plus the payload the map
 * gives under that name.
 */
export type EventOf<TMap extends EventMap, TName extends EventNames<TMap>> =
  TName extends EventNames<TMap>
    ? { readonly type: TName } & TMap[TName & keyof TMap]
    : never;

/** Every event of a map, as the union a service sends. */
export type EventUnion<TMap extends EventMap> = {
  [TName in EventNames<TMap>]: EventOf<TMap, TName>;
}[EventNames<TMap>];

/** The name of an event of a map. */
export type EventName<TMap extends EventMap> = EventNames<TMap>;

/** The state a service holds: a value, the context, and what it matches. */
export interface State<
  TContext extends object,
  TState extends string = string,
> {
  readonly value: TState;
  readonly context: TContext;
  readonly matches: (value: string) => boolean;
}

/** A transition target: a state name, or a record with an optional target. */
export type Transition<
  TContext extends object,
  TEvent,
  TState extends string = string,
> =
  | TState
  | {
    readonly target?: TState;
    readonly cond?: (context: TContext, event: TEvent) => boolean;
    readonly assign?:
      | Assign<TContext, TEvent>
      | readonly Assign<TContext, TEvent>[];
  };

/** A context write: a pure transform of the context. */
export type Assign<TContext extends object, TEvent> = (
  context: TContext,
  event: TEvent,
) => Partial<TContext>;

/** A context write narrowed to one or more event names of a map. */
export type AssignFor<
  TContext extends object,
  TEventMap extends EventMap,
  TName extends EventNames<TEventMap> = EventNames<TEventMap>,
> = (context: TContext, event: EventOf<TEventMap, TName>) => Partial<TContext>;

/** A transition guard narrowed to one or more event names of a map. */
export type GuardFor<
  TContext extends object,
  TEventMap extends EventMap,
  TName extends EventNames<TEventMap> = EventNames<TEventMap>,
> = (context: TContext, event: EventOf<TEventMap, TName>) => boolean;

/**
 * The transitions of a map: each KEY narrows its own event.
 *
 * The author writes the event map once, and every transition reads its
 * event through the narrowing its key gives.
 */
export type Transitions<
  TContext extends object,
  TEventMap extends EventMap,
  TState extends string = string,
> = {
  readonly [TName in EventNames<TEventMap>]?:
    | Transition<TContext, EventOf<TEventMap, TName>, TState>
    | readonly Transition<TContext, EventOf<TEventMap, TName>, TState>[];
};

/**
 * A state's entry or exit: a context write, or the `{ assign }` form a
 * spec writes when it names a shared body.
 */
export type Entry<TContext extends object, TEvent extends object> =
  | Assign<TContext, TEvent>
  | { readonly assign: Assign<TContext, TEvent> };

export interface Config<
  TContext extends object,
  TEventMap extends EventMap,
  TState extends string = string,
> {
  readonly id?: string;
  readonly initial: TState;
  readonly context?: TContext;
  /** Root-level handlers: candidates in every state. State-level handlers
   * for the same event shadow these; everything else falls through here,
   * which states "this event works everywhere" once instead of duplicating
   * it across states. */
  readonly on?: Transitions<TContext, TEventMap, TState>;
  readonly states: Readonly<
    Record<
      string,
      {
        readonly entry?: readonly Entry<TContext, EventUnion<TEventMap>>[];
        readonly exit?: readonly Entry<TContext, EventUnion<TEventMap>>[];
        readonly on?: Transitions<TContext, TEventMap, TState>;
      }
    >
  >;
}

export type FieldsContract<
  TContext extends object,
  TEventMap extends EventMap,
> =
  & {
    readonly [K in Extract<keyof TContext, string>]?: FieldContract<TEventMap>;
  }
  & Readonly<Record<string, FieldContract<TEventMap>>>;

export interface Machine<
  TContext extends object,
  TEventMap extends EventMap,
  TState extends string = string,
> {
  readonly config: Config<TContext, TEventMap, TState>;
  /** The machine's contract with its hosts: the fields a host may write,
   * and the event each write carries. */
  readonly fields: FieldsContract<TContext, TEventMap>;
  readonly initialState: State<TContext, TState>;
  transition(
    state: TState | State<TContext, TState>,
    event: EventUnion<TEventMap>,
  ): State<TContext, TState>;
}

export interface Service<
  TContext extends object,
  TEventMap extends EventMap,
  TState extends string = string,
> {
  send(event: EventUnion<TEventMap>): void;
  /**
   * Replace part of the context, the way a transition's assigns do: the
   * context object is replaced, so subscribers see it. The seed uses
   * this — it lands AFTER the entry actions, so a seed wins over an
   * entry (the seed writes the value, the entry clears the highlight).
   */
  setContext(patch: Partial<TContext>): void;
  /** Start (or restart) at an optional state, running that state's entry
   * actions. This is how `defaultOpen`-style seeds work: the service's
   * first state is not always the config's `initial`. */
  start(
    state?: TState | State<TContext, TState>,
  ): Service<TContext, TEventMap, TState>;
  stop(): Service<TContext, TEventMap, TState>;
  readonly state: State<TContext, TState>;
  readonly stopped: boolean;
}

const INIT = { type: "xstate.init" } as const;

function toEvent<TEventMap extends EventMap>(
  event: EventUnion<TEventMap>,
): EventUnion<TEventMap> {
  return event;
}

function stateOf<TContext extends object, TState extends string = string>(
  value: TState,
  context: TContext,
): State<TContext, TState> {
  return { value, context, matches: (v) => v === value };
}

/**
 * Whether a value is a list of transitions. `Array.isArray` does not
 * narrow a readonly array, so the test is named.
 */
function isList<T>(value: T | readonly T[]): value is readonly T[] {
  return Array.isArray(value);
}

function toList<T>(value: T | readonly T[]): readonly T[] {
  return isList(value) ? value : [value];
}

/**
 * The event a key names. The guard is sound: the event IS the one its
 * type names, and the check is the one the dispatch already does.
 *
 * Narrowing the event BEFORE the lookup is what keeps the lookup exact:
 * a mapped type's indexed access does not distribute over a union of
 * keys, so `on[event.type]` alone would lose the correlation.
 */
function isEvent<
  TEventMap extends EventMap,
  TName extends EventNames<TEventMap>,
>(
  event: EventUnion<TEventMap>,
  name: TName,
): event is EventOf<TEventMap, TName> {
  return event.type === name;
}

/**
 * The transitions a name names.
 *
 * The lookup is exact because the event is narrowed FIRST: a mapped type's
 * indexed access does not distribute over a union of keys, so
 * `on[event.type]` alone would lose the correlation between the name and
 * the event. After the guard, `event.type` is the one name, and the lookup
 * returns that name's transitions.
 */
function candidatesFor<
  TContext extends object,
  TEventMap extends EventMap,
  TName extends EventNames<TEventMap>,
  TState extends string = string,
>(
  on: Transitions<TContext, TEventMap, TState> | undefined,
  event: EventUnion<TEventMap>,
  name: TName,
): readonly Transition<TContext, EventOf<TEventMap, TName>, TState>[] {
  if (!isEvent(event, name)) return [];
  const found = on?.[event.type];
  if (found === undefined) return [];
  return toList(found);
}

/**
 * Apply a transition's context writes, in order. Each write sees the
 * context the previous one left, so a chain reads what the chain wrote.
 */
function fold<TContext extends object, TEvent extends object>(
  assigns: readonly Entry<TContext, TEvent>[] | undefined,
  startContext: TContext,
  event: TEvent,
): TContext {
  if (assigns === undefined) return startContext;
  let context = startContext;
  for (const entry of assigns) {
    const assign = "assign" in entry ? entry.assign : entry;
    context = { ...context, ...assign(context, event) };
  }
  return context;
}

/**
 * The machine: one call, one object.
 *
 * The spec says what the machine IS (its context, its states, its
 * transitions) and what it DOES (its context writes, its guards) — each
 * bound to the event it answers, by the transition's KEY.
 */
export interface MachineSpec<
  TContext extends object,
  TEventMap extends EventMap,
  TState extends string = string,
> {
  readonly id?: string;
  /** The machine's own defaults. No prop reaches this: a machine does
   * not know what a host is. */
  readonly context: TContext;
  readonly initial: NoInfer<TState>;
  readonly on?: Transitions<TContext, TEventMap, NoInfer<TState>>;
  readonly states: Readonly<
    Record<
      TState,
      {
        readonly entry?: readonly Entry<TContext, EventUnion<TEventMap>>[];
        readonly exit?: readonly Entry<TContext, EventUnion<TEventMap>>[];
        readonly on?: Transitions<TContext, TEventMap, NoInfer<TState>>;
      }
    >
  >;
  /**
   * The machine's contract with its hosts: the context fields a host may
   * write, and the event each write carries.
   *
   * A field with an event is REPORTED: the host's write is an event, the
   * machine decides, and the change reaches the host. A field without one
   * is SILENT: the host's write lands in the field, and nothing reports.
   *
   * The machine owns this map. The element does not restate it, and a
   * host cannot write a field the contract does not name.
   */
  readonly fields?: FieldsContract<TContext, TEventMap>;
}

/**
 * One field of the machine's contract: how a host's write reaches it.
 *
 * - `event` — the write is REPORTED: the host's write is an event, the
 *   machine decides, and the change reaches the host. The machine's
 *   assign shapes the payload.
 * - no `event` — the write is SILENT: it lands in the field, and nothing
 *   reports. The framework shapes it with `parse`.
 * - `parse` — the machine's own shaping of the field, for the silent
 *   path. The same shaping the machine's `initial` applies to the
 *   argument, so a host's write and the start agree.
 */
export interface FieldContract<TEventMap extends EventMap> {
  readonly event?: EventUnion<TEventMap>["type"];
  readonly parse?: (raw: unknown) => unknown;
}

export function createMachine<
  TContext extends object,
  TEventMap extends EventMap,
  TState extends string = string,
>(
  spec: MachineSpec<TContext, TEventMap, TState>,
): Machine<TContext, TEventMap, TState> {
  const config: Config<TContext, TEventMap, TState> = {
    ...(spec.id === undefined ? {} : { id: spec.id }),
    initial: spec.initial,
    context: spec.context,
    ...(spec.on === undefined ? {} : { on: spec.on }),
    states: spec.states,
  };
  const initial = fold(
    config.states[config.initial]?.entry,
    config.context ?? ({} as TContext),
    INIT as unknown as EventUnion<TEventMap>,
  );

  return {
    config,
    fields: spec.fields ?? {},
    initialState: {
      value: config.initial,
      context: initial,
      matches: (v) => v === config.initial,
    },
    transition(stateOrValue, eventOrType): State<TContext, TState> {
      const event = toEvent(eventOrType);
      const from = typeof stateOrValue === "string"
        ? stateOf(stateOrValue, config.context ?? ({} as TContext))
        : stateOrValue;
      const current = from.value;
      const ctx = from.context;
      const stateDef = config.states[current];
      // No early return on a missing `on`: a state that declares nothing
      // still inherits the root tier. `stateDef` itself stays optional —
      // root handlers must work even for a state absent from the map.
      const name = event.type as EventName<TEventMap>;
      const candidates = [
        ...candidatesFor(stateDef?.on, event, name),
        // Root handlers are the fallback tier: a state-level handler for the
        // same event shadows them by ordering. One place states "this event
        // works everywhere" instead of a copy in every state.
        ...candidatesFor(config.on, event, name),
      ];
      if (candidates.length === 0) return stateOf(current, ctx);
      for (const candidate of candidates) {
        const { target, cond, assign } = typeof candidate === "string"
          ? { target: candidate, cond: undefined, assign: undefined }
          : candidate;
        if (cond !== undefined && !cond(ctx, event)) continue;

        // Internal transition (no target): only this transition's writes
        // run — no exit, no entry, no state change.
        if (target === undefined) {
          return {
            value: current,
            context: fold(
              assign === undefined
                ? undefined
                : (isList(assign) ? assign : [assign]),
              ctx,
              event as EventOf<TEventMap, typeof name>,
            ),
            matches: (v) => v === current,
          };
        }
        const nextDef = config.states[target];
        // The chain: the state's exit, the transition's writes, the next
        // state's entry — in that order, each seeing what the last left.
        const context = fold(stateDef?.exit, ctx, event);
        const written = fold(
          assign === undefined
            ? undefined
            : (isList(assign) ? assign : [assign]),
          context,
          event as EventOf<TEventMap, typeof name>,
        );
        return {
          value: target,
          context: fold(nextDef?.entry, written, event),
          matches: (v) => v === target,
        };
      }
      return stateOf(current, ctx);
    },
  };
}

export function interpret<
  TContext extends object,
  TEventMap extends EventMap,
  TState extends string = string,
>(
  machine: Machine<TContext, TEventMap, TState>,
): Service<TContext, TEventMap, TState> {
  let current = machine.initialState;
  let stopped = false;

  const service: Service<TContext, TEventMap, TState> = {
    setContext(patch) {
      current = { ...current, context: { ...current.context, ...patch } };
      machineTick(machineTick() + 1);
    },
    send(event) {
      if (stopped) return;
      current = machine.transition(current, event);
      // The reactivity seam: consumers read this service through a
      // `computed` that subscribes to the tick, as every binding does.
      machineTick(machineTick() + 1);
    },
    start(next) {
      stopped = false;
      if (next !== undefined) {
        const value = typeof next === "string" ? next : next.value;
        const context = typeof next === "string"
          ? machine.initialState.context
          : next.context;
        current = {
          value,
          context: fold(
            machine.config.states[value]?.entry,
            context,
            INIT as unknown as EventUnion<TEventMap>,
          ),
          matches: (v) => v === value,
        };
      } else {
        current = machine.initialState;
      }
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
