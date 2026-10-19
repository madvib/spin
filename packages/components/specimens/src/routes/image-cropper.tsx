import { createEffect, createSignal } from "solid-js";
import { createSpinComponent } from "@spin/hooks/solid";
import type {
  ImageCropperCropChange,
  ImageCropperFlipChange,
  ImageCropperRotationChange,
  ImageCropperZoomChange,
} from "../../../src/spin-image-cropper/image-cropper.bindings.ts";
import type { CropHandle, CropRect } from "../../../src/spin-image-cropper/image-cropper.machine.ts";
import { DEMO_BUTTON } from "../demo-button.ts";
import { DemoCard } from "../demo-card.tsx";
import { DemoControls } from "../demo-controls.tsx";
import { DemoGrid } from "../demo-grid.tsx";
import { DemoReadout } from "../demo-readout.tsx";

interface ImageCropperCommands {
  setZoom: (zoom: number) => void;
  zoomBy: (delta: number) => void;
  setRotation: (rotation: number) => void;
  rotateBy: (degrees: number) => void;
  setFlip: (flip: { horizontal?: boolean; vertical?: boolean }) => void;
  flipHorizontal: (value?: boolean) => void;
  flipVertical: (value?: boolean) => void;
  resize: (handlePosition: CropHandle, delta: number) => void;
  reset: () => void;
  getCropData: () => CropRect;
}

/** A data-URL test card: a real image the cropper can measure, with no
 * network behind it. */
const TEST_IMAGE =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="#0ea5e9"/><circle cx="400" cy="300" r="120" fill="#f59e0b"/><rect x="100" y="100" width="200" height="150" fill="#10b981"/></svg>`,
  );

/**
 * Image-cropper on the forked FSM: idle, dragging the selection, panning
 * the image.
 *
 * The claim under test: Zag's three states port flat with the guards where
 * Zag put them (viewport measured, area not fixed), rects travel as plain
 * data through Zag's pure geometry utils, and measurement stays in the view
 * — the viewport reports its rect, the image its natural size.
 */
export default function ImageCropperFsm() {
  const [crop, setCrop] = createSignal("unmeasured");
  const [zoom, setZoom] = createSignal("1");
  const [rotation, setRotation] = createSignal("0");

  const [photoEl, setPhoto] = createSignal<HTMLElement>();
  const photo = createSpinComponent<ImageCropperCommands>(photoEl);
  createEffect(() => {
    const ctl = photo();
    if (ctl === undefined) return undefined;
    return ctl.bind({
      src: TEST_IMAGE,
      alt: "Test card",
    }, {
      "crop-change": (event: CustomEvent<ImageCropperCropChange>) => {
        const c = event.detail.crop;
        setCrop(`${Math.round(c.x)},${Math.round(c.y)} ${Math.round(c.width)}x${Math.round(c.height)}`);
      },
      "zoom-change": (event: CustomEvent<ImageCropperZoomChange>) =>
        setZoom(String(Math.round(event.detail.zoom * 100) / 100)),
      "rotation-change": (event: CustomEvent<ImageCropperRotationChange>) =>
        setRotation(String(event.detail.rotation)),
      "flip-change": (_event: CustomEvent<ImageCropperFlipChange>) => undefined,
    });
  });

  return (
    <DemoGrid>
      <DemoCard
        title="Drag, pan, zoom"
        width="lg"
        note="Drag the selection to move it, the handles to resize, the empty viewport to pan. Plus and minus zoom."
      >
        <spin-image-cropper
          id="photo"
          ref={setPhoto}
          prop:src={TEST_IMAGE}
          prop:alt="Test card"
        />
        <DemoControls>
          <button
            type="button"
            class={DEMO_BUTTON}
            onClick={() => photo()?.commands.zoomBy(0.5)}
          >
            el.zoomBy(0.5)
          </button>
          <button
            type="button"
            class={DEMO_BUTTON}
            onClick={() => photo()?.commands.rotateBy(90)}
          >
            el.rotateBy(90)
          </button>
          <button
            type="button"
            class={DEMO_BUTTON}
            onClick={() => photo()?.commands.flipHorizontal()}
          >
            el.flipHorizontal()
          </button>
          <button
            type="button"
            class={DEMO_BUTTON}
            onClick={() => photo()?.commands.reset()}
          >
            el.reset()
          </button>
        </DemoControls>
        <DemoReadout>
          crop: {crop()} · zoom: {zoom()} · rotation: {rotation()}
        </DemoReadout>
      </DemoCard>
    </DemoGrid>
  );
}
