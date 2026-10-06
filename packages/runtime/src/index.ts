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

// Import from `@spin/runtime/zag` where the machine is optional: `@zag-js/core`
// ships no runner, so this module carries an interpreter.
export {
  createMachine,
  normalizeProps,
  type MachineBridge,
  type MachineOptions,
  type Props as MachineProps,
} from "./adapter/index.ts";