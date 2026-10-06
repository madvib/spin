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
