/**
 * A stand-in for `@spinjs/diagnostics`, for the browser bundle only.
 *
 * The diagnostics package reads the project's files, and the browser
 * cannot. The studio's bundle reaches it through the API, so the studio
 * stands a stand-in in its place: the browser never calls the rules — it
 * asks the daemon over RPC, and the daemon runs them. Nothing here may
 * grow rule logic; when the daemon answers, this file only types the shape
 * of the call. Kept in sync with `packages/diagnostics/src/source.ts` and
 * `packages/diagnostics/src/corpus.ts` by hand — if those barrels change
 * shape, this file must follow.
 *
 * The `vite.config.ts` alias (`@spinjs/diagnostics` → this file) is the
 * studio's own, not the preset's: a consumer of the preset must never be
 * handed this file.
 */
export interface ProjectFinding {
  readonly file: string;
  readonly line: number;
  readonly column: number;
  readonly ruleId: string;
  readonly message: string;
  readonly remedy: string | null;
  readonly severity: "error" | "warning";
  readonly fixable: boolean;
}
export interface RuleGroup {
  readonly ruleId: string;
  readonly title: string;
  readonly findings: readonly ProjectFinding[];
}
export interface FindingsReport {
  readonly groups: readonly RuleGroup[];
  readonly unreadable: readonly string[];
  readonly files: number;
}
export interface ClassOrderAttribute {
  readonly file: string;
  readonly line: number;
  readonly column: number;
  readonly classes: readonly string[];
  readonly ordered: readonly string[];
}
export interface ClassOrderFile {
  readonly file: string;
  readonly attributes: readonly ClassOrderAttribute[];
}
export interface CorpusReport {
  readonly repetition: readonly Repetition[];
  readonly order: readonly ClassOrderFile[];
}
export interface FixIdentity {
  readonly ruleId: string;
  readonly line: number;
  readonly column: number;
}
export interface FixOutcome {
  readonly applied: boolean;
  readonly error: string | null;
  readonly file: string | null;
  readonly text: string | null;
}
export interface ShortcutOutcome {
  readonly name: string;
  readonly error: string | null;
  readonly file: string | null;
}
export interface ClassAttribute {
  readonly file: string;
  readonly line: number;
  readonly column: number;
  readonly classes: readonly string[];
  readonly range: readonly [number, number];
}
export interface ClassOrder {
  readonly file: string;
  readonly line: number;
  readonly column: number;
  readonly classes: readonly string[];
  readonly ordered: readonly string[];
}
export interface Repetition {
  readonly classes: readonly string[];
  readonly count: number;
  readonly files: readonly string[];
  readonly suggested: string;
}

export function corpus(): CorpusReport {
  return { repetition: [], order: [] };
}
export function lintSource(): FindingsReport {
  return { groups: [], unreadable: [], files: 0 };
}
export function sourceFiles(): readonly string[] {
  return [];
}
export function declareShortcut(): ShortcutOutcome {
  return { name: "", error: "unavailable in the browser bundle", file: null };
}
export function applyFix(): FixOutcome {
  return { applied: false, error: "unavailable in the browser bundle", file: null, text: null };
}
export function applyOrder(): FixOutcome {
  return { applied: false, error: "unavailable in the browser bundle", file: null, text: null };
}
export function classAttributesOf(): readonly ClassAttribute[] {
  return [];
}
export function classOrderOf(): readonly ClassOrder[] {
  return [];
}
export function orderedClasses(): readonly string[] {
  return [];
}
export function repetitionsOf(): readonly Repetition[] {
  return [];
}
export function sheetOrder(): readonly string[] {
  return [];
}
export function suggestShortcutName(): string {
  return "";
}
export function lintFiles(): FindingsReport {
  return { groups: [], unreadable: [], files: 0 };
}
