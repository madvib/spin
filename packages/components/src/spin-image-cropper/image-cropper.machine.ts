
import { defaultTwin, isRecord } from "@spin/runtime";
/**
 * Image-cropper machine: idle, dragging the selection, panning the image.
 *
 * Three states with real gating: POINTER_DOWN only drags when the viewport
 * is measured and the area is not fixed; PAN_POINTER_DOWN only pans when both
 * sizes are visible; every nudge and zoom refuses without a viewport rect.
 * `dragging` runs updateCrop on moves, `panning` runs updatePanOffset — which
 * handler runs is the state.
 *
 * Rects travel as PLAIN DATA. Context must stay serializable for the scope
 * channel, so crop/viewport/offset/naturalSize are `{x,y,width,height}` and
 * every assign reads and writes them as values. The geometry itself is the
 * vendored slice (no DOM in it, only pure scalar math); the machine owns no
 * crop math of its own.
 *
 * Measurement is NOT here. Viewport rects, pointer points and image sizes
 * are measured in the view and sent in events; the machine turns points
 * into rects. What the machine does read is the crop shape, aspect ratio
 * and size limits, synced from scope by the bridge, because clamping is a
 * statement about the crop, not about nodes.
 */

import { createMachine, type Machine, type EventUnion, type MachineSpec } from "@spin/runtime/fsm";
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
const setPointerStart = (ctx: ImageCropperContext, event: EventUnion<ImageCropperEvents>) : Partial<ImageCropperContext> => {
      if (event.type !== "POINTER_DOWN" && event.type !== "PAN_POINTER_DOWN") return {};
      void ctx;
      return { pointerStart: { ...event.point } };
    };

const clearPointerStart = () : Partial<ImageCropperContext> => { return ({ pointerStart: null }); };

const clearOffsetStart = () : Partial<ImageCropperContext> => { return ({ offsetStart: null }); };

const hasViewport = (ctx: ImageCropperContext) : boolean => { return isVisibleRect(ctx.viewportRect); };



export interface ImageCropperArgs {
  cropShape?: string;
  aspectRatio?: number;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
  fixedCropArea?: boolean;
  zoom?: string | number;
  rotation?: string | number;
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

export function flipOf(raw: unknown): { horizontal: boolean; vertical: boolean } | null {
  if (!isRecord(raw)) return null;
  const horizontal: unknown = raw["horizontal"];
  const vertical: unknown = raw["vertical"];
  if (typeof horizontal !== "boolean" && typeof vertical !== "boolean") return null;
  return { horizontal: horizontal === true, vertical: vertical === true };
}

const zoomOf = (raw: unknown): number | null => {
  const zoom = asCount(raw);
  return zoom === null ? null : Math.min(8, Math.max(0.1, zoom));
};

const rotationOf = (raw: unknown): number | null => {
  const rotation = asCount(raw);
  return rotation === null ? null : Math.min(360, Math.max(0, rotation));
};

export function initial(args: ImageCropperArgs = {}, authored: (name: string) => boolean): ImageCropperContext {
  const written = (field: string): boolean =>
    authored(field) ||
    authored(defaultTwin(field)) ||
    (args as Record<string, unknown>)[defaultTwin(field)] !== undefined;
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

/** A positioned rectangle, declared here because the geometry module
 * exports values only. */
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

export interface ImageCropperEvents {
  "SET_NATURAL_SIZE": { size: CropSize };
  "SET_DEFAULT_CROP": { viewport: CropRect };
  "SET_VIEWPORT": { viewport: CropRect };
  "POINTER_DOWN": { point: CropPoint; handlePosition?: CropHandle | undefined };
  "PAN_POINTER_DOWN": { point: CropPoint };
  "POINTER_MOVE": { point: CropPoint; shiftKey?: boolean; altKey?: boolean };
  "POINTER_UP": {};
  "ZOOM": { delta: number; point?: CropPoint | undefined };
  "SET_ZOOM": { zoom: number };
  "SET_ROTATION": { rotation: number };
  "SET_FLIP": { horizontal?: boolean; vertical?: boolean; flip?: { readonly horizontal?: boolean; readonly vertical?: boolean } };
  "NUDGE_RESIZE": { handlePosition: CropHandle; large?: boolean };
  "NUDGE_MOVE": { dx: number; dy: number };
  "NUDGE_PAN": { dx: number; dy: number };
  "RESIZE_CROP": { handlePosition: CropHandle; delta: CropPoint };
  "RESET": {};
}

export type ImageCropperEvent = EventUnion<ImageCropperEvents>;


const ZERO: CropRect = { x: 0, y: 0, width: 0, height: 0 };

const config: MachineSpec<ImageCropperContext, ImageCropperEvents> = {
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
    SET_NATURAL_SIZE: { assign: (ctx, event) => {
      // The crop's default is derived from the viewport and the image's
      // aspect. Whichever arrives last wins, so a natural size that lands
      // after the viewport recomputes the crop.
      const next = { ...ctx, naturalSize: { ...event.size } };
      return { naturalSize: { ...event.size }, ...defaultCropPatch(next, ctx.viewportRect) };
    } },
    SET_VIEWPORT: { assign: (ctx, event) => {
      void ctx;
      return { viewportRect: { ...event.viewport } };
    } },
    SET_DEFAULT_CROP: { assign: (ctx, event) => {
      const viewportRect = { ...event.viewport };
      return { viewportRect, ...defaultCropPatch(ctx, viewportRect) };
    } },
    SET_ZOOM: { assign: (ctx, event) => {
      void ctx;
      const zoom = zoomOf(event.zoom);
      if (zoom === null) return {};
      return { zoom };
    } },
    SET_ROTATION: { assign: (ctx, event) => {
      void ctx;
      const rotation = rotationOf(event.rotation);
      if (rotation === null) return {};
      return { rotation };
    } },
    SET_FLIP: { assign: (ctx, event) => {
      const host = event.flip === undefined ? null : flipOf(event.flip);
      return {
        flipHorizontal: host !== null ? host.horizontal : event.horizontal ?? ctx.flipHorizontal,
        flipVertical: host !== null ? host.vertical : event.vertical ?? ctx.flipVertical,
      };
    } },
    RESET: { assign: (ctx) => {
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
    } },
  },
  states: {
    idle: {
      on: {
        POINTER_DOWN: [
          {
            cond: (ctx) => { return isVisibleRect(ctx.viewportRect) && !ctx.fixedCropArea; },
            target: "dragging",
            assign: [setPointerStart, (ctx) => { return ({ cropStart: { ...ctx.crop } }); }, (ctx, event) => {
      void ctx;
      return { handlePosition: event.handlePosition ?? null };
    }],
          },
        ],
        PAN_POINTER_DOWN: [
          {
            cond: (ctx) => { return isVisibleRect(ctx.naturalSize) && isVisibleRect(ctx.viewportRect); },
            target: "panning",
            assign: [setPointerStart, (ctx) => { return ({
      offsetStart: { ...ctx.offset },
    }); }],
          },
        ],
        ZOOM: { cond: hasViewport, assign: (ctx, event) => {
      const next = Math.min(8, Math.max(0.1, ctx.zoom + event.delta));
      return { zoom: next };
    } },
        NUDGE_RESIZE: { cond: hasViewport, assign: (ctx, event) => {
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
    } },
        NUDGE_MOVE: { cond: hasViewport, assign: (ctx, event) => {
      const moved = computeMoveCrop({ ...ctx.crop }, { x: event.dx, y: event.dy }, ctx.viewportRect);
      return { crop: { ...moved } };
    } },
        NUDGE_PAN: { cond: hasViewport, assign: (ctx, event) => {
      void ctx;
      return {
        offset: { x: ctx.offset.x + event.dx, y: ctx.offset.y + event.dy },
      };
    } },
        RESIZE_CROP: { cond: (ctx) => { return isVisibleRect(ctx.viewportRect) && !ctx.fixedCropArea; }, assign: (ctx, event) => {
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
    } },
      },
    },
    dragging: {
      on: {
        POINTER_MOVE: { assign: (ctx, event) => {
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
    } },
        POINTER_UP: {
          target: "idle",
          assign: [clearPointerStart, () => { return ({ cropStart: null }); }, () => { return ({ handlePosition: null }); }, clearOffsetStart],
        },
      },
    },
    panning: {
      on: {
        POINTER_MOVE: { assign: (ctx, event) => {
      const { pointerStart, offsetStart } = ctx;
      if (pointerStart === null || offsetStart === null) return {};
      void ctx;
      return {
        offset: {
          x: offsetStart.x + (event.point.x - pointerStart.x),
          y: offsetStart.y + (event.point.y - pointerStart.y),
        },
      };
    } },
        POINTER_UP: {
          target: "idle",
          assign: [clearPointerStart, clearOffsetStart],
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

const implementations = {};

export { clampPoint, getMaxBounds };

export const isGesturing = (phase: string): boolean => phase === "dragging" || phase === "panning";

/** The selection in whole pixels for aria and export. */
export const roundedCrop = (ctx: ImageCropperContext): CropRect => ({
  x: Math.round(ctx.crop.x),
  y: Math.round(ctx.crop.y),
  width: Math.round(ctx.crop.width),
  height: Math.round(ctx.crop.height),
});

export function imageCropper(
  args: ImageCropperArgs = {},
  authored: (name: string) => boolean,
): Machine<ImageCropperContext, ImageCropperEvents> {
  return createMachine<ImageCropperContext, ImageCropperEvents>({
    ...config,
    context: initial(args, authored),
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
