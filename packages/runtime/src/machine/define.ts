/**
 * The machine authoring API: `defineMachine`, `assign`, `guard`.
 *
 * A machine owns state and nothing else. It never sees a prop, never
 * reads the DOM, and never names a consumer: the consumer sends it
 * events, it answers with state, and one machine can drive any number
 * of consumers.
 *
 * Why a wrapper over the raw config: the config alone makes three
 * mistakes easy. A typo in `{ assign: "setValue" }` throws at runtime,
 * an assign has to re-narrow the event on every branch (`if (event.type
 * !== "SET_VALUE") return {}`), and the assigns live in a second table
 * that the config only references by string. Here the assign is bound
 * to the event it answers — `assign("SET_VALUE", (ctx, event) => ...)`
 * — so the event arrives narrowed, and the config's names are checked
 * against the table that implements them.
 */

import type { Config, EventObject, Implementations } from "@spin/runtime/fsm";

/** One event of a union, narrowed by its type. */
export type EventOf<E extends EventObject, K extends E["type"]> = Extract<E, { type: K }>;

/** A context transform bound to the event it answers. */
export type AssignFn<C extends object, E extends EventObject, K extends E["type"]> = (
  context: C,
  event: EventOf<E, K>,
) => Partial<C>;

/** A guard bound to the event it answers. */
export type CondFn<C extends object, E extends EventObject, K extends E["type"]> = (
  context: C,
  event: EventOf<E, K>,
) => boolean;

/** Any assign of this machine: bound to one of its event types. */
export type AnyAssign<C extends object, E extends EventObject> = {
  readonly [K in E["type"]]: Assign<C, E, K>;
}[E["type"]];

/** Any guard of this machine: bound to one of its event types. */
export type AnyCond<C extends object, E extends EventObject> = {
  readonly [K in E["type"]]: Cond<C, E, K>;
}[E["type"]];

/** The assigns table: each entry answers one event type. */
export type Assigns<C extends object, E extends EventObject> = Record<
  string,
  AnyAssign<C, E>
>;

/** The conds table: each entry answers one event type. */
export type Conds<C extends object, E extends EventObject> = Record<
  string,
  AnyCond<C, E>
>;

/**
 * An assign, bound to its event type. The name is the table key, so the
 * config's `{ assign: "setValue" }` and the implementation cannot drift.
 */
export interface Assign<C extends object, E extends EventObject, K extends E["type"]> {
  readonly __assign: K;
  readonly fn: AssignFn<C, E, K>;
}

/** A guard, bound to its event type. */
export interface Cond<C extends object, E extends EventObject, K extends E["type"]> {
  readonly __cond: K;
  readonly fn: CondFn<C, E, K>;
}

export function assign<C extends object, E extends EventObject>(
  fn: (context: C, event: E) => Partial<C>,
): Assign<C, E, E["type"]>;
export function assign<C extends object, E extends EventObject, K extends E["type"]>(
  type: K,
  fn: AssignFn<C, E, K>,
): Assign<C, E, K>;
export function assign<C extends object, E extends EventObject, K extends E["type"]>(
  type: K | ((context: C, event: E) => Partial<C>),
  fn?: AssignFn<C, E, K>,
): Assign<C, E, E["type"]> {
  if (fn === undefined) {
    const unbound = type as (context: C, event: E) => Partial<C>;
    return { __assign: "" as K, fn: unbound as unknown as AssignFn<C, E, K> } as unknown as Assign<C, E, E["type"]>;
  }
  return { __assign: type, fn } as unknown as Assign<C, E, E["type"]>;
}

export function guard<C extends object, E extends EventObject>(
  fn: (context: C, event: E) => boolean,
): Cond<C, E, E["type"]>;
export function guard<C extends object, E extends EventObject, K extends E["type"]>(
  type: K,
  fn: CondFn<C, E, K>,
): Cond<C, E, K>;
export function guard<C extends object, E extends EventObject, K extends E["type"]>(
  type: K | ((context: C, event: E) => boolean),
  fn?: CondFn<C, E, K>,
): Cond<C, E, E["type"]> {
  if (fn === undefined) {
    const unbound = type as (context: C, event: E) => boolean;
    return { __cond: "" as K, fn: unbound as unknown as CondFn<C, E, K> } as unknown as Cond<C, E, E["type"]>;
  }
  return { __cond: type, fn } as unknown as Cond<C, E, E["type"]>;
}

/** The transition shape a machine spec accepts. */
export type SpecTransition<C extends object, E extends EventObject, A extends Assigns<C, E>> =
  | string
  | {
      readonly target?: string;
      readonly cond?: string | ((context: C, event: E) => boolean);
      readonly actions?: readonly (
        | string
        | ((context: C, event: E) => void)
        | { readonly assign: keyof A & string }
      )[];
    };

/**
 * One field of the machine's context a host may write, and the event
 * that carries the write. The machine owns this map: the consumer
 * never names a machine field, and a host never touches machine state.
 */
export interface FieldContract<C extends object, E extends EventObject> {
  /** The context field the host may write. */
  readonly field: keyof C & string;
  /** The event the machine answers when the host writes it. */
  readonly event: E["type"];
  /**
   * Whether the host's write owns the field: an owned field follows the
   * host on every change. An unowned field is write-once (the host sets
   * it at mount and the machine keeps it).
   */
  readonly controlled?: boolean;
}

export interface MachineSpec<
  C extends object,
  E extends EventObject,
  A extends Assigns<C, E> = Assigns<C, E>,
  G extends Conds<C, E> = Conds<C, E>,
> {
  readonly id?: string;
  /** The machine's starting context: its own defaults, no props. */
  readonly context: C;
  readonly initial: string;
  readonly on?: Readonly<
    Record<string, readonly SpecTransition<C, E, A>[] | SpecTransition<C, E, A>>
  >;
  readonly states: Readonly<
    Record<
      string,
      {
        readonly entry?: readonly (
          | string
          | ((context: C, event: E) => void)
          | { readonly assign: keyof A & string }
        )[];
        readonly exit?: readonly (
          | string
          | ((context: C, event: E) => void)
          | { readonly assign: keyof A & string }
        )[];
        readonly on?: Readonly<
          Record<string, readonly SpecTransition<C, E, A>[] | SpecTransition<C, E, A>>
        >;
      }
    >
  >;
  /**
   * The machine's contract with its hosts: which context fields a host
   * may write, and the event that carries each write. The machine owns
   * this map — the consumer does not, and a host cannot reach past it.
   */
  readonly fields?: readonly FieldContract<C, E>[];
  /** The context transforms, each bound to the event it answers. */
  readonly assigns?: A;
  /** The guards, each bound to the event it answers. */
  readonly conds?: G;
}

/** The machine artifact: the config, the implementations, and its types. */
export interface Machine<C extends object, E extends EventObject> {
  readonly config: Config<C, E>;
  readonly implementations: Implementations<C, E>;
  /** The context type, for the consumers that seed this machine. */
  readonly contextType?: C;
  /** The event type, for the consumers that send this machine events. */
  readonly eventType?: E;
  /** The contract: which fields a host may write, and how. */
  readonly fields: readonly FieldContract<C, E>[];
}

/**
 * Define a machine: one object, one place. The assigns and conds are
 * bound to their event types, so a wrong event name or a wrong payload
 * is a type error rather than a runtime surprise.
 */
export function defineMachine<
  C extends object,
  E extends EventObject,
  A extends Assigns<C, E> = Assigns<C, E>,
  G extends Conds<C, E> = Conds<C, E>,
>(spec: MachineSpec<C, E, A, G>): Machine<C, E> {
  const assigns: Record<string, (context: C, event: E) => Partial<C>> = {};
  for (const [name, entry] of Object.entries(spec.assigns ?? {})) {
    const bound = entry as unknown as unknown as Assign<C, E, E["type"]>;
    assigns[name] = (context, event) => bound.fn(context, event as EventOf<E, E["type"]>);
  }
  const conds: Record<string, (context: C, event: E) => boolean> = {};
  for (const [name, entry] of Object.entries(spec.conds ?? {})) {
    const bound = entry as unknown as unknown as Cond<C, E, E["type"]>;
    conds[name] = (context, event) => bound.fn(context, event as EventOf<E, E["type"]>);
  }
  return {
    config: {
      ...(spec.id === undefined ? {} : { id: spec.id }),
      initial: spec.initial,
      context: spec.context,
      ...(spec.on === undefined ? {} : { on: spec.on as never }),
      states: spec.states as never,
    },
    implementations: {
      ...(Object.keys(conds).length === 0 ? {} : { conds }),
      ...(Object.keys(assigns).length === 0 ? {} : { assigns }),
    },
    contextType: spec.context,
    eventType: undefined as unknown as E,
    fields: spec.fields ?? [],
  };
}
