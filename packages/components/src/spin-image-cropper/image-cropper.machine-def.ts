import type { MachineDef } from "@spin/runtime";
import { createImageCropperBridge } from "./image-cropper.bridge.ts";
import type {
  ImageCropperCropChange,
  ImageCropperFlipChange,
  ImageCropperRotationChange,
  ImageCropperZoomChange,
} from "./image-cropper.bridge.ts";

/**
 * The image-cropper's seam: the bridge, the element's imperative commands
 * and the CustomEvents the host reads.
 *
 * Events are faithful to Zag's callbacks: `crop-change` carries the rect,
 * `zoom-change` the zoom, `rotation-change` the rotation, `flip-change` the
 * two axes.
 */

export type {
  ImageCropperCropChange,
  ImageCropperFlipChange,
  ImageCropperRotationChange,
  ImageCropperZoomChange,
};

export const imageCropper: MachineDef = {
  createBridge: createImageCropperBridge,
  commands: [
    "setZoom",
    "zoomBy",
    "setRotation",
    "rotateBy",
    "setFlip",
    "flipHorizontal",
    "flipVertical",
    "resize",
    "reset",
    "getCropData",
  ],
  events: {
    "crop-change": {
      on: "onCropChange",
      detail: (change: ImageCropperCropChange) => ({ crop: { ...change.crop } }),
    },
    "zoom-change": {
      on: "onZoomChange",
      detail: (change: ImageCropperZoomChange) => ({ zoom: change.zoom }),
    },
    "rotation-change": {
      on: "onRotationChange",
      detail: (change: ImageCropperRotationChange) => ({ rotation: change.rotation }),
    },
    "flip-change": {
      on: "onFlipChange",
      detail: (change: ImageCropperFlipChange) => ({
        horizontal: change.horizontal,
        vertical: change.vertical,
      }),
    },
  },
};
