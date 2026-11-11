import { readFile } from "node:fs/promises";
import { test } from "bun:test";
import assert, { deepStrictEqual } from "node:assert/strict";
import { authoringStyles, renderAuthoringSkill } from "./authoring.ts";
import { designLanguages } from "@spinjs/theme";

/**
  * The skill is the named-type vocabulary's manual, and the file an agent
  * installs is assembled from the languages: the styles it walks are the
 * styles the themes declare, and the guidance for each of them is the
 * guidance the file carries. These tests hold the assembly to that.
 */

/** The skill as it sits in the package: the method, and the guidance. */
const TEMPLATE = new URL("../../skill/spin-type.md", import.meta.url);

/** The style headings under the style list, in the order the file carries them. */
function checklistStyles(text: string): readonly string[] {
  const styles: string[] = [];
  let inChecklist = false;
  for (const line of text.split("\n")) {
    if (line.startsWith("## ")) {
      inChecklist = line.slice(3).trim() === "The styles";
      continue;
    }
    if (!inChecklist || !line.startsWith("### ")) continue;
    styles.push(line.slice(4).trim());
  }
  return styles;
}

/** The styles the languages declare, as the utilities that spend them. */
function expectedStyles(): readonly string[] {
  return [...authoringStyles()].map((name) => `type-${name}`);
}

test("the skill walks exactly the styles the languages declare", async () => {
  const template = await readFile(TEMPLATE, "utf8");
  const styles = checklistStyles(renderAuthoringSkill(template));
  assert(styles.length > 0, "the skill carries a style list");
  deepStrictEqual(styles, expectedStyles());
});

test("the guidance the file carries survives the assembly", async () => {
  const template = await readFile(TEMPLATE, "utf8");
  const rendered = renderAuthoringSkill(template);
  assert(
    rendered.includes("Write `<h1>` and get the page's loudest statement"),
    "the display style's guidance is missing from the skill",
  );
  assert(
    rendered.includes("the reading voice"),
    "the body style's guidance is missing from the skill",
  );
});

test("a style the file does not describe still appears in the skill", () => {
  const template = "## The styles\n\n### type-display\n\n**For.** The hero.\n";
  const rendered = renderAuthoringSkill(template);
  for (const name of authoringStyles()) {
    assert(
      rendered.includes(`### type-${name}`),
      `the skill does not walk the type-${name} style`,
    );
  }
});

test("everything outside the style list is the file's own text", () => {
  const template = [
    "# The authoring skill",
    "",
    "## The styles",
    "",
    "### type-display",
    "",
    "**For.** The hero.",
    "",
    "## The one question",
    "",
    "One question, and it is mechanical.",
    "",
  ].join("\n");
  const rendered = renderAuthoringSkill(template);
  assert(
    rendered.startsWith("# The authoring skill"),
    "the file's own head is gone",
  );
  assert(
    rendered.includes("## The one question"),
    "the file's own section is gone",
  );
  assert(
    rendered.includes("One question, and it is mechanical."),
    "the file's own text is gone",
  );
});

test("the skill's style list is the languages' style list", async () => {
  const template = await readFile(TEMPLATE, "utf8");
  const rendered = renderAuthoringSkill(template);
  const styles = rendered.slice(rendered.indexOf("## The styles"));
  for (const document of Object.values(designLanguages)) {
    const font = document["font"] as Record<string, unknown>;
    const style = font["style"] as Record<string, unknown>;
    for (const name of Object.keys(style)) {
      assert(
        styles.includes(`type-${name}`),
        `the skill's styles do not name type-${name}`,
      );
    }
  }
});

test("the skill names the brand tokens where one-off type belongs", async () => {
  const template = await readFile(TEMPLATE, "utf8");
  const rendered = renderAuthoringSkill(template);
  assert(
    rendered.includes("tokens.json"),
    "the skill does not name the brand `tokens.json` path",
  );
});
