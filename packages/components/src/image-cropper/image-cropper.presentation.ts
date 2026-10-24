import {
  type ApiOf,
  ariaBusy,
  ariaDescription,
  ariaHidden,
  ariaRoleDescription,
  type ComponentDef,
  dataAttr,
  defineComponent,
  isComposing,
  isRecord,
  type ScopeFor,
  sliderThumb,
  type SlotScopeFor,
} from "@spinjs/runtime";
import type { DragDelta, DragPress } from "@spinjs/runtime/actions";
import { imageCropper as imageCropperMachine } from "./image-cropper.machine.ts";
import {
  type CropHandle,
  type CropPoint,
  type CropRect,
  type ImageCropperArgs,
  type ImageCropperContext,
  type ImageCropperState,
  isGesturing,
  roundedCrop,
} from "./image-cropper.state.ts";
import type { ImageCropperEvents } from "./image-cropper.events.ts";

/**
 * Image-cropper definition: the DOM contract as data. The machine owns the
 * three phases, the crop rect, the zoom/rotation/flip and the gesture
 * starts; this file maps props to channels, parts to attribute bags,
 * commands to sends, and crop/zoom/rotation/flip transitions to their
 * events.
 *
 * Everything that needs a node lives here — the viewport and image
 * measurement (reported in as events, because the machine never touches
 * the DOM), the selection and handle drags (which compute their point
 * against the viewport node and send it in), the keyboard map, and the
 * wheel zoom.
 *
 * The crop geometry is CONTINUOUS — a drag lands between utilities — so
 * the bags project it into their own style objects as concrete properties
 * (`left`, `top`, `width`, `height`, `transform`); the markup names no
 * var and no custom property carries the geometry.
 */

export interface HandleSlotProps {
  readonly position: CropHandle;
}

export interface GridSlotProps {
  readonly axis: "horizontal" | "vertical";
}

export interface ImageCropperCropChange {
  readonly crop: CropRect;
}

export interface ImageCropperZoomChange {
  readonly zoom: number;
}

export interface ImageCropperRotationChange {
  readonly rotation: number;
}

export interface ImageCropperFlipChange {
  readonly horizontal: boolean;
  readonly vertical: boolean;
}

type ScopeLike = ScopeFor<
  ImageCropperContext,
  ImageCropperEvents,
  ImageCropperState
>;
type SlotLike<R> = SlotScopeFor<
  R,
  ImageCropperContext,
  ImageCropperEvents,
  ImageCropperState
>;

const sameRect = (a: CropRect, b: CropRect): boolean =>
  a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;

/** A numeric prop: numbers pass, numeric strings parse, everything else
 * absent. Named once; transport owns the grammar. */
const countOf = (raw: unknown): number | null => {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  if (typeof raw === "string" && raw.trim().length > 0) {
    const n = Number(raw.trim());
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

const HANDLES: readonly CropHandle[] = [
  "nw",
  "n",
  "ne",
  "e",
  "se",
  "s",
  "sw",
  "w",
];

/** A pointer point relative to the viewport node, measured through the
 * framework — defs never query the DOM. */
const viewportPoint = (
  scope: ScopeLike,
  clientX: number,
  clientY: number,
): CropPoint | null => {
  const rect = scope.measure("viewport");
  if (rect === null) return null;
  return { x: clientX - rect.left, y: clientY - rect.top };
};

/** A press inside the selection belongs to the drag, not the pan: the
 * selection's own press stops there. Duck-typed — the target may be a stub. */
const insideSelection = (
  scope: ScopeLike,
  target: EventTarget | null,
): boolean => {
  if (!(target instanceof Element)) return false;
  if (target.id === scope.id("selection")) return true;
  if (typeof target.closest !== "function") return false;
  return target.closest(`[id="${scope.id("selection")}"]`) !== null;
};

const HANDLE_NAMES: readonly string[] = [
  "n",
  "s",
  "e",
  "w",
  "ne",
  "nw",
  "se",
  "sw",
];

const isHandle = (raw: unknown): raw is CropHandle =>
  typeof raw === "string" && (HANDLE_NAMES as readonly string[]).includes(raw);

const textOf = (raw: unknown): string => typeof raw === "string" ? raw : "";

/** The image's natural size off the load target: positive numbers
 * only. The constructor may not exist (linkedom) — read the shape. */
const naturalSizeOf = (
  target: EventTarget | null,
): { width: number; height: number } | null => {
  if (!isRecord(target)) return null;
  const width: unknown = target["naturalWidth"];
  const height: unknown = target["naturalHeight"];
  if (typeof width !== "number" || typeof height !== "number" || width === 0) {
    return null;
  }
  return { width, height };
};

const toHandle = (
  raw: unknown,
): CropHandle | null => (isHandle(raw) ? raw : null);

/** A handle slot arg: the recipe's `{ position: row }` or a bare handle
 * name; anything else is the southeast handle. */
const handleOf = (arg: unknown): HandleSlotProps => {
  const direct = toHandle(arg);
  if (direct !== null) return { position: direct };
  if (isRecord(arg)) {
    const position = toHandle(arg["position"]);
    if (position !== null) return { position };
  }
  return { position: "se" };
};

const gridOf = (arg: unknown): GridSlotProps => {
  const axis: unknown = isRecord(arg) ? arg["axis"] : undefined;
  return { axis: axis === "vertical" ? "vertical" : "horizontal" };
};

const nudgeStep = (event: KeyboardEvent): number => (event.shiftKey ? 10 : 1);

const onSelectionKeydown = (scope: ScopeLike, event: KeyboardEvent): void => {
  if (event.defaultPrevented) return;
  if (isComposing(event)) return;
  if (scope.context.disabled) return;
  const ctx = scope.context;
  const step = nudgeStep(event);
  switch (event.key) {
    case "+":
    case "=":
      event.preventDefault();
      scope.send({ type: "ZOOM", delta: scope.context.zoomStep ?? 0.1 });
      return;
    case "-":
    case "_":
      event.preventDefault();
      scope.send({ type: "ZOOM", delta: -(scope.context.zoomStep ?? 0.1) });
      return;
    case "ArrowUp":
    case "ArrowDown":
    case "ArrowLeft":
    case "ArrowRight": {
      event.preventDefault();
      const dx = event.key === "ArrowLeft"
        ? -step
        : event.key === "ArrowRight"
        ? step
        : 0;
      const dy = event.key === "ArrowUp"
        ? -step
        : event.key === "ArrowDown"
        ? step
        : 0;
      if (ctx.fixedCropArea) {
        scope.send({ type: "NUDGE_PAN", dx, dy });
        return;
      }
      if (event.altKey) {
        const handle: CropHandle =
          event.key === "ArrowUp" || event.key === "ArrowDown" ? "s" : "e";
        scope.send({
          type: "NUDGE_RESIZE",
          handlePosition: handle,
          large: event.shiftKey,
        });
        return;
      }
      scope.send({ type: "NUDGE_MOVE", dx, dy });
      return;
    }
    default:
      return;
  }
};

export const def = {
  name: "image-cropper",
  machine: (args: ImageCropperArgs, authored) =>
    imageCropperMachine(args, authored),
  start: "idle",
  parts: {
    root: {
      attrs: (scope: ScopeLike) => {
        const crop = scope.context;
        const rounded = roundedCrop(crop);
        const measured = crop.viewportRect.width > 0 &&
          crop.viewportRect.height > 0;
        return {
          role: "group",
          dir: scope.context.dir,
          ...ariaRoleDescription("Image cropper"),
          "aria-label": "Image cropper",
          ...ariaDescription(
            `Crop positioned at ${rounded.x}px from the left and ${rounded.y}px from the top with a size of ${rounded.width}px by ${rounded.height}px, ${
              crop.zoom.toFixed(2)
            }x zoom, ${Math.round(crop.rotation)} degrees rotation.`,
          ),
          ...ariaBusy(measured ? undefined : "true"),
          "data-shape": crop.cropShape,
          "data-dragging": scope.attr(scope.state === "dragging"),
          "data-panning": scope.attr(scope.state === "panning"),
        };
      },
    },
    viewport: {
      attrs: (scope) => {
        const ctx = scope.context;
        const measured = ctx.viewportRect.width > 0 &&
          ctx.viewportRect.height > 0;
        const disabled = scope.context.disabled;
        return {
          role: "presentation",
          "data-measured": dataAttr(measured),
          // Mount measurement: the guards refuse every gesture without a
          // rect, and nothing presses before the user does. The resize
          // report fires on observe, which is mount, and on every reflow.
          "use:resize-observer": {
            onResize: (size: { width: number; height: number }): void => {
              if (size.width === 0 || size.height === 0) return;
              const current = scope.context.viewportRect;
              if (
                current.width === size.width &&
                current.height === size.height &&
                current.x === 0 &&
                current.y === 0
              ) return;
              scope.send({
                type: "SET_VIEWPORT",
                viewport: {
                  x: 0,
                  y: 0,
                  width: size.width,
                  height: size.height,
                },
              });
              scope.send({
                type: "SET_DEFAULT_CROP",
                viewport: {
                  x: 0,
                  y: 0,
                  width: size.width,
                  height: size.height,
                },
              });
            },
          },
          // The pan is the viewport's own gesture: the runtime's drag
          // action owns the press, the capture and the moves, and the
          // machine keeps the geometry.
          "use:drag": {
            enabled: !disabled,
            preventDefault: false,
            cancelOnEscape: false,
            onStart: (press: DragPress): void => {
              // A press inside the selection belongs to the crop drag, not
              // to the pan. The selection's gesture normally swallows it;
              // this guard covers the presses it refuses.
              if (insideSelection(scope, press.target)) return;
              const point = viewportPoint(scope, press.x, press.y);
              if (point === null) return;
              const rect = scope.measure("viewport");
              if (rect !== null && rect.width !== 0 && rect.height !== 0) {
                const current = scope.context.viewportRect;
                if (
                  !(current.width === rect.width &&
                    current.height === rect.height && current.x === 0 &&
                    current.y === 0)
                ) {
                  scope.send({
                    type: "SET_VIEWPORT",
                    viewport: {
                      x: 0,
                      y: 0,
                      width: rect.width,
                      height: rect.height,
                    },
                  });
                  scope.send({
                    type: "SET_DEFAULT_CROP",
                    viewport: {
                      x: 0,
                      y: 0,
                      width: rect.width,
                      height: rect.height,
                    },
                  });
                }
              }
              scope.send({ type: "PAN_POINTER_DOWN", point });
            },
            onMove: (delta: DragDelta): void => {
              if (scope.state !== "panning") return;
              const point = viewportPoint(scope, delta.x, delta.y);
              if (point === null) return;
              scope.send({ type: "POINTER_MOVE", point });
            },
            onEnd: (): void => {
              if (scope.state !== "panning") return;
              scope.send({ type: "POINTER_UP" });
            },
          },
          onWheel: (event: WheelEvent): void => {
            if (disabled) return;
            event.preventDefault();
            const step = scope.context.zoomStep ?? 0.1;
            const delta = event.deltaY > 0 ? -step : step;
            scope.send({ type: "ZOOM", delta });
          },
        };
      },
    },
    image: {
      attrs: (scope: ScopeLike) => {
        const crop = scope.context;
        const src = scope.context.src;
        const alt = scope.context.alt;
        const measured = crop.viewportRect.width > 0 &&
          crop.viewportRect.height > 0;
        return {
          role: "presentation",
          alt: alt.length > 0 ? alt : "",
          ...ariaHidden("true"),
          draggable: "false",
          src: src.length > 0 ? src : undefined,
          "data-ready": dataAttr(measured),
          style: {
            transform:
              `scale(${crop.zoom}) rotate(${crop.rotation}deg) translate(${crop.offset.x}px, ${crop.offset.y}px) scaleX(${
                crop.flipHorizontal ? -1 : 1
              }) scaleY(${crop.flipVertical ? -1 : 1})`,
          },
          onLoad: (event: Event): void => {
            const size = naturalSizeOf(event.currentTarget);
            if (size === null) return;
            scope.send({ type: "SET_NATURAL_SIZE", size });
          },
        };
      },
    },
    selection: {
      attrs: (scope: ScopeLike) => {
        const ctx = scope.context;
        const crop = roundedCrop(ctx);
        const maxX = isGesturing(scope.state)
          ? Math.max(0, Math.round(ctx.viewportRect.width - ctx.crop.width))
          : Math.max(crop.x, 0);
        return {
          role: "slider",
          tabindex: "0",
          "data-dragging": scope.attr(scope.state === "dragging"),
          "aria-label": `Crop selection area (${
            ctx.cropShape === "circle" ? "circle" : "rectangle"
          })`,
          ...ariaRoleDescription("2d slider"),
          ...sliderThumb({
            min: "0",
            max: String(maxX),
            now: String(crop.x),
            text:
              `Position X ${crop.x}px, Y ${crop.y}px. Size ${crop.width}px by ${crop.height}px.`,
          }),
          ...ariaDescription(
            "Use arrow keys to move the crop. Hold Alt with arrow keys to resize width or height. Press plus or minus to zoom.",
          ),
          "data-disabled": dataAttr(ctx.fixedCropArea),
          "data-shape": ctx.cropShape,
          "data-measured": dataAttr(
            ctx.viewportRect.width > 0 && ctx.viewportRect.height > 0,
          ),

          style: {
            // The crop rect is the machine's own geometry: the bag carries
            // it as concrete properties, and the markup names no var.
            left: `${ctx.crop.x}px`,
            top: `${ctx.crop.y}px`,
            width: `${ctx.crop.width}px`,
            height: `${ctx.crop.height}px`,
          },
          // The crop drag is the selection's own gesture: the press stops
          // there, so the viewport's pan never arms behind it.
          "use:drag": {
            enabled: !ctx.fixedCropArea,
            preventDefault: false,
            stopPropagation: true,
            cancelOnEscape: false,
            onStart: (press: DragPress): void => {
              const point = viewportPoint(scope, press.x, press.y);
              if (point === null) return;
              scope.send({ type: "POINTER_DOWN", point });
            },
            onMove: (delta: DragDelta): void => {
              if (scope.state !== "dragging") return;
              const point = viewportPoint(scope, delta.x, delta.y);
              if (point === null) return;
              scope.send({ type: "POINTER_MOVE", point });
            },
            onEnd: (): void => {
              if (scope.state !== "dragging") return;
              scope.send({ type: "POINTER_UP" });
            },
          },
          onKeydown: (event: KeyboardEvent): void =>
            onSelectionKeydown(scope, event),
        };
      },
    },
    handle: {
      attrs: (scope: ScopeLike, arg?: unknown) => {
        const slots = handleOf(arg);
        const fixed = scope.context.fixedCropArea;
        return {
          id: scope.id("handle", slots.position),
          role: "presentation",
          ...ariaHidden("true"),
          "data-position": slots.position,
          "data-disabled": dataAttr(fixed),
          // The resize is the handle's own gesture: the press stops there,
          // so the selection's drag never arms behind it — and the moves
          // the resize needs come from this gesture, not from the
          // selection's.
          "use:drag": {
            enabled: !fixed,
            preventDefault: false,
            stopPropagation: true,
            cancelOnEscape: false,
            onStart: (press: DragPress): void => {
              const point = viewportPoint(scope, press.x, press.y);
              if (point === null) return;
              scope.send({
                type: "POINTER_DOWN",
                point,
                handlePosition: slots.position,
              });
            },
            onMove: (delta: DragDelta): void => {
              if (scope.state !== "dragging") return;
              const point = viewportPoint(scope, delta.x, delta.y);
              if (point === null) return;
              scope.send({ type: "POINTER_MOVE", point });
            },
            onEnd: (): void => {
              if (scope.state !== "dragging") return;
              scope.send({ type: "POINTER_UP" });
            },
          },
        };
      },
    },
    grid: {
      attrs: (scope: ScopeLike, arg?: unknown) => {
        const slots = gridOf(arg);
        return {
          ...ariaHidden("true"),
          "data-axis": slots.axis,
          "data-dragging": scope.attr(scope.state === "dragging"),
        };
      },
    },
  },
  commands: {
    setZoom: {
      event: ([zoom]: [zoom: number]) => ({ type: "SET_ZOOM", zoom }),
    },
    zoomBy: {
      event: ([delta]: [delta: number], context: ImageCropperContext) => ({
        type: "SET_ZOOM",
        zoom: context.zoom + delta,
      }),
    },
    setRotation: {
      event: ([rotation]: [rotation: number]) => ({
        type: "SET_ROTATION",
        rotation,
      }),
    },
    rotateBy: {
      event: ([degrees]: [degrees: number], context: ImageCropperContext) => ({
        type: "SET_ROTATION",
        rotation: context.rotation + degrees,
      }),
    },
    setFlip: {
      event: (args) => {
        const flip: unknown = args[0];
        if (!isRecord(flip)) return { type: "SET_FLIP" };
        const horizontal: unknown = flip["horizontal"];
        const vertical: unknown = flip["vertical"];
        return {
          type: "SET_FLIP",
          ...(typeof horizontal === "boolean" ? { horizontal } : {}),
          ...(typeof vertical === "boolean" ? { vertical } : {}),
        };
      },
    },
    flipHorizontal: {
      // A same-value write is a harmless no-op assign: the watch sees no
      // diff and reports nothing, exactly as the early return did.
      event: (args, context: ImageCropperContext) => {
        const next = args[0];
        return {
          type: "SET_FLIP",
          horizontal: typeof next === "boolean"
            ? next
            : !context.flipHorizontal,
        };
      },
    },
    flipVertical: {
      event: (args, context: ImageCropperContext) => {
        const next = args[0];
        return {
          type: "SET_FLIP",
          vertical: typeof next === "boolean" ? next : !context.flipVertical,
        };
      },
    },
    resize: {
      // A fixed area refuses in the machine's `canResize` guard; the
      // refused send lands nowhere and reports nothing.
      event: (args) => {
        const handlePosition = handleOf(args[0]).position;
        const rawDelta = args[1];
        const delta = typeof rawDelta === "number"
          ? rawDelta
          : countOf(rawDelta) ?? 0;
        const dx = handlePosition.includes("w")
          ? -delta
          : handlePosition.includes("e")
          ? delta
          : 0;
        const dy = handlePosition.includes("n")
          ? -delta
          : handlePosition.includes("s")
          ? delta
          : 0;
        return { type: "RESIZE_CROP", handlePosition, delta: { x: dx, y: dy } };
      },
    },
    reset: { event: () => ({ type: "RESET" }) },
  },
  readers: {
    handles: { read: () => HANDLES },
    crop: { read: (context: ImageCropperContext) => ({ ...context.crop }) },
    zoom: { read: (context: ImageCropperContext) => context.zoom },
    rotation: { read: (context: ImageCropperContext) => context.rotation },
    flip: {
      read: (context: ImageCropperContext) => ({
        horizontal: context.flipHorizontal,
        vertical: context.flipVertical,
      }),
    },
    dragging: { read: (_context, state) => state === "dragging" },
    panning: { read: (_context, state) => state === "panning" },
    measured: {
      read: (context: ImageCropperContext) =>
        context.viewportRect.width > 0 && context.viewportRect.height > 0,
    },
  },
  methods: {
    getCropData: {
      call: (context: ImageCropperContext) => ({ ...roundedCrop(context) }),
    },
  },
  events: {
    "crop-change": {
      prop: "onCropChange",
      watch: (context: ImageCropperContext) => {
        const crop = context.crop;
        return [crop.x, crop.y, crop.width, crop.height];
      },
      detail: (_watched, _event, _props, context: ImageCropperContext) => ({
        crop: { ...context.crop },
      }),
    },
    "zoom-change": {
      prop: "onZoomChange",
      watch: (context: ImageCropperContext) => [context.zoom],
      detail: (watched: readonly unknown[]) => {
        const zoom = watched[0];
        return { zoom: typeof zoom === "number" ? zoom : 1 };
      },
    },
    "rotation-change": {
      prop: "onRotationChange",
      watch: (context: ImageCropperContext) => [context.rotation],
      detail: (watched: readonly unknown[]) => {
        const rotation = watched[0];
        return { rotation: typeof rotation === "number" ? rotation : 0 };
      },
    },
    "flip-change": {
      prop: "onFlipChange",
      watch: (
        context: ImageCropperContext,
      ) => [context.flipHorizontal, context.flipVertical],
      detail: (watched: readonly unknown[]) => ({
        horizontal: watched[0] === true,
        vertical: watched[1] === true,
      }),
    },
  },
} satisfies ComponentDef<
  ImageCropperContext,
  ImageCropperEvents,
  Record<string, unknown>,
  ImageCropperArgs,
  ImageCropperState
>;

export type ImageCropperApi = ApiOf<typeof def>;
export const imageCropper = defineComponent<
  ImageCropperContext,
  ImageCropperEvents,
  ImageCropperApi,
  ImageCropperArgs,
  ImageCropperState
>(def);
