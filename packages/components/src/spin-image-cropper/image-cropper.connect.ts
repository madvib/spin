/**
 * Image-cropper connect: the DOM contract, the view-owned measurement, and
 * the reflexes the parts carry.
 *
 * What the machine owns stays there: the three phases, the crop rect, the
 * zoom/rotation/flip, the gesture starts. Everything that needs a node lives
 * here — the viewport and image measurement (reported in as events, because
 * the machine never touches the DOM), the selection and handle drags (which
 * compute their point against the viewport node and send it in), the
 * keyboard map, and the wheel zoom.
 *
 * The crop geometry is CONTINUOUS — a drag lands between utilities — so the
 * root bag carries it as CSS custom properties only (`--crop-x`, `--zoom`...),
 * serialized by bindSpread's existing path. Concrete properties stay banned:
 * the recipe's utility classes decide what each var feeds.
 */

import {
  isGesturing,
  roundedCrop,
  type CropHandle,
  type CropPoint,
  type CropRect,
  type ImageCropperContext,
} from "./image-cropper.machine.ts";

export interface ImageCropperConnectProps {
  readonly disabled: boolean;
  readonly src: string;
  readonly alt: string;
  readonly dir: "ltr" | "rtl";
  readonly zoomStep: number;
}

export interface HandleSlotProps {
  readonly position: CropHandle;
}

export interface GridSlotProps {
  readonly axis: "horizontal" | "vertical";
}

export interface ImageCropperCommands {
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
}

export interface ImageCropperApi extends ImageCropperCommands {
  readonly handles: readonly CropHandle[];
  readonly crop: CropRect;
  readonly zoom: number;
  readonly rotation: number;
  readonly flip: { readonly horizontal: boolean; readonly vertical: boolean };
  readonly dragging: boolean;
  readonly panning: boolean;
  readonly measured: boolean;
  getRootProps(): Record<string, unknown>;
  getViewportProps(): Record<string, unknown>;
  getImageProps(): Record<string, unknown>;
  getSelectionProps(): Record<string, unknown>;
  getHandleProps(props: HandleSlotProps): Record<string, unknown>;
  getGridProps(props: GridSlotProps): Record<string, unknown>;
}

type Send = (event: { type: string } & Record<string, unknown>) => void;

/** The part-id namespace. */
const NAMESPACE = "image-cropper";

export interface ImageCropperService {
  readonly context: ImageCropperContext;
  readonly phase: string;
  send(event: { type: string } & Record<string, unknown>): void;
}

/** The behavioural props, read on demand: the connect lives as long as the
 * element does, so a snapshot would freeze the first read's values inside the
 * handlers it caches. */
export type ReadImageCropperProps = () => ImageCropperConnectProps;

/** A bag cached until the signature of the fields it reads moves. */
interface BagMemo {
  sig: string;
  bag: Record<string, unknown>;
}

function cached(): (sig: string, build: () => Record<string, unknown>) => Record<string, unknown> {
  let sig = "";
  let bag: Record<string, unknown> | undefined;
  return (next: string, build: () => Record<string, unknown>): Record<string, unknown> => {
    if (bag !== undefined && sig === next) return bag;
    sig = next;
    bag = build();
    return bag;
  };
}

/** `cached` per owner: handles are stable slots, so the memo dies with the
 * slot it came from. */
function keyed<K extends object>(
  store: WeakMap<K, BagMemo>,
  owner: K,
  sig: string,
  build: () => Record<string, unknown>,
): Record<string, unknown> {
  const hit = store.get(owner);
  if (hit !== undefined && hit.sig === sig) return hit.bag;
  const bag = build();
  store.set(owner, { sig, bag });
  return bag;
}

/** Zag's `dataAttr`: the attribute is present when the condition holds and
 * absent otherwise, which is what `hidden`-style utilities key on. */
function dataAttr(value: boolean): string | undefined {
  return value ? "" : undefined;
}

/** Zag's `isComposingEvent`: a composing keystroke is not a navigation. */
const isComposing = (event: KeyboardEvent): boolean =>
  event.isComposing === true || event.keyCode === 229;

/** The nudge step: shift multiplies by ten. */
const nudgeStep = (event: KeyboardEvent): number => (event.shiftKey ? 10 : 1);

const HANDLES: readonly CropHandle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

export function connectRobotImageCropper(
  service: ImageCropperService,
  readProps: ReadImageCropperProps,
  id: string,
): ImageCropperApi {
  const ownerId = id.startsWith(`${NAMESPACE}:`) ? id : `${NAMESPACE}:${id}`;
  const rootId = ownerId;
  const viewportId = `${ownerId}:viewport`;
  const imageId = `${ownerId}:image`;
  const selectionId = `${ownerId}:selection`;
  const handleId = (position: CropHandle): string => `${ownerId}:handle:${position}`;
  const ctx = (): ImageCropperContext => service.context;
  const send: Send = (event): void => {
    service.send(event);
  };

  const measured = (): boolean =>
    ctx().viewportRect.width > 0 && ctx().viewportRect.height > 0;

  /** Report a measured rect: the machine never touches DOM. */
  const measureViewportRect = (viewport: { x: number; y: number; width: number; height: number }): void => {
    const current = ctx().viewportRect;
    if (
      current.width === viewport.width &&
      current.height === viewport.height &&
      current.x === 0 &&
      current.y === 0
    ) return;
    send({ type: "SET_VIEWPORT", viewport: { ...viewport } });
    send({ type: "SET_DEFAULT_CROP", viewport: { ...viewport } });
  };

  /** Measure the viewport node and report it: the machine never touches DOM. */
  const measureViewport = (node: Element | null): void => {
    if (node === null) return;
    const rect = node.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    measureViewportRect({ x: 0, y: 0, width: rect.width, height: rect.height });
  };

  /** A pointer point relative to the viewport node. */
  const viewportPoint = (node: Element | null, clientX: number, clientY: number): CropPoint | null => {
    if (node === null) return null;
    const rect = node.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  // ---- the selection keyboard map -----------------------------------------

  const onSelectionKeydown = (event: KeyboardEvent): void => {
    if (event.defaultPrevented) return;
    if (isComposing(event)) return;
    const props = readProps();
    if (props.disabled) return;
    const step = nudgeStep(event);
    switch (event.key) {
      case "+":
      case "=":
        event.preventDefault();
        send({ type: "ZOOM", delta: props.zoomStep });
        return;
      case "-":
      case "_":
        event.preventDefault();
        send({ type: "ZOOM", delta: -props.zoomStep });
        return;
      case "ArrowUp":
      case "ArrowDown":
      case "ArrowLeft":
      case "ArrowRight": {
        event.preventDefault();
        const dx = event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0;
        const dy = event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0;
        if (ctx().fixedCropArea) {
          send({ type: "NUDGE_PAN", dx, dy });
          return;
        }
        if (event.altKey) {
          const handle: CropHandle = event.key === "ArrowUp" || event.key === "ArrowDown" ? "s" : "e";
          send({ type: "NUDGE_RESIZE", handlePosition: handle, large: event.shiftKey });
          return;
        }
        send({ type: "NUDGE_MOVE", dx, dy });
        return;
      }
      default:
        return;
    }
  };

  // ---- cached bags --------------------------------------------------------

  const rootBag = cached();
  const viewportBag = cached();
  const imageBag = cached();
  const selectionBag = cached();
  const handleBags = new WeakMap<{ position: CropHandle }, BagMemo>();
  const gridBags = new WeakMap<{ axis: "horizontal" | "vertical" }, BagMemo>();

  return {
    get handles(): readonly CropHandle[] {
      return HANDLES;
    },
    get crop(): CropRect {
      return { ...ctx().crop };
    },
    get zoom(): number {
      return ctx().zoom;
    },
    get rotation(): number {
      return ctx().rotation;
    },
    get flip(): { readonly horizontal: boolean; readonly vertical: boolean } {
      return { horizontal: ctx().flipHorizontal, vertical: ctx().flipVertical };
    },
    get dragging(): boolean {
      return service.phase === "dragging";
    },
    get panning(): boolean {
      return service.phase === "panning";
    },
    get measured(): boolean {
      return measured();
    },
    setZoom: (zoom: number): void => send({ type: "SET_ZOOM", zoom }),
    zoomBy: (delta: number): void => send({ type: "SET_ZOOM", zoom: ctx().zoom + delta }),
    setRotation: (rotation: number): void => send({ type: "SET_ROTATION", rotation }),
    rotateBy: (degrees: number): void => send({ type: "SET_ROTATION", rotation: ctx().rotation + degrees }),
    setFlip: (flip: { horizontal?: boolean; vertical?: boolean }): void =>
      send({ type: "SET_FLIP", ...flip }),
    flipHorizontal: (value?: boolean): void => {
      const next = value ?? !ctx().flipHorizontal;
      if (next === ctx().flipHorizontal) return;
      send({ type: "SET_FLIP", horizontal: next });
    },
    flipVertical: (value?: boolean): void => {
      const next = value ?? !ctx().flipVertical;
      if (next === ctx().flipVertical) return;
      send({ type: "SET_FLIP", vertical: next });
    },
    resize: (handlePosition: CropHandle, delta: number): void => {
      if (ctx().fixedCropArea) return;
      const dx = handlePosition.includes("w") ? -delta : handlePosition.includes("e") ? delta : 0;
      const dy = handlePosition.includes("n") ? -delta : handlePosition.includes("s") ? delta : 0;
      send({ type: "RESIZE_CROP", handlePosition, delta: { x: dx, y: dy } });
    },
    reset: (): void => send({ type: "RESET" }),
    getCropData: (): CropRect => ({ ...roundedCrop(ctx()) }),
    getRootProps: () => {
      const props = readProps();
      const crop = ctx();
      const rounded = roundedCrop(ctx());
      return rootBag(
        [
          service.phase,
          crop.crop.x, crop.crop.y, crop.crop.width, crop.crop.height,
          crop.zoom, crop.rotation, crop.flipHorizontal, crop.flipVertical,
          crop.offset.x, crop.offset.y,
          measured(),
        ].join("|"),
        () => ({
          id: rootId,
          role: "group",
          dir: props.dir,
          "aria-roledescription": "Image cropper",
          "aria-label": "Image cropper",
          "aria-description": `Crop positioned at ${rounded.x}px from the left and ${rounded.y}px from the top with a size of ${rounded.width}px by ${rounded.height}px, ${crop.zoom.toFixed(2)}x zoom, ${Math.round(crop.rotation)} degrees rotation.`,
          "aria-busy": measured() ? undefined : "true",
          "data-shape": ctx().cropShape,
          "data-dragging": dataAttr(service.phase === "dragging"),
          "data-panning": dataAttr(service.phase === "panning"),
          style: { "--crop-x": `${crop.crop.x}px`,
            "--crop-y": `${crop.crop.y}px`,
            "--crop-width": `${crop.crop.width}px`,
            "--crop-height": `${crop.crop.height}px`,
            "--image-zoom": String(crop.zoom),
            "--image-rotation": `${crop.rotation}deg`,
            "--image-offset-x": `${crop.offset.x}px`,
            "--image-offset-y": `${crop.offset.y}px` },
        }),
      );
    },
    getViewportProps: () =>
      viewportBag([viewportId, measured()].join("|"), () => ({
        id: viewportId,
        role: "presentation",
        "data-measured": dataAttr(measured()),
        // Mount measurement: the guards refuse every gesture without a
        // rect, and nothing presses before the user does. The resize report
        // fires on observe, which is mount, and on every later reflow.
        "use:resize-observer": {
          onResize: (size: { width: number; height: number }) => {
            if (size.width === 0 || size.height === 0) return;
            measureViewportRect({ x: 0, y: 0, width: size.width, height: size.height });
          },
        },
        onPointerdown: (event: PointerEvent) => {
          const props = readProps();
          if (props.disabled) return;
          if (event.pointerType === "mouse" && event.button !== 0) return;
          const node = event.currentTarget as Element | null;
          // A press on the selection (or a handle inside it) belongs to the
          // drag, not the pan: the selection's own press stops there. The
          // Element check keeps synthetic targets (tests) out of `contains`,
          // which only understands real nodes.
          const target = event.target as Element | null;
          const selection = typeof document !== "undefined" && typeof Element !== "undefined" && target instanceof Element
            ? document.getElementById(selectionId)
            : null;
          if (selection !== null && target !== null && selection.contains(target)) return;
          const point = viewportPoint(node, event.clientX, event.clientY);
          if (point === null) return;
          measureViewport(node);
          (node as Element & { setPointerCapture?: (id: number) => void }).setPointerCapture?.(event.pointerId);
          send({ type: "PAN_POINTER_DOWN", point });
        },
        onPointermove: (event: PointerEvent) => {
          if (service.phase !== "panning") return;
          const node = event.currentTarget as Element | null;
          const point = viewportPoint(node, event.clientX, event.clientY);
          if (point === null) return;
          send({ type: "POINTER_MOVE", point });
        },
        onPointerup: () => {
          if (service.phase !== "panning") return;
          send({ type: "POINTER_UP" });
        },
        onWheel: (event: WheelEvent) => {
          const props = readProps();
          if (props.disabled) return;
          event.preventDefault();
          const delta = event.deltaY > 0 ? -props.zoomStep : props.zoomStep;
          send({ type: "ZOOM", delta });
        },
      })),
    getImageProps: () => {
      const props = readProps();
      const crop = ctx();
      return imageBag([imageId, props.src, measured(), crop.zoom, crop.rotation, crop.offset.x, crop.offset.y, crop.flipHorizontal, crop.flipVertical].join("|"), () => ({
        id: imageId,
        role: "presentation",
        alt: props.alt.length > 0 ? props.alt : "",
        "aria-hidden": "true",
        draggable: "false",
        src: props.src.length > 0 ? props.src : undefined,
        "data-ready": dataAttr(measured()),
        style: {
          transform: `scale(${crop.zoom}) rotate(${crop.rotation}deg) translate(${crop.offset.x}px, ${crop.offset.y}px) scaleX(${crop.flipHorizontal ? -1 : 1}) scaleY(${crop.flipVertical ? -1 : 1})`,
        },
        onLoad: (event: Event) => {
          const node = event.currentTarget as (HTMLImageElement & { naturalWidth: number; naturalHeight: number }) | null;
          if (node === null || node.naturalWidth === 0) return;
          send({
            type: "SET_NATURAL_SIZE",
            size: { width: node.naturalWidth, height: node.naturalHeight },
          });
        },
      }));
    },
    getSelectionProps: () => {
      const crop = roundedCrop(ctx());
      const viewport = ctx().viewportRect;
      const maxX = isGesturing(service.phase)
        ? Math.max(0, Math.round(viewport.width - ctx().crop.width))
        : Math.max(crop.x, 0);
      return selectionBag(
        [
          crop.x, crop.y, crop.width, crop.height,
          measured(), service.phase, ctx().fixedCropArea, ctx().cropShape,
        ].join("|"),
        () => ({
          id: selectionId,
          role: "slider",
          tabindex: "0",
          "aria-label": `Crop selection area (${ctx().cropShape === "circle" ? "circle" : "rectangle"})`,
          "aria-roledescription": "2d slider",
          "aria-valuemin": "0",
          "aria-valuemax": String(maxX),
          "aria-valuenow": String(crop.x),
          "aria-valuetext": `Position X ${crop.x}px, Y ${crop.y}px. Size ${crop.width}px by ${crop.height}px.`,
          "aria-description":
            "Use arrow keys to move the crop. Hold Alt with arrow keys to resize width or height. Press plus or minus to zoom.",
          "data-disabled": dataAttr(ctx().fixedCropArea),
          "data-shape": ctx().cropShape,
          "data-measured": dataAttr(measured()),
          "data-dragging": dataAttr(service.phase === "dragging"),
          style: { "--crop-x": `${ctx().crop.x}px`,
            "--crop-y": `${ctx().crop.y}px`,
            "--crop-width": `${ctx().crop.width}px`,
            "--crop-height": `${ctx().crop.height}px`,
            left: "var(--crop-x, 0px)",
            top: "var(--crop-y, 0px)",
            width: "var(--crop-width, 0px)",
            height: "var(--crop-height, 0px)" },
          onPointerdown: (event: PointerEvent) => {
            if (ctx().fixedCropArea) {
              event.preventDefault();
              return;
            }
            if (event.pointerType === "mouse" && event.button !== 0) return;
            const viewport = typeof document !== "undefined"
              ? document.getElementById(viewportId)
              : null;
            const point = viewportPoint(viewport, event.clientX, event.clientY);
            if (point === null) return;
            event.stopPropagation();
            (event.currentTarget as (Element & { setPointerCapture?: (id: number) => void }) | null)?.setPointerCapture?.(event.pointerId);
            send({ type: "POINTER_DOWN", point });
          },
          onPointermove: (event: PointerEvent) => {
            if (service.phase !== "dragging") return;
            const viewport = typeof document !== "undefined"
              ? document.getElementById(viewportId)
              : null;
            const point = viewportPoint(viewport, event.clientX, event.clientY);
            if (point === null) return;
            send({ type: "POINTER_MOVE", point });
          },
          onPointerup: () => {
            if (service.phase !== "dragging") return;
            send({ type: "POINTER_UP" });
          },
          onKeydown: onSelectionKeydown,
        }),
      );
    },
    getHandleProps: (slots: HandleSlotProps) => {
      const fixed = ctx().fixedCropArea;
      return keyed(
        handleBags,
        slots,
        [slots.position, fixed].join("|"),
        () => ({
          id: handleId(slots.position),
          role: "presentation",
          "aria-hidden": "true",
          "data-position": slots.position,
          "data-disabled": dataAttr(fixed),
          onPointerdown: (event: PointerEvent) => {
            if (fixed) {
              event.preventDefault();
              return;
            }
            if (event.pointerType === "mouse" && event.button !== 0) return;
            const viewport = typeof document !== "undefined"
              ? document.getElementById(viewportId)
              : null;
            const point = viewportPoint(viewport, event.clientX, event.clientY);
            if (point === null) return;
            event.stopPropagation();
            (event.currentTarget as (Element & { setPointerCapture?: (id: number) => void }) | null)?.setPointerCapture?.(event.pointerId);
            send({ type: "POINTER_DOWN", point, handlePosition: slots.position });
          },
        }),
      );
    },
    getGridProps: (slots: GridSlotProps) =>
      keyed(gridBags, slots, [slots.axis, service.phase].join("|"), () => ({
        "aria-hidden": "true",
        "data-axis": slots.axis,
        "data-dragging": dataAttr(service.phase === "dragging"),
      })),
  };
}

export { HANDLES };
