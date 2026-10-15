/**
 * The icon catalogue, over RPC — and the search that reads it.
 *
 * The five installed iconify collections live on the host the project runs
 * on; the studio asks for their names rather than shipping 44k glyphs in its
 * own bundle. Two rules this file exists to keep:
 *
 *   1. One call for the catalogue, cached for the session. A grid cannot ask
 *      per name what the whole collection will tell it in one answer.
 *
 *   2. A query matches ANYWHERE in a name. The font picker's prefix-only
 *      match is the failure this replaces: searching `arrow` there finds the
 *      families that start with it and misses `arrow-down-left`, and a user
 *      types the word they saw, not the word it starts with. Substring
 *      matching, ranked — a name that starts with the query, then a hyphen
 *      word that does, then any other hit — because a result list is read
 *      from the top and the most specific reading belongs there.
 *
 * Bodies come one glyph at a time and are cached per name: the page renders
 * the exact inline SVG at the theme's own `icon.*` sizes, so what a glyph
 * costs is one small RPC, once.
 */

import { spinClient } from "./client.ts";

/** One catalogue row: a collection, and a name inside it. */
export interface IconEntry {
  readonly collection: string;
  readonly name: string;
}

/** One glyph's inline SVG body, at the size it was drawn in. */
export interface IconGlyph {
  readonly body: string;
  readonly width: number;
  readonly height: number;
}

/** How many results a query offers. A grid past this is a wall. */
export const RESULT_LIMIT = 120;

/**
 * Every glyph name the installed collections ship, fetched once.
 *
 * Cached as a promise: the page re-runs its search on every keystroke, and a
 * second call must not second the network on the way through.
 */
let loading: Promise<readonly IconEntry[]> | undefined;

export function loadIconCatalog(): Promise<readonly IconEntry[]> {
  loading ??= (async () => {
    const client = await spinClient();
    const rows = await client.icons.catalog({});
    return rows as readonly IconEntry[];
  })();
  return loading;
}

/** One glyph, as a promise, fetched once per name. */
const glyphs = new Map<string, Promise<IconGlyph | null>>();

export function loadIconGlyph(entry: IconEntry): Promise<IconGlyph | null> {
  const key = `${entry.collection}/${entry.name}`;
  let glyph = glyphs.get(key);
  if (glyph === undefined) {
    glyph = (async () => {
      const client = await spinClient();
      return await client.icons.body({
        collection: entry.collection,
        name: entry.name,
      });
    })();
    glyphs.set(key, glyph);
  }
  return glyph;
}

/**
 * The utility a glyph spends: `i-<collection>-<name>`.
 *
 * The class name the preset's icon rules generate — clicked, not typed, so
 * the 44k rules the page would otherwise safelist are never generated.
 */
export function iconUtility(entry: IconEntry): string {
  return `i-${entry.collection}-${entry.name}`;
}

/**
 * Ranked substring search over the catalogue.
 *
 * The tiers, best first: the name starts with the query, a hyphenated word
 * in the name does (`fill` finds `archive-box-fill` through its `-fill`), the
 * query appears anywhere else. Ties break to the shorter name (more
 * specific), then the earlier hit, then alphabetical — so re-running the
 * same query answers the same list.
 */
export function searchIcons(
  entries: readonly IconEntry[],
  query: string,
  limit: number = RESULT_LIMIT,
): readonly IconEntry[] {
  const needle = query.trim().toLowerCase();
  if (needle === "") return entries.slice(0, limit);
  const hits: Array<{
    entry: IconEntry;
    tier: number;
    at: number;
  }> = [];
  for (const entry of entries) {
    const name = entry.name.toLowerCase();
    const at = name.indexOf(needle);
    if (at === -1) continue;
    const word = at === 0 || name[at - 1] === "-";
    hits.push({ entry, tier: at === 0 ? 0 : word ? 1 : 2, at });
  }
  hits.sort((a, b) =>
    a.tier - b.tier ||
    a.entry.name.length - b.entry.name.length ||
    a.at - b.at ||
    a.entry.name.localeCompare(b.entry.name) ||
    a.entry.collection.localeCompare(b.entry.collection)
  );
  return hits.slice(0, limit).map((hit) => hit.entry);
}

/** The collections the catalogue carries, in the order it lists them. */
export function collectionsIn(
  entries: readonly IconEntry[],
): readonly string[] {
  const seen = new Set<string>();
  const order: string[] = [];
  for (const entry of entries) {
    if (seen.has(entry.collection)) continue;
    seen.add(entry.collection);
    order.push(entry.collection);
  }
  return order;
}
