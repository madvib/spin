import { machine, connect } from "@zag-js/menu";

/**
 * Machine-def for spin-menu. Plain `{ machine, connect }` pair —
 * the plugin codegen owns createMachine, props, dispose, values.api.
 *
 * The scope declares `open` with no default: any value there is Zag's
 * controlled mode, which pins the menu to that value until a writer moves it,
 * so the trigger could never open it. `defaultOpen` carries the initial state.
 */
export const menu = { machine, connect };
