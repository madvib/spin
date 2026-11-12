/**
 * The authoring skill's reference, emitted from the primitive manifest and
 * the languages' named text styles.
 *
 * `references/primitives.md` is the exact closed vocabulary an agent spends:
 * every primitive's selector, its child parts, its closed variants, and every
 * `type-*` named text style the theme declares. The file is generated —
 * `renderAuthoringSkill` rebuilds it from `primitiveComponents` and
 * `authoringStyles` — so the reference and the rules cannot disagree; the
 * hand-written `references/components.md` beside it shows the machine
 * workflow those primitives plug into.
 */

import {
  designLanguages,
  type ThemeDocument,
} from "@spinjs/theme";
import {
  primitiveCategories,
  primitiveComponents,
  type PrimitiveComponent,
} from "@spinjs/preset";

/**
 * The named text styles the languages declare, in the order the documents
 * read them.
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

/** One style's declared tuple, as the theme document states it. */
export function authoringStyleTuple(name: string): Record<string, string> | undefined {
  for (const document of Object.values(designLanguages)) {
    const font = (document as ThemeDocument)["font"];
    if (typeof font !== "object" || font === null) continue;
    const style = (font as Record<string, unknown>)["style"];
    if (typeof style !== "object" || style === null) continue;
    const entry = (style as Record<string, unknown>)[name];
    if (typeof entry !== "object" || entry === null) continue;
    const value = (entry as Record<string, unknown>)["$value"];
    if (typeof value !== "object" || value === null) continue;
    return value as Record<string, string>;
  }
  return undefined;
}

/**
 * The primitives reference, generated from the manifest and the languages.
 *
 * A deterministic rendering: categories and components in manifest order, each
 * primitive naming its tags, its owned painted elements, its closed variants,
 * and the component tokens a brand states for it — then every `type-*` style
 * with its declared tuple. An agent reading the file gets the exact closed
 * vocabulary, and a primitive added to the rules appears without prose edits.
 */
export function renderAuthoringSkill(_template: string): string {
  const lines: string[] = [
    "# Spin primitives reference",
    "",
    "Generated from the primitive manifest (`@spinjs/preset`) and the design",
    "languages' `font.style` entries (`@spinjs/theme`). Do not edit by hand —",
    "run `bun run skill` in `packages/dev` to regenerate.",
    "",
  ];
  for (const category of primitiveCategories) {
    const members = Object.values(primitiveComponents).filter(
      (component) => component.category === category.id,
    );
    if (members.length === 0) continue;
    lines.push(`## ${category.label}`, "");
    for (const component of members) lines.push(...renderComponent(component), "");
  }
  const unfiled = Object.values(primitiveComponents).filter(
    (component) => component.category === undefined,
  );
  if (unfiled.length > 0) {
    lines.push("## Utilities", "");
    for (const component of unfiled) lines.push(...renderComponent(component), "");
  }
  lines.push(...renderStyles());
  return lines.join("\n");
}

/** One primitive's catalog entry: selector, parts, variants, brand tokens. */
function renderComponent(component: PrimitiveComponent): string[] {
  const lines: string[] = [`### ${component.name}`, ""];
  const tags = [...component.tags];
  lines.push(
    tags.length > 0
      ? `Write ${tags.map((tag) => `\`<${tag}>\``).join(", ")}.`
      : "Class-only primitive: no bare tag.",
  );
  lines.push("");
  for (const paint of component.scope.paints) {
    if (paint.where === "descendant") continue;
    const owns = [...paint.owns];
    lines.push(
      owns.length > 0
        ? `- \`<${paint.tag}>\` owns ${owns.join(", ")}.`
        : `- \`<${paint.tag}>\` lays out only.`,
    );
  }
  const variants = [...component.variants];
  lines.push(
    "",
    variants.length > 0
      ? `Closed variants: ${variants.map((variant) => `\`${variant}\``).join(", ")}.`
      : "No variants.",
  );
  const tokens = [...component.component];
  if (tokens.length > 0) {
    lines.push("", "Brand tokens a brand states for this primitive:");
    for (const token of tokens) {
      lines.push(`- \`${token.path}\` (${token.type}).`);
    }
  }
  return lines;
}

/** Every named text style with its declared tuple. */
function renderStyles(): string[] {
  const lines: string[] = ["## Named text styles", ""];
  lines.push("Spend one `type-<name>` class to read in that voice.", "");
  for (const name of authoringStyles()) {
    const tuple = authoringStyleTuple(name);
    lines.push(
      `### type-${name}`,
      "",
      tuple === undefined
        ? "The theme declares this style."
        : `Tuple: ${Object.entries(tuple)
            .map(([key, value]) => `${key} ${value}`)
            .join(", ")}.`,
      "",
    );
  }
  return lines;
}
