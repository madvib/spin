/**
 * The compiler's ABI. Not the language.
 *
 * Everything here is written into generated code by the emitter, or by the zag
 * bridge. No human types `spreadProps` or `bindFor`.
 *
 * Curated, never `export * from "./index"`: a missing ABI export must be a
 * compile error in the emitter, not a silent re-export of whatever the root
 * happens to carry. Adding a symbol means adding it here and keeping it off the
 * root.
 */

// The adapter, which is both an emitter target and a public entry.
export {
  createMachine,
  createBindable,
  normalizeProps,
  spreadProps,
  toStyleString,
} from "./adapter/index.ts";
export type {
  MachineBridge,
  MachineOptions,
  Normalize,
  Props,
} from "./adapter/index.ts";

// Element registration and the reactive core are emitted against as well as
// authored against.
export { define } from "./element.ts";
export type { AttributeParser, BuildContext, ElementSpec } from "./element.ts";
export {
  batch,
  computed,
  effect,
  own,
  scope,
  signal,
  trigger,
  untrack,
} from "./signal.ts";
export type { OwnerScope } from "./signal.ts";
