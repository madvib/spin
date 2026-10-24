import type { EventUnion } from "@spinjs/runtime/fsm";

export interface ImageCropperEvents {
  "SET_NATURAL_SIZE": { size: { width: number; height: number } };
  "SET_DEFAULT_CROP": {
    viewport: { x: number; y: number; width: number; height: number };
  };
  "SET_VIEWPORT": {
    viewport: { x: number; y: number; width: number; height: number };
  };
  "POINTER_DOWN": { point: { x: number; y: number }; handlePosition?: string };
  "PAN_POINTER_DOWN": { point: { x: number; y: number } };
  "POINTER_MOVE": {
    point: { x: number; y: number };
    shiftKey?: boolean;
    altKey?: boolean;
  };
  "POINTER_UP": {};
  "ZOOM": { delta: number; point?: { x: number; y: number } };
  "SET_ZOOM": { zoom: number };
  "SET_ROTATION": { rotation: number };
  "SET_FLIP": {
    horizontal?: boolean;
    vertical?: boolean;
    flip?: { readonly horizontal?: boolean; readonly vertical?: boolean };
  };
  "NUDGE_RESIZE": { handlePosition: string; large?: boolean };
  "NUDGE_MOVE": { dx: number; dy: number };
  "NUDGE_PAN": { dx: number; dy: number };
  "RESIZE_CROP": { handlePosition: string; delta: { x: number; y: number } };
  "RESET": {};
}

export type ImageCropperEvent = EventUnion<ImageCropperEvents>;

export type ImageCropperCropChange = {
  readonly crop: { x: number; y: number; width: number; height: number };
};

export type ImageCropperZoomChange = {
  readonly zoom: number;
};

export type ImageCropperRotationChange = {
  readonly rotation: number;
};

export type ImageCropperFlipChange = {
  readonly horizontal: boolean;
  readonly vertical: boolean;
};
