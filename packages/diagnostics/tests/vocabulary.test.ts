import { test } from "bun:test";
import { deepStrictEqual } from "node:assert/strict";
import type { ThemeDocument } from "@spin/theme";
import { starterThemes } from "@spin/theme/themes";
import {
  checkClosedVocabulary,
  type ClassFacts,
  type Facts,
} from "../src/core.ts";
import { factsFor, projectFacts } from "../src/facts.ts";

/**
 * The vocabulary is the project's own theme, catalogued.
 *
 * The classes these tests use are the ones the themes declare: `text-xs` is
 * a scale step the starters carry, `p-72` is a step only a project that
 * declares it can produce. A test here that had to spell its own utility
 * table would prove the table, not the rule.
 */

/** The classes of an element, as the core reads them. */
function element(classes: string): ClassFacts {
  return {
    tag: "div",
    classes: classes.split(/\s+/).filter(Boolean),
    position: { line: 1, column: 1 },
  };
}

/** The classes the rule reports for one element. */
function reported(facts: Facts, classes: string): string[] {
  return checkClosedVocabulary(facts, element(classes)).map((finding) =>
    finding.data["cls"] ?? ""
  );
}

/** A theme that carries a scale step the starters do not. */
function projectTheme(): ThemeDocument {
  const silk = starterThemes.silk as Record<string, unknown>;
  return {
    ...silk,
    spacing: {
      ...(silk["spacing"] as Record<string, unknown>),
      "72": { $value: "18rem" },
    },
  };
}

test("a class the project's theme produces is not reported", () => {
  // The step exists only in this project's theme, so only this project's
  // vocabulary can know it. The starters alone would call it unknown.
  const facts = factsFor([projectTheme()]);
  deepStrictEqual(reported(facts, "p-72"), []);
});

test("a class no theme produces is reported", () => {
  // The same class, against a vocabulary whose themes do not declare the
  // step: nothing generates it, so the rule has to say so.
  const facts = factsFor(Object.values(starterThemes));
  deepStrictEqual(reported(facts, "p-72"), ["p-72"]);
});

test("a class nothing produces carries the edit that drops it", () => {
  // The class generates no CSS, so it styles nothing: dropping it changes
  // nothing, and the finding says so with the edit that does it.
  const facts = factsFor(Object.values(starterThemes));
  const node: ClassFacts = {
    tag: "div",
    classes: ["p-72"],
    tokens: [{
      name: "p-72",
      range: [0, 4],
      spaceBefore: false,
      spaceAfter: false,
    }],
    position: { line: 1, column: 1 },
  };
  const [finding] = checkClosedVocabulary(facts, node);
  deepStrictEqual(finding?.fix, { range: [0, 4], text: "" });
});

test("a scale step the starters declare is part of the vocabulary", () => {
  // The whole point of the union: the scaffold a theme starts from has no
  // scales at all, so a vocabulary built from it calls every step unknown.
  const facts = factsFor(Object.values(starterThemes));
  deepStrictEqual(
    reported(facts, "text-xs text-sm gap-2 font-mono rounded-md p-3"),
    [],
  );
});

test("the product's own compositions are vocabulary without a project declaration", () => {
  // `stack`, `row`, `split`, `panel` and `overline` ship with the preset, so a
  // project writes them without declaring them. A lint that called them
  // unknown would flag the product's own pages.
  const facts = factsFor(Object.values(starterThemes));
  deepStrictEqual(
    reported(
      facts,
      "stack stack-sm stack-lg row row-sm split panel overline cluster",
    ),
    [],
  );
});

test("with no project theme, the starters' vocabulary applies", () => {
  // A project that has not forked a theme still renders: it serves the
  // starters. The vocabulary is theirs, and only theirs.
  const facts = projectFacts({}, new Set());
  deepStrictEqual(reported(facts, "text-xs gap-2 rounded-md"), []);
  deepStrictEqual(reported(facts, "my-stack"), ["my-stack"]);
});

test("a class the animation layer defines is part of the vocabulary", () => {
  // `animate-spin` is a real class — the animation package defines it — and
  // a lint that called it unknown would be wrong.
  const facts = factsFor(Object.values(starterThemes));
  deepStrictEqual(reported(facts, "animate-spin animate-fade-in"), []);
});

test("when nothing can be read, the rule abstains", () => {
  // No theme at all is not a theme with nothing in it: it is a vocabulary
  // nobody could read, and the rule says nothing rather than flag every
  // class in the file.
  const facts = factsFor([]);
  deepStrictEqual(reported(facts, "bg-primary p-72 stack-sm"), []);
});

test("a class the project declares is known beside the starters", () => {
  // The project's own themes and the starters are one vocabulary: a project
  // serves the starters it has not forked, so both are in play.
  const facts = projectFacts(
    { acme: projectTheme() },
    new Set(),
  );
  deepStrictEqual(reported(facts, "p-72 text-xs"), []);
  deepStrictEqual(reported(facts, "my-stack"), ["my-stack"]);
});
