/** The component definition: everything a component author writes besides
 * the machine and the markup.
 *
 * The machine owns state. The markup owns structure. This file owns the
 * narrow seam between them: which props exist and how they parse, which
 * parts exist and which attributes each carries as a function of live
 * state, which node reflexes report back in as events, which authored
 * channels stay controlled, and which transitions report out.
 *
 * Nothing here is logic over state — every function reads, none decides.
 * The framework synthesizes the bridge and the connect from this; no
 * hand-written `getXProps()` exists for any component. */

import type { EventMap, EventUnion, Machine } from "@spin/runtime/fsm";

export interface ParseHost {
  /** The element root: behavioral host props (sanitize, validate,
   * translations) live as element properties, not scope props. */
  readonly root: () => Element;
}

export type PropParser = (raw: unknown, host?: ParseHost) => unknown;

/** What a part bag reads. All live — the framework calls this per tick
 * and memoizes on the returned signature. */
export type AnyEvent = { readonly type: string } & Record<string, unknown>;

export interface PartScope<
  R = unknown,
  C extends object = Record<string, unknown>,
  P = Record<string, unknown>,
  Ev = AnyEvent,
  S extends string = string,
> {
  /** The component's props, typed. The host sets them; the machine never
   * sees them. */
  readonly props: P;
  readonly context: C;
  readonly state: S;
  readonly root: () => Element;
  readonly id: (part: string, slot?: unknown) => string;
  readonly measure: (part: string, slot?: unknown) => DOMRect | null;
  send(event: Ev): void;
  readonly attr: (value: boolean) => string | undefined;
  readonly slot: R;
}

export type ScopeFor<
  C extends object,
  E extends EventMap = Record<string, Record<string, unknown>>,
  S extends string = string,
  P = Record<string, unknown>,
> = PartScope<unknown, C, P, EventUnion<E>, S>;

export interface PartDef<
  R = unknown,
  C extends object = Record<string, unknown>,
  P = Record<string, unknown>,
  Ev = AnyEvent,
  S extends string = string,
> {
  /** The id segment when it differs from the part key (`value-text` for
   * the `valueText` method family). Default: the key. */
  readonly id?: string;
  /** The bag: attributes, aria, node reflexes (`onLoad`, `use:observe`).
   * Keys are bag entries; values may read the scope. Receives the recipe's
   * argument when the part takes one (`getTriggerProps({ focusable })`).
   *
   * The bag rebuilds when the scope's fields it read move: the reads are
   * recorded, so a dependency is never named by hand. Optional when the
   * part carries only its auto-stamped `id`, `data-scope`, and `data-part`. */
  attrs?(
    scope: PartScope<R, C, P, Ev, S>,
    arg?: unknown,
  ): Record<string, unknown>;
}

/** What a slotted bag reads: the part scope plus the slot. Slots are
 * stable identities (a thumb index, a row key). */
export interface SlotScope<
  R = unknown,
  C extends object = Record<string, unknown>,
  P = Record<string, unknown>,
  Ev = AnyEvent,
  S extends string = string,
> extends PartScope<R, C, P, Ev, S> {}

export type SlotScopeFor<
  R,
  C extends object,
  E extends EventMap = Record<string, Record<string, unknown>>,
  S extends string = string,
  P = Record<string, unknown>,
> = SlotScope<R, C, P, EventUnion<E>, S>;

export interface SlotDef<
  R = unknown,
  C extends object = Record<string, unknown>,
  P = Record<string, unknown>,
  Ev = AnyEvent,
  S extends string = string,
> {
  /** The id segment when it differs from the slot key. Default: the key. */
  readonly id?: string;
  /** Whether the framework stamps `id`, `data-scope`, and `data-part` onto
   * the slot's bag before `attrs(scope)`. Default `true`; set `false` for
   * form controls like hidden inputs that omit scope/part attributes. */
  readonly stamp?: boolean;
  /** The slot identities, for the recipe's iteration: rows, blocks, thumb
   * indexes. Receives parsed props: the collection lives there. */
  readonly indexes: (
    context: C,
    props: Record<string, unknown>,
  ) => readonly unknown[];
  attrs(
    scope: SlotScope<R, C, P, Ev, S>,
    arg?: unknown,
  ): Record<string, unknown>;
}

export interface ReaderDef<
  C extends object = Record<string, unknown>,
  R = unknown,
  S extends string = string,
> {
  /** A state projection: live context + state + parsed props (the
   * collection lives in props, rows never enter the machine) + the root
   * (a fieldset's disabled state disables the control, and only the root
   * knows its ancestors). */
  read(
    context: C,
    state: S,
    props: Record<string, unknown>,
    root?: () => Element,
  ): R;
}

/**
 * How a consumer initializes the machine it consumes.
 *
 * - `undefined` — the machine's own defaults stand.
 * - a context patch — a literal the consumer chose.
 * - a function — the consumer reads the host's props and decides.
 */
export type InitSpec<C extends object, _E extends EventMap> =
  | Partial<C>
  | ((
    props: Readonly<Record<string, unknown>>,
    authored: (name: string) => boolean,
  ) => Partial<C>);

/**
 * The machine a component consumes: a factory over the machine's OWN
 * arguments.
 */
export type MachineFactory<
  C extends object,
  E extends EventMap,
  A = unknown,
  S extends string = string,
> = (
  args: A,
  authored: (name: string) => boolean,
) => Machine<C, E, S>;

export interface MethodDef<
  C extends object = Record<string, unknown>,
  R = unknown,
  A extends readonly unknown[] = readonly unknown[],
  S extends string = string,
> {
  /** An indexed read (`getThumbValue(index)`): live context + state + args
   * + parsed props + part ids. */
  call(
    context: C,
    state: S,
    args: A,
    props: Record<string, unknown>,
    id: (part: string, slot?: unknown) => string,
  ): R;
}

export type CommandDef<
  A extends readonly unknown[] = readonly unknown[],
  C extends object = Record<string, unknown>,
  E extends EventMap = Record<string, object>,
> =
  | {
    /** A sending command: name + event from args, live context, and part
     * ids. */
    event(
      args: A,
      context: C,
      id: (part: string, slot?: unknown) => string,
    ): EventUnion<E>;
    readonly view?: undefined;
  }
  | {
    /** A view-only command (node focus with no machine move): the api
     * method runs this with the part ids instead of sending. */
    readonly event?: undefined;
    view(args: {
      readonly args: A;
      readonly id: (part: string, slot?: unknown) => string;
      readonly focus: (part: string, slot?: unknown) => void;
      readonly measure: (part: string, slot?: unknown) => DOMRect | null;
      readonly root: () => Element;
    }): void;
  };

export interface EventDef<
  W extends readonly unknown[] = readonly unknown[],
  C extends object = Record<string, unknown>,
  S extends string = string,
> {
  /** The callback prop name on the props surface (the def maps it to a CustomEvent). */
  readonly prop: string;
  /** Values the framework snapshots per notify; a change fires the event. */
  watch(context: C, state: S): readonly unknown[];
  /** Maps the changed values to the event detail. Receives the triggering
   * lives in props, so row-resolving details read it here), and the live
   * context — the watch carries ONLY the fire condition; current values for
   * the payload come from here, so an unrelated move never reports. */
  detail(
    watched: W,
    event?: { readonly type: string },
    props?: Record<string, unknown>,
    context?: C,
  ): Record<string, unknown>;
  /** Which sends fire this event: every move, or commits (release +
   * keyboard commit) only. Default `"move"`. */
  readonly on?: "move" | "commit";
  /** Event-gated reports (the `invokeOnSelect` rule): evaluated per send with
   * the before/after contexts; a null return reports nothing (a guard the
   * machine refused). When present, `watch` still advances the cursor. */
  readonly select?: (
    event: { readonly type: string } & Record<string, unknown>,
    before: C,
    after: C,
    states?: { readonly was: string; readonly is: string },
    source?: string,
  ) => Record<string, unknown> | readonly Record<string, unknown>[] | null;
}
export interface ComponentDef<
  C extends object,
  E extends EventMap,
  P = Record<string, unknown>,
  A = unknown,
  S extends string = string,
  Methods = Record<string, MethodDef<C, unknown, readonly unknown[], S>>,
  Readers = Record<string, ReaderDef<C, unknown, S>>,
> {
  readonly name: string;
  /** The start state, or its computation from parsed props. */
  readonly start?:
    | S
    | ((
      props: Record<string, unknown>,
      authored: (name: string) => boolean,
    ) => S);
  /** Events sent once after start. */
  readonly establish?: (
    props: Record<string, unknown>,
    authored: (name: string) => boolean,
  ) => readonly ({ type: string } & Record<string, unknown>)[];
  /** The machine's starting context, from the props. */
  readonly seed?: (
    props: Record<string, unknown>,
    authored: (name: string) => boolean,
  ) => Record<string, unknown>;
  /** Derived context sync inside the owned effect. Runs as `refresh` → `applyContract` → `reconcile` → `settled`: live functions that must stay fresh sync through `scalarsOf`, and post-mount unauthored prop writes never reach context (author config at mount). */
  readonly reconcile?: (args: {
    readonly context: C;
    readonly state: S;
    readonly parsed: Record<string, unknown>;
    readonly authored: (name: string) => boolean;
    readonly send: (event: { type: string } & Record<string, unknown>) => void;
  }) => boolean;
  /** Event enrichment pre-send. */
  readonly dispatch?: (
    event: { type: string } & Record<string, unknown>,
    props: Record<string, unknown>,
  ) => { type: string } & Record<string, unknown>;
  /** Once, after the first connect build: entry focus and mount reflexes. Receives props only, so mount-time gates like pin-input autoFocus stay props reads intentionally. */
  readonly mounted?: (args: {
    readonly props: Record<string, unknown>;
    readonly root: () => Element;
    readonly id: (part: string, slot?: unknown) => string;
    readonly focus: (part: string, slot?: unknown) => void;
    readonly measure: (part: string, slot?: unknown) => DOMRect | null;
  }) => void;
  /** Post-send view reflexes: the `settled` step of the refresh → applyContract → reconcile → settled pipeline. */
  readonly settled?: (args: {
    readonly event: AnyEvent;
    readonly before: { readonly context: C; readonly state: S };
    readonly after: { readonly context: C; readonly state: S };
    readonly props: Record<string, unknown>;
    readonly root: () => Element;
    readonly id: (part: string, slot?: unknown) => string;
    readonly focus: (part: string, slot?: unknown) => void;
    readonly measure: (part: string, slot?: unknown) => DOMRect | null;
    readonly send: (event: AnyEvent) => void;
  }) => void;
  /** Static scalar field names: host writes to these merge into context without an event. */
  readonly scalars?: readonly string[];
  /** Live scalar values: functions that must stay fresh (async-list load/sortFn) sync through here every effect run. */
  readonly scalarsOf?: (
    parsed: Record<string, unknown>,
    authored: (name: string) => boolean,
  ) => Record<string, unknown>;
  /** Names the commit-kind sends: those report `commit` events, all others report `move`. */
  readonly commitEvents?: readonly (EventUnion<E>["type"] | (string & {}))[];
  readonly init?: InitSpec<C, E>;
  readonly machine?: MachineFactory<C, E, A, S>;
  readonly args?: (props: P) => A;
  readonly parts: Record<string, PartDef<unknown, C, P, EventUnion<E>, S>>;
  readonly slots?: Record<string, SlotDef<never, C, P, EventUnion<E>, S>>;
  readonly commands: Record<string, CommandDef<readonly unknown[], C, E>>;
  readonly methods?: Methods;
  readonly readers?: Readers;
  readonly events: Record<string, EventDef<readonly unknown[], C, S>>;
}

/** A reader entry's value type, or never when the entry is not a reader. */
export type ReaderValue<T> = T extends { read(...args: never[]): infer R } ? R
  : never;

/** A method entry's api surface: infers tuple parameters from `call`'s
 * `args` parameter when declared, or `() => R` for 0-arg methods. */
export type MethodValue<T> = T extends
  { call: (context: never, state?: never) => infer R } ? () => R
  : T extends {
    call: (
      context: never,
      state: never,
      args: infer A extends readonly unknown[],
      ...rest: never[]
    ) => infer R;
  } ? (...args: A) => R
  : never;

/** A command entry's callable surface: infers tuple parameters from
 * `event(args: A, ...)` when declared, or `() => void` for 0-arg commands. */
export type CommandFn<T> = T extends
  { event: () => unknown } | { view: () => unknown } ? () => void
  : T extends {
    event: (
      args: infer A extends readonly unknown[],
      ...rest: never[]
    ) => unknown;
  } ? (...args: A) => void
  : T extends { view: (args: infer V) => unknown }
    ? V extends { readonly args: infer A extends readonly unknown[] }
      ? (...args: A) => void
    : () => void
  : never;

/** A slot entry's `getXProps` surface: infers the slot parameter type `R`
 * from `attrs(scope: SlotScope<R, ...>)`. */
export type SlotPropsFn<T> = T extends {
  attrs: (
    scope: SlotScope<infer R, never, never, never, never>,
    ...args: never[]
  ) => unknown;
} ? (slot: R) => Record<string, unknown>
  : (slot: unknown) => Record<string, unknown>;

/** The state union a component's machine declares, or `string` when untyped. */
export type StateOf<D> = D extends {
  readonly machine?: (
    ...args: never[]
  ) => { readonly initialState: { readonly value: infer S extends string } };
} ? S
  : string;

/** The api a component's def implies. */
export type ApiOf<
  D extends {
    readonly readers?: Record<string, unknown>;
    readonly methods?: Record<string, unknown>;
    readonly commands?: Record<string, unknown>;
    readonly parts?: Record<string, unknown>;
    readonly slots?: Record<string, unknown>;
  },
> =
  & {
    readonly [
      K in keyof D["readers"] & string as D["readers"] extends
        Record<K, unknown> ? K : never
    ]: D["readers"] extends Record<K, infer T> ? ReaderValue<T>
      : never;
  }
  & {
    readonly [
      K in keyof D["methods"] & string as D["methods"] extends
        Record<K, unknown> ? K : never
    ]: D["methods"] extends Record<K, infer T> ? MethodValue<T>
      : never;
  }
  & {
    readonly [K in keyof D["commands"] & string]: D["commands"] extends
      Record<K, infer T> ? CommandFn<T>
      : never;
  }
  & {
    readonly [
      K in keyof NonNullable<D["parts"]> & string as `get${Capitalize<K>}Props`
    ]: (slot?: unknown) => Record<string, unknown>;
  }
  & {
    readonly [
      K in keyof NonNullable<D["slots"]> & string as `get${Capitalize<
        K
      >}Indexes`
    ]: NonNullable<D["slots"]> extends Record<K, infer T>
      ? T extends { indexes(...args: never[]): readonly (infer E)[] }
        ? () => readonly E[]
      : () => readonly unknown[]
      : () => readonly unknown[];
  }
  & {
    readonly [
      K in keyof NonNullable<D["slots"]> & string as `get${Capitalize<K>}Props`
    ]: NonNullable<D["slots"]> extends Record<K, infer T> ? SlotPropsFn<T>
      : (slot: unknown) => Record<string, unknown>;
  }
  & {
    /** The machine's mode, live: the framework's own reader. */
    readonly state: StateOf<D>;
  };
