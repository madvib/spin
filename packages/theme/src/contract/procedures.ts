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
import { parseDocument, parseTokens } from "../pipeline/parse.ts";
import {
  removeToken,
  renameToken,
  setToken,
  treeToJson,
} from "../authoring/mutate.ts";
import type { MutationResult } from "../authoring/mutate.ts";
import { scaffoldTheme } from "../authoring/scaffold.ts";
import { requiredPaths } from "./roles.ts";
import type { Mode } from "../modes.ts";
import type { TokenTree } from "../pipeline/types.ts";
import { themeContract } from "./contract.ts";
import { validateTheme } from "./validate-theme.ts";

const os = implement(themeContract);

/**
 * The daemon's answer to "what is wrong with this theme?".
 *
 * The judgement is the module's: `validateTheme` owns the required roles, the
 * value rules and the contrast floors, so the daemon and the studio that
 * asks it in the browser cannot answer differently. What the handler adds is
 * the claim: the modes the document serves are its own (the root `modes`
 * field), a caller may state them instead, and a caller that says nothing
 * gets the document's answer.
 */
function analyze(
  text: string,
  required?: readonly string[],
  modes?: readonly Mode[],
) {
  const declared = parseDocument(text);
  const served = modes ?? (declared.ok ? declared.modes : undefined) ?? [];
  const report = validateTheme(text, {
    required: required ?? requiredPaths(),
    modes: served,
  });
  return {
    error: report.error ?? null,
    issues: [...report.issues],
    tree: report.tree ?? null,
  };
}

function mutate(
  text: string,
  op: (tree: TokenTree) => MutationResult,
) {
  const parsed = parseTokens(text);
  if (!parsed.ok) return { error: parsed.error, code: null, text: null };
  const result = op(parsed.tree);
  // The refusal carries its code, path and detail; the wire keeps all three
  // now — an agent branches on the code, and `error` stays the sentence a
  // studio renders.
  if (!result.ok) {
    return {
      error: result.path ? `${result.path}: ${result.detail}` : result.detail,
      code: result.code,
      text: null,
    };
  }
  return { error: null, code: null, text: treeToJson(result.tree) };
}

const analyzeTheme = os.theme.analyze.handler(({ input }) =>
  analyze(input.text, input.required, input.modes)
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
      input.mode,
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
export const themeRouter = os.router({
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
