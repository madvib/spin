import type { MachineDef } from "@spin/runtime";
import { machine, connect } from "@zag-js/accordion";

/**
 * The accordion's Zag wiring, authored — not generated.
 *
 * `machine` owns disclosure state, `connect` reads it into props. `events`
 * maps each CustomEvent the element emits to the Zag callback prop that
 * fires it, plus the detail mapper. The plugin codegen turns each entry into
 * a machine prop — `(details) => el.dispatchEvent(new CustomEvent(name,
 * { detail: map(details), bubbles: true }))` — so the contract below is the
 * whole out-side of the element's API. A consumer in any framework listens
 * with `addEventListener`; see the specimens accordion route.
 *
 * Zag calls `onValueChange` with `{ value: string[] }` — the open item
 * values, in order. The event is faithful to that: `value-change` carries
 * the same array, not a diffed per-item guess.
 */

export interface AccordionValueChange {
  readonly value: readonly string[];
}
export const accordion: MachineDef = {
  machine: machine as unknown as object,
  connect: connect as unknown as (...args: never[]) => object,
  events: {
    "value-change": {
      on: "onValueChange",
      detail: (change: { value: string[] }): AccordionValueChange => ({
        value: change.value,
      }),
    },
  },
};
