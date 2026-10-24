import type { EventUnion } from "@spinjs/runtime/fsm";
import type { ColorChannel } from "@zag-js/color-utils";
import type { ColorFormat } from "./color-picker.state.ts";

export interface ColorPickerEvents {
  "VALUE.SET": { value: string };
  "FORMAT.SET": { format: ColorFormat | string };
  "OPEN": {};
  "CLOSE": {};
  "CONTROLLED.OPEN": {};
  "CONTROLLED.CLOSE": {};
  "TRIGGER.CLICK": {};
  "TRIGGER.BLUR": {};
  "LAYER.INTERACT_OUTSIDE": {};
  "CHANNEL_INPUT.FOCUS": { channel: ColorChannel | "hex" };
  "CHANNEL_INPUT.BLUR": { channel: ColorChannel | "hex"; value: string };
  "CHANNEL_INPUT.CHANGE": { channel: ColorChannel | "hex"; value: string };
  "AREA.POINTER_DOWN": { x: number; y: number };
  "AREA.ACTIVATE": {};
  "AREA.POINTER_MOVE": { x: number; y: number };
  "AREA.POINTER_UP": {};
  "AREA.ARROW": { channel: "x" | "y"; delta: number };
  "AREA.HOME_END": { channel: "x" | "y"; toMax: boolean };
  "CHANNEL_SLIDER.POINTER_DOWN": { channel: ColorChannel; percent: number };
  "CHANNEL_SLIDER.ACTIVATE": { channel: ColorChannel };
  "CHANNEL_SLIDER.POINTER_MOVE": { channel: ColorChannel; percent: number };
  "CHANNEL_SLIDER.POINTER_UP": {};
  "CHANNEL_SLIDER.ARROW": { channel: ColorChannel; delta: number };
  "CHANNEL_SLIDER.HOME_END": { channel: ColorChannel; toMax: boolean };
  "SWATCH_TRIGGER.CLICK": { value: string };
  "EYEDROPPER.CLICK": {};
}

export type ColorPickerEvent = EventUnion<ColorPickerEvents>;

export interface ColorPickerValueChange {
  readonly value: string;
  readonly format: ColorFormat;
}

export interface ColorPickerOpenChange {
  readonly open: boolean;
}

export interface ColorPickerFormatChange {
  readonly format: ColorFormat;
}
