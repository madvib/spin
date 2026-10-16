import { floatingPanel } from "./floating-panel.def.ts";
import type { FloatingPanelSize, FloatingPanelStage } from "./floating-panel.def.ts";

/**
 * The floating-panel's seam: the synthesized bridge, the element's
 * imperative commands, and the CustomEvents the host reads.
 *
 * Events are faithful to Zag's callbacks: `open-change` carries
 * `onOpenChange`, `size-change` carries `onSizeChange`,
 * `position-change` carries `onPositionChange`, and `stage-change`
 * carries `onStageChange`.
 */

export { floatingPanel };
export type { FloatingPanelSize, FloatingPanelStage };
