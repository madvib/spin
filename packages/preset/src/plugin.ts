import { createGenerator, type Preset } from "@unocss/core";
import { createUnplugin } from "unplugin";
import { type ContentOptions, joinContent, scanContent } from "./content.ts";
import { describeCatalog } from "./catalog.ts";
import { parseTokens, type ThemeDocument } from "@spin/theme";
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
  /** Themes off disk. The overlay overrides these while the studio is open. */
  readonly themes?: Record<string, ThemeDocument>;
  /** Presets to compose alongside ours — icons are the usual reason. */
  readonly presets?: readonly Preset[];
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
    // No `themes` option means the project owns them: `spin/*.json` at the
    // root, the shape a real app has. Reading them on every generate is
    // cheap — a handful of small files — and means a theme added while the
    // server is running is live on the next edit rather than needing a
    // restart.
    const themes = options.themes ?? await themesFromDisk(root);
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
      presets: [...(options.presets ?? []), spinPreset({ themes })],
      safelist: options.safelist === false ? undefined : safelist,
    });
    const scanned = await generator.generate(cachedSources);
    return scanned.css;
  }

  return {
    name: "spin",
    enforce: "post",
    vite: {
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
