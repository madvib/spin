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
  /** The bag: attributes, aria, node reflexes (`onLoad`, `use:observe`).
   * Keys are bag entries; values may read the scope. */
  readonly attrs: (scope: PartScope) => Record<string, unknown>;
  /** The memo signature: every scope field `attrs` reads, joined. A stale
   * signature is a stale bag — the framework cannot infer this. */
  readonly sig: (scope: PartScope) => string;
}

export interface ReaderDef {
  /** A state projection: receives live context + state, returns the value. */
  readonly read: (context: Record<string, unknown>, state: string) => unknown;
}

export interface CommandDef {
  /** Commands are pure sends: name + event. No logic lives here. */
  readonly event: (args: readonly unknown[]) => { type: string } & Record<string, unknown>;
}

export interface EventDef {
  /** The callback prop name on the props surface (the def maps it to a CustomEvent). */
  readonly prop: string;
  /** Values the framework snapshots per notify; a change fires the event. */
  readonly watch: (context: Record<string, unknown>, state: string) => readonly unknown[];
  /** Maps the changed values to the event detail. */
  readonly detail: (watched: readonly unknown[]) => Record<string, unknown>;
}
export interface ComponentDef<C extends object, E extends { type: string }> {
  readonly name: string;
  readonly config: Config<C, E>;
  readonly implementations: Implementations<C, E>;
  readonly startState: string;
  /** Seed the machine context from parsed props before start. */
  readonly seed: (props: Record<string, unknown>) => Record<string, unknown>;
  readonly channels: Record<string, ChannelDef>;
  readonly parts: Record<string, PartDef>;
  readonly commands: Record<string, CommandDef>;
  readonly readers?: Record<string, ReaderDef>;
  readonly events: Record<string, EventDef>;
}
