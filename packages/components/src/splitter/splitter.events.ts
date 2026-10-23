import type { EventUnion } from "@spin/runtime/fsm";

export interface SplitterEvents {
  "SET_SIZE": { size: readonly number[] };
  "RESET_SIZE": {};
  "COLLAPSE_PANEL": { id: string };
  "EXPAND_PANEL": { id: string; minSize?: number };
  "RESIZE_PANEL": { id: string; size: number };
  "POINTER_OVER": { id: string };
  "POINTER_LEAVE": {};
  "FOCUS": { id: string };
  "BLUR": {};
  "POINTER_DOWN": { id: string; startPercent: number };
  "POINTER_MOVE": { percent: number };
  "POINTER_UP": { handleFocused: boolean };
  "KEYBOARD_MOVE": { id: string; delta: number };
  "ENTER": { id: string };
  "SET_PANELS": { panels: unknown };
}

export type SplitterEvent = EventUnion<SplitterEvents>;

export type SplitterResizeDetails = {
  readonly size: number[];
  readonly handleId: string | null;
};
