/**
 * @spin/runtime — the reactive core a component runs on, and the two layers
 * that turn a Zag machine into an element.
 *
 * The core is alien-signals' `signal`, `computed`, `effect` and `trigger`,
 * plus the three primitives the library has no reason to provide — `batch`,
 * `untrack`, and a `scope` object whose `dispose` reaches every effect created
 * inside its `run`.
 *
 * `element` is the custom-element registration: property props, a scope per
 * connection, cascade on disconnect. It has no Zag in it, so a component with no
 * machine does not pay for one.
 *
 * `zag` is the bridge, and it is a subpath as well as an export here. It is
 * heavy: `@zag-js/core` ships no runner, so this module reimplements zag's
 * interpreter over alien-signals and then makes the connected API live. Import
 * it from `@spin/runtime/zag` where a bundler can see that the machine is
 * optional.
 */

// The reactive core.
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

// Custom elements. No Zag, deliberately.
export { define, type AttributeParser, type BuildContext, type ElementSpec } from "./element.ts";

// The Zag bridge.
export {
  createMachine,
  domNormalize,
  type MachineBridge,
  type MachineOptions,
  type Normalize,
  type Props as MachineProps,
} from "./zag.ts";