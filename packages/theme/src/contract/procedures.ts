/**
 * Implements {@link themeContract}. Each handler is a thin wrapper over the
 * pure pipeline in this package: parse the text, run the op, serialise the
 * result. No fs, no cwd, no env — project access lives in the daemon around
 * this router, never inside it.
 */

import { implement } from "@orpc/server";
import {
  generateCss,
  generateThemeCss,
  generateTypes,
} from "../pipeline/generate.ts";
import { parseTokens } from "../pipeline/parse.ts";
import {
  removeToken,
  renameToken,
  setToken,
  treeToJson,
} from "../authoring/mutate.ts";
import type { MutationResult } from "../authoring/mutate.ts";
import { scaffoldTheme } from "../authoring/scaffold.ts";
import { requiredPaths } from "./roles.ts";
import { validateLegibility } from "./schema.ts";
import { validateTokens } from "../pipeline/validate.ts";
import type { TokenTree } from "../pipeline/types.ts";
import { themeContract } from "./contract.ts";

const os = implement(themeContract);

function analyze(text: string, required?: readonly string[]) {
  const parsed = parseTokens(text);
  if (!parsed.ok) return { error: parsed.error, issues: [] };
  const report = validateTokens(parsed.tree, {
    required: required ?? requiredPaths(),
  });
  return {
    error: null,
    issues: [...report.issues, ...validateLegibility(parsed.tree)],
  };
}

function mutate(
  text: string,
  op: (tree: TokenTree) => MutationResult,
) {
  const parsed = parseTokens(text);
  if (!parsed.ok) return { error: parsed.error, text: null };
  const result = op(parsed.tree);
  // A refusal carries its code and path; the wire shape is still one string so
  // the contract stays stable, and the code is what a client should branch on.
  if (!result.ok) {
    return {
      error: result.path ? `${result.path}: ${result.detail}` : result.detail,
      text: null,
    };
  }
  return { error: null, text: treeToJson(result.tree) };
}

const analyzeTheme = os.theme.analyze.handler(({ input }) =>
  analyze(input.text, input.required)
);

const themeCss = os.theme.css.handler(({ input }) => {
  const parsed = parseTokens(input.text);
  if (!parsed.ok) return { error: parsed.error, css: "" };
  return {
    error: null,
    css: generateCss(parsed.tree, {
      ...(input.selector !== undefined ? { selector: input.selector } : {}),
      ...(input.prefix !== undefined ? { prefix: input.prefix } : {}),
    }),
  };
});

const themesCss = os.themes.css.handler(({ input }) => {
  const trees: Record<string, TokenTree> = {};
  for (const [name, text] of Object.entries(input.themes)) {
    const parsed = parseTokens(text);
    if (!parsed.ok) return { error: `${name}: ${parsed.error}`, css: "" };
    trees[name] = parsed.tree;
  }
  return {
    error: null,
    css: generateThemeCss(trees, {
      ...(input.selector !== undefined ? { selector: input.selector } : {}),
      ...(input.prefix !== undefined ? { prefix: input.prefix } : {}),
    }),
  };
});

const setTokenValue = os.theme.tokens.set.handler(({ input }) =>
  mutate(input.text, (tree) =>
    setToken(
      tree,
      input.path,
      input.value,
      input.type,
    ))
);

const removeTokenValue = os.theme.tokens.remove.handler(({ input }) =>
  mutate(input.text, (tree) => removeToken(tree, input.path))
);

const renameTokenValue = os.theme.tokens.rename.handler(({ input }) =>
  mutate(input.text, (tree) => renameToken(tree, input.from, input.to))
);

const scaffold = os.theme.scaffold.handler(({ input }) => ({
  text: treeToJson(scaffoldTheme(input?.required)),
}));

const themeTypes = os.theme.types.handler(({ input }) => {
  const parsed = parseTokens(input.text);
  if (!parsed.ok) return { error: parsed.error, types: "" };
  return { error: null, types: generateTypes(parsed.tree) };
});

/**
 * The project root a daemon was started with. Set once, by the host that
 * owns the filesystem — `Deno.serve` in the standalone daemon, the embedding
 * app in vent. Text→text handlers never read it; `project.themes.*` handlers
 * refuse without it. A module-level cell looks like a global, but it is the
 * opposite of one: it is set by exactly one caller, read by exactly the
 * filesystem procedures, and a test that never sets it gets the refusal it
 * deserves rather than a cwd it never asked for.
 */
let projectRoot: string | undefined;

export function setProjectRoot(root: string): void {
  projectRoot = root;
}

function rootOrThrow(): string {
  if (projectRoot === undefined) {
    throw new Error(
      "project.themes is implemented by the daemon: no project root is set",
    );
  }
  return projectRoot;
}

export const themeRouter = os.router({
  project: {
    themes: {
      list: os.project.themes.list.handler(async () => {
        const { readdir, readFile } = await import("node:fs/promises");
        const { join } = await import("node:path");
        const root = rootOrThrow();
        let entries: string[];
        try {
          entries = await readdir(join(root, "themes"));
        } catch {
          return [];
        }
        const themes: Array<{ name: string; text: string; file: string }> = [];
        for (const entry of entries.sort()) {
          if (!entry.endsWith(".json")) continue;
          themes.push({
            name: entry.replace(/\.json$/, ""),
            text: await readFile(join(root, "themes", entry), "utf8"),
            // Project-relative, so a path a developer sees never carries the
            // machine's filesystem layout: a screenshot, a log line, an issue
            // report. The daemon knows the root; the contract does not leak it.
            file: join("themes", entry),
          });
        }
        return themes;
      }),
      read: os.project.themes.read.handler(async ({ input }) => {
        const { readFile } = await import("node:fs/promises");
        const { join } = await import("node:path");
        try {
          return {
            text: await readFile(
              join(rootOrThrow(), "themes", `${input.name}.json`),
              "utf8",
            ),
          };
        } catch {
          return { text: null };
        }
      }),
      write: os.project.themes.write.handler(async ({ input }) => {
        const { writeFile } = await import("node:fs/promises");
        const { join } = await import("node:path");
        try {
          await writeFile(
            join(rootOrThrow(), "themes", `${input.name}.json`),
            input.text,
            "utf8",
          );
          return { error: null };
        } catch (err) {
          return { error: err instanceof Error ? err.message : String(err) };
        }
      }),
      remove: os.project.themes.remove.handler(async ({ input }) => {
        const { rm } = await import("node:fs/promises");
        const { join } = await import("node:path");
        try {
          await rm(join(rootOrThrow(), "themes", `${input.name}.json`));
          return { error: null };
        } catch (err) {
          return { error: err instanceof Error ? err.message : String(err) };
        }
      }),
      copy: os.project.themes.copy.handler(async ({ input }) => {
        const { copyFile, readFile } = await import("node:fs/promises");
        const { join } = await import("node:path");
        try {
          const from = join(rootOrThrow(), "themes", `${input.from}.json`);
          // Read first so a missing source is an error, not an empty file.
          await readFile(from, "utf8");
          await copyFile(
            from,
            join(rootOrThrow(), "themes", `${input.to}.json`),
          );
          return { error: null };
        } catch (err) {
          return { error: err instanceof Error ? err.message : String(err) };
        }
      }),
    },
  },
  theme: {
    analyze: analyzeTheme,
    css: themeCss,
    types: themeTypes,
    scaffold,
    tokens: {
      set: setTokenValue,
      remove: removeTokenValue,
      rename: renameTokenValue,
    },
  },
  themes: {
    css: themesCss,
  },
});
