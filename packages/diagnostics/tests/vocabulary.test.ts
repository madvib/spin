import { test } from "bun:test";
import { deepStrictEqual } from "node:assert/strict";
import type { ThemeDocument } from "@spinjs/theme";
import {
  cssVarName,
  indexTree,
  parseTokens,
  resolveAliases,
  designLanguages,
} from "@spinjs/theme";
import {
  checkClosedVocabulary,
  type ClassFacts,
  type Facts,
} from "../src/core.ts";
import { factsFor, projectFacts } from "../src/project-vocabulary.ts";
import { deriveVocabulary } from "../src/vocabulary.ts";
import { noShortcuts } from "../src/shortcuts.ts";
import { animationVariants, engineAnswers, variantPrefixes } from "@spinjs/preset";
import { deadClasses } from "@spinjs/build";

/**
 * The vocabulary is the project's own theme, catalogued.
 *
  * The classes these tests use are the ones the themes declare: `text-xs` is
  * a scale step the languages carry, `p-72` is a step only a project that
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

/** A theme that carries a scale step the languages do not. */
function projectTheme(): ThemeDocument {
  const minimal = designLanguages.minimal as Record<string, unknown>;
  return {
    ...minimal,
    spacing: {
      ...(minimal["spacing"] as Record<string, unknown>),
      "72": { $value: "18rem" },
    },
  };
}

test("a class the project's theme produces is not reported", () => {
  // The step exists only in this project's theme, so only this project's
  // vocabulary can know it. The languages alone would call it unknown.
  const facts = factsFor([projectTheme()], engineAnswers([projectTheme()]));
  deepStrictEqual(reported(facts, "p-72"), []);
});

test("a class no theme produces is reported", () => {
  // The same class, against a vocabulary whose themes do not declare the
  // step: nothing generates it, so the rule has to say so.
  const facts = factsFor(Object.values(designLanguages), engineAnswers(Object.values(designLanguages)));
  deepStrictEqual(reported(facts, "p-72"), ["p-72"]);
});

test("a class nothing produces carries the edit that drops it", () => {
  // The class generates no CSS, so it styles nothing: dropping it changes
  // nothing, and the finding says so with the edit that does it.
  const facts = factsFor(Object.values(designLanguages), engineAnswers(Object.values(designLanguages)));
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

test("a scale step the languages declare is part of the vocabulary", () => {
  // The whole point of the union: the scaffold a theme starts from has no
  // scales at all, so a vocabulary built from it calls every step unknown.
  // TYPE-b: raw type utilities are no longer vocabulary — the named styles
  // are — so the fixture wears `type-body` where it once wore `text-xs`.
  const facts = factsFor(Object.values(designLanguages), engineAnswers(Object.values(designLanguages)));
  deepStrictEqual(
    reported(facts, "type-body type-caption gap-2 rounded-md p-3"),
    [],
  );
});

test("a composition the project does not declare is unknown", () => {
  // The preset ships no compositions, so `stack` is unknown unless the
  // project declares it — and what the project declares is what is known.
  // `overline` stays known regardless: it is a static text-decoration
  // utility (Tailwind vocabulary), not a composition.
  const declared = projectFacts(
    { acme: projectTheme() },
    engineAnswers([...Object.values(designLanguages), projectTheme()]),
    new Set(),
    { shortcuts: { stack: ["flex", "flex-col", "gap-4"] }, unreadable: false },
  );
  deepStrictEqual(reported(declared, "stack"), []);
  const bare = projectFacts({ acme: projectTheme() }, engineAnswers([...Object.values(designLanguages), projectTheme()]), new Set());
  deepStrictEqual(reported(bare, "stack row split cluster"), [
    "stack",
    "row",
    "split",
    "cluster",
  ]);
  deepStrictEqual(reported(bare, "overline"), []);
});

test("with no project theme, the languages' vocabulary applies", () => {
  // A project that has not forked a theme still renders: it serves the
  // languages. The vocabulary is theirs, and only theirs.
  const facts = projectFacts({}, engineAnswers(Object.values(designLanguages)), new Set());
  deepStrictEqual(reported(facts, "type-body gap-2 rounded-md"), []);
  deepStrictEqual(reported(facts, "my-stack"), ["my-stack"]);
});

test("a class the animation layer defines is part of the vocabulary", () => {
  // `animate-spin` is a real class — the animation package defines it — and
  // a lint that called it unknown would be wrong.
  const facts = factsFor(Object.values(designLanguages), engineAnswers(Object.values(designLanguages)));
  deepStrictEqual(reported(facts, "animate-spin animate-fade-in"), []);
});

test("when nothing can be read, the rule abstains", () => {
  // No theme at all is not a theme with nothing in it: it is a vocabulary
  // nobody could read, and the rule says nothing rather than flag every
  // class in the file.
  const facts = factsFor([], engineAnswers([]));
  deepStrictEqual(reported(facts, "bg-primary p-72 stack-sm"), []);
});

test("a class the project declares is known beside the languages", () => {
  // The project's own themes and the languages are one vocabulary: a project
  // serves the languages it has not forked, so both are in play.
  const facts = projectFacts(
    { acme: projectTheme() },
    engineAnswers([...Object.values(designLanguages), projectTheme()]),
    new Set(),
  );
  deepStrictEqual(reported(facts, "p-72 type-body"), []);
  deepStrictEqual(reported(facts, "my-stack"), ["my-stack"]);
});

test("text-text is unknown and carries the edit that drops it", () => {
  // T5 (remove `text-text`): the catalog no longer names it and no rule
  // emits it, so the closed vocabulary reports it like any dead class —
  // and the stuttered `text-text-muted` and `border-border` spellings are
  // dead with it — while `text-muted` and `border-strong` stay known.
  const facts = factsFor(Object.values(designLanguages), engineAnswers(Object.values(designLanguages)));
  deepStrictEqual(reported(facts, "text-text"), ["text-text"]);
  deepStrictEqual(reported(facts, "text-text-muted"), ["text-text-muted"]);
  deepStrictEqual(reported(facts, "border-border"), ["border-border"]);
  deepStrictEqual(reported(facts, "text-muted border-strong"), []);
  const node: ClassFacts = {
    tag: "div",
    classes: ["text-text"],
    tokens: [{
      name: "text-text",
      range: [0, 9],
      spaceBefore: false,
      spaceAfter: false,
    }],
    position: { line: 1, column: 1 },
  };
  const [finding] = checkClosedVocabulary(facts, node);
  deepStrictEqual(finding?.messageId, "unknown");
  deepStrictEqual(finding?.fix, { range: [0, 9], text: "" });
});
test("a removed raw size is unknown while the named style stays known", () => {
  // TYPE-b (remove raw type utilities): no rule emits `text-xs`, and the
  // catalog never names it, so the closed vocabulary reports it like any
  // dead class — while the named styles stay known. The arbitrary hatch
  // (`text-[14px]`) reads the same way it always did.
  const facts = factsFor(Object.values(designLanguages), engineAnswers(Object.values(designLanguages)));
  deepStrictEqual(reported(facts, "text-[14px] text-[15px]"), [
    "text-[14px]",
    "text-[15px]",
  ]);
  deepStrictEqual(reported(facts, "text-xs text-lg text-2xs"), [
    "text-xs",
    "text-lg",
    "text-2xs",
  ]);
  deepStrictEqual(reported(facts, "type-body type-caption"), []);
});

test("the oracle derives what both surfaces used to derive by hand", async () => {
  // The move-day parity: the oracle must answer exactly what `factsFor`
  // derived (the family loop, the breakpoint prefix read, the values map)
  // and what `deadClasses` derived (variant prefixes, the same breakpoint
  // read, the same values map, catalog/primitive/animation membership) —
  // if the sets differ on move day, the move is wrong, not the test.
  const documents = Object.values(designLanguages);
  const answers = engineAnswers(documents);
  const trees = documents.flatMap((document) => {
    const parsed = parseTokens(document);
    return parsed.ok ? [parsed.tree] : [];
  });
  const declaration = noShortcuts();
  const oracle = deriveVocabulary({
    trees,
    answers,
    generated: new Set(),
    shortcuts: declaration,
  });

  // The reference, the way `factsFor` built it before the move: every
  // family member is a utility, whatever group names it.
  const refUtilities = new Set<string>();
  for (const family of answers.families) {
    for (const utility of family.utilities) refUtilities.add(utility);
  }
  // The reference, the way `deadClasses` built it: the fixed variant
  // prefixes plus the theme's own breakpoint steps.
  const refPrefixes = new Set<string>([...variantPrefixes()]);
  for (const tree of trees) {
    for (const leaf of Object.values(indexTree(tree).leaves)) {
      if (leaf.path[0] !== "breakpoint") continue;
      const name = leaf.path[1];
      if (name === undefined) continue;
      refPrefixes.add(`${name}:`);
      refPrefixes.add(`max-${name}:`);
    }
  }
  // The reference values, the way both built them: aliases followed, the
  // last document winning.
  const refValues = new Map<string, string>();
  for (const tree of trees) {
    const resolved = resolveAliases(tree);
    for (const leaf of Object.values(indexTree(resolved.tree).leaves)) {
      const value = leaf.value;
      if (value === undefined || value === null) continue;
      refValues.set(cssVarName(leaf.path), String(value));
    }
  }
  deepStrictEqual([...oracle.utilities].sort(), [...refUtilities].sort());
  deepStrictEqual([...oracle.prefixes].sort(), [...refPrefixes].sort());
  deepStrictEqual(
    [...oracle.values.entries()].sort(),
    [...refValues.entries()].sort(),
  );
  deepStrictEqual(
    [...oracle.variants].sort(),
    [...new Set([...answers.primitives.variants, ...animationVariants()])].sort(),
  );

  // The lint reads the same oracle: with no project shortcuts, its sets
  // are the oracle's own.
  const facts = factsFor(documents, answers);
  deepStrictEqual([...facts.utilities].sort(), [...oracle.utilities].sort());
  deepStrictEqual([...facts.prefixes].sort(), [...oracle.prefixes].sort());
  deepStrictEqual([...facts.variants].sort(), [...oracle.variants].sort());
  deepStrictEqual(
    [...facts.values.entries()].sort(),
    [...oracle.values.entries()].sort(),
  );

  // The build reads the same oracle: a catalog class is not dead, and the
  // class nothing produces is.
  const dead = await deadClasses({
    files: new Map([
      ["src/a.tsx", '<div className="bg-primary zzz-nope-123"></div>'],
    ]),
    matched: new Set(),
    themes: Object.fromEntries(documents.map((document, index) => [`t${index}`, document])),
    root: "/",
  });
  deepStrictEqual(dead.map((entry) => entry.cls), ["zzz-nope-123"]);
});
