import { tour } from "./tour.def.ts";
import type { TourDismissChange, TourStepChange, TourStepRecord } from "./tour.def.ts";

/**
 * The tour's seam: the synthesized bridge, the element's imperative
 * commands, and the CustomEvents the host reads.
 *
 * Events are faithful to Zag's callbacks: `start` carries `onStart`,
 * `step-change` carries `onStepChange`, `dismiss` carries `onDismiss`
 * with the reason (a complete at the last step, a dismiss, a skip, or a
 * not-found), and `complete` carries `onComplete`.
 */

export { tour };
export type { TourDismissChange, TourStepChange, TourStepRecord };
