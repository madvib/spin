import { machine, connect } from "@zag-js/popover";

/**
 * Machine-def for spin-popover. Plain `{ machine, connect }` pair —
 * the plugin codegen owns createMachine, props, dispose, values.api.
 */
export const popover = { machine, connect };
