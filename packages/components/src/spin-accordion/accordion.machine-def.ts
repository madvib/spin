import { machine, connect } from "@zag-js/accordion";

/**
 * Machine-def for spin-accordion. Plain `{ machine, connect }` pair —
 * the plugin codegen owns createMachine, props, dispose, values.api.
 */
export const accordion = { machine, connect };
