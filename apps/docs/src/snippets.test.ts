import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spin } from "../../../packages/spin/src/plugin/plugin.ts";
import { spinPreset } from "../../../packages/spin/src/compiler/index.ts";
import { themeGates } from "../../../packages/spin/src/theme/index.ts";
import { parseArgs } from "../../../packages/spin/src/diagnostics/cli.ts";
import { mountSpinApp } from "../../../packages/spin/src/api/index.ts";
import { starterThemes } from "../../../packages/spin/src/theme/themes/index.ts";
import { SNIPPETS } from "./snippets.ts";

const ROOT = resolve(import.meta.dir, "../../..");
const PACKAGES: Readonly<Record<string, string>> = {
  "@spinjs/spin": "packages/spin",
  "@spinjs/runtime": "packages/runtime",
  "@spinjs/components": "packages/components",
};

/** Every `@spinjs/...` specifier in the snippets, deduplicated. */
function specifiers(): readonly string[] {
  const found = new Set<string>();
  for (const code of Object.values(SNIPPETS)) {
    for (const match of code.match(/@spinjs\/[a-z0-9-]+(?:\/[a-z0-9./-]+)?/g) ?? []) {
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

describe("Start-here snippets", () => {
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
    expect(kind(SNIPPETS.lint)).toBe("lint");
    expect(kind(SNIPPETS.lintFix)).toBe("lint");
    expect(kind(SNIPPETS.studioServe)).toBe("studio");
    expect(kind(SNIPPETS.mcp)).toBe("mcp");
  });

  test("the MCP config names the stdio server", () => {
    const config = JSON.parse(SNIPPETS.mcpConfig) as {
      readonly mcpServers: {
        readonly spin: {
          readonly command: string;
          readonly args: readonly string[];
        };
      };
    };
    expect(config.mcpServers.spin.command).toBe("npx");
    expect(config.mcpServers.spin.args).toContain("mcp");
    expect(config.mcpServers.spin.args).toContain("--root");
  });

  test("the starter themes are a non-empty document map", () => {
    expect(Object.keys(starterThemes).length).toBeGreaterThan(0);
  });
});
