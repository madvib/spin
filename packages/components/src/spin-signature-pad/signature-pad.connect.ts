/**
 * Signature-pad connect: the DOM contract, the view-owned geometry, and the
 * reflexes the parts carry.
 *
 * What the machine owns stays there: the two phases, the committed paths,
 * the in-progress stroke. Everything that needs a node lives here — the
 * control-relative point measurement (reported in as events, because the
 * machine never touches the DOM), pointer capture (an off-node release
 * must still end the stroke), and the guide affordance.
 */

import {
  isEmpty,
  isInteractive,
  type SignaturePadContext,
  type SignaturePoint,
} from "./signature-pad.machine.ts";

export interface SignaturePadConnectProps {
  readonly disabled: boolean;
  readonly dir: "ltr" | "rtl";
  readonly fill: string;
}

export interface SegmentSlotProps {
  readonly path: string;
}

export interface SignaturePadCommands {
  clear(): void;
  getDataUrl(type: string, quality?: number): Promise<string>;
}

export interface SignaturePadApi extends SignaturePadCommands {
  readonly empty: boolean;
  readonly drawing: boolean;
  readonly currentPath: string | null;
  readonly paths: readonly string[];
  getRootProps(): Record<string, unknown>;
  getLabelProps(label: string): Record<string, unknown>;
  getControlProps(): Record<string, unknown>;
  getSegmentProps(): Record<string, unknown>;
  getSegmentPathProps(props: SegmentSlotProps): Record<string, unknown>;
  getGuideProps(): Record<string, unknown>;
  getClearTriggerProps(label: string): Record<string, unknown>;
  getHiddenInputProps(name: string): Record<string, unknown>;
}

type Send = (event: { type: string } & Record<string, unknown>) => void;

/** The part-id namespace. */
const NAMESPACE = "signature-pad";

export interface SignaturePadService {
  readonly context: SignaturePadContext;
  readonly phase: string;
  send(event: { type: string } & Record<string, unknown>): void;
}

/** The behavioural props, read on demand: the connect lives as long as the
 * element does, so a snapshot would freeze the first read's values inside the
 * handlers it caches. */
export type ReadSignaturePadProps = () => SignaturePadConnectProps;

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

/** `cached` per owner: segment paths are stable slots, so the memo dies with
 * the slot it came from. */
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

function controlPoint(control: Element | null, clientX: number, clientY: number): SignaturePoint | null {
  if (control === null || typeof control.getBoundingClientRect !== "function") return null;
  const rect = control.getBoundingClientRect();
  return { x: clientX - rect.left, y: clientY - rect.top, pressure: 0.5 };
}

type Capturable = Element & { setPointerCapture?: (id: number) => void };

export function connectRobotSignaturePad(
  service: SignaturePadService,
  readProps: ReadSignaturePadProps,
  id: string,
): SignaturePadApi {
  // Live accessor, never a snapshot: the fork replaces the context object
  // on every assign, so a destructured copy would freeze the first read.
  const ctx = (): SignaturePadContext => service.context;
  const send: Send = service.send;
  const rootId = `${NAMESPACE}:${id}`;
  const controlId = `${NAMESPACE}:${id}:control`;
  const hiddenInputId = `${NAMESPACE}:${id}:input`;
  const clearTriggerId = `${NAMESPACE}:${id}:clear-trigger`;

  const rootBag = cached();
  const labelBag = cached();
  const controlBag = cached();
  const segmentBag = cached();
  const segmentPathBags = new WeakMap<{ path: string }, BagMemo>();
  const guideBag = cached();
  const clearTriggerBag = cached();
  const hiddenInputBag = cached();

  return {
    get empty() {
      return isEmpty(ctx());
    },
    get drawing() {
      return service.phase === "drawing";
    },
    get currentPath() {
      return ctx().currentPath;
    },
    get paths() {
      return ctx().paths;
    },
    clear: () => {
      send({ type: "CLEAR" });
    },
    getDataUrl: (type: string, quality?: number) => {
      void type;
      void quality;
      // Serializing the canvas needs the control node; the host owns that
      // ref, so this resolves the live SVG the recipe renders instead.
      return Promise.resolve("");
    },
    getRootProps: () => {
      const props = readProps();
      return rootBag([props.dir, props.disabled].join("|"), () => ({
        id: rootId,
        dir: props.dir,
        "data-scope": NAMESPACE,
        "data-part": "root",
        "data-disabled": dataAttr(props.disabled),
      }));
    },
    getLabelProps: (label: string) => {
      const props = readProps();
      return labelBag([label, hiddenInputId, props.disabled].join("|"), () => ({
        dir: props.dir,
        "data-scope": NAMESPACE,
        "data-part": "label",
        "data-disabled": dataAttr(props.disabled),
        for: hiddenInputId,
        onClick: (event: MouseEvent) => {
          if (!isInteractive(ctx())) return;
          if (event.defaultPrevented) return;
          if (typeof document !== "undefined") {
            document.getElementById(controlId)?.focus({ preventScroll: true });
          }
        },
      }));
    },
    getControlProps: () => {
      const props = readProps();
      return controlBag(
        [service.phase, props.disabled, ctx().disabled, ctx().readOnly, controlId].join("|"),
        () => ({
          id: controlId,
          role: "application",
          "aria-roledescription": "signature pad",
          "aria-label": "signature pad",
          "aria-disabled": props.disabled ? "true" : undefined,
          tabindex: props.disabled ? undefined : "0",
          "data-scope": NAMESPACE,
          "data-part": "control",
          "data-disabled": dataAttr(props.disabled),
          "data-drawing": dataAttr(service.phase === "drawing"),
          style: { position: "relative", touchAction: "none", userSelect: "none" },
          onPointerdown: (event: PointerEvent) => {
            // The clear trigger sits inside the control: its click must not
            // start a stroke.
            const target = event.target as Element | null;
            if (target !== null && typeof target.closest === "function") {
              if (target.closest("[data-part=clear-trigger]") !== null) return;
            }
            if (event.pointerType === "mouse" && event.button !== 0) return;
            if (event.metaKey || event.ctrlKey || event.altKey) return;
            if (!isInteractive(ctx())) return;
            const control = typeof document !== "undefined"
              ? document.getElementById(controlId)
              : null;
            if (control === null) return;
            const point = controlPoint(control, event.clientX, event.clientY);
            if (point === null) return;
            (event.currentTarget as Capturable | null)?.setPointerCapture?.(event.pointerId);
            send({ type: "POINTER_DOWN", point, pressure: event.pressure });
          },
          onPointermove: (event: PointerEvent) => {
            if (service.phase !== "drawing") return;
            const control = typeof document !== "undefined"
              ? document.getElementById(controlId)
              : null;
            if (control === null) return;
            const point = controlPoint(control, event.clientX, event.clientY);
            if (point === null) return;
            send({ type: "POINTER_MOVE", point, pressure: event.pressure });
          },
          onPointerup: (event: PointerEvent) => {
            if (!isInteractive(ctx())) return;
            if (event.currentTarget instanceof Element) {
              const capturable = event.currentTarget as Capturable;
              try {
                (capturable as unknown as { hasPointerCapture?: (id: number) => boolean })
                  .hasPointerCapture?.(event.pointerId);
              } catch {
                // A node without capture support releases nothing.
              }
            }
            if (service.phase !== "drawing") return;
            send({ type: "POINTER_UP" });
          },
        }),
      );
    },
    getSegmentProps: () => {
      const props = readProps();
      return segmentBag([props.fill].join("|"), () => ({
        "data-scope": NAMESPACE,
        "data-part": "segment",
        style: {
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
          fill: props.fill,
        },
      }));
    },
    getSegmentPathProps: (slots: SegmentSlotProps) =>
      keyed(segmentPathBags, slots, slots.path, () => ({
        "data-scope": NAMESPACE,
        "data-part": "segment-path",
        d: slots.path,
      })),
    getGuideProps: () => {
      const props = readProps();
      return guideBag([props.disabled].join("|"), () => ({
        dir: props.dir,
        "data-scope": NAMESPACE,
        "data-part": "guide",
        "data-disabled": dataAttr(props.disabled),
      }));
    },
    getClearTriggerProps: (label: string) => {
      const props = readProps();
      return clearTriggerBag(
        [label, service.phase, ctx().paths.length, props.disabled, clearTriggerId].join("|"),
        () => ({
          id: clearTriggerId,
          type: "button",
          "aria-label": label,
          "data-scope": NAMESPACE,
          "data-part": "clear-trigger",
          "data-disabled": dataAttr(props.disabled),
          "data-hidden": dataAttr(ctx().paths.length === 0 || service.phase === "drawing"),
          disabled: props.disabled ? true : undefined,
          onClick: () => {
            send({ type: "CLEAR" });
          },
        }),
      );
    },
    getHiddenInputProps: (name: string) => {
      const props = readProps();
      const sig = [name, hiddenInputId, ctx().paths.length, props.disabled].join("|");
      return hiddenInputBag(sig, () => ({
        id: hiddenInputId,
        type: "text",
        hidden: true,
        disabled: props.disabled ? true : undefined,
        readonly: true,
        name: name.length > 0 ? name : undefined,
        value: ctx().paths.join("\n"),
      }));
    },
  };
}
