import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vite";
import type { Plugin } from "vite";
import solid from "vite-plugin-solid";
import presetIcons from "@unocss/preset-icons";
import { spin } from "@spinjs/spin/vite";
import { parseTokens, starterThemes } from "@spinjs/spin/theme";
import {
  describeCatalog,
  SECTIONS,
  spinShortcuts,
  utilitiesFor,
} from "@spinjs/spin/preset";
import { animationContract } from "@spinjs/spin/animation";
import lucide from "@iconify-json/lucide/icons.json" with { type: "json" };
import { ALL_DOCS_PAGES, DOCS_GROUPS } from "./src/nav.ts";
import {
  elementGroups,
  elementTokens,
  FLOORS,
  ROLES,
  schemaFacts,
  themeSummaries,
  TYPES,
} from "./src/theme-docs.ts";
import { THEMES_SNIPPETS } from "./src/pages/docs/themes/themes.snippets.ts";
import { GETTING_STARTED_SNIPPETS } from "./src/pages/docs/getting-started/getting-started.snippets.ts";

const here = import.meta.dirname!;
const STUDIO_ROOT = resolve(here, "../studio/dist");

function jibeIsolation(): Plugin {
  const apply = (
    _req: unknown,
    res: { setHeader(name: string, value: string): void },
    next: () => void,
  ): void => {
    res.setHeader("cross-origin-opener-policy", "same-origin");
    res.setHeader("cross-origin-embedder-policy", "require-corp");
    res.setHeader("cross-origin-resource-policy", "cross-origin");
    res.setHeader("access-control-allow-origin", "*");
    next();
  };
  return {
    name: "spin:jibe-isolation",
    configureServer(server) {
      server.middlewares.use(apply);
    },
    configurePreviewServer(server) {
      server.middlewares.use(apply);
    },
  };
}

function jibeStudio(): Plugin {
  const bridge = resolve(here, "src/studio-bridge.js");
  const bridgeVersion = (): string =>
    createHash("sha256").update(readFileSync(bridge)).digest("hex").slice(0, 8);
  const index = (): string =>
    readFileSync(resolve(STUDIO_ROOT, "index.html"), "utf8").replace(
      "</head>",
      `<script src="/studio-bridge.js?v=${bridgeVersion()}"></script></head>`,
    );
  return {
    name: "spin:jibe-studio",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = new URL(req.url ?? "/", "http://localhost");
        if (url.pathname === "/studio-bridge.js") {
          res.setHeader("content-type", "text/javascript; charset=utf-8");
          res.end(readFileSync(bridge));
          return;
        }
        if (
          url.pathname !== "/__spin/jibe-studio" &&
          url.pathname !== "/__spin/jibe-studio/" &&
          !url.pathname.startsWith("/__spin/jibe-studio/")
        ) {
          return next();
        }
        const path = url.pathname.slice("/__spin/jibe-studio".length);
        if (
          path === "" ||
          path === "/" ||
          path.endsWith("/index.html") ||
          !path.includes(".")
        ) {
          res.setHeader("content-type", "text/html; charset=utf-8");
          res.end(index());
          return;
        }
        const file = resolve(STUDIO_ROOT, path.replace(/^\/+/, ""));
        if (!file.startsWith(STUDIO_ROOT) || !existsSync(file)) {
          res.statusCode = 404;
          res.end("not found");
          return;
        }
        res.setHeader(
          "content-type",
          file.endsWith(".js")
            ? "text/javascript; charset=utf-8"
            : file.endsWith(".css")
            ? "text/css; charset=utf-8"
            : file.endsWith(".html")
            ? "text/html; charset=utf-8"
            : "application/octet-stream",
        );
        res.end(readFileSync(file));
      });
    },
  };
}


const CONTENT_MD_FOR_ROUTE: Readonly<Record<string, string>> = {
  "/docs/getting-started/overview": "start.md",
  "/docs/styling/elements": "markup.md",
  "/docs/styling/utilities": "css-edges.md",
  "/docs/authoring/components": "components.md",
  "/docs/authoring/machines": "machines.md",
  "/docs/tooling/lints": "lints.md",
  "/docs/tooling/mcp": "mcp.md",
  "/docs/tooling/check": "check.md",
};

function buildLlmsTxt(): string {
  const lines: string[] = [
    "# Spin Documentation",
    "",
    "> Spin is a theme-first UI system and verification layer: DTCG design tokens (`spin/*.json`), classless HTML element rules, closed-scale UnoCSS utilities, and headless state-machine components.",
    "",
    "## Core Rules for Coding Agents",
    "",
    "1. **Theme owns every visual value (`spin/*.json`).** Never write `.css` files, `<style>` blocks, inline `style={{}}`, or arbitrary bracket utilities (`w-[320px]`, `bg-[#fff]`).",
    "2. **Classless elements first.** Use `<button>` (neutral), `<button class=\"primary\">` (CTA), `.secondary`, `.outline`, `.ghost`, `.danger`, `.bare`, `<input>`, `<select>`, `<textarea>`, `<label>`, `<field>`, `<card>` (`<card-header>`, `<card-title>`, `<card-description>`, `<card-action>`, `<card-content>`, `<card-footer>`), `<panel>`, `<dialog>`, `<table>`, `<badge variant=\"primary\">`, `<alert variant=\"info\">`. Never re-declare styles the element already owns (`spin/no-redundant-class`, `spin/prefer-theme-value`).",
    "3. **Layout shortcuts & paired inks.** Use `stack`, `stack-xs`, `stack-sm`, `stack-lg`, `row`, `split`, `cluster`, `inline`, `overline`. Pair every fill with its semantic ink (`bg-primary text-on-primary`, `bg-semantic-success text-on-semantic-success`). Dark mode is automatic via `[data-mode=\"dark\"]` — never write `dark:*` classes.",
    "4. **Interactive widgets via `@spinjs/components`.** Never hand-roll custom select, combobox, tabs, dialog, menu, popover, or date-picker widgets. Run `npx spin component list` and `npx spin component copy <name> <example>`, then bind with `createSpinComponent` / `useSpinComponent`.",
    "5. **Verify before finishing.** Run `npx spin lint .` and `npx spin theme analyze` (or use the `spin` MCP server tools in `.mcp.json`).",
    "",
    "Fetch any documentation page as Markdown by appending `.md` to its URL or sending `Accept: text/markdown`.",
    "",
  ];
  for (const group of DOCS_GROUPS) {
    lines.push(`## ${group.label}`, "");
    for (const item of group.items) {
      lines.push(
        `- [${item.title}](${item.href}.md)${
          item.summary ? `: ${item.summary}` : ""
        }`,
      );
    }
    lines.push("");
  }
  return lines.join("\n");
}

function buildGettingStartedMarkdown(routePath: string): string | undefined {
  switch (routePath) {
    case "/docs/getting-started/quickstart":
      return [
        "## 1. Install and initialize",
        "",
        "```bash",
        GETTING_STARTED_SNIPPETS.install,
        GETTING_STARTED_SNIPPETS.init,
        "```",
        "",
        "## 2. Import the stylesheet and component registry",
        "",
        "`src/spin-components.d.ts` is generated automatically by `spin init` and `spin.<bundler>()` — no manual `.d.ts` files needed:",
        "",
        "```ts",
        GETTING_STARTED_SNIPPETS.entry,
        "```",
        "",
        "## 3. Write classless markup and vendor a component",
        "",
        "```html",
        GETTING_STARTED_SNIPPETS.firstMarkup,
        "```",
        "",
        "```bash",
        "npx spin component copy select basic",
        "# writes lib/components/select/basic.html -> <app-select-basic>",
        "```",
        "",
        "## 4. Open the Studio",
        "",
        "On Vite, the Studio is mounted automatically at `http://localhost:5173/__spin/studio/`. On non-Vite bundlers, run:",
        "",
        "```bash",
        GETTING_STARTED_SNIPPETS.studioServe,
        "```",
        "",
        "## 5. Onboard your coding agent",
        "",
        "```md",
        GETTING_STARTED_SNIPPETS.agentPrompt,
        "```",
      ].join("\n");
    case "/docs/getting-started/install":
      return [
        "## Packages",
        "",
        "```bash",
        GETTING_STARTED_SNIPPETS.install,
        "```",
        "",
        "- **`@spinjs/spin`** (devDependency): Build toolchain, bundler plugins, UnoCSS preset, theme engine, `.html` component compiler, CLI, MCP server, and Studio.",
        "- **`@spinjs/components`** (dependency): Headless state-machine components with React, Solid, Vue, and Svelte adapters.",
        "- **`@spinjs/runtime`** (dependency): Reactive signals, custom-element bridges, and finite-state machines.",
        "",
        "## `spin init` flags",
        "",
        "- `--root` (default `.`): Project root directory to scaffold in.",
        "- `--name` (default `default`): First theme name written to `spin/<name>.json`.",
        "- `--starter` (default `spin`): Shipped starter theme to seed from (`spin`, `silk`, `material`, `neobrut`, `industrial`).",
        "- `--bundler` (default `auto-detected`): Target bundler config (`vite`, `rspack`, `webpack`, `rollup`, `rolldown`, `esbuild`, `bun`).",
        "- `--themes-dir` (default `spin/`): Directory where DTCG theme JSON documents live.",
        "- `--components-dir` (default `lib/components/`): Directory where project `.html` components live.",
        "- `--prefix` (default `derived` from `package.json` name, fallback `app`): Custom-element tag prefix.",
        "- `--url` (default `in-process`): Connect to a running Studio daemon instead of running in-process.",
        "- `-y, --yes`: Skip interactive prompts and accept defaults.",
        "",
        "## Wire your bundler",
        "",
        "### Vite (`vite.config.ts`)",
        "```ts",
        GETTING_STARTED_SNIPPETS.vite,
        "```",
        "",
        "### Rspack (`rspack.config.ts`)",
        "```ts",
        GETTING_STARTED_SNIPPETS.rspack,
        "```",
        "",
        "### webpack (`webpack.config.mjs`)",
        "```ts",
        GETTING_STARTED_SNIPPETS.webpack,
        "```",
        "",
        "### Rollup (`rollup.config.mjs`)",
        "```ts",
        GETTING_STARTED_SNIPPETS.rollup,
        "```",
        "",
        "### Rolldown (`rolldown.config.ts`)",
        "```ts",
        GETTING_STARTED_SNIPPETS.rolldown,
        "```",
        "",
        "### esbuild (`spin.config.ts`)",
        "```ts",
        GETTING_STARTED_SNIPPETS.esbuild,
        "```",
        "",
        "### Bun (`spin.config.ts`)",
        "```ts",
        GETTING_STARTED_SNIPPETS.bun,
        "```",
        "",
        "### UnoCSS (`uno.config.ts`)",
        "```ts",
        GETTING_STARTED_SNIPPETS.unocss,
        "```",
        "",
        "## Project layout",
        "",
        "- `spin/*.json`: DTCG theme documents declaring your palette, scales, modes, and element overrides.",
        "- `spin/config.json`: Optional project seating configuration (`activeTheme` and `themeOrder`) written by the Studio.",
        "- `lib/components/*.html`: Vendored and custom HTML components compiled into `<prefix>-<name>` custom elements.",
        "- `src/spin-components.d.ts`: Auto-generated DOM and JSX type declarations for your project components.",
      ].join("\n");
    case "/docs/getting-started/paths":
      return [
        "## Entry points at a glance",
        "",
        "- **`spin.vite()` / `spin.<bundler>()`** (Full app + Studio): Token stylesheet, classless primitives, `spin/*.json` discovery, `lib/components/*.html` compiler and types, plus live Studio overlay on Vite.",
        "- **`spin.vite({ extends: brand })`** (Multi-app brand): Layers a shared brand package's themes and components beneath local `spin/*.json` and `lib/components/*.html` overrides.",
        "- **`spinPreset({ themes })`** (Stylesheet only): Drops into an existing `uno.config.ts` for token CSS, utilities, and element rules from explicit theme objects.",
        "- **`npx spin studio`** (Standalone daemon): Serves the visual theme editor at `/studio/` and RPC daemon at `/rpc` without running an application bundler.",
        "- **`spin lint / theme / component / mcp`** (CLI & Agent tools): Source lints, theme validation gates, component scaffolding, and the stdio MCP server.",
        "",
        "## Full bundler plugin",
        "",
        "```ts",
        GETTING_STARTED_SNIPPETS.vite,
        "```",
        "",
        "## Shared brand packages (`extends`)",
        "",
        "Multi-app teams can publish a shared brand package exporting `{ themes, componentsDir }` and pass it via `extends`. Local `spin/<name>.json` and `lib/components/<name>.html` override brand entries by name:",
        "",
        "```ts",
        GETTING_STARTED_SNIPPETS.brandExport,
        "```",
        "",
        "```ts",
        GETTING_STARTED_SNIPPETS.viteExtends,
        "```",
        "",
        "## Stylesheet only (`spinPreset`)",
        "",
        "```ts",
        GETTING_STARTED_SNIPPETS.unocss,
        "```",
      ].join("\n");
    case "/docs/getting-started/architecture":
      return [
        "## Ownership & verification by layer",
        "",
        "1. **Theme (`spin/*.json`)** — `themeGates`: Owns every visual value (palette, typography scale, spacing steps, radii, shadows, motion curves). Verified by the six contract gates.",
        "2. **Classless Elements (`@spinjs/spin/preset`)** — `prefer-theme-value`: Styles native HTML tags and Spin custom elements directly from theme CSS variables.",
        "3. **Closed-Scale Utilities (`uno.css`)** — `spin lint`: Handles layout and composition using only steps declared in your theme.",
        "4. **State Machines (`@spinjs/components`)** — `machine tests`: Headless statecharts wiring ARIA attributes, keyboard navigation, and focus management.",
        "5. **Rendered Verification (`spin check`)** — `spin check`: Drives a real browser against your routes and themes to verify contrast, hit targets, and clipping.",
      ].join("\n");
    default:
      return undefined;
  }
}

function buildThemeMarkdown(routePath: string): string | undefined {
  switch (routePath) {
    case "/docs/themes/overview": {
      const starters = themeSummaries()
        .map(
          (s) =>
            `- **\`${s.name}\`** (${s.modes.join(", ")}): ${s.thesis ?? ""}`,
        )
        .join("\n");
      return [
        "## Designing in the Studio",
        "",
        "Open the Studio (`/__spin/studio/` on Vite or `npx spin studio`) to create, fork, and edit themes visually against your live application. Edits preview in memory and save to `spin/<name>.json` and `spin/config.json`.",
        "",
        "## Starter Palettes",
        "",
        starters,
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
    case "/docs/themes/modes":
      return [
        "## Subtree Mode Scoping (`data-mode`)",
        "",
        "```html",
        THEMES_SNIPPETS.subtreeMode,
        "```",
        "",
        "## Token Overrides & Alias Resolution (`$modes`)",
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
      ].join("\n");
    case "/docs/themes/customization":
      return [
        "## Per-Element Overrides",
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
      const schema = schemaFacts();
      const groups = schema.groups
        .map(
          (g) =>
            `- **\`${g}\`** (${
              schema.requiredGroups.includes(g) ? "required" : "optional"
            })`,
        )
        .join("\n");
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
      return [
        "## Supported `$type` Values",
        "",
        TYPES.map((t) => `- \`${t}\``).join("\n"),
        "",
        "## Core Token Groups",
        "",
        groups,
        "",
        "## Required Roles",
        "",
        roles,
        "",
        "## Per-Element Token Overrides",
        "",
        elGroups,
      ].join("\n");
    }
    default:
      return undefined;
  }
}

function buildStylingMarkdown(routePath: string): string | undefined {
  if (routePath === "/docs/styling/animation") {
    const animations = animationContract.variants
      .map((v) => `- \`${v}\``)
      .join("\n");
    const reads = animationContract.reads
      .map((r) => `- \`--${r}\``)
      .join("\n");
    return [
      "## Keyframe Utilities (`@spinjs/spin/animation`)",
      "",
      animations,
      "",
      "## Theme Tokens Read",
      "",
      reads,
      "",
      "## Reduced Motion & Safety Gates",
      "",
      "- `@media (prefers-reduced-motion: reduce)` clamps transition and animation durations to `0.01ms` and limits `animation-iteration-count` to `1` in the `theme` preflight layer.",
      "- Continuous loop durations faster than `250ms` (`motion.duration.loop < 250ms`) fail the `motion` theme gate and the `strobe-animation` browser check.",
    ].join("\n");
  }
  if (routePath !== "/docs/styling/catalog") return undefined;
  const parsed = parseTokens(
    starterThemes.spin as unknown as Parameters<typeof parseTokens>[0],
  );
  if (!parsed.ok) return undefined;
  const catalog = describeCatalog(parsed.tree);
  const sections = SECTIONS.map((section) => {
    const utils = utilitiesFor(section, catalog);
    return [
      `### ${section.title} (${utils.length})`,
      "",
      section.blurb,
      "",
      utils.map((u) => `\`${u}\``).join(", "),
    ].join("\n");
  }).join("\n\n");
  const shortcuts = Object.entries(spinShortcuts as Record<string, string>)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, expansion]) => `- \`${name}\` → \`${expansion}\``)
    .join("\n");
  const animations = animationContract.variants
    .map((v) => `\`${v}\``)
    .join(", ");
  return [
    "## Utility Catalog by Intent",
    "",
    sections,
    "",
    "## Shipped Layout & Typography Shortcuts",
    "",
    shortcuts,
    "",
    "## Animation Utilities (`@spinjs/spin/animation`)",
    "",
    animations,
  ].join("\n");
}

function buildMarkdownForRoute(routePath: string): string | undefined {
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
    return [
      ...frontmatter,
      page.summary ?? "",
      "",
      gettingStartedMd,
      "",
    ].join("\n");
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
    const full = resolve(here, "src/content", mdFile);
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

function markdownForAgents(): Plugin {
  return {
    name: "spin:markdown-for-agents",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const rawUrl = (req.url ?? "").split("?")[0] ?? "";
        if (rawUrl === "/llms.txt") {
          res.setHeader("content-type", "text/markdown; charset=utf-8");
          res.setHeader("vary", "Accept");
          res.setHeader(
            "content-signal",
            "ai-train=yes, search=yes, ai-input=yes",
          );
          res.end(buildLlmsTxt());
          return;
        }

        const accept = req.headers["accept"] ?? "";
        const isMdSuffix = rawUrl.endsWith(".md") && rawUrl.startsWith("/docs/");
        const wantsMarkdown =
          isMdSuffix ||
          (rawUrl.startsWith("/docs/") && accept.includes("text/markdown"));
        if (!wantsMarkdown) return next();

        const routePath = isMdSuffix
          ? rawUrl.slice(0, -".md".length)
          : rawUrl.replace(/\/$/, "");
        const md = buildMarkdownForRoute(routePath);
        if (md === undefined) return next();

        res.setHeader("content-type", "text/markdown; charset=utf-8");
        res.setHeader("vary", "Accept");
        res.setHeader(
          "content-signal",
          "ai-train=yes, search=yes, ai-input=yes",
        );
        res.end(md);
      });
    },
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "llms.txt",
        source: buildLlmsTxt(),
      });
      for (const page of ALL_DOCS_PAGES) {
        const md = buildMarkdownForRoute(page.href);
        if (md !== undefined) {
          this.emitFile({
            type: "asset",
            fileName: `${page.href.slice(1)}.md`,
            source: md,
          });
        }
      }
    },
  };
}

export default defineConfig({
  plugins: [
    jibeIsolation(),
    jibeStudio(),
    solid(),
    markdownForAgents(),
    spin.vite({
      extends: { themes: starterThemes },
      presets: [presetIcons({ collections: { lucide } as never })],
      content: {
        filesystem: [
          resolve(here, "src/**/*.{tsx,ts}"),
          resolve(here, "lib/components/**/*.html"),
        ],
        pipeline: {
          include: [/\.(tsx?|html)($|\?)/],
        },
      },
    }),
  ],
});
