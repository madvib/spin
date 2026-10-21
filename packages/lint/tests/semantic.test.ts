import { assertEquals } from "@std/assert";
import { starterThemes } from "@spin/theme/themes";
import {
  type AncestorFacts,
  checkNoRedundantClass,
  checkPreferElement,
  checkPreferThemeValue,
  type ClassFacts,
  type Facts,
  type SemanticOptions,
} from "../src/core.ts";
import { factsFor } from "../src/facts.ts";
import plugin from "../src/index.ts";

/**
 * What a class does to an element decides what is reported about it.
 *
 * Three questions, three rules:
 *
 * - Does the class say what the element ALREADY says? Then it is dead
 *   weight, and the rule drops it.
 * - Does the class say something ELSE where the theme has already said? Then
 *   it is a second opinion about a decision the theme owns, and the theme is
 *   where that decision belongs.
 * - Does the class carry a decision the theme gave to ANOTHER element? Then
 *   the markup is reaching for something the theme answered elsewhere, and
 *   the element that carries it is named.
 *
 * And the tier is CONTEXTUAL: where a box sits is the author's, but on an
 * element the theme types the space between blocks is the theme's.
 */

const facts: Facts = factsFor(Object.values(starterThemes));

/** The classes of an element, as the core reads them. */
function element(
  tag: string,
  classes: string,
  ancestors: readonly AncestorFacts[] = [],
): ClassFacts {
  const names = classes.split(/\s+/).filter(Boolean);
  let at = 0;
  return {
    tag,
    classes: names,
    // Where each class sits, so the findings that drop one can say which
    // text to remove.
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
function redundant(
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
function override(
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
function other(
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

Deno.test("a class that says what the element says is dead weight", () => {
  // The heading's own size is the theme's ladder step, and `text-xl` is
  // that same step. The class changes nothing.
  const [finding] = redundant("h3", "text-xl");
  assertEquals(finding?.messageId, "redundant");
  assertEquals(finding?.data, {
    tag: "h3",
    cls: "text-xl",
    properties: "font-size",
  });
});

Deno.test("a dead weight class carries the edit that drops it", () => {
  // The class is dead weight, so dropping it is the whole of the fix — and
  // the fix is part of the finding, so every front end can apply it.
  const [finding] = redundant("code", "font-mono");
  assertEquals(finding?.fix, { range: [0, 10], text: "" });
});

Deno.test("a class that says something else overrides the theme", () => {
  // The heading takes its size from the theme's ladder; `text-sm` is a
  // different step, and a second opinion about the ladder.
  const [finding] = override("h3", "text-sm");
  assertEquals(finding?.messageId, "override");
  assertEquals(finding?.data, {
    tag: "h3",
    cls: "text-sm",
    decision: "size",
    source: "the theme's ladder",
  });
  assertEquals(finding?.fix, undefined);
});

Deno.test("a class that changes nothing is not an override", () => {
  // The rule that says "the theme already said this" is the redundancy
  // rule's business: one class, one finding.
  assertEquals(override("h3", "text-xl"), []);
});

Deno.test("a layout utility is free on an element that paints", () => {
  // Where the box sits and how big it is: the author's call, and the
  // primitive's decision about how it looks does not reach it.
  assertEquals(override("button", "flex w-full gap-2 items-center"), []);
});

Deno.test("a utility on a raw element is free", () => {
  // Nothing paints a `div`, so nothing decides how it looks.
  assertEquals(override("div", "bg-primary text-text-muted rounded-md"), []);
});

Deno.test("a utility over a decision the element does not own is free", () => {
  // The heading owns the scale and the weight of its text; it says nothing
  // about the surface it sits on. A background over it is not a second
  // opinion — it is a box the author drew.
  assertEquals(override("h1", "bg-surface"), []);
});

Deno.test("the primitives' own variants are not reported", () => {
  // A variant is how the primitive is told to change; a class that is one
  // of them is the sanctioned way to spend it.
  assertEquals(redundant("button", "secondary"), []);
  assertEquals(override("button", "secondary"), []);
  assertEquals(redundant("button", "ghost bg-primary").length, 1);
});

Deno.test("a class under a state is not compared with the resting value", () => {
  // The theme decides the hover state too, and the element's resting value
  // is not the value the state sees. Comparing the two would be comparing
  // two different things.
  assertEquals(redundant("button", "hover:bg-primary"), []);
  assertEquals(override("button", "hover:bg-primary"), []);
});

Deno.test("the spacing on a typed element is the theme's", () => {
  // A paragraph's gap under it is the theme's rhythm, not the author's
  // layout: `mb-2` says what the theme already says.
  const [finding] = redundant("p", "mb-2");
  assertEquals(finding?.messageId, "redundant");
  assertEquals(finding?.data["properties"], "margin-bottom");
});

Deno.test("a spacing class that differs from the theme's is an override", () => {
  // The theme's rhythm under a paragraph is one step; `mb-4` is another.
  const [finding] = override("p", "mb-4");
  assertEquals(finding?.messageId, "override");
  assertEquals(finding?.data["decision"], "spacing");
});

Deno.test("the spacing on an element the theme does not type is free", () => {
  // A div is the author's box, and the space around it is the author's.
  assertEquals(redundant("div", "mb-2"), []);
  assertEquals(override("div", "mb-2"), []);
});

Deno.test("the strictness dial chooses which tiers count", () => {
  // `balanced` reads a type size as a decision about content rather than
  // about the element's own look, and leaves it to the author.
  const balanced: SemanticOptions = {
    strictness: "balanced",
    semanticTags: "all",
  };
  assertEquals(redundant("h1", "text-sm", balanced), []);
  assertEquals(override("h1", "text-sm", balanced), []);
  assertEquals(override("button", "bg-surface-raised", balanced).length, 1);
});

Deno.test("the semantic tags dial chooses which elements count", () => {
  // A project that writes native elements leaves spin's own elements free,
  // and the other way round.
  const native: SemanticOptions = {
    strictness: "strict",
    semanticTags: "native",
  };
  const spin: SemanticOptions = {
    strictness: "strict",
    semanticTags: "spin",
  };
  assertEquals(override("card", "bg-surface", native), []);
  assertEquals(override("card", "bg-surface", spin).length, 1);
  assertEquals(override("button", "bg-surface-raised", native).length, 1);
  assertEquals(override("button", "bg-surface-raised", spin), []);
});

Deno.test("a paragraph outside a document column is the author's", () => {
  // The document surface paints the column it owns. A paragraph anywhere
  // else is not painted by it, so a utility on one is the author's call —
  // which is the whole difference between painting inside a scope and
  // painting by tag.
  assertEquals(
    override("p", "text-sm bg-primary text-text-muted"),
    [],
  );
});

Deno.test("an element inside a document column is the column's", () => {
  // The same element, inside the prose column: the document surface owns
  // it there, and a utility over the document's own treatment is a second
  // opinion.
  const column: AncestorFacts[] = [{ tag: "prose", classes: [] }];
  const findings = override(
    "blockquote",
    "text-text",
    undefined,
    column,
  );
  assertEquals(findings.map((finding) => finding.data["cls"]), [
    "text-text",
  ]);
});

Deno.test("an element inside a column that does not own it is free", () => {
  // The chain is what says where the element sits: a quotation inside an
  // ordinary box is not inside a document column.
  const column: AncestorFacts[] = [{ tag: "div", classes: [] }];
  assertEquals(
    override("blockquote", "text-text", undefined, column),
    [],
  );
});

Deno.test("an element a primitive only lays out is not painted", () => {
  // The button joins a group of controls in a `span`. The group container
  // is laid out, not painted: nothing decides how it looks, so a utility on
  // it is the author's.
  assertEquals(override("span", "rounded-sm border text-text-muted"), []);
});

Deno.test("a class that reaches for another element's decision names it", () => {
  // The theme gave the level-one size to the heading; a span carrying that
  // size is the markup reaching for what the theme answered elsewhere.
  const [finding] = other("span", "text-3xl");
  assertEquals(finding?.messageId, "element");
  assertEquals(finding?.data, {
    tag: "span",
    cls: "text-3xl",
    element: "h1",
    decision: "size",
  });
});

Deno.test("an element that owns the decision is not another element's", () => {
  // The heading owns its size, so a class over it is a second opinion
  // about the theme's own value — the theme-value rule's business, not the
  // element rule's.
  assertEquals(other("h3", "text-sm"), []);
});

Deno.test("a decision the theme gave to several elements names none", () => {
  // The theme offers more than one element at that size, and which one the
  // author meant is a question the lint cannot answer. It says nothing
  // rather than point at the wrong element.
  assertEquals(other("span", "text-sm"), []);
});

Deno.test("the plugin reads the dial from the linter's context", () => {
  // The option travels through the plugin API the way a linter delivers
  // it: as the rule's first option.
  const rule = plugin.rules["prefer-theme-value"];
  const seen: { messageId: string; data?: Record<string, string> }[] = [];
  const visit = rule.create({
    options: [{ strictness: "balanced" }],
    report(descriptor) {
      seen.push({
        messageId: descriptor.messageId,
        data: descriptor.data,
      });
    },
  }).JSXAttribute;
  visit?.({
    type: "JSXAttribute",
    name: { name: "class" },
    value: { value: "text-sm bg-surface-raised" },
    parent: { type: "JSXOpeningElement", name: { name: "button" } },
  });
  assertEquals(seen.map((report) => report.data?.["cls"]), [
    "bg-surface-raised",
  ]);
});

Deno.test("the plugin's rules carry a schema for their options", () => {
  // A linter validates the options against the schema before the rule
  // runs, so the schema is the rule's public contract.
  for (
    const name of ["no-redundant-class", "prefer-theme-value", "prefer-element"]
  ) {
    const rule = plugin.rules[name as keyof typeof plugin.rules];
    assertEquals(rule.meta.schema.length, 1);
  }
});

Deno.test("the rules that drop a class say they can", () => {
  // A linter that is told a rule fixes nothing will not apply the edits it
  // is given, so the flag travels with the rule.
  assertEquals(plugin.rules["no-redundant-class"].meta.fixable, "code");
  assertEquals(plugin.rules["closed-vocabulary"].meta.fixable, "code");
  assertEquals(plugin.rules["prefer-theme-value"].meta.fixable, undefined);
  assertEquals(plugin.rules["prefer-element"].meta.fixable, undefined);
});
