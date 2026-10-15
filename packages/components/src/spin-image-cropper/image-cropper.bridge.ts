import { computed, effect, machineTick, scope, signal, untrack } from "@spin/runtime";
import { createMachine, interpret, type Service } from "@spin/runtime/fsm";
import {
  config,
  implementations,
  isGesturing,
  roundedCrop,
  type CropHandle,
  type CropPoint,
  type CropRect,
  type CropSize,
  type ImageCropperContext,
  type ImageCropperEvent,
} from "./image-cropper.machine.ts";
import {
  connectRobotImageCropper,
  type ImageCropperApi,
  type ImageCropperConnectProps,
  type ImageCropperService,
  type ReadImageCropperProps,
} from "./image-cropper.connect.ts";

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

export interface ImageCropperCallbacks {
  readonly onCropChange: ((details: ImageCropperCropChange) => void) | undefined;
  readonly onZoomChange: ((details: ImageCropperZoomChange) => void) | undefined;
  readonly onRotationChange: ((details: ImageCropperRotationChange) => void) | undefined;
  readonly onFlipChange: ((details: ImageCropperFlipChange) => void) | undefined;
}

const numProp = (raw: unknown): number | null =>
  typeof raw === "number" && Number.isFinite(raw) ? raw : null;

const textProp = (raw: unknown): string => (typeof raw === "string" ? raw : "");

const sameRect = (a: CropRect, b: CropRect): boolean =>
  a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;

/**
 * The image-cropper bridge: scope values in, machine state out.
 *
 * Four jobs. Seed zoom/rotation/flip from `default*`; alternate the three
 * authored channels (`zoom`, `rotation`, `flip`); report what moved; and
 * publish the connect api through the live-view proxy. The crop itself is
 * machine-owned — the host reads it through `onCropChange` and
 * `getCropData`, never writes it.
 *
 * The controlled channel is the authored-prop predicate (`@@authored`) — a
 * coerced default is never a write. Each channel remembers what it last
 * imposed rather than comparing against the context, so a machine move of
 * its own is never undone by an unrelated prop change.
 */
export function createImageCropperBridge(
  props: () => Record<string, unknown>,
  _root: () => Element,
  id: string,
): { readonly api: ImageCropperApi; dispose(): void } {
  const owner = scope();
  const tick = signal(0);
  // The fork's `config.context` is ONE object, and its interpreter starts on
  // it without copying: every cropper on the page would otherwise share a
  // single selection.
  const machine = createMachine<ImageCropperContext, ImageCropperEvent>(
    { ...config, context: { ...config.context, crop: { ...config.context.crop } } },
    implementations,
  );

  let service: Service<ImageCropperContext, ImageCropperEvent> | undefined;

  const authored = (name: string): boolean => {
    const predicate = props()["@@authored"];
    return typeof predicate === "function" ? (predicate as (n: string) => boolean)(name) : false;
  };

  const readCallbacks = (): ImageCropperCallbacks => {
    const p = props();
    const pick = <T>(name: string): T | undefined => {
      const value = p[name];
      return typeof value === "function" ? (value as T) : undefined;
    };
    return {
      onCropChange: pick<(d: ImageCropperCropChange) => void>("onCropChange"),
      onZoomChange: pick<(d: ImageCropperZoomChange) => void>("onZoomChange"),
      onRotationChange: pick<(d: ImageCropperRotationChange) => void>("onRotationChange"),
      onFlipChange: pick<(d: ImageCropperFlipChange) => void>("onFlipChange"),
    };
  };

  const readContextProps = (): Pick<
    ImageCropperContext,
    "cropShape" | "aspectRatio" | "minWidth" | "minHeight" | "maxWidth" | "maxHeight" | "fixedCropArea"
  > => {
    const p = props();
    const shape = p["cropShape"];
    return {
      cropShape: shape === "circle" ? "circle" : "rect",
      aspectRatio: numProp(p["aspectRatio"]),
      minWidth: numProp(p["minWidth"]),
      minHeight: numProp(p["minHeight"]),
      maxWidth: numProp(p["maxWidth"]),
      maxHeight: numProp(p["maxHeight"]),
      fixedCropArea: p["fixedCropArea"] === true,
    };
  };

  const readConnectProps: ReadImageCropperProps = (): ImageCropperConnectProps => {
    const p = props();
    return {
      disabled: p["disabled"] === true,
      src: textProp(p["src"]),
      alt: textProp(p["alt"]),
      dir: p["dir"] === "rtl" ? "rtl" : "ltr",
      zoomStep: numProp(p["zoomStep"]) ?? 0.1,
    };
  };

  const parseFlip = (raw: unknown): { horizontal: boolean; vertical: boolean } | null => {
    if (typeof raw !== "object" || raw === null) return null;
    const r = raw as Record<string, unknown>;
    if (typeof r["horizontal"] !== "boolean" && typeof r["vertical"] !== "boolean") return null;
    return {
      horizontal: r["horizontal"] === true,
      vertical: r["vertical"] === true,
    };
  };

  const ensureService = (): Service<ImageCropperContext, ImageCropperEvent> => {
    if (service) return service;
    const p = props();
    const scalars = readContextProps();
    const zoom = numProp(authored("zoom") ? p["zoom"] : p["defaultZoom"]) ?? 1;
    const rotation = numProp(authored("rotation") ? p["rotation"] : p["defaultRotation"]) ?? 0;
    const flip = parseFlip(authored("flip") ? p["flip"] : p["defaultFlip"]) ?? {
      horizontal: false,
      vertical: false,
    };
    service = owner.run(() => {
      const svc = interpret(machine).start("idle");
      Object.assign(svc.state.context, scalars, { zoom, rotation, ...flipToContext(flip) });
      return svc;
    });
    return service;
  };

  const flipToContext = (flip: { horizontal: boolean; vertical: boolean }): Pick<ImageCropperContext, "flipHorizontal" | "flipVertical"> => ({
    flipHorizontal: flip.horizontal,
    flipVertical: flip.vertical,
  });

  /** What each controlled channel last imposed, seeded from the same place
   * the machine was, so a host that authors the seeded value writes nothing. */
  const initial = ensureService().state.context;
  let lastCrop = { ...initial.crop };
  let lastZoom = initial.zoom;
  let lastRotation = initial.rotation;
  let lastFlip = { horizontal: initial.flipHorizontal, vertical: initial.flipVertical };

  let cropperConnect: ImageCropperApi | undefined;
  const ensureConnect = (): ImageCropperApi => {
    cropperConnect ??= connectRobotImageCropper(serviceApi, readConnectProps, id);
    return cropperConnect;
  };

  /**
   * Report what moved. The cursors advance only after the callbacks: the
   * fork's send is synchronous, so a post-send check would already see the
   * new value.
   */
  const notify = (): void => {
    const after = ensureService().state.context;
    const callbacks = readCallbacks();
    if (!sameRect(lastCrop, after.crop)) {
      lastCrop = { ...after.crop };
      callbacks.onCropChange?.({ crop: { ...after.crop } });
    }
    if (lastZoom !== after.zoom) {
      lastZoom = after.zoom;
      callbacks.onZoomChange?.({ zoom: after.zoom });
    }
    if (lastRotation !== after.rotation) {
      lastRotation = after.rotation;
      callbacks.onRotationChange?.({ rotation: after.rotation });
    }
    if (lastFlip.horizontal !== after.flipHorizontal || lastFlip.vertical !== after.flipVertical) {
      lastFlip = { horizontal: after.flipHorizontal, vertical: after.flipVertical };
      callbacks.onFlipChange?.({ ...lastFlip });
    }
  };

  const send = (event: ImageCropperEvent): void => {
    const svc = ensureService();
    // The scalars are re-read on every send so an assign or a cond never
    // reads a stale one.
    Object.assign(svc.state.context, readContextProps());
    svc.send(event);
    notify();
    tick(tick() + 1);
    machineTick(machineTick() + 1);
  };

  /** The service surface the connect reads. Built once: the connect lives as
   * long as the bridge does, so this is the stable accessor it caches
   * against. */
  const serviceApi: ImageCropperService = {
    send: send as (event: { type: string } & Record<string, unknown>) => void,
    get context() {
      return ensureService().state.context;
    },
    get phase() {
      return ensureService().state.value;
    },
  };

  /**
   * Controlled alternation plus the scalar sync, in one owned effect: it
   * reads the live prop signals, so a host write — property or attribute —
   * moves the machine without waiting for a machine event.
   *
   * It writes no tick of its own: `svc.send` bumps the machine tick, which is
   * what wakes the bindings, and a tick read here would re-run the effect on
   * every later move and re-impose the authored props over it.
   */
  owner.run(() =>
    effect(() => {
      const svc = ensureService();
      let moved = false;
      const next = readContextProps();
      if (svc.state.context.cropShape !== next.cropShape) {
        svc.state.context.cropShape = next.cropShape;
        moved = true;
      }
      if (svc.state.context.aspectRatio !== next.aspectRatio) {
        svc.state.context.aspectRatio = next.aspectRatio;
        moved = true;
      }
      if (svc.state.context.fixedCropArea !== next.fixedCropArea) {
        svc.state.context.fixedCropArea = next.fixedCropArea;
        moved = true;
      }
      if (authored("zoom")) {
        const outer = numProp(props()["zoom"]);
        if (outer !== null && lastZoom !== outer) {
          untrack(() => svc.send({ type: "SET_ZOOM", zoom: outer }));
          moved = true;
        }
      }
      if (authored("rotation")) {
        const outer = numProp(props()["rotation"]);
        if (outer !== null && lastRotation !== outer) {
          untrack(() => svc.send({ type: "SET_ROTATION", rotation: outer }));
          moved = true;
        }
      }
      if (authored("flip")) {
        const outer = parseFlip(props()["flip"]);
        if (
          outer !== null &&
          (lastFlip.horizontal !== outer.horizontal || lastFlip.vertical !== outer.vertical)
        ) {
          untrack(() => svc.send({ type: "SET_FLIP", ...outer }));
          moved = true;
        }
      }
      if (moved) notify();
    }),
  );

  void isGesturing;
  void roundedCrop;
  void (null as unknown as CropHandle | null);
  void (null as unknown as CropPoint | null);
  void (null as unknown as CropSize | null);

  /** The api is read on every machine move, so this depends on the tick and
   * hands out the same connect each time. */
  const connected = computed(() => {
    tick();
    return ensureConnect();
  });

  const api = new Proxy({} as ImageCropperApi, {
    get: (_target, key) => Reflect.get(connected(), key),
    has: (_target, key) => Reflect.has(connected(), key),
    ownKeys: () => Reflect.ownKeys(connected()),
    getOwnPropertyDescriptor: (_target, key) => {
      const descriptor = Reflect.getOwnPropertyDescriptor(connected(), key);
      return descriptor && { ...descriptor, configurable: true };
    },
  });

  return {
    api,
    dispose: () => {
      service?.stop();
      owner.dispose();
    },
  };
}
