/**
 * The house skill as data, for the docs' themes pages.
 *
 * The markdown sibling (`../../skill/*.md`) is the served file; this module
 * is the same bytes in the shape a page reads — the assembled skill text
 * plus the named style references. One source, two shapes, no copy.
 */

import { renderAuthoringSkill } from "../theme/skill/authoring.ts";
import { renderSkill } from "../theme/skill/index.ts";
import template from "../../skill/SKILL.md?raw";
import authoringTemplate from "../../skill/spin-type.md?raw";
import authoringReference from "../../skill/type-migration.md?raw";
import darkTech from "../../skill/dark-tech-cinematic.md?raw";
import editorial from "../../skill/editorial-minimalism.md?raw";
import agency from "../../skill/high-end-agency.md?raw";
import brutalism from "../../skill/industrial-brutalism.md?raw";
import morph from "../../skill/morphism.md?raw";
import soft from "../../skill/warm-soft-saas.md?raw";

/** The skill's own text, assembled from the contract's group list. */
export const SKILL_TEXT: string = renderSkill(template);

/** The authoring skill's text, assembled from the starters' style list. */
export const AUTHORING_SKILL_TEXT: string =
  renderAuthoringSkill(authoringTemplate);

/** The authoring skill's migration reference, in full. */
export const AUTHORING_REFERENCE_TEXT: string = authoringReference;

/** One style reference's markdown, in full, keyed by slug. */
const SOURCES: Readonly<Record<string, string>> = {
  "dark-tech-cinematic": darkTech,
  "editorial-minimalism": editorial,
  "high-end-agency": agency,
  "industrial-brutalism": brutalism,
  morphism: morph,
  "warm-soft-saas": soft,
};

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

/** Every style reference's markdown, keyed by slug. */
export function styleSources(): Readonly<Record<string, string>> {
  return SOURCES;
}

/** Every style slug, in the order the skill lists them. */
export function styleOrder(): readonly string[] {
  const order = declaredOrder();
  const known = new Set(order);
  return [
    ...order.filter((slug) => slug in SOURCES),
    ...Object.keys(SOURCES).filter((slug) => !known.has(slug)),
  ];
}
