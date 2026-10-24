import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { test } from "bun:test";
import { deepStrictEqual } from "node:assert/strict";
import plugin from "../src/index.ts";
import { type GateNode, renderMessage } from "../src/rules.ts";
import { lint, type LintOptions } from "../src/service.ts";

/**
 * A token written by hand.
 *
 * A custom property is generated output, never an interface. The rule reads
 * the AUTHORED MARKUP of the source — the attributes the document reads as
 * markup — and reports the strings that spend a token by name. The literal
 * and the template are two shapes of the same mistake, and the rule catches
 * the shape a linter hands it.
 *
 * What the rule does NOT read is the rest of the source: a stylesheet a
 * package generates is output, not markup, and a rule that reported it
 * would be reporting the generator rather than the author.
 */

interface Report {
  messageId: string;
  data?: Record<string, string>;
}

/**
 * A node, with the fields a value holds.
 *
 * The rule reads the value positions of an attribute, so the fixture has to
 * be able to say what a value is made of.
 */
interface TestNode extends GateNode {
  readonly expression?: unknown;
  readonly expressions?: readonly unknown[];
  readonly quasis?: readonly {
    readonly value?: { readonly cooked?: unknown };
  }[];
}

/** An attribute, as the rule is handed one. */
function attribute(name: string, value: TestNode): GateNode {
  return { type: "JSXAttribute", name: { name }, value };
}

/** A string, as a value holds one. */
function literal(text: string): TestNode {
  return { type: "Literal", value: text };
}

/** A template, as a value holds one. */
function template(text: string): TestNode {
  return {
    type: "TemplateLiteral",
    quasis: [{ value: { cooked: text } }],
    expressions: [],
  };
}

/** An expression, as an attribute holds one. */
function expression(node: TestNode): TestNode {
  return { type: "JSXExpressionContainer", expression: node };
}

/**
 * The reports one attribute earns, through the rule's own entry point.
 *
 * The attribute is built by hand rather than parsed, so the test says what
 * the rule reads: a name, and the value the name carries.
 */
function reportsFor(node: GateNode): Report[] {
  const rule = plugin.rules["no-handwritten-tokens"];
  const reports: Report[] = [];
  const visit = rule.create({
    report(descriptor) {
      reports.push({ messageId: descriptor.messageId, data: descriptor.data });
    },
  }).JSXAttribute;
  visit?.(node);
  return reports;
}

test("a token written by hand in a class attribute is reported", () => {
  // The mistake the rule exists for: the component names the token instead
  // of reading the theme, so a renamed token leaves it pointing at nothing.
  const [report] = reportsFor(
    attribute("class", literal("bg-primary var(--color-text)")),
  );
  deepStrictEqual(report?.messageId, "handwritten");
  deepStrictEqual(report?.data, {
    token: "color-text",
    group: "color",
    step: "color-text",
    // The path is the token's own name in the theme: the variable is the
    // generator's spelling of it, and the path is what a reader asks for.
    path: "color.text",
  });
});

test("the message names the token, not the variable", () => {
  // The remedy has to be true: the variable is generated output, and the
  // theme's path is what an author spends.
  const rule = plugin.rules["no-handwritten-tokens"];
  const seen: string[] = [];
  const visit = rule.create({
    report(descriptor) {
      seen.push(
        renderMessage(rule.meta, {
          messageId: descriptor.messageId,
          data: descriptor.data ?? {},
          position: { line: 1, column: 1 },
        }),
      );
    },
  }).JSXAttribute;
  visit?.(attribute("class", literal("var(--color-text)")));
  deepStrictEqual(seen, [
    "`var(--color-text)` is generated output, not an API. " +
    "Read the theme's token `color.text`, not its variable.",
  ]);
});

test("a token written by hand in a style attribute is reported", () => {
  // A declaration is markup too: the value reaches the document as the
  // document's own text, and a custom property in it is written by hand.
  const [report] = reportsFor(
    attribute("style", literal("color: var(--color-text)")),
  );
  deepStrictEqual(report?.messageId, "handwritten");
  deepStrictEqual(report?.data?.["token"], "color-text");
});

test("a token written by hand in a template used as markup is reported", () => {
  // The template is the class list the element wears, so the token in it is
  // a token in the document's own text.
  const [report] = reportsFor(
    attribute("class", expression(template("var(--color-text)"))),
  );
  deepStrictEqual(report?.messageId, "handwritten");
  deepStrictEqual(report?.data?.["token"], "color-text");
});

test("a class that spends no token is left alone", () => {
  // Most class lists are words. The rule reads the ones that name a custom
  // property, not the ones that merely sit in the source.
  deepStrictEqual(reportsFor(attribute("class", literal("bg-primary"))), []);
});

test("an attribute that carries data is not markup", () => {
  // A title is a sentence the author wrote, not a decision about how the
  // element looks; reading it as markup would report the author's prose.
  deepStrictEqual(
    reportsFor(attribute("title", literal("var(--color-text)"))),
    [],
  );
});

test("a stylesheet a package emits is not authored markup", async () => {
  // The generator's own output: the theme's CSS, the preset's rules and
  // the animation layer's keyframes all name the custom properties they
  // spend. That is what generated output looks like, and the rule reads
  // markup — so the stylesheet is not what it reports.
  const directory = await mkdtemp(join(tmpdir(), "spin-"));
  try {
    const file = `${directory}/stylesheet.ts`;
    await writeFile(
      file,
      `export const css = \`
body { color: var(--color-text); }
\`;
`,
    );
    const options: LintOptions = {
      semantic: { strictness: "strict", semanticTags: "all" },
      rules: ["no-handwritten-tokens"],
    };
    const { findings } = await lint(file, undefined, options);
    deepStrictEqual(findings, []);
  } finally {
    await rm(directory, { recursive: true });
  }
});
