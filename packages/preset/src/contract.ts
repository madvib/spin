/**
 * @spin/preset procedures — the read-model for the utility layer.
 *
 * Catalog description is pure and derivable from a theme, which is exactly
 * what a procedure is for: text in, JSON out, no build context. Every caller
 * that wants to know what utilities a theme can produce asks the same
 * question and gets the same answer — the studio's utility reference, the lint
 * plugin's vocabulary, and an MCP client listing what is available.
 *
 * The factory itself is not here. `spinPreset()` returns live UnoCSS objects
 * that execute inside a bundler, and nothing serialises them.
 */

import { oc } from "@orpc/contract";
import * as v from "valibot";
import { implement } from "@orpc/server";
import { describeCatalog } from "./catalog.ts";
import { parseTokens } from "@spin/theme";
import type { ParseResult, TokenTree } from "@spin/theme";

const ThemeText = v.pipe(
  v.string(),
  v.description("A DTCG theme document as JSON text."),
);

/** Every utility family the active theme can produce, with its members. */
export const catalog = oc
  .input(v.object({ text: ThemeText }))
  .output(
    v.object({
      error: v.nullable(v.string()),
      sections: v.array(
        v.object({
          id: v.string(),
          title: v.string(),
          utilities: v.array(v.string()),
        }),
      ),
    }),
  )
  .route({
    method: "POST",
    path: "/preset/catalog",
    summary: "List the utilities a theme resolves",
  });

export const presetContract = {
  preset: {
    catalog,
  },
};

const os = implement(presetContract);

const catalogHandler = os.preset.catalog.handler(({ input }) => {
  const parsed: ParseResult = parseTokens(input.text);
  if (!parsed.ok) return { error: parsed.error, sections: [] };
  const tree: TokenTree = parsed.tree;
  return {
    error: null,
    sections: describeCatalog(tree).map((section) => ({
      id: section.id,
      title: section.title,
      utilities: [...section.utilities],
    })),
  };
});

export const presetRouter = os.router({
  preset: {
    catalog: catalogHandler,
  },
});
