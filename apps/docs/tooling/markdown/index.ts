import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ALL_DOCS_PAGES } from "../../src/shell/nav.ts";
import { buildGettingStartedMarkdown } from "./getting-started.ts";
import { buildLlmsTxt } from "./llms.ts";
import { buildStylingMarkdown } from "./styling.ts";
import { buildThemeMarkdown } from "./themes.ts";

export { buildLlmsTxt };

const DOCS_ROOT = resolve(import.meta.dir, "../..");

const CONTENT_MD_FOR_ROUTE: Readonly<Record<string, string>> = {
  "/docs/getting-started/overview": "start.md",
  "/docs/styling/elements": "markup.md",
  "/docs/styling/utilities": "css-edges.md",
  "/docs/authoring/components": "components.md",
  "/docs/authoring/machines": "machines.md",
  "/docs/tooling/lints": "lints.md",
  "/docs/tooling/mcp": "mcp.md",
};

export function buildMarkdownForRoute(routePath: string): string | undefined {
  const page = ALL_DOCS_PAGES.find((p) => p.href === routePath);
  if (!page) return undefined;

  const frontmatter = [
    "---",
    `title: ${JSON.stringify(`${page.title} · Spin Docs`)}`,
    ...(page.summary ? [`description: ${JSON.stringify(page.summary)}`] : []),
    `url: ${JSON.stringify(page.href)}`,
    "---",
    "",
    `> Documentation Index: Fetch the complete documentation index at \`/llms.txt\`.`,
    "",
    `# ${page.title}`,
    "",
  ];

  const gettingStartedMd = buildGettingStartedMarkdown(routePath);
  if (gettingStartedMd !== undefined) {
    return [...frontmatter, page.summary ?? "", "", gettingStartedMd, ""].join("\n");
  }

  const themeMd = buildThemeMarkdown(routePath);
  if (themeMd !== undefined) {
    return [...frontmatter, page.summary ?? "", "", themeMd, ""].join("\n");
  }

  const stylingMd = buildStylingMarkdown(routePath);
  if (stylingMd !== undefined) {
    return [...frontmatter, page.summary ?? "", "", stylingMd, ""].join("\n");
  }

  const mdFile = CONTENT_MD_FOR_ROUTE[routePath];
  if (mdFile) {
    const full = resolve(DOCS_ROOT, "src/content", mdFile);
    if (existsSync(full)) {
      const body = readFileSync(full, "utf8")
        .replace(/<!--[\s\S]*?-->/g, "")
        .trim();
      return [...frontmatter, body, ""].join("\n");
    }
  }

  return [
    ...frontmatter,
    page.summary ?? "",
    "",
    `Category: **${page.groupLabel}**`,
    "",
  ].join("\n");
}
