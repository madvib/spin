import { createMachine, type Machine } from "@spinjs/runtime/fsm";
import type {
  CropHandle,
  ImageCropperArgs,
  ImageCropperContext,
  ImageCropperState,
} from "./image-cropper.state.ts";
import { initial } from "./image-cropper.state.ts";
import { limitsOf, ratioOf } from "./image-cropper.state.ts";
import { defaultCropPatch } from "./image-cropper.state.ts";
import type { ImageCropperEvents } from "./image-cropper.events.ts";
import { isRecord } from "@spinjs/runtime";
import { flipOf, rotationOf, zoomOf } from "./image-cropper.state.ts";
import {
  clearOffsetStart,
  clearPointerStart,
  hasViewport,
  setPointerStart,
} from "./image-cropper.transitions.ts";
import {
  centerRect,
  clampPoint,
  computeDefaultCropDimensions,
  computeMoveCrop,
  computeResizeCrop,
  isVisibleRect,
} from "./crop-geometry.ts";

const ZERO = { x: 0, y: 0, width: 0, height: 0 };

export function imageCropper(
  args: ImageCropperArgs = {},
  authored: (name: string) => boolean = () => false,
): Machine<ImageCropperContext, ImageCropperEvents, ImageCropperState> {
  return createMachine<
    ImageCropperContext,
    ImageCropperEvents,
    ImageCropperState
  >({
    id: "image-cropper",
    initial: "idle",
    context: initial(args, authored),
    fields: {
      cropShape: {},
      aspectRatio: {},
      minWidth: {},
      minHeight: {},
      maxWidth: {},
      maxHeight: {},
      fixedCropArea: {},
      disabled: {},
      dir: {},
      zoomStep: {},
      src: {},
      alt: {},
      zoom: { event: "SET_ZOOM" },
      rotation: { event: "SET_ROTATION" },
      flip: { event: "SET_FLIP" },
    },
    on: {
      SET_NATURAL_SIZE: {
        assign: (ctx, event) => {
          const next = { ...ctx, naturalSize: { ...event.size } };
          return {
            naturalSize: { ...event.size },
            ...defaultCropPatch(next, ctx.viewportRect),
          };
        },
      },
      SET_VIEWPORT: {
        assign: (_ctx, event) => ({ viewportRect: { ...event.viewport } }),
      },
      SET_DEFAULT_CROP: {
        assign: (ctx, event) => {
          const viewportRect = { ...event.viewport };
          return { viewportRect, ...defaultCropPatch(ctx, viewportRect) };
        },
      },
      SET_ZOOM: {
        assign: (_ctx, event) => {
          const zoom = zoomOf(event.zoom);
          if (zoom === null) return {};
          return { zoom };
        },
      },
      SET_ROTATION: {
        assign: (_ctx, event) => {
          const rotation = rotationOf(event.rotation);
          if (rotation === null) return {};
          return { rotation };
        },
      },
      SET_FLIP: {
        assign: (ctx, event) => {
          const host = event.flip === undefined ? null : flipOf(event.flip);
          return {
            flipHorizontal: host !== null
              ? host.horizontal
              : event.horizontal ?? ctx.flipHorizontal,
            flipVertical: host !== null
              ? host.vertical
              : event.vertical ?? ctx.flipVertical,
          };
        },
      },
      RESET: {
        assign: (ctx) => {
          if (!isVisibleRect(ctx.viewportRect)) return {};
          const aspectRatio = ratioOf(ctx);
          const { minSize, maxSize } = limitsOf(ctx, ctx.viewportRect);
          const defaultSize = computeDefaultCropDimensions(
            ctx.viewportRect,
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
            viewportRect: ctx.viewportRect,
            minSize,
            maxSize,
            aspectRatio,
          });
          const at = centerRect({
            width: clamped.width,
            height: clamped.height,
          }, ctx.viewportRect);
          return {
            crop: {
              x: at.x,
              y: at.y,
              width: clamped.width,
              height: clamped.height,
            },
            offset: { x: 0, y: 0 },
            zoom: 1,
            rotation: 0,
            flipHorizontal: false,
            flipVertical: false,
          };
        },
      },
    },
    states: {
      idle: {
        on: {
          POINTER_DOWN: [
            {
              cond: (ctx) =>
                isVisibleRect(ctx.viewportRect) && !ctx.fixedCropArea,
              target: "dragging",
              assign: [
                setPointerStart,
                (ctx) => ({ cropStart: { ...ctx.crop } }),
                (_ctx, event) => ({
                  handlePosition: (event.handlePosition ?? null) as
                    | CropHandle
                    | null,
                }),
              ],
            },
          ],
          PAN_POINTER_DOWN: [
            {
              cond: (ctx) =>
                isVisibleRect(ctx.naturalSize) &&
                isVisibleRect(ctx.viewportRect),
              target: "panning",
              assign: [
                setPointerStart,
                (ctx) => ({ offsetStart: { ...ctx.offset } }),
              ],
            },
          ],
          ZOOM: {
            cond: hasViewport,
            assign: (ctx, event) => {
              const next = Math.min(8, Math.max(0.1, ctx.zoom + event.delta));
              return { zoom: next };
            },
          },
          NUDGE_RESIZE: {
            cond: hasViewport,
            assign: (ctx, event) => {
              const step = event.large === true ? 10 : 1;
              const { minSize, maxSize } = limitsOf(ctx, ctx.viewportRect);
              const next = computeResizeCrop({
                cropStart: { ...ctx.crop },
                handlePosition: event.handlePosition as CropHandle,
                delta: { x: step, y: step },
                viewportRect: ctx.viewportRect,
                minSize,
                maxSize,
                aspectRatio: ratioOf(ctx),
              });
              return { crop: { ...next } };
            },
          },
          NUDGE_MOVE: {
            cond: hasViewport,
            assign: (ctx, event) => {
              const moved = computeMoveCrop({ ...ctx.crop }, {
                x: event.dx,
                y: event.dy,
              }, ctx.viewportRect);
              return { crop: { ...moved } };
            },
          },
          NUDGE_PAN: {
            cond: hasViewport,
            assign: (ctx, event) => ({
              offset: {
                x: ctx.offset.x + event.dx,
                y: ctx.offset.y + event.dy,
              },
            }),
          },
          RESIZE_CROP: {
            cond: (ctx) =>
              isVisibleRect(ctx.viewportRect) && !ctx.fixedCropArea,
            assign: (ctx, event) => {
              const { minSize, maxSize } = limitsOf(ctx, ctx.viewportRect);
              const next = computeResizeCrop({
                cropStart: { ...ctx.crop },
                handlePosition: event.handlePosition as CropHandle,
                delta: { ...event.delta },
                viewportRect: ctx.viewportRect,
                minSize,
                maxSize,
                aspectRatio: ratioOf(ctx),
              });
              return { crop: { ...next } };
            },
          },
        },
      },
      dragging: {
        on: {
          POINTER_MOVE: {
            assign: (ctx, event) => {
              const { pointerStart, cropStart, viewportRect, handlePosition } =
                ctx;
              if (pointerStart === null || cropStart === null) return {};
              const aspectRatio = ratioOf(ctx);
              const { minSize, maxSize } = limitsOf(ctx, viewportRect);
              const delta = {
                x: (event.altKey === true ? 2 : 1) *
                  (event.point.x - pointerStart.x),
                y: (event.altKey === true ? 2 : 1) *
                  (event.point.y - pointerStart.y),
              };
              if (handlePosition === null) {
                const moved = computeMoveCrop(
                  { ...cropStart },
                  delta,
                  viewportRect,
                );
                return { crop: { ...moved } };
              }
              const next = computeResizeCrop({
                cropStart: { ...cropStart },
                handlePosition: handlePosition as CropHandle,
                delta,
                viewportRect,
                minSize,
                maxSize,
                aspectRatio,
              });
              return { crop: { ...next } };
            },
          },
          POINTER_UP: {
            target: "idle",
            assign: [
              clearPointerStart,
              () => ({ cropStart: null }),
              () => ({ handlePosition: null }),
              clearOffsetStart,
            ],
          },
        },
      },
      panning: {
        on: {
          POINTER_MOVE: {
            assign: (ctx, event) => {
              const { pointerStart, offsetStart } = ctx;
              if (pointerStart === null || offsetStart === null) return {};
              return {
                offset: {
                  x: offsetStart.x + (event.point.x - pointerStart.x),
                  y: offsetStart.y + (event.point.y - pointerStart.y),
                },
              };
            },
          },
          POINTER_UP: {
            target: "idle",
            assign: [clearPointerStart, clearOffsetStart],
          },
        },
      },
    },
  });
}
