/**
 * Dead weight: a class that says what the element already says.
 *
 * The class sets properties the element sets too, and it sets them to the
 * values the element already has. It changes nothing, so it can be dropped —
 * and the finding carries the edit that drops it.
 */

import {
  claimedBy,
  type Reading,
  readings,
  isReported,
  removalOf,
  variantDecisionValue,
} from "./semantic.ts";
import { sameValue } from "./properties.ts";
import type {
  ClassFacts,
  Facts,
  Finding,
  SemanticOptions,
} from "./core.ts";
import { DEFAULT_SEMANTIC_OPTIONS } from "./core.ts";

export function checkNoRedundantClass(
  facts: Facts,
  node: ClassFacts,
  options: SemanticOptions = DEFAULT_SEMANTIC_OPTIONS,
): Finding[] {
  const tag = node.tag;
  if (tag === undefined) return [];
  // A decision the element's own variant has claimed is the VARIANT's answer,
  // not the scope's — with one exception: when the class says EXACTLY what
  // the variant says, it is still dead weight. `secondary` wears the page's
  // ink, so `text-text` on a secondary button changes nothing and can go.
  // But a class that sets a DIFFERENT value than the worn variant's is the
  // variant's own answer or a deliberate override — `text-on-semantic-warning`
  // on a bare warning key IS the ink — and dropping it would change the
  // element. Only that second case stands down.
  const claimed = claimedBy(facts, node);
  const out: Finding[] = [];
  for (const reading of readings(facts, node, options)) {
    if (!isReported(reading.tier, options.strictness)) continue;
    if (!reading.dead) continue;
    if (reading.decision !== undefined && claimed.has(reading.decision)) {
      const variantValue = variantDecisionValue(facts, node, reading.decision);
      const classValue = reading.declarations.get(reading.shared[0] as string);
      if (
        variantValue === undefined || classValue === undefined ||
        !sameValue(variantValue, classValue, facts.values)
      ) continue;
    }
    const index = node.classes.indexOf(reading.cls);
    out.push({
      messageId: "redundant",
      data: {
        tag,
        cls: reading.cls,
        properties: reading.shared.join(", "),
      },
      position: node.position,
      fix: removalOf(node, index),
      remedy: "Drop `" + reading.cls + "`",
    });
  }
  return out;
}

export type { Reading };
