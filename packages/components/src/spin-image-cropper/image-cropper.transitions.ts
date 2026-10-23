import type { AssignFor, GuardFor } from "@spin/runtime/fsm";
import type { ImageCropperContext } from "./image-cropper.state.ts";
import type { ImageCropperEvents } from "./image-cropper.events.ts";
// re-export types for convenience
export type { ImageCropperContext } from "./image-cropper.state.ts";
export type { ImageCropperEvents } from "./image-cropper.events.ts";

type ICtx = ImageCropperContext;
type IEv = ImageCropperEvents;

export type ImageCropperAssign<K extends keyof IEv = keyof IEv> = AssignFor<ICtx, ImageCropperEvents, K>;
export type ImageCropperGuard = GuardFor<ICtx, IEv>;

import { isVisibleRect } from "./crop-geometry.ts";

export const setPointerStart: ImageCropperAssign<"POINTER_DOWN" | "PAN_POINTER_DOWN"> = (ctx, event) => {
  return { pointerStart: { ...event.point } };
};

export const clearPointerStart = (): Partial<ICtx> => ({ pointerStart: null });

export const clearOffsetStart = (): Partial<ICtx> => ({ offsetStart: null });

export const hasViewport: ImageCropperGuard = (ctx) => isVisibleRect(ctx.viewportRect);