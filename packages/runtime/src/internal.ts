/**
 * The compiler's ABI. Not the language.
 *
 * Everything here is written into generated code by the emitter, or by the zag
 * adapter. No human types `bindFor` or `runAction`.
 *
 * These are imports of the modules, not re-exports of the root: the ABI is the
 * same functions the author surface carries, reached by their own paths. A
 * missing entry here is a compile error in the emitter, never a silent
 * re-export of whatever the root happens to carry. Adding a symbol means
 * adding its module path here and deciding separately whether it belongs on
 * the root.
 */

export { runAction, type ElementAction, type SlotLookup } from "./use.ts";
export { on } from "./use.ts";
export {
  bindAttr,
  bindChecked,
  bindDynamic,
  bindProp,
  bindText,
  bindValue,
  type Binding,
  type Writable,
} from "./bind.ts";
export { bindFor, type BindForOptions, type RenderedItem } from "./for.ts";
export { bindIf, type BindIfOptions, type BranchRender } from "./if.ts";
export { text, tpl, view, type ReactiveText, type Rendered } from "./tpl.ts";
export { useMachine, type MachineApi, type MachineService } from "./machine.ts";
export { zag, type ZagApi, type ZagGetter } from "./zag-action.ts";
export { define, type AttributeParser, type BuildContext, type ElementSpec } from "./element.ts";
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
} from "./signal.ts";
export {
  createMachine,
  createBindable,
  normalizeProps,
  toStyleString,
} from "./adapter/index.ts";
export type {
  MachineBridge,
  MachineOptions,
  Normalize,
  Props,
} from "./adapter/index.ts";
