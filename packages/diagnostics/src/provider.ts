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

import { dirname } from "node:path";
import { engineAnswers } from "@spinjs/preset";
import { designLanguages } from "@spinjs/theme";
import type { Facts } from "./core.ts";
import { projectFacts } from "./project-vocabulary.ts";
import { generatedClassesNow, generatedClassesReady, vocabularyOf } from "./generated.ts";
import {
  findProjectRoot,
  findProjectRootIn,
  readProjectThemes,
} from "./project.ts";
import { findConfigRoot, readProjectShortcuts } from "./shortcuts.ts";
import type { EngineAnswers } from "./engine-types.ts";

/** The facts per project. */
const factsByRoot = new Map<string, Facts>();

/** The project root per directory, for the same reason. */
const rootByDirectory = new Map<string, string | undefined>();

/** The build root per directory, for the same reason. */
const buildByDirectory = new Map<string, string | undefined>();

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
  const root = findProjectRoot(filename);
  rootByDirectory.set(directory, root);
  return root;
}

/**
 * The root whose build configuration declares this file's project's
 * shortcuts, found once per directory.
 *
 * A project's compositions live in its build configuration, so the
 * configuration is what says which vocabulary the file is written in.
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
 * The facts for the file being linted.
 *
 * The project is the file's own: the nearest ancestor holding a `spin/`
 * directory. A file outside any project falls back to the tool's root, and
 * a file outside that too falls back to the starters — the vocabulary a
 * project serves before it forks a theme of its own.
 *
 * The shortcuts are the project's own too, and they come from the build
 * configuration beside the file: a class the project declared is a class
 * the project produces, so the closed vocabulary has to know it.
 */
export function factsForFile(filename: string, answers?: EngineAnswers): Facts {
  const root = judgedRoot(filename);
  const build = buildRootOf(filename);
  // One cache per project AND per build root: the themes and the shortcuts
  // are two different reads, and a file outside every project still belongs
  // to the build that produced it.
  const vocabState = vocabularyOf(root) !== undefined ? "v" : generatedClassesReady() ? "c" : "0";
  const key = `${root}\u0000${build ?? ""}\u0000${vocabState}`;
  const cached = factsByRoot.get(key);
  if (cached !== undefined) return cached;
  const facts = projectFacts(
    readProjectThemes(root),
    answers ?? selfAnswers(root),
    // The project's own vocabulary when it has been asked for one: the
    // classes the preset produces beyond the catalog are the classes THIS
    // project writes, and a project is judged by its own source.
    vocabularyOf(root) ?? generatedClassesNow(),
    readProjectShortcuts(build),
  );
  factsByRoot.set(key, facts);
  return facts;
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
function selfAnswers(root: string): EngineAnswers {
  return engineAnswers([
    ...Object.values(designLanguages),
    ...Object.values(readProjectThemes(root)),
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
