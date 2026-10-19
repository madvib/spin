import { steps } from "./steps.bindings.ts";
import type { StepsInvalid, StepsStepChange } from "./steps.machine.ts";
import type { StepsComplete } from "./steps.bindings.ts";

/**
 * The steps' seam: the synthesized bridge, the element's imperative
 * commands and the CustomEvents the host reads.
 *
 * Events are faithful to Zag's callbacks: `step-change` carries the index
 * on every accepted move, `step-complete` on landing at count,
 * `step-invalid` on a refused forward move.
 */

export { steps };
export type { StepsComplete, StepsInvalid, StepsStepChange };
