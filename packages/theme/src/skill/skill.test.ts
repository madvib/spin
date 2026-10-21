import { assert, assertEquals } from "@std/assert";
import { renderSkill } from "./index.ts";
import { starterGroups } from "../themes/index.ts";

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

Deno.test("the skill walks exactly the groups the module emits", async () => {
  const template = await Deno.readTextFile(TEMPLATE);
  const groups = checklistGroups(renderSkill(template));
  assert(groups.length > 0, "the skill carries a checklist");
  assertEquals(groups, [...starterGroups()]);
});

Deno.test("the guidance the file carries survives the assembly", async () => {
  const template = await Deno.readTextFile(TEMPLATE);
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

Deno.test("a group the file does not describe still appears in the skill", () => {
  const template = "## The checklist\n\n### color\n\n**For.** The palette.\n";
  const rendered = renderSkill(template);
  for (const group of starterGroups()) {
    assert(
      rendered.includes(`### ${group}`),
      `the skill does not walk the ${group} group`,
    );
  }
});

Deno.test("everything outside the checklist is the file's own text", () => {
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
