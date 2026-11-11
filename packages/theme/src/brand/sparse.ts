/**
 * A brand layer is a diff, never a dump: `$extends` names the parent and the
 * layer states only what it owns. This walks a composed document against its
 * parent and keeps what differs — a leaf (anything carrying `$value`) that
 * reads differently, a group that still holds a kept child, an array that is
 * not identical — so a write states the brand's own decisions and a starter
 * fix still reaches every brand layered over it.
 *
 * `$description` never decides the diff: documentation rides on kept leaves
 * when they differ, and an identical leaf with different prose is still the
 * same decision.
 */

import type { ThemeDocument } from "../pipeline/types.ts";
import { asRecord } from "../json.ts";

function undescribed(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(undescribed);
  const record = asRecord(value);
  if (record !== undefined) {
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(record)) {
      if (key === "$description") continue;
      out[key] = undescribed(child);
    }
    return out;
  }
  return value;
}


/**
 * The layer a brand owns: `full` minus everything it inherits from `parent`.
 *
 * `$extends` is never carried — expansion strips it, and a plain merge never
 * forwards it — so the caller sets the parent name on the written layer
 * itself. `$description` and `$type` ride on the leaves they describe, which
 * is what keeps a seeded leaf's documentation after the diff.
 */
export function sparseLayer(
  full: ThemeDocument,
  parent: ThemeDocument,
): ThemeDocument {
  const out: Record<string, unknown> = {};
  const parentRecord = asRecord(parent) ?? {};
  for (const [key, value] of Object.entries(full)) {
    if (key === "$extends") continue;
    const base = parentRecord[key];
    if (base !== undefined && JSON.stringify(undescribed(value)) === JSON.stringify(undescribed(base))) continue;
    const valueRecord = asRecord(value);
    const baseRecord = asRecord(base);
    if (
      valueRecord !== undefined &&
      baseRecord !== undefined &&
      !Object.hasOwn(valueRecord, "$value")
    ) {
      const kept = sparseLayer(
        valueRecord as ThemeDocument,
        baseRecord as ThemeDocument,
      );
      if (Object.keys(kept).length > 0) out[key] = kept;
      continue;
    }
    out[key] = structuredClone(value);
  }
  return out;
}
