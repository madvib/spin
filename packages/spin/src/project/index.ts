/**
 * @spinjs/project — the project: where it is, what it holds, what it declares.
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
 *
 * The synchronous half of these operations — the ones a linter asks, while it
 * walks a file — lives behind its own entry, `./sync.ts`: a `node:` import
 * at the top of this module would follow it into the browser bundle the
 * daemon's client is built into, and that bundle must never touch a disk.
 */

export {
  CONFIG_FILENAME,
  CONFIG_FILES,
  ICONS_DIR,
  initFiles,
  isWired,
  PROJECT_DIR,
} from "./facts.ts";

export {
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

export { listIcons, readIcon, removeIcon, writeIcon } from "./icons.ts";

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
  IconAttribution,
  InitProjectOptions,
  ProjectConfiguration,
  ProjectIcon,
  ProjectReport,
  ProjectTheme,
  SavedIcon,
  WriteResult,
} from "./types.ts";
