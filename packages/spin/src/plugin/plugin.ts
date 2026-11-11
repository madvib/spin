import { createGenerator, type Preset, type UserShortcuts } from "@unocss/core";
import presetIcons from "@unocss/preset-icons";
import { createUnplugin, type UnpluginOptions } from "unplugin";
import { createRequire } from "node:module";
import { type ContentMap, type ContentOptions, joinContent, scanContent } from "@spinjs/build";
import { checkStrictClasses } from "@spinjs/build";
import { describeCatalog } from "@spinjs/preset";
import { parseTokens, type ThemeDocument } from "@spinjs/theme";
import { loadProjectBrand } from "@spinjs/server/project";
import {
  noteDiskDocuments,
  onOverlayChange,
  resolveThemes,
} from "@spinjs/server/project";
import { spinComponentsStage } from "@spinjs/build";

/**
 * The slice of a dev server the overlay lifecycle touches. Structural, so
 * `@spinjs/preset` keeps no bundler dependency and the hook stays portable
 * across unplugin's targets.
 */
export interface DevServer {
  moduleGraph: {
    urlToModuleMap: Map<string, unknown>;
    invalidateModule: (mod: object) => void;
  };
  ws: { send: (payload: object) => void };
  httpServer?: { once: (event: string, fn: () => void) => void } | null;
}

/**
 * One specifier the app graph needs bridged, and what it becomes.
 *
 * The app graph is bundled by rolldown, which does not read the Deno
 * import maps the packages live in; these entries are the bridge. Nobody
 * edits this table per app — every spin app in the workspace consumes it
 * through the plugin's `config` hook, so a package that moves moves
 * everywhere at once.
 */
interface Specifier {
  /** What an import may spell: an exact id or a prefix pattern. */
  readonly find: string | RegExp;
  /** What it becomes. A prefix capture carries `$1`. */
  readonly replacement: string;
  /**
   * Files the replacement's existence depends on. Every one must exist
   * for the entry to live. Empty for entries that are pure id-prescription
   * (the `npm:` strip), which need no target.
   */
  readonly targets: readonly string[];
}

/**
 * One alias per `@spinjs/components` subpath, read off its exports map.
 *
 * The generic `components/(.+)` entry below maps a subpath to a source
 * DIRECTORY, which the bundler cannot load — and the filename is not
 * derivable (`cascade-select` lives in `cascade.presentation.ts`). The
 * exports map already names every file, so the entries are generated from
 * it instead of maintained by hand. Missing map (published layout) falls
 * away, and resolution runs natively — the same rule as every other
 * table entry.
 */
async function componentSubpathEntries(
  componentsIndex: string,
): Promise<Specifier[]> {
  const { readFile } = await import("node:fs/promises");
  const { dirname, join } = await import("node:path");
  try {
    const componentsDir = dirname(dirname(componentsIndex));
    const manifest = JSON.parse(
      await readFile(join(componentsDir, "package.json"), "utf8"),
    ) as { exports?: Record<string, { default?: unknown }> };
    const out: Specifier[] = [];
    for (const [key, value] of Object.entries(manifest.exports ?? {})) {
      if (!key.startsWith("./") || key === "./package.json") continue;
      const target = value?.default;
      if (typeof target !== "string" || !target.endsWith(".ts")) continue;
      const replacement = join(componentsDir, target.slice("./".length));
      out.push({
        find: `@spinjs/components/${key.slice("./".length)}`,
        replacement,
        targets: [replacement, componentsIndex],
      });
    }
    return out;
  } catch {
    return [];
  }
}

async function spinWorkspaceRoot(): Promise<string> {
  // non-empty `workspaces` array. Every package in the repo has its own
  // package.json, so "first manifest wins" would stop at the preset itself —
  // and the specifier this walk exists for (the uno pin) lives in the hoisted
  // root, not the member dir.
  const { dirname, join } = await import("node:path");
  const { readFile, readdir } = await import("node:fs/promises");
  const { fileURLToPath } = await import("node:url");
  let dir = dirname(dirname(dirname(fileURLToPath(import.meta.url)))); // this file's package dir
  const fallback = dir;
  let projectFallback: string | undefined;
  for (;;) {
    let names: string[];
    try {
      names = await readdir(dir);
    } catch {
      names = [];
    }
    if (names.includes("package.json")) {
      try {
        const manifest = JSON.parse(
          await readFile(join(dir, "package.json"), "utf8"),
        ) as { workspaces?: unknown };
        if (
          Array.isArray(manifest["workspaces"]) &&
          manifest["workspaces"].length > 0
        ) {
          return dir;
        }
        if (projectFallback === undefined && !dir.includes("node_modules")) {
          projectFallback = dir;
        }
      } catch {
        // Unreadable manifest: keep walking.
      }
    }
    const parent = dirname(dir);
    if (parent === dir) return projectFallback ?? fallback;
    dir = parent;
  }
}

/** The public half of an entry: specifier in, id out. */
interface SpecTableEntry {
  /** What an import may spell: an exact id or a prefix pattern. */
  find: string | RegExp;
  /** What it becomes. */
  replacement: string;
}

/**
 * The specifier table, minus entries whose targets do not exist.
 *
 * A package consumed from npm has no source tree to point at: its entries
 * fall away and resolution runs natively, which is exactly what that
 * consumption wants. In-repo, the table is the whole bridge.
 */
export async function spinAliases(): Promise<SpecTableEntry[]> {
  const { stat } = await import("node:fs/promises");
  const { fileURLToPath } = await import("node:url");
  const { dirname, join } = await import("node:path");
  const { createRequire } = await import("node:module");
  const pkg = (rel: string): string =>
    fileURLToPath(new URL(rel, import.meta.url));
  // The sibling workspaces resolve by package name, never by a path
  // climb — and optionally: a preset-only install has no components
  // tree, so those entries fall away with the rest below.
  const req = createRequire(import.meta.url);
  const tryDir = (spec: string): string | undefined => {
    try {
      return dirname(req.resolve(spec));
    } catch {
      return undefined;
    }
  };
  const componentsSrc = tryDir("@spinjs/components") ?? "";
  const themeSrc = dirname(req.resolve("@spinjs/theme"));
  const presetSrc = dirname(req.resolve("@spinjs/preset"));
  const serverSrc = dirname(req.resolve("@spinjs/server"));
  const diagnosticsSrc = dirname(req.resolve("@spinjs/diagnostics"));
  const buildSrc = dirname(req.resolve("@spinjs/build"));
  const source = {
    spinSrc: pkg("../"),
    themeSrc: `${themeSrc}/`,
    themeIndex: join(themeSrc, "index.ts"),
    themeBaseIndex: join(themeSrc, "base/index.ts"),
    animationIndex: join(presetSrc, "animation/index.ts"),
    presetSrc: `${presetSrc}/`,
    presetIndex: join(presetSrc, "index.ts"),
    apiIndex: pkg("../api/index.ts"),
    projectIndex: join(serverSrc, "project/index.ts"),
    componentsSrc,
    componentsIndex: join(componentsSrc, "index.ts"),
    diagnosticsIndex: join(diagnosticsSrc, "index.ts"),
    buildIndex: join(buildSrc, "index.ts"),
  };
  const unoCore = join(
    await spinWorkspaceRoot(),
    "node_modules/@unocss/core/dist/index.mjs",
  );
  const componentsEntries = await componentSubpathEntries(source.componentsIndex);
  const table: readonly Specifier[] = [
    ...componentsEntries,
    {
      find: "@spinjs/spin/vite",
      replacement: pkg("./plugin.ts"),
      targets: [pkg("./plugin.ts")],
    },
    {
      find: "@spinjs/spin/examples",
      replacement: pkg("../examples/index.ts"),
      targets: [pkg("../examples/index.ts")],
    },
    {
      find: "@spinjs/spin/eslint",
      replacement: join(diagnosticsSrc, "eslint.ts"),
      targets: [source.diagnosticsIndex],
    },
    {
      find: "@spinjs/spin/cli",
      replacement: pkg("../cli/main.ts"),
      targets: [pkg("../cli/main.ts")],
    },
    {
      find: "@spinjs/spin/mcp",
      replacement: pkg("../mcp/main.ts"),
      targets: [source.apiIndex],
    },
    {
      find: "@spinjs/spin/api/procedures",
      replacement: pkg("../api/components-procedures.ts"),
      targets: [source.apiIndex],
    },
    {
      find: /^@spinjs\/spin\/preset\/(.+)$/,
      replacement: `${source.presetSrc}$1`,
      targets: [source.presetIndex],
    },
    {
      find: "@spinjs/spin/preset",
      replacement: source.presetIndex,
      targets: [source.presetIndex],
    },
    {
      find: "@spinjs/spin/skill/authoring",
      replacement: pkg("../skill/authoring.ts"),
      targets: [pkg("../skill/authoring.ts")],
    },
    {
      find: "@spinjs/spin/skill",
      replacement: pkg("../skill/index.ts"),
      targets: [pkg("../skill/index.ts")],
    },
    {
      find: /^@spinjs\/spin\/(.+)$/,
      replacement: `${source.spinSrc}$1`,
      targets: [pkg("./plugin.ts")],
    },
    {
      find: "@spinjs/spin",
      replacement: source.presetIndex,
      targets: [source.presetIndex],
    },
    // Legacy: the pre-merge package names. Entries die with their last
    // importer — `@spinjs/api/client` and `@spinjs/project/sync` died in
    // Phase 2, when the apps were rewritten to real subpaths.
    {
      find: "@spinjs/theme/base",
      replacement: source.themeBaseIndex,
      targets: [source.themeIndex],
    },
    {
      find: /^@spinjs\/theme\/(.+)$/,
      replacement: `${source.themeSrc}$1`,
      targets: [source.themeIndex],
    },
    {
      find: "@spinjs/theme",
      replacement: source.themeIndex,
      targets: [source.themeIndex],
    },
    {
      find: "@spinjs/animation",
      replacement: source.animationIndex,
      targets: [source.animationIndex],
    },
    {
      find: /^@spinjs\/preset\/(.+)$/,
      replacement: `${source.presetSrc}$1`,
      targets: [source.presetIndex],
    },
    {
      find: "@spinjs/preset",
      replacement: source.presetIndex,
      targets: [source.presetIndex],
    },
    {
      find: "@spinjs/api",
      replacement: source.apiIndex,
      targets: [source.apiIndex],
    },
    {
      // The project: where a project's files are. The daemon's procedures
      // read them, and a client that wants to know what a project holds
      // asks the package that owns them.
      find: "@spinjs/project",
      replacement: source.projectIndex,
      targets: [source.projectIndex],
    },
    {
      find: "@spinjs/mcp",
      replacement: pkg("../mcp/index.ts"),
      targets: [source.apiIndex],
    },
    {
      find: "@spinjs/components/procedures",
      replacement: pkg("../api/components-procedures.ts"),
      targets: [source.apiIndex],
    },
    {
      find: "@spinjs/components/controller",
      replacement: join(source.componentsSrc, "controller.ts"),
      targets: [source.componentsIndex],
    },
    {
      find: "@spinjs/components/solid",
      replacement: join(source.componentsSrc, "solid/solid.ts"),
      targets: [source.componentsIndex],
    },
    {
      find: "@spinjs/components/react",
      replacement: join(source.componentsSrc, "react/react.ts"),
      targets: [source.componentsIndex],
    },
    {
      find: "@spinjs/components/spin-element",
      replacement: join(source.componentsSrc, "spin-element.ts"),
      targets: [source.componentsIndex],
    },
    {
      find: /^@spinjs\/components\/(.+)$/,
      replacement: `${source.componentsSrc}/$1`,
      targets: [source.componentsIndex],
    },
    {
      find: "@spinjs/components",
      replacement: source.componentsIndex,
      targets: [source.componentsIndex],
    },
    {
      find: "@spinjs/hooks/solid",
      replacement: join(source.componentsSrc, "solid/solid.ts"),
      targets: [source.componentsIndex],
    },
    {
      find: "@spinjs/hooks/react",
      replacement: join(source.componentsSrc, "react/react.ts"),
      targets: [source.componentsIndex],
    },
    {
      find: "@spinjs/hooks",
      replacement: join(source.componentsSrc, "spin-element.ts"),
      targets: [source.componentsIndex],
    },
    {
      find: "@spinjs/diagnostics",
      replacement: source.diagnosticsIndex,
      targets: [source.diagnosticsIndex],
    },
    {
      find: "@spinjs/build",
      replacement: source.buildIndex,
      targets: [source.buildIndex],
    },
    {
      // The ONE copy: two uno cores in one sheet resolves tokens from
      // different instances. Pinned only while the module is hoisted there.
      find: /^@unocss\/core$/,
      replacement: unoCore,
      targets: [unoCore],
    },
  ];
  const alive = await Promise.all(
    table.map(async (entry) => {
      for (const target of entry.targets) {
        try {
          await stat(target);
        } catch {
          return null;
        }
      }
      return entry;
    }),
  );
  return alive
    .filter((entry): entry is Specifier => entry !== null)
    .map(({ find, replacement }) => ({ find, replacement }));
}

import { spinPreset } from "@spinjs/preset";

/**
 * The id `load` answers to.
 *
 * A path, not unplugin's `\0` marker: the framework wrapper strips the
 * marker off whatever `resolveId` returns, so a marker here comes back out
 * as the id the app wrote and `load` never sees the string it checks for.
 * A path also keeps the `.css` extension that tells vite to serve the
 * result as a stylesheet rather than a script.
 */
const VIRTUAL_ID = "/__uno.css";

export interface SpinPluginOptions {
  /**
   * The documents to serve verbatim. Omitted, the project serves the brand
   * layer (`extends.themes`), forked by `spin/*.json` at its root. The
   * overlay overrides whichever set is in play while the studio is open.
   */
  readonly themes?: Record<string, ThemeDocument>;
  /**
   * The shared brand this project builds on: theme documents as imported
   * values plus the brand's components directory. `componentsDir` here is
   * an absolute path or one relative to the consumer root, exactly like
   * the top-level option — the plugin never guesses package internals.
   */
  readonly extends?: {
    readonly themes?: Record<string, ThemeDocument>;
    readonly palettes?: Record<string, ThemeDocument>;
    readonly spacings?: Record<string, ThemeDocument>;
    readonly componentsDir?: string;
  };
  /** Presets to compose alongside ours — icons are the usual reason. */
  readonly presets?: readonly Preset[];
  /**
   * Register @unocss/preset-icons with the shipped iconify collections. Default true.
   *
   * The five `@iconify-json/*` collections travel in `dependencies`, so the
   * loader reads them from the consumer's own install rather than fetching
   * over the network — a class the app writes (`i-lucide-folder`) resolves
   * to a glyph in an offline build. Each collection loads lazily, so only
   * referenced collections are parsed. Set false to opt out; an explicit
   * `@unocss/preset-icons` entry in `presets` wins over this one.
   */
  readonly icons?: boolean;
  /**
   * The project's own shortcuts — Uno's `shortcuts` option, unchanged.
   *
   * A shortcut is a named composition: one class that stands for a set of
   * utilities. The compositions an app repeats are the app's own decision,
   * so they belong to the app's configuration rather than to the framework —
   * and spin does not forbid them. What they spend is still the theme's: a
   * shortcut that says `gap-4` spends the theme's spacing step, so a theme
   * that prefers roomier sections sets it once.
   *
   * The declaration is an object literal, and it is read as one: the lint
   * reads the same declaration out of the same configuration, so a class the
   * app declares is a class the lint knows.
   */
  readonly shortcuts?: UserShortcuts;
  /** What to scan. See `ContentOptions`. */
  readonly content?: ContentOptions;
  /**
   * Which primitive components to ship. Omitted ships all, `false` ships none,
   * and an array ships the named subset. Forwarded to the preset.
   */
  readonly primitives?: string[] | boolean;
  /**
   * Fail the build on classes the theme cannot produce. Default: a
   * production build throws and lists every unknown class with the file
   * that names it; the dev server logs the same payload and keeps
   * serving. Pass `false` to restore silence exactly. Computed class
   * names the scanner cannot see are out of scope: only extractor-visible
   * literals (class attributes, ternary arms, class-list keys) are
   * checked.
   */
  readonly strictClasses?: boolean;
  /**
   * How removed raw type utilities (`text-*` sizes, `font-*`
   * families/weights) report. Default: the migration window warns before the
   * gate minor (`0.2`) and errors after it. Pass `"error"` to migrate early,
   * `"warn"` to stay lenient past the gate. A genuine typo is an error either
   * way — the window covers the rename, not the vocabulary. The lint's
   * `closed-vocabulary` finding follows the same window.
   */
  readonly rawType?: "warn" | "error";
  /** Safelist the catalog so a utility named only as data still resolves. */
  readonly safelist?: boolean;
  /**
   * Mount the Studio and its API on the dev server. Default true; `false`
   * disables the mount and the launcher entirely.
   */
  readonly studio?: boolean;
  /**
   * Override the Studio mount — a custom root or studio directory.
   * Omitted, the plugin mounts its own API at the resolved project root.
   * Receives the server and the project root the plugin resolved, so the
   * mount can point filesystem procedures at the project.
   */
  readonly mount?: (
    host: { server: unknown; root: string },
  ) => void;
  /**
   * Where the mounted app lives. The overlay script the plugin injects has
   * to dial it, so the two halves cannot disagree about the address.
   */
  readonly apiBase?: string;
  /**
   * A studio running on its own dev server, loaded by the overlay instead of
   * the bundle mounted beside the API.
   *
   * A built bundle has no hot reload, so working on the studio itself
   * against a host app is a rebuild, a restart and a cache clear per edit.
   * Pointing this at a studio dev server lets that server keep its modules,
   * and the iframe loads it across origins — the same `?app=` arrangement the
   * two-server studio already uses. Absent, the mounted bundle is used, which
   * is what a consumer without a studio checkout wants.
   */
  readonly studioUrl?: string;
  /**
   * Inject the overlay launcher into the app's document. Default true.
   * `studio: false` disables the launcher too — there is no mounted app
   * for it to open.
   */
  readonly launcher?: boolean;
  /**
   * Project directory holding theme documents, resolved against the
   * project root. Default `"spin"`. Local paths only — shared trees
   * arrive through `extends`, never through this path.
   */
  readonly themesDir?: string;
  /**
   * Project directory holding user-authored `.html` components, resolved
   * against the project root. Default `"src/lib/components"`. Local paths
   * only — shared trees arrive through `extends`, never through this
   * path.
   */
  readonly componentsDir?: string;
  /**
   * Custom-element prefix for files under `componentsDir`. Defaults to the
   * sanitized project `package.json` name, else `"app"`.
   */
  readonly prefix?: string;
}

/**
 * Every utility the catalog names across the given documents.
 *
 * The reference app's rail and swatch pages choose their class from the
 * catalog at runtime, so the scanner never sees them; without this the
 * specimen renders unstyled.
 */
function catalogUtilities(documents: Record<string, ThemeDocument>): string[] {
  const names = new Set<string>();
  for (const document of Object.values(documents)) {
    const parsed = parseTokens(
      document as Parameters<typeof parseTokens>[0],
    );
    if (parsed.ok) {
      for (const section of describeCatalog(parsed.tree)) {
        for (const utility of section.utilities) names.add(utility);
      }
    }
  }
  return [...names];
}

/**
 * The plugin that replaces `@unocss/vite` in a spin app.
 *
 * It owns the whole chain — globs, generation, and later the dev server —
 * so there is no `uno.config.ts` in a spin app and nothing to keep in sync.
 * `spin()` composes the preset itself; a consumer only names themes,
 * content, and any extra presets such as icons.
 */

/**
 * The themes a project serves: the brand layer, forked by local files of
 * the same name.
 *
 * Fork-by-name, later wins: a `spin/*.json` file named after a brand
 * theme replaces it for that project, and local-only names sit beside
 * the brand. The daemon answers from the same merge, so the studio
 * lists what the app renders.
 */
export function projectThemes(
  brand: Record<string, ThemeDocument>,
  local: Record<string, ThemeDocument>,
): Record<string, ThemeDocument> {
  return { ...brand, ...local };
}
/**
 * The icon data a lazy collection loader hands `@unocss/preset-icons`.
 *
 * Structural rather than the `@iconify/types` import: that package arrives
 * transitively through the icons preset, and a direct import would add a
 * dependency for one annotation. The loader only reads the `icons` table
 * (each body an SVG fragment string), so this states what the preset
 * consumes and lets the excess of a real `icons.json` flow through.
 */
interface IconCollection {
  readonly prefix: string;
  readonly width?: number;
  readonly height?: number;
  readonly icons: Record<
    string,
    { readonly body: string; readonly width?: number; readonly height?: number }
  >;
}
/**
 * Validate a parsed `icons.json` just far enough to hand it on.
 *
 * `JSON.parse` answers `unknown`, and the collections ship as data — a
 * corrupt install should fail loudly rather than smuggle an `as` through.
 * The `icons` table and the root `width`/`height` grid dimensions (`24x24`
 * for Lucide/Tabler, `32x32` for Carbon, `256x256` for Phosphor) are kept
 * so `@unocss/preset-icons` emits the right `viewBox` instead of cropping to
 * its `16x16` fallback.
 */
function parseIconCollection(value: unknown): IconCollection {
  if (typeof value !== "object" || value === null || !("prefix" in value) || !("icons" in value)) {
    throw new Error("[spin] invalid icon collection: expected { prefix, icons }");
  }
  if (typeof value.prefix !== "string") {
    throw new Error("[spin] invalid icon collection: missing string prefix");
  }
  if (typeof value.icons !== "object" || value.icons === null) {
    throw new Error("[spin] invalid icon collection: missing icons table");
  }
  const rootWidth =
    "width" in value && typeof value.width === "number" ? value.width : undefined;
  const rootHeight =
    "height" in value && typeof value.height === "number" ? value.height : undefined;
  const table: Record<
    string,
    { readonly body: string; readonly width?: number; readonly height?: number }
  > = {};
  for (const [iconName, entry] of Object.entries(value.icons)) {
    if (typeof entry !== "object" || entry === null || !("body" in entry) || typeof entry.body !== "string") {
      throw new Error("[spin] invalid icon collection: every icon needs a string body");
    }
    const entryWidth =
      "width" in entry && typeof entry.width === "number" ? entry.width : undefined;
    const entryHeight =
      "height" in entry && typeof entry.height === "number" ? entry.height : undefined;
    table[iconName] = {
      body: entry.body,
      ...(entryWidth === undefined ? {} : { width: entryWidth }),
      ...(entryHeight === undefined ? {} : { height: entryHeight }),
    };
  }
  return {
    prefix: value.prefix,
    ...(rootWidth === undefined ? {} : { width: rootWidth }),
    ...(rootHeight === undefined ? {} : { height: rootHeight }),
    icons: table,
  };
}


/**
 * The icons preset every app gets unless it opts out.
 *
 * The five `@iconify-json/*` collections ship in `dependencies`, so the
 * loaders read their `icons.json` from the consumer's own install rather
 * than fetching over the network — an offline build still resolves the
 * glyphs its content names. Each collection loads through a `() =>
 * IconifyJSON` thunk rather than an eagerly parsed dataset, so only the
 * collections a stylesheet actually references are read. The instance is
 * built once per stage (`cachedIcons` carries it between generates)
 * because the preset closes over its loader state.
 *
 * Returns null when `icons: false` silences the default or the consumer
 * already composed `@unocss/preset-icons` in `presets` — the explicit
 * entry wins, and composing the same preset name twice would register
 * the same rules twice.
 */
function defaultIconsPreset(
  options: SpinPluginOptions,
  cached: Preset | null | undefined,
): Preset | null {
  if (options.icons === false) return null;
  if ((options.presets ?? []).some((preset) => preset.name === "@unocss/preset-icons")) return null;
  if (cached !== undefined) return cached;
  const require = createRequire(import.meta.url);
  // Statically named so the manifest check sees the dependency: the five
  // collections ship in `dependencies`, and the loaders resolve them below.
  const roots: Record<string, string> = {
    carbon: require.resolve("@iconify-json/carbon/package.json"),
    lucide: require.resolve("@iconify-json/lucide/package.json"),
    "material-symbols": require.resolve("@iconify-json/material-symbols/package.json"),
    ph: require.resolve("@iconify-json/ph/package.json"),
    tabler: require.resolve("@iconify-json/tabler/package.json"),
  };
  const lazy = (name: string): (() => Promise<IconCollection>) => {
    let parsed: IconCollection | null = null;
    return async (): Promise<IconCollection> => {
      if (parsed !== null) return parsed;
      const { readFile } = await import("node:fs/promises");
      const { dirname, join } = await import("node:path");
      const text = await readFile(join(dirname(roots[name] as string), "icons.json"), "utf8");
      parsed = parseIconCollection(JSON.parse(text));
      return parsed;
    };
  };
  return presetIcons({
    collections: {
      carbon: lazy("carbon"),
      lucide: lazy("lucide"),
      "material-symbols": lazy("material-symbols"),
      ph: lazy("ph"),
      tabler: lazy("tabler"),
    },
  });
}


type StylesheetStage = UnpluginOptions & {
  /** Vite dev-server lifecycle: unplugin forwards this root hook to vite untouched. Async so the mount's dynamic import settles before serving. */
  configureServer?: (server: DevServer) => void | Promise<void>;
};

function spinStylesheetStage(options: SpinPluginOptions = {}): StylesheetStage {
  // `configResolved` sets this before anything generates; the default only
  // covers non-vite hosts.
  let root = process.cwd();
  let envMode: "dev" | "build" = "build";
  // The walk is the expensive half and content changes rarely, so the scan
  // is cached and the stylesheet regenerates from it. An overlay change
  // regenerates from the same scan — the content is unchanged, the theme
  // documents behind the rules are not.
  let cachedFiles: ContentMap | null = null;
  let cachedSources: string | null = null;
  // The default icons preset, built once and shared across generates: the
  // collections are parsed lazily per glyph, so holding one instance costs
  // a handful of file lookups rather than five parsed datasets.
  let cachedIcons: Preset | null | undefined;

  async function generate(): Promise<string> {
    if ("classless" in options) {
      throw new Error(
        "spin.vite: `classless` was removed — primitives always claim their bare tags. Narrow with `primitives: [...]` instead.",
      );
    }
    // No `themes` option means the project's own: the brand layer,
    // forked by the configured directory at the root. Reading disk on
    // every generate is cheap — a handful of small files — and means a
    // theme forked while the server is running is live on the next
    // generate rather than needing a restart.
    const disk = options.themes === undefined
      ? await loadProjectBrand(root, options.themesDir)
      : { themes: {}, palettes: {}, spacings: {} };
    const themes = options.themes ??
      projectThemes(
        options.extends?.themes ?? {},
        disk.themes,
      );
    const palettes = options.themes === undefined
      ? { ...options.extends?.palettes, ...disk.palettes }
      : {};
    const spacings = options.themes === undefined
      ? { ...options.extends?.spacings, ...disk.spacings }
      : {};
    noteDiskDocuments(themes);
    // The walk is expensive and content changes rarely; the safelist is
    // rebuilt every time because an overlay write can introduce tokens
    // whose utilities must resolve even though no file changed.
    const componentsDir = options.componentsDir ?? options.extends?.componentsDir ?? "src/lib/components";
    const content = options.content ?? {};
    // The toolchain's own sources are content in every app: example modules
    // carry the glyph names and utilities the example markup spends, and the
    // machine example recipes carry their own utilities. They resolve by
    // package name, so no app spells the workspace geometry.
    const { createRequire } = await import("node:module");
    const { dirname } = await import("node:path");
    const req = createRequire(import.meta.url);
    const machines = dirname(req.resolve("@spinjs/components"));
    const preset = dirname(req.resolve("@spinjs/preset"));
    const internal = [
      `${preset}/rules/primitives/*.examples.ts`,
      `${preset}/rules/primitives/categories.ts`,
      `${machines}/*/examples/*.html`,
      `${machines}/index.ts`,
    ];
    const filesystem = [
      ...internal,
      ...(content.filesystem ?? []),
      `${componentsDir}/**/*.{html,ts,tsx}`,
    ];
    const include = [...(content.pipeline?.include ?? []), /\.html($|\?)/];
    cachedFiles ??= await scanContent({ ...content, filesystem, pipeline: { ...content.pipeline, include } }, root);
    cachedSources ??= joinContent(cachedFiles);
    const safelist = catalogUtilities(resolveThemes(themes));
    // Static: index.ts never imports plugin.ts, so this edge runs one way —
    // the browser graph stays clean because index.ts carries no `node:`.
    const iconsPreset = defaultIconsPreset(options, cachedIcons);
    cachedIcons = iconsPreset;
    const generator = await createGenerator({
      envMode,
      presets: [
        ...(iconsPreset !== null ? [iconsPreset] : []),
        ...(options.presets ?? []),
        spinPreset({
          themes,
          palettes,
          spacings,
          shortcuts: options.shortcuts,
          primitives: options.primitives,
          resolveDocuments: resolveThemes,
        }),
      ],
      safelist: options.safelist === false ? undefined : safelist,
    });
    const scanned = await generator.generate(cachedSources);
    await checkStrictClasses({
      files: cachedFiles,
      matched: scanned.matched,
      themes,
      shortcuts: options.shortcuts,
      strict: options.strictClasses,
      rawType: options.rawType,
      envMode,
      root,
      report: (message) => console.warn(message),
    });
    return scanned.css;
  }

  return {
    name: "spin",
    enforce: "post",
    resolveId(id: string) {
      return id === "uno.css" || id === "spin/styles.css" || id === "spin.css"
        ? VIRTUAL_ID
        : null;
    },
    load(id: string) {
      if (id !== VIRTUAL_ID && id.split("?")[0] !== VIRTUAL_ID) return null;
      return generate();
    },
    vite: {
      // The toolchain carries its own specifier table: the app graph is
      // bundled by rolldown, which does not read the Deno import maps the
      // packages live in, and this is the bridge — declared here, so no
      // app maintains a copy that drifts. The `fs.allow` entries keep the
      // dev server able to read the workspace and the two virtual URLs
      // the stylesheet serves under.
      async config() {
        const aliases = await spinAliases();
        // Recipes resolve through the components stage, not the table: an
        // exact-machine entry would otherwise steer an example recipe
        // beneath the presentation module. `$1` is the identity the stage
        // claims — aliases ride ahead of plugin hooks. (The examples
        // registration deliberately shares the gallery module's specifier:
        // importing it for its side effect registers, importing names
        // reads data — one specifier, no second virtual id to keep in
        // step.)
        const stage = {
          find: /^(@spinjs\/components\/.+\.html|lib\/components\/.+\.html)$/,
          replacement: "$1",
        };
        return {
          resolve: { alias: [stage, ...aliases] },
          optimizeDeps: {
            exclude: ["spin/components", "@spinjs/components/examples"],
            entries: ["index.html", "src/**/*.{ts,tsx}"],
          },
          server: {
            fs: {
              allow: [
                await spinWorkspaceRoot(),
                "/__uno.css",
                "/__uno.css?inline",
                "/@unocss",
              ],
            },
          },
        };
      },
      configResolved(config: { root: string; command: string }) {
        root = config.root;
        envMode = config.command === "serve" ? "dev" : "build";
      },
      // Dev-only chrome: a badge in the user's app while the overlay
      // differs from disk. `transformIndexHtml` runs in build too, so the
      // tag is emitted only while serving — a production build carries no
      // trace of the editing session.
      transformIndexHtml(html) {
        if (envMode !== "dev") return html;
        if (options.studio === false || options.launcher === false) return html;
        const studioBase = (options.apiBase ?? "/__spin").replace(/\/rpc$/, "");
        return html.replace(
          "</body>",
          // The launcher tells you as much while you work elsewhere: an
          // expanded style tag blinking on in another document is a thing
          // you learn to ignore.
          `<script type="module">
import { spinOverlay } from "/__spin/overlay.js";
spinOverlay("${studioBase}/rpc"${
            options.studioUrl === undefined
              ? ""
              : `, ${JSON.stringify(options.studioUrl)}`
          });
</script>
</body>`,
        );
      },
    },
    // A rollup-shaped hook: unplugin forwards unknown root hooks to vite
    // untouched, so the dev-server lifecycle lives here rather than
    // nested under `vite:`, where the rollup conversion drops it.
    async configureServer(server: DevServer) {
      // An overlay write regenerates the sheet from the same cached
      // scan — only the rules behind the theme documents change. The
      // module is a CSS module, so the client swaps the stylesheet in
      // place rather than reloading the page.
      const stop = onOverlayChange(() => {
        const modules = [...server.moduleGraph.urlToModuleMap.values()];
        const mod = modules
          .flatMap((entry) => entry instanceof Set ? [...entry] : [entry])
          .find((node) => node.url === VIRTUAL_ID);
        if (mod) {
          server.moduleGraph.invalidateModule(mod);
          server.ws.send({
            type: "update",
            updates: [{
              // A `js-update`: vite 8 swaps a `<link>` for anything else,
              // but this module injects its sheet from JS, so only a
              // re-import re-runs `updateStyle` with the regenerated sheet.
              type: "js-update",
              path: VIRTUAL_ID,
              acceptedPath: VIRTUAL_ID,
              timestamp: Date.now(),
            }],
          });
        } else {
          server.ws.send({ type: "full-reload", path: "*" });
        }
      });
      server.httpServer?.once("close", stop);
      // The mount is automatic: the plugin serves its own API at the
      // resolved root, and the app names no mount to get the studio. The
      // import is dynamic so the preset keeps no static edge to the api —
      // dependencies point the other way — and `options.mount` stays as
      // the override for a custom root or studio directory.
      if (options.studio !== false) {
        const { mountSpinApp } = await import("@spinjs/spin/api");
        (options.mount ?? mountSpinApp(root))({ server, root });
      }
    },
  };
}

/**
 * The single plugin a spin app wires: `spin.vite()`.
 *
 * One call, two stages: the `.html → define()` components transform runs
 * `pre` (it must claim `.html` before the bundler parses it as a document),
 * and the stylesheet + dev chrome runs `post`. A single plugin object
 * cannot carry two `enforce` phases, so the two unplugin stages compose
 * here — the app still names one plugin, and the phases stay where each
 * stage needs them.
 *
 * The components stage is present only when `@spinjs/components` is
 * installed: a preset-only app (React, Solid, raw CSS) wires the same
 * plugin and gets the stylesheet without the transform. This try-resolve
 * is the composition root's single detection point — nothing else in
 * the tree asks what is installed.
 */
export const spin = createUnplugin<SpinPluginOptions | undefined, true>(
  (options = {}) => {
    const stages: UnpluginOptions[] = [];
    try {
      createRequire(import.meta.url).resolve("@spinjs/components/compiler");
      stages.push(
        spinComponentsStage({
          componentsDir: options.componentsDir ?? options.extends?.componentsDir,
          prefix: options.prefix,
        }),
      );
    } catch {
      // Preset-only: no components package, no transform.
    }
    stages.push(spinStylesheetStage(options));
    return stages;
  },
);
