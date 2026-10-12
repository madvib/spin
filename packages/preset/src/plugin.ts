import { createGenerator, type Preset } from "@unocss/core";
import { createUnplugin } from "unplugin";
import { type ContentOptions, joinContent, scanContent } from "./content.ts";
import { describeCatalog } from "./catalog.ts";
import { parseTokens, type ThemeDocument } from "@spin/theme";

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
export const spin = createUnplugin<SpinPluginOptions>((options) => {
  let root = Deno.cwd();
  let envMode: "dev" | "build" = "build";
  // The walk is the expensive half and content changes rarely, so the scan
  // is cached and the stylesheet regenerates from it. An overlay change
  // regenerates from the same scan — the content is unchanged, the theme
  // documents behind the rules are not.
  let cached: { sources: string; safelist: string[] } | null = null;

  async function generate(): Promise<string> {
    const themes = options.themes ?? {};
    cached ??= {
      sources: joinContent(await scanContent(options.content ?? {}, root)),
      safelist: catalogUtilities(themes),
    };
    // Imported lazily: this module is re-exported by the preset's index, so
    // importing it at the top would make the cycle observable at load time.
    const { spinPreset } = await import("./index.ts");
    const generator = await createGenerator({
      envMode,
      presets: [...(options.presets ?? []), spinPreset({ themes })],
      safelist: options.safelist === false ? undefined : cached.safelist,
    });
    const scanned = await generator.generate(cached.sources);
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
    },
    resolveId(id) {
      return id === "uno.css" ? VIRTUAL_ID : null;
    },
    load(id) {
      if (id !== VIRTUAL_ID) return null;
      return generate();
    },
  };
});
