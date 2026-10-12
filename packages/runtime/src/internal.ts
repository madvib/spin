/**
 * The compiler's ABI. Not the language.
 *
 * Everything here is written into generated code by the emitter. No human
 * types `bindFor` or `runAction`.
 *
 * These are imports of the modules, not re-exports of the root: the ABI is the
 * same functions the author surface carries, reached by their own paths. A
 * missing entry here is a compile error in the emitter, never a silent
 * re-export of whatever the root happens to carry. Adding a symbol means
 * adding its module path here and deciding separately whether it belongs on
 * the root.
 */

export { runAction, type ElementAction, type SlotLookup } from "./directives/use.ts";
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
export { define, type AttributeParser, type BuildContext, type ElementSpec } from "./scope/element.ts";
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
export { load } from "./directives/load.ts";
export { bindActionProps, bindSpread } from "./directives/spread.ts";
