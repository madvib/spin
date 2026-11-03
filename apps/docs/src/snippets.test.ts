import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spin } from "../../../packages/spin/src/plugin/plugin.ts";
import { spinPreset } from "../../../packages/spin/src/compiler/index.ts";
import { starterThemes, themeGates } from "../../../packages/spin/src/theme/index.ts";
import { parseArgs } from "../../../packages/spin/src/diagnostics/cli.ts";
import { mountSpinApp } from "../../../packages/spin/src/api/index.ts";
import { GETTING_STARTED_SNIPPETS } from "./pages/docs/getting-started/getting-started.snippets.ts";
import { THEMES_SNIPPETS } from "./pages/docs/themes/themes.snippets.ts";
import { AUTHORING_SNIPPETS } from "./pages/docs/authoring/authoring.snippets.ts";
import { TOOLING_SNIPPETS } from "./pages/docs/tooling/tooling.snippets.ts";

const ALL_SNIPPETS = {
  ...GETTING_STARTED_SNIPPETS,
  ...THEMES_SNIPPETS,
  ...AUTHORING_SNIPPETS,
  ...TOOLING_SNIPPETS,
} as const;

const ROOT = resolve(import.meta.dir, "../../..");
const PACKAGES: Readonly<Record<string, string>> = {
  "@spinjs/spin": "packages/spin",
  "@spinjs/runtime": "packages/runtime",
  "@spinjs/components": "packages/components",
};

function specifiers(): readonly string[] {
  const found = new Set<string>();
  for (const code of Object.values(ALL_SNIPPETS)) {
    for (
      const match of code.match(/@spinjs\/[a-z0-9-]+(?:\/[a-z0-9./-]+)?/g) ?? []
    ) {
      found.add(match);
    }
  }
  return [...found];
}

function splitSpecifier(specifier: string): {
  readonly pkg: string;
  readonly subpath: string;
} {
  const [scope, name, ...rest] = specifier.split("/");
  return { pkg: `${scope}/${name}`, subpath: rest.join("/") };
}

describe("Per-subgroup docs snippets", () => {
  test("every package specifier resolves to a workspace export", () => {
    for (const specifier of specifiers()) {
      const { pkg, subpath } = splitSpecifier(specifier);
      const dir = PACKAGES[pkg];
      if (dir === undefined) throw new Error(`unknown package in ${specifier}`);
      const manifest = JSON.parse(
        readFileSync(resolve(ROOT, dir, "package.json"), "utf8"),
      ) as {
        readonly name: string;
        readonly exports?: Readonly<Record<string, unknown>>;
      };
      expect(manifest.name).toBe(pkg);
      if (subpath !== "") {
        if (manifest.exports?.[`./${subpath}`] === undefined) {
          throw new Error(`${specifier} is not an export of ${pkg}`);
        }
      }
    }
  });

  test("the plugin and the Studio entry are callable as documented", () => {
    expect(typeof spin).toBe("object");
    for (
      const shape of [
        "vite",
        "rollup",
        "rspack",
        "webpack",
        "rolldown",
        "esbuild",
        "bun",
      ] as const
    ) {
      expect(typeof spin[shape]).toBe("function");
    }
    expect(typeof mountSpinApp).toBe("function");
    expect(typeof spinPreset).toBe("function");
    expect(typeof themeGates).toBe("function");
  });

  test("the CLI samples parse as the commands they name", () => {
    const args = (sample: string): readonly string[] =>
      sample.replace(/^npx spin\s+/, "").split(/\s+/);
    const kind = (sample: string): string => {
      const command = parseArgs(args(sample));
      return "kind" in command ? command.kind : "lint";
    };
    expect(kind(TOOLING_SNIPPETS.lint)).toBe("lint");
    expect(kind(TOOLING_SNIPPETS.lintFix)).toBe("lint");
    expect(kind(TOOLING_SNIPPETS.studioServe)).toBe("studio");
    expect(kind(TOOLING_SNIPPETS.mcp)).toBe("mcp");
  });

  test("the MCP config names the stdio server", () => {
    const config = JSON.parse(TOOLING_SNIPPETS.mcpConfig) as {
      readonly mcpServers: {
        readonly spin: {
          readonly command: string;
          readonly args: readonly string[];
        };
      };
    };
    expect(config.mcpServers.spin.command).toBe("npx");
    expect(config.mcpServers.spin.args).toEqual(["spin", "mcp"]);
  });

  test("the starter themes are a non-empty document map", () => {
    expect(Object.keys(starterThemes).length).toBeGreaterThan(0);
  });
});
