import { describe, expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { spin } from "../../../../packages/dev/src/plugin/plugin.ts";
import { describeCatalog, spinPreset } from "@spinjs/preset";
import {
  indexTree,
  ownedStyleNames,
  parseTokens,
  resolveAliases,
  designLanguages,
  themeGates,
} from "../../../../packages/theme/src/index.ts";
import { parseArgs } from "../../../../packages/dev/src/cli/main.ts";
import { mountSpinApp } from "../../../../packages/dev/src/api/index.ts";
import { GETTING_STARTED_SNIPPETS } from "../pages/docs/getting-started/getting-started.snippets.ts";
import { THEMES_SNIPPETS } from "../pages/docs/themes/themes.snippets.ts";
import { AUTHORING_SNIPPETS } from "../pages/docs/authoring/authoring.snippets.ts";
import { TOOLING_SNIPPETS } from "../pages/docs/tooling/tooling.snippets.ts";
import { PAIRS } from "../pages/docs/tooling/lints.specimens.ts";
import {
  DEFAULT_SEMANTIC_OPTIONS,
  lintMarkup,
  RULE_NAMES,
} from "../../../../packages/diagnostics/src/index.ts";
import { engineAnswers } from "../../../../packages/preset/src/index.ts";

const ALL_SNIPPETS = {
  ...GETTING_STARTED_SNIPPETS,
  ...THEMES_SNIPPETS,
  ...AUTHORING_SNIPPETS,
  ...TOOLING_SNIPPETS,
} as const;

const ROOT = resolve(import.meta.dir, "../../../..");
const PACKAGES: Readonly<Record<string, string>> = {
  "@spinjs/dev": "packages/dev",
  "@spinjs/components/runtime": "packages/components",
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
});

const STYLING_DIR = resolve(import.meta.dir, "../pages/docs/styling");

/**
 * The `type-<name>` classes the docs actually wear: `class="..."` and
 * `class={\`...\`}` attributes plus backtick snippet literals. Prose that
 * merely names a class (\"type-headline fails the build\") is not worn and
 * is excluded — a doc may say a class fails without failing currency.
 */
function wornTypeClasses(sources: readonly string[]): ReadonlySet<string> {
  const found = new Set<string>();
  const attr = /class=(?:"([^"]*)"|\{`([\s\S]*?)`\}|"([^"]*)")/g;
  const literal = /`([^`]*?)`/g;
  const cls = /\btype-[a-z][a-z0-9-]*/g;
  for (const text of sources) {
    for (const m of text.matchAll(attr)) {
      for (const part of [m[1], m[2], m[3]]) {
        if (part === undefined) continue;
        const clean = part.replace(/\$\{[^}]*\}/g, " ");
        for (const c of clean.match(cls) ?? []) found.add(c);
      }
    }
    for (const m of text.matchAll(literal)) {
      const body = m[1] ?? "";
      if (/\$\{/.test(body)) continue;
      for (const c of body.match(cls) ?? []) found.add(c);
    }
  }
  return found;
}

/**
 * Token paths a snippet or page states: `group.name` dotted paths under a
 * known theme group, inside backtick literals or prose code. Bare words
 * (`compact.spacing.json` filenames, `spin/<brand>/tokens.json` paths) are excluded
 * by requiring a real group root.
 */
function statedTokenPaths(sources: readonly string[]): ReadonlySet<string> {
  const found = new Set<string>();
  const roots =
    "color|font|spacing|radius|shadow|motion|border|focus|icon|breakpoint|opacity|link|button|card|alert|field|table|stat|badge";
  const path = new RegExp(
    `(?:^|[^A-Za-z0-9_.-])((?:${roots})\\.[A-Za-z0-9_]+(?:\\.[A-Za-z0-9_-]+)*)`,
    "g",
  );
  for (const text of sources) {
    for (const m of text.matchAll(path)) {
      const candidate = (m[1] ?? "").replace(/\.+$/, "");
      if (candidate !== "") found.add(candidate);
    }
  }
  return found;
}

describe("docs-to-catalog currency", () => {
  test("every worn type-<name> is an owned type style in the live catalog", () => {
    const pages = readdirSync(STYLING_DIR)
      .filter((file) => file.endsWith(".tsx"))
      .map((file) => readFileSync(join(STYLING_DIR, file), "utf8"));
    const sources = [
      ...pages,
      ...Object.values(THEMES_SNIPPETS),
    ];
    const worn = wornTypeClasses(sources);
    expect(worn.size).toBeGreaterThan(0);
    const owned = new Set(ownedStyleNames());
    const parsed = parseTokens(
      designLanguages.editorial as unknown as Parameters<typeof parseTokens>[0],
    );
    if (!parsed.ok) throw new Error(parsed.error);
    const catalog = new Set(
      describeCatalog(parsed.tree).flatMap((section) => section.utilities),
    );
    for (const cls of worn) {
      const name = cls.slice("type-".length);
      if (!owned.has(name)) {
        throw new Error(
          `${cls} is worn by the docs but is not an owned type style (${[...owned].join(", ")})`,
        );
      }
      expect(catalog.has(cls)).toBe(true);
    }
  });

  test("every stated token path resolves in the live theme tree", () => {
    const pages = readdirSync(STYLING_DIR)
      .filter((file) => file.endsWith(".tsx"))
      .map((file) => readFileSync(join(STYLING_DIR, file), "utf8"));
    const sources = [
      ...pages,
      ...Object.values(THEMES_SNIPPETS),
    ];
    const stated = statedTokenPaths(sources);
    expect(stated.size).toBeGreaterThan(0);
    const parsed = parseTokens(
      designLanguages.editorial as unknown as Parameters<typeof parseTokens>[0],
    );
    if (!parsed.ok) throw new Error(parsed.error);
    const index = indexTree(resolveAliases(parsed.tree).tree);
    for (const path of stated) {
      // Type-style targets (`card.title`, `stat.value`) are token groups now:
      // the `.type` tuples live under them, so they resolve in the tree.
      // A stated prefix of a deeper leaf (color.neutral, font.size) counts:
      // the docs name families as well as leaves.
      const hit = Object.keys(index.nodes).some(
        (known) => known === path || known.startsWith(`${path}.`),
      );
      if (!hit) {
        throw new Error(
          `${path} is stated by the docs but resolves in no shipped language tree node`,
        );
      }
    }
  });
});

describe("lints page specimens", () => {
  test("every bad specimen trips its rule and every good specimen is clean", async () => {
    const parsed = parseTokens(
      designLanguages.editorial as unknown as Parameters<typeof parseTokens>[0],
    );
    if (!parsed.ok) throw new Error(parsed.error);
    const answers = engineAnswers([designLanguages.editorial]);
    const run = {
      rules: RULE_NAMES,
      semantic: DEFAULT_SEMANTIC_OPTIONS,
      answers,
    };
    expect(PAIRS.length).toBeGreaterThan(0);
    for (const pair of PAIRS) {
      const bad = await lintMarkup("specimen.html", pair.bad, run);
      if (!bad.some((finding) => finding.ruleId === pair.rule)) {
        throw new Error(
          `${pair.rule} specimen does not trip its rule: ${JSON.stringify(bad.map((f) => f.ruleId))}`,
        );
      }
      const good = await lintMarkup("specimen.html", pair.good, run);
      if (good.length > 0) {
        throw new Error(
          `${pair.rule} remedy is not clean: ${JSON.stringify(good.map((f) => `${f.ruleId}: ${f.message}`))}`,
        );
      }
    }
  });
});
