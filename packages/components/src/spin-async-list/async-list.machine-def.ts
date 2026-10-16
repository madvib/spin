import { asyncList } from "./async-list.def.ts";
import type { AsyncListFailure, AsyncListSuccess } from "./async-list.def.ts";
/**
 * The async-list's seam: the synthesized bridge, the element's
 * imperative commands and the CustomEvents the host reads.
 *
 * Events are faithful to Zag's callbacks: `load-success` carries
 * `onSuccess` with the items the resolved page contributed, `load-error`
 * carries `onError` with the failure. Zag's `abort` is not reported: an
 * abort is the host's own decision, and the load it stopped never returns
 * anything.
 */

export { asyncList };
export type { AsyncListFailure, AsyncListSuccess };
