import { designLanguages } from "@spinjs/theme";
import { elementGroups, elementTokens, FLOORS, ROLES, schemaFacts, themeSummaries, TYPES } from "../../src/markdown/theme-docs.ts";
import { THEMES_SNIPPETS } from "../../src/pages/docs/themes/themes.snippets.ts";

export function buildThemeMarkdown(routePath: string): string | undefined {
  switch (routePath) {
    case "/docs/themes/overview": {
      const languages = themeSummaries()
        .map(
          (s) =>
            `- **\`${s.name}\`** (${s.modes.join(", ")}): ${s.thesis ?? ""}`,
        )
        .join("\n");
      return [
        "## Designing in the Studio",
        "",
        "Click the floating **Studio** button in your running Vite app (or run `npx spin studio`) to create and edit your brand visually against your live UI. Edits preview in memory and save to `spin/<brand>/tokens.json` and `spin/config.json`.",
        "",
        "## Design Languages",
        "",
        languages,
        "",
        "New projects start from a design language without copying it: write a sparse document naming the language in `\"$extends\"` with only your own overrides (`--vendor` writes a standalone snapshot instead):",
        "",
        "```json",
        THEMES_SNIPPETS.sparseExtends,
        "```",
        "",
        "## Four Axes That Compose (`data-theme` / `data-palette` / `data-spacing` / `data-mode`)",
        "",
        "The base theme decides the whole look (`data-theme`), a palette facet swaps only the ink (`data-palette`, from `*.palette.json`), a spacing facet swaps only the rhythm (`data-spacing`, from `*.spacing.json`), and the mode picks the light or dark answer for the ink (`data-mode`). Set all four on the page root:",
        "",
        "```html",
        THEMES_SNIPPETS.composedAxes,
        "```",
        "",
        "Axes nest in subtrees — a dense sidebar keeps the page ink while tightening its own spacing:",
        "",
        "```html",
        THEMES_SNIPPETS.nestedFacets,
        "```",
        "",
        "## Project Files (`spin/config.json`)",
        "",
        "```json",
        THEMES_SNIPPETS.studioConfig,
        "```",
        "",
        "## Sharing a Brand Package (`extends`)",
        "",
        "```ts",
        THEMES_SNIPPETS.viteSharedBrand,
        "```",
      ].join("\n");
    }
    case "/docs/themes/palettes": {
      const floors = FLOORS.map(
        (f) => `- \`${f.fg}\` on \`${f.bg}\`: **≥ ${f.min}:1**`,
      ).join("\n");
      return [
        "## Why Fills and Inks Travel in Pairs",
        "",
        "Every painted fill role (`color.primary`, `color.secondary`, `color.accent`, `color.semantic.{success,warning,error,info}`, `color.selected`, `color.disabled`) owns a paired foreground ink (`color.on-primary`, `color.on-secondary`, etc.) verified against WCAG contrast floors across light and dark modes. `spin/no-unpaired-ink` flags any template that paints a fill (`bg-primary`) without its matching foreground ink (`text-on-primary`).",
        "",
        "## Neutral Ramps and Role Aliases",
        "",
        "```json",
        THEMES_SNIPPETS.modeToken,
        "```",
        "",
        "## Enforced WCAG Contrast Floors",
        "",
        floors,
      ].join("\n");
    }
    case "/docs/themes/facets":
      return [
        "## Alternate Palettes (`data-palette`)",
        "",
        "```html",
        THEMES_SNIPPETS.composedSubtree,
        "```",
        "",
        "## Authoring a Palette File (`*.palette.json`)",
        "",
        "```json",
        THEMES_SNIPPETS.paletteFacet,
        "```",
      ].join("\n");
    case "/docs/themes/density":
      return [
        "## Page-wide or Scoped Density (`data-spacing`)",
        "",
        "```html",
        THEMES_SNIPPETS.nestedFacets,
        "```",
        "",
        "## Authoring a Spacing Scale (`*.spacing.json`)",
        "",
        "```json",
        THEMES_SNIPPETS.spacingFacet,
        "```",
      ].join("\n");
    case "/docs/themes/modes":
      return [
        "## Subtree Mode Scoping (`data-mode`)",
        "",
        "```html",
        THEMES_SNIPPETS.subtreeMode,
        "```",
        "",
        "## Palettes and Density Compose with Modes (`data-palette` / `data-spacing`)",
        "",
        "A palette facet swaps the ink a subtree wears and a spacing facet swaps the rhythm it spends; both layer over the base theme and nest with `data-mode`:",
        "",
        "```html",
        THEMES_SNIPPETS.composedSubtree,
        "```",
        "",
        "## Token Overrides & Alias Resolution (`$modes`)",
        "",
        "Only palette tokens (`color.*`, `shadow.*`, `focus.*`, and per-element color or shadow tokens) accept `$modes` — spacing, typography, radius, and motion tokens are mode-invariant and rejected by the schema:",
        "",
        "```json",
        THEMES_SNIPPETS.modeToken,
        "```",
        "",
        "## Switching Themes & Modes in UI",
        "",
        "```ts",
        THEMES_SNIPPETS.pickers,
        "```",
      ].join("\n");
    case "/docs/themes/fonts":
      return [
        "## Automatic `@font-face` Generation (`$extensions.spin.fonts`)",
        "",
        "```json",
        THEMES_SNIPPETS.webFonts,
        "```",
        "",
        "## Thirteen Type Styles (`font.style.<name>`, `$type: \"typography\"`)",
        "",
        "Each named type style is a composite tuple of family, size, weight, tracking, and leading, spent with `type-<name>`. Thirteen ship with every language (`display`, `title`, `heading`, `subtitle`, `lead`, `body`, `body-emphasized`, `quote`, `code`, `label`, `caption`, `caption-emphasized`, `overline`):",
        "",
        "```json",
        THEMES_SNIPPETS.compositeStyle,
        "```",
        "",
        "## Type Style Assignment (`.type` aliases)",
        "",
        "Elements and component slots read their default type style from a `.type` alias: `element.h1.type` reads `{font.style.display}` in `elements.json`, `card.title.type` reads `{font.style.title}` in `primitives/card.json`. `<a>` and `<strong>` are inline modifiers over inherited text, not type styles — a link adds only paint (`color.link`, `link.underline`, `link.offset`), strong reads the `body-emphasized` weight:",
        "",
        "```json",
        THEMES_SNIPPETS.typeAlias,
        "```",
      ].join("\n");
    case "/docs/themes/customization":
      return [
        "## Per-Element Overrides",
        "",
        "Elements read their default type style from their `.type` alias (`h1` reads `{font.style.display}`, `button` reads `{font.style.label}`); re-point a target in `elements.json` or `primitives/<component>.json` instead of forking a global scale:",
        "",
        "```json",
        THEMES_SNIPPETS.typeAlias,
        "```",
        "",
        "Per-element geometry and paint tokens (pill radii, deeper card shadows) stay beside the type style:",
        "",
        "```json",
        THEMES_SNIPPETS.elementOverride,
        "```",
      ].join("\n");
    case "/docs/themes/validation": {
      const floors = FLOORS.map(
        (f) => `- \`${f.fg}\` on \`${f.bg}\`: **≥ ${f.min}:1**`,
      ).join("\n");
      return [
        "## Lint and CLI Theme Commands (`npx spin lint`)",
        "",
        "```bash",
        THEMES_SNIPPETS.cliAnalyze,
        "```",
        "",
        "## Enforced WCAG Contrast Floors",
        "",
        floors,
        "",
        "## Programmatic Validation (`validateTheme`)",
        "",
        "```ts",
        THEMES_SNIPPETS.validateTheme,
        "```",
        "",
        "## Reading Token Values in JavaScript (`resolveTheme`)",
        "",
        "```ts",
        THEMES_SNIPPETS.resolveTheme,
        "```",
      ].join("\n");
    }
    case "/docs/themes/reference": {
      const roles = ROLES.map(
        (r) => `- \`${r.path}\` (\`${r.type}\`): ${r.doc}`,
      ).join("\n");
      const elGroups = elementGroups()
        .map(
          (g) =>
            `- **\`${g}\`**: ${elementTokens(g)
              .map((t) => `\`${t.path}\` (${t.type})`)
              .join(", ")}`,
        )
        .join("\n");
      const editorialDoc = designLanguages.editorial as unknown as Record<string, unknown>;
      const fontGroup = editorialDoc["font"] as Record<string, unknown> | undefined;
      const styleGroup = fontGroup?.["style"] as
        | Record<string, unknown>
        | undefined;
      const styles = Object.keys(styleGroup ?? {})
        .filter((key) => !key.startsWith("$"))
        .sort()
        .map((name) => `- \`type-${name}\` (from \`font.style.${name}\`)`)
        .join("\n");
      return [
        "## Supported `$type` Values",
        "",
        TYPES.map((t) => `- \`${t}\``).join("\n"),
        "",
        "## Required Roles",
        "",
        roles,
        "",
        "## Named Type Styles (13 Composite Type Styles)",
        "",
        "Write `type-<name>` to spend one of these thirteen type styles — face, size, weight, tracking, leading, all at once, each declared as a composite `$type: \"typography\"` tuple in `font.style.<name>`. Elements and components read their default type style from their `.type` alias; `<a>` and `<strong>` are inline modifiers over inherited text, not type styles. The Typography guide (`/docs/styling/prose`) maps each type style to its default element with a live specimen.",
        "",
        styles,
        "",
        "## Per-Element Token Overrides",
        "",
        "Type arrives through named styles now — no element carries weight, case, or tracking tokens of its own.",
        "",
        elGroups,
      ].join("\n");
    }
    default:
      return undefined;
  }
}
