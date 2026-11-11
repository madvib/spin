import { createAction } from "./action.ts";
import type { ElementAction } from "./action.ts";

/**
 * infinite-scroll — report when a sentinel at the end of a list scrolls into
 * view, INCLUDING when the content around it grows.
 *
 * A plain IntersectionObserver reports a change of visibility and nothing
 * else, which is exactly the case an async list keeps producing: a page is
 * appended, the sentinel is still in view, and no notification ever comes,
 * so the list loads one page and stops. The observer's last known state is
 * therefore re-reported whenever the element that grows with the content
 * changes size, which is what makes a paged list drain without a scroll.
 *
 * The action mutates only the nodes it is given and holds no state that
 * outlives them; the only outward path is `onLoadMore`.
 */
export interface InfiniteScrollParam {
  /** Fired when the sentinel is in view and loading is not switched off. */
  onLoadMore?: () => void;
  /** True while there is anything left to load. */
  enabled?: boolean;
}

export const infiniteScroll: ElementAction<InfiniteScrollParam | undefined> = createAction(
  (node, param) => {
    let intersecting = false;
    let enabled = param?.enabled !== false;

    const report = (): void => {
      if (!enabled || !intersecting) return;
      param?.onLoadMore?.();
    };

    let stops: Array<() => void> = [];
    const visibility = typeof IntersectionObserver === "function"
      ? new IntersectionObserver((entries) => {
        intersecting = entries.some((entry) => entry.isIntersecting);
        report();
      }, { threshold: 0 })
      : undefined;
    visibility?.observe(node);

    // The list the sentinel sits in: the element whose size says the content
    // grew. A resize there re-reports the state the observer already holds.
    const content = node.parentElement;
    const sizing = typeof ResizeObserver === "function" && content !== null
      ? new ResizeObserver(() => report())
      : undefined;
    if (content !== null) sizing?.observe(content);

    stops = [
      () => visibility?.disconnect(),
      () => sizing?.disconnect(),
    ];

    return {
      update: (next) => {
        param = next;
        enabled = next?.enabled !== false;
        // A switch that turns loading back on reports the state the observer
        // last saw, so a host that re-enables while still in view continues.
        report();
      },
      destroy: () => {
        for (const stop of stops) stop();
      },
    };
  },
);
