import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { defineConfig } from "vite";
import type { Plugin } from "vite";
import solid from "vite-plugin-solid";
import presetIcons from "@unocss/preset-icons";
import { spin } from "@spinjs/spin/vite";
import { starterThemes } from "@spinjs/spin/theme/themes";
import { renderSkill } from "@spinjs/spin/skill";
import lucide from "@iconify-json/lucide/icons.json" with { type: "json" };
import { ALL_DOCS_PAGES, DOCS_GROUPS } from "./src/nav.ts";

const here = import.meta.dirname!;
const SKILL_URL = "/skill/spin-theme/SKILL.md";
const SKILL_TEMPLATE = resolve(
  dirname(createRequire(import.meta.url).resolve("@spinjs/spin/package.json")),
  "skill/SKILL.md",
);
const SKILL_DIR = dirname(SKILL_TEMPLATE);
const STYLES_URL = "/skill/spin-theme";
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

function houseSkill(): Plugin {
  const text = (): string => renderSkill(readFileSync(SKILL_TEMPLATE, "utf8"));
  const styles = (): { file: string; source: string }[] =>
    readdirSync(SKILL_DIR)
      .filter((name) => name.endsWith(".md") && name !== "SKILL.md")
      .sort()
      .map((name) => ({
        file: `${name}`,
        source: readFileSync(resolve(SKILL_DIR, name), "utf8"),
      }));
  return {
    name: "spin:house-skill",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = (req.url ?? "").split("?")[0] ?? "";
        if (url === SKILL_URL) {
          res.setHeader("content-type", "text/markdown; charset=utf-8");
          res.end(text());
          return;
        }
        if (!url.startsWith(`${STYLES_URL}/`)) return next();
        const name = url.slice(STYLES_URL.length + 1);
        const found = styles().find((style) => style.file === name);
        if (found === undefined) return next();
        res.setHeader("content-type", "text/markdown; charset=utf-8");
        res.end(found.source);
      });
    },
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "skill/spin-theme/SKILL.md",
        source: text(),
      });
      for (const style of styles()) {
        this.emitFile({
          type: "asset",
          fileName: `skill/spin-theme/${style.file}`,
          source: style.source,
        });
      }
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
    "> Spin is a theme-driven UI system: DTCG design tokens, classless HTML element rules, closed-scale UnoCSS utilities, and headless state-machine components.",
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
  lines.push(
    "## Skills & References",
    "",
    `- [Spin Theme Authoring Skill](${SKILL_URL}): Complete DTCG token contract and six-gate validation guide for agents.`,
    "",
  );
  return lines.join("\n");
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
    houseSkill(),
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
