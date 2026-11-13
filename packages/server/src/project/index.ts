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
  COMPONENTS_DIR,
  CONFIG_FILES,
  CONFIG_FILENAME,
  ICONS_DIR,
  SHORTCUTS_FILENAME,
  UNO_FILENAME,
  initFiles,
  isWired,
  PROJECT_DIR,
  defaultPrefix,
} from "./facts.ts";

export {
  copyTheme,
  currentProject,
  detectBundler,
  detectLinter,
  detectProject,
  findExistingConfigFile,
  initProject,
  listThemes,
  projectService,
  prefixOf,
  readConfig,
  readConfiguration,
  readTheme,
  removeTheme,
  writeConfig,
  writeTheme,
} from "./service.ts";

export { resolveProjectDir } from "./resolve-dir.ts";
export {
  brandIconCollections,
  configIn,
  findConfigRoot,
  findProjectRoot,
  findProjectRootIn,
  foreignFiles,
  readProjectShortcutsFile,
  savedIconGlyphs,
  themeTextsIn,
  themeTextsInAt,
} from "./sync.ts";
export {
  clearOverlay,
  hasOverlay,
  forgetDiskDocument,
  isStudioActive,
  noteDiskDocument,
  noteDiskDocuments,
  noteStudioHeartbeat,
  onOverlayChange,
  overlayDirty,
  overlayThemes,
  resolveThemes,
  setOverlay,
} from "./session.ts";
export {
  prefixForFile,
  projectComponentFiles,
  renderComponentsDts,
  writeProjectComponentsDts,
} from "./components.ts";
export type { ResolvedDir } from "./resolve-dir.ts";

export { loadProjectBrand } from "./brand.ts";
export type { ThemeFacets } from "./brand.ts";

export {
  copyBrandDirectory,
  createBrand,
  getBrand,
  renameBrand,
  setBrandDesignLanguage,
  setBrandPalette,
  setBrandType,
} from "./brand-service.ts";
export type { BrandPaletteSeed as BrandPaletteSeedArgs, BrandTypeChoice as BrandTypeChoiceArgs } from "./brand-service.ts";
export { listIcons, readIcon, removeIcon, writeIcon } from "./icons.ts";
export {
  KNOWN_SKILL_DIRS,
  installProjectSkills,
  projectSkillStatus,
  renderBrandSkill,
} from "./skill.ts";
export {
  ISSUES_REL_PATH,
  IssueAnnotationSchema,
  IssueBoundingBoxSchema,
  IssueRecordSchema,
  IssueStatusSchema,
  CreateIssueInputSchema,
  createIssue,
  readIssues,
  removeIssue,
  reopenIssue,
  resolveIssue,
} from "./issues.ts";
export type {
  CreateIssueInput,
  IssueAnnotation,
  IssueRecord,
  IssueStatus,
} from "./issues.ts";

export {
  configurationIn,
  contentIn,
  extendsIn,
  mountIn,
  themesIn,
} from "./configuration.ts";
export type {
  ContentDeclaration,
  ShortcutDeclaration,
} from "./configuration.ts";
export type {
  ExtendsDeclaration,
  ImportedValue,
  ProjectConfiguration,
  ThemeRecordDeclaration,
  VerbatimThemeRef,
} from "./types.ts";
export type {
  BrandCreateOptions,
  BrandIssue,
  BrandPaletteSeed,
  BrandReport,
  BrandTypeChoice,
  BrandWriteResult,
  BundlerKind,
  IconAttribution,
  LinterKind,
  InitProjectOptions,
  ProjectFacet,
  ProjectIcon,
  ProjectReport,
  ProjectTheme,
  SavedIcon,
  OpenState,
  OverlayState,
  SpinConfigFile,
  SpinShortcutsFile,
  ThemeDocuments,
  WriteResult,
} from "./schema.ts";
export {
  BrandCreateOptionsSchema,
  BrandIssueSchema,
  BrandNameSchema,
  BrandPaletteSeedSchema,
  BrandRenameSchema,
  BrandReportSchema,
  BrandTypeChoiceSchema,
  BrandWriteResultSchema,
  BundlerKindSchema,
  IconAttributionSchema,
  LinterKindSchema,
  InitProjectOptionsSchema,
  ProjectFacetSchema,
  ProjectIconSchema,
  ProjectReportSchema,
  ProjectThemeSchema,
  SavedIconSchema,
  OpenStateSchema,
  OverlayStateSchema,
  SpinConfigFileSchema,
  SpinShortcutsFileSchema,
  ThemeDocumentsSchema,
  ThemeNameSchema,
  WriteResultSchema,
} from "./schema.ts";
