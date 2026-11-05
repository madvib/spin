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
    "3. **Layout compositions & paired inks.** Declare the compositions your app repeats in `spin.vite({ shortcuts: { ... } })` (the worked example lives on `/docs/getting-started/install#config`) — the preset ships none. Pair every fill with its semantic ink (`bg-primary text-on-primary`, `bg-semantic-success text-on-semantic-success`). Dark mode is automatic via `[data-mode=\"dark\"]` — never write `dark:*` classes.",
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
  if (routePath === "/docs/styling/tailwind") {
    return [
      "## What transfers",
      "",
      "Write the utility and variant grammar you already know from Tailwind — `p-4`, `bg-surface`, `hover:`, `md:`, `flex`, and `grid` — and you are productive on your first screen. Your muscle memory for flexbox and grid composition, spacing steps, state prefixes, and responsive breakpoints transfers directly, compiled under the hood by UnoCSS:",
      "",
      "```html",
      "<div class=\"rounded-lg border border-border bg-surface p-4\">",
      "  <div class=\"flex flex-col gap-2 md:flex-row md:items-center md:justify-between\">",
      "    <div>",
      "      <strong>Edge routing</strong>",
      "      <small class=\"block\">3 regions active across 12 pop nodes</small>",
      "    </div>",
      "    <div",
      "      tabindex=\"0\"",
      "      class=\"inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 transition-colors duration-fast hover:bg-surface-raised\"",
      "    >",
      "      <strong>Inspect routes</strong>",
      "      <kbd>⌘K</kbd>",
      "    </div>",
      "  </div>",
      "  <div class=\"mt-4 grid grid-cols-1 gap-3 md:grid-cols-3\">",
      "    <div class=\"rounded-md border border-border bg-surface-raised p-3\">",
      "      <strong>us-east</strong>",
      "      <small class=\"block\">14 ms p95</small>",
      "    </div>",
      "    <div class=\"rounded-md border border-border bg-surface-raised p-3\">",
      "      <strong>eu-central</strong>",
      "      <small class=\"block\">19 ms p95</small>",
      "    </div>",
      "    <div class=\"rounded-md border border-border bg-surface-raised p-3\">",
      "      <strong>ap-northeast</strong>",
      "      <small class=\"block\">27 ms p95</small>",
      "    </div>",
      "  </div>",
      "</div>",
      "```",
      "",
      "## The one principle: every value comes from your theme",
      "",
      "Write a utility class and it resolves against the tokens your theme declares in `spin/<name>.json` — `p-4` spends `spacing.4`, `bg-surface-raised` spends `color.surface-raised`, and `rounded-md` spends `radius.md`. Because a closed vocabulary that fails silently is a footgun, a class your theme cannot produce renders nothing and fails your build with the file, the unknown class, and the nearest valid replacement (see [Lints & Diagnostics](/docs/tooling/lints)):",
      "",
      "```bash",
      "[spin] `p-13` in src/App.tsx generates no CSS — it is not in the spin vocabulary. Did you mean `p-12`?",
      "[spin] `bg-blue-500` in src/App.tsx generates no CSS — it is not in the spin vocabulary. Drop it.",
      "```",
      "",
      "## Colors are decisions, numbers are measurements",
      "",
      "Pass a bracketed number to a sizing or inset utility like `w-[13rem]` or `top-[3px]` when a single element needs a one-off measurement — the size and inset bracket syntax exists as a designed escape for geometry your theme scale has no reason to name. Write a bracketed color like `bg-[#fff]` or an arbitrary font size like `text-[14px]` and the stylesheet emits nothing and fails validation, because a number sizes one element while a color or type size repaints the system without telling the theme; thin a declared color role with an alpha suffix like `bg-surface/80` and pick type sizes from your `font.size.*` scale (`text-2xs` through `text-3xl`):",
      "",
      "```html",
      "<!-- Numeric measurements resolve as a designed escape for one-off geometry -->",
      "<div class=\"relative rounded-md border border-border bg-surface/80 p-3 w-[13rem]\">",
      "  <span class=\"absolute top-[3px] right-2 h-2 w-2 rounded-full bg-primary text-on-primary\"></span>",
      "  <strong>Pinned rail</strong>",
      "  <small class=\"block\">w-[13rem] · top-[3px]</small>",
      "</div>",
      "```",
      "",
      "## Dark mode is a theme, not a variant",
      "",
      "Write each color utility once (`bg-surface`, `bg-surface-raised`, `bg-primary text-on-primary`, `border-border`) and switch modes with `data-mode=\"light\"` or `data-mode=\"dark\"` on `<html>` or any nested container — never by scattering `dark:` variants across your markup. Because the dark theme declares its own token values, one class has two honest answers and never needs per-element theme patches; see [Color & Dark Mode](/docs/styling/color#dark-mode) for the full walkthrough.",
      "",
      "## Elements arrive styled; utilities adjust",
      "",
      "Write bare `<button>`, `<table>`, `<p>`, and `<card>` tags to get finished controls and document typography without assembling a long utility string on every element. Because utilities sit above element rules in the stylesheet cascade, adding a layout or spacing utility like `w-full` or `mt-4` adjusts a bare element cleanly for a one-off placement — while any visual adjustment that recurs across screens belongs in your theme tokens so every instance agrees (see the [Primitives guide](/docs/styling/elements)):",
      "",
      "```html",
      "<card>",
      "  <card-header>",
      "    <card-title>Invoice summary</card-title>",
      "    <card-description>Bare tags supply the control chrome; utilities adjust placement.</card-description>",
      "  </card-header>",
      "  <card-content>",
      "    <table>",
      "      <thead>",
      "        <tr>",
      "          <th>Environment</th>",
      "          <th>Requests</th>",
      "        </tr>",
      "      </thead>",
      "      <tbody>",
      "        <tr>",
      "          <td>Production</td>",
      "          <td>1.4M</td>",
      "        </tr>",
      "      </tbody>",
      "    </table>",
      "    <button type=\"button\" class=\"primary mt-4 w-full\">",
      "      Download statement",
      "    </button>",
      "  </card-content>",
      "</card>",
      "```",
      "",
      "## What Spin adds, and why each earns its place",
      "",
      "Write `row-list` on a horizontal `<ul>` or `<ol>` to lay items out in a centered flex row with markers cleared and every item aligned on the same baseline, or `flow-list` for a vertical UI list with markers off and theme block spacing preserved. Because document lists space adjacent `li + li` items vertically so prose lists breathe, putting plain `flex` on a `<ul>` leaves the second item sitting lower than the first; `row-list` zeroes that sibling margin and sets the row gap in one class.",
      "",
      "Name a trigger control with `anchor-<name>` (such as `anchor-region-menu`) and pin its floating panel to it with `position-anchor-<name>` and a `position-area-*` placement like `position-area-bottom-span-right` or `position-area-top`. When a native `[popover]` or menu renders in the browser's top layer, no ancestor box positions it — `absolute top-full` measures against the viewport instead of the button that opened it — so anchor utilities let the panel track its trigger directly in markup.",
      "",
      "Apply a named type style such as `type-label`, `type-caption`, or `type-code` when a custom surface needs to spend the exact typographic decision your theme made for that voice. Instead of guessing whether the active theme styles labels in semibold wide or medium tight, your custom trigger reads the named style directly and follows every theme change (see [Customization](/docs/themes/customization) and [Token Reference](/docs/themes/reference#elements)):",
      "",
      "```html",
      "<!-- 1. Horizontal and vertical UI lists without bullet or baseline drift -->",
      "<ul class=\"row-list\">",
      "  <li><a href=\"#what-spin-adds\">Overview</a></li>",
      "  <li><a href=\"#what-spin-adds\">Regions</a></li>",
      "  <li><a href=\"#what-spin-adds\">Audit log</a></li>",
      "</ul>",
      "",
      "<!-- 2. Top-layer anchor positioning pinned to its trigger -->",
      "<div class=\"isolate relative\">",
      "  <button type=\"button\" class=\"anchor-region-menu\">Region target</button>",
      "  <div class=\"z-dropdown position-anchor-region-menu position-area-bottom-span-right rounded-md border border-border bg-surface-raised p-3 shadow-md\">",
      "    <strong>Pinned to --region-menu</strong>",
      "  </div>",
      "</div>",
      "",
      "<!-- 3. Named type styles: one class spends the theme's whole tuple -->",
      "<alert role=\"status\" class=\"type-label\">",
      "  <span>Matches the active label style</span>",
      "</alert>",
      "```",
      "",
      "## What Spin lacks, honestly",
      "",
      "Reach for the Spin equivalent below whenever a Tailwind habit is deliberately absent from the vocabulary — every omission either avoids a second way to state a theme decision or points to the roadmap item tracking it:",
      "",
      "- **`text-base` → `text-md` (or bare `<p>`):** Use `text-md` or write a bare `<p>` when you want the body font-size step. The type scale uses the same `2xs`–`3xl` step names as radii, shadows, and control sizes so you never switch between `base` on type and `md` everywhere else.",
      "- **`dark:bg-*` / `light:bg-*` → `bg-surface` + `data-mode=\"dark\"`:** Switch modes with `data-mode=\"light\"` or `data-mode=\"dark\"` instead of prefixing utilities with `dark:` or `light:`. Your theme declares its own dark values under `$modes.dark`, so a single role class repaints cleanly in both modes (see [Color & Dark Mode](/docs/styling/color#dark-mode)).",
      "- **`container` / `@container` / `@md:*` → `mx-auto w-full max-w-screen-lg`:** Cap and center columns explicitly with `mx-auto`, `w-full`, and a named breakpoint measure such as `max-w-screen-lg` or `max-w-lg` so the stopping edge is visible in markup. Container-query variants (`@container`, `@md:`) are not yet in the vocabulary and are tracked on the post-launch roadmap (see [Space, Layout & Responsive](/docs/styling/space#responsive)).",
      "- **`bg-[#fff]` / `bg-blue-500` / `text-[14px]` → `bg-surface` / `bg-primary` / `text-sm`:** Reach for semantic color roles (`bg-surface`, `bg-primary`, `text-text-muted`) and declared `font.size.*` steps (`text-2xs` through `text-3xl`), or add a token to `spin/<name>.json`. Default numbered color palettes and bracketed color or font-size literals are omitted so switching themes never leaves unthemed colors or off-scale type behind.",
      "",
      "Declare any repeated flex or grid arrangements your project wants to name (such as `stack`, `row`, or `split`) under `spin.vite({ shortcuts })` in your bundler config — the preset ships no built-in layout shortcuts of its own so every composition name in your templates is one your project chose (see [Space, Layout & Responsive](/docs/styling/space#compositions) and browse every shipped utility rule in the [Utility Reference](/docs/styling/catalog)).",
    ].join("\n");
  }
  if (routePath === "/docs/styling/prose") {
    return [
      "## Elements Arrive With Their Voice",
      "",
      "Write `<h1>` and get the page's loudest statement; write `<p>` and get the reading voice; write `<small>` and get the small print. Each element carries one of your theme's named styles by default:",
      "",
      "- `<h1>` reads `type-display`, `<h2>` reads `type-title`, `<h3>` reads `type-heading` — from `font.style.display`, `font.style.title`, `font.style.heading`.",
      "- `<h4>` reads `type-label`, `<h5>` and `<h6>` read `type-overline` — from `font.style.label`, `font.style.overline`.",
      "- `<p>` reads `type-body`, `<strong>` reads `type-body-strong` — from `font.style.body`, `font.style.body-strong`.",
      "- `<blockquote>` reads `type-quote`, `<code>` reads `type-code`, `<a>` reads `type-link` — from `font.style.quote`, `font.style.code`, `font.style.link`.",
      "- `<small>` reads `type-caption`, `<figcaption>` reads `type-caption-strong` — from `font.style.caption`, `font.style.caption-strong`.",
      "",
      "## One Class Changes the Voice",
      "",
      "Write one `type-<name>` class to spend the whole tuple (face, size, weight, tracking, leading) at once. Sizing and weighing by hand with `text-sm` or `font-medium` names nothing your theme can make, so the build fails and names the style to write instead. The remaining styles with no element default are `type-lead` (from `font.style.lead`) and `type-stat` (from `font.style.stat`).",
      "",
      "## Styles Attach Anywhere",
      "",
      "Put a theme-declared style on any element (`<span class=\"type-caption\">`); the only constraint is the vocabulary — the style must be one your theme declares. Where a style sits is advice, never a rule.",
      "",
      "## The Theme Owns the Set",
      "",
      "The styles are your theme's `font.style.*` entries in `spin/<name>.json` (or the Studio Styles section); the `font.size.*` steps are the ladder the styles are built from, so moving a step moves every style that stands on it.",
      "",
      "## Lists: UI Reset vs. Document Prose",
      "",
      "- Bare `<ul>` / `<ol>`: Reset to `margin: 0; padding: 0; list-style: none` in the base layer.",
      "- `<prose> <ul>` / `<ol>`: Restores `disc` and `decimal` markers and inline-start padding.",
      "- `row-list`: Horizontal flex list (`display: flex; align-items: center; list-style-type: none; margin: 0; padding: 0`) that zeroes `li + li` top margin.",
      "- `flow-list`: Vertical list with markers off and theme-spaced `li + li` block gaps.",
      "",
      "## The Escape, Honestly",
      "",
      "Genuinely one-off display type (a brand lockup, a hero moment) carries `data-spin-escape`, which tells the ownership rules its classes are deliberate — while `closed-vocabulary` still fires there. If you reach for it twice, the theme is missing a style worth naming (see [Lints & Diagnostics](/docs/tooling/lints)).",
    ].join("\n");
  }
  if (routePath === "/docs/styling/color") {
    return [
      "## Roles, not colors",
      "",
      "Write `bg-primary`, `text-text-muted`, and `border-border` to name the job an element performs on the page, never the pigment it wears. The theme chooses what primary is; your markup chooses where primary goes. Switch starter themes or toggle light and dark mode and every role repaints from the active palette without changing a class name:",
      "",
      "- **Page surface:** `bg-surface`, `text-text-muted`, `border-border`",
      "- **Raised surface:** `bg-surface-raised`, `border-border`",
      "- **Primary role:** `bg-primary`, `text-on-primary`",
      "- **Secondary role:** `bg-secondary`, `text-on-secondary`",
      "- **Accent role:** `bg-accent`, `text-on-accent`",
      "",
      "## Every fill has its ink",
      "",
      "Pair every painted surface with the foreground ink built to sit on it: write `bg-primary` with `text-on-primary`, or `bg-semantic-error` with `text-on-semantic-error`. Every pair stays readable in both light and dark mode, verified by the [theme gates](/docs/themes/validation); on `bg-surface` and `bg-surface-raised`, body copy already inherits the page's default ink and needs no ink class of its own. Leave a painted fill without its paired ink — or restate an ink the element already carries — and [the lint](/docs/tooling/lints) offers the matching class before you ship.",
      "",
      "- `bg-primary` + `text-on-primary`",
      "- `bg-secondary` + `text-on-secondary`",
      "- `bg-accent` + `text-on-accent`",
      "- `bg-selected` + `text-on-selected`",
      "- `bg-semantic-success` + `text-on-semantic-success`",
      "- `bg-semantic-warning` + `text-on-semantic-warning`",
      "- `bg-semantic-error` + `text-on-semantic-error`",
      "- `bg-semantic-info` + `text-on-semantic-info`",
      "- `bg-disabled` + `text-on-disabled`",
      "",
      "Browse the full set of required color roles, status inks, and contrast floors in the [Token Reference](/docs/themes/reference).",
      "",
      "## Dark mode is a theme, not a variant",
      "",
      "Write each color utility once and switch modes with `data-mode=\"light\"` or `data-mode=\"dark\"` on `<html>` or on any nested container — never by scattering `dark:` classes across your templates. Because the dark theme declares its own token values, one class has two honest answers; per-class theme patches would say \"your theme is incomplete\" while appearing to fix it one element at a time.",
      "",
      "```html",
      "<div data-theme=\"spin\" data-mode=\"dark\" class=\"rounded-lg border border-border bg-surface p-4\">",
      "  <div class=\"flex items-center justify-between gap-3 rounded-md border border-border bg-surface-raised p-3\">",
      "    <div>",
      "      <strong>Release channel</strong>",
      "      <div class=\"text-text-muted\">Production traffic is healthy</div>",
      "    </div>",
      "    <span class=\"rounded-sm bg-semantic-success px-2 py-1 text-on-semantic-success\">",
      "      Healthy",
      "    </span>",
      "  </div>",
      "  <div class=\"mt-3 flex items-center gap-2\">",
      "    <button type=\"button\" class=\"primary\">Deploy now</button>",
      "    <button type=\"button\">Inspect logs</button>",
      "  </div>",
      "</div>",
      "```",
      "",
      "## Thinning without minting",
      "",
      "Append an `/0`–`/100` alpha suffix such as `bg-surface/80`, `bg-primary/60`, or `border-border/50` to mix any color role toward transparency via `color-mix(in srgb, …)` so the color stays the theme's while only the strength is yours:",
      "",
      "- `bg-primary/100`, `bg-primary/80`, `bg-primary/60`, `bg-primary/40`, `bg-primary/20`, `bg-primary/0`",
      "- `bg-surface/80`, `border-border/50`",
      "",
      "## What the scale doesn't do",
      "",
      "Write a raw color literal into a bracket class like `bg-[#fff]`, `text-[rgb(0,0,0)]`, or `border-[red]` and the stylesheet emits nothing for it, because a color written in a class is a value the theme never chose; use a semantic role or declare a token under `color.*` in `spin/<name>.json` instead.",
      "",
      "Write `border-current`, `bg-current`, or `text-current` (including alpha suffixes like `border-current/20`) when a border, divider, or icon should inherit the element's computed text color; camelCase `currentColor` (`border-currentColor`, `bg-currentColor`) and `transparent` (`bg-transparent`, `border-transparent`) resolve alongside them.",
      "",
      "Leave `dark:` and `light:` variant prefixes out of your class lists — neither variant exists by design ([Dark mode is a theme, not a variant](#dark-mode)), not by omission, so every mode switch flows through your theme tokens and `data-mode`.",
    ].join("\n");
  }
  if (routePath === "/docs/styling/space") {
    return [
      "## Space comes from the scale",
      "",
      "Write `p-4`, `gap-2`, or `m-0` to pad a box, space a row, or clear a margin using a step from your theme's spacing scale (`spacing.*`). Because every padding, margin, gap, and step-sized width or height (`w-4`, `h-4`) reads the same scale, tightening or loosening your theme in the Studio or in `spin/<name>.json` rescales the whole page at once. Write a step your theme never declared and it renders nothing — [the build and lint](/docs/tooling/lints) name the missing class before you ship; for half-steps the scale omits, reach for the nearest neighbor (`gap-1` or `gap-2` in place of `gap-1.5`).",
      "",
      "- **Declared starter steps (`spacing.*`):** `0`, `1`, `2`, `3`, `4`, `5`, `6`, `7`, `8`, `10`, `12`, `14`, `16`, `20`, `24`, `36`, `40`, `56`, `60`, `64` (`p-<step>`, `px-<step>`, `py-<step>`, `ps-<step>`, `pe-<step>`, `m-<step>`, `gap-<step>`, `w-<step>`, `h-<step>`)",
      "",
      "Browse every directional axis (`px-*`, `py-*`, `ps-*`, `pe-*`, `mx-auto`) in the [Utility Reference](/docs/styling/catalog#spacing) and the full `spacing.*` token group in the [Token Reference](/docs/themes/reference#groups).",
      "",
      "## Compose your own layout words",
      "",
      "Compose flex and grid utilities directly (`flex`, `flex-col`, `items-center`, `justify-between`, `gap-4`) while a layout is taking shape, then name the arrangements your project repeats. Because the preset ships no built-in layout shortcuts, every composition word in your markup (`stack`, `row`, `split`) is one your project chose:",
      "",
      "```html",
      "<!-- Before — raw utilities on every container -->",
      "<div class=\"flex flex-col gap-4 rounded-lg border border-border bg-surface p-4\">",
      "  <div class=\"flex items-center justify-between gap-4\">",
      "    <strong>Release pipeline</strong>",
      "    <badge variant=\"success\">Ready</badge>",
      "  </div>",
      "  <div class=\"flex items-center gap-4\">",
      "    <button type=\"button\" class=\"primary\">Promote build</button>",
      "    <button type=\"button\">Compare diff</button>",
      "  </div>",
      "</div>",
      "",
      "<!-- After — named compositions (stack, split, row) -->",
      "<div class=\"stack rounded-lg border border-border bg-surface p-4\">",
      "  <div class=\"split\">",
      "    <strong>Release pipeline</strong>",
      "    <badge variant=\"success\">Ready</badge>",
      "  </div>",
      "  <div class=\"row\">",
      "    <button type=\"button\" class=\"primary\">Promote build</button>",
      "    <button type=\"button\">Compare diff</button>",
      "  </div>",
      "</div>",
      "```",
      "",
      "Promote a utility list to a named composition the third time you write the same arrangement across your templates, and declare it under `spin.vite({ shortcuts })` in your bundler config (see the full plugin setup on [Install & Bundlers](/docs/getting-started/install#config)). Every composition still spends your theme's spacing scale — `gap-4` inside `stack`, `row`, and `split` rescales whenever the theme changes — and the build verifies both the composition name and the utilities it expands to:",
      "",
      "```ts",
      "import { spin } from \"@spinjs/spin/vite\";",
      "",
      "export default {",
      "  plugins: [",
      "    spin.vite({",
      "      shortcuts: {",
      "        stack: \"flex flex-col gap-4\",",
      "        row: \"flex items-center gap-4\",",
      "        split: \"flex items-center justify-between gap-4\",",
      "      },",
      "    }),",
      "  ],",
      "};",
      "```",
      "",
      "## Responsive is the theme's breakpoints",
      "",
      "Prefix any utility with `sm:`, `md:`, `lg:`, or `xl:` to apply it at or above that viewport width, or write `max-md:` to apply it only below that edge. Each prefix reads its width from your theme's `breakpoint.*` tokens — when a project seats multiple themes, the first theme's breakpoint widths set the media queries for the stylesheet — and `max-w-screen-sm` through `max-w-screen-xl` cap a layout column to those same edges:",
      "",
      "```html",
      "<div class=\"mx-auto w-full max-w-screen-lg rounded-lg border border-border bg-surface p-4\">",
      "  <div class=\"flex flex-col gap-2 md:flex-row md:items-center md:justify-between\">",
      "    <strong>Edge regions</strong>",
      "    <badge variant=\"info\" class=\"max-md:inline-flex md:hidden\">Compact view</badge>",
      "  </div>",
      "  <div class=\"mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3\">",
      "    <card><card-header><card-title>us-east</card-title></card-header></card>",
      "    <card><card-header><card-title>eu-central</card-title></card-header></card>",
      "    <card><card-header><card-title>ap-northeast</card-title></card-header></card>",
      "  </div>",
      "</div>",
      "```",
      "",
      "Center and cap a page column explicitly with `mx-auto w-full max-w-screen-lg` (or a project composition) rather than a `container` class: `container` is omitted because a single automatic width rule hides which breakpoint edge the column stops at, and container-query variants (`@container`, `@md:`) are not yet part of the vocabulary and are tracked on the post-launch roadmap.",
      "",
      "## Positioning, anchors, and the top layer",
      "",
      "Place a badge or floating control inside a `relative` parent with `absolute` or `fixed` and a spacing-scale offset (`top-1`, `right-1`, `top-2`, `inset-0`), and order overlapping surfaces with your theme's named `z-*` layers (`z-base`, `z-dropdown`, `z-modal`, `z-toast`) inside an `isolate` container instead of guessing magic numbers. When a menu or native `[popover]` renders in the top layer, `absolute top-full` measures against the viewport rather than the button that opened it — name the trigger with `anchor-<name>` and pin the panel to it with `position-anchor-<name>` and a `position-area-*` placement (`position-area-bottom-span-right`, `position-area-top`):",
      "",
      "```html",
      "<div class=\"isolate relative\">",
      "  <button type=\"button\" class=\"relative anchor-release-menu\">",
      "    <span>Release targets</span>",
      "    <span class=\"absolute top-1 right-1 h-2 w-2 rounded-full bg-primary text-on-primary\"></span>",
      "  </button>",
      "",
      "  <div class=\"z-dropdown position-anchor-release-menu position-area-bottom-span-right rounded-md border border-border bg-surface-raised p-3 shadow-lg\">",
      "    <strong>Pinned to trigger</strong>",
      "    <small>Opens in the top layer under --release-menu</small>",
      "  </div>",
      "</div>",
      "```",
      "",
      "Size any `i-*` glyph (`i-lucide-compass`, `i-lucide-layers`, `i-lucide-sparkles`) with `icon-sm`, `icon-md`, or `icon-lg` so its box reads your theme's `icon.*` scale and aligns inline on the text baseline.",
      "",
      "## The bare escape",
      "",
      "Add `bare` to a `<button>` (or `<input class=\"bare\">`) when a custom trigger — a tab chip, a command-bar launcher, a disclosure header, or an inline tag editor — needs native button or input semantics and keyboard focus without wearing default button chrome. Adding `bare` strips the control's background fill, border width, corner radius, shadow, minimum height, and label weight while keeping `cursor: pointer` and focus-ring behavior intact. Because `bare` opts out of the element's default paint, any `bare` box that adds a fill (`bg-primary`, `bg-surface`) names its paired foreground ink (`text-on-primary`, `text-text-muted`) explicitly — reach for `bare` only when `.secondary` or `.ghost` still carries more chrome than the surface allows:",
      "",
      "```html",
      "<!-- Standard ghost button: keeps button height, padding, and weight -->",
      "<button type=\"button\" class=\"ghost\">Ghost action</button>",
      "",
      "<!-- Unpainted bare trigger: keeps <button> semantics, strips button chrome -->",
      "<button",
      "  type=\"button\"",
      "  class=\"bare inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-1 text-sm text-text-muted\"",
      ">",
      "  <span>Command palette</span>",
      "  <kbd>⌘K</kbd>",
      "</button>",
      "",
      "<!-- Painted bare trigger: names its paired ink explicitly -->",
      "<button",
      "  type=\"button\"",
      "  class=\"bare inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-on-primary\"",
      ">",
      "  <span>Live filter</span>",
      "</button>",
      "```",
    ].join("\n");
  }
  if (routePath === "/docs/styling/animation") {
    const animations = animationContract.variants
      .map((v) => `- \`${v}\``)
      .join("\n");
    return [
      "## Motion comes from the theme",
      "",
      "Hover a button or mount a card and you never write millisecond values or cubic-bezier curves in your markup. How long things take and how they ease are set once in the theme, so every transition and entrance on the page agrees.",
      "",
      "```html",
      "<button type=\"button\" class=\"primary\">",
      "  Hover to feel the button transition",
      "</button>",
      "",
      "<card class=\"animate-slide-up\">",
      "  <card-header>",
      "    <card-title>Deployment ready</card-title>",
      "    <card-description>Arrives on the same theme curve.</card-description>",
      "  </card-header>",
      "</card>",
      "```",
      "",
      "Change the theme's timing in the Studio or your theme file — or switch starter themes in the top bar right now — and both follow together (see the motion scale steps in the [Token Reference](/docs/themes/reference#groups)).",
      "",
      "## Transitions for state, keyframes for entrances",
      "",
      "Use transition utilities when an element stays on screen and changes state, and use a named entrance when an element arrives or asks for attention. State changes like `hover:` or an open/close toggle pair `transition-colors` with a speed step (`duration-fast`, `duration-base`) and a curve (`ease-standard`, `ease-decelerate`); mounting moments use a named entrance such as `animate-fade-in` or `animate-slide-up`.",
      "",
      "```html",
      "<div",
      "  tabindex=\"0\"",
      "  class=\"rounded-md border border-border bg-surface-raised px-4 py-3 text-text-muted transition-colors duration-fast ease-standard hover:border-primary hover:bg-surface\"",
      ">",
      "  Hover or focus to transition state",
      "</div>",
      "",
      "<card class=\"animate-fade-in\">",
      "  <div class=\"row-sm\">",
      "    <span class=\"i-lucide-check icon-sm text-primary\" aria-hidden=\"true\"></span>",
      "    <span>Preview environment mounted</span>",
      "  </div>",
      "</card>",
      "```",
      "",
      "## Respect is automatic",
      "",
      "Turn on reduced motion in your operating system or browser and every transition and entrance on the page settles immediately without a single media-query class in your markup: your visitors who asked for less motion get it through `@media (prefers-reduced-motion: reduce)`, and continuous loops like `animate-spin` and `animate-pulse` carry a `250ms` floor so loops that could strobe can't. Both guarantees are verified automatically by [theme validation](/docs/themes/validation) and [browser checks](/docs/tooling/check).",
      "",
      "## Every entrance and loop, live",
      "",
      "Click any class on `/docs/styling/animation#keyframes` to preview every entrance and loop the system ships against the active theme:",
      "",
      animations,
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
  const animations = animationContract.variants
    .map((v) => `\`${v}\``)
    .join(", ");
  return [
    "## Utility Catalog by Intent",
    "",
    sections,
    "",
    "## Project Shortcuts (Not Shipped)",
    "",
    "Spin ships no shortcuts of its own. Declare compositions in your",
    "project's `spin.vite({ shortcuts: { ... } })` — the worked example lives",
    "on `/docs/getting-started/install#config`. The docs site declares:",
    "",
    ...Object.entries(docsShortcuts)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, expansion]) => `- \`${name}\` → \`${expansion}\``),
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

/**
 * The docs' own compositions.
 *
 * Spin ships none of its own, so the docs declare the compositions their
 * pages repeat: the vertical stacks and the horizontal rows their examples
 * lay out in. The lint reads this file, so a class the docs declare is a
 * class the lint knows.
 */
const docsShortcuts: Record<string, string> = {
  /** A column of items with a consistent gap. */
  "stack-sm": "flex flex-col gap-2",
  "stack-xs": "flex flex-col gap-1",
  stack: "flex flex-col gap-4",
  /** A horizontal row of items. */
  "row-sm": "flex items-center gap-2",
  row: "flex items-center gap-4",
  /** A row that gives its ends to their owners. */
  split: "flex items-center justify-between gap-4",
};

export default defineConfig({
  plugins: [
    jibeIsolation(),
    jibeStudio(),
    solid(),
    markdownForAgents(),
    spin.vite({
      extends: { themes: starterThemes },
      shortcuts: docsShortcuts,
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
