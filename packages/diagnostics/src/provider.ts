/**
 * The facts, per file.
 *
 * The vocabulary is read once per project and kept: a lint run visits the
 * same files over and over, and re-reading the theme for every class
 * attribute would cost more than the lint itself.
 *
 * Nothing here knows a linter. A file's path is all it takes, which is
 * what lets the oxlint plugin, the ESLint plugin and the CLI read the same
 * facts from the same place.
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { engineAnswers } from "@spinjs/preset";
import { designLanguages, type ThemeDocument } from "@spinjs/theme";
import { CONFIG_FILES, brandIconCollections, configIn, configurationIn, savedIconGlyphs } from "@spinjs/server/project";
import type { Facts } from "./core.ts";
import { projectFacts } from "./project-vocabulary.ts";
import { vocabularyOf } from "./generated.ts";
import {
  findProjectRootIn,
  projectRootFor,
  readProjectThemesAt,
} from "./project.ts";
import { findConfigRoot, readProjectShortcuts } from "./shortcuts.ts";
import type { EngineAnswers } from "./engine-types.ts";

/** The facts per project. */
const factsByRoot = new Map<string, Facts>();

/** The project root per directory, for the same reason. */
const rootByDirectory = new Map<string, string | undefined>();

/** The build root per directory, for the same reason. */
const buildByDirectory = new Map<string, string | undefined>();

/** The themes directory per directory, for the same reason. */
const themesByDirectory = new Map<string, string>();

/** The tool's own project, found once: the root the linter was run from. */
let toolRoot: string | undefined | null;

/**
 * The root a file is judged by: its own project, else the tool's.
 *
 * One computation, shared by the warmer and the reader: a file warmed
 * under one root and judged under another would be judged by a
 * vocabulary that never saw its classes.
 */
export function judgedRoot(filename: string): string {
  if (toolRoot === undefined) {
    toolRoot = findProjectRootIn(process.cwd(), process.cwd()) ?? null;
  }
  return rootOf(filename) ?? toolRoot ?? "";
}

/** The root a file belongs to, found once per directory. */
export function rootOf(filename: string): string | undefined {
  const directory = dirname(filename);
  if (rootByDirectory.has(directory)) {
    return rootByDirectory.get(directory);
  }
  const root = projectRootFor(filename);
  rootByDirectory.set(directory, root);
  return root;
}

/**
 * The root whose build configuration sits beside this file's project,
 * found once per directory.
 *
 * The configuration names the themes directory, so its directory is the
 * base the project's paths resolve against.
 */
export function buildRootOf(filename: string): string | undefined {
  const directory = dirname(filename);
  if (buildByDirectory.has(directory)) {
    return buildByDirectory.get(directory);
  }
  const root = findConfigRoot(filename);
  buildByDirectory.set(directory, root);
  return root;
}

/**
 * The themes directory a file is judged by.
 *
 * The build configuration beside the file names it — the default `spin/`
 * when nothing does — resolved against the configuration's own directory
 * when one is found, else the file's project. Every surface reads the
 * same directory the build reads, so a custom `themesDir` in a monorepo
 * is judged where it lives rather than where the default points.
 */
export function themesRootOf(filename: string): string {
  const directory = dirname(filename);
  const cached = themesByDirectory.get(directory);
  if (cached !== undefined) return cached;
  const build = buildRootOf(filename);
  const base = build ?? judgedRoot(filename);
  const resolved = join(base, themesDirValue(build));
  themesByDirectory.set(directory, resolved);
  return resolved;
}

/** The `themesDir` the build configuration at a root declares, or the default. */
function themesDirValue(build: string | undefined): string {
  if (build === undefined) return "spin";
  try {
    const file = CONFIG_FILES.find((name) => existsSync(join(build, name)));
    if (file === undefined) return "spin";
    return configurationIn(readFileSync(join(build, file), "utf8"), file).themesDir;
  } catch {
    return "spin";
  }
}

/**
 * The facts for the file being linted.
 *
 * The themes and the shortcuts come from the file's own themes directory —
 * the one the build configuration beside the file names. A file outside
 * any project falls back to the design languages: the vocabulary a project
 * serves before it forks a theme of its own.
 *
 * The shortcuts are the project's own too: a class the project declared
 * is a class the project produces, so the closed vocabulary has to know it.
 */
export function factsForFile(filename: string, answers?: EngineAnswers): Facts {
  const root = judgedRoot(filename);
  const themesRoot = themesRootOf(filename);
  // One cache per project AND per themes directory: the vocabulary and the
  // shortcuts are two different reads, and two projects may share one root
  // while serving different themes.
  const vocabState = vocabularyOf(root) !== undefined ? "v" : "0";
  const key = `${root}\u0000${themesRoot}\u0000${vocabState}`;
  const cached = factsByRoot.get(key);
  if (cached !== undefined) return cached;
  const themes = readProjectThemesAt(themesRoot);
  const facts = projectFacts(
    themes,
    answers ?? selfAnswers(themes),
    // The project's own vocabulary when it has been asked for one: the
    // classes the preset produces beyond the catalog are the classes THIS
    // project writes, and a project is judged by its own source.
    vocabularyOf(root) ?? new Set<string>(),
    readProjectShortcuts(themesRoot),
    [],
    projectIconCollections(root, themesRoot),
    savedIconGlyphs(themesRoot),
  );
  factsByRoot.set(key, facts);
  return facts;
}

/**
 * The icon collections a project declares.
 *
 * Each brand's `brand.json` may name its set, and the project's
 * `config.json` may name the default: the union is what the lint holds
 * icon classes to. Nothing declared means unenforced.
 */
function projectIconCollections(root: string, themesRoot: string): ReadonlySet<string> {
  const out = new Set<string>(brandIconCollections(themesRoot));
  try {
    const collection = configIn(root).icons?.collection;
    if (typeof collection === "string" && collection !== "") out.add(collection);
  } catch {
    // No configuration: brands alone declare the set.
  }
  return out;
}

/**
 * What the style engine answers for a root, filled here.
 *
 * External hosts (oxlint, ESLint) construct their own contexts and cannot
 * inject answers — so the provider fills them from the file's own project
 * when the caller holds none. Callers that already hold answers (the
 * service, the LSP, tests) pass them and skip this. The checks still take
 * answers as input either way; only the filling moves.
 */
function selfAnswers(themes: Record<string, ThemeDocument>): EngineAnswers {
  return engineAnswers([
    ...Object.values(designLanguages),
    ...Object.values(themes),
  ]);
}

/**
 * Forgets a project's facts, so the next read takes a new vocabulary.
 *
 * A project asked about twice — once before its own classes were known and
 * once after — must not keep the first answer: the rules would judge the
 * second reading by the first one's vocabulary.
 */
export function forgetFacts(root: string): void {
  for (const key of factsByRoot.keys()) {
    if (key.split("\u0000")[0] === root) factsByRoot.delete(key);
  }
}
