/**
 * @spinjs/preset procedures — the read-model for the utility layer.
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
import { SAMPLES, SECTIONS, utilitiesFor } from "./organization.ts";
import { parseTokens } from "@spinjs/theme";
import type { ParseResult } from "@spinjs/theme";

const ThemeText = v.pipe(
  v.string(),
  v.description("A DTCG theme document as JSON text."),
);

/**
 * The catalog grouped by reader intent, over the raw catalog groups: the
 * sections the reference renders and an MCP client explains the surface
 * through. The membership is joined here, so a caller never re-derives which
 * utilities a section holds.
 */
export const organization = oc
  .input(v.object({ text: ThemeText }))
  .output(
    v.object({
      error: v.nullable(v.string()),
      sections: v.array(
        v.object({
          id: v.string(),
          title: v.string(),
          blurb: v.string(),
          sample: v.nullable(v.picklist(SAMPLES)),
          utilities: v.array(v.string()),
        }),
      ),
    }),
  )
  .route({
    method: "POST",
    path: "/preset/organization",
    summary: "List utilities grouped by reader intent",
  });

export const presetContract = {
  preset: {
    organization,
  },
};

const os = implement(presetContract);

const organizationHandler = os.preset.organization.handler(({ input }) => {
  const parsed: ParseResult = parseTokens(input.text);
  if (!parsed.ok) return { error: parsed.error, sections: [] };
  const catalog = describeCatalog(parsed.tree);
  return {
    error: null,
    sections: SECTIONS.map((section) => ({
      id: section.id,
      title: section.title,
      blurb: section.blurb,
      sample: section.sample ?? null,
      utilities: utilitiesFor(section, catalog),
    })),
  };
});

export const presetRouter = os.router({
  preset: {
    organization: organizationHandler,
  },
});
