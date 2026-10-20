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

import type { Config, Implementations } from "@spin/runtime/fsm";

export interface ParseHost {
  /** The element root: behavioral host props (sanitize, validate,
   * translations) live as element properties, not scope props. */
  readonly root: () => Element;
}

export type PropParser = (raw: unknown, host?: ParseHost) => unknown;

export interface PropDef {
  /** Parse the raw scope value into the connect prop. */
  readonly parse: PropParser;
  /** A controlled channel: the host owns this value, the machine follows. */
  readonly controlled?: false;
}

export interface ControlledDef {
  readonly controlled: true;
  readonly parse: PropParser;
  /** The event a host write sends. Receives the parsed outer value, the
   * live context, and the last sent event's type — a controlled close
   * right after a submit commits, anything else reverts. */
  readonly event: (
    value: never,
    context?: Record<string, unknown>,
    lastEvent?: string,
  ) => { type: string } & Record<string, unknown>;
  /** Write the parsed value straight into context instead of sending:
   * host writes alternate on their own, not on the next machine event. */
  readonly assign?: true;
  /** Equality against the machine's current value. Default `===` — array
   * channels declare their own (a fresh parse never `===`s). */
  readonly equal?: (current: unknown, outer: unknown) => boolean;
  /** A parsed null alternates (clears) rather than skipping: nullable text
   * channels where null is a value, not a failed parse. */
  readonly nullable?: true;
  /** Host writes apply without reporting (assign-mode implies it): the
   * machine's own sends own the events. Event channels report by default. */
  readonly silent?: true;
  /** Reads the channel's current value: context field by default, derived
   * state otherwise (open-ness lives in the phase, not the context). */
  readonly current?: (context: Record<string, unknown>, state: string) => unknown;
}

export type ChannelDef = PropDef | ControlledDef;

/** What a part bag reads. All live — the framework calls this per tick
 * and memoizes on the returned signature. */
export interface PartScope<R = unknown, C extends object = Record<string, unknown>> {
  readonly props: Record<string, unknown>;
  readonly context: C;
  readonly state: string;
  readonly root: () => Element;
  readonly id: (part: string, slot?: unknown) => string;
  readonly measure: (part: string, slot?: unknown) => DOMRect | null;
  readonly send: (event: { type: string } & Record<string, unknown>) => void;
  readonly attr: (value: boolean) => string | undefined;
  readonly slot: R;
}

export interface PartDef<R = unknown, C extends object = Record<string, unknown>> {
  /** The id segment when it differs from the part key (`value-text` for
   * the `valueText` method family). Default: the key. */
  readonly id?: string;
  /** The bag: attributes, aria, node reflexes (`onLoad`, `use:observe`).
   * Keys are bag entries; values may read the scope. Receives the recipe's
   * argument when the part takes one (`getTriggerProps({ focusable })`). */
  attrs(scope: PartScope<R, C>, arg?: unknown): Record<string, unknown>;
  /** The memo signature: every scope field `attrs` reads, joined — the
   * recipe argument included. A stale signature is a stale bag; the
   * framework cannot infer this. */
  sig(scope: PartScope<R, C>, arg?: unknown): string;
}

/** What a slotted bag reads: the part scope plus the slot. Slots are
 * stable identities (a thumb index, a row key) — the memo dies with the
 * slot it came from, so a slot object must be identity-stable per index. */
export interface SlotScope<R = unknown, C extends object = Record<string, unknown>> extends PartScope<R, C> {}

export interface SlotDef<R = unknown, C extends object = Record<string, unknown>> {
  /** The id segment when it differs from the slot key. Default: the key. */
  readonly id?: string;
  /** The slot identities, for the recipe's iteration: rows, blocks, thumb
   * indexes. Must return stable identities — a fresh identity per read
   * re-stamps rows. Receives parsed props: the collection lives there. */
  readonly indexes: (
    context: C,
    props: Record<string, unknown>,
  ) => readonly unknown[];
  attrs(scope: SlotScope<R, C>, arg?: unknown): Record<string, unknown>;
  sig(scope: SlotScope<R, C>, arg?: unknown): string;
}

export interface ReaderDef<C extends object = Record<string, unknown>> {
  /** A state projection: live context + state + parsed props (the
   * collection lives in props, rows never enter the machine) + the root
   * (a fieldset's disabled state disables the control, and only the root
   * knows its ancestors). */
  read(
    context: C,
    state: string,
    props: Record<string, unknown>,
    root?: () => Element,
  ): unknown;
}

export interface MethodDef<C extends object = Record<string, unknown>> {
  /** An indexed read (`getThumbValue(index)`): live context + state + args
   * + parsed props + part ids. For per-slot numbers the recipe could compute
   * from context, but hosts and tests call these directly — they stay on
   * the api. */
  readonly call: (
    context: C,
    state: string,
    args: readonly unknown[],
    props: Record<string, unknown>,
    id: (part: string, slot?: unknown) => string,
  ) => unknown;
}

export type CommandDef<
  A extends readonly unknown[] = readonly unknown[],
  C extends object = Record<string, unknown>,
  E extends { type: string } = { type: string },
> =
  | {
    /** A sending command: name + event from args, live context, and part
     * ids. The context read keeps `setThumbValue`-style splices in the def
     * without a hand-written api method; the ids resolve id-keyed commands
     * (`clearValue(tagId)`) without one.
     *
     * The event is the machine's own event: a command that sends a
     * payload the machine does not read is a typo the types catch. */
    event(
      args: A,
      context: C,
      id: (part: string, slot?: unknown) => string,
    ): E;
    readonly view?: undefined;
  }
  | {
    /** A view-only command (node focus with no machine move): the api
     * method runs this with the part ids instead of sending. */
    readonly event?: undefined;
    readonly view: (args: {
      readonly args: readonly unknown[];
      readonly id: (part: string, slot?: unknown) => string;
      readonly focus: (part: string, slot?: unknown) => void;
      readonly measure: (part: string, slot?: unknown) => DOMRect | null;
    }) => void;
  };

export interface EventDef<W extends readonly unknown[] = readonly unknown[], C extends object = Record<string, unknown>> {
  /** The callback prop name on the props surface (the def maps it to a CustomEvent). */
  readonly prop: string;
  /** Values the framework snapshots per notify; a change fires the event. */
  watch(context: C, state: string): readonly unknown[];
  /** Maps the changed values to the event detail. Receives the triggering
   * event (undefined from the sync effect), the parsed props (the collection
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
  /** Event-gated reports (Zag's `invokeOnSelect`): evaluated per send with
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
export interface ComponentDef<C extends object, E extends { type: string }> {
  readonly name: string;
  readonly config: Config<C, E>;
  readonly implementations: Implementations<C, E>;
  /** The start state, or its computation from parsed props (an authored
   * `open` starts the panel up). Absent, the machine's own initial. */
  readonly start?: string | ((
    props: Record<string, unknown>,
    authored: (name: string) => boolean,
  ) => string);
  /** Events sent once after start (seeded through the machine, not a
   * write: validation and sanitization run through the assigns). */
  readonly establish?: (
    props: Record<string, unknown>,
    authored: (name: string) => boolean,
  ) => readonly ({ type: string } & Record<string, unknown>)[];
  /** Seed the machine context from parsed props before start. A coerced
   * default is never a write: `closeOnSelect` defaults from the mode unless
   * the host authored it. */
  readonly seed: (
    props: Record<string, unknown>,
    authored: (name: string) => boolean,
  ) => Record<string, unknown>;
  /** Derived context sync inside the owned effect (collection order/labels
   * re-homed over a changed item tree). Reads parsed props, may assign
   * derived caches directly and send re-homing events. Returns true when
   * the machine must notify. */
  readonly reconcile?: (args: {
    readonly context: C;
    readonly state: string;
    readonly parsed: Record<string, unknown>;
    readonly authored: (name: string) => boolean;
    readonly send: (event: { type: string } & Record<string, unknown>) => void;
  }) => boolean;
  /** Event enrichment pre-send (host validators ride navigation events:
   * functions cannot cross the scope channel, so the machine's guards read
   * them off the event). Applied to every gesture and command send. */
  readonly dispatch?: (
    event: { type: string } & Record<string, unknown>,
    props: Record<string, unknown>,
  ) => { type: string } & Record<string, unknown>;
  /** Once, after the first connect build (cells exist in markup): entry
   * focus and other mount-time view reflexes. */
  readonly mounted?: (args: {
    readonly props: Record<string, unknown>;
    readonly root: () => Element;
    readonly id: (part: string, slot?: unknown) => string;
    readonly focus: (part: string, slot?: unknown) => void;
    readonly measure: (part: string, slot?: unknown) => DOMRect | null;
  }) => void;
  /** Post-send view reflexes (the panel's opening owes the field its
   * focus). View-side only: focus management, never state. */
  readonly settled?: (args: {
    readonly event: { readonly type: string } & Record<string, unknown>;
    readonly before: { readonly context: C; readonly state: string };
    readonly after: { readonly context: C; readonly state: string };
    readonly props: Record<string, unknown>;
    readonly root: () => Element;
    readonly id: (part: string, slot?: unknown) => string;
    readonly focus: (part: string, slot?: unknown) => void;
    readonly measure: (part: string, slot?: unknown) => DOMRect | null;
    /** The view's send: a settled reflex that kicks a DOM poll (a target
     * lookup, a scroll settle) reports its findings back through this. */
    readonly send: (event: { readonly type: string } & Record<string, unknown>) => void;
  }) => void;
  readonly channels?: Record<string, ChannelDef>;
  /** Channel names merged into machine context before every send, so an
   * assign or a cond never reads a stale scalar. Default: none. */
  readonly scalars?: readonly string[];
  /** Scalar computation with authored access (a coerced default is never a
   * write: `closeOnSelect` defaults from the mode unless the host authored
   * it). Absent, the `scalars` names merge verbatim. */
  readonly scalarsOf?: (
    parsed: Record<string, unknown>,
    authored: (name: string) => boolean,
  ) => Record<string, unknown>;
  /** Event types that end the gesture: notify runs as a commit for these,
   * a move otherwise. Default: every send notifies as a move. */
  readonly commitEvents?: readonly string[];
  readonly parts: Record<string, PartDef<unknown, C>>;
  readonly slots?: Record<string, SlotDef<unknown, C>>;
  readonly commands: Record<string, CommandDef<readonly unknown[], C, E>>;
  readonly methods?: Record<string, MethodDef<C>>;
  readonly readers?: Record<string, ReaderDef<C>>;
  readonly events: Record<string, EventDef<readonly unknown[], C>>;
}
