/**
 * A stand-in for `@spinjs/diagnostics`, for the browser bundle only.
 *
 * TEMPORARY: the diagnostics package reads the project's files, and the
 * browser cannot. This file exists so the studio's dev server can serve
 * while that is being settled; it is deleted before the work is handed
 * over.
 */

export interface CorpusReport {
  readonly repetitions: readonly unknown[];
}
export interface FindingsReport {
  readonly findings: readonly unknown[];
}
export interface FixIdentity {
  readonly path: string;
}
export interface FixOutcome {
  readonly applied: boolean;
}
export interface ProjectFinding {
  readonly path: string;
  readonly message: string;
}
export interface RuleGroup {
  readonly id: string;
}
export interface ShortcutOutcome {
  readonly declared: boolean;
}
export interface ClassAttribute {
  readonly name: string;
}
export interface ClassOrder {
  readonly classes: readonly string[];
}
export interface Repetition {
  readonly count: number;
}

export function corpus(): CorpusReport {
  return { repetitions: [] };
}
export function lintSource(): FindingsReport {
  return { findings: [] };
}
export function sourceFiles(): readonly string[] {
  return [];
}
export function declareShortcut(): ShortcutOutcome {
  return { declared: false };
}
export function applyFix(): FixOutcome {
  return { applied: false };
}
export function applyOrder(): FixOutcome {
  return { applied: false };
}
export function classAttributesOf(): readonly ClassAttribute[] {
  return [];
}
export function classOrderOf(): ClassOrder {
  return { classes: [] };
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
  return { findings: [] };
}
