import { imageCropper } from "./image-cropper.bindings.ts";
import type {
  ImageCropperCropChange,
  ImageCropperFlipChange,
  ImageCropperRotationChange,
  ImageCropperZoomChange,
} from "./image-cropper.bindings.ts";

/**
 * The image-cropper's seam: the synthesized bridge, the element's
 * imperative commands and the CustomEvents the host reads.
 *
 * Events are faithful to Zag's callbacks: `crop-change` carries the rect,
 * `zoom-change` the zoom, `rotation-change` the rotation, `flip-change`
 * the two axes. `getCropData` is a read on the api, not a command.
 */

export { imageCropper };
export type {
  ImageCropperCropChange,
  ImageCropperFlipChange,
  ImageCropperRotationChange,
  ImageCropperZoomChange,
};
