/**
 * The font catalogue, over RPC.
 *
 * The studio asks what fonts exist rather than remembering, and the answer
 * comes from the same host the project runs on — one origin, and a
 * catalogue the studio reads without the browser reaching a third party
 * itself.
 *
 * One endpoint, filtered by name, because 2,103 families in a dropdown is
 * not a picker. The catalogue is fetched once per host and remembered: it
 * changes on fontsource's schedule, not on the project's.
 */

import { oc } from "@orpc/contract";
import * as v from "valibot";
import { implement } from "@orpc/server";

/** The catalogue's own shape, as much of it as is used. */
const CatalogFont = v.object({
  id: v.string(),
  family: v.string(),
  subsets: v.array(v.string()),
  weights: v.array(v.number()),
  styles: v.array(v.string()),
  variable: v.boolean(),
  category: v.string(),
});

export const fontsContract = oc.tag("fonts").router({
  fonts: {
    catalog: oc
      .input(v.object({ query: v.optional(v.string()) }))
      .output(v.array(CatalogFont))
      .route({
        method: "POST",
        path: "/fonts/catalog",
        summary: "The fontsource catalogue, filtered by name",
      }),
  },
});

/** The catalogue, fetched once and remembered for this host's lifetime. */
let cached: readonly FontEntry[] | undefined;

interface FontEntry {
  readonly id: string;
  readonly family: string;
  readonly subsets: readonly string[];
  readonly weights: readonly number[];
  readonly styles: readonly string[];
  readonly variable: boolean;
  readonly category: string;
}

async function catalog(): Promise<readonly FontEntry[]> {
  if (cached !== undefined) return cached;
  try {
    const response = await fetch("https://api.fontsource.org/v1/fonts");
    if (!response.ok) return [];
    cached = await response.json() as FontEntry[];
    return cached;
  } catch {
    // Unreachable or unhappy. An empty list is a state the studio can name;
    // an exception out of a handler is not.
    return [];
  }
}

const os = implement(fontsContract);

export const fontsRouter = os.router({
  fonts: {
    catalog: os.fonts.catalog.handler(async ({ input }) => {
      const needle = input.query?.trim().toLowerCase() ?? "";
      const all = await catalog();
      const matching = needle === ""
        ? all
        : all.filter((font) =>
          font.id.toLowerCase().includes(needle) ||
          font.family.toLowerCase().includes(needle)
        );
      // A fresh mutable array: the contract's schema is mutable and the
      // catalogue's own is not, and the handler's return type follows the
      // contract.
      return matching.slice(0, 40).map((font) => ({
        id: font.id,
        family: font.family,
        subsets: [...font.subsets],
        weights: [...font.weights],
        styles: [...font.styles],
        variable: font.variable,
        category: font.category,
      }));
    }),
  },
});
