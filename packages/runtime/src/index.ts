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

export { define, type AttributeParser, type BuildContext, type ElementSpec } from "./scope/element.ts";
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
