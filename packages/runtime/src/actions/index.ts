/**
 * The actions Sail ships with the component library: one behavior per
 * action, like uno utilities for behavior.
 *
 * Deliberately NOT here: anything that is a component rather than a
 * behavior. A resizable pane is a component, not an action — but the
 * REFLEXES inside one (listen for pointerdown on a handle, report deltas)
 * are these.
 *
 * Shared house rules, enforced per action:
 * - Mutate only the node: attributes, focus, scroll, class.
 * - Write no styles. Visual state goes out as attributes; utilities paint.
 * - Cross no element boundary. `send` (via param) is the only outward path.
 * - Everything acquired is released in `destroy`.
 */

import { createAction } from "./action.ts";
import type { ElementAction } from "./action.ts";

export { runAction, createAction } from "./action.ts";
export type { ElementAction } from "./action.ts";

/** Listen with automatic removal on destroy. */
function listen(
  target: EventTarget,
  type: string,
  handler: (e: Event) => void,
  capture = false,
): () => void {
  target.addEventListener(type, handler, { capture });
  return () => target.removeEventListener(type, handler, { capture });
}

// ---------------------------------------------------------------------------
// focusTrap — cycle Tab within the node; Escape emits `onEscape`.
// ---------------------------------------------------------------------------

export interface FocusTrapParam {
  onEscape?: () => void;
  /** Re-focus the last outside element on destroy (default: true). */
  restore?: boolean;
}

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export const focusTrap: ElementAction<FocusTrapParam | undefined> = createAction((node, param) => {
  const restore = param?.restore !== false;
  const outside = document.activeElement;
  let stops: Array<() => void> = [];

  const cycle = (event: KeyboardEvent): void => {
    if (event.key !== "Tab") return;
    const items = [...node.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null);
    if (items.length === 0) return;
    const first = items[0]!;
    const last = items[items.length - 1]!;
    const active = document.activeElement;
    if (event.shiftKey && (active === first || !node.contains(active))) {
      last.focus();
      event.preventDefault();
    } else if (!event.shiftKey && active === last) {
      first.focus();
      event.preventDefault();
    }
  };

  const escape = (event: KeyboardEvent): void => {
    if (event.key !== "Escape") return;
    param?.onEscape?.();
  };

  const autoFocusItem = node.querySelector<HTMLElement>("[data-autofocus], " + FOCUSABLE);
  autoFocusItem?.focus();

  stops = [
    listen(node, "keydown", cycle as (e: Event) => void),
    listen(document, "keydown", escape as (e: Event) => void),
  ];

  return {
    update: (next) => {
      // Param changes only re-bind the escape callback; focus behavior is
      // structural. Re-attach with the fresh param.
      for (const stop of stops) stop();
      param = next;
      stops = [listen(node, "keydown", cycle as (e: Event) => void), listen(document, "keydown", escape as (e: Event) => void)];
    },
    destroy: () => {
      for (const stop of stops) stop();
      if (restore && outside instanceof HTMLElement) outside.focus();
    },
  };
});

// ---------------------------------------------------------------------------
// dismissable — emit onEscape + outside pointerdown, through `onOutside`.
// ---------------------------------------------------------------------------

export interface DismissableParam {
  onOutside?: (event: PointerEvent) => void;
  onEscape?: () => void;
  /** Defer the outside listener a frame so the opening press doesn't dismiss. */
  armedByFrame?: boolean;
}

export const dismissable: ElementAction<DismissableParam | undefined> = createAction((node, param) => {
  const outside = (event: Event): void => {
    const target = event.target as Node | null;
    if (target && node.contains(target)) return;
    param?.onOutside?.(event as PointerEvent);
  };
  const escape = (event: Event): void => {
    if ((event as KeyboardEvent).key === "Escape") param?.onEscape?.();
  };
  // The arming frame is the point: the press that OPENED the surface must
  // not be the press that dismisses it.
  let cancelArm: () => void = () => {};
  let stopDoc: (() => void) | undefined;
  if (param?.armedByFrame === false) {
    stopDoc = listen(document, "pointerdown", outside, true);
  } else {
    const raf = requestAnimationFrame(() => {
      stopDoc = listen(document, "pointerdown", outside, true);
    });
    cancelArm = () => cancelAnimationFrame(raf);
  }
  const stopKey = listen(document, "keydown", escape as (e: Event) => void);

  return {
    destroy: () => {
      cancelArm();
      stopDoc?.();
      stopKey();
    },
  };
});

// ---------------------------------------------------------------------------
// autoplay — interval while `enabled`, reporting each tick.
// ---------------------------------------------------------------------------

export interface AutoplayParam {
  /** Ticks are how the machine advances; the action owns only the clock. */
  onTick?: () => void;
  interval?: number;
  enabled?: boolean;
}

export const autoplay: ElementAction<AutoplayParam | undefined> = createAction((_node, param) => {
  let timer: ReturnType<typeof setInterval> | undefined;
  const clear = (): void => {
    if (timer !== undefined) clearInterval(timer as unknown as number);
    timer = undefined;
  };
  const start = (interval: number): void => {
    clear();
    if (interval > 0) timer = setInterval(() => param?.onTick?.(), interval);
  };
  if (param?.enabled !== false) start(param?.interval ?? 3000);
  return {
    update: (next) => {
      if (next?.enabled === false) clear();
      else start(next?.interval ?? 3000);
    },
    destroy: clear,
  };
});

// ---------------------------------------------------------------------------
// dragScroll — pointer drag scrolls the node's overflow (carousel motion by
// native scroll, zero transform writes).
// ---------------------------------------------------------------------------

export interface DragScrollParam {
  onDragStart?: () => void;
  onDragEnd?: (velocity: number) => void;
}

export const dragScroll: ElementAction<DragScrollParam | undefined> = createAction((node, param) => {
  let startX = 0;
  let startScroll = 0;
  let lastX = 0;
  let lastAt = 0;
  let dragging = false;

  const down = (event: PointerEvent): void => {
    dragging = true;
    startX = lastX = event.clientX;
    startScroll = node.scrollLeft;
    lastAt = performance.now();
    param?.onDragStart?.();
  };
  const move = (event: PointerEvent): void => {
    if (!dragging) return;
    node.scrollLeft = startScroll - (event.clientX - startX);
    lastX = event.clientX;
    lastAt = performance.now();
  };
  const up = (): void => {
    if (!dragging) return;
    dragging = false;
    const dt = performance.now() - lastAt;
    param?.onDragEnd?.(dt > 0 ? (lastX - startX) / dt : 0);
  };

  const stops = [
    listen(node, "pointerdown", down as (e: Event) => void),
    listen(document, "pointermove", move as (e: Event) => void),
    listen(document, "pointerup", () => up()),
  ];
  return { destroy: () => stops.forEach((s) => s()) };
});

// ---------------------------------------------------------------------------
// scrollLock — prevent the document from scrolling while a modal surface is
// open. Element-scoped in EFFECT (the host's own scroll) and released on
// destroy; wrote as a data attribute the styling engine consumes, never as
// an inline overflow style.
// ---------------------------------------------------------------------------

export interface ScrollLockParam {
  enabled: boolean;
}

export const scrollLock: ElementAction<ScrollLockParam | undefined> = createAction((_node, param) => {
  // The lock is on the document, but the SWITCH is an attribute on the node
  // — the machine's state, read by utilities. The action's own job is the
  // one thing utilities cannot do: compensating for the scrollbar so the
  // layout does not jump.
  const apply = (enabled: boolean): void => {
    const root = document.documentElement;
    if (!enabled) {
      root.removeAttribute("data-scroll-locked");
      root.style.removeProperty("--scrollbar-width");
      return;
    }
    const gap = globalThis.innerWidth - root.clientWidth;
    root.setAttribute("data-scroll-locked", "");
    if (gap > 0) root.style.setProperty("--scrollbar-width", `${gap}px`);
  };
  apply(param?.enabled === true);
  return {
    update: (next) => apply(next?.enabled === true),
    destroy: () => apply(false),
  };
});

// ---------------------------------------------------------------------------
// intersect / resizeObserver — report visibility and size; the machine
// decides what they mean.
// ---------------------------------------------------------------------------

export interface IntersectParam {
  onVisibility?: (visible: boolean) => void;
  threshold?: number;
}

export const intersect: ElementAction<IntersectParam | undefined> = createAction((node, param) => {
  if (typeof IntersectionObserver !== "function") return;
  const observer = new IntersectionObserver((entries) => {
    param?.onVisibility?.(entries.some((entry) => entry.isIntersecting));
  }, { threshold: param?.threshold ?? 0.5 });
  observer.observe(node);
  return { destroy: () => observer.disconnect() };
});

export interface ResizeObserverParam {
  onResize?: (size: { width: number; height: number }) => void;
}

export const resizeObserver: ElementAction<ResizeObserverParam | undefined> = createAction((node, param) => {
  if (typeof ResizeObserver !== "function") return;
  const observer = new ResizeObserver((entries) => {
    const box = entries[0]?.contentRect;
    if (box) param?.onResize?.({ width: box.width, height: box.height });
  });
  observer.observe(node);
  return { destroy: () => observer.disconnect() };
});

/**
 * The registry: the `use:` vocabulary. Machines and markup reference
 * actions BY NAME from this table; nothing else resolves.
 */
export const ACTIONS = {
  "focus-trap": focusTrap,
  dismissable,
  autoplay,
  "drag-scroll": dragScroll,
  intersect,
  "resize-observer": resizeObserver,
  "scroll-lock": scrollLock,
} as const;

export type ActionName = keyof typeof ACTIONS;
