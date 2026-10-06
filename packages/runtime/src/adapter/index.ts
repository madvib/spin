/**
 * Our zag framework adapter.
 *
 * Zag's contract is three responsibilities: bind the machine, normalize the
 * prop bags, and apply them to elements. The interpreter lives here because
 * `@zag-js/core` ships none — it exists inside the framework adapters.
 */

export { createMachine, normalizeProps } from "./machine.ts";
export type { MachineBridge, MachineOptions, Normalize, Props } from "./machine.ts";
export { createBindable } from "./bindable.ts";
export { toStyleString } from "./normalize-props.ts";
