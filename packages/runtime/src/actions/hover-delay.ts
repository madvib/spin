import { createAction } from "./action.ts";
import type { ElementAction } from "./action.ts";

/**
 * The two dwell clocks a hover surface needs: open after resting on the
 * trigger, close after leaving the surface.
 *
 * One action, not two, because the clocks share one invariant: leaving
 * cancels a pending open, and re-entering cancels a pending close. Two
 * timers with separate owners would race that handoff through the host.
 * The timer is the action's, so a platform-owned surface (tooltip,
 * hover-card) has no transitional state to hold — the attach maps the
 * two reports onto `showPopover`/`hidePopover` directly.
 *
 * Touch never opens: a tooltip that opens on tap steals the tap the
 * trigger itself wanted.
 */

export interface HoverDelayParam {
  /** Rest on the trigger before `onOpen` fires, in milliseconds. */
  readonly openDelay?: number;
  /** Off the surface before `onClose` fires, in milliseconds. */
  readonly closeDelay?: number;
  /** The pointer rested long enough; the surface opens. */
  readonly onOpen?: () => void;
  /** The pointer stayed away long enough; the surface closes. */
  readonly onClose?: () => void;
}

/** Listen with automatic removal on destroy. Shared with the index's own actions. */
function listen(node: Element, type: string, handler: (event: PointerEvent) => void): () => void {
  const listener = (event: Event): void => handler(event as PointerEvent);
  node.addEventListener(type, listener);
  return () => node.removeEventListener(type, listener);
}

export const hoverDelay: ElementAction<HoverDelayParam | undefined> = createAction((node, param) => {
  let openTimer: ReturnType<typeof setTimeout> | undefined;
  let closeTimer: ReturnType<typeof setTimeout> | undefined;

  const clearOpen = (): void => {
    clearTimeout(openTimer);
    openTimer = undefined;
  };
  const clearClose = (): void => {
    clearTimeout(closeTimer);
    closeTimer = undefined;
  };

  const enter = (event: PointerEvent): void => {
    if (event.pointerType === "touch") return;
    // Back over the surface: a pending close is void, and a surface the
    // host already opened stays opened without re-firing.
    clearClose();
    if (openTimer !== undefined || param?.onOpen === undefined) return;
    const delay = param?.openDelay ?? 400;
    if (delay <= 0) {
      param?.onOpen?.();
      return;
    }
    openTimer = setTimeout(() => {
      openTimer = undefined;
      param?.onOpen?.();
    }, delay);
  };

  const leave = (): void => {
    clearOpen();
    if (closeTimer !== undefined || param?.onClose === undefined) return;
    const delay = param?.closeDelay ?? 150;
    if (delay <= 0) {
      param?.onClose?.();
      return;
    }
    closeTimer = setTimeout(() => {
      closeTimer = undefined;
      param?.onClose?.();
    }, delay);
  };

  const stops = [
    listen(node, "pointerenter", enter),
    listen(node, "pointerleave", leave),
  ];
  return {
    update: (next) => {
      param = next;
    },
    destroy: () => {
      clearOpen();
      clearClose();
      for (const stop of stops) stop();
    },
  };
});
