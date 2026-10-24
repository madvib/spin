import type { EventUnion } from "@spinjs/runtime/fsm";
import type { DrawingTuning, SignaturePoint } from "./signature-pad.state.ts";

export interface SignaturePadEvents {
  "POINTER_DOWN": { point: SignaturePoint; pressure?: number };
  "POINTER_MOVE": { point: SignaturePoint; pressure?: number };
  "POINTER_UP": {};
  "CLEAR": {};
  "SET_PATHS": { paths: string[] };
  "SET_TUNING": { tuning: Partial<DrawingTuning> };
}

export type SignaturePadEvent = EventUnion<SignaturePadEvents>;

export type SignaturePadDrawDetails = {
  readonly paths: string[];
  readonly currentPath: string | null;
};
