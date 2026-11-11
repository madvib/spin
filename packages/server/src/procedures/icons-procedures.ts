/**
 * The icon catalogue, and the project's saved icons, over RPC.
 *
 * Five iconify collections are installed — `lucide`, `material-symbols`,
 * `tabler`, `carbon`, `ph` — and the studio asks what they hold rather
 * than remembering. The catalogue answers in two steps, split by what the
 * page actually needs:
 *
 *   1. `catalog` answers "what are the names", once, for the whole grid. It
 *      carries no glyph bodies — 44k strings at a body apiece is a megabyte
 *      of markup nobody asked for, and the answer is the same for every host,
 *      so it is built once and remembered for this host's lifetime.
 *
 *   2. `body` answers "what does one glyph draw", for the rows on screen,
 *      on demand. The page renders the returned markup as inline SVG at the
 *      theme's own `icon.*` sizes, which is why the answer is exact rather
 *      than a class name: no utility is safelisted for 44k icons, and the
 *      glyph the user copies (`i-<collection>-<name>`) still resolves
 *      against the same collections the preset is composed with.
 *
 * `collections` answers the third question — who made these, and under
 * what licence — which is what a saved icon has to record about itself.
 *
 * The SAVED ICONS are the other half of the surface, and they are not the
 * catalogue: a catalogue is what everybody may draw, and a library is what
 * this project chose to keep. The saved icons live in the project, so their
 * procedures resolve a root the way the project procedures do, and the
 * logic over them is the project's own (`@spinjs/project`).
 *
 * A name that is not in a collection draws `null` rather than throwing: one
 * missing glyph is a state the studio can name, and an exception out of a
 * handler is not.
 */

import { oc } from "@orpc/contract";
import * as v from "valibot";
import { implement } from "@orpc/server";
import {
  IconAttributionSchema,
  ProjectIconSchema,
  ThemeNameSchema,
} from "../project/index.ts";
import carbonInfo from "@iconify-json/carbon/info.json" with { type: "json" };
import carbonSet from "@iconify-json/carbon/icons.json" with { type: "json" };
import lucideInfo from "@iconify-json/lucide/info.json" with { type: "json" };
import lucideSet from "@iconify-json/lucide/icons.json" with { type: "json" };
import materialSymbolsInfo from "@iconify-json/material-symbols/info.json" with {
  type: "json",
};
import materialSymbolsSet from "@iconify-json/material-symbols/icons.json" with {
  type: "json",
};
import phInfo from "@iconify-json/ph/info.json" with { type: "json" };
import phSet from "@iconify-json/ph/icons.json" with { type: "json" };
import tablerInfo from "@iconify-json/tabler/info.json" with { type: "json" };
import tablerSet from "@iconify-json/tabler/icons.json" with { type: "json" };
import { projectService } from "../project/index.ts";
import { rootFor } from "./project-procedures.ts";

/** One glyph: the markup, and the box the markup was drawn in. */
export interface IconBody {
  body: string;
  width: number;
  height: number;
}

/** One catalogue row: a collection, and a name inside it. */
export interface IconName {
  collection: string;
  name: string;
}

/** The part of an iconify collection the studio reads. */
interface IconifyGlyph {
  body?: string;
  width?: number;
  height?: number;
  /** A hidden glyph exists but is not offered; iconify keeps it out of the list. */
  hidden?: boolean;
  /** An alias draws its parent, with whatever fields it restates on top. */
  parent?: string;
}

/** The part of an iconify collection file the studio reads. */
interface IconifySet extends IconifyGlyph {
  readonly prefix: string;
  readonly icons: Record<string, IconifyGlyph>;
  readonly aliases: Record<string, IconifyGlyph>;
}

/** The part of an iconify collection's info file the studio reads. */
interface IconifyInfo {
  readonly prefix?: string;
  readonly name?: string;
  readonly author?: { readonly name?: string; readonly url?: string };
  readonly license?: { readonly title?: string; readonly spdx?: string };
}

/**
 * The installed collections, in the order the studio's picker lists them.
 *
 * The five JSON files are a static import each: they are data on this host,
 * not a fetch, and the catalogue they build is the same for every project —
 * which is what makes it safe to build once. The info files ride beside
 * them: who made a collection and under what licence is the answer a saved
 * icon has to carry, and it is the same answer for every project.
 */
const INSTALLED: readonly IconifySet[] = [
  lucideSet,
  materialSymbolsSet,
  tablerSet,
  carbonSet,
  phSet,
].map((set) => set as unknown as IconifySet);

const INSTALLED_INFO: readonly IconifyInfo[] = [
  lucideInfo,
  materialSymbolsInfo,
  tablerInfo,
  carbonInfo,
  phInfo,
].map((info) => info as unknown as IconifyInfo);

/** A collection, as the studio sees it: every offered name, and each glyph. */
interface Collection {
  readonly prefix: string;
  readonly names: readonly string[];
  readonly glyphs: ReadonlyMap<string, IconBody>;
  /** The collection's own name, as iconify states it. */
  readonly title: string;
  /** Who made it. */
  readonly author: string | null;
  /** The licence it is under. */
  readonly license: string | null;
}

/**
 * The collections, built once and remembered for this host's lifetime.
 *
 * An alias is merged with its parent here rather than at request time, so
 * `body` for an alias name is a map hit: the same bodies under two names is
 * exactly what an alias is.
 */
let cached: readonly Collection[] | undefined;

function collections(): readonly Collection[] {
  if (cached !== undefined) return cached;
  cached = INSTALLED.map(buildCollection).filter(
    (collection): collection is Collection => collection !== undefined,
  );
  return cached;
}

/** One collection: its name, its offered names, and what each one draws. */
function buildCollection(set: IconifySet): Collection | undefined {
  if (typeof set.prefix !== "string" || set.icons === undefined) {
    return undefined;
  }
  const glyphs = new Map<string, IconBody>();
  const names: string[] = [];
  for (const [name, icon] of Object.entries(set.icons)) {
    if (icon.hidden === true) continue;
    const glyph = dimension(icon, set);
    if (glyph === undefined) continue;
    glyphs.set(name, glyph);
    names.push(name);
  }
  for (const [name, alias] of Object.entries(set.aliases ?? {})) {
    if (alias.hidden === true) continue;
    const parent = alias.parent !== undefined
      ? set.icons[alias.parent]
      : undefined;
    // An alias whose parent is hidden or missing draws nothing: there is no
    // parent to inherit a body from.
    if (parent === undefined || parent.hidden === true) continue;
    // An alias draws its parent's body, with whatever fields it restates on
    // top of it.
    const glyph = dimension({
      body: alias.body ?? parent.body,
      width: alias.width ?? parent.width,
      height: alias.height ?? parent.height,
    }, set);
    if (glyph === undefined) continue;
    glyphs.set(name, glyph);
    names.push(name);
  }
  // Sorted so an empty query reads as a catalogue rather than as a hash
  // order; the page ranks from here and the input order stops it being
  // arbitrary.
  names.sort();
  const info = INSTALLED_INFO.find((entry) => entry.prefix === set.prefix);
  return {
    prefix: set.prefix,
    names,
    glyphs,
    title: info?.name ?? set.prefix,
    author: info?.author?.name ?? null,
    license: info?.license?.title ?? null,
  };
}

/**
 * A glyph's box.
 *
 * A missing width or height is the collection's own, and after that 16 —
 * the defaults iconify itself uses, so a body drawn at the set's size is
 * laid out at the set's size.
 */
function dimension(
  glyph: IconifyGlyph,
  set: IconifySet,
): IconBody | undefined {
  if (glyph.body === undefined) return undefined;
  return {
    body: glyph.body,
    width: glyph.width ?? set.width ?? 16,
    height: glyph.height ?? set.height ?? 16,
  };
}

/**
 * The name a saved icon is filed under.
 *
 * A file stem, like a theme's: the name is what the project writes back to
 * disk, and a name the file system will not take is refused here rather
 * than tidied on its way to the disk.
 */


/**
 * Where a saved icon came from.
 *
 * Every member may be absent: attribution is recordable, not required, and
 * an icon the project drew itself has no collection behind it.
 */


/**
 * A project a call is about.
 *
 * Optional for the same reason the project procedures' is: the daemon has
 * a project it was started with, and one process can serve many.
 */
const ProjectInput = v.object({
  root: v.optional(v.string()),
});

export const iconsContract = oc.tag("icons").router({
  icons: {
    catalog: oc
      .input(v.object({}))
      .output(v.array(v.object({
        collection: v.string(),
        name: v.string(),
      })))
      .route({
        method: "POST",
        path: "/icons/catalog",
        summary: "Every glyph name in the installed collections",
      }),
    body: oc
      .input(v.object({
        collection: v.string(),
        name: v.string(),
      }))
      .output(v.nullable(v.object({
        body: v.string(),
        width: v.number(),
        height: v.number(),
      })))
      .route({
        method: "POST",
        path: "/icons/body",
        summary: "One glyph's inline SVG body, at its own size",
      }),
    collections: oc
      .input(v.object({}))
      .output(v.array(v.object({
        prefix: v.string(),
        name: v.string(),
        author: v.nullable(v.string()),
        license: v.nullable(v.string()),
      })))
      .route({
        method: "POST",
        path: "/icons/collections",
        summary:
          "The installed collections, with who made them and under what licence",
      }),
    saved: {
      list: oc
        .input(ProjectInput)
        .output(v.array(ProjectIconSchema))
        .route({
          method: "GET",
          path: "/icons/saved/list",
          summary: "The icons the project has saved, with their attribution",
        }),
      read: oc
        .input(v.object({ name: ThemeNameSchema, root: v.optional(v.string()) }))
        .output(v.object({ icon: v.nullable(ProjectIconSchema) }))
        .route({
          method: "GET",
          path: "/icons/saved/read",
          summary: "Read one saved icon, markup and attribution",
        }),
      save: oc
        .input(v.object({
          name: ThemeNameSchema,
          markup: v.string(),
          attribution: v.optional(IconAttributionSchema),
          root: v.optional(v.string()),
        }))
        .output(v.object({ error: v.nullable(v.string()) }))
        .route({
          method: "POST",
          path: "/icons/saved/save",
          summary: "Save one icon into the project's library",
        }),
      remove: oc
        .input(v.object({ name: ThemeNameSchema, root: v.optional(v.string()) }))
        .output(v.object({ error: v.nullable(v.string()) }))
        .route({
          method: "POST",
          path: "/icons/saved/remove",
          summary: "Remove one saved icon from the project's library",
        }),
    },
  },
});

const os = implement(iconsContract);

export const iconsRouter = os.router({
  icons: {
    catalog: os.icons.catalog.handler(() => {
      const rows: IconName[] = [];
      for (const collection of collections()) {
        for (const name of collection.names) {
          rows.push({ collection: collection.prefix, name });
        }
      }
      return rows;
    }),
    body: os.icons.body.handler(({ input }) => {
      const collection = collections().find(
        (candidate) => candidate.prefix === input.collection,
      );
      const glyph = collection?.glyphs.get(input.name);
      if (glyph === undefined) return null;
      // A fresh object per answer: the map owns its rows, and the handler's
      // return type is the contract's.
      return {
        body: glyph.body,
        width: glyph.width,
        height: glyph.height,
      };
    }),
    collections: os.icons.collections.handler(() =>
      collections().map((collection) => ({
        prefix: collection.prefix,
        name: collection.title,
        author: collection.author,
        license: collection.license,
      }))
    ),
    saved: {
      list: os.icons.saved.list.handler(({ input }) =>
        projectService.icons.list(rootFor(input))
      ),
      read: os.icons.saved.read.handler(({ input }) =>
        projectService.icons.read(rootFor(input), input.name)
      ),
      save: os.icons.saved.save.handler(({ input }) =>
        projectService.icons.write(rootFor(input), input.name, {
          markup: input.markup,
          attribution: input.attribution ?? {
            collection: null,
            author: null,
            license: null,
          },
        })
      ),
      remove: os.icons.saved.remove.handler(({ input }) =>
        projectService.icons.remove(rootFor(input), input.name)
      ),
    },
  },
});
