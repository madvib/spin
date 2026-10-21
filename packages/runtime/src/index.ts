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
  type Signal,
} from "./core/signal.ts";

export { attrParsers, define, uniqueId, type AttributeParser, type BuildContext, type ElementSpec } from "./scope/element.ts";
export { dataAttr, isComposing } from "./component/bags.ts";
export { focuser, ids, measurer, type IdFn } from "./component/ids.ts";
export {
  coerceBool,
  coerceInt,
  coerceJsonArray,
  coerceList,
  coerceObjectArrayItems,
  coerceString,
  isRecord,
  type CoerceObjectField,
  type CoercePropDecl,
  type PropCoerceType,
} from "./props.ts";
export { defineComponent } from "./component/synthesize.ts";
export {
  type CommandDef,
  type ComponentDef,
  type EventDef,
  type PartDef,
  type PartScope,
  type SlotScope,
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
export { coerceProps, parse, parseScope } from "@spin/syntax";
export { formatExampleHtml, tokenizeHtml, type CodeToken, type CodeTokenType } from "@spin/syntax";
export { expandVariantGroups } from "@spin/syntax";
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
} from "@spin/syntax";
export { ParseError } from "@spin/syntax";

export { load, type LoaderActions, type LoaderScope } from "./directives/load.ts";
export { bindActionProps, bindSpread } from "./directives/spread.ts";
export { machineTick } from "./core/signal.ts";

/**
 * The machine API: one function, one object.
 *
 * `createMachine({ context, initial, states, assigns, conds })` — the
 * config says what the machine IS, the assigns and the guards say what
 * it DOES, each bound to the event it answers. A machine knows nothing
 * about props, hosts, or markup.
 */
export {
  createMachine,
  interpret,
  type Config,
  type EventObject,
  type Implementations,
  type Machine,
  type MachineSpec,
  type Service,
  type State,
  type Transition,
} from "./machine/fsm/machine.ts";
export { defaultTwin, resolveTwins } from "./props.ts";
