/**
 * The project's operations: every answer a project root can give.
 *
 * Every operation takes the root it is about. There is no global here, and no
 * bound root: a process that serves many projects resolves the root per call,
 * and an operation never reads one that was not named.
 *
 * The filesystem is reached through dynamic imports. The daemon's client is
 * bundled for the browser, and a `node:` import at the top of this module
 * would follow it into a bundle that must never touch a disk.
 */

import { configurationIn } from "./configuration.ts";
import { configScaffoldText, wireConfigText } from "./config-text.ts";
import { writeProjectComponentsDts } from "./components.ts";
import {
  COMPONENTS_DIR,
  CONFIG_FILES,
  CONFIG_FILENAME,
  defaultPrefix,
  initFiles,
  isWired,
  PROJECT_DIR,
} from "./facts.ts";
import { listIcons, readIcon, removeIcon, writeIcon } from "./icons.ts";
import { copyBrandDirectory, createBrand, getBrand, renameBrand, setBrandDesignLanguage, setBrandPalette, setBrandType } from "./brand-service.ts";
import type {
  ProjectConfiguration,
  ThemeRecordDeclaration,
} from "./types.ts";
import type {
  InitProjectOptions,
  ProjectFacet,
  ProjectReport,
  ProjectTheme,
  SpinConfigFile,
  WriteResult,
} from "./schema.ts";


/** The project's configured themes directory, resolved to the filesystem. */
async function themesDirOf(
  root: string,
): Promise<{ path: string; file: boolean; display: string }> {
  const { resolveProjectDir } = await import("./resolve-dir.ts");
  let value = PROJECT_DIR;
  try {
    value = (await readConfiguration(root)).themesDir || PROJECT_DIR;
  } catch {
    value = PROJECT_DIR;
  }
  const resolved = await resolveProjectDir(root, value, "themes");
  return { ...resolved, display: value };
}
/** The build configs — the ones where spin may be wired. */
const BUILD_CONFIGS: readonly string[] = CONFIG_FILES;

/**
 * One export of one module, loaded from the project root.
 *
 * Resolution runs from the root the way the bundler runs from the
 * configuration: a relative source lands beside the config, a bare one
 * in the root's `node_modules`. JSON loads by read rather than import
 * so the Node daemon serves it the same way the Bun one does.
 */
async function loadExport(
  root: string,
  source: string,
  exportName: string,
): Promise<unknown> {
  const { createRequire } = await import("node:module");
  const { join } = await import("node:path");
  const { pathToFileURL } = await import("node:url");
  const resolved = createRequire(join(root, "package.json")).resolve(source);
  if (resolved.endsWith(".json")) {
    const { readFile } = await import("node:fs/promises");
    const document = JSON.parse(await readFile(resolved, "utf8")) as Record<
      string,
      unknown
    >;
    return exportName === "default" ? document : document[exportName];
  }
  const module = await import(pathToFileURL(resolved).href) as Record<
    string,
    unknown
  >;
  return exportName === "default" ? module.default : module[exportName];
}

/**
 * A declared themes record, loaded.
 *
 * A per-key map loads each entry from its import; a whole-record
 * import loads as one. Anything that cannot be followed or loaded is
 * skipped loudly — the plugin serves a document there, and the daemon
 * says it cannot see it rather than serving nothing quietly.
 */
async function loadThemeRecord(
  root: string,
  where: string,
  scope: string,
  record: ThemeRecordDeclaration,
): Promise<Record<string, unknown>> {
  if (record.kind === "record") {
    if (record.value === null) {
      console.warn(`[spin] ${where}: could not follow ${scope}, skipping it`);
      return {};
    }
    try {
      const value = await loadExport(
        root,
        record.value.source,
        record.value.exportName,
      );
      if (value === null || typeof value !== "object") {
        throw new Error("not a record");
      }
      return value as Record<string, unknown>;
    } catch {
      console.warn(
        `[spin] ${where}: could not load ${scope} from '${record.value.source}', skipping it`,
      );
      return {};
    }
  }
  const docs: Record<string, unknown> = {};
  for (const entry of record.entries) {
    if (entry.value === null) {
      console.warn(
        `[spin] ${where}: could not follow ${scope} entry '${entry.key}', skipping it`,
      );
      continue;
    }
    try {
      const document = await loadExport(
        root,
        entry.value.source,
        entry.value.exportName,
      );
      if (document === null || typeof document !== "object") {
        throw new Error("not a document");
      }
      docs[entry.key] = document;
    } catch {
      console.warn(
        `[spin] ${where}: could not load ${scope} theme '${entry.key}' from '${entry.value.source}', skipping it`,
      );
    }
  }
  return docs;
}

/**
 * The verbatim `themes:` map the configuration declares, loaded.
 *
 * A declared map replaces the whole stack exactly as the plugin does:
 * the daemon serves what this loads and nothing else.
 */
async function servedVerbatim(
  root: string,
  config: ProjectConfiguration,
): Promise<Record<string, unknown>> {
  if (config.verbatimThemes === null) return {};
  return await loadThemeRecord(
    root,
    config.file ?? "configuration",
    "themes",
    config.verbatimThemes,
  );
}

/**
 * The brand layer the project's configuration names, by theme name.
 *
 * The daemon follows the consumer's `extends` in whichever shape it
 * takes: a brand value's `themes` record or an inline record. The
 * layer is what the local disk forks — the same merge the plugin
 * serves, so the studio lists what the app renders. A brand that
 * cannot be loaded or followed is served as nothing, loudly: the
 * daemon logs which file it could not follow and serves the local
 * disk alone.
 */
async function brandThemes(
  root: string,
  config: ProjectConfiguration,
): Promise<Record<string, unknown>> {
  const declared = config.extends;
  const where = config.file ?? "configuration";
  if (declared === null) return {};
  if (declared.kind === "unresolved") {
    console.warn(
      `[spin] ${where}: could not follow extends, serving local themes only`,
    );
    return {};
  }
  if (declared.kind === "inline") {
    return await loadThemeRecord(root, where, "extends", declared.record);
  }
  try {
    const value = await loadExport(
      root,
      declared.value.source,
      declared.value.exportName,
    ) as { readonly themes?: unknown } | null;
    const themes = value?.themes;
    if (themes === null || typeof themes !== "object") return {};
    return themes as Record<string, unknown>;
  } catch {
    console.warn(
      `[spin] ${where}: could not load extends from '${declared.value.source}', serving local themes only`,
    );
    return {};
  }
}

/**
 * Why a write to `name` is refused when the configuration declares its
 * themes verbatim.
 *
 * A declared name is read-only here: its document lives in the module
 * the configuration imports (or in the configuration itself, when the
 * daemon cannot follow the value), and a local file would never be
 * served. An undeclared name would not be served either — the verbatim
 * map replaces the whole stack, so a new file lands nowhere.
 */
function verbatimRefusal(config: ProjectConfiguration, name: string): string {
  const declared = config.verbatimThemes;
  if (declared?.kind === "record" && declared.value != null) {
    return `Theme '${name}' is read-only here; it is served from '${declared.value.source}'.`;
  }
  const entry = declared?.kind === "entries"
    ? declared.entries.find((ref) => ref.key === name)
    : undefined;
  if (entry?.value != null) {
    return `Theme '${name}' is read-only here; it is served from '${entry.value.source}'.`;
  }
  if (entry !== undefined) {
    return `Theme '${name}' is read-only here; it is served from '${config.file}'.`;
  }
  return `Theme '${name}' would not be served: '${config.file}' declares its themes verbatim.`;
}
/** A theme document as the text written for it. */
function themeJson(document: unknown): string {
  return JSON.stringify(document, null, 2) + "\n";
}

/** Whether a path is there. */
async function exists(path: string): Promise<boolean> {
  const { access } = await import("node:fs/promises");
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * The file a theme name reads and writes: the flat file when the project
 * carries one, else the brand directory's identity file. A flat file wins
 * over a brand of the same name — the fork is explicit, and the build
 * serves the same winner.
 */
async function themeFile(dir: string, name: string): Promise<string | null> {
  const { join } = await import("node:path");
  const { stat } = await import("node:fs/promises");
  const flat = join(dir, `${name}.json`);
  if (await exists(flat)) return flat;
  const brand = join(dir, name, "tokens.json");
  try {
    if ((await stat(join(dir, name))).isDirectory() && await exists(brand)) {
      return brand;
    }
  } catch {
    // No brand by that name.
  }
  return null;
}

/**
 * What a root holds: the project's report.
 *
 * One walk, because `detect` and `current` differ only in which root they
 * examine, and a second copy of this walk would be a second place for the
 * notions of "has spin", "has uno", "is wired" to drift.
 *
 * The uno config is where the preset is wired, so it answers the other half
 * of "is this a spin project" without being the mark of one: a project can
 * hold themes it has not wired up yet.
 */
export async function detectProject(root: string): Promise<ProjectReport> {
  const { readdir, readFile, stat } = await import("node:fs/promises");
  const { join, basename } = await import("node:path");
  const { existsSync } = await import("node:fs");
  const { path: here, file } = await themesDirOf(root);
  const hasSpin = existsSync(here);
  let themes: string[] = [];
  if (hasSpin) {
    if (file) {
      themes = basename(here).endsWith(".json") ? [basename(here)] : [];
    } else {
      try {
        const entries = await readdir(here);
        const listed: string[] = [];
        for (const entry of entries) {
          if (entry === CONFIG_FILENAME) continue;
          if (entry.endsWith(".json")) {
            listed.push(entry);
            continue;
          }
          // A brand directory reads as its name: the build serves the
          // composed layers under it, so the report names the brand.
          try {
            const full = join(here, entry);
            if (
              (await stat(full)).isDirectory() &&
              existsSync(join(full, "tokens.json"))
            ) {
              listed.push(entry);
            }
          } catch {
            // Not a brand: unlisted, like an unreadable file.
          }
        }
        themes = listed.sort();
      } catch {
        themes = [];
      }
    }
  }
  const wiredName = BUILD_CONFIGS.find((name) => existsSync(join(root, name)));
  let wired = false;
  if (wiredName !== undefined) {
    try {
      const text = await readFile(join(root, wiredName), "utf8");
      wired = isWired(text);
    } catch {
      wired = false;
    }
  }
  return {
    root,
    spin: hasSpin,
    uno: wiredName !== undefined,
    wired,
    themes,
  };
}

/**
 * The project a host serves.
 *
 * The same report {@link detectProject} gives: the difference is the root,
 * not the question. A host that serves one project asks about the root it
 * holds; a client that names a root asks about that one. One walk, so the
 * two cannot drift.
 */
export const currentProject = detectProject;

/**
 * Makes a project: the themes directory, a first theme, and the build
 * configuration that wires spin in.
 *
 * The composer, and it composes what each piece knows how to write: the
 * theme package makes a theme, the preset makes a config, and the project
 * decides where each of them lands.
 */
export async function findExistingConfigFile(
  root: string,
  bundler: string,
): Promise<string | null> {
  const { access } = await import("node:fs/promises");
  const { join } = await import("node:path");
  const base = bundler === "vite"
    ? "vite.config"
    : bundler === "rspack"
    ? "rspack.config"
    : bundler === "webpack"
    ? "webpack.config"
    : bundler === "rollup"
    ? "rollup.config"
    : bundler === "rolldown"
    ? "rolldown.config"
    : bundler === "esbuild" || bundler === "bun"
    ? "spin.config"
    : bundler === "unocss"
    ? "uno.config"
    : `${bundler}.config`;
  const exts = [".ts", ".mts", ".js", ".mjs", ".cjs"];
  for (const ext of exts) {
    const path = join(root, `${base}${ext}`);
    try {
      await access(path);
      return path;
    } catch {
      // Try the next extension.
    }
  }
  return null;
}

export async function initProject(
  options: InitProjectOptions,
): Promise<WriteResult> {
  const { mkdir, readFile, writeFile } = await import("node:fs/promises");
  const { join } = await import("node:path");
  try {
    const bundler = options.bundler ?? "vite";
    const themesDir = options.themesDir ?? PROJECT_DIR;
    const componentsDir = options.componentsDir ?? COMPONENTS_DIR;
    let prefix = options.prefix;
    if (prefix === undefined) {
      try {
        const manifest = JSON.parse(
          await readFile(join(options.root, "package.json"), "utf8"),
        );
        const derived = defaultPrefix(manifest?.name);
        if (derived !== "app") prefix = derived;
      } catch {
        // No manifest or unreadable: leave prefix unset.
      }
    }
    const opts = {
      themesDir,
      componentsDir,
      ...(prefix === undefined ? {} : { prefix }),
    };
    if (bundler === "unocss") {
      return {
        error:
          "spin init wires the Spin plugin; it does not write a preset-only UnoCSS config. Add spinPreset to uno.config.ts yourself, or scaffold in a project without uno.config.",
      };
    }
    const existing = await findExistingConfigFile(options.root, bundler);
    const existingText = existing === null
      ? null
      : await readFile(existing, "utf8");
    if (
      existingText !== null &&
      (bundler === "webpack" || bundler === "rollup") &&
      /\brequire\s*\(|\bmodule\.exports\b/.test(existingText)
    ) {
      return {
        error:
          "spin init cannot wire a CommonJS webpack/rollup config; use an ESM config or add the plugin manually.",
      };
    }
    const dir = join(options.root, themesDir);
    await mkdir(dir, { recursive: true });
    // The brand leads: `create` first so no stub exists to collide with,
    // then the build files, then the design language stamps its `$extends`
    // over the identical stub the files step wrote.
    if (options.from !== undefined) {
      const { rm } = await import("node:fs/promises");
      const stubDir = join(dir, options.name);
      const created = await createBrand({
        root: options.root,
        name: options.name,
        themesDir,
        seat: false,
      });
      if (created.error !== null) return created;
      await rm(stubDir, { recursive: true, force: true });
      const copied = await copyBrandDirectory(
        options.root,
        options.from,
        options.name,
        themesDir,
      );
      if (copied.error !== null) return copied;
    } else {
      const created = await createBrand({
        root: options.root,
        name: options.name,
        themesDir,
      });
      if (created.error !== null) return created;
    }
    const files = initFiles({
      name: options.name,
      starter: options.starter,
      bundler,
      themesDir,
      vendor: options.vendor,
    });
    const { dirname } = await import("node:path");
    for (const [rel, text] of Object.entries(files)) {
      // The build config scaffolds beside the themes directory, not in it.
      if (!rel.startsWith(`${options.name}/`)) continue;
      const file = join(dir, rel);
      await mkdir(dirname(file), { recursive: true });
      await writeFile(file, text, "utf8");
    }
    if (existing !== null) {
      if (!isWired(existingText!)) {
        await writeFile(existing, wireConfigText(existingText!, bundler, opts), "utf8");
      }
    } else {
      const scaffold = configScaffoldText(bundler, opts);
      await writeFile(join(options.root, scaffold.filename), scaffold.text, "utf8");
    }
    const mcpPath = join(options.root, ".mcp.json");
    if (!(await exists(mcpPath))) {
      await writeFile(
        mcpPath,
        JSON.stringify(
          {
            mcpServers: {
              spin: {
                command: "npx",
                args: ["spin", "mcp"],
              },
            },
          },
          null,
          2,
        ) + "\n",
        "utf8",
      );
    }
    await writeProjectComponentsDts(
      options.root,
      {
        componentsDir,
        ...(prefix === undefined ? {} : { prefix }),
      },
      { onlyIfSrcExists: true },
    );
    if (options.from === undefined && options.vendor !== true) {
      const stamped = await setBrandDesignLanguage(
        options.root,
        options.name,
        options.starter,
        themesDir,
      );
      if (stamped.error !== null) return stamped;
    }
    return { error: null };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * The bundler a project builds with, by its config files then its deps.
 *
 * A config file on disk wins: it is what the project runs. Otherwise the
 * manifest's dependencies say what the project installs. Nothing found is
 * `"vite"` — the default `init` writes.
 */
export async function detectBundler(root: string): Promise<string> {
  const { readdir, readFile } = await import("node:fs/promises");
  const { join } = await import("node:path");
  try {
    const names = await readdir(root);
    for (
      const [file, bundler] of [
        ["vite.config.", "vite"],
        ["rspack.config.", "rspack"],
        ["webpack.config.", "webpack"],
        ["rolldown.config.", "rolldown"],
        ["rollup.config.", "rollup"],
        ["uno.config.", "unocss"],
      ] as const
    ) {
      if (names.some((name) => name.startsWith(file))) return bundler;
    }
    let manifest: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
    try {
      manifest = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
    } catch {
      return "vite";
    }
    const deps = { ...manifest.dependencies, ...manifest.devDependencies };
    if ("vite" in deps) return "vite";
    if ("@rspack/core" in deps) return "rspack";
    if ("webpack" in deps) return "webpack";
    if ("rolldown" in deps) return "rolldown";
    if ("rollup" in deps) return "rollup";
    if ("esbuild" in deps) return "esbuild";
    if ("unocss" in deps) return "unocss";
  } catch {
    // Unreadable root: the default below.
  }
  return "vite";
}

/**
 * The Uno options a project's build configuration declares.
 *
 * The project that has no configuration declares none: an empty declaration
 * is an answer, not a failure.
 */
export async function readConfiguration(
  root: string,
): Promise<ProjectConfiguration> {
  const { readFile } = await import("node:fs/promises");
  const { join } = await import("node:path");
  const { existsSync } = await import("node:fs");
  const file = CONFIG_FILES.find((name) => existsSync(join(root, name)));
  if (file === undefined) {
    return {
      file: null,
      shortcuts: {},
      content: [],
      mount: null,
      themesDir: PROJECT_DIR,
      componentsDir: COMPONENTS_DIR,
      prefix: null,
      extends: null,
      verbatimThemes: null,
      unreadableFields: [],
      unreadable: false,
    };
  }
  let text: string;
  try {
    text = await readFile(join(root, file), "utf8");
  } catch {
    return {
      file,
      shortcuts: {},
      content: [],
      mount: null,
      themesDir: PROJECT_DIR,
      componentsDir: COMPONENTS_DIR,
      prefix: null,
      extends: null,
      verbatimThemes: null,
      unreadableFields: [],
      unreadable: true,
    };
  }
  const config = configurationIn(text, file);
  for (const field of config.unreadableFields) {
    console.warn(`[spin] ${file}: unreadable ${field}, using default`);
  }
  return config;
}

/**
 * The themes a project holds: what the build serves.
 *
 * A configuration that declares its themes verbatim replaces the whole
 * stack exactly as the plugin does: the list is the loaded documents
 * and nothing else. Otherwise the project's own files sit beside the
 * brand themes they have not forked, and a fork replaces its entry
 * rather than joining it.
 */
export async function listThemes(root: string): Promise<ProjectTheme[]> {
  const { readdir, readFile } = await import("node:fs/promises");
  const { basename, join } = await import("node:path");
  const config = await readConfiguration(root).catch(() => null);
  if (config?.verbatimThemes != null) {
    const docs = await servedVerbatim(root, config);
    return Object.entries(docs)
      .map(([name, document]) => ({ name, text: themeJson(document), file: null as string | null, origin: "verbatim" as const }))
      .sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
  }
  const { path: dir, file, display } = await themesDirOf(root);
  let entries: string[] = [];
  if (file) {
    entries = basename(dir).endsWith(".json") ? [basename(dir)] : [];
  } else {
    try {
      entries = await readdir(dir);
    } catch {
      entries = [];
    }
  }
  const themes: ProjectTheme[] = [];
  for (const entry of entries.sort()) {
    if (entry === CONFIG_FILENAME) continue;
    // A flat theme file reads as its stem; a brand directory reads as its
    // identity file. Facet files are not themes and are skipped here.
    const stem = entry.endsWith(".json") ? entry.slice(0, -".json".length) : entry;
    if (stem.endsWith(".palette") || stem.endsWith(".spacing")) continue;
    const resolved = file ? join(dir, entry) : await themeFile(dir, stem);
    if (resolved === null) continue;
    let text: string;
    try {
      text = await readFile(file ? dir : resolved, "utf8");
    } catch {
      continue;
    }
    themes.push({
      name: stem,
      text,
      // Project-relative, so a path a developer sees never carries the
      // machine's filesystem layout: a screenshot, a log line, an issue
      // report. The daemon knows the root; the contract does not leak it.
      file: file ? `${display}/${entry}` : join(display, entry),
      origin: "local",
    });
  }
  const forked = new Set(themes.map((theme) => theme.name));
  const brand = config === null ? {} : await brandThemes(root, config);
  for (const [name, document] of Object.entries(brand)) {
    if (forked.has(name)) continue;
    themes.push({ name, text: themeJson(document), file: null, origin: "brand" });
  }
  return themes.sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
}

/**
 * The facets a project holds: palette and spacing files composing over bases.
 *
 * Served from the loader, not the directory: `loadProjectBrand` already
 * files flat and brand-dir facets under their axis, shape-checked. Verbatim
 * themes carry no facets — the list is the loader's, and the loader reads
 * no directory for a verbatim project.
 */
export async function listFacets(root: string): Promise<ProjectFacet[]> {
  const { loadProjectBrand } = await import("./brand.ts");
  const facets = await loadProjectBrand(root);
  const out: ProjectFacet[] = [
    ...Object.keys(facets.palettes).map((name) => ({ name, kind: "palette" as const })),
    ...Object.keys(facets.spacings).map((name) => ({ name, kind: "spacing" as const })),
  ];
  return out.sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
}

/**
 * One theme, as the text it is written as.
 *
 * A configuration that declares its themes verbatim reads them from the
 * declared imports. Otherwise the project's own file first, then the
 * brand layer: a project inherits the brand rather than restating it,
 * so a theme it has not forked still reads.
 */
export async function readTheme(
  root: string,
  name: string,
): Promise<{ readonly text: string | null }> {
  const { path: dir, file } = await themesDirOf(root);
  const { readFile } = await import("node:fs/promises");
  const { basename } = await import("node:path");
  const config = await readConfiguration(root).catch(() => null);
  if (config?.verbatimThemes != null) {
    const docs = await servedVerbatim(root, config);
    const document = docs[name];
    return { text: document === undefined ? null : themeJson(document) };
  }
  try {
    if (file) {
      if (basename(dir, ".json") !== name) throw new Error("other theme");
      return { text: await readFile(dir, "utf8") };
    }
    const resolved = await themeFile(dir, name);
    if (resolved === null) throw new Error("no such theme");
    return { text: await readFile(resolved, "utf8") };
  } catch {
    const brand = config === null ? {} : await brandThemes(root, config);
    const document = brand[name];
    return { text: document === undefined ? null : themeJson(document) };
  }
}

/**
 * Writes one theme file.
 *
 * A write is also the first write for a project that has never held a theme:
 * the themes directory is created rather than demanded. The alternative
 * shipped for a while — an ENOENT in a dialog on a fresh checkout — was the
 * directory's absence surfacing as the writer's failure.
 *
 * A name that exists only in the brand layer is refused: the brand is
 * read-only here, and a save must not silently fork it. The fork is an
 * explicit copy, not a side effect of editing.
 */
export async function writeTheme(
  root: string,
  name: string,
  text: string,
): Promise<WriteResult> {
  const { path: dir, file, display } = await themesDirOf(root);
  const { mkdir, writeFile } = await import("node:fs/promises");
  const { join } = await import("node:path");
  if (file) {
    return { error: `cannot write into '${display}': it names one file` };
  }
  const config = await readConfiguration(root).catch(() => null);
  if (config?.verbatimThemes != null) {
    return { error: verbatimRefusal(config, name) };
  }
  if ((await themeFile(dir, name)) === null) {
    const brand = config === null ? {} : await brandThemes(root, config);
    if (brand[name] !== undefined) {
      return {
        error:
          `Brand theme '${name}' is read-only here; save as a local theme to fork it.`,
      };
    }
  }
  try {
    await mkdir(dir, { recursive: true });
    const resolved = (await themeFile(dir, name)) ?? join(dir, `${name}.json`);
    await writeFile(resolved, text, "utf8");
    return { error: null };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Writes one facet file: `<name>.<kind>.json` beside the base it composes over.
 *
 * Shape-checked before write with the theme's own facet validators: a
 * palette carrying spacing keys (or the reverse) is refused naming the
 * file, the way the loader refuses it on read.
 */
export async function createFacet(
  root: string,
  name: string,
  base: string,
  kind: "palette" | "spacing",
  tokens: Record<string, unknown>,
): Promise<WriteResult> {
  const { path: dir, file, display } = await themesDirOf(root);
  const { mkdir, writeFile } = await import("node:fs/promises");
  const { join } = await import("node:path");
  if (file) {
    return { error: `cannot write into '${display}': it names one file` };
  }
  const { validatePaletteFacet, validateSpacingFacet } = await import("@spinjs/theme");
  const baseDoc = await (async () => {
    try {
      const { loadProjectBrand } = await import("./brand.ts");
      const facets = await loadProjectBrand(root);
      return facets.themes[base];
    } catch {
      return undefined;
    }
  })();
  const report = kind === "palette"
    ? validatePaletteFacet(
      tokens as Parameters<typeof validatePaletteFacet>[0],
      ...(baseDoc === undefined ? [] : [baseDoc as Parameters<typeof validatePaletteFacet>[1]]),
    )
    : validateSpacingFacet(
      tokens as Parameters<typeof validateSpacingFacet>[0],
      ...(baseDoc === undefined ? [] : [baseDoc as Parameters<typeof validateSpacingFacet>[1]]),
    );
  if (!report.valid) {
    const details = report.error ?? report.issues
      .map((issue) => `${issue.path}: ${issue.message}`)
      .join("; ");
    return { error: `spin: facet "${name}.${kind}.json" is invalid: ${details}` };
  }
  try {
    await mkdir(dir, { recursive: true });
    const resolved = join(dir, `${name}.${kind}.json`);
    await writeFile(resolved, JSON.stringify(tokens, null, 2) + "\n", "utf8");
    return { error: null };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
/**
 * Removes one theme file.
 *
 * A name that exists only in the brand layer is refused rather than
 * reported missing: there is no local file to remove, and the brand is
 * read-only here.
 */
export async function removeTheme(
  root: string,
  name: string,
): Promise<WriteResult> {
  const { path: dir, file, display } = await themesDirOf(root);
  const { rm } = await import("node:fs/promises");
  const { join } = await import("node:path");
  if (file) {
    return { error: `cannot remove from '${display}': it names one file` };
  }
  const config = await readConfiguration(root).catch(() => null);
  if (config?.verbatimThemes != null) {
    return { error: verbatimRefusal(config, name) };
  }
  const resolved = await themeFile(dir, name);
  if (resolved === null) {
    const brand = config === null ? {} : await brandThemes(root, config);
    if (brand[name] !== undefined) {
      return {
        error:
          `Brand theme '${name}' is read-only here; save as a local theme to fork it.`,
      };
    }
  }
  try {
    // A brand directory goes whole: its layers are one theme, and a
    // tokens-less directory is a brand the build cannot serve.
    const target = resolved !== null && resolved.endsWith(`${name}/tokens.json`)
      ? join(dir, name)
      : join(dir, `${name}.json`);
    await rm(target, { recursive: true });
    return { error: null };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Copies one theme to a new name.
 *
 * The copy is the text, so a fork copies byte for byte. A source the project
 * has not forked is a brand theme, and it answers for a name the project
 * never wrote — the copy is the explicit fork a write refuses to be. A
 * verbatim configuration reads its source from the declared imports and
 * refuses every target, because a new file would never be served.
 */
export async function copyTheme(
  root: string,
  from: string,
  to: string,
): Promise<WriteResult> {
  const { path: dir, file, display } = await themesDirOf(root);
  const { mkdir, readFile, writeFile } = await import("node:fs/promises");
  const { join } = await import("node:path");
  if (file) {
    return { error: `cannot copy into '${display}': it names one file` };
  }
  const config = await readConfiguration(root).catch(() => null);
  if (config?.verbatimThemes != null) {
    return { error: verbatimRefusal(config, to) };
  }
  try {
    // Read first so a missing source is an error, not an empty file.
    // A brand source copies its identity file: the fork starts where the
    // brand's own tokens start, and the layers stay the brand's.
    const source = (await themeFile(dir, from)) ?? join(dir, `${from}.json`);
    let text: string;
    try {
      text = await readFile(source, "utf8");
    } catch {
      const brand = config === null ? {} : await brandThemes(root, config);
      const document = brand[from];
      if (document === undefined) {
        throw new Error(`no theme named ${from}`);
      }
      text = themeJson(document);
    }
    await mkdir(dir, { recursive: true });
    // A copy never overwrites: the name is the author's, and a theme that
    // exists holds work someone saved. Writing over it would destroy that
    // work with no warning and no undo, so a taken name is an error the
    // studio can show. A brand-only target is the explicit fork a write
    // refuses to be: the copy lands as a local file beside the brand.
    if ((await themeFile(dir, to)) !== null) {
      return { error: `a theme named ${to} already exists` };
    }
    const target = join(dir, `${to}.json`);
    await writeFile(target, text, "utf8");
    return { error: null };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
/**
 * The project's own configuration: the parsed `spin/config.json`.
 *
 * The same coercions as the synchronous reader — unknown keys ignored,
 * malformed entries dropped — because the empty config is a valid config,
 * not a refusal. `file` names the file when it exists, so a client can
 * tell an author their values are defaults rather than written.
 */
export async function readConfig(
  root: string,
): Promise<{ readonly config: { readonly activeTheme?: string; readonly themeOrder?: string[]; readonly contractThemes?: string[] }; readonly file: string | null }> {
  const { readFile } = await import("node:fs/promises");
  const { join } = await import("node:path");
  const path = join(root, PROJECT_DIR, CONFIG_FILENAME);
  let text: string;
  try {
    text = await readFile(path, "utf8");
  } catch {
    return { config: {}, file: null };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { config: {}, file: join(PROJECT_DIR, CONFIG_FILENAME) };
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { config: {}, file: join(PROJECT_DIR, CONFIG_FILENAME) };
  }
  const record = parsed as Record<string, unknown>;
  const config: { activeTheme?: string; themeOrder?: string[]; contractThemes?: string[] } = {};
  if (typeof record["activeTheme"] === "string") config.activeTheme = record["activeTheme"];
  if (Array.isArray(record["themeOrder"])) {
    const seen = new Set<string>();
    const order: string[] = [];
    for (const entry of record["themeOrder"]) {
      if (typeof entry !== "string" || seen.has(entry)) continue;
      seen.add(entry);
      order.push(entry);
    }
    config.themeOrder = order;
  }
  if (Array.isArray(record["contractThemes"])) {
    const seen = new Set<string>();
    const names: string[] = [];
    for (const entry of record["contractThemes"]) {
      if (typeof entry !== "string" || seen.has(entry)) continue;
      seen.add(entry);
      names.push(entry);
    }
    config.contractThemes = names;
  }
  return { config, file: join(PROJECT_DIR, CONFIG_FILENAME) };
}

/**
 * Writes the project's own configuration.
 *
 * The `spin/` directory is created rather than demanded, the same as a
 * first theme write. Shape only is validated — an `activeTheme` that names
 * no served theme still writes, and the studio's fallback chain absorbs it.
 */
export async function writeConfig(
  root: string,
  config: SpinConfigFile,
): Promise<WriteResult> {
  const { mkdir, writeFile } = await import("node:fs/promises");
  const { join } = await import("node:path");
  try {
    await mkdir(join(root, PROJECT_DIR), { recursive: true });
    await writeFile(
      join(root, PROJECT_DIR, CONFIG_FILENAME),
      `${JSON.stringify(config, null, 2)}\n`,
      "utf8",
    );
    return { error: null };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}


/**
 * The moniker a project's component tags carry: its configured prefix, or
 * its package name when it never configured one. Null when the root names
 * neither — a caller that renders tags shows a wildcard there, never a
 * prefix it invented.
 */
export async function prefixOf(root: string): Promise<string | null> {
  const { readFile } = await import("node:fs/promises");
  const { join } = await import("node:path");
  const configured = (await readConfiguration(root)).prefix;
  if (configured !== null && configured.length > 0) return configured;
  try {
    const manifest = JSON.parse(
      await readFile(join(root, "package.json"), "utf8"),
    ) as { name?: unknown };
    if (typeof manifest.name === "string" && manifest.name.length > 0) {
      const derived = defaultPrefix(manifest.name);
      if (derived !== "app") return derived;
    }
  } catch {
    // No manifest or unreadable: the root names nothing.
  }
  return null;
}

/**
 * The project's operations, as one surface.
 *
 * The api's procedures call these; a host that talks to a project directly
 * calls the same ones.
 */
export const projectService = {
  detect: detectProject,
  current: currentProject,
  init: initProject,
  brand: {
    create: createBrand,
    setDesignLanguage: setBrandDesignLanguage,
    setPalette: setBrandPalette,
    setType: setBrandType,
    get: getBrand,
    rename: renameBrand,
  },
  configuration: readConfiguration,
  themes: {
    list: listThemes,
    read: readTheme,
    write: writeTheme,
    remove: removeTheme,
    copy: copyTheme,
    createFacet,
    facets: listFacets,
  },
  config: {
    read: readConfig,
    write: writeConfig,
  },
  icons: {
    list: listIcons,
    read: readIcon,
    write: writeIcon,
    remove: removeIcon,
  },
};
