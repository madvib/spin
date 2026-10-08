import { machine, connect } from "@zag-js/dialog";

/**
 * Machine-def for spin-dialog. Plain `{ machine, connect }` pair —
 * the plugin codegen owns createMachine, props, dispose, values.api.
 */
export const dialog = { machine, connect };
