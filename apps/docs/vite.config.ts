import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vite";
import type { Plugin } from "vite";
import solid from "vite-plugin-solid";
import presetIcons from "@unocss/preset-icons";
import { spin } from "../../packages/preset/src/plugin.ts";
import { spinElements } from "../../packages/runtime/src/plugin/elements.ts";
import { mountSpinApp } from "../../packages/api/src/index.ts";
import { renderSkill } from "../../packages/theme/src/skill/index.ts";
import lucide from "@iconify-json/lucide/icons.json" with { type: "json" };

const here = import.meta.dirname!;

/** Where the house skill is served, and the file it is assembled from. */
const SKILL_URL = "/skill/spin-theme/SKILL.md";
const SKILL_TEMPLATE = resolve(here, "../../packages/theme/skill/SKILL.md");

/** The style references, and the directory they travel in. */
const SKILL_DIR = resolve(here, "../../packages/theme/skill");
const STYLES_URL = "/skill/spin-theme";

/**
 * The house skill, served from the theme module.
 *
 * The skill is the theme module's manual, so it lives there: the module
 * assembles it from its own contract, and the site serves those bytes rather
 * than a copy of them. The file an agent installs and the file the page
 * presents are therefore the same file, and the checklist inside it is the
 * contract's own group list rather than a copy that can fall behind.
 *
 * The style references travel with it, in the skill's own directory, and are
 * served from the same place: the skill and its styles are one product, and an
 * agent that installs one installs the other.
 */
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
        const url = (req.url ?? "").split("?")[0];
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

/**
 * The docs eat the product's own food.
 *
 * Themes come from `@spin/theme/themes` — the shipped registry, not copies
 * on disk. A starter fixed in the package re-themes this site on the next
 * build, and the site demos the brand posture honestly: `spin`, dark or
 * paper, chosen from the header switcher. No `resolve` block: the plugin
 * carries the specifier table.
 */
export default defineConfig({
  plugins: [
    spinElements({ machines: resolve(here, "../../packages/components/src") }),
    solid(),
    spin.vite({
      // No `themes` option: the app serves the shipped starters, forked by
      // `spin/*.json` off this root — the files the studio edits when a
      // theme is saved. This site defines no themes of its own.
      // Icons compose alongside the preset: the product does not ship them,
      // and the pages that show elements show their icons too.
      presets: [presetIcons({ collections: { lucide } as never })],
      mount: mountSpinApp(here, {
        studioDir: resolve(here, "../studio/dist"),
      }),
      content: {
        filesystem: [
          // The examples carry the classes a consumer writes; scanning them
          // directly is what makes the rendered rows resolve without a
          // safelist of our own.
          resolve(
            here,
            "../../packages/preset/src/rules/primitives/*.examples.ts",
          ),
          resolve(here, "src/**/*.{tsx,ts}"),
          // Machine component examples: `.html` files compiled by
          // spinElements above. Mirrors the reference app.
          resolve(here, "../../packages/components/src/*/examples/*.html"),
        ],
      },
    }),
  ],
});
