import { assertEquals } from "@std/assert";
import { starterThemes } from "@spin/theme/themes";
import {
  type AncestorFacts,
  checkNoUtilitiesOnSemantic,
  type ClassFacts,
  type Facts,
  type SemanticOptions,
} from "../src/core.ts";
import { factsFor } from "../src/facts.ts";
import plugin from "../src/index.ts";

/**
 * What a utility does to an element decides whether it is reported.
 *
 * A utility on a raw element is fine. A utility that paints over an
 * element's own decision is not. A layout utility is neither: where a box
 * sits is the author's call, and the rule stays out of it.
 *
 * And the decision belongs to the element, not to a list of tags: a primitive
 * paints inside its own scope, so whether a utility is a second opinion
 * depends on where the element sits and on which decision the primitive
 * actually makes about it.
 */

const facts: Facts = factsFor(Object.values(starterThemes));

/** The classes of an element, as the core reads them. */
function element(
  tag: string,
  classes: string,
  ancestors: readonly AncestorFacts[] = [],
): ClassFacts {
  return {
    tag,
    classes: classes.split(/\s+/).filter(Boolean),
    ancestors,
    position: { line: 1, column: 1 },
  };
}

/** What the rule reports for one element. */
function reported(
  tag: string,
  classes: string,
  options?: SemanticOptions,
  ancestors: readonly AncestorFacts[] = [],
) {
  return checkNoUtilitiesOnSemantic(
    facts,
    element(tag, classes, ancestors),
    options,
  );
}

Deno.test("a layout utility is free on an element that paints", () => {
  // Where the box sits and how big it is: the author's call, and the
  // primitive's decision about how it looks does not reach it.
  assertEquals(
    reported("button", "flex w-full gap-2 p-4 items-center justify-between"),
    [],
  );
});

Deno.test("a utility on a raw element is free", () => {
  // Nothing paints a `div`, so nothing decides how it looks.
  assertEquals(reported("div", "bg-primary text-text-muted rounded-md"), []);
});

Deno.test("a skin utility on an element that paints is reported", () => {
  // The button sets its own fill. A background over it is a second opinion.
  const [finding] = reported("button", "bg-primary");
  assertEquals(finding?.messageId, "utility");
  assertEquals(finding?.data, {
    tag: "button",
    cls: "bg-primary",
    decision: "fill",
  });
});

Deno.test("a type size on an element that paints is reported", () => {
  // The heading sets the scale its text is read in.
  const [finding] = reported("h1", "text-sm");
  assertEquals(finding?.messageId, "utility");
  assertEquals(finding?.data, {
    tag: "h1",
    cls: "text-sm",
    decision: "type scale",
  });
});

Deno.test("a utility over a decision the element does not own is free", () => {
  // The heading owns the scale and the weight of its text; it says nothing
  // about the surface it sits on. A background over it is not a second
  // opinion — it is a box the author drew.
  assertEquals(reported("h1", "bg-surface"), []);
});

Deno.test("the primitives' own variants are not reported", () => {
  // A variant is how the primitive is told to change; a class that is one
  // of them is the sanctioned way to spend it.
  assertEquals(reported("button", "secondary"), []);
  assertEquals(reported("button", "ghost bg-primary").length, 1);
});

Deno.test("a variant under a state is the primitive's own too", () => {
  assertEquals(reported("button", "hover:secondary"), []);
});

Deno.test("the strictness dial chooses which tiers count", () => {
  // `balanced` reads a type size as a decision about content rather than
  // about the element's own look, and leaves it to the author.
  const balanced: SemanticOptions = {
    strictness: "balanced",
    semanticTags: "all",
  };
  assertEquals(reported("h1", "text-sm", balanced), []);
  assertEquals(reported("button", "bg-primary", balanced).length, 1);
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
  assertEquals(reported("card", "bg-surface", native), []);
  assertEquals(reported("card", "bg-surface", spin).length, 1);
  assertEquals(reported("button", "bg-primary", native).length, 1);
  assertEquals(reported("button", "bg-primary", spin), []);
});

Deno.test("a paragraph outside a document column is the author's", () => {
  // The document surface paints the column it owns. A paragraph anywhere
  // else is not painted by it, so a utility on one is the author's call —
  // which is the whole difference between painting inside a scope and
  // painting by tag.
  assertEquals(reported("p", "text-sm bg-primary text-text-muted"), []);
});

Deno.test("an element inside a document column is the column's", () => {
  // The same element, inside the prose column: the document surface owns
  // it there, and a utility over the document's own treatment is a second
  // opinion.
  const column: AncestorFacts[] = [{ tag: "prose", classes: [] }];
  const findings = reported("blockquote", "text-text-muted", undefined, column);
  assertEquals(findings.map((finding) => finding.data["cls"]), [
    "text-text-muted",
  ]);
});

Deno.test("an element inside a column that does not own it is free", () => {
  // The chain is what says where the element sits: a quotation inside an
  // ordinary box is not inside a document column.
  const column: AncestorFacts[] = [{ tag: "div", classes: [] }];
  assertEquals(
    reported("blockquote", "text-text-muted", undefined, column),
    [],
  );
});

Deno.test("an element a primitive only lays out is not painted", () => {
  // The button joins a group of controls in a `span`. The group container
  // is laid out, not painted: nothing decides how it looks, so a utility on
  // it is the author's.
  assertEquals(reported("span", "rounded-sm border text-text-muted"), []);
});

Deno.test("the plugin reads the dial from the linter's context", () => {
  // The option travels through the plugin API the way a linter delivers it:
  // as the rule's first option.
  const rule = plugin.rules["no-utilities-on-semantic"];
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
  assertEquals(seen.map((report) => report.data?.["cls"]), ["bg-primary"]);
});

Deno.test("the plugin's rules carry a schema for their options", () => {
  // A linter validates the options against the schema before the rule
  // runs, so the schema is the rule's public contract.
  const rule = plugin.rules["no-utilities-on-semantic"];
  assertEquals(rule.meta.schema.length, 1);
});
