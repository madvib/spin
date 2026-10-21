/**
 * The themes section's reading of the house skill and the style references.
 *
 * The skill is the theme module's manual, so it lives with the module: the
 * file in `packages/theme/skill/` is assembled by the module from its own
 * contract, and the bytes read here are the bytes the site serves and the
 * agent installs. The style references are the site's own — they are design
 * directions rather than part of the language — and they are read the same
 * way, through a raw import, so the page and the file are the same thing.
 *
 * A page that spelled either out by hand would be a second source of truth,
 * and the first group added to the contract would leave the site describing a
 * method that no longer exists.
 */
import { renderSkill } from "@spin/theme/skill";
import template from "../../../packages/theme/skill/SKILL.md?raw";
import darkTech from "../public/skill/spin-theme/styles/dark-tech-cinematic.md?raw";
import editorial from "../public/skill/spin-theme/styles/editorial-minimalism.md?raw";
import agency from "../public/skill/spin-theme/styles/high-end-agency.md?raw";
import brutalism from "../public/skill/spin-theme/styles/industrial-brutalism.md?raw";
import morph from "../public/skill/spin-theme/styles/morphism.md?raw";
import soft from "../public/skill/spin-theme/styles/warm-soft-saas.md?raw";

/** Where the skill is served from, so an agent can install it. */
export const SKILL_DIR = "/skill/spin-theme";

/** The skill file itself. */
export const SKILL_PATH = `${SKILL_DIR}/SKILL.md`;

/**
 * The skill's own text, assembled by the module that owns it.
 *
 * The module builds it from the file in the package and the contract's own
 * group list, so the checklist in the file is the contract's list and not a
 * copy of it that can fall behind.
 */
export const SKILL_TEXT: string = renderSkill(template);

/** The style references, in the order the skill lists them. */
const SOURCES: readonly (readonly [string, string])[] = [
  ["dark-tech-cinematic", darkTech],
  ["editorial-minimalism", editorial],
  ["high-end-agency", agency],
  ["industrial-brutalism", brutalism],
  ["morphism", morph],
  ["warm-soft-saas", soft],
];

/** One style reference: what it is, and the whole of it. */
export interface StyleReference {
  /** The name the file gives the style. */
  readonly name: string;
  /** The word the file uses for the style's direction. */
  readonly slug: string;
  /** The mood, in one line. */
  readonly mood: string;
  /** Who it suits. */
  readonly audience: string;
  /** Where the direction came from. */
  readonly anchor: string;
  /** The reference itself, without its front matter. */
  readonly body: string;
  /** The path the file is served at. */
  readonly href: string;
}

/** A section of a document, read from its headings. */
export interface Section {
  readonly title: string;
  readonly id: string;
}

/**
 * The front matter of a file, and the file without it.
 *
 * The front matter is the small YAML a reference carries: a name, a slug, a
 * mood, an audience and an anchor. A value too long for one line is folded
 * onto the next, and a folded line is a continuation rather than a key, so
 * both are read here.
 */
function frontMatter(
  text: string,
): { readonly data: Record<string, string>; readonly body: string } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text);
  if (match === null) return { data: {}, body: text };
  const data: Record<string, string> = {};
  let key = "";
  for (const line of match[1].split("\n")) {
    const entry = /^\s*([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (entry !== null) {
      key = entry[1];
      data[key] = (entry[2] ?? "").trim();
      continue;
    }
    if (key === "" || line.trim() === "") continue;
    data[key] = `${data[key] ?? ""} ${line.trim()}`.trim();
  }
  return { data, body: text.slice(match[0].length) };
}

/** A name as a path fragment: lower case, and one dash between words. */
function slugOf(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * The order the skill lists the styles in.
 *
 * The skill's own table is the order, because the skill is what an agent
 * reads: a reference that is listed there and nowhere else would be a
 * reference nobody finds.
 */
function declaredOrder(): readonly string[] {
  const at = SKILL_TEXT.indexOf("The style references travel with the skill");
  if (at === -1) return [];
  const table = SKILL_TEXT.slice(at).split("\n## ")[0] ?? "";
  const order: string[] = [];
  for (const match of table.matchAll(/\|\s*`([a-z0-9-]+)`\s*\|/g)) {
    order.push(match[1]);
  }
  return order;
}

/**
 * Every style reference, in the order the skill lists them.
 *
 * A file the skill does not list still appears, at the end: the list is an
 * order, not a filter.
 */
export function styleReferences(): readonly StyleReference[] {
  const order = declaredOrder();
  const read = SOURCES.map(([file, text]) => {
    const { data, body } = frontMatter(text);
    const slug = data["slug"] ?? file;
    return {
      name: data["name"] ?? slug,
      slug,
      mood: data["mood"] ?? "",
      audience: data["audience"] ?? "",
      anchor: data["anchor"] ?? "",
      body: body.replace(/^#\s+.*\r?\n+/, ""),
      href: `${SKILL_DIR}/styles/${file}.md`,
    } satisfies StyleReference;
  });
  const known = new Set(order);
  return [
    ...order.flatMap((slug) => read.filter((style) => style.slug === slug)),
    ...read.filter((style) => !known.has(style.slug)),
  ];
}

/**
 * The sections of the skill, read from the file.
 *
 * The page that presents the skill shows what is inside it, and the file is
 * what is inside it.
 */
export function skillSections(): readonly Section[] {
  const sections: Section[] = [];
  for (const line of SKILL_TEXT.split("\n")) {
    if (!line.startsWith("## ")) continue;
    const title = line.slice(3).trim();
    sections.push({ title, id: slugOf(title) });
  }
  return sections;
}

/**
 * The checklist the skill carries, read from the file.
 *
 * The checklist is the theme's own groups, and the skill says what each one
 * is for. The headings under the checklist are those groups — the module
 * assembles the file from the contract's list, so the groups here are the
 * groups the contract knows and the page cannot show one the file does not
 * walk.
 */
export function skillChecklist(): readonly Section[] {
  const sections: Section[] = [];
  let inChecklist = false;
  for (const line of SKILL_TEXT.split("\n")) {
    if (line.startsWith("## ")) {
      inChecklist = line.slice(3).trim() === "The checklist";
      continue;
    }
    if (!inChecklist || !line.startsWith("### ")) continue;
    const title = line.slice(4).trim();
    sections.push({ title, id: slugOf(title) });
  }
  return sections;
}
