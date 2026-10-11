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
/**
 * The directory a project's themes live in, relative to its root.
 *
 * `spin/` rather than `themes/` because the name is the marker: a directory
 * called `spin` at a project root is a claim, and no dependency has one. A
 * `themes/` directory is ambiguous — libraries ship those, unrelated
 * subdirectories have that name, and a scanner that trusts it finds projects
 * that are not projects. `spin init` creates this directory; the daemon reads
 * it; nothing else in a project is spin's to own.
 */
const PROJECT_DIR = "spin";

let projectRoot: string | undefined;

export function setProjectRoot(root: string): void {
  projectRoot = root;
}

/**
 * A scaffolded document as text, ready to write.
 *
 * The authoring layer builds a tree; disk holds JSON. Keeping the conversion
 * in one place means the seeded file and the round-tripped documents agree.
 */
function textOf(tree: ReturnType<typeof scaffoldTheme>): string {
  return treeToJson(tree);
}

/**
 * The root a call is about: its own, or the daemon's.
 *
 * A client that names a root gets that root's themes; a client that names
 * none gets the project the daemon was started with. One process can serve
 * many projects this way, with no shared state to stomp on.
 */
function rootFor(input: { readonly root?: string }): string {
  return input.root ?? rootOrThrow();
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
    detect: os.project.detect.handler(async ({ input }) => {
      const { readdir, readFile } = await import("node:fs/promises");
      const { join } = await import("node:path");
      const { existsSync } = await import("node:fs");
      const here = join(input.root, PROJECT_DIR);
      const hasSpin = existsSync(here);
      let themes: string[] = [];
      if (hasSpin) {
        try {
          themes = (await readdir(here)).filter((e) => e.endsWith(".json"))
            .sort();
        } catch {
          themes = [];
        }
      }
      // The uno config is where the preset is wired, so it answers the
      // other half of "is this a spin project" without being the mark of
      // one: a project can hold themes it has not wired up yet.
      const unoName = ["uno.config.ts", "uno.config.js", "uno.config.mjs"]
        .find((name) => existsSync(join(input.root, name)));
      let wired = false;
      if (unoName !== undefined) {
        try {
          const text = await readFile(join(input.root, unoName), "utf8");
          wired = /@spin\/preset|spinPreset/.test(text);
        } catch {
          wired = false;
        }
      }
      return {
        root: input.root,
        spin: hasSpin,
        uno: unoName !== undefined,
        wired,
        themes,
      };
    }),
    init: os.project.init.handler(async ({ input }) => {
      const { mkdir, writeFile } = await import("node:fs/promises");
      const { join } = await import("node:path");
      try {
        const dir = join(input.root, PROJECT_DIR);
        await mkdir(dir, { recursive: true });
        // Scaffolded from the starter's own roles, so an initialised theme
        // is a starting point a designer edits rather than a blank file
        // they have to fill.
        const seeded = textOf(scaffoldTheme());
        await writeFile(join(dir, `${input.name}.json`), seeded, "utf8");
        return { error: null };
      } catch (err) {
        return { error: err instanceof Error ? err.message : String(err) };
      }
    }),

    themes: {
      list: os.project.themes.list.handler(async ({ input }) => {
        const { readdir, readFile } = await import("node:fs/promises");
        const { join } = await import("node:path");
        const root = rootFor(input);
        let entries: string[];
        try {
          entries = await readdir(join(root, PROJECT_DIR));
        } catch {
          return [];
        }
        const themes: Array<{ name: string; text: string; file: string }> = [];
        for (const entry of entries.sort()) {
          if (!entry.endsWith(".json")) continue;
          themes.push({
            name: entry.replace(/\.json$/, ""),
            text: await readFile(join(root, PROJECT_DIR, entry), "utf8"),
            // Project-relative, so a path a developer sees never carries the
            // machine's filesystem layout: a screenshot, a log line, an issue
            // report. The daemon knows the root; the contract does not leak it.
            file: join(PROJECT_DIR, entry),
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
              join(rootFor(input), PROJECT_DIR, `${input.name}.json`),
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
            join(rootFor(input), PROJECT_DIR, `${input.name}.json`),
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
          await rm(join(rootFor(input), PROJECT_DIR, `${input.name}.json`));
          return { error: null };
        } catch (err) {
          return { error: err instanceof Error ? err.message : String(err) };
        }
      }),
      copy: os.project.themes.copy.handler(async ({ input }) => {
        const { copyFile, readFile } = await import("node:fs/promises");
        const { join } = await import("node:path");
        try {
          const from = join(rootFor(input), PROJECT_DIR, `${input.from}.json`);
          // Read first so a missing source is an error, not an empty file.
          await readFile(from, "utf8");
          await copyFile(
            from,
            join(rootFor(input), PROJECT_DIR, `${input.to}.json`),
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
