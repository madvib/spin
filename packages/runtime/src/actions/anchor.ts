import { createAction } from "./action.ts";
import { machineTick } from "../core/signal.ts";
import type { ElementAction } from "./action.ts";

/**
 * Position a floating node against an anchor, reporting the geometry the
 * bag carries as custom properties.
 *
 * The platform owns the measurement: the anchor's rect against the
 * positioner's offset parent, re-read on resize, scroll, and param change.
 * The measurement reports through `onGeometry`, and the bag turns it into
 * the style object the geometry channel owns (`--anchor-x/y/w`) — the
 * action writes no styles itself, the same split the menu's anchor vars
 * keep. The recipe's bracketed utilities decide what each var feeds, so
 * the theme still owns appearance and the vars are data, not styles.
 *
 * Placement is a suggestion the viewport can veto: a panel below the
 * anchor with no room below flips above, and the flip reports alongside
 * the geometry so the origin utility can follow. Anything fancier
 * (collision middleware, arrow centering) is a consumer decision, not
 * this action's.
 */

export type AnchorPlacement = "top" | "bottom" | "left" | "right";

export interface AnchorGeometry {
  /** Anchor's left edge relative to the positioner's offset parent. */
  readonly x: number;
  /** Panel's top edge relative to the positioner's offset parent. */
  readonly y: number;
  /** Anchor width, for min-width matching. */
  readonly w: number;
  /** Anchor height, for a mask that frames it. */
  readonly h: number;
  /** The side the panel actually sits on, after the viewport's veto. */
  readonly placement: AnchorPlacement;
}

export interface AnchorParam {
  /** Element the panel positions against; the node's previous sibling when absent. */
  readonly anchor?: Element | null;
  /** Preferred side; flips when the preferred side has no room. */
  readonly placement?: AnchorPlacement;
  /** Gap between anchor and panel, in pixels. */
  readonly offset?: number;
  /** Fresh geometry; the bag turns this into custom properties. */
  readonly onGeometry?: (geometry: AnchorGeometry) => void;
}

export const anchor: ElementAction<AnchorParam | undefined> = createAction((node, param) => {
  let current: AnchorParam | undefined = param;
  let last: string | undefined;

  const resolveAnchor = (): Element | null =>
    current?.anchor instanceof Element ? current.anchor : node.previousElementSibling;

  // offsetParent is null for a hidden node and in layout-less DOMs; the
  // parent element is the honest fallback, not a second code path.
  const resolveHost = (): Element | null =>
    node instanceof HTMLElement ? node.offsetParent ?? node.parentElement : null;

  const measure = (): void => {
    const anchorEl = resolveAnchor();
    if (!(anchorEl instanceof HTMLElement)) return;
    if (!(node instanceof HTMLElement)) return;
    // A top-layer node (an open popover) has no offset parent and positions
    // against the viewport: client rects are already viewport coordinates,
    // so the host origin is zero and the recipe positions `fixed`.
    const topLayer = (() => {
      try {
        return node.matches(":popover-open");
      } catch {
        return false;
      }
    })();
    const host = topLayer ? null : resolveHost();
    if (!topLayer && host === null) return;
    const gap = current?.offset ?? 8;
    const want = current?.placement ?? "bottom";
    const anchorRect = anchorEl.getBoundingClientRect();
    const hostRect = host?.getBoundingClientRect();
    const hostLeft = hostRect?.left ?? 0;
    const hostTop = hostRect?.top ?? 0;
    const hostBottom = hostRect?.bottom ?? globalThis.innerHeight ?? 0;
    const panelHeight = node.offsetHeight;
    const panelWidth = node.offsetWidth;
    const hostRight = hostRect?.right ?? globalThis.innerWidth ?? 0;
    const roomBelow = hostBottom - anchorRect.bottom - gap;
    const roomAbove = anchorRect.top - hostTop - gap;
    const roomRight = hostRight - anchorRect.right - gap;
    const hostLeftEdge = hostRect?.left ?? 0;
    const roomLeft = anchorRect.left - hostLeftEdge - gap;
    const horizontal = want === "left" || want === "right";
    // The flip is sticky-free: each measurement answers from current room,
    // so a resize that restores room flips back without stored state.
    const placement: AnchorPlacement = horizontal
      ? (want === "right"
        ? (roomRight < panelWidth && roomLeft > roomRight ? "left" : "right")
        : (roomLeft < panelWidth && roomRight > roomLeft ? "right" : "left"))
      : (want === "bottom"
        ? (roomBelow < panelHeight && roomAbove > roomBelow ? "top" : "bottom")
        : (roomAbove < panelHeight && roomBelow > roomAbove ? "bottom" : "top"));
    const geometry: AnchorGeometry = horizontal
      ? {
        x: placement === "right"
          ? anchorRect.right - hostLeft + gap
          : anchorRect.left - hostLeft - panelWidth - gap,
        y: anchorRect.top - hostTop + (anchorRect.height - panelHeight) / 2,
        w: anchorRect.width,
        h: anchorRect.height,
        placement,
      }
      : {
        x: anchorRect.left - hostLeft,
        y: placement === "bottom"
          ? anchorRect.bottom - hostTop + gap
          : anchorRect.top - hostTop - panelHeight - gap,
        w: anchorRect.width,
        h: anchorRect.height,
        placement,
      };
    const key = `${geometry.x},${geometry.y},${geometry.w},${geometry.placement}`;
    if (key === last) return;
    last = key;
    // Action owns positioning end-to-end: write literals directly, no
    // render cycle, no vars.
    if (node instanceof HTMLElement) {
      node.style.left = `${geometry.x}px`;
      node.style.top = `${geometry.y}px`;
      node.style.minWidth = `${geometry.w}px`;
    }
    current?.onGeometry?.(geometry);
    // A geometry change is a view move: consumers reading placement
    // refresh the same way a machine move refreshes them.
    machineTick(machineTick() + 1);
  };
  // The observer is a re-measure trigger, not the measure itself: without
  // one (a layout-less DOM) scroll, resize, and param changes still report.
  const ro = typeof ResizeObserver === "function" ? new ResizeObserver(() => measure()) : undefined;
  ro?.observe(node);
  const scrollRoot = node.ownerDocument;
  const onScroll = (): void => measure();
  const onResize = (): void => measure();
  const view = scrollRoot.defaultView;
  view?.addEventListener("resize", onResize);
  measure();

  return {
    update: (next) => {
      current = next;
      measure();
    },
    destroy: () => {
      ro?.disconnect();
      scrollRoot.removeEventListener("scroll", onScroll, true);
      view?.removeEventListener("resize", onResize);
    },
  };
});
