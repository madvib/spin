/**
 * The house skill: the theme module's manual, and how it is put together.
 *
 * The skill is a product. An agent installs the file and follows it, so it
 * has to say what the contract says today — which is why it lives here, beside
 * the code that defines the contract, and why its checklist is not written by
 * hand. `skill/SKILL.md` carries the method and the guidance for each group;
 * the list of groups it walks is emitted by the module, so a group added to
 * the contract appears in the file without anyone editing prose.
 *
 * The file on disk is therefore a template, and `renderSkill` assembles it:
 * the groups in the order a theme document reads them, each carrying the
 * guidance the template has for it. The served file and the contract cannot
 * disagree, because the list in the file is the contract's list.
 */

import { starterGroups } from "@spinjs/theme/themes";

/** The heading the checklist lives under. */
const CHECKLIST = "## The checklist";

/**
 * What a group the contract knows but the file does not describe gets.
 *
 * The group is in the list because the contract put it there, so it is in the
 * file; what it is for is a judgement nobody has written down yet, and the
 * file says so rather than inventing one.
 */
const UNDESCRIBED =
  "**For.** The contract knows this group; nothing here says what it is for yet.";

/**
 * The skill, assembled from the template and the contract.
 *
 * Everything outside the checklist is the template's own text, untouched. The
 * checklist is rebuilt: its groups are the ones the module emits, in the
 * order it emits them, each with the guidance the template carries for it.
 */
export function renderSkill(template: string): string {
  const lines = template.split("\n");
  const start = lines.findIndex((line) => line.trim() === CHECKLIST);
  if (start === -1) return template;
  const end = sectionEnd(lines, start);
  const section = lines.slice(start, end);
  const firstGroup = section.findIndex((line) => line.startsWith("### "));
  const intro = trimBlanks(
    firstGroup === -1 ? section : section.slice(0, firstGroup),
  );
  const guidance = guidanceOf(
    firstGroup === -1 ? [] : section.slice(firstGroup),
  );
  const checklist: string[] = [...intro, ""];
  for (const group of starterGroups()) {
    checklist.push(`### ${group}`, "");
    checklist.push(...trimBlanks(guidance.get(group) ?? [UNDESCRIBED]));
    checklist.push("");
  }
  return [...lines.slice(0, start), ...checklist, ...lines.slice(end)].join(
    "\n",
  );
}

/** The line the section after the checklist starts on. */
function sectionEnd(lines: readonly string[], start: number): number {
  for (let at = start + 1; at < lines.length; at++) {
    if (lines[at]?.startsWith("## ")) return at;
  }
  return lines.length;
}

/** The guidance each group carries, read from the checklist's own sections. */
function guidanceOf(lines: readonly string[]): Map<string, readonly string[]> {
  const guidance = new Map<string, string[]>();
  let name = "";
  let body: string[] = [];
  for (const line of lines) {
    if (line.startsWith("### ")) {
      if (name !== "") guidance.set(name, body);
      name = line.slice(4).trim();
      body = [];
      continue;
    }
    body.push(line);
  }
  if (name !== "") guidance.set(name, body);
  return guidance;
}

/** The lines without the blank ones at either end. */
function trimBlanks(lines: readonly string[]): readonly string[] {
  let first = 0;
  let last = lines.length;
  while (first < last && (lines[first] ?? "").trim() === "") first++;
  while (last > first && (lines[last - 1] ?? "").trim() === "") last--;
  return lines.slice(first, last);
}
