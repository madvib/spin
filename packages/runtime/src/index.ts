import type { CollectionDecl } from "./machine/adapter/machine.ts";

export {
  batch,
  computed,
  effect,
  own,
  scope,
  signal,
  trigger,
  untrack,
  type OwnerScope,
} from "./core/signal.ts";

export { define, uniqueId, type AttributeParser, type BuildContext, type ElementSpec } from "./scope/element.ts";
/**
 * The machine-def contract: what a `<name>.machine-def.ts` module provides.
 *
 * `machine` + `connect` are Zag's pair, opaque here — the runtime never
 * imports Zag. `events` is the authored out-side: each CustomEvent name maps
 * to the Zag callback prop that fires it and the detail mapper. The plugin
 * codegen turns each entry into a machine prop that dispatches on `el`.
 * A misspelled `on` never fires, so machine-defs annotate against this
 * rather than widening to `unknown`.
 */
export interface MachineEventContract<TDetail = unknown> {
  /** The Zag callback prop name, e.g. `onValueChange`. */
  readonly on: string;
  /**
   * Maps Zag's callback payload to the event's `detail`. `any` in, typed
   * out: Zag's payload shapes are per-machine and untyped at this seam,
   * so the mapper narrows and the event carries the narrowed type.
   */
  // deno-lint-ignore no-explicit-any
  readonly detail: (change: any) => TDetail;
}
export interface MachineDef {
  readonly machine: object;
  readonly connect: (...args: never[]) => object;
  readonly events?: Readonly<Record<string, MachineEventContract>>;
  /**
   * A constructed collection prop, declared — not built. The adapter builds
   * the Zag `TreeCollection`/`ListCollection` from the named scope prop and
   * memoizes per source identity. Re-exported from the adapter; this is the
   * same type, not a parallel one.
   */
  readonly collection?: CollectionDecl;
  /**
   * Transforms scope-coerced values into machine props, merged over the
   * values. For derived scalars (carousel's slideCount, select's array
   * wrapping) and sync side effects (toast's store). Collections go through
   * `collection` above, never here.
   */
  // deno-lint-ignore no-explicit-any
  readonly toMachineProps?: (values: Record<string, any>) => Record<string, unknown>;
}
export type { CollectionDecl } from "./machine/adapter/machine.ts";
export { createScopeTable, type Handle, type ScopeTable } from "./scope/table.ts";

export { createAction, runAction, type ElementAction, type SlotLookup } from "./directives/use.ts";
export { on } from "./directives/use.ts";
export {
  bindAttr,
  bindChecked,
  bindDynamic,
  bindProp,
  bindText,
  bindValue,
  placeSlot,
  projectSlots,
  type Binding,
  type Writable,
} from "./directives/bind.ts";
export { bindFor, type BindForOptions, type RenderedItem } from "./directives/for.ts";
export { bindIf, type BindIfOptions, type BranchRender } from "./directives/if.ts";
export { text, tpl, view, type ReactiveText, type Rendered } from "./directives/tpl.ts";
export { parse, parseScope, coerceProps } from "./directives/parse.ts";
export type {
  ActionUse,
  Attr,
  AttrValue,
  ComponentIr,
  Diagnostic,
  ElementNode,
  EventBinding,
  ForNode,
  Node,
  PropDecl,
  ScopeBlock,
  ScopePropType,
  SpreadUse,
  TextNode,
} from "./directives/ir.ts";
export { ParseError } from "./directives/ir.ts";
export { useMachine, type MachineApi, type MachineService } from "./machine/machine.ts";

export { load, type LoaderActions, type LoaderScope } from "./directives/load.ts";
export { component, type ComponentSpec } from "./scope/component.ts";
export { bindActionProps, bindSpread } from "./directives/zag-bind.ts";
export { machineTick } from "./machine/adapter/machine.ts";
