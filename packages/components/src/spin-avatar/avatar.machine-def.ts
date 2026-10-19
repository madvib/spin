import { avatar } from "./avatar.bindings.ts";
import type { AvatarStatusChange } from "./avatar.machine.ts";

/**
 * The avatar's seam: the synthesized bridge, the element's imperative
 * commands and the CustomEvents the host reads.
 *
 * Events are faithful to Zag's callbacks: `status-change` carries loading,
 * error, or loaded on every transition.
 */

export { avatar };
export type { AvatarStatusChange };
