/**
 * @spin/project — the project: where it is, what it holds, what it declares.
 *
 * A project is a directory with a claim on it: a `spin/` directory of theme
 * documents, and a build configuration that says how the app is put
 * together. The operations over that directory are here, and only here — a
 * module that owns its facts owns the operations over them, so a client that
 * wants to know where a project's themes live asks this package rather than
 * keeping its own answer.
 *
 * Every operation takes the root it is about. Nothing here reads a global:
 * one process can serve many projects, and a project is a place on disk that
 * the caller names.
 */

export { CONFIG_FILENAME, initFiles, isWired, PROJECT_DIR } from "./facts.ts";

export {
  CONFIG_FILES,
  copyTheme,
  currentProject,
  detectProject,
  initProject,
  listThemes,
  projectService,
  readConfiguration,
  readTheme,
  removeTheme,
  writeTheme,
} from "./service.ts";

export {
  configurationIn,
  contentIn,
  mountIn,
  shortcutsIn,
} from "./configuration.ts";
export type {
  ContentDeclaration,
  ShortcutDeclaration,
} from "./configuration.ts";

export type {
  InitProjectOptions,
  ProjectConfiguration,
  ProjectReport,
  ProjectTheme,
  WriteResult,
} from "./types.ts";
