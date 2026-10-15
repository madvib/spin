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

export type PropParser = (raw: unknown) => unknown;

export interface PropDef {
  /** Parse the raw scope value into the connect prop. */
  readonly parse: PropParser;
  /** A controlled channel: the host owns this value, the machine follows. */
  readonly controlled?: false;
}

export interface ControlledDef {
  readonly controlled: true;
  readonly parse: PropParser;
  /** The event a host write sends. Receives the parsed outer value. */
  readonly event: (value: never) => { type: string } & Record<string, unknown>;
  /** Equality against the machine's current value. Default `===` — array
   * channels declare their own (a fresh parse never `===`s). */
  readonly equal?: (current: unknown, outer: unknown) => boolean;
}

export type ChannelDef = PropDef | ControlledDef;

/** What a part bag reads. All live — the framework calls this per tick
 * and memoizes on the returned signature. */
export interface PartScope {
  readonly props: Record<string, unknown>;
  readonly context: Record<string, unknown>;
  readonly state: string;
  readonly id: (part: string, slot?: number) => string;
  readonly send: (event: { type: string } & Record<string, unknown>) => void;
  readonly attr: (value: boolean) => string | undefined;
}

export interface PartDef {
  /** The id segment when it differs from the part key (`value-text` for
   * the `valueText` method family). Default: the key. */
  readonly id?: string;
  /** The bag: attributes, aria, node reflexes (`onLoad`, `use:observe`).
   * Keys are bag entries; values may read the scope. */
  readonly attrs: (scope: PartScope) => Record<string, unknown>;
  /** The memo signature: every scope field `attrs` reads, joined. A stale
   * signature is a stale bag — the framework cannot infer this. */
  readonly sig: (scope: PartScope) => string;
}

/** What a slotted bag reads: the part scope plus the slot. Slots are
 * stable identities (a thumb index, a row key) — the memo dies with the
 * slot it came from, so a slot object must be identity-stable per index. */
export interface SlotScope extends PartScope {
  readonly slot: { readonly index: number };
}

export interface SlotDef {
  /** The id segment when it differs from the slot key. Default: the key. */
  readonly id?: string;
  /** The slot identities, for the recipe's iteration. Must return stable
   * identities per length — a fresh array identity re-stamps rows. */
  readonly indexes: (context: Record<string, unknown>) => readonly { readonly index: number }[];
  readonly attrs: (scope: SlotScope) => Record<string, unknown>;
  readonly sig: (scope: SlotScope) => string;
}

export interface ReaderDef {
  /** A state projection: receives live context + state, returns the value. */
  readonly read: (context: Record<string, unknown>, state: string) => unknown;
}

export interface MethodDef {
  /** An indexed read (`getThumbValue(index)`): live context + state + args.
   * For per-slot numbers the recipe could compute from context, but hosts
   * and tests call these directly — they stay on the api. */
  readonly call: (
    context: Record<string, unknown>,
    state: string,
    args: readonly unknown[],
  ) => unknown;
}

export interface CommandDef {
  /** Commands are pure sends: name + event from args and live context.
   * The context read keeps `setThumbValue`-style splices in the def
   * without a hand-written api method. */
  readonly event: (
    args: readonly unknown[],
    context: Record<string, unknown>,
  ) => { type: string } & Record<string, unknown>;
}

export interface EventDef {
  /** The callback prop name on the props surface (the def maps it to a CustomEvent). */
  readonly prop: string;
  /** Values the framework snapshots per notify; a change fires the event. */
  readonly watch: (context: Record<string, unknown>, state: string) => readonly unknown[];
  /** Maps the changed values to the event detail. */
  readonly detail: (watched: readonly unknown[]) => Record<string, unknown>;
  /** Which sends fire this event: every move, or commits (release +
   * keyboard commit) only. Default `"move"`. */
  readonly on?: "move" | "commit";
}
export interface ComponentDef<C extends object, E extends { type: string }> {
  readonly name: string;
  readonly config: Config<C, E>;
  readonly implementations: Implementations<C, E>;
  readonly startState: string;
  /** Seed the machine context from parsed props before start. */
  readonly seed: (props: Record<string, unknown>) => Record<string, unknown>;
  readonly channels: Record<string, ChannelDef>;
  /** Channel names merged into machine context before every send, so an
   * assign or a cond never reads a stale scalar. Default: none. */
  readonly scalars?: readonly string[];
  /** Event types that end the gesture: notify runs as a commit for these,
   * a move otherwise. Default: every send notifies as a move. */
  readonly commitEvents?: readonly string[];
  readonly parts: Record<string, PartDef>;
  readonly slots?: Record<string, SlotDef>;
  readonly commands: Record<string, CommandDef>;
  readonly methods?: Record<string, MethodDef>;
  readonly readers?: Record<string, ReaderDef>;
  readonly events: Record<string, EventDef>;
}
