import { test } from "bun:test";
import { deepStrictEqual } from "node:assert/strict";
import type { AncestorFacts, SemanticOptions } from "../../src/diagnostics/core.ts";
import { element, facts, other, override, redundant } from "./semantic-helpers.ts";
import plugin from "../../src/diagnostics/index.ts";
import { renderMessage, RULES } from "../../src/diagnostics/rules.ts";

/** The override rule's own words, as a message is rendered. */
const OVERRIDE = RULES["prefer-theme-value"].meta;

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

test("an override is an error and the single owner is an error", () => {
  // The stance: a one-off override of a decision the system made is banned —
  // and so is a class that reaches for a decision exactly one element
  // carries for the text's own shape. The rule stays a suggestion at the
  // rule level (several owners stay advisory); the single-owner error
  // travels on the finding, where the deliveries read it.
  deepStrictEqual(plugin.rules["prefer-theme-value"].meta.type, "problem");
  deepStrictEqual(plugin.rules["prefer-element"].meta.type, "suggestion");
  const [finding] = other("span", "text-3xl");
  deepStrictEqual(finding?.messageId, "error");
  deepStrictEqual(finding?.severity, "error");
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
  // layout: `mb-4` says what the theme already says.
  const [finding] = redundant("p", "mb-4");
  deepStrictEqual(finding?.messageId, "redundant");
  deepStrictEqual(finding?.data["properties"], "margin-bottom");
});

test("a spacing class that differs from the theme's is an override", () => {
  // The theme's rhythm under a paragraph is one step; `mb-2` is another.
  const [finding] = override("p", "mb-2");
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

test("a paragraph states the type it renders", () => {
  // The paragraph states the body's face, size and weight, so a class that
  // says otherwise is a second opinion the theme-value rule reports: the
  // size, the face, the weight — and the message names the theme's decision.
  const [size] = override("p", "text-lg");
  deepStrictEqual(size?.messageId, "override");
  deepStrictEqual(size?.data["family"], "typography");
  deepStrictEqual(size?.data["claim"], "the theme sets the size of `<p>`");
  const [face] = override("p", "font-mono");
  deepStrictEqual(face?.messageId, "override");
  deepStrictEqual(face?.data["claim"], "the theme sets the typeface of `<p>`");
  const [weight] = override("p", "font-semibold");
  deepStrictEqual(weight?.messageId, "override");
  deepStrictEqual(weight?.data["claim"], "the theme sets the weight of `<p>`");
  // A paragraph wearing `bare` has opted out of its primitive's paint: a
  // utility there is the author's own decision, not a fight with the theme.
  deepStrictEqual(override("p", "bare text-lg"), []);
});

test("a list states the type its rows read in", () => {
  // The list states the body's face, size and weight, so overrides fire on
  // the list and on its items — and the same class that matches the stated
  // value is dead weight the redundancy rule drops.
  for (const tag of ["ul", "ol", "li"]) {
    const [finding] = override(tag, "text-lg");
    deepStrictEqual(finding?.messageId, "override");
    deepStrictEqual(finding?.data["family"], "typography");
    deepStrictEqual(
      finding?.data["claim"],
      `the theme sets the size of \`<${tag}>\``,
    );
  }
  const [face] = override("ul", "font-mono");
  deepStrictEqual(face?.messageId, "override");
  deepStrictEqual(
    face?.data["claim"],
    "the theme sets the typeface of `<ul>`",
  );
  const [dead] = redundant("p", "text-md");
  deepStrictEqual(dead?.messageId, "redundant");
  deepStrictEqual(dead?.data, {
    tag: "p",
    cls: "text-md",
    properties: "font-size",
  });
  deepStrictEqual(override("li", "flex gap-2"), []);
});

test("an element inside a document column is the column's", () => {
  // The same element, inside the prose column: the document surface owns
  // the muted ink of the quotation's treatment there, so a class that says
  // otherwise is a second opinion about the column's ink.
  const column: AncestorFacts[] = [{ tag: "prose", classes: [] }];
  const [finding] = override("blockquote", "text-link", undefined, column);
  deepStrictEqual(finding?.messageId, "override");
  deepStrictEqual(finding?.data["family"], "skin");
  deepStrictEqual(finding?.data["cls"], "text-link");
  // The muted ink the column states is what the element already says, so
  // naming it changes nothing: the redundancy rule reports it instead.
  const [dead] = redundant("blockquote", "text-text-muted", undefined, column);
  deepStrictEqual(dead?.messageId, "redundant");
  deepStrictEqual(dead?.data["properties"], "color");
});

test("an element inside a column that does not own it is free", () => {
  // The chain is what says where the element sits: a quotation inside an
  // ordinary box is not inside a document column.
  const column: AncestorFacts[] = [{ tag: "div", classes: [] }];
  deepStrictEqual(
    override("blockquote", "text-text-muted", undefined, column),
    [],
  );
});

test("an element a primitive only lays out is not painted", () => {
  // The button joins a group of controls in a `span`. The group container
  // is laid out, not painted: nothing decides how it looks, so a utility on
  // it is the author's.
  deepStrictEqual(override("span", "rounded-sm border text-text-muted"), []);
});

