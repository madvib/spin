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

export { attrParsers, define, uniqueId, type AttributeParser, type BuildContext, type ElementSpec } from "./scope/element.ts";
export { dataAttr, isComposing, keyed, memo, type BagBuilder, type BagMemo } from "./component/bags.ts";
export { focuser, ids, type IdFn } from "./component/ids.ts";
export { defineComponent } from "./component/synthesize.ts";
export {
  type ChannelDef,
  type CommandDef,
  type ComponentDef,
  type ControlledDef,
  type EventDef,
  type PartDef,
  type PartScope,
  type PropDef,
  type PropParser,
} from "./component/define.ts";
export {
  authoredProps,
  defineBridge,
  pickCallback,
  textProp,
  type BridgeService,
  type BridgeHooks,
  type BridgeSpec,
} from "./component/bridge.ts";
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
  /**
   * Builds the bridge from scope props, the element root, and the machine
   * id. Props arrive as a live reader (the element's prop store), never a
   * snapshot. The returned api is what the markup spreads and what commands
   * and element getters forward to.
   */
  readonly createBridge: (
    props: () => Record<string, unknown>,
    root: () => Element,
    id: string,
  ) => { readonly api: object; dispose(): void };
  /**
   * Imperative commands the host (or a controller) may call on the element:
   * `el[name](...args)` forwards to `api[name]`. Declared, not reflected, so
   * the element's surface is authored — no machine method can accidentally
   * shadow a DOM API by being copied over.
   */
  readonly commands?: readonly string[];
  /**
   * Authored out-side: each CustomEvent name maps to a callback prop the
   * bridge reports through and the detail mapper. The plugin codegen turns
   * each entry into a machine prop that dispatches on `el`. A misspelled
   * `on` never fires, so machine-defs annotate against this rather than
   * widening to `unknown`.
   */
  readonly events?: Readonly<Record<string, MachineEventContract>>;
}

/**
 * The platform-tier def: a thin layer over what the browser already does.
 *
 * Same slot as a MachineDef — markup `consume`s it the same way, commands
 * install the same way, events map the same way, and the app-controller
 * surface is identical. The difference is only who owns the state: here the
 * platform does, and `attach` wires the native behavior to the declared
 * commands and events. This is the progressive-enhancement tier: no machine,
 * no bridge machinery, just the adapter that makes the platform's controller
 * look like ours.
 */
export interface ControllerDef {
  /** Wires the element's native behavior; returns the api markup spreads. */
  attach(el: Element): object;
  /** Commands the element installs, as with a machine def. */
  readonly commands?: readonly string[];
  /** Authored events, as with a machine def. */
  readonly events?: Readonly<Record<string, MachineEventContract>>;
}

/** What a consume name resolves to: a machine def, or a platform adapter. */
export type ConsumedDef = MachineDef | ControllerDef;
export { createScopeTable, type Handle, type ScopeTable } from "./scope/table.ts";
export {
  controllerOf,
  controllerView,
  provideController,
  type SpinController,
} from "./scope/controller.ts";


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

export { load, type LoaderActions, type LoaderScope } from "./directives/load.ts";
export { bindActionProps, bindSpread } from "./directives/spread.ts";
export { machineTick } from "./core/signal.ts";
