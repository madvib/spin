import type { EventUnion } from "@spinjs/runtime/fsm";
import type {
  FloatingPanelSize,
  FloatingPanelStage,
} from "./floating-panel.state.ts";

export interface FloatingPanelEvents {
  "OPEN": {};
  "CLOSE": {};
  "DRAG.START": {};
  "DRAG.MOVE": { dx: number; dy: number };
  "DRAG.END": {};
  "RESIZE.START": { x: -1 | 0 | 1; y: -1 | 0 | 1 };
  "RESIZE.MOVE": { dx: number; dy: number };
  "RESIZE.END": {};
  "ESCAPE": {};
  "MINIMIZE": {};
  "MAXIMIZE": {};
  "RESTORE": {};
  "SIZE.SET": { size: FloatingPanelSize | string };
}

export type FloatingPanelEvent = EventUnion<FloatingPanelEvents>;

export interface FloatingPanelOpenChange {
  readonly open: boolean;
}

export interface FloatingPanelSizeChange {
  readonly size: FloatingPanelSize;
}

export interface FloatingPanelPositionChange {
  readonly position: { readonly x: number; readonly y: number };
}

export interface FloatingPanelStageChange {
  readonly stage: FloatingPanelStage;
}
