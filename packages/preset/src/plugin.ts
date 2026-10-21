import { createGenerator, type Preset, type UserShortcuts } from "@unocss/core";
import { createUnplugin } from "unplugin";
import { type ContentOptions, joinContent, scanContent } from "./content.ts";
import { describeCatalog } from "./catalog.ts";
import { parseTokens, type ThemeDocument } from "@spin/theme";
import { starterThemes } from "@spin/theme/themes";
import {
  noteDiskDocuments,
  onOverlayChange,
  resolveThemes,
} from "./session.ts";

/**
 * The slice of a dev server the overlay lifecycle touches. Structural, so
 * `@spin/preset` keeps no bundler dependency and the hook stays portable
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

async function spinWorkspaceRoot(): Promise<string> {
  // Walk up until a real workspace manifest is found: a deno.json with a
  // `workspace` member, or a package.json with `workspaces`. Every package
  // in the repo has its own deno.json, so "first manifest wins" would stop
  // at the preset itself — and the specifier this walk exists for (the uno
  // pin) lives in the hoisted root, not the member dir.
  const { dirname, join } = await import("node:path");
  const { readFile, readdir } = await import("node:fs/promises");
  const { fileURLToPath } = await import("node:url");
  let dir = dirname(dirname(fileURLToPath(import.meta.url))); // this file's package dir
  let fallback = dir;
  for (;;) {
    let names: string[];
    try {
      names = await readdir(dir);
    } catch {
      names = [];
    }
    let isWorkspace = false;
    let isProject = false;
    if (names.includes("deno.json")) {
      try {
        const manifest = JSON.parse(
          await readFile(join(dir, "deno.json"), "utf8"),
        ) as { workspace?: unknown };
        if (Array.isArray(manifest["workspace"])) {
          isWorkspace = manifest["workspace"].length > 0;
        } else {
          // A manifest without the member list is one of the packages: the
          // nearest one is the fallback when the walk dries up.
          fallback = dir;
        }
      } catch {
        // Unreadable manifest: keep walking.
      }
    } else if (names.includes("package.json")) {
      try {
        const manifest = JSON.parse(
          await readFile(join(dir, "package.json"), "utf8"),
        ) as { workspaces?: unknown };
        // A package.json without workspaces is a single npm project: its
        // root is where its node_modules lives, which is what the uno pin
        // and the dev-server's file reads need.
        isProject = manifest["workspaces"] === undefined;
        isWorkspace = manifest["workspaces"] !== undefined;
      } catch {
        // Unreadable manifest: keep walking.
      }
    }
    if (isWorkspace) return dir;
    if (isProject) return dir;
    const parent = dirname(dir);
    if (parent === dir) return fallback;
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
  const { join } = await import("node:path");
  const pkg = (rel: string): string =>
    fileURLToPath(new URL(rel, import.meta.url));
  const source = {
    themeSrc: pkg("../../theme/src/"),
    themeIndex: pkg("../../theme/src/index.ts"),
    animationIndex: pkg("../../animation/src/index.ts"),
    presetSrc: pkg("./"),
    presetIndex: pkg("./index.ts"),
    procedures: pkg("./primitives-procedures.ts"),
    apiIndex: pkg("../../api/src/index.ts"),
    projectIndex: pkg("../../project/src/index.ts"),
  };
  const unoCore = join(
    await spinWorkspaceRoot(),
    "node_modules/@unocss/core/dist/index.mjs",
  );
  const table: readonly Specifier[] = [
    {
      find: "@spin/theme/base",
      replacement: pkg("../../theme/src/base/index.ts"),
      targets: [source.themeIndex],
    },
    {
      find: /^@spin\/theme\/(.+)$/,
      replacement: `${source.themeSrc}$1`,
      targets: [source.themeIndex],
    },
    {
      find: "@spin/theme",
      replacement: source.themeIndex,
      targets: [source.themeIndex],
    },
    {
      find: "@spin/animation",
      replacement: source.animationIndex,
      targets: [source.animationIndex],
    },
    {
      find: /^@spin\/preset\/(.+)$/,
      replacement: `${source.presetSrc}$1`,
      targets: [source.presetIndex],
    },
    {
      find: "@spin/preset",
      replacement: source.presetIndex,
      targets: [source.presetIndex],
    },
    {
      find: "@spin/primitives-procedures",
      replacement: source.procedures,
      targets: [source.procedures],
    },
    {
      find: "@spin/api",
      replacement: source.apiIndex,
      targets: [source.apiIndex],
    },
    {
      // The project: where a project's files are. The daemon's procedures
      // read them, and a client that wants to know what a project holds
      // asks the package that owns them.
      find: "@spin/project",
      replacement: source.projectIndex,
      targets: [source.projectIndex],
    },
    {
      find: "@spin/kit",
      replacement: pkg("../../kit/src/index.ts"),
      targets: [pkg("../../kit/src/index.ts")],
    },
    // Pure id-shaping: every `npm:` specifier the packages carry drops the
    // prefix so rolldown can find it in node_modules. No target to outlive.
    { find: /^npm:(.+)$/, replacement: "$1", targets: [] },
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

import { spinPreset } from "./index.ts";

// The Deno global the plugin defaults its root from. Declared, not
// imported: bundler consumers typecheck this file without Deno types, and
// `configResolved` overwrites the default before anything generates.
declare const Deno: { cwd(): string } | undefined;

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
   * The documents to serve verbatim. Omitted, the project serves the shipped
   * starters, forked by `spin/*.json` at its root. The overlay overrides
   * whichever set is in play while the studio is open.
   */
  readonly themes?: Record<string, ThemeDocument>;
  /** Presets to compose alongside ours — icons are the usual reason. */
  readonly presets?: readonly Preset[];
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
  /** Safelist the catalog so a utility named only as data still resolves. */
  readonly safelist?: boolean;
  /**
   * Install middleware on the dev server — the API, the studio bundle, and
   * later the completion endpoint. The plugin cannot import `@spin/api`
   * (dependencies point the other way), so the app that runs both passes
   * this in. Receives the server and the project root the plugin resolved,
   * so the mount can point filesystem procedures at the project.
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
   *
   * The studio mounts its own API for the dev case, and without this the
   * plugin injects the launcher into the studio itself — a FAB that opens
   * the studio over the studio. The studio is the tool, not its own target.
   */
  readonly launcher?: boolean;
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
 * Every `spin/*.json` at the root, parsed.
 *
 * A file that doesn't parse is skipped rather than thrown on: a half
 * written theme in an editor would otherwise break the whole stylesheet,
 * and one bad theme should not cost the app its other themes.
 */
async function themesFromDisk(
  root: string,
): Promise<Record<string, ThemeDocument>> {
  const { readdir, readFile } = await import("node:fs/promises");
  const { join } = await import("node:path");
  let names: string[];
  try {
    names = (await readdir(join(root, "spin"))).filter((name) =>
      name.endsWith(".json")
    );
  } catch {
    return {};
  }
  const themes: Record<string, ThemeDocument> = {};
  for (const name of names) {
    try {
      themes[name.slice(0, -".json".length)] = JSON.parse(
        await readFile(join(root, "spin", name), "utf8"),
      );
    } catch {
      // Skipped: see above.
    }
  }
  return themes;
}

/**
 * The themes a project serves: the shipped starters, forked by files of the
 * same name.
 *
 * A project never restates a starter to render it — deleting every file
 * still leaves four themes — and a `spin/*.json` file named after one forks
 * it for that project. The daemon answers from the same base, so the studio
 * lists what the app renders.
 */
export function projectThemes(
  overrides: Record<string, ThemeDocument>,
): Record<string, ThemeDocument> {
  return { ...starterThemes, ...overrides };
}

export const spin = createUnplugin<SpinPluginOptions>((options) => {
  // `configResolved` sets this before anything generates; the default only
  // covers non-vite hosts. Guarded because the studio typechecks this file
  // without Deno types, and an unguarded reference is a build break there.
  let root = typeof Deno !== "undefined" ? Deno.cwd() : process.cwd();
  let envMode: "dev" | "build" = "build";
  // The walk is the expensive half and content changes rarely, so the scan
  // is cached and the stylesheet regenerates from it. An overlay change
  // regenerates from the same scan — the content is unchanged, the theme
  // documents behind the rules are not.
  let cachedSources: string | null = null;

  async function generate(): Promise<string> {
    // No `themes` option means the project's own: the shipped starters,
    // forked by `spin/*.json` at the root. Reading disk on every generate is
    // cheap — a handful of small files — and means a theme forked while the
    // server is running is live on the next generate rather than needing a
    // restart.
    const themes = options.themes ?? projectThemes(await themesFromDisk(root));
    noteDiskDocuments(themes);
    // The walk is expensive and content changes rarely; the safelist is
    // rebuilt every time because an overlay write can introduce tokens
    // whose utilities must resolve even though no file changed.
    cachedSources ??= joinContent(
      await scanContent(options.content ?? {}, root),
    );
    const safelist = catalogUtilities(resolveThemes(themes));
    // Static: index.ts never imports plugin.ts, so this edge runs one way —
    // the browser graph stays clean because index.ts carries no `node:`.
    const generator = await createGenerator({
      envMode,
      presets: [
        ...(options.presets ?? []),
        spinPreset({ themes, shortcuts: options.shortcuts }),
      ],
      safelist: options.safelist === false ? undefined : safelist,
    });
    const scanned = await generator.generate(cachedSources);
    return scanned.css;
  }

  return {
    name: "spin",
    enforce: "post",
    vite: {
      // The toolchain carries its own specifier table: the app graph is
      // bundled by rolldown, which does not read the Deno import maps the
      // packages live in, and this is the bridge — declared here, so no
      // app maintains a copy that drifts. The `fs.allow` entries keep the
      // dev server able to read the workspace and the two virtual URLs
      // the stylesheet serves under.
      async config() {
        return {
          resolve: { alias: await spinAliases() },
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
        if (options.launcher === false) return html;
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
<\/script>
</body>`,
        );
      },
    },
    // A rollup-shaped hook: unplugin forwards unknown root hooks to vite
    // untouched, so the dev-server lifecycle lives here rather than
    // nested under `vite:`, where the rollup conversion drops it.
    configureServer(server: DevServer) {
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
      options.mount?.({ server, root });
    },
    resolveId(id) {
      return id === "uno.css" ? VIRTUAL_ID : null;
    },
    load(id) {
      if (id !== VIRTUAL_ID && id.split("?")[0] !== VIRTUAL_ID) return null;
      return generate();
    },
  };
});
