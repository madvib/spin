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
export type EventOf<TMap extends EventMap, TName extends EventNames<TMap>> = {
  readonly type: TName;
} & TMap[TName & keyof TMap];

/** Every event of a map, as the union a service sends. */
export type EventUnion<TMap extends EventMap> = {
  [TName in EventNames<TMap>]: EventOf<TMap, TName>;
}[EventNames<TMap>];

/** The name of an event of a map. */
export type EventName<TMap extends EventMap> = EventNames<TMap>;

/** The state a service holds: a value, the context, and what it matches. */
export interface State<TContext extends object> {
  readonly value: string;
  readonly context: TContext;
  readonly matches: (value: string) => boolean;
}

/** A transition target: a state name, or a record with an optional target. */
export type Transition<TContext extends object, TEvent> =
  | string
  | {
      readonly target?: string;
      readonly cond?: (context: TContext, event: TEvent) => boolean;
      readonly assign?: Assign<TContext, TEvent> | readonly Assign<TContext, TEvent>[];
    };

/** A context write: a pure transform of the context. */
export type Assign<TContext extends object, TEvent> = (
  context: TContext,
  event: TEvent,
) => Partial<TContext>;

/**
 * The transitions of a map: each KEY narrows its own event.
 *
 * The author writes the event map once, and every transition reads its
 * event through the narrowing its key gives.
 */
export type Transitions<TContext extends object, TEventMap extends EventMap> = {
  readonly [TName in EventNames<TEventMap>]?:
    | Transition<TContext, EventOf<TEventMap, TName>>
    | readonly Transition<TContext, EventOf<TEventMap, TName>>[];
};

export interface Config<TContext extends object, TEventMap extends EventMap> {
  readonly id?: string;
  readonly initial: string;
  readonly context?: TContext;
  /** Root-level handlers: candidates in every state. State-level handlers
   * for the same event shadow these; everything else falls through here,
   * which states "this event works everywhere" once instead of duplicating
   * it across states. */
  readonly on?: Transitions<TContext, TEventMap>;
  readonly states: Readonly<
    Record<
      string,
      {
        readonly entry?: readonly Assign<TContext, EventUnion<TEventMap>>[];
        readonly exit?: readonly Assign<TContext, EventUnion<TEventMap>>[];
        readonly on?: Transitions<TContext, TEventMap>;
      }
    >
  >;
}

export interface Machine<TContext extends object, TEventMap extends EventMap> {
  readonly config: Config<TContext, TEventMap>;
  /** The machine's contract with its hosts: the fields a host may write,
   * and the event each write carries. */
  readonly fields: Readonly<Record<string, FieldContract<TEventMap>>>;
  readonly initialState: State<TContext>;
  transition(
    state: string | State<TContext>,
    event: EventUnion<TEventMap>,
  ): State<TContext>;
}

export interface Service<TContext extends object, TEventMap extends EventMap> {
  send(event: EventUnion<TEventMap>): void;
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
  start(state?: string | State<TContext>): Service<TContext, TEventMap>;
  stop(): Service<TContext, TEventMap>;
  readonly state: State<TContext>;
  readonly stopped: boolean;
}

const INIT = { type: "xstate.init" } as const;

function toArray<T>(value: readonly T[] | T | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? [...value] : [value as T];
}

function toEvent<TEventMap extends EventMap>(
  event: EventUnion<TEventMap>,
): EventUnion<TEventMap> {
  return event;
}

function stateOf<TContext extends object>(value: string, context: TContext): State<TContext> {
  return { value, context, matches: (v) => v === value };
}

/**
 * Whether a value is a list of transitions. `Array.isArray` does not
 * narrow a readonly array, so the test is named.
 */
function isList<T>(value: T | readonly T[]): value is readonly T[] {
  return Array.isArray(value);
}

/**
 * The event a key names. The guard is sound: the event IS the one its
 * type names, and the check is the one the dispatch already does.
 *
 * Narrowing the event BEFORE the lookup is what keeps the lookup exact:
 * a mapped type's indexed access does not distribute over a union of
 * keys, so `on[event.type]` alone would lose the correlation.
 */
function isEvent<TEventMap extends EventMap, TName extends EventNames<TEventMap>>(
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
function candidatesFor<TContext extends object, TEventMap extends EventMap, TName extends EventNames<TEventMap>>(
  on: Transitions<TContext, TEventMap> | undefined,
  event: EventUnion<TEventMap>,
  name: TName,
): readonly Transition<TContext, EventOf<TEventMap, TName>>[] {
  if (!isEvent(event, name)) return [];
  const found = on?.[event.type];
  if (found === undefined) return [];
  return isList(found) ? found : [found];
}

/**
 * Apply a transition's context writes, in order. Each write sees the
 * context the previous one left, so a chain reads what the chain wrote.
 */
function fold<TContext extends object, TEvent>(
  assigns: Assign<TContext, TEvent> | readonly Assign<TContext, TEvent>[] | undefined,
  startContext: TContext,
  event: TEvent,
): TContext {
  if (assigns === undefined) return startContext;
  let context = startContext;
  for (const assign of (isList(assigns) ? assigns : [assigns])) {
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
export interface MachineSpec<TContext extends object, TEventMap extends EventMap> {
  readonly id?: string;
  /** The machine's own defaults. No prop reaches this: a machine does
   * not know what a host is. */
  readonly context: TContext;
  readonly initial: string;
  readonly on?: Transitions<TContext, TEventMap>;
  readonly states: Readonly<
    Record<
      string,
      {
        readonly entry?: readonly Assign<TContext, EventUnion<TEventMap>>[];
        readonly exit?: readonly Assign<TContext, EventUnion<TEventMap>>[];
        readonly on?: Transitions<TContext, TEventMap>;
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
  readonly fields?: Readonly<Record<string, FieldContract<TEventMap>>>;
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

export function createMachine<TContext extends object, TEventMap extends EventMap>(
  spec: MachineSpec<TContext, TEventMap>,
): Machine<TContext, TEventMap> {
  const config: Config<TContext, TEventMap> = {
    ...(spec.id === undefined ? {} : { id: spec.id }),
    initial: spec.initial,
    context: spec.context,
    ...(spec.on === undefined ? {} : { on: spec.on }),
    states: spec.states,
  };
  const initial = fold(
    config.states[config.initial]?.entry,
    (config.context ?? ({} as TContext)),
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
        const { target, cond, assign } =
          typeof candidate === "string" ? { target: candidate, cond: undefined, assign: undefined } : candidate;
        if (cond !== undefined && !cond(ctx, event)) continue;

        // Internal transition (no target): only this transition's writes
        // run — no exit, no entry, no state change.
        if (target === undefined) {
          return {
            value: current,
            context: fold(assign, ctx, event),
            matches: (v) => v === current,
          };
        }
        const nextDef = config.states[target];
        // The chain: the state's exit, the transition's writes, the next
        // state's entry — in that order, each seeing what the last left.
        const context = fold(stateDef?.exit, ctx, event);
        const written = fold(assign, context, event);
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

export function interpret<TContext extends object, TEventMap extends EventMap>(
  machine: Machine<TContext, TEventMap>,
): Service<TContext, TEventMap> {
  let current = machine.initialState;
  let stopped = false;

  const service: Service<TContext, TEventMap> = {
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
        const context = typeof next === "string" ? machine.initialState.context : next.context;
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
