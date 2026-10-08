import { machine, connect } from "@zag-js/tooltip";


/**
 * Machine-def for spin-tooltip. Plain `{ machine, connect }` pair —
 * the plugin codegen owns createMachine, props, dispose, values.api.
 */
export const tooltip = { machine, connect };
