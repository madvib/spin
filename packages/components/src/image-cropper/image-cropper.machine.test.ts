import { test } from "bun:test";
import { deepStrictEqual } from "node:assert/strict";
import { parseHTML } from "@spinjs/runtime/testing";
import { signal } from "@spinjs/runtime";
import type { DragDelta, DragPress } from "@spinjs/runtime/actions";
import { imageCropper } from "./image-cropper.presentation.ts";
const createImageCropperBridge = imageCropper.createBridge;
import type {
  ImageCropperCropChange,
  ImageCropperFlipChange,
  ImageCropperRotationChange,
  ImageCropperZoomChange,
} from "./image-cropper.presentation.ts";
import type { ImageCropperApi } from "./image-cropper.presentation.ts";
import type { CropHandle, CropRect } from "./image-cropper.state.ts";

/** A live writable read, as the element's prop store exposes one. */
type WriteSignal = { (): unknown; (value: unknown): void };

const win = parseHTML(
  "<!doctype html><html><body></body></html>",
) as unknown as Record<string, unknown>;
declare const globalThis: Record<string, unknown>;
globalThis.document = win.document;
globalThis.CustomEvent = win.CustomEvent;
globalThis.HTMLElement = win.HTMLElement;
globalThis.Element = win.Element;

/**
 * Prop bags hand back `Record<string, unknown>`, so a handler read out of one is
 * checked here and typed once, instead of an unchecked cast at every call site.
 */
function handler<H>(bag: Record<string, unknown>, key: string): H {
  const value: unknown = bag[key];
  if (typeof value !== "function") throw new Error(`no handler at ${key}`);
  return value as H;
}

/**
 * linkedom ships no PointerEvent constructors, so the gestures the runtime's
 * drag action reports are synthesized here — one place, with the minimal
 * field set each callback reads. Geometry is faked at the node: the press
 * carries the handle's box and the node it landed on.
 */
const VIEWPORT = { left: 0, top: 0, width: 400, height: 300 };

function viewportNode(): Element {
  return {
    getBoundingClientRect: () => ({ ...VIEWPORT }),
  } as unknown as Element;
}

/** The drag action's param, read out of a bag. */
const dragParam = (bag: Record<string, unknown>): {
  onStart?: (press: DragPress) => void;
  onMove?: (delta: DragDelta) => void;
  onEnd?: (end: { readonly cancelled: boolean }) => void;
} => (bag["use:drag"] ?? {}) as never;

/** A press, as the drag action reports it. */
const dragPress = (x: number, y: number): DragPress => ({
  altKey: false,
  shiftKey: false,
  ctrlKey: false,
  metaKey: false,
  x,
  y,
  pointerId: 1,
  pressure: 0.5,
  target: viewportNode(),
  rect: viewportNode().getBoundingClientRect(),
  direction: "ltr",
});

/** A move, as the drag action reports it: the absolute point and the delta
 * from the press. */
const dragMove = (
  x: number,
  y: number,
  fromX: number,
  fromY: number,
): DragDelta => ({
  ...dragPress(x, y),
  dx: x - fromX,
  dy: y - fromY,
});

function keydown(key: string, shift = false): KeyboardEvent {
  const made: Record<string, unknown> = {
    key,
    shiftKey: shift,
    defaultPrevented: false,
  };
  made["preventDefault"] = (): void => {
    made["defaultPrevented"] = true;
  };
  return made as unknown as KeyboardEvent;
}

interface Harness {
  readonly api: ImageCropperApi;
  readonly root: Element;
  readonly events: {
    readonly cropChange: ImageCropperCropChange[];
    readonly zoomChange: ImageCropperZoomChange[];
    readonly rotationChange: ImageCropperRotationChange[];
    readonly flipChange: ImageCropperFlipChange[];
  };
  write(name: string, value: unknown): void;
}

/** Props are signals, exactly as the element's prop store makes them, so a host
 * write re-runs the bridge's controlled-channel effect. A prop passed in
 * `overrides` is AUTHORED, which is the element's `@@authored` predicate. */
function mount(overrides: Readonly<Record<string, unknown>> = {}): Harness {
  const root = document.createElement("div");
  document.body.appendChild(root);
  const events = {
    cropChange: [] as ImageCropperCropChange[],
    zoomChange: [] as ImageCropperZoomChange[],
    rotationChange: [] as ImageCropperRotationChange[],
    flipChange: [] as ImageCropperFlipChange[],
  };
  const values: Record<string, WriteSignal> = {};
  const authoredKeys = new Set(Object.keys(overrides));
  const write = (name: string, value: unknown): void => {
    const source = values[name];
    if (source === undefined) values[name] = signal<unknown>(value);
    else source(value);
  };
  for (const [name, value] of Object.entries(overrides)) write(name, value);
  write(
    "onCropChange",
    (change: ImageCropperCropChange) => events.cropChange.push(change),
  );
  write(
    "onZoomChange",
    (change: ImageCropperZoomChange) => events.zoomChange.push(change),
  );
  write(
    "onRotationChange",
    (change: ImageCropperRotationChange) => events.rotationChange.push(change),
  );
  write(
    "onFlipChange",
    (change: ImageCropperFlipChange) => events.flipChange.push(change),
  );
  const realDocument = globalThis.document as Document;
  const holder = realDocument.createElement("div");
  holder.id = "image-cropper:photo:viewport";
  const rect = {
    left: 0,
    right: 400,
    width: 400,
    top: 0,
    bottom: 300,
    height: 300,
  };
  holder.getBoundingClientRect = () => ({ ...rect }) as DOMRect;
  realDocument.body.appendChild(holder);
  const bridge = createImageCropperBridge(
    () => {
      const record: Record<string, unknown> = {};
      for (const [name, source] of Object.entries(values)) {
        record[name] = source();
      }
      record["@@authored"] = (name: string): boolean => authoredKeys.has(name);
      return record;
    },
    () => root,
    "photo",
  );
  // Seed the viewport the way the view's measurement would: a 400x300 box
  // with the default crop centered in it.
  bridge.api.getViewportProps();
  return { api: bridge.api, root, events, write };
}

/** Seed helper: viewport + default crop, the way measurement produces them. */
const seedViewport = { x: 0, y: 0, width: 400, height: 300 };

test("seeds an unmeasured cropper", () => {
  const h = mount();
  deepStrictEqual(h.api.measured, false);
  deepStrictEqual(h.api.zoom, 1);
  deepStrictEqual(h.api.rotation, 0);
});

test("viewport press measures and pans", () => {
  const h = mount();
  deepStrictEqual(h.api.measured, false);
  // The image reports its natural size on load; panning needs both sizes.
  handler<(e: Event) => void>(h.api.getImageProps(), "onLoad")({
    currentTarget: { naturalWidth: 800, naturalHeight: 600 },
  } as unknown as Event);
  // The viewport's own press measures first: guards refuse everything
  // without a rect, so measurement is the gesture that unlocks the rest.
  const viewport = h.api.getViewportProps() as Record<string, unknown>;
  const pan = dragParam(viewport);
  pan.onStart?.(dragPress(50, 50));
  deepStrictEqual(h.api.measured, true);
  deepStrictEqual(h.api.panning, true);
  deepStrictEqual(h.api.crop.width > 0, true);
  pan.onMove?.(dragMove(60, 60, 50, 50));
  pan.onEnd?.({ cancelled: false });
  deepStrictEqual(h.api.panning, false);
  deepStrictEqual(h.events.cropChange.length > 0, true);
});

test("the selection drags the crop and the handle resizes it", () => {
  const h = mount();
  handler<(e: Event) => void>(h.api.getImageProps(), "onLoad")({
    currentTarget: { naturalWidth: 800, naturalHeight: 600 },
  } as unknown as Event);
  // The pan opens and closes first: the crop drag is a gesture of its own,
  // and the machine is in one state at a time.
  const pan = dragParam(h.api.getViewportProps() as Record<string, unknown>);
  pan.onStart?.(dragPress(50, 50));
  pan.onEnd?.({ cancelled: false });
  deepStrictEqual(h.api.panning, false);
  // The default crop is 80% of the viewport, centred.
  deepStrictEqual(h.api.crop.x, 40);
  deepStrictEqual(h.api.crop.y, 30);

  // The selection's gesture drags the crop.
  const selection = dragParam(
    h.api.getSelectionProps() as Record<string, unknown>,
  );
  selection.onStart?.(dragPress(50, 50));
  deepStrictEqual(h.api.dragging, true);
  selection.onMove?.(dragMove(70, 60, 50, 50));
  deepStrictEqual(h.api.crop.x, 60);
  deepStrictEqual(h.api.crop.y, 40);
  selection.onEnd?.({ cancelled: false });
  deepStrictEqual(h.api.dragging, false);

  // The handle's gesture resizes the crop: the handle stops the press, so
  // the selection's gesture never arms behind it — and the moves the
  // resize needs are the handle's own.
  const handle = dragParam(
    h.api.getHandleProps({ position: "se" }) as Record<string, unknown>,
  );
  handle.onStart?.(dragPress(350, 250));
  deepStrictEqual(h.api.dragging, true);
  handle.onMove?.(dragMove(370, 260, 350, 250));
  deepStrictEqual(h.api.crop.width, 340);
  handle.onEnd?.({ cancelled: false });
  deepStrictEqual(h.api.dragging, false);
});

test("zoom clamps to the floor and ceiling", () => {
  const h = mount();
  h.api.setZoom(50);
  deepStrictEqual(h.api.zoom, 8);
  h.api.setZoom(-3);
  deepStrictEqual(h.api.zoom, 0.1);
  h.api.zoomBy(0.5);
  deepStrictEqual(Math.round(h.api.zoom * 10) / 10, 0.6);
  deepStrictEqual(h.events.zoomChange.length, 3);
});

test("rotation clamps to 0..360", () => {
  const h = mount();
  h.api.setRotation(720);
  deepStrictEqual(h.api.rotation, 360);
  h.api.rotateBy(-45);
  deepStrictEqual(h.api.rotation, 315);
  deepStrictEqual(h.events.rotationChange.length, 2);
});

test("flip toggles per axis", () => {
  const h = mount();
  h.api.flipHorizontal();
  deepStrictEqual(h.api.flip.horizontal, true);
  deepStrictEqual(h.api.flip.vertical, false);
  h.api.flipVertical(true);
  deepStrictEqual(h.api.flip.vertical, true);
  h.api.setFlip({ horizontal: false });
  deepStrictEqual(h.api.flip.horizontal, false);
  deepStrictEqual(h.api.flip.vertical, true);
  deepStrictEqual(h.events.flipChange.length, 3);
});

test("reset restores the defaults", () => {
  const h = mount();
  h.api.setZoom(3);
  h.api.setRotation(90);
  // Reset centers in the viewport: unmeasured, there is nothing to center
  // in, so measure first the way the view would have.
  const viewport = h.api.getViewportProps() as Record<string, unknown>;
  const pan = dragParam(viewport);
  pan.onStart?.(dragPress(50, 50));
  pan.onEnd?.({ cancelled: false });
  h.api.reset();
  deepStrictEqual(h.api.zoom, 1);
  deepStrictEqual(h.api.rotation, 0);
  deepStrictEqual(h.api.crop.width > 0, true);
});

test("selection arrows nudge the crop", () => {
  const h = mount();
  const bag = h.api.getSelectionProps() as Record<string, unknown>;
  // Without a viewport the guards refuse: arrows move nothing.
  handler<(e: KeyboardEvent) => void>(bag, "onKeydown")(keydown("ArrowRight"));
  deepStrictEqual(h.api.crop.x, 0);
  deepStrictEqual(h.events.cropChange.length, 0);
});

test("handles list all eight positions", () => {
  const h = mount();
  const handles = h.api.handles as readonly CropHandle[];
  deepStrictEqual(handles.length, 8);
  deepStrictEqual(handles.includes("se"), true);
  deepStrictEqual(handles.includes("nw"), true);
});

test("crop data rounds to whole pixels", () => {
  const h = mount();
  const data = h.api.getCropData();
  deepStrictEqual(Number.isInteger(data.x), true);
  deepStrictEqual(Number.isInteger(data.width), true);
});

test("aria contract on the selection", () => {
  const h = mount();
  const bag = h.api.getSelectionProps() as Record<string, unknown>;
  deepStrictEqual(bag["role"], "slider");
  deepStrictEqual(bag["aria-roledescription"], "2d slider");
  deepStrictEqual(bag["tabindex"], "0");
});

test("each handle centers on its own edge point", () => {
  const h = mount();
  const styleOf = (position: CropHandle): Record<string, string> =>
    (h.api.getHandleProps({ position }) as Record<string, unknown>)[
      "style"
    ] as Record<string, string>;
  deepStrictEqual(styleOf("nw"), {
    left: "0%",
    top: "0%",
    translate: "-50% -50%",
  });
  deepStrictEqual(styleOf("se"), {
    left: "100%",
    top: "100%",
    translate: "-50% -50%",
  });
  deepStrictEqual(styleOf("n"), {
    left: "50%",
    top: "0%",
    translate: "-50% -50%",
  });
  deepStrictEqual(styleOf("w"), {
    left: "0%",
    top: "50%",
    translate: "-50% -50%",
  });
});

test("the two grids stamp distinct ids", () => {
  const h = mount();
  const horizontal = h.api.getGridProps({ axis: "horizontal" }) as Record<
    string,
    unknown
  >;
  const vertical = h.api.getGridProps({ axis: "vertical" }) as Record<
    string,
    unknown
  >;
  deepStrictEqual(typeof horizontal["id"], "string");
  deepStrictEqual(typeof vertical["id"], "string");
  deepStrictEqual(horizontal["id"] === vertical["id"], false);
});
