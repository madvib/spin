import {
  dataAttr,
  defineComponent,
  isComposing,
  textProp,
  type ComponentDef,
  type PartScope as ScopeLike,
} from "@spin/runtime";
import {
  config,
  implementations,
  isGesturing,
  roundedCrop,
  type CropHandle,
  type CropPoint,
  type CropRect,
  type ImageCropperContext,
  type ImageCropperEvent,
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

// Scope props arrive as strings; hooks write numbers. Accept both — a
// string-authored `defaultValue="45"` seeds 45, not 0.
const numProp = (raw: unknown): number | null => {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  if (typeof raw === "string" && raw.trim().length > 0) {
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

type Ctx = ImageCropperContext;

const asCtx = (context: Record<string, unknown>): Ctx => context as unknown as Ctx;

const sameRect = (a: CropRect, b: CropRect): boolean =>
  a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;

const parseFlip = (raw: unknown): { horizontal: boolean; vertical: boolean } | null => {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r["horizontal"] !== "boolean" && typeof r["vertical"] !== "boolean") return null;
  return {
    horizontal: r["horizontal"] === true,
    vertical: r["vertical"] === true,
  };
};

const HANDLES: readonly CropHandle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

/** A pointer point relative to the viewport node. */
const viewportPoint = (node: Element | null, clientX: number, clientY: number): CropPoint | null => {
  if (node === null) return null;
  const rect = node.getBoundingClientRect();
  return { x: clientX - rect.left, y: clientY - rect.top };
};

type Capturable = Element & { setPointerCapture?: (id: number) => void };

/** The nudge step: shift multiplies by ten. */
const nudgeStep = (event: KeyboardEvent): number => (event.shiftKey ? 10 : 1);

const onSelectionKeydown = (scope: ScopeLike, event: KeyboardEvent): void => {
  if (event.defaultPrevented) return;
  if (isComposing(event)) return;
  if (scope.props["disabled"] === true) return;
  const ctx = asCtx(scope.context);
  const step = nudgeStep(event);
  switch (event.key) {
    case "+":
    case "=":
      event.preventDefault();
      scope.send({ type: "ZOOM", delta: scope.props["zoomStep"] as number });
      return;
    case "-":
    case "_":
      event.preventDefault();
      scope.send({ type: "ZOOM", delta: -(scope.props["zoomStep"] as number) });
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

interface BagMemo {
  sig: string;
  bag: Record<string, unknown>;
}

/** Per-slot memos keyed by stable owner objects: the recipe hands the
 * getters fresh literals per render, which would defeat an identity memo. */
const ownerBags = new WeakMap<object, BagMemo>();
const keyedOwner = (
  owner: object,
  sig: string,
  build: () => Record<string, unknown>,
): Record<string, unknown> => {
  const hit = ownerBags.get(owner);
  if (hit !== undefined && hit.sig === sig) return hit.bag;
  const bag = build();
  ownerBags.set(owner, { sig, bag });
  return bag;
};
const owners = new Map<string, object>();
const ownerFor = (key: string): object => {
  let owner = owners.get(key);
  if (owner === undefined) {
    owner = { key };
    owners.set(key, owner);
  }
  return owner;
};

const def: ComponentDef<ImageCropperContext, ImageCropperEvent> = {
  name: "image-cropper",
  config,
  implementations,
  seed: (props, authored) => ({
    cropShape: props["cropShape"] === "circle" ? "circle" : "rect",
    aspectRatio: numProp(props["aspectRatio"]) ?? null,
    minWidth: numProp(props["minWidth"]) ?? null,
    minHeight: numProp(props["minHeight"]) ?? null,
    maxWidth: numProp(props["maxWidth"]) ?? null,
    maxHeight: numProp(props["maxHeight"]) ?? null,
    fixedCropArea: props["fixedCropArea"] === true,
    zoom: numProp(authored("zoom") ? props["zoom"] : props["defaultZoom"]) ?? 1,
    rotation: numProp(authored("rotation") ? props["rotation"] : props["defaultRotation"]) ?? 0,
    flipHorizontal: (parseFlip(authored("flip") ? props["flip"] : props["defaultFlip"]) ?? { horizontal: false, vertical: false }).horizontal,
    flipVertical: (parseFlip(authored("flip") ? props["flip"] : props["defaultFlip"]) ?? { horizontal: false, vertical: false }).vertical,
  }),
  channels: {
    zoom: {
      controlled: true,
      parse: (raw) => numProp(raw) ?? 1,
      event: (value: number) => ({ type: "SET_ZOOM", zoom: value }),
    },
    defaultZoom: { parse: (raw) => numProp(raw) ?? 1 },
    rotation: {
      controlled: true,
      parse: (raw) => numProp(raw) ?? 0,
      event: (value: number) => ({ type: "SET_ROTATION", rotation: value }),
    },
    defaultRotation: { parse: (raw) => numProp(raw) ?? 0 },
    flip: {
      controlled: true,
      parse: parseFlip,
      nullable: true,
      event: (value: { horizontal: boolean; vertical: boolean } | null) => ({
        type: "SET_FLIP",
        horizontal: value?.horizontal === true,
        vertical: value?.vertical === true,
      }),
      equal: (current, outer) => {
        if (current === null || current === undefined || outer === null || outer === undefined) {
          return current == null && outer == null;
        }
        const a = current as { horizontal: boolean; vertical: boolean };
        const b = outer as { horizontal: boolean; vertical: boolean };
        return a.horizontal === b.horizontal && a.vertical === b.vertical;
      },
    },
    defaultFlip: { parse: parseFlip },
    cropShape: { parse: (raw) => (raw === "circle" ? "circle" : "rect") },
    aspectRatio: { parse: (raw) => numProp(raw) ?? null },
    minWidth: { parse: (raw) => numProp(raw) ?? null },
    minHeight: { parse: (raw) => numProp(raw) ?? null },
    maxWidth: { parse: (raw) => numProp(raw) ?? null },
    maxHeight: { parse: (raw) => numProp(raw) ?? null },
    fixedCropArea: { parse: (raw) => raw === true },
    disabled: { parse: (raw) => raw === true },
    src: { parse: textProp },
    alt: { parse: textProp },
    dir: { parse: (raw) => (raw === "rtl" ? "rtl" : "ltr") },
    zoomStep: { parse: (raw) => numProp(raw) ?? 0.1 },
  },
  scalars: ["cropShape", "aspectRatio", "minWidth", "minHeight", "maxWidth", "maxHeight", "fixedCropArea"],
  parts: {
    root: {
      sig: (scope) => {
        const crop = asCtx(scope.context);
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
        const crop = asCtx(scope.context);
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
        const measured = asCtx(scope.context).viewportRect;
        return [`${measured.width > 0 && measured.height > 0}`].join(" ");
      },
      attrs: (scope) => {
        const ctx = asCtx(scope.context);
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
              const current = asCtx(scope.context).viewportRect;
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
            const node = event.currentTarget as Element | null;
            // A press on the selection (or a handle inside it) belongs to
            // the drag, not the pan: the selection's own press stops there.
            const target = event.target as Element | null;
            const selection = typeof document !== "undefined" && typeof Element !== "undefined" && target instanceof Element
              ? document.getElementById(scope.id("selection"))
              : null;
            if (selection !== null && target !== null && selection.contains(target)) return;
            const point = viewportPoint(node, event.clientX, event.clientY);
            if (point === null) return;
            // Measure the viewport node: the machine never touches DOM.
            if (node !== null) {
              const rect = node.getBoundingClientRect();
              if (rect.width !== 0 && rect.height !== 0) {
                const current = asCtx(scope.context).viewportRect;
                if (!(current.width === rect.width && current.height === rect.height && current.x === 0 && current.y === 0)) {
                  scope.send({ type: "SET_VIEWPORT", viewport: { x: 0, y: 0, width: rect.width, height: rect.height } });
                  scope.send({ type: "SET_DEFAULT_CROP", viewport: { x: 0, y: 0, width: rect.width, height: rect.height } });
                }
              }
            }
            (node as Capturable | null)?.setPointerCapture?.(event.pointerId);
            scope.send({ type: "PAN_POINTER_DOWN", point });
          },
          onPointermove: (event: PointerEvent): void => {
            if (scope.state !== "panning") return;
            const node = event.currentTarget as Element | null;
            const point = viewportPoint(node, event.clientX, event.clientY);
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
            const delta = event.deltaY > 0 ? -(scope.props["zoomStep"] as number) : (scope.props["zoomStep"] as number);
            scope.send({ type: "ZOOM", delta });
          },
        };
      },
    },
    image: {
      sig: (scope) => {
        const crop = asCtx(scope.context);
        return [
          scope.props["src"],
          crop.viewportRect.width > 0 && crop.viewportRect.height > 0,
          crop.zoom, crop.rotation, crop.offset.x, crop.offset.y,
          crop.flipHorizontal, crop.flipVertical,
        ].join(" ");
      },
      attrs: (scope) => {
        const crop = asCtx(scope.context);
        const src = scope.props["src"] as string;
        const measured = crop.viewportRect.width > 0 && crop.viewportRect.height > 0;
        return {
          id: scope.id("image"),
          role: "presentation",
          alt: (scope.props["alt"] as string).length > 0 ? scope.props["alt"] : "",
          "aria-hidden": "true",
          draggable: "false",
          src: src.length > 0 ? src : undefined,
          "data-ready": dataAttr(measured),
          style: {
            transform: `scale(${crop.zoom}) rotate(${crop.rotation}deg) translate(${crop.offset.x}px, ${crop.offset.y}px) scaleX(${crop.flipHorizontal ? -1 : 1}) scaleY(${crop.flipVertical ? -1 : 1})`,
          },
          onLoad: (event: Event): void => {
            const node = event.currentTarget as (HTMLImageElement & { naturalWidth: number; naturalHeight: number }) | null;
            if (node === null || node.naturalWidth === 0) return;
            scope.send({
              type: "SET_NATURAL_SIZE",
              size: { width: node.naturalWidth, height: node.naturalHeight },
            });
          },
        };
      },
    },
    selection: {
      sig: (scope) => {
        const crop = roundedCrop(asCtx(scope.context));
        const ctx = asCtx(scope.context);
        const measured = ctx.viewportRect.width > 0 && ctx.viewportRect.height > 0;
        return [crop.x, crop.y, crop.width, crop.height, measured, scope.state, ctx.fixedCropArea, ctx.cropShape].join(" ");
      },
      attrs: (scope) => {
        const ctx = asCtx(scope.context);
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
            const viewport = typeof document !== "undefined"
              ? document.getElementById(scope.id("viewport"))
              : null;
            const point = viewportPoint(viewport, event.clientX, event.clientY);
            if (point === null) return;
            event.stopPropagation();
            (event.currentTarget as Capturable | null)?.setPointerCapture?.(event.pointerId);
            scope.send({ type: "POINTER_DOWN", point });
          },
          onPointermove: (event: PointerEvent): void => {
            if (scope.state !== "dragging") return;
            const viewport = typeof document !== "undefined"
              ? document.getElementById(scope.id("viewport"))
              : null;
            const point = viewportPoint(viewport, event.clientX, event.clientY);
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
      sig: (scope, arg) => {
        const slots = arg as HandleSlotProps;
        return [slots.position, asCtx(scope.context).fixedCropArea].join(" ");
      },
      attrs: (scope, arg) => {
        const slots = arg as HandleSlotProps;
        const fixed = asCtx(scope.context).fixedCropArea;
        return keyedOwner(ownerFor(`handle:${slots.position}`), `${slots.position}:${fixed}`, () => ({
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
            const viewport = typeof document !== "undefined"
              ? document.getElementById(scope.id("viewport"))
              : null;
            const point = viewportPoint(viewport, event.clientX, event.clientY);
            if (point === null) return;
            event.stopPropagation();
            (event.currentTarget as Capturable | null)?.setPointerCapture?.(event.pointerId);
            scope.send({ type: "POINTER_DOWN", point, handlePosition: slots.position });
          },
        }));
      },
    },
    grid: {
      sig: (scope, arg) => {
        const slots = arg as GridSlotProps;
        return [slots.axis, scope.state].join(" ");
      },
      attrs: (scope, arg) => {
        const slots = arg as GridSlotProps;
        return keyedOwner(ownerFor(`grid:${slots.axis}`), `${slots.axis}:${scope.state}`, () => ({
          "aria-hidden": "true",
          "data-axis": slots.axis,
          "data-dragging": dataAttr(scope.state === "dragging"),
        }));
      },
    },
  },
  commands: {
    setZoom: { event: (args) => ({ type: "SET_ZOOM", zoom: args[0] as number }) },
    zoomBy: {
      event: (args, context) => ({
        type: "SET_ZOOM",
        zoom: (context as unknown as Ctx).zoom + (args[0] as number),
      }),
    },
    setRotation: { event: (args) => ({ type: "SET_ROTATION", rotation: args[0] as number }) },
    rotateBy: {
      event: (args, context) => ({
        type: "SET_ROTATION",
        rotation: (context as unknown as Ctx).rotation + (args[0] as number),
      }),
    },
    setFlip: {
      event: (args) => {
        const flip = args[0] as { horizontal?: boolean; vertical?: boolean };
        return {
          type: "SET_FLIP",
          ...(flip.horizontal === undefined ? {} : { horizontal: flip.horizontal }),
          ...(flip.vertical === undefined ? {} : { vertical: flip.vertical }),
        };
      },
    },
    flipHorizontal: {
      // A same-value write is a harmless no-op assign: the watch sees no
      // diff and reports nothing, exactly as the early return did.
      event: (args, context) => {
        const ctx = context as unknown as Ctx;
        const next = (args[0] as boolean | undefined) ?? !ctx.flipHorizontal;
        return { type: "SET_FLIP", horizontal: next };
      },
    },
    flipVertical: {
      event: (args, context) => {
        const ctx = context as unknown as Ctx;
        const next = (args[0] as boolean | undefined) ?? !ctx.flipVertical;
        return { type: "SET_FLIP", vertical: next };
      },
    },
    resize: {
      // A fixed area refuses in the machine's `canResize` guard; the
      // refused send lands nowhere and reports nothing.
      event: (args) => {
        const handlePosition = args[0] as CropHandle;
        const delta = args[1] as number;
        const dx = handlePosition.includes("w") ? -delta : handlePosition.includes("e") ? delta : 0;
        const dy = handlePosition.includes("n") ? -delta : handlePosition.includes("s") ? delta : 0;
        return { type: "RESIZE_CROP", handlePosition, delta: { x: dx, y: dy } };
      },
    },
    reset: { event: () => ({ type: "RESET" }) },
  },
  readers: {
    handles: { read: () => HANDLES },
    crop: { read: (context) => ({ ...(context as unknown as Ctx).crop }) },
    zoom: { read: (context) => (context as unknown as Ctx).zoom },
    rotation: { read: (context) => (context as unknown as Ctx).rotation },
    flip: {
      read: (context) => {
        const ctx = context as unknown as Ctx;
        return { horizontal: ctx.flipHorizontal, vertical: ctx.flipVertical };
      },
    },
    dragging: { read: (_context, state) => state === "dragging" },
    panning: { read: (_context, state) => state === "panning" },
    measured: {
      read: (context) => {
        const rect = (context as unknown as Ctx).viewportRect;
        return rect.width > 0 && rect.height > 0;
      },
    },
  },
  methods: {
    getCropData: {
      call: (context) => ({ ...roundedCrop(context as unknown as Ctx) }),
    },
  },
  events: {
    "crop-change": {
      prop: "onCropChange",
      watch: (context) => {
        const crop = (context as unknown as Ctx).crop;
        return [crop.x, crop.y, crop.width, crop.height];
      },
      detail: (watched, _event, _props, context) => {
        void watched;
        return { crop: { ...(context as unknown as Ctx).crop } };
      },
    },
    "zoom-change": {
      prop: "onZoomChange",
      watch: (context) => [(context as unknown as Ctx).zoom],
      detail: (watched) => ({ zoom: watched[0] as number }),
    },
    "rotation-change": {
      prop: "onRotationChange",
      watch: (context) => [(context as unknown as Ctx).rotation],
      detail: (watched) => ({ rotation: watched[0] as number }),
    },
    "flip-change": {
      prop: "onFlipChange",
      watch: (context) => {
        const ctx = context as unknown as Ctx;
        return [ctx.flipHorizontal, ctx.flipVertical];
      },
      detail: (watched) => ({
        horizontal: watched[0] as boolean,
        vertical: watched[1] as boolean,
      }),
    },
  },
};

export const imageCropper = defineComponent<ImageCropperContext, ImageCropperEvent, ImageCropperApi>(def);
