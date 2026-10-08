import { machine, connect } from "@zag-js/tabs";

/**
 * Machine-def for spin-tabs. Plain `{ machine, connect }` pair —
 * the plugin codegen owns createMachine, props, dispose, values.api.
 */
export const tabs = { machine, connect };