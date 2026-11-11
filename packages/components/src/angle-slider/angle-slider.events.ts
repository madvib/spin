import type { EventUnion } from "@spinjs/components/fsm";

export interface AngleSliderEvents {
  "VALUE.SET": { value: number };
  "CONTROL.POINTER_DOWN": { rawAngle: number; angularOffset: number | null };
  "DOC.POINTER_MOVE": { rawAngle: number };
  "DOC.POINTER_UP": {};
  "THUMB.FOCUS": {};
  "THUMB.BLUR": {};
  "THUMB.ARROW_DEC": { step?: number };
  "THUMB.ARROW_INC": { step?: number };
  "THUMB.HOME": {};
  "THUMB.END": {};
}

export type AngleSliderEvent = EventUnion<AngleSliderEvents>;

export type AngleSliderValueChange = {
  readonly value: number;
  readonly valueAsDegree: string;
};
