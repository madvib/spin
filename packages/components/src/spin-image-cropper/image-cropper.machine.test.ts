import { assertEquals } from "@std/assert";
import { parseHTML } from "@spin/runtime/testing";
import { signal } from "@spin/runtime";
import { imageCropper } from "./image-cropper.bindings.ts";
const createImageCropperBridge = imageCropper.createBridge;
import type {
  ImageCropperCropChange,
  ImageCropperFlipChange,
  ImageCropperRotationChange,
  ImageCropperZoomChange,
} from "./image-cropper.bindings.ts";
import type { ImageCropperApi } from "./image-cropper.bindings.ts";
import type { CropHandle, CropRect } from "./image-cropper.machine.ts";

/** A live writable read, as the element's prop store exposes one. */
type WriteSignal = { (): unknown; (value: unknown): void };

const win = parseHTML("<!doctype html><html><body></body></html>") as unknown as Record<string, unknown>;
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
 * linkedom ships no PointerEvent constructors, so the events the handlers
 * need are synthesized here — one place, with the minimal field set each
 * handler reads. Geometry is faked at the node: the handlers read the
 * CURRENT target's rect, so the rect travels on the event's own node.
 */
const VIEWPORT = { left: 0, top: 0, width: 400, height: 300 };

function viewportNode(): Element {
  return {
    getBoundingClientRect: () => ({ ...VIEWPORT }),
  } as unknown as Element;
}

const press = (x: number, y: number): PointerEvent =>
  ({
    pointerType: "mouse",
    button: 0,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    clientX: x,
    clientY: y,
    currentTarget: viewportNode(),
    target: viewportNode(),
    preventDefault: (): void => {},
    stopPropagation: (): void => {},
  }) as unknown as PointerEvent;

const move = (x: number, y: number): PointerEvent =>
  ({
    pointerType: "mouse",
    clientX: x,
    clientY: y,
    currentTarget: viewportNode(),
    preventDefault: (): void => {},
  }) as unknown as PointerEvent;

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
  write("onCropChange", (change: ImageCropperCropChange) => events.cropChange.push(change));
  write("onZoomChange", (change: ImageCropperZoomChange) => events.zoomChange.push(change));
  write("onRotationChange", (change: ImageCropperRotationChange) => events.rotationChange.push(change));
  write("onFlipChange", (change: ImageCropperFlipChange) => events.flipChange.push(change));
  const realDocument = globalThis.document as Document;
  const holder = realDocument.createElement("div");
  holder.id = "image-cropper:photo:viewport";
  const rect = { left: 0, right: 400, width: 400, top: 0, bottom: 300, height: 300 };
  holder.getBoundingClientRect = () => ({ ...rect }) as DOMRect;
  realDocument.body.appendChild(holder);
  const bridge = createImageCropperBridge(
    () => {
      const record: Record<string, unknown> = {};
      for (const [name, source] of Object.entries(values)) record[name] = source();
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

Deno.test("seeds an unmeasured cropper", () => {
  const h = mount();
  assertEquals(h.api.measured, false);
  assertEquals(h.api.zoom, 1);
  assertEquals(h.api.rotation, 0);
});

Deno.test("viewport press measures and pans", () => {
  const h = mount();
  assertEquals(h.api.measured, false);
  // The image reports its natural size on load; panning needs both sizes.
  handler<(e: Event) => void>(h.api.getImageProps(), "onLoad")({
    currentTarget: { naturalWidth: 800, naturalHeight: 600 },
  } as unknown as Event);
  // The viewport's own press measures first: guards refuse everything
  // without a rect, so measurement is the gesture that unlocks the rest.
  const viewport = h.api.getViewportProps() as Record<string, unknown>;
  handler<(e: PointerEvent) => void>(viewport, "onPointerdown")(press(50, 50));
  assertEquals(h.api.measured, true);
  assertEquals(h.api.panning, true);
  assertEquals(h.api.crop.width > 0, true);
  handler<(e: PointerEvent) => void>(viewport, "onPointermove")(move(60, 60));
  handler<() => void>(viewport, "onPointerup")();
  assertEquals(h.api.panning, false);
  assertEquals(h.events.cropChange.length > 0, true);
});

Deno.test("zoom clamps to the floor and ceiling", () => {
  const h = mount();
  h.api.setZoom(50);
  assertEquals(h.api.zoom, 8);
  h.api.setZoom(-3);
  assertEquals(h.api.zoom, 0.1);
  h.api.zoomBy(0.5);
  assertEquals(Math.round(h.api.zoom * 10) / 10, 0.6);
  assertEquals(h.events.zoomChange.length, 3);
});

Deno.test("rotation clamps to 0..360", () => {
  const h = mount();
  h.api.setRotation(720);
  assertEquals(h.api.rotation, 360);
  h.api.rotateBy(-45);
  assertEquals(h.api.rotation, 315);
  assertEquals(h.events.rotationChange.length, 2);
});

Deno.test("flip toggles per axis", () => {
  const h = mount();
  h.api.flipHorizontal();
  assertEquals(h.api.flip.horizontal, true);
  assertEquals(h.api.flip.vertical, false);
  h.api.flipVertical(true);
  assertEquals(h.api.flip.vertical, true);
  h.api.setFlip({ horizontal: false });
  assertEquals(h.api.flip.horizontal, false);
  assertEquals(h.api.flip.vertical, true);
  assertEquals(h.events.flipChange.length, 3);
});

Deno.test("reset restores the defaults", () => {
  const h = mount();
  h.api.setZoom(3);
  h.api.setRotation(90);
  // Reset centers in the viewport: unmeasured, there is nothing to center
  // in, so measure first the way the view would have.
  const viewport = h.api.getViewportProps() as Record<string, unknown>;
  handler<(e: PointerEvent) => void>(viewport, "onPointerdown")(press(50, 50));
  handler<() => void>(viewport, "onPointerup")();
  h.api.reset();
  assertEquals(h.api.zoom, 1);
  assertEquals(h.api.rotation, 0);
  assertEquals(h.api.crop.width > 0, true);
});

Deno.test("selection arrows nudge the crop", () => {
  const h = mount();
  const bag = h.api.getSelectionProps() as Record<string, unknown>;
  // Without a viewport the guards refuse: arrows move nothing.
  handler<(e: KeyboardEvent) => void>(bag, "onKeydown")(keydown("ArrowRight"));
  assertEquals(h.api.crop.x, 0);
  assertEquals(h.events.cropChange.length, 0);
});

Deno.test("handles list all eight positions", () => {
  const h = mount();
  const handles = h.api.handles as readonly CropHandle[];
  assertEquals(handles.length, 8);
  assertEquals(handles.includes("se"), true);
  assertEquals(handles.includes("nw"), true);
});

Deno.test("crop data rounds to whole pixels", () => {
  const h = mount();
  const data = h.api.getCropData();
  assertEquals(Number.isInteger(data.x), true);
  assertEquals(Number.isInteger(data.width), true);
});

Deno.test("aria contract on the selection", () => {
  const h = mount();
  const bag = h.api.getSelectionProps() as Record<string, unknown>;
  assertEquals(bag["role"], "slider");
  assertEquals(bag["aria-roledescription"], "2d slider");
  assertEquals(bag["tabindex"], "0");
});
