/**
 * The closed vocabulary: a class the project cannot produce.
 *
 * The vocabulary is the project's own theme, catalogued — so a class the
 * theme can produce is known, and a class nothing produces is not. The
 * primitives' own variants are known too: they are classes the system
 * defines, even though no theme names them.
 *
 * A class the theme cannot produce is DEAD: it renders nothing, so dropping
 * it changes nothing. The finding therefore carries the edit that drops it.
 */

import { coreName, removalOf, replacementOf } from "./semantic.ts";
import { rawTypeSeverity, type RawTypeSeverity } from "./raw-type-window.ts";
import { suggestTypeStyle } from "./type-style.ts";
import type { ClassFacts, Facts, Finding } from "./core.ts";

/** What the closed-vocabulary check is told about the migration window. */
export interface ClosedVocabularyOptions {
  /**
   * How removed raw type utilities report. Omitted, the shipping version's
   * window side decides: warn before the gate minor, error after it.
   */
  readonly rawType?: RawTypeSeverity;
}

export function checkClosedVocabulary(
  facts: Facts,
  node: ClassFacts,
  options: ClosedVocabularyOptions = {},
): Finding[] {
  if (!facts.readable) return [];
  // The project composes, and the lint cannot see what it composed: the
  // vocabulary is incomplete, and a class the project declared would be
  // reported as one it does not know. The rule says nothing rather than
  // say the wrong thing.
  if (facts.shortcuts === null) return [];
  const out: Finding[] = [];
  for (const [index, cls] of node.classes.entries()) {
    if (facts.variants.has(cls)) continue;
    if (facts.utilities.has(cls)) continue;
    const core = coreName(cls, facts.prefixes);
    if (facts.utilities.has(core)) continue;
    if (facts.variants.has(core)) continue;
    // Icon glyphs come from the icon preset, not the token vocabulary.
    if (core.startsWith("i-")) continue;
    const shortcut = facts.shortcuts.get(cls) ?? facts.shortcuts.get(core);
    if (shortcut !== undefined) {
      for (const part of shortcut) {
        if (producible(facts, part)) continue;
        out.push({
          messageId: "shortcut",
          data: { shortcut: cls, cls: part },
          position: node.position,
          remedy: "Change what `" + cls + "` expands to, or drop it.",
        });
      }
      continue;
    }
    const suggestion = suggestTypeStyle(core, facts.values, node.tag);
    // The migration window: a removed utility warns before the gate minor
    // and errors after it. Anything else unknown is dead either way.
    const removed = suggestion !== undefined;
    out.push({
      messageId: "unknown",
      data: { cls },
      position: node.position,
      fix: suggestion !== undefined
        ? replacementOf(node, index, suggestion)
        : removalOf(node, index),
      remedy: removed
        ? "Did you mean `" + suggestion + "`? Drop `" + cls + "` and wear the style instead."
        : "Drop `" + cls + "`",
      ...(removed && rawTypeSeverity(options.rawType) === "warn"
        ? { severity: "warning" as const }
        : {}),
    });
  }
  return out;
}

/**
 * Whether the vocabulary can produce a class.
 *
 * The same question the closed-vocabulary rule asks of a class in markup,
 * asked of the classes a shortcut spends: a variant prefix does not change
 * what a utility is, and an icon glyph comes from the icon preset.
 */
function producible(facts: Facts, cls: string): boolean {
  if (facts.utilities.has(cls)) return true;
  if (facts.variants.has(cls)) return true;
  if (cls.startsWith("i-")) return true;
  const core = coreName(cls, facts.prefixes);
  if (facts.utilities.has(core)) return true;
  if (facts.variants.has(core)) return true;
  return false;
}
