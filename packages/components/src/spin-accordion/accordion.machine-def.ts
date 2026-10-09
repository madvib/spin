import type { MachineDef } from "@spin/runtime";
import { machine, connect } from "@zag-js/accordion";
import { accordion as robotAccordion } from "./accordion.robot-def.ts";

declare const __SPIN_ROBOT_ACCORDION__: boolean | undefined;

/**
 * The accordion's wiring, authored — not generated.
 *
 * `machine` owns disclosure state, `connect` reads it into props. `events`
 * maps each CustomEvent the element emits to the callback prop that fires
 * it, plus the detail mapper. The plugin codegen turns each entry into a
 * machine prop — `(details) => el.dispatchEvent(new CustomEvent(name,
 * { detail: map(details), bubbles: true }))` — so the contract below is the
 * whole out-side of the element's API. A consumer in any framework listens
 * with `addEventListener`; see the specimens accordion route.
 *
 * Two implementations behind one export: the Zag machine (default) and a
 * robot3 port selected with `SPIN_ACCORDION=robot` at build time (a vite
 * `define` — `process.env` does not exist in the browser, and a runtime
 * check would ship both interpreters while always running Zag). Same
 * `events` contract, same markup spreads — the swap exercises whether the
 * component's behavior survives a change of interpreter. Delete the loser
 * when the A/B ends.
 */

export interface AccordionValueChange {
  readonly value: readonly string[];
}

const useRobot = typeof __SPIN_ROBOT_ACCORDION__ !== "undefined" && __SPIN_ROBOT_ACCORDION__ === true;

const zagDef: MachineDef = {
  machine,
  connect,
  events: {
    "value-change": {
      on: "onValueChange",
      detail: (change: { value: string[] }): AccordionValueChange => ({
        value: change.value,
      }),
    },
  },
};

export const accordion: MachineDef = useRobot ? robotAccordion : zagDef;
