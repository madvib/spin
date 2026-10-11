import { createAction } from "./action.ts";
import type { ElementAction } from "./action.ts";

/**
 * A MutationObserver on the node. Attribute changes on the node itself,
 * element children removed from it, and one report when observation starts,
 * for a state that already settled before the observer existed (an <img> out
 * of a warm cache never fires load/error again). The machine decides what
 * any of it means.
 *
 * Same shape and rules as the catalog's other observers: it observes, never
 * reaches across element boundaries, holds nothing that outlives the node,
 * and releases the observer in `destroy`.
 *
 * Added for the avatar port: image sources swap under a rendered node and
 * images get removed while rendered, and nothing in the catalog watches
 * either.
 */

export interface ObserveParam {
  /** Attributes on the node itself to watch. */
  attributes?: readonly string[];
  /** An attribute in `attributes` changed. */
  onAttributes?: () => void;
  /** An element child was removed from the node. */
  onRemove?: (removed: Element) => void;
  /** Observation started; the node's current state is readable now. */
  onAttach?: () => void;
}

export const observe: ElementAction<ObserveParam | undefined> = createAction((node, param) => {
  if (typeof MutationObserver !== "function") return;
  // An empty filter watches no attributes at all, which is what a
  // child-list-only observer wants.
  const filter = param?.attributes ?? [];
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === "attributes") {
        param?.onAttributes?.();
        continue;
      }
      for (const removed of record.removedNodes) {
        if (removed instanceof Element) param?.onRemove?.(removed);
      }
    }
  });
  observer.observe(node, { childList: true, attributes: true, attributeFilter: [...filter] });
  param?.onAttach?.();
  return {
    destroy: () => observer.disconnect(),
  };
});
