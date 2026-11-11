/**
 * The theme registry the studio edits.
 *
 * Themes are not bundled and they are not the studio's own: they are the
 * project's — what the build serves, local files beside the unforked brand.
 * The daemon answers the merge at request time, so a theme added
 * or forked while the studio is running has to be visible without a rebuild.
 *
 * The chrome is deliberately not in this list. It is styled by the studio's own
 * static theme so that editing a theme cannot restyle the tool you are editing
 * it with.
 */

import { spinClient } from "./client.ts";

/** A theme the studio found, with the state the editor needs to show it. */
export interface StudioTheme {
  /** File stem, and the name written back to disk. */
  name: string;
  /** The raw JSON text, which is what an author edits. */
  text: string;
  /**
   * Path relative to the workspace, shown so the author knows what they are
   * editing — `null` while the theme is a brand or verbatim theme no copy has forked.
   */
  file: string | null;
  /** Where the theme is served from, when the daemon says. Absent from old daemons. */
  origin?: "local" | "brand" | "verbatim";
}

/**
 * What a project root looks like to the daemon.
 *
 * The daemon is the only one that can look at a disk: the studio is a
 * browser, and a browser cannot say whether the folder it is pointed at
 * holds a project. `spin` is the mark — a directory of that name at the
 * root is a claim, and nothing else makes one.
 */
export interface ProjectReport {
  /** The root that was examined. */
  readonly root: string;
  /** Whether the `spin/` directory is there — the mark of a spin project. */
  readonly spin: boolean;
  /** Whether an uno config is there, which is where the preset gets wired. */
  readonly uno: boolean;
  /** Whether the uno config names the spin preset. */
  readonly wired: boolean;
  /** The themes `spin/` holds, if it holds any. */
  readonly themes: readonly string[];
}

/**
 * The project the daemon serves.
 *
 * The daemon's own root, not one the studio names: the studio edits
 * whatever project it was pointed at, and asking is how it finds out which
 * one that is.
 */
export async function currentProject(): Promise<ProjectReport> {
  return await (await spinClient()).project.current({});
}

/**
 * Creates the project: the themes directory, a first theme, and the uno
 * config that wires spin into the build.
 *
 * The daemon's own composer, rather than a studio that writes files
 * itself: the three belong together, and a studio that made a directory
 * by hand would make half of what the daemon makes.
 */
export async function initProject(
  root: string,
  name: string,
  language: string,
): Promise<{ error: string | null }> {
  const made = await (await spinClient()).project.init({ root, name, language });
  return { error: made.error ?? null };
}

/**
 * Every theme in the project's themes directory.
 *
 * Plain browser functions: the dev server mounts the API on the same
 * origin, so the browser dials it directly. No server round trip, and no
 * second process that would need its own project root.
 */
export async function listProjectThemes(): Promise<StudioTheme[]> {
  const listed = await (await spinClient()).project.themes.list({});
  return listed.map((theme) => ({
    name: theme.name,
    text: theme.text,
    file: theme.file,
    origin: theme.origin ?? undefined,
  }));
}

/** A facet the project holds: a name and the axis it files under. */
export interface StudioFacet {
  readonly name: string;
  readonly kind: "palette" | "spacing";
}

/** Every facet in the project's themes directory, flat and brand-dir alike. */
export async function listFacets(): Promise<StudioFacet[]> {
  return await (await spinClient()).project.themes.facets({});
}

/** What `spin/config.json` holds, and the file that holds it. */
export interface StudioConfig {
  /** The parsed config; empty when no file is written. */
  readonly config: { readonly activeTheme?: string; readonly themeOrder?: readonly string[]; readonly contractThemes?: readonly string[] };
  /** Project-relative path when the file exists, `null` while values are defaults. */
  readonly file: string | null;
}

/** Reads the project's own configuration: the seat and the order. */
export async function readProjectConfig(): Promise<StudioConfig> {
  const read = await (await spinClient()).project.config.read({});
  return {
    config: {
      activeTheme: read.config.activeTheme ?? undefined,
      themeOrder: read.config.themeOrder ?? undefined,
      contractThemes: read.config.contractThemes ?? undefined,
    },
    file: read.file,
  };
}

/** Writes the project's own configuration. */
export async function writeProjectConfig(config: {
  readonly activeTheme?: string;
  readonly themeOrder?: readonly string[];
  readonly contractThemes?: readonly string[];
}): Promise<{ error: string | null }> {
  const written = await (await spinClient()).project.config.write({
    config: {
      ...(config.activeTheme !== undefined ? { activeTheme: config.activeTheme } : {}),
      ...(config.themeOrder !== undefined ? { themeOrder: [...config.themeOrder] } : {}),
      ...(config.contractThemes !== undefined ? { contractThemes: [...config.contractThemes] } : {}),
    },
  });
  return { error: written.error ?? null };
}

/**
 * Write one theme to disk. The studio's save is explicit: nothing persists
 * until the author says so, and this is the only call that changes disk.
 */
export async function saveTheme(
  name: string,
  text: string,
): Promise<{ error: string | null }> {
  const written = await (await spinClient()).project.themes.write({
    name,
    text,
  });
  return { error: written.error ?? null };
}

/** Re-reads one theme from disk, discarding unsaved edits to it. */
export async function loadProjectTheme(
  name: string,
): Promise<string | undefined> {
  const read = await (await spinClient()).project.themes.read({ name });
  return read.text ?? undefined;
}

/** The brand facts the overview header names: the brand, and its design language. */
export interface BrandFacts {
  readonly name: string;
  readonly designLanguage: string | undefined;
  /** The brand's layers by relative file, for per-leaf origin. */
  readonly layers: Record<string, unknown>;
}

/**
 * The active theme's brand, when the theme is backed by one.
 *
 * A brand is a `spin/<name>/` directory with a definition; a flat theme, a
 * verbatim map, or an extended package has none, and answers `undefined`
 * rather than an error — the overview renders nothing for projects without
 * brands. The design language is the brand tokens layer's `$extends`: the
 * parent the brand names.
 */
export async function brandFacts(root: string, theme: string): Promise<BrandFacts | undefined> {
  const report = await (await spinClient()).project.brand.get({ root, brand: theme });
  if (!report.valid) return undefined;
  const tokens = report.layers["tokens.json"];
  const extendsOf = typeof tokens === "object" && tokens !== null
    ? (tokens as Record<string, unknown>)["$extends"]
    : undefined;
  return {
    name: report.name,
    designLanguage: typeof extendsOf === "string" ? extendsOf : undefined,
    layers: report.layers as Record<string, unknown>,
  };
}

/** Duplicates a theme — a project file, or an unforked design language. The copy's name is the new theme's name. */
export async function copyTheme(
  from: string,
  to: string,
): Promise<{ error: string | null }> {
  const copied = await (await spinClient()).project.themes.copy({ from, to });
  return { error: copied.error ?? null };
}

/** Renames a brand: its directory, its seating, and the name inside. Only `spin/<brand>/` directories rename. */
export async function renameBrand(
  root: string,
  brand: string,
  to: string,
): Promise<{ error: string | null }> {
  const renamed = await (await spinClient()).project.brand.rename({ root, brand, to });
  return { error: renamed.error ?? null };
}

/** Writes one facet file beside the theme it composes over, shape-checked before write. */
export async function createFacet(
  base: string,
  name: string,
  kind: "palette" | "spacing",
  tokens: Record<string, unknown>,
): Promise<{ error: string | null }> {
  const created = await (await spinClient()).project.themes.createFacet({ base, name, kind, tokens });
  return { error: created.error ?? null };
}

/** Deletes a theme from disk. The caller confirms; this does not ask. */
export async function removeTheme(
  name: string,
): Promise<{ error: string | null }> {
  const removed = await (await spinClient()).project.themes.remove({ name });
  return { error: removed.error ?? null };
}

/**
 * The message a refused call reports.
 *
 * A call the daemon refuses answers with an error; a call the CONTRACT
 * refuses — a name the file system will not take, a shape the schema will
 * not accept — rejects, and the rejection carries the reason in its
 * `data`. Both are shown: an author who typed a name the studio cannot
 * use has to be told which part of it was wrong, and "Bad Request" is not
 * that.
 */
export function problemText(error: unknown): string {
  const detail = issueDetail(error);
  if (detail !== undefined) return detail;
  if (error instanceof Error) return error.message;
  return String(error);
}

/**
 * The validator's own words, when the rejection carries them.
 *
 * The RPC hands a refused input back as a list of issues: the path that
 * failed and what was wrong with it. Read out of the rejection rather than
 * flattened into one sentence, because a name that is not a file stem and
 * a name that is taken are different problems.
 */
function issueDetail(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const data = (error as { data?: unknown }).data;
  const issues = readIssues(data);
  if (issues.length === 0) return undefined;
  return issues.join("; ");
}

/** The issues inside a rejection's data, however it carries them. */
function readIssues(data: unknown): string[] {
  const list = Array.isArray(data)
    ? data
    : typeof data === "object" && data !== null &&
        Array.isArray((data as { issues?: unknown }).issues)
    ? (data as { issues: unknown[] }).issues
    : [];
  const out: string[] = [];
  for (const issue of list) {
    if (typeof issue !== "object" || issue === null) continue;
    const record = issue as { message?: unknown; path?: unknown };
    const message = typeof record.message === "string" ? record.message : "";
    const path = issuePath(record.path);
    if (message === "") continue;
    out.push(path === "" ? message : `${path}: ${message}`);
  }
  return out;
}

/**
 * The path an issue names, as the author typed it.
 *
 * The validator's own path is a list of steps, and a step is a key and the
 * value under it — so the key is the word the author wrote and the value is
 * what they wrote it as. The key is the name.
 */
function issuePath(path: unknown): string {
  if (typeof path === "string") return path;
  if (!Array.isArray(path)) return "";
  return path
    .map((step) => {
      if (typeof step === "string") return step;
      if (typeof step === "object" && step !== null) {
        const key = (step as { key?: unknown }).key;
        if (typeof key === "string") return key;
        if (typeof key === "number") return String(key);
      }
      return "";
    })
    .filter((segment) => segment !== "")
    .join(".");
}
