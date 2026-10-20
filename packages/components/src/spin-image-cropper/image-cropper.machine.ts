
import { defaultTwin, isRecord } from "@spin/runtime";
/**
 * Image-cropper machine: idle, dragging the selection, panning the image.
 *
 * Zag's three states with real gating: POINTER_DOWN only drags when the
 * viewport is measured and the area is not fixed; PAN_POINTER_DOWN only pans
 * when both sizes are visible; every nudge and zoom refuses without a
 * viewport rect. `dragging` runs updateCrop on moves, `panning` runs
 * updatePanOffset — which handler runs is the state.
 *
 * Rects travel as PLAIN DATA. Context must stay serializable for the scope
 * channel, so crop/viewport/offset/naturalSize are `{x,y,width,height}` and
 * every assign reads and writes them as values. The geometry itself is Zag's
 * pure `utils/crop.mjs` (imported directly — no DOM in that module, only
 * `@zag-js/utils` scalars); the machine owns no crop math of its own.
 *
 * Measurement is NOT here. Viewport rects, pointer points and image sizes
 * are measured in the view and sent in events; the machine turns points
 * into rects. What the machine does read is the crop shape, aspect ratio
 * and size limits, synced from scope by the bridge, because clamping is a
 * statement about the crop, not about nodes.
 */

import { createMachine, type Machine } from "@spin/runtime/fsm";
import {
  clampPoint,
  centerRect,
  computeDefaultCropDimensions,
  computeMoveCrop,
  computeResizeCrop,
  getCropSizeLimits,
  getMaxBounds,
  isVisibleRect,
  resolveCropAspectRatio,
} from "./crop-geometry.ts";

/**
 * The image-cropper's arguments: the values the host may set.
 *
 * The names are the element's prop names — the machine is instantiated
 * with the element's prop bag and picks what it wants. The twin
 * (`defaultZoom`) is resolved by the framework before the factory is
 * called, so the machine only ever sees the live value.
 */
export interface ImageCropperArgs {
  /** The crop's shape: "rect" or "circle". */
  cropShape?: string;
  /** The crop's aspect ratio. */
  aspectRatio?: number;
  /** The crop's smallest width. */
  minWidth?: number;
  /** The crop's smallest height. */
  minHeight?: number;
  /** The crop's largest width. */
  maxWidth?: number;
  /** The crop's largest height. */
  maxHeight?: number;
  /** Whether the crop area is fixed. */
  fixedCropArea?: boolean;
  /** The zoom, as the host wrote it. */
  zoom?: string | number;
  /** The rotation, as the host wrote it. */
  rotation?: string | number;
  /** The flip, as the host wrote it. */
  flip?: { readonly horizontal?: boolean; readonly vertical?: boolean };
  defaultFlip?: { readonly horizontal?: boolean; readonly vertical?: boolean };
}


const asCount = (raw: unknown): number | null => {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  if (typeof raw === "string" && raw.trim().length > 0) {
    const n = Number(raw.trim());
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

/** A flip off the transport: `{ horizontal, vertical }` booleans by name. */
export function flipOf(raw: unknown): { horizontal: boolean; vertical: boolean } | null {
  if (!isRecord(raw)) return null;
  const horizontal: unknown = raw["horizontal"];
  const vertical: unknown = raw["vertical"];
  if (typeof horizontal !== "boolean" && typeof vertical !== "boolean") return null;
  return { horizontal: horizontal === true, vertical: vertical === true };
}

/** The zoom the machine holds: a number inside the machine's own range. */
const zoomOf = (raw: unknown): number | null => {
  const zoom = asCount(raw);
  return zoom === null ? null : Math.min(8, Math.max(0.1, zoom));
};

/** The rotation the machine holds: degrees inside the machine's own range. */
const rotationOf = (raw: unknown): number | null => {
  const rotation = asCount(raw);
  return rotation === null ? null : Math.min(360, Math.max(0, rotation));
};

/** The machine's own defaults, and the host's arguments where it has them. */
export function initial(args: ImageCropperArgs = {}, authored: (name: string) => boolean): ImageCropperContext {
  // A channel: the host's write, or the machine's own default. The twin
  // is the framework's convention — a host that wrote `defaultZoom` wrote
  // the channel too — and the framework has already resolved it into the
  // argument.
  const written = (field: string): boolean =>
    authored(field) || authored(defaultTwin(field));
  const flip = flipOf(args.flip) ?? { horizontal: false, vertical: false };
  return {
    crop: { x: 0, y: 0, width: 0, height: 0 },
    viewportRect: { x: 0, y: 0, width: 0, height: 0 },
    naturalSize: { width: 0, height: 0 },
    offset: { x: 0, y: 0 },
    zoom: written("zoom") ? zoomOf(args.zoom) ?? 1 : 1,
    rotation: written("rotation") ? rotationOf(args.rotation) ?? 0 : 0,
    flipHorizontal: written("flip") && flip.horizontal,
    flipVertical: written("flip") && flip.vertical,
    pointerStart: null,
    cropStart: null,
    offsetStart: null,
    handlePosition: null,
    cropShape: written("cropShape") && args.cropShape === "circle" ? "circle" : "rect",
    aspectRatio: written("aspectRatio") ? asCount(args.aspectRatio) : null,
    minWidth: written("minWidth") ? asCount(args.minWidth) : null,
    minHeight: written("minHeight") ? asCount(args.minHeight) : null,
    maxWidth: written("maxWidth") ? asCount(args.maxWidth) : null,
    maxHeight: written("maxHeight") ? asCount(args.maxHeight) : null,
    fixedCropArea: written("fixedCropArea") ? args.fixedCropArea === true : false,
  };
}

/** A positioned rectangle: Zag's CropRect, declared here because the
 * geometry module exports values only. */
export interface CropRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface CropPoint {
  readonly x: number;
  readonly y: number;
}

export interface CropSize {
  readonly width: number;
  readonly height: number;
}

export type CropHandle =
  | "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

export interface ImageCropperContext {
  crop: CropRect;
  viewportRect: CropRect;
  naturalSize: CropSize;
  offset: CropPoint;
  zoom: number;
  rotation: number;
  flipHorizontal: boolean;
  flipVertical: boolean;
  pointerStart: CropPoint | null;
  cropStart: CropRect | null;
  offsetStart: CropPoint | null;
  handlePosition: CropHandle | null;
  cropShape: "rect" | "circle";
  aspectRatio: number | null;
  minWidth: number | null;
  minHeight: number | null;
  maxWidth: number | null;
  maxHeight: number | null;
  fixedCropArea: boolean;
}

export type ImageCropperEvent =
  | { type: "SET_NATURAL_SIZE"; size: CropSize }
  | { type: "SET_DEFAULT_CROP"; viewport: CropRect }
  | { type: "SET_VIEWPORT"; viewport: CropRect }
  | { type: "POINTER_DOWN"; point: CropPoint; handlePosition?: CropHandle | undefined }
  | { type: "PAN_POINTER_DOWN"; point: CropPoint }
  | { type: "POINTER_MOVE"; point: CropPoint; shiftKey?: boolean; altKey?: boolean }
  | { type: "POINTER_UP" }
  | { type: "ZOOM"; delta: number; point?: CropPoint | undefined }
  | { type: "SET_ZOOM"; zoom: number }
  | { type: "SET_ROTATION"; rotation: number }
  | {
    type: "SET_FLIP";
    /** The command's payload: the axes the host named. */
    horizontal?: boolean;
    vertical?: boolean;
    /** The host write's payload: the prop's own name. */
    flip?: { readonly horizontal?: boolean; readonly vertical?: boolean };
  }
  | { type: "NUDGE_RESIZE"; handlePosition: CropHandle; large?: boolean }
  | { type: "NUDGE_MOVE"; dx: number; dy: number }
  | { type: "NUDGE_PAN"; dx: number; dy: number }
  | { type: "RESIZE_CROP"; handlePosition: CropHandle; delta: CropPoint }
  | { type: "RESET" };

const ZERO: CropRect = { x: 0, y: 0, width: 0, height: 0 };

const config = {
  id: "image-cropper",
  initial: "idle",
  context: {
    crop: { ...ZERO },
    viewportRect: { ...ZERO },
    naturalSize: { width: 0, height: 0 },
    offset: { x: 0, y: 0 },
    zoom: 1,
    rotation: 0,
    flipHorizontal: false,
    flipVertical: false,
    pointerStart: null as CropPoint | null,
    cropStart: null as CropRect | null,
    offsetStart: null as CropPoint | null,
    handlePosition: null as CropHandle | null,
    cropShape: "rect" as "rect" | "circle",
    aspectRatio: null as number | null,
    minWidth: null as number | null,
    minHeight: null as number | null,
    maxWidth: null as number | null,
    maxHeight: null as number | null,
    fixedCropArea: false,
  },
  on: {
    SET_NATURAL_SIZE: { actions: [{ assign: "setNaturalSize" }] },
    SET_VIEWPORT: { actions: [{ assign: "setViewport" }] },
    SET_DEFAULT_CROP: { actions: [{ assign: "setDefaultCrop" }] },
    SET_ZOOM: { actions: [{ assign: "setZoom" }] },
    SET_ROTATION: { actions: [{ assign: "setRotation" }] },
    SET_FLIP: { actions: [{ assign: "setFlip" }] },
    RESET: { actions: [{ assign: "resetCrop" }] },
  },
  states: {
    idle: {
      on: {
        POINTER_DOWN: [
          {
            cond: "canDragSelection",
            target: "dragging",
            actions: [{ assign: "setPointerStart" }, { assign: "setCropStart" }, { assign: "setHandlePosition" }],
          },
        ],
        PAN_POINTER_DOWN: [
          {
            cond: "canPan",
            target: "panning",
            actions: [{ assign: "setPointerStart" }, { assign: "setOffsetStart" }],
          },
        ],
        ZOOM: { cond: "hasViewport", actions: [{ assign: "updateZoom" }] },
        NUDGE_RESIZE: { cond: "hasViewport", actions: [{ assign: "nudgeResize" }] },
        NUDGE_MOVE: { cond: "hasViewport", actions: [{ assign: "nudgeMove" }] },
        NUDGE_PAN: { cond: "hasViewport", actions: [{ assign: "nudgePan" }] },
        RESIZE_CROP: { cond: "canResize", actions: [{ assign: "resizeCrop" }] },
      },
    },
    dragging: {
      on: {
        POINTER_MOVE: { actions: [{ assign: "updateCrop" }] },
        POINTER_UP: {
          target: "idle",
          actions: [
            { assign: "clearPointerStart" },
            { assign: "clearCropStart" },
            { assign: "clearHandlePosition" },
            { assign: "clearOffsetStart" },
          ],
        },
      },
    },
    panning: {
      on: {
        POINTER_MOVE: { actions: [{ assign: "updatePan" }] },
        POINTER_UP: {
          target: "idle",
          actions: [{ assign: "clearPointerStart" }, { assign: "clearOffsetStart" }],
        },
      },
    },
  },
};

/** The size bounds `computeResizeCrop` reads. The util dereferences
 * both objects unconditionally, so both are concrete: missing bounds fall
 * back to 0 and the viewport, which is what the util itself defaults to. */
const limitsOf = (
  ctx: ImageCropperContext,
  viewportRect: { width: number; height: number },
): {
  minSize: { width: number; height: number };
  maxSize: { width: number; height: number };
} => ({
  minSize: { width: ctx.minWidth ?? 0, height: ctx.minHeight ?? 0 },
  maxSize: {
    // A max of zero is no max: the viewport is the bound.
    width: ctx.maxWidth !== null && ctx.maxWidth > 0 ? ctx.maxWidth : viewportRect.width,
    height: ctx.maxHeight !== null && ctx.maxHeight > 0 ? ctx.maxHeight : viewportRect.height,
  },
});

const ratioOf = (ctx: ImageCropperContext): number | null =>
  resolveCropAspectRatio(ctx.cropShape, ctx.aspectRatio);

/** The crop a viewport and an image's aspect imply, centred in it. */
const defaultCropPatch = (
  ctx: ImageCropperContext,
  viewportRect: CropRect,
): Partial<ImageCropperContext> => {
  if (!isVisibleRect(viewportRect)) return {};
  const aspectRatio = ratioOf(ctx);
  const { minSize, maxSize } = limitsOf(ctx, viewportRect);
  const defaultSize = computeDefaultCropDimensions(viewportRect, aspectRatio, ctx.fixedCropArea);
  const clamped = computeResizeCrop({
    cropStart: { x: 0, y: 0, width: defaultSize.width, height: defaultSize.height },
    handlePosition: "se",
    delta: { x: 0, y: 0 },
    viewportRect,
    minSize,
    maxSize,
    aspectRatio,
  });
  const at = centerRect({ width: clamped.width, height: clamped.height }, viewportRect);
  return { crop: { x: at.x, y: at.y, width: clamped.width, height: clamped.height } };
};

const implementations = {
  conds: {
    hasViewport: (ctx: ImageCropperContext): boolean => isVisibleRect(ctx.viewportRect),
    /** A fixed area refuses programmatic resizes: the view blocked them
     * before, and the def's commands always send — so the guard lives
     * here now, where every path meets it. */
    canResize: (ctx: ImageCropperContext): boolean =>
      isVisibleRect(ctx.viewportRect) && !ctx.fixedCropArea,
    canDragSelection: (ctx: ImageCropperContext): boolean =>
      isVisibleRect(ctx.viewportRect) && !ctx.fixedCropArea,
    canPan: (ctx: ImageCropperContext): boolean =>
      isVisibleRect(ctx.naturalSize) && isVisibleRect(ctx.viewportRect),
  },
  assigns: {
    setNaturalSize: (ctx: ImageCropperContext, event: ImageCropperEvent): Partial<ImageCropperContext> => {
      if (event.type !== "SET_NATURAL_SIZE") return {};
      // The crop's default is derived from the viewport and the image's
      // aspect. Whichever arrives last wins, so a natural size that lands
      // after the viewport recomputes the crop.
      const next = { ...ctx, naturalSize: { ...event.size } };
      return { naturalSize: { ...event.size }, ...defaultCropPatch(next, ctx.viewportRect) };
    },
    setViewport: (ctx: ImageCropperContext, event: ImageCropperEvent): Partial<ImageCropperContext> => {
      if (event.type !== "SET_VIEWPORT") return {};
      void ctx;
      return { viewportRect: { ...event.viewport } };
    },
    setDefaultCrop: (ctx: ImageCropperContext, event: ImageCropperEvent): Partial<ImageCropperContext> => {
      if (event.type !== "SET_DEFAULT_CROP") return {};
      const viewportRect = { ...event.viewport };
      return { viewportRect, ...defaultCropPatch(ctx, viewportRect) };
    },
    setPointerStart: (ctx: ImageCropperContext, event: ImageCropperEvent): Partial<ImageCropperContext> => {
      if (event.type !== "POINTER_DOWN" && event.type !== "PAN_POINTER_DOWN") return {};
      void ctx;
      return { pointerStart: { ...event.point } };
    },
    setCropStart: (ctx: ImageCropperContext): Partial<ImageCropperContext> => ({ cropStart: { ...ctx.crop } }),
    setOffsetStart: (ctx: ImageCropperContext): Partial<ImageCropperContext> => ({
      offsetStart: { ...ctx.offset },
    }),
    setHandlePosition: (ctx: ImageCropperContext, event: ImageCropperEvent): Partial<ImageCropperContext> => {
      if (event.type !== "POINTER_DOWN") return {};
      void ctx;
      return { handlePosition: event.handlePosition ?? null };
    },
    updateCrop: (ctx: ImageCropperContext, event: ImageCropperEvent): Partial<ImageCropperContext> => {
      if (event.type !== "POINTER_MOVE") return {};
      const { pointerStart, cropStart, viewportRect, handlePosition } = ctx;
      if (pointerStart === null || cropStart === null) return {};
      const aspectRatio = ratioOf(ctx);
      const { minSize, maxSize } = limitsOf(ctx, viewportRect);
      const delta = {
        x: (event.altKey === true ? 2 : 1) * (event.point.x - pointerStart.x),
        y: (event.altKey === true ? 2 : 1) * (event.point.y - pointerStart.y),
      };
      if (handlePosition === null) {
        const moved = computeMoveCrop({ ...cropStart }, delta, viewportRect);
        return { crop: { ...moved } };
      }
      const next = computeResizeCrop({
        cropStart: { ...cropStart },
        handlePosition,
        delta,
        viewportRect,
        minSize,
        maxSize,
        aspectRatio,
      });
      return { crop: { ...next } };
    },
    updatePan: (ctx: ImageCropperContext, event: ImageCropperEvent): Partial<ImageCropperContext> => {
      if (event.type !== "POINTER_MOVE") return {};
      const { pointerStart, offsetStart } = ctx;
      if (pointerStart === null || offsetStart === null) return {};
      void ctx;
      return {
        offset: {
          x: offsetStart.x + (event.point.x - pointerStart.x),
          y: offsetStart.y + (event.point.y - pointerStart.y),
        },
      };
    },
    updateZoom: (ctx: ImageCropperContext, event: ImageCropperEvent): Partial<ImageCropperContext> => {
      if (event.type !== "ZOOM") return {};
      const next = Math.min(8, Math.max(0.1, ctx.zoom + event.delta));
      return { zoom: next };
    },
    setZoom: (ctx: ImageCropperContext, event: ImageCropperEvent): Partial<ImageCropperContext> => {
      if (event.type !== "SET_ZOOM") return {};
      void ctx;
      // The zoom arrives the way the host wrote it; the machine shapes it.
      const zoom = zoomOf(event.zoom);
      if (zoom === null) return {};
      return { zoom };
    },
    setRotation: (ctx: ImageCropperContext, event: ImageCropperEvent): Partial<ImageCropperContext> => {
      if (event.type !== "SET_ROTATION") return {};
      void ctx;
      // The rotation arrives the way the host wrote it; the machine shapes
      // it.
      const rotation = rotationOf(event.rotation);
      if (rotation === null) return {};
      return { rotation };
    },
    setFlip: (ctx: ImageCropperContext, event: ImageCropperEvent): Partial<ImageCropperContext> => {
      if (event.type !== "SET_FLIP") return {};
      // The flip arrives the way the host wrote it: the command names the
      // axes, the host write names the field. The machine shapes it.
      const host = event.flip === undefined ? null : flipOf(event.flip);
      return {
        flipHorizontal: host !== null ? host.horizontal : event.horizontal ?? ctx.flipHorizontal,
        flipVertical: host !== null ? host.vertical : event.vertical ?? ctx.flipVertical,
      };
    },
    nudgeResize: (ctx: ImageCropperContext, event: ImageCropperEvent): Partial<ImageCropperContext> => {
      if (event.type !== "NUDGE_RESIZE") return {};
      const step = event.large === true ? 10 : 1;
      const { minSize, maxSize } = limitsOf(ctx, ctx.viewportRect);
      const next = computeResizeCrop({
        cropStart: { ...ctx.crop },
        handlePosition: event.handlePosition,
        delta: { x: step, y: step },
        viewportRect: ctx.viewportRect,
        minSize,
        maxSize,
        aspectRatio: ratioOf(ctx),
      });
      return { crop: { ...next } };
    },
    nudgeMove: (ctx: ImageCropperContext, event: ImageCropperEvent): Partial<ImageCropperContext> => {
      if (event.type !== "NUDGE_MOVE") return {};
      const moved = computeMoveCrop({ ...ctx.crop }, { x: event.dx, y: event.dy }, ctx.viewportRect);
      return { crop: { ...moved } };
    },
    nudgePan: (ctx: ImageCropperContext, event: ImageCropperEvent): Partial<ImageCropperContext> => {
      if (event.type !== "NUDGE_PAN") return {};
      void ctx;
      return {
        offset: { x: ctx.offset.x + event.dx, y: ctx.offset.y + event.dy },
      };
    },
    resizeCrop: (ctx: ImageCropperContext, event: ImageCropperEvent): Partial<ImageCropperContext> => {
      if (event.type !== "RESIZE_CROP") return {};
      const { minSize, maxSize } = limitsOf(ctx, ctx.viewportRect);
      const next = computeResizeCrop({
        cropStart: { ...ctx.crop },
        handlePosition: event.handlePosition,
        delta: { ...event.delta },
        viewportRect: ctx.viewportRect,
        minSize,
        maxSize,
        aspectRatio: ratioOf(ctx),
      });
      return { crop: { ...next } };
    },
    resetCrop: (ctx: ImageCropperContext): Partial<ImageCropperContext> => {
      if (!isVisibleRect(ctx.viewportRect)) return {};
      const aspectRatio = ratioOf(ctx);
      const { minSize, maxSize } = limitsOf(ctx, ctx.viewportRect);
      const defaultSize = computeDefaultCropDimensions(ctx.viewportRect, aspectRatio, ctx.fixedCropArea);
      const clamped = computeResizeCrop({
        cropStart: { x: 0, y: 0, width: defaultSize.width, height: defaultSize.height },
        handlePosition: "se",
        delta: { x: 0, y: 0 },
        viewportRect: ctx.viewportRect,
        minSize,
        maxSize,
        aspectRatio,
      });
      const at = centerRect({ width: clamped.width, height: clamped.height }, ctx.viewportRect);
      return {
        crop: { x: at.x, y: at.y, width: clamped.width, height: clamped.height },
        offset: { x: 0, y: 0 },
        zoom: 1,
        rotation: 0,
        flipHorizontal: false,
        flipVertical: false,
      };
    },
    clearPointerStart: (): Partial<ImageCropperContext> => ({ pointerStart: null }),
    clearCropStart: (): Partial<ImageCropperContext> => ({ cropStart: null }),
    clearHandlePosition: (): Partial<ImageCropperContext> => ({ handlePosition: null }),
    clearOffsetStart: (): Partial<ImageCropperContext> => ({ offsetStart: null }),
  },
};

export { clampPoint, getMaxBounds };

/** True while a gesture owns the pointer. */
export const isGesturing = (phase: string): boolean => phase === "dragging" || phase === "panning";

/** The selection in whole pixels for aria and export. */
export const roundedCrop = (ctx: ImageCropperContext): CropRect => ({
  x: Math.round(ctx.crop.x),
  y: Math.round(ctx.crop.y),
  width: Math.round(ctx.crop.width),
  height: Math.round(ctx.crop.height),
});

/**
 * The image-cropper machine: state and nothing else. It is headless — it
 * knows its own arguments, and nothing about props, markup, or the DOM.
 */
export function imageCropper(
  args: ImageCropperArgs = {},
  authored: (name: string) => boolean,
): Machine<ImageCropperContext, ImageCropperEvent> {
  return createMachine<ImageCropperContext, ImageCropperEvent>({
    ...config,
    context: initial(args, authored),
    assigns: implementations.assigns,
    conds: implementations.conds,
    /**
     * The machine's contract with its hosts: the context fields a host
     * may write, and the event each write carries.
     *
     * A field with an event is REPORTED: the host's write is an event,
     * the machine decides, and the change reaches the host. A field
     * without one is SILENT: the host's write lands in the field, and
     * nothing reports.
     */
    fields: {
      cropShape: {},
      aspectRatio: {},
      minWidth: {},
      minHeight: {},
      maxWidth: {},
      maxHeight: {},
      fixedCropArea: {},
      zoom: { event: "SET_ZOOM" },
      rotation: { event: "SET_ROTATION" },
      flip: { event: "SET_FLIP" },
    },
  });
}
