import { designLanguages } from "@spinjs/theme";
import type {
  AncestorFacts,
  ClassFacts,
  Facts,
  SemanticOptions,
} from "../src/core.ts";
import { checkNoRedundantClass } from "../src/no-redundant-class.ts";
import { checkPreferElement } from "../src/prefer-element.ts";
import { checkPreferThemeValue } from "../src/prefer-theme-value.ts";
import { engineAnswers } from "@spinjs/preset";
import { factsFor } from "../src/project-vocabulary.ts";

const documents = Object.values(designLanguages);
export const facts: Facts = factsFor(documents, engineAnswers(documents));

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
