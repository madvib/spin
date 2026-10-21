import { type Signal, signal } from "@spin/runtime";
import type { AnchorGeometry } from "@spin/runtime/actions";

/**
 * The measured position of an anchored panel.
 *
 * The `anchor` action measures the trigger and reports the geometry
 * here; the bag's style object carries it out to the element, so the
 * recipe names no property. The store is keyed by the instance's root
 * element (so it dies with the instance) and by the panel's own id (so
 * two panels of one instance never share a measurement).
 *
 * The value is a signal: the bag is a computed over the scope, and only
 * a signal read inside it re-runs the build when the geometry moves.
 */
const stores = new WeakMap<
  Element,
  Map<string, Signal<AnchorGeometry | null>>
>();

/** The geometry store for one anchored panel of one instance. */
export function anchorGeometry(
  root: Element,
  key: string,
): Signal<AnchorGeometry | null> {
  let byKey = stores.get(root);
  if (byKey === undefined) {
    byKey = new Map<string, Signal<AnchorGeometry | null>>();
    stores.set(root, byKey);
  }
  let geometry = byKey.get(key);
  if (geometry === undefined) {
    geometry = signal<AnchorGeometry | null>(null);
    byKey.set(key, geometry);
  }
  return geometry;
}

/**
 * The style object a bag carries: the measured position, or nothing
 * until the action has measured.
 */
export function anchorStyle(
  geometry: AnchorGeometry | null,
): Record<string, string> | undefined {
  if (geometry === null) return undefined;
  return {
    left: `${geometry.x}px`,
    top: `${geometry.y}px`,
    minWidth: `${geometry.w}px`,
  };
}
