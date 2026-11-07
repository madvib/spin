import type { Plugin } from "vite";
import { ALL_DOCS_PAGES } from "../../src/shell/nav.ts";
import { buildLlmsTxt, buildMarkdownForRoute } from "../markdown/index.ts";

const AGENT_CONTENT_SIGNAL = "ai-train=yes, search=yes, ai-input=yes";

export function markdownForAgents(): Plugin {
  return {
    name: "spin:markdown-for-agents",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const rawUrl = (req.url ?? "").split("?")[0] ?? "";
        if (rawUrl === "/llms.txt") {
          res.setHeader("content-type", "text/markdown; charset=utf-8");
          res.setHeader("vary", "Accept");
          res.setHeader("content-signal", AGENT_CONTENT_SIGNAL);
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
        res.setHeader("content-signal", AGENT_CONTENT_SIGNAL);
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
