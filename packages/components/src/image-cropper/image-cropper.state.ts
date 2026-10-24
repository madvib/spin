import { defaultTwin, isRecord } from "@spinjs/runtime";
import {
  centerRect,
  clampPoint,
  computeDefaultCropDimensions,
  computeMoveCrop,
  computeResizeCrop,
  getMaxBounds,
  isVisibleRect,
  resolveCropAspectRatio,
} from "./crop-geometry.ts";

export type ImageCropperState = "idle" | "dragging" | "panning";

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
export type CropHandle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

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
  disabled?: boolean;
  dir?: string;
  zoomStep?: string | number;
  src?: string;
  alt?: string;
}

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
  disabled: boolean;
  dir: string;
  zoomStep: number;
  src: string;
  alt: string;
}

const asCount = (raw: unknown): number | null => {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  if (typeof raw === "string" && raw.trim().length > 0) {
    const n = Number(raw.trim());
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

export function flipOf(
  raw: unknown,
): { horizontal: boolean; vertical: boolean } | null {
  if (!isRecord(raw)) return null;
  const horizontal: unknown = raw["horizontal"];
  const vertical: unknown = raw["vertical"];
  if (typeof horizontal !== "boolean" && typeof vertical !== "boolean") {
    return null;
  }
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

export function initial(
  args: ImageCropperArgs = {},
  authored: (name: string) => boolean,
): ImageCropperContext {
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
    cropShape: written("cropShape") && args.cropShape === "circle"
      ? "circle"
      : "rect",
    aspectRatio: written("aspectRatio") ? asCount(args.aspectRatio) : null,
    minWidth: written("minWidth") ? asCount(args.minWidth) : null,
    minHeight: written("minHeight") ? asCount(args.minHeight) : null,
    maxWidth: written("maxWidth") ? asCount(args.maxWidth) : null,
    maxHeight: written("maxHeight") ? asCount(args.maxHeight) : null,
    fixedCropArea: written("fixedCropArea")
      ? args.fixedCropArea === true
      : false,
    disabled: args.disabled === true,
    dir: args.dir ?? "ltr",
    zoomStep: asCount(args.zoomStep) ?? 0.1,
    src: args.src ?? "",
    alt: args.alt ?? "",
  };
}

export const isGesturing = (phase: string): boolean =>
  phase === "dragging" || phase === "panning";

export const roundedCrop = (ctx: ImageCropperContext): CropRect => ({
  x: Math.round(ctx.crop.x),
  y: Math.round(ctx.crop.y),
  width: Math.round(ctx.crop.width),
  height: Math.round(ctx.crop.height),
});

export function limitsOf(
  ctx: ImageCropperContext,
  viewportRect: { width: number; height: number },
): {
  minSize: { width: number; height: number };
  maxSize: { width: number; height: number };
} {
  return {
    minSize: { width: ctx.minWidth ?? 0, height: ctx.minHeight ?? 0 },
    maxSize: {
      width: ctx.maxWidth !== null && ctx.maxWidth > 0
        ? ctx.maxWidth
        : viewportRect.width,
      height: ctx.maxHeight !== null && ctx.maxHeight > 0
        ? ctx.maxHeight
        : viewportRect.height,
    },
  };
}

export const ratioOf = (ctx: ImageCropperContext): number | null =>
  resolveCropAspectRatio(ctx.cropShape, ctx.aspectRatio);

export const defaultCropPatch = (
  ctx: ImageCropperContext,
  viewportRect: CropRect,
): Partial<ImageCropperContext> => {
  if (!isVisibleRect(viewportRect)) return {};
  const aspectRatio = ratioOf(ctx);
  const { minSize, maxSize } = limitsOf(ctx, viewportRect);
  const defaultSize = computeDefaultCropDimensions(
    viewportRect,
    aspectRatio,
    ctx.fixedCropArea,
  );
  const clamped = computeResizeCrop({
    cropStart: {
      x: 0,
      y: 0,
      width: defaultSize.width,
      height: defaultSize.height,
    },
    handlePosition: "se",
    delta: { x: 0, y: 0 },
    viewportRect,
    minSize,
    maxSize,
    aspectRatio,
  });
  const at = centerRect(
    { width: clamped.width, height: clamped.height },
    viewportRect,
  );
  return {
    crop: { x: at.x, y: at.y, width: clamped.width, height: clamped.height },
  };
};

export { asCount, clampPoint, getMaxBounds, rotationOf, zoomOf };
