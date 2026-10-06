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
export { parse } from "./directives/parse.ts";
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
  TextNode,
} from "./directives/ir.ts";
export { ParseError } from "./directives/ir.ts";
export { useMachine, type MachineApi, type MachineService } from "./machine/machine.ts";
export { createZagAction, type ZagApi, type ZagGetter } from "./machine/zag-action.ts";

export {
  createMachine,
  normalizeProps,
  type MachineBridge,
  type MachineOptions,
  type Props as MachineProps,
} from "./machine/adapter/index.ts";
export { load, type LoaderActions, type LoaderScope } from "./directives/load.ts";
