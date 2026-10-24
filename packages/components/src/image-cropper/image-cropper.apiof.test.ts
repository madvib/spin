import { assertEquals } from "@std/assert";
import type { ImageCropperApi } from "./image-cropper.presentation.ts";
import type { CropRect } from "./image-cropper.state.ts";

// The derived api's public surface, pinned: removing a reader, method,
// command, part, or slot from the def removes it here, and this test
// names what the component promises. The def is the single source —
// this list is the contract readers check against, not a second copy.
Deno.test("ImageCropperApi promises the component's surface", () => {
  const keys: (keyof ImageCropperApi)[] = [
    "state",
    "handles",
    "crop",
    "zoom",
    "rotation",
    "flip",
    "dragging",
    "panning",
    "measured",
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
    "getRootProps",
    "getViewportProps",
    "getImageProps",
    "getSelectionProps",
    "getHandleProps",
    "getGridProps",
  ];
  assertEquals(keys.length, 25);
  // Derived member signatures: state union, typed command tuples, typed
  // methods, and typed slot parameter records.
  type AssertExact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false)
    : false;
  const stateTyped: AssertExact<
    ImageCropperApi["state"],
    "idle" | "dragging" | "panning"
  > = true;
  const setZoomTyped: AssertExact<
    ImageCropperApi["setZoom"],
    (zoom: number) => void
  > = true;
  const getCropDataTyped: AssertExact<
    ImageCropperApi["getCropData"],
    () => CropRect
  > = true;
  assertEquals(
    [
      stateTyped,
      setZoomTyped,
      getCropDataTyped,
    ].every(Boolean),
    true,
  );
});
