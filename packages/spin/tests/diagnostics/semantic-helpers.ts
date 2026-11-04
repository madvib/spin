import { starterThemes } from "../../src/theme/themes/index.ts";
import type {
  AncestorFacts,
  ClassFacts,
  Facts,
  SemanticOptions,
} from "../../src/diagnostics/core.ts";
import { checkNoRedundantClass } from "../../src/diagnostics/no-redundant-class.ts";
import { checkPreferElement } from "../../src/diagnostics/prefer-element.ts";
import { checkPreferThemeValue } from "../../src/diagnostics/prefer-theme-value.ts";
import { factsFor } from "../../src/diagnostics/facts.ts";

export const facts: Facts = factsFor(Object.values(starterThemes));

/** The classes of an element, as the core reads them. */
export function element(
  tag: string,
  classes: string,
  ancestors: readonly AncestorFacts[] = [],
): ClassFacts {
  const names = classes.split(/\s+/).filter(Boolean);
  let at = 0;
  return {
    tag,
    classes: names,
    tokens: names.map((name) => {
      const start = at;
      at += name.length + 1;
      return {
        name,
        range: [start, start + name.length] as [number, number],
        spaceBefore: start > 0,
        spaceAfter: true,
      };
    }),
    ancestors,
    position: { line: 1, column: 1 },
  };
}

/** What the redundancy rule reports for one element. */
export function redundant(
  tag: string,
  classes: string,
  options?: SemanticOptions,
  ancestors: readonly AncestorFacts[] = [],
) {
  return checkNoRedundantClass(
    facts,
    element(tag, classes, ancestors),
    options,
  );
}

/** What the theme-value rule reports for one element. */
export function override(
  tag: string,
  classes: string,
  options?: SemanticOptions,
  ancestors: readonly AncestorFacts[] = [],
) {
  return checkPreferThemeValue(
    facts,
    element(tag, classes, ancestors),
    options,
  );
}

/** What the element rule reports for one element. */
export function other(
  tag: string,
  classes: string,
  options?: SemanticOptions,
  ancestors: readonly AncestorFacts[] = [],
) {
  return checkPreferElement(
    facts,
    element(tag, classes, ancestors),
    options,
  );
}
