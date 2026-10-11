// Leaf import, not "@spin/runtime": the actions table imports this module,
// so a package import would cycle back through the table's own module.
import { createAction, type ElementAction } from "../../../../runtime/src/actions/action.ts";

/**
 * interact-outside — report focus and pointer movement outside the node.
 *
 * The port of Zag's `trackInteractOutside`, which the editable uses to
 * submit (or cancel) a field the user walks away from. Zag fires a
 * cancelable custom event on the node and lets `onInteractOutside` veto by
 * calling `preventDefault`; this action hands the same event object to the
 * same three callbacks, with the same veto.
 *
 * Two faithful details worth keeping:
 *
 * - The document listeners arm on the next frame. The press that OPENED the
 *   surface is a pointerdown outside it, and arming immediately would make
 *   that press close what it opened.
 * - A focusin is ignored while a pointerdown is in flight: the pointerdown
 *   has already reported, and the click's own focus move would report the
 *   same interaction twice.
 *
 * The excluded set is a thunk so the caller resolves the parts it owns at
 * event time; the node's own `aria-controls` targets count as inside, which
 * is Zag's `isControlledElement`.
 */

export interface InteractOutsideDetail {
  readonly originalEvent: Event;
  readonly contextmenu: boolean;
  readonly focusable: boolean;
  readonly target: EventTarget | null;
}

export interface InteractOutsideEvent {
  readonly type: "pointerdown" | "focus";
  readonly detail: InteractOutsideDetail;
  defaultPrevented: boolean;
  preventDefault(): void;
}

export interface InteractOutsideParam {
  onPointerDownOutside?: (event: InteractOutsideEvent) => void;
  onFocusOutside?: (event: InteractOutsideEvent) => void;
  onInteractOutside?: (event: InteractOutsideEvent) => void;
  /** Elements the report ignores — the caller's own controls. */
  exclude?: () => readonly (Element | null)[];
}

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),details,[tabindex]:not([tabindex="-1"])';

const makeEvent = (
  type: "pointerdown" | "focus",
  originalEvent: Event,
  target: EventTarget | null,
): InteractOutsideEvent => {
  const contextmenu = originalEvent.type === "contextmenu" || (originalEvent as MouseEvent).button === 2;
  const event = {
    type,
    detail: {
      originalEvent,
      contextmenu,
      focusable: target instanceof Element && target.matches(FOCUSABLE),
      target,
    },
    defaultPrevented: false,
  } as InteractOutsideEvent;
  event.preventDefault = (): void => {
    event.defaultPrevented = true;
  };
  return event;
};

export const interactOutside: ElementAction<InteractOutsideParam | undefined> = createAction(
  (node, param) => {
    const excluded = (target: EventTarget | null): boolean => {
      if (!(target instanceof Element)) return false;
      if (target.getAttribute("aria-controls") === node.id) return true;
      const list = param?.exclude?.() ?? [];
      return list.some((el) => el !== null && (el === target || el.contains(target)));
    };

    const isOutside = (target: EventTarget | null): boolean => {
      if (!(target instanceof Element)) return false;
      if (!target.isConnected) return false;
      if (node.contains(target)) return false;
      return !excluded(target);
    };

    const report = (type: "pointerdown" | "focus", originalEvent: Event, target: EventTarget | null): void => {
      const event = makeEvent(type, originalEvent, target);
      if (type === "pointerdown") param?.onPointerDownOutside?.(event);
      else param?.onFocusOutside?.(event);
      param?.onInteractOutside?.(event);
    };

    let pointerInFlight = false;

    const onPointerDown = (event: Event): void => {
      pointerInFlight = true;
      const release = (): void => {
        pointerInFlight = false;
      };
      document.addEventListener("pointerup", release, { once: true });
      if (isOutside(event.target)) report("pointerdown", event, event.target);
    };

    const onFocusIn = (event: Event): void => {
      if (pointerInFlight) return;
      if (isOutside(event.target)) report("focus", event, event.target);
    };

    const stops: (() => void)[] = [];
    const arm = (): void => {
      document.addEventListener("pointerdown", onPointerDown, true);
      document.addEventListener("focusin", onFocusIn, true);
      stops.push(() => document.removeEventListener("pointerdown", onPointerDown, true));
      stops.push(() => document.removeEventListener("focusin", onFocusIn, true));
    };

    const frame =
      typeof requestAnimationFrame === "function"
        ? requestAnimationFrame(() => arm())
        : null;
    if (frame === null) arm();

    return {
      // The params are read live through this assignment: the callbacks are
      // stable functions the caller closed over its own live reads with.
      update: (next) => {
        param = next;
      },
      destroy: () => {
        if (frame !== null) cancelAnimationFrame(frame);
        for (const stop of stops) stop();
      },
    };
  },
);
