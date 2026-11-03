import { test } from "bun:test";
import { deepStrictEqual } from "node:assert/strict";
import { starterThemes } from "../../src/theme/themes/index.ts";
import {
  type AncestorFacts,
  checkNoRedundantClass,
  checkPreferElement,
  checkPreferThemeValue,
  type ClassFacts,
  DEFAULT_SEMANTIC_OPTIONS,
  type Facts,
  type SemanticOptions,
} from "../../src/diagnostics/core.ts";
import { factsFor } from "../../src/diagnostics/facts.ts";
import plugin from "../../src/diagnostics/index.ts";
import { renderMessage, RULES } from "../../src/diagnostics/rules.ts";

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

/** The override rule's own words, as a message is rendered. */
const OVERRIDE = RULES["prefer-theme-value"].meta;

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

test("a class that says what the element says is dead weight", () => {
  // The heading's own size is the theme's ladder step, and `text-xl` is
  // that same step. The class changes nothing.
  const [finding] = redundant("h3", "text-xl");
  deepStrictEqual(finding?.messageId, "redundant");
  deepStrictEqual(finding?.data, {
    tag: "h3",
    cls: "text-xl",
    properties: "font-size",
  });
});

test("a dead weight class carries the edit that drops it", () => {
  // The class is dead weight, so dropping it is the whole of the fix — and
  // the fix is part of the finding, so every front end can apply it.
  const [finding] = redundant("code", "font-mono");
  deepStrictEqual(finding?.fix, { range: [0, 10], text: "" });
});

test("a class that says something else overrides the theme", () => {
  // The heading takes its size from the theme's ladder; `text-sm` is a
  // different step, and a second opinion about the ladder.
  const [finding] = override("h3", "text-sm");
  deepStrictEqual(finding?.messageId, "override");
  deepStrictEqual(finding?.data, {
    tag: "h3",
    cls: "text-sm",
    family: "typography",
    claim: "the theme sets the size of `<h3>`",
    remedy: "Use the theme's value.",
  });
  deepStrictEqual(finding?.fix, undefined);
});

test("the typography family says the theme sets the text", () => {
  // The theme states the scale, so the heading's size is the theme's — and
  // the message says so, and says what to write instead. No hedging: a
  // second opinion about the ladder is not a question.
  const [finding] = override("h3", "text-sm");
  deepStrictEqual(
    renderMessage(OVERRIDE, finding!),
    "the theme sets the size of `<h3>`; `text-sm` fights it. Use the theme's value.",
  );
});

test("the skin family says the element sets its own look", () => {
  // The button paints itself, so its fill is its own; the way out is the
  // variant the button declares — the icon slot is a class on a child, so
  // it is not one of them.
  const [finding] = override("button", "bg-surface");
  deepStrictEqual(
    renderMessage(OVERRIDE, finding!),
    "`<button>` sets its own fill; `bg-surface` fights it. " +
      "Use a variant (`bare`, `contrast`, …) or the theme's value.",
  );
});

test("the spacing family says the theme owns the rhythm", () => {
  // The space between blocks is the theme's wherever the theme types the
  // element, and the class fights it.
  const [finding] = override("p", "mt-6");
  deepStrictEqual(
    renderMessage(OVERRIDE, finding!),
    "the theme owns the space between blocks; `mt-6` fights it. " +
      "Use the theme's value.",
  );
});

test("a painted descendant is offered the theme's value, not a variant", () => {
  // The card's variants belong to the card; the title the card paints is
  // not the card, so there is no variant to offer it. The card is spin's own
  // element, so it is read with the `spin` dial.
  const [finding] = override("card-title", "text-text-muted", SPIN);
  deepStrictEqual(finding?.data["family"], "skin");
  deepStrictEqual(finding?.data["remedy"], "Use the theme's value.");
});

/**
 * Spin's own elements are not the browser's, so a project reads them with the
 * `spin` dial — the primitives' claimed non-native tags.
 */
const SPIN: SemanticOptions = {
  strictness: "strict",
  semanticTags: "spin",
};

test("an override is an error and the wrong element is advisory", () => {
  // The stance: a one-off override of a decision the system made is banned,
  // and the wrong element cannot be banned — a span inside a heading may be
  // deliberate.
  deepStrictEqual(plugin.rules["prefer-theme-value"].meta.type, "problem");
  deepStrictEqual(plugin.rules["prefer-element"].meta.type, "suggestion");
});

test("a class that changes nothing is not an override", () => {
  // The rule that says "the theme already said this" is the redundancy
  // rule's business: one class, one finding.
  deepStrictEqual(override("h3", "text-xl"), []);
});

test("a layout utility is free on an element that paints", () => {
  // Where the box sits and how big it is: the author's call, and the
  // primitive's decision about how it looks does not reach it.
  deepStrictEqual(override("button", "flex w-full gap-2 items-center"), []);
});

test("a utility on a raw element is free", () => {
  // Nothing paints a `div`, so nothing decides how it looks.
  deepStrictEqual(override("div", "bg-primary text-text-muted rounded-md"), []);
});

test("a utility over a decision the element does not own is free", () => {
  // The heading owns the scale and the weight of its text; it says nothing
  // about the surface it sits on. A background over it is not a second
  // opinion — it is a box the author drew.
  deepStrictEqual(override("h1", "bg-surface"), []);
});

test("the primitives' own variants are not reported", () => {
  // A variant is how the primitive is told to change; a class that is one
  // of them is the sanctioned way to spend it.
  deepStrictEqual(redundant("button", "secondary"), []);
  deepStrictEqual(override("button", "secondary"), []);
  // And what the variant claimed is not the base's: the ghost button has no
  // fill, so a class that puts one back is not dead weight and not a fight.
  deepStrictEqual(redundant("button", "ghost bg-primary"), []);
  deepStrictEqual(override("button", "ghost bg-primary"), []);
});

test("a class under a state is not compared with the resting value", () => {
  // The theme decides the hover state too, and the element's resting value
  // is not the value the state sees. Comparing the two would be comparing
  // two different things.
  deepStrictEqual(redundant("button", "hover:bg-primary"), []);
  deepStrictEqual(override("button", "hover:bg-primary"), []);
});

test("the spacing on a typed element is the theme's", () => {
  // A paragraph's gap under it is the theme's rhythm, not the author's
  // layout: `mb-2` says what the theme already says.
  const [finding] = redundant("p", "mb-2");
  deepStrictEqual(finding?.messageId, "redundant");
  deepStrictEqual(finding?.data["properties"], "margin-bottom");
});

test("a spacing class that differs from the theme's is an override", () => {
  // The theme's rhythm under a paragraph is one step; `mb-4` is another.
  const [finding] = override("p", "mb-4");
  deepStrictEqual(finding?.messageId, "override");
  deepStrictEqual(finding?.data["family"], "spacing");
  deepStrictEqual(
    finding?.data["claim"],
    "the theme owns the space between blocks",
  );
  deepStrictEqual(finding?.data["remedy"], "Use the theme's value.");
});

test("the spacing on an element the theme does not type is free", () => {
  // A div is the author's box, and the space around it is the author's.
  deepStrictEqual(redundant("div", "mb-2"), []);
  deepStrictEqual(override("div", "mb-2"), []);
});

test("the strictness dial chooses which tiers count", () => {
  // `balanced` reads a type size as a decision about content rather than
  // about the element's own look, and leaves it to the author.
  const balanced: SemanticOptions = {
    strictness: "balanced",
    semanticTags: "all",
  };
  deepStrictEqual(redundant("h1", "text-sm", balanced), []);
  deepStrictEqual(override("h1", "text-sm", balanced), []);
  deepStrictEqual(override("button", "bg-primary", balanced).length, 1);
});

test("the semantic tags dial chooses which elements count", () => {
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
  deepStrictEqual(override("card", "bg-surface", native), []);
  deepStrictEqual(override("card", "bg-surface", spin).length, 1);
  deepStrictEqual(override("button", "bg-primary", native).length, 1);
  deepStrictEqual(override("button", "bg-primary", spin), []);
});

test("a component's tag is not the browser's, and the default says so", () => {
  // The lint reads markup and cannot know what a component renders, so the
  // default does not reason about a component's tag: a capitalised tag is
  // neither an element HTML defines nor one of spin's own.
  deepStrictEqual(other("A", "text-link"), []);
  // A project that knows its own components reads them with the `spin` dial.
  const spin: SemanticOptions = {
    strictness: "strict",
    semanticTags: "spin",
  };
  deepStrictEqual(other("A", "text-link", spin), []);
  // And the `all` dial is the one that speaks about everything.
  const all: SemanticOptions = {
    strictness: "strict",
    semanticTags: "all",
  };
  deepStrictEqual(other("A", "text-link", all).length, 1);
});

test("the default speaks about the browser's elements only", () => {
  // The dial's default is `native`: a tag the browser does not own is a
  // component, and the lint knows nothing about what a component renders.
  deepStrictEqual(DEFAULT_SEMANTIC_OPTIONS.semanticTags, "native");
  deepStrictEqual(override("card", "bg-surface"), []);
  deepStrictEqual(override("button", "bg-primary").length, 1);
});

test("the decoration family is not the element rule's business", () => {
  // A control's `text-decoration: none` is a reset, not a themed answer, and
  // "the element already says that" is the redundancy rule's business — it
  // says it correctly. A tag-based push is not advice either.
  const all: SemanticOptions = {
    strictness: "strict",
    semanticTags: "all",
  };
  deepStrictEqual(other("A", "no-underline", all), []);
  deepStrictEqual(other("span", "underline", all), []);
  // The redundancy rule still says it: the class sets what the element sets.
  const [finding] = redundant("button", "no-underline", all);
  deepStrictEqual(finding?.messageId, "redundant");
});

test("a control's spacing is answered by its size variant", () => {
  // The space inside a control is the size of that control, and the theme's
  // answer to the size is a variant — so the remedy names it.
  const [control] = override("button", "px-3");
  deepStrictEqual(
    control?.data["remedy"],
    "Use a variant (`s-lg`, `s-sm`) or the theme's value.",
  );
  // A block is not a control: the theme's spacing step is the answer there.
  const [block] = override("p", "mt-6");
  deepStrictEqual(block?.data["remedy"], "Use the theme's value.");
});

test("a paragraph outside a document column is the author's", () => {
  // The document surface paints the column it owns. A paragraph anywhere
  // else is not painted by it, so a utility on one is the author's call —
  // which is the whole difference between painting inside a scope and
  // painting by tag.
  deepStrictEqual(
    override("p", "text-sm bg-primary text-text-muted"),
    [],
  );
});

test("an element inside a document column is the column's", () => {
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
  deepStrictEqual(findings.map((finding) => finding.data["cls"]), [
    "text-text",
  ]);
});

test("an element inside a column that does not own it is free", () => {
  // The chain is what says where the element sits: a quotation inside an
  // ordinary box is not inside a document column.
  const column: AncestorFacts[] = [{ tag: "div", classes: [] }];
  deepStrictEqual(
    override("blockquote", "text-text", undefined, column),
    [],
  );
});

test("an element a primitive only lays out is not painted", () => {
  // The button joins a group of controls in a `span`. The group container
  // is laid out, not painted: nothing decides how it looks, so a utility on
  // it is the author's.
  deepStrictEqual(override("span", "rounded-sm border text-text-muted"), []);
});

test("a class that reaches for another element's decision names it", () => {
  // The theme gave the level-one size to the heading; a span carrying that
  // size is the markup reaching for what the theme answered elsewhere.
  const [finding] = other("span", "text-3xl");
  deepStrictEqual(finding?.messageId, "element");
  deepStrictEqual(finding?.data, {
    tag: "span",
    cls: "text-3xl",
    element: "h1",
    decision: "size",
  });
});

test("an element that owns the decision is not another element's", () => {
  // The heading owns its size, so a class over it is a second opinion
  // about the theme's own value — the theme-value rule's business, not the
  // element rule's.
  deepStrictEqual(other("h3", "text-sm"), []);
});

test("a decision the theme gave to several elements names none", () => {
  // The theme offers more than one element at that size, and which one the
  // author meant is a question the lint cannot answer. It says nothing
  // rather than point at the wrong element.
  deepStrictEqual(other("span", "text-sm"), []);
});

test("the plugin reads the dial from the linter's context", () => {
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
    value: { value: "text-sm bg-primary" },
    parent: { type: "JSXOpeningElement", name: { name: "button" } },
  });
  deepStrictEqual(seen.map((report) => report.data?.["cls"]), [
    "bg-primary",
  ]);
});

test("the plugin's rules carry a schema for their options", () => {
  // A linter validates the options against the schema before the rule
  // runs, so the schema is the rule's public contract.
  for (
    const name of ["no-redundant-class", "prefer-theme-value", "prefer-element"]
  ) {
    const rule = plugin.rules[name as keyof typeof plugin.rules];
    deepStrictEqual(rule.meta.schema.length, 1);
  }
});

test("the rules that drop a class say they can", () => {
  // A linter that is told a rule fixes nothing will not apply the edits it
  // is given, so the flag travels with the rule.
  deepStrictEqual(plugin.rules["no-redundant-class"].meta.fixable, "code");
  deepStrictEqual(plugin.rules["closed-vocabulary"].meta.fixable, "code");
  deepStrictEqual(plugin.rules["prefer-theme-value"].meta.fixable, undefined);
  deepStrictEqual(plugin.rules["prefer-element"].meta.fixable, undefined);
});
