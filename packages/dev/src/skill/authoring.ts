/**
  * The authoring skill's style list, emitted from the languages' style set.
 */

import { designLanguages, type ThemeDocument } from "@spinjs/theme";

/** The heading the style list lives under. */
const CHECKLIST = "## The styles";

/**
 * What a style the theme declares but the file does not describe gets.
 */
const UNDESCRIBED =
  "**For.** The theme declares this style; nothing here says what it is for yet.";

/**
  * The styles the languages declare, in the order the documents read them.
 */
export function authoringStyles(): readonly string[] {
  const styles: string[] = [];
  const seen = new Set<string>();
  for (const document of Object.values(designLanguages)) {
    for (const name of documentStyles(document)) {
      if (seen.has(name)) continue;
      seen.add(name);
      styles.push(name);
    }
  }
  return styles;
}

/** The style names one theme document declares under `font.style`. */
function documentStyles(document: ThemeDocument): readonly string[] {
  const font = document["font"];
  if (typeof font !== "object" || font === null) return [];
  const style = (font as Record<string, unknown>)["style"];
  if (typeof style !== "object" || style === null) return [];
  return Object.keys(style);
}

/**
  * The skill, assembled from the template and the languages.
 */
export function renderAuthoringSkill(template: string): string {
  const lines = template.split("\n");
  const start = lines.findIndex((line) => line.trim() === CHECKLIST);
  if (start === -1) return template;
  const end = sectionEnd(lines, start);
  const section = lines.slice(start, end);
  const firstStyle = section.findIndex((line) => line.startsWith("### "));
  const intro = trimBlanks(
    firstStyle === -1 ? section : section.slice(0, firstStyle),
  );
  const guidance = guidanceOf(
    firstStyle === -1 ? [] : section.slice(firstStyle),
  );
  const checklist: string[] = [...intro, ""];
  for (const name of authoringStyles()) {
    checklist.push(`### type-${name}`, "");
    checklist.push(...trimBlanks(guidance.get(`type-${name}`) ?? [UNDESCRIBED]));
    checklist.push("");
  }
  return [...lines.slice(0, start), ...checklist, ...lines.slice(end)].join(
    "\n",
  );
}

/** The line the section after the style list starts on. */
function sectionEnd(lines: readonly string[], start: number): number {
  for (let at = start + 1; at < lines.length; at++) {
    if (lines[at]?.startsWith("## ")) return at;
  }
  return lines.length;
}

/** The guidance each style carries, read from the list's own sections. */
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
