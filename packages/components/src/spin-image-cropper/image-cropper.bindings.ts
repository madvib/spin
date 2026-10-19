import {
  dataAttr,
  defineComponent,
  isComposing,
  type ComponentDef,
  type PartScope,
  type SlotScope,
} from "@spin/runtime";
import {
  config,
  flipOf,
  implementations,
  initial,
  isGesturing,
  roundedCrop,
  type CropHandle,
  type CropPoint,
  type CropRect,
  type ImageCropperContext,
  type ImageCropperEvent,
  type ImageCropperInitial,
} from "./image-cropper.machine.ts";

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
 * the root bag carries it as CSS custom properties only (`--crop-x`,
 * `--zoom`...). Concrete properties stay banned: the recipe's utility
 * classes decide what each var feeds.
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

export interface ImageCropperApi {
  readonly handles: readonly CropHandle[];
  readonly crop: CropRect;
  readonly zoom: number;
  readonly rotation: number;
  readonly flip: { readonly horizontal: boolean; readonly vertical: boolean };
  readonly dragging: boolean;
  readonly panning: boolean;
  readonly measured: boolean;
  setZoom(zoom: number): void;
  zoomBy(delta: number): void;
  setRotation(rotation: number): void;
  rotateBy(degrees: number): void;
  setFlip(flip: { horizontal?: boolean; vertical?: boolean }): void;
  flipHorizontal(value?: boolean): void;
  flipVertical(value?: boolean): void;
  resize(handlePosition: CropHandle, delta: number): void;
  reset(): void;
  getCropData(): CropRect;
  getRootProps(): Record<string, unknown>;
  getViewportProps(): Record<string, unknown>;
  getImageProps(): Record<string, unknown>;
  getSelectionProps(): Record<string, unknown>;
  getHandleProps(props: HandleSlotProps): Record<string, unknown>;
  getGridProps(props: GridSlotProps): Record<string, unknown>;
}

interface ScopeLike extends PartScope<unknown, ImageCropperContext> {}

interface SlotLike<R> extends SlotScope<R, ImageCropperContext> {}

/** Transport guarantees the raw prop bag is an ImageCropperInitial-shaped object. */
const isImageCropperInitial = (raw: unknown): raw is ImageCropperInitial =>
  raw !== null && typeof raw === "object";

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

const HANDLES: readonly CropHandle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

/** A pointer point relative to the viewport node, measured through the
 * framework — defs never query the DOM. */
const viewportPoint = (scope: ScopeLike, clientX: number, clientY: number): CropPoint | null => {
  const rect = scope.measure("viewport");
  if (rect === null) return null;
  return { x: clientX - rect.left, y: clientY - rect.top };
};

const isCapturable = (value: unknown): value is Element & { setPointerCapture(id: number): void } => {
  if (!(value instanceof Element) || !("setPointerCapture" in value)) return false;
  const fn: unknown = value.setPointerCapture;
  return typeof fn === "function";
};

const capturePointer = (target: EventTarget | null, pointerId: number): void => {
  if (isCapturable(target)) target.setPointerCapture(pointerId);
};

/** A press inside the selection belongs to the drag, not the pan: the
 * selection's own press stops there. Duck-typed — the target may be a stub. */
const insideSelection = (scope: ScopeLike, target: EventTarget | null): boolean => {
  if (!(target instanceof Element)) return false;
  if (target.id === scope.id("selection")) return true;
  if (typeof target.closest !== "function") return false;
  return target.closest(`[id="${scope.id("selection")}"]`) !== null;
};

/** The nudge step: shift multiplies by ten. */
/** A handle slot arg: the recipe's `{ position: row }` names a handle;
 * anything else is the southeast handle. */
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const HANDLE_NAMES: readonly string[] = ["n", "s", "e", "w", "ne", "nw", "se", "sw"];

const isHandle = (raw: unknown): raw is CropHandle =>
  typeof raw === "string" && (HANDLE_NAMES as readonly string[]).includes(raw);

const textOf = (raw: unknown): string => typeof raw === "string" ? raw : "";

/** The image's natural size off the load target: positive numbers
 * only. The constructor may not exist (linkedom) — read the shape. */
const naturalSizeOf = (target: EventTarget | null): { width: number; height: number } | null => {
  if (!isRecord(target)) return null;
  const width: unknown = target["naturalWidth"];
  const height: unknown = target["naturalHeight"];
  if (typeof width !== "number" || typeof height !== "number" || width === 0) return null;
  return { width, height };
};

const toHandle = (raw: unknown): CropHandle | null => (isHandle(raw) ? raw : null);

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

/** A grid slot arg: horizontal or vertical. */
const gridOf = (arg: unknown): GridSlotProps => {
  const axis: unknown = isRecord(arg) ? arg["axis"] : undefined;
  return { axis: axis === "vertical" ? "vertical" : "horizontal" };
};

/** The nudge step: shift multiplies by ten. */
const nudgeStep = (event: KeyboardEvent): number => (event.shiftKey ? 10 : 1);

const onSelectionKeydown = (scope: ScopeLike, event: KeyboardEvent): void => {
  if (event.defaultPrevented) return;
  if (isComposing(event)) return;
  if (scope.props["disabled"] === true) return;
  const ctx = scope.context;
  const step = nudgeStep(event);
  switch (event.key) {
    case "+":
    case "=":
      event.preventDefault();
      scope.send({ type: "ZOOM", delta: countOf(scope.props["zoomStep"]) ?? 0.1 });
      return;
    case "-":
    case "_":
      event.preventDefault();
      scope.send({ type: "ZOOM", delta: -(countOf(scope.props["zoomStep"]) ?? 0.1) });
      return;
    case "ArrowUp":
    case "ArrowDown":
    case "ArrowLeft":
    case "ArrowRight": {
      event.preventDefault();
      const dx = event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0;
      const dy = event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0;
      if (ctx.fixedCropArea) {
        scope.send({ type: "NUDGE_PAN", dx, dy });
        return;
      }
      if (event.altKey) {
        const handle: CropHandle = event.key === "ArrowUp" || event.key === "ArrowDown" ? "s" : "e";
        scope.send({ type: "NUDGE_RESIZE", handlePosition: handle, large: event.shiftKey });
        return;
      }
      scope.send({ type: "NUDGE_MOVE", dx, dy });
      return;
    }
    default:
      return;
  }
};

const def: ComponentDef<ImageCropperContext, ImageCropperEvent> = {
  name: "image-cropper",
  config,
  implementations,
  seed: (raw, _authored) => {
    const props: ImageCropperInitial = isImageCropperInitial(raw) ? raw : {};
    const shaped = initial(props);
    return {
      ...shaped,
      crop: { x: 0, y: 0, width: 0, height: 0 },
      viewportRect: { x: 0, y: 0, width: 0, height: 0 },
      naturalSize: { width: 0, height: 0 },
      offset: { x: 0, y: 0 },
      pointerStart: null,
      cropStart: null,
      offsetStart: null,
      handlePosition: null,
    };
  },
  reconcile: ({ context, parsed, authored, send }) => {
    if (authored("zoom")) {
      const zoom = countOf(parsed["zoom"]);
      if (zoom !== null && context.zoom !== zoom) {
        send({ type: "SET_ZOOM", zoom });
        return true;
      }
    }
    if (authored("rotation")) {
      const rotation = countOf(parsed["rotation"]);
      if (rotation !== null && context.rotation !== rotation) {
        send({ type: "SET_ROTATION", rotation });
        return true;
      }
    }
    if (authored("flip")) {
      const outer = flipOf(parsed["flip"]);
      if (outer !== null && (context.flipHorizontal !== outer.horizontal || context.flipVertical !== outer.vertical)) {
        send({ type: "SET_FLIP", horizontal: outer.horizontal, vertical: outer.vertical });
        return true;
      }
    }
    return false;
  },
  scalars: ["cropShape", "aspectRatio", "minWidth", "minHeight", "maxWidth", "maxHeight", "fixedCropArea"],
  parts: {
    root: {
      sig: (scope) => {
        const crop = scope.context;
        const rounded = roundedCrop(crop);
        return [
          scope.state,
          rounded.x, rounded.y, rounded.width, rounded.height,
          crop.zoom, crop.rotation, crop.flipHorizontal, crop.flipVertical,
          crop.offset.x, crop.offset.y,
          crop.viewportRect.width > 0 && crop.viewportRect.height > 0,
          crop.cropShape,
        ].join(" ");
      },
      attrs: (scope) => {
        const crop = scope.context;
        const rounded = roundedCrop(crop);
        const measured = crop.viewportRect.width > 0 && crop.viewportRect.height > 0;
        return {
          id: scope.id(""),
          role: "group",
          dir: scope.props["dir"],
          "aria-roledescription": "Image cropper",
          "aria-label": "Image cropper",
          "aria-description": `Crop positioned at ${rounded.x}px from the left and ${rounded.y}px from the top with a size of ${rounded.width}px by ${rounded.height}px, ${crop.zoom.toFixed(2)}x zoom, ${Math.round(crop.rotation)} degrees rotation.`,
          "aria-busy": measured ? undefined : "true",
          "data-shape": crop.cropShape,
          "data-dragging": dataAttr(scope.state === "dragging"),
          "data-panning": dataAttr(scope.state === "panning"),
          style: {
            "--crop-x": `${crop.crop.x}px`,
            "--crop-y": `${crop.crop.y}px`,
            "--crop-width": `${crop.crop.width}px`,
            "--crop-height": `${crop.crop.height}px`,
            "--image-zoom": String(crop.zoom),
            "--image-rotation": `${crop.rotation}deg`,
            "--image-offset-x": `${crop.offset.x}px`,
            "--image-offset-y": `${crop.offset.y}px`,
          },
        };
      },
    },
    viewport: {
      sig: (scope) => {
        const measured = scope.context.viewportRect;
        return [`${measured.width > 0 && measured.height > 0}`].join(" ");
      },
      attrs: (scope) => {
        const ctx = scope.context;
        const measured = ctx.viewportRect.width > 0 && ctx.viewportRect.height > 0;
        const disabled = scope.props["disabled"] === true;
        return {
          id: scope.id("viewport"),
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
              scope.send({ type: "SET_VIEWPORT", viewport: { x: 0, y: 0, width: size.width, height: size.height } });
              scope.send({ type: "SET_DEFAULT_CROP", viewport: { x: 0, y: 0, width: size.width, height: size.height } });
            },
          },
          onPointerdown: (event: PointerEvent): void => {
            if (disabled) return;
            if (event.pointerType === "mouse" && event.button !== 0) return;
            // A press on the selection (or a handle inside it) belongs to
            // the drag, not the pan: the selection's own press stops there.
            if (insideSelection(scope, event.target)) return;
            const point = viewportPoint(scope, event.clientX, event.clientY);
            if (point === null) return;
            // Measure the viewport node: the machine never touches DOM.
            const rect = scope.measure("viewport");
            if (rect !== null && rect.width !== 0 && rect.height !== 0) {
              const current = scope.context.viewportRect;
              if (!(current.width === rect.width && current.height === rect.height && current.x === 0 && current.y === 0)) {
                scope.send({ type: "SET_VIEWPORT", viewport: { x: 0, y: 0, width: rect.width, height: rect.height } });
                scope.send({ type: "SET_DEFAULT_CROP", viewport: { x: 0, y: 0, width: rect.width, height: rect.height } });
              }
            }
            capturePointer(event.currentTarget, event.pointerId);
            scope.send({ type: "PAN_POINTER_DOWN", point });
          },
          onPointermove: (event: PointerEvent): void => {
            if (scope.state !== "panning") return;
            const point = viewportPoint(scope, event.clientX, event.clientY);
            if (point === null) return;
            scope.send({ type: "POINTER_MOVE", point });
          },
          onPointerup: (): void => {
            if (scope.state !== "panning") return;
            scope.send({ type: "POINTER_UP" });
          },
          onWheel: (event: WheelEvent): void => {
            if (disabled) return;
            event.preventDefault();
            const step = countOf(scope.props["zoomStep"]) ?? 0.1;
            const delta = event.deltaY > 0 ? -step : step;
            scope.send({ type: "ZOOM", delta });
          },
        };
      },
    },
    image: {
      sig: (scope) => {
        const crop = scope.context;
        return [
          scope.props["src"],
          crop.viewportRect.width > 0 && crop.viewportRect.height > 0,
          crop.zoom, crop.rotation, crop.offset.x, crop.offset.y,
          crop.flipHorizontal, crop.flipVertical,
        ].join(" ");
      },
      attrs: (scope: ScopeLike) => {
        const crop = scope.context;
        const src = textOf(scope.props["src"]);
        const alt = textOf(scope.props["alt"]);
        const measured = crop.viewportRect.width > 0 && crop.viewportRect.height > 0;
        return {
          id: scope.id("image"),
          role: "presentation",
          alt: alt.length > 0 ? alt : "",
          "aria-hidden": "true",
          draggable: "false",
          src: src.length > 0 ? src : undefined,
          "data-ready": dataAttr(measured),
          style: {
            transform: `scale(${crop.zoom}) rotate(${crop.rotation}deg) translate(${crop.offset.x}px, ${crop.offset.y}px) scaleX(${crop.flipHorizontal ? -1 : 1}) scaleY(${crop.flipVertical ? -1 : 1})`,
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
      sig: (scope) => {
        const crop = roundedCrop(scope.context);
        const ctx = scope.context;
        const measured = ctx.viewportRect.width > 0 && ctx.viewportRect.height > 0;
        return [crop.x, crop.y, crop.width, crop.height, measured, scope.state, ctx.fixedCropArea, ctx.cropShape].join(" ");
      },
      attrs: (scope) => {
        const ctx = scope.context;
        const crop = roundedCrop(ctx);
        const maxX = isGesturing(scope.state)
          ? Math.max(0, Math.round(ctx.viewportRect.width - ctx.crop.width))
          : Math.max(crop.x, 0);
        return {
          id: scope.id("selection"),
          role: "slider",
          tabindex: "0",
          "aria-label": `Crop selection area (${ctx.cropShape === "circle" ? "circle" : "rectangle"})`,
          "aria-roledescription": "2d slider",
          "aria-valuemin": "0",
          "aria-valuemax": String(maxX),
          "aria-valuenow": String(crop.x),
          "aria-valuetext": `Position X ${crop.x}px, Y ${crop.y}px. Size ${crop.width}px by ${crop.height}px.`,
          "aria-description": "Use arrow keys to move the crop. Hold Alt with arrow keys to resize width or height. Press plus or minus to zoom.",
          "data-disabled": dataAttr(ctx.fixedCropArea),
          "data-shape": ctx.cropShape,
          "data-measured": dataAttr(ctx.viewportRect.width > 0 && ctx.viewportRect.height > 0),
          "data-dragging": dataAttr(scope.state === "dragging"),
          style: {
            "--crop-x": `${ctx.crop.x}px`,
            "--crop-y": `${ctx.crop.y}px`,
            "--crop-width": `${ctx.crop.width}px`,
            "--crop-height": `${ctx.crop.height}px`,
            left: "var(--crop-x, 0px)",
            top: "var(--crop-y, 0px)",
            width: "var(--crop-width, 0px)",
            height: "var(--crop-height, 0px)",
          },
          onPointerdown: (event: PointerEvent): void => {
            if (ctx.fixedCropArea) {
              event.preventDefault();
              return;
            }
            if (event.pointerType === "mouse" && event.button !== 0) return;
            const point = viewportPoint(scope, event.clientX, event.clientY);
            if (point === null) return;
            event.stopPropagation();
            capturePointer(event.currentTarget, event.pointerId);
            scope.send({ type: "POINTER_DOWN", point });
          },
          onPointermove: (event: PointerEvent): void => {
            if (scope.state !== "dragging") return;
            const point = viewportPoint(scope, event.clientX, event.clientY);
            if (point === null) return;
            scope.send({ type: "POINTER_MOVE", point });
          },
          onPointerup: (): void => {
            if (scope.state !== "dragging") return;
            scope.send({ type: "POINTER_UP" });
          },
          onKeydown: (event: KeyboardEvent): void => onSelectionKeydown(scope, event),
        };
      },
    },
    handle: {
      sig: (scope: ScopeLike, arg?: unknown) => {
        const slots = handleOf(arg);
        return [slots.position, scope.context.fixedCropArea].join(" ");
      },
      attrs: (scope: ScopeLike, arg?: unknown) => {
        const slots = handleOf(arg);
        const fixed = scope.context.fixedCropArea;
        return {
          id: scope.id("handle", slots.position),
          role: "presentation",
          "aria-hidden": "true",
          "data-position": slots.position,
          "data-disabled": dataAttr(fixed),
          onPointerdown: (event: PointerEvent): void => {
            if (fixed) {
              event.preventDefault();
              return;
            }
            if (event.pointerType === "mouse" && event.button !== 0) return;
            const point = viewportPoint(scope, event.clientX, event.clientY);
            if (point === null) return;
            event.stopPropagation();
            capturePointer(event.currentTarget, event.pointerId);
            scope.send({ type: "POINTER_DOWN", point, handlePosition: slots.position });
          },
        };
      },
    },
    grid: {
      sig: (scope: ScopeLike, arg?: unknown) => {
        const slots = gridOf(arg);
        return [slots.axis, scope.state].join(" ");
      },
      attrs: (scope: ScopeLike, arg?: unknown) => {
        const slots = gridOf(arg);
        return {
          "aria-hidden": "true",
          "data-axis": slots.axis,
          "data-dragging": dataAttr(scope.state === "dragging"),
        };
      },
    },
  },
  commands: {
    setZoom: { event: (args) => ({ type: "SET_ZOOM", zoom: countOf(args[0]) ?? 1 }) },
    zoomBy: {
      event: (args, context: ImageCropperContext) => ({
        type: "SET_ZOOM",
        zoom: context.zoom + (countOf(args[0]) ?? 0),
      }),
    },
    setRotation: { event: (args) => ({ type: "SET_ROTATION", rotation: countOf(args[0]) ?? 0 }) },
    rotateBy: {
      event: (args, context: ImageCropperContext) => ({
        type: "SET_ROTATION",
        rotation: context.rotation + (countOf(args[0]) ?? 0),
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
        return { type: "SET_FLIP", horizontal: typeof next === "boolean" ? next : !context.flipHorizontal };
      },
    },
    flipVertical: {
      event: (args, context: ImageCropperContext) => {
        const next = args[0];
        return { type: "SET_FLIP", vertical: typeof next === "boolean" ? next : !context.flipVertical };
      },
    },
    resize: {
      // A fixed area refuses in the machine's `canResize` guard; the
      // refused send lands nowhere and reports nothing.
      event: (args) => {
        const handlePosition = handleOf(args[0]).position;
        const delta = countOf(args[1]) ?? 0;
        const dx = handlePosition.includes("w") ? -delta : handlePosition.includes("e") ? delta : 0;
        const dy = handlePosition.includes("n") ? -delta : handlePosition.includes("s") ? delta : 0;
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
      read: (context: ImageCropperContext) => ({ horizontal: context.flipHorizontal, vertical: context.flipVertical }),
    },
    dragging: { read: (_context, state) => state === "dragging" },
    panning: { read: (_context, state) => state === "panning" },
    measured: {
      read: (context: ImageCropperContext) => context.viewportRect.width > 0 && context.viewportRect.height > 0,
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
      detail: (_watched, _event, _props, context: ImageCropperContext) => ({ crop: { ...context.crop } }),
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
      watch: (context: ImageCropperContext) => [context.flipHorizontal, context.flipVertical],
      detail: (watched: readonly unknown[]) => ({
        horizontal: watched[0] === true,
        vertical: watched[1] === true,
      }),
    },
  },
};

export const imageCropper = defineComponent<ImageCropperContext, ImageCropperEvent, ImageCropperApi>(def);
