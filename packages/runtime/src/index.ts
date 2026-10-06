/** @spin/runtime — reactive core, custom-element registration, and the zag bridge. */

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

export { define, type AttributeParser, type BuildContext, type ElementSpec } from "./element.ts";

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

// Import from `@spin/runtime/zag` where the machine is optional: `@zag-js/core`
// ships no runner, so this module carries an interpreter.
export {
  createMachine,
  normalizeProps,
  type MachineBridge,
  type MachineOptions,
  type Props as MachineProps,
} from "./adapter/index.ts";