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
 * listeners, the escape hatch, the release) is all here.
 */

export interface DragParam {
  /** True while the gesture is legal (a maximized panel does not drag). */
  readonly enabled?: boolean;
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
}

export interface DragDelta extends DragPress {
  readonly dx: number;
  readonly dy: number;
}

export const drag: ElementAction<DragParam | undefined> = createAction((node, param) => {
  let originX = 0;
  let originY = 0;
  let stop: (() => void) | undefined;

  const end = (cancelled: boolean): void => {
    stop?.();
    stop = undefined;
    param?.onEnd?.({ cancelled });
  };

  const arm = (event: PointerEvent): void => {
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
    event.preventDefault();
    originX = event.clientX;
    originY = event.clientY;
    const press: DragPress = { altKey: event.altKey, shiftKey: event.shiftKey };
    param?.onStart?.(press);

    const doc = node.ownerDocument;
    const onMove = (moveEvent: PointerEvent): void => {
      moveEvent.preventDefault();
      param?.onMove?.({
        altKey: moveEvent.altKey || press.altKey,
        shiftKey: moveEvent.shiftKey || press.shiftKey,
        dx: moveEvent.clientX - originX,
        dy: moveEvent.clientY - originY,
      });
    };
    const onUp = (): void => end(false);
    const onKey = (keyEvent: KeyboardEvent): void => {
      if (keyEvent.key !== "Escape") return;
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
    destroy: () => {
      end(true);
      node.removeEventListener("pointerdown", arm as EventListener);
    },
  };
});
