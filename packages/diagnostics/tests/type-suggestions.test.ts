import { test } from "bun:test";
import { deepStrictEqual, match, ok } from "node:assert/strict";
import { starterThemes } from "@spinjs/theme/themes";
import {
  checkClosedVocabulary,
  type ClassFacts,
  type Facts,
} from "../src/core.ts";
import { factsFor } from "../src/project-vocabulary.ts";
import { engineAnswers } from "@spinjs/preset";

/**
 * TYPE-b: removed raw type utilities suggest the nearest declared style.
 *
 * `text-*` sizes and `font-*` families/weights are no longer vocabulary, so
 * the closed vocabulary reports them like any dead class — but the remedy
 * names the style to write instead, per the type-system UX contract (lint
 * remedies name the token, not just the complaint). A removed utility whose
 * error carries no style suggestion fails the stage's own contract.
 */

/** The classes of an element, as the core reads them. */
function element(classes: string, tag = "div"): ClassFacts {
  const names = classes.split(/\s+/).filter(Boolean);
  let cursor = 0;
  const tokens = names.map((name) => {
    const range = [cursor, cursor + name.length] as [number, number];
    cursor += name.length + 1;
    return { name, range, spaceBefore: range[0] > 0, spaceAfter: false };
  });
  return { tag, classes: names, tokens, position: { line: 1, column: 1 } };
}

function starterFacts(): Facts {
  return factsFor(Object.values(starterThemes), engineAnswers(Object.values(starterThemes)));
}

test("a removed size utility is unknown with a type-<style> suggestion", () => {
  // text-sm is no longer vocabulary: no catalog section names it and no rule
  // emits it. The finding writes the style in place and the remedy names it.
  const findings = checkClosedVocabulary(starterFacts(), element("text-sm"));
  deepStrictEqual(
    findings.map((finding) => finding.data["cls"]),
    ["text-sm"],
  );
  const [finding] = findings;
  deepStrictEqual(finding?.messageId, "unknown");
  ok(finding?.fix !== undefined, "a dead class keeps the edit that writes the style");
  match(
    finding?.remedy ?? "",
    /type-[a-z-]+/,
    "the remedy names a declared style to write instead",
  );
});

test("every removed size step carries a style suggestion", () => {
  // The guarantee is total: whatever size step an author reaches for, the
  // error says which style to wear instead.
  const facts = starterFacts();
  for (
    const cls of [
      "text-2xs",
      "text-xs",
      "text-sm",
      "text-md",
      "text-lg",
      "text-xl",
      "text-2xl",
      "text-3xl",
    ]
  ) {
    const [finding] = checkClosedVocabulary(facts, element(cls));
    deepStrictEqual(
      finding?.messageId,
      "unknown",
      `${cls} is no longer vocabulary`,
    );
    match(
      finding?.remedy ?? "",
      /type-[a-z-]+/,
      `${cls} suggests a declared style`,
    );
  }
});

test("every removed family and weight carries a style suggestion", () => {
  const facts = starterFacts();
  for (
    const cls of [
      "font-sans",
      "font-serif",
      "font-mono",
      "font-regular",
      "font-medium",
      "font-semibold",
      "font-bold",
    ]
  ) {
    const [finding] = checkClosedVocabulary(facts, element(cls));
    deepStrictEqual(
      finding?.messageId,
      "unknown",
      `${cls} is no longer vocabulary`,
    );
    match(
      finding?.remedy ?? "",
      /type-[a-z-]+/,
      `${cls} suggests a declared style`,
    );
  }
});

test("every removed tracking and leading step carries a style suggestion", () => {
  // TYPE-c (styles own type): the ladder atoms are removed too — every
  // `tracking-*`/`leading-*` error carries a style suggestion or the stage
  // fails its own UX contract.
  const facts = starterFacts();
  for (
    const cls of [
      "tracking-tighter",
      "tracking-tight",
      "tracking-normal",
      "tracking-wide",
      "tracking-wider",
      "tracking-widest",
      "leading-none",
      "leading-tight",
      "leading-snug",
      "leading-normal",
      "leading-relaxed",
      "leading-loose",
    ]
  ) {
    const [finding] = checkClosedVocabulary(facts, element(cls));
    deepStrictEqual(
      finding?.messageId,
      "unknown",
      `${cls} is no longer vocabulary`,
    );
    match(
      finding?.remedy ?? "",
      /type-[a-z-]+/,
      `${cls} suggests a declared style`,
    );
  }
});

test("the suggestion shares the removed utility's value", () => {
  // text-xs is the caption step and font-mono is the code face: the remedy
  // names the style that reads that way, not an arbitrary style.
  const facts = starterFacts();
  const [xs] = checkClosedVocabulary(facts, element("text-xs"));
  match(
    xs?.remedy ?? "",
    /type-caption/,
    "the caption step suggests the caption style",
  );
  const [sm] = checkClosedVocabulary(facts, element("text-sm"));
  match(
    sm?.remedy ?? "",
    /type-label/,
    "the sm step on a prose/UI container suggests type-label ahead of mono type-code",
  );
  const [base] = checkClosedVocabulary(facts, element("text-base"));
  match(
    base?.remedy ?? "",
    /type-body/,
    "Tailwind text-base suggests type-body",
  );
  const [mono] = checkClosedVocabulary(facts, element("font-mono"));
  match(
    mono?.remedy ?? "",
    /type-code/,
    "the mono face suggests the code style",
  );
});

test("a removed utility on a typed element suggests that element's style", () => {
  // A paragraph reads body by default: text-sm on a p suggests type-body,
  // the style the element already wears.
  const [finding] = checkClosedVocabulary(
    starterFacts(),
    element("text-sm", "p"),
  );
  match(
    finding?.remedy ?? "",
    /type-body/,
    "the remedy names the element's own default style",
  );
});

test("a declared style stays known", () => {
  // The removal takes the raw utilities, not the styles: type-body is
  // vocabulary and reports nothing.
  deepStrictEqual(
    checkClosedVocabulary(starterFacts(), element("type-body")),
    [],
  );
});

test("a removed utility is reported once, by the vocabulary alone", () => {
  // Interplay: the semantic rules read unknown classes as dead — a removed
  // utility must not ALSO draw prefer-theme-value or prefer-element. The
  // closed-vocabulary finding is the whole answer.
  const facts = starterFacts();
  const node = element("text-sm", "p");
  deepStrictEqual(
    checkClosedVocabulary(facts, node).map((finding) => finding.messageId),
    ["unknown"],
  );
});

test("a removed utility warns before the gate and errors after it", () => {
  // The migration window: the default finding carries a warning (the
  // shipping version predates the gate), an explicit error stays an error,
  // and anything else unknown is an error either way.
  const facts = starterFacts();
  const [warned] = checkClosedVocabulary(facts, element("text-sm"));
  deepStrictEqual(
    warned?.severity,
    "warning",
    "the warn side of the window reports a warning",
  );
  const [forced] = checkClosedVocabulary(facts, element("text-sm"), {
    rawType: "error",
  });
  deepStrictEqual(
    forced?.severity,
    undefined,
    "the error side reports at the rule's own severity",
  );
  const [typo] = checkClosedVocabulary(facts, element("bg-primry"));
  deepStrictEqual(
    typo?.severity,
    undefined,
    "a genuine typo is an error on both sides of the window",
  );
  const [typoForced] = checkClosedVocabulary(facts, element("bg-primry"), {
    rawType: "error",
  });
  deepStrictEqual(
    typoForced?.severity,
    undefined,
    "a genuine typo stays an error past the gate",
  );
});

test("a removed utility under a state variant suggests the style for its core", () => {
  // The variant is wind4's, not ours to strip by list: `aria-[pressed=true]`
  // rides in the preset by shape, so the suggestion reads the `font-medium`
  // core and names a style — the window covers what the core was, not the
  // state it was under.
  const [finding] = checkClosedVocabulary(
    starterFacts(),
    element("aria-[pressed=true]:font-medium", "button"),
  );
  deepStrictEqual(finding?.messageId, "unknown");
  match(
    finding?.remedy ?? "",
    /type-[a-z-]+/,
    "the remedy names a declared style for the removed core",
  );
  deepStrictEqual(
    finding?.severity,
    "warning",
    "a removed core warns under a variant like it warns bare",
  );
});
