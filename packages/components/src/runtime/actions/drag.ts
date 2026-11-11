import { createAction } from "./action.ts";
import type { ElementAction } from "./action.ts";

/**
 * A pointer drag on a handle: pointerdown arms, pointermove reports the
 * delta from the press point, pointerup ends, and Escape cancels back to
 * the press point.
 *
 * The listeners live on the document once armed — the node is the handle,
 * so the reports keep arriving even after the pointer leaves it. The
 * machine sees three facts — START, MOVE (with the delta and the pressed
 * modifiers), END — and decides what they mean; the gesture itself (the
 * listeners, the escape hatch, the capture, the release) is all here.
 *
 * The pointer is CAPTURED on the handle for the gesture's life, so a
 * release off the handle still ends the drag: the components that used to
 * carry their own `setPointerCapture` helper now own the gesture through
 * this action alone.
 */

export interface DragParam {
  /** True while the gesture is legal (a maximized panel does not drag). */
  readonly enabled?: boolean;
  /** Capture the pointer on the handle for the gesture's life (default: true). */
  readonly capture?: boolean;
  /** Cancel the press's default (default: true). */
  readonly preventDefault?: boolean;
  /** Keep the press from reaching the handle's ancestors (default: false). */
  readonly stopPropagation?: boolean;
  /** Escape cancels the gesture (default: true). A handle whose gesture
   * has no cancel path sets it false: Escape then does nothing. */
  readonly cancelOnEscape?: boolean;
  /** The press came down on the handle. */
  readonly onStart?: (event: DragPress) => void;
  /** The pointer moved; the delta is from the press point. */
  readonly onMove?: (delta: DragDelta) => void;
  /** The pointer came up or Escape arrived; `cancelled` reads which. */
  readonly onEnd?: (end: { readonly cancelled: boolean }) => void;
}

export interface DragPress {
  readonly altKey: boolean;
  readonly shiftKey: boolean;
  /** The control key, when the press carried one. */
  readonly ctrlKey?: boolean;
  /** The meta key, when the press carried one. */
  readonly metaKey?: boolean;
  /** The press point, in client coordinates. */
  readonly x: number;
  /** The press point, in client coordinates. */
  readonly y: number;
  /** The pointer that owns the gesture. */
  readonly pointerId: number;
  /** The press's pressure: 0.5 for a mouse, the pen's force for a pen. */
  readonly pressure: number;
  /** What the press landed on: the handle, or something inside it. */
  readonly target: EventTarget | null;
  /** The handle's box, read where the gesture is reported. */
  readonly rect: DOMRect | null;
  /** The handle's direction at press time: mirroring math reads this,
   * not a prop. */
  readonly direction: "ltr" | "rtl";
}

export interface DragDelta extends DragPress {
  readonly dx: number;
  readonly dy: number;
}

/** The handle may capture the pointer — not every element can. */
type Capturable = Element & {
  setPointerCapture?: (pointerId: number) => void;
  releasePointerCapture?: (pointerId: number) => void;
};

/** The handle's direction, read where the gesture is reported: direction
 * is platform truth (inherited, settable above the component), so it is
 * read at gesture time, never stored, never passed as a prop. */
const directionOf = (node: Element): "ltr" | "rtl" => {
  try {
    return node.ownerDocument?.defaultView?.getComputedStyle(node).direction === "rtl"
      ? "rtl"
      : "ltr";
  } catch {
    return "ltr";
  }
};

/** The handle's box, read where the gesture is reported: a handle that
 * measures itself is the action's job, not the caller's. */
const boxOf = (node: Element): DOMRect | null => {
  if (typeof node.getBoundingClientRect !== "function") return null;
  try {
    return node.getBoundingClientRect();
  } catch {
    return null;
  }
};

export const drag: ElementAction<DragParam | undefined> = createAction((node, param) => {
  let originX = 0;
  let originY = 0;
  let pointerId = -1;
  let captured = false;
  let stop: (() => void) | undefined;

  const end = (cancelled: boolean): void => {
    stop?.();
    stop = undefined;
    if (captured) {
      captured = false;
      const release = (node as Capturable).releasePointerCapture;
      if (typeof release === "function") {
        try {
          release.call(node, pointerId);
        } catch {
          // The pointer is already gone: nothing to release.
        }
      }
    }
    param?.onEnd?.({ cancelled });
  };

  const arm = (event: PointerEvent): void => {
    // A gesture is already in flight: a second pointer does not restart it
    // (that would strand the first gesture's listeners).
    if (stop !== undefined) return;
    if (param?.enabled === false) return;
    if (event.button !== 0) return;
    // A handle that wraps controls (a header with its own buttons) must
    // not swallow their clicks: arming preventDefaults the pointerdown,
    // which suppresses the compatibility click.
    const target = event.target;
    if (
      target instanceof Element && target !== node &&
      target.closest("button, a, input, select, textarea") !== null
    ) return;
    if (param?.preventDefault !== false) event.preventDefault();
    if (param?.stopPropagation === true) event.stopPropagation();
    originX = event.clientX;
    originY = event.clientY;
    pointerId = event.pointerId;
    const press: DragPress = {
      altKey: event.altKey,
      shiftKey: event.shiftKey,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
      x: event.clientX,
      y: event.clientY,
      pointerId: event.pointerId,
      pressure: event.pressure,
      target,
      rect: boxOf(node),
      direction: directionOf(node),
    };
    if (param?.capture !== false) {
      const capture = (node as Capturable).setPointerCapture;
      if (typeof capture === "function") {
        try {
          capture.call(node, event.pointerId);
          captured = true;
        } catch {
          // The pointer is not capturable here: the document listeners
          // still carry the gesture.
        }
      }
    }
    param?.onStart?.(press);

    const doc = node.ownerDocument;
    const onMove = (moveEvent: PointerEvent): void => {
      if (param?.preventDefault !== false) moveEvent.preventDefault();
      param?.onMove?.({
        altKey: moveEvent.altKey || press.altKey,
        shiftKey: moveEvent.shiftKey || press.shiftKey,
        x: moveEvent.clientX,
        y: moveEvent.clientY,
        pointerId: moveEvent.pointerId,
        pressure: moveEvent.pressure,
        target: moveEvent.target,
        rect: boxOf(node),
        direction: directionOf(node),
        dx: moveEvent.clientX - originX,
        dy: moveEvent.clientY - originY,
      });
    };
    const onUp = (): void => end(false);
    const onKey = (keyEvent: KeyboardEvent): void => {
      if (keyEvent.key !== "Escape") return;
      if (param?.cancelOnEscape === false) return;
      end(true);
    };
    doc.addEventListener("pointermove", onMove as EventListener);
    doc.addEventListener("pointerup", onUp as EventListener);
    doc.addEventListener("keydown", onKey as EventListener);
    stop = (): void => {
      doc.removeEventListener("pointermove", onMove as EventListener);
      doc.removeEventListener("pointerup", onUp as EventListener);
      doc.removeEventListener("keydown", onKey as EventListener);
    };
  };

  node.addEventListener("pointerdown", arm as EventListener);

  return {
    update: (next) => {
      // The param is live: a handle that becomes disabled mid-gesture
      // stops arming the next press.
      param = next;
    },
    destroy: () => {
      end(true);
      node.removeEventListener("pointerdown", arm as EventListener);
    },
  };
});
