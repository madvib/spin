import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "bun:test";
import assert, { deepStrictEqual } from "node:assert/strict";
import { renderSkill } from "./index.ts";
import { starterGroups } from "../themes/index.ts";
import { GATES } from "../contract/battery.ts";

/**
 * The skill is the theme module's manual, and the file an agent installs is
 * assembled from the contract: the groups it walks are the groups a theme
 * declares, and the guidance for each of them is the guidance the file
 * carries. These tests hold the assembly to that.
 */

/** The skill as it sits in the package: the method, and the guidance. */
const TEMPLATE = new URL("../../skill/SKILL.md", import.meta.url);

/** The headings under the checklist, in the order the file carries them. */
function checklistGroups(text: string): readonly string[] {
  const groups: string[] = [];
  let inChecklist = false;
  for (const line of text.split("\n")) {
    if (line.startsWith("## ")) {
      inChecklist = line.slice(3).trim() === "The checklist";
      continue;
    }
    if (!inChecklist || !line.startsWith("### ")) continue;
    groups.push(line.slice(4).trim());
  }
  return groups;
}

test("the skill walks exactly the groups the module emits", async () => {
  const template = await readFile(TEMPLATE, "utf8");
  const groups = checklistGroups(renderSkill(template));
  assert(groups.length > 0, "the skill carries a checklist");
  deepStrictEqual(groups, [...starterGroups()]);
});

test("the guidance the file carries survives the assembly", async () => {
  const template = await readFile(TEMPLATE, "utf8");
  const rendered = renderSkill(template);
  assert(
    rendered.includes("The structure of the palette"),
    "the colour group's guidance is missing from the skill",
  );
  assert(
    rendered.includes("The rule under a link in prose"),
    "the link group's guidance is missing from the skill",
  );
});

test("a group the file does not describe still appears in the skill", () => {
  const template = "## The checklist\n\n### color\n\n**For.** The palette.\n";
  const rendered = renderSkill(template);
  for (const group of starterGroups()) {
    assert(
      rendered.includes(`### ${group}`),
      `the skill does not walk the ${group} group`,
    );
  }
});

test("everything outside the checklist is the file's own text", () => {
  const template = [
    "# The house skill",
    "",
    "## The checklist",
    "",
    "### color",
    "",
    "**For.** The palette.",
    "",
    "## The gates",
    "",
    "One gate, and it is mechanical.",
    "",
  ].join("\n");
  const rendered = renderSkill(template);
  assert(
    rendered.startsWith("# The house skill"),
    "the file's own head is gone",
  );
  assert(rendered.includes("## The gates"), "the file's own section is gone");
  assert(
    rendered.includes("One gate, and it is mechanical."),
    "the file's own text is gone",
  );
});

test("the skill's gate list is the battery's gate list", async () => {
  // The gates an author runs are the battery's gates, and the battery is the
  // one that answers. A gate the skill does not name is a gate nobody runs,
  // and a gate the skill names that the battery does not have is a gate that
  // cannot fail — which is worse, because it reads as a check that passed.
  const template = await readFile(TEMPLATE, "utf8");
  const rendered = renderSkill(template);
  const gates = rendered.slice(rendered.indexOf("## The gates"));
  for (const gate of GATES) {
    assert(
      gates.includes(gate),
      `the skill's gates do not name the ${gate} gate`,
    );
  }
  assert(
    gates.includes("themeGates"),
    "the skill does not name the battery's entry point",
  );
});

test("the skill names the option that judges a document in a mode", async () => {
  // `mode` is the option that measures legibility in a mode, and an author
  // who does not know it runs the validator once and believes the dark mode
  // is checked.
  const template = await readFile(TEMPLATE, "utf8");
  const rendered = renderSkill(template);
  assert(
    rendered.includes("{ required, modes, mode }"),
    "the skill does not name the `mode` option",
  );
});
