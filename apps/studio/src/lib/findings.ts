/**
 * The project's findings, over RPC.
 *
 * The studio holds no logic: the lints are the diagnostics' own, the files
 * are the project's own, and the corpus's two facts are the corpus's own.
 * What the studio does is ask and show — so this file is the calls and the
 * shapes the answers come back in, and nothing else.
 *
 * Every call goes to the daemon: the browser never reads a file and never
 * writes one. A fix is applied by the service that owns the project's files,
 * and the answer says whether the file changed.
 */

import { spinClient } from "./client.ts";

/** One finding, as the daemon carries it. */
export interface Finding {
  /** The file, as the project spells it. */
  readonly file: string;
  /** The line, counted from one. */
  readonly line: number;
  /** The column, counted from one. */
  readonly column: number;
  /** The rule's name, as a configuration writes it. */
  readonly ruleId: string;
  /** The sentence the rule said it in. */
  readonly message: string;
  /** What to do about it, in the rule's own words. */
  readonly remedy: string | null;
  /** How bad it is: the rule's own stance. */
  readonly severity: "error" | "warning";
  /** Whether the rule's edit can be applied mechanically. */
  readonly fixable: boolean;
}

/** The findings one rule has. */
export interface RuleGroup {
  /** The rule's name, as a configuration writes it. */
  readonly ruleId: string;
  /** What the rule says about itself. */
  readonly title: string;
  /** The findings, in the order the files were read. */
  readonly findings: readonly Finding[];
}

/** What the lints say about the project's source. */
export interface FindingsReport {
  /** The findings, grouped by the rule that said them. */
  readonly groups: readonly RuleGroup[];
  /** The files the lint could not read, or could not parse. */
  readonly unreadable: readonly string[];
  /** How many files the lint read. */
  readonly files: number;
}

/** A composition the source repeats. */
export interface Repetition {
  /** The classes, as the source writes them. */
  readonly classes: readonly string[];
  /** How many times the source writes that list. */
  readonly count: number;
  /** The files that write it. */
  readonly files: readonly string[];
  /** A name a shortcut for it could take. */
  readonly suggested: string;
}

/** One class list that is not in the order the sheet writes it. */
export interface ClassOrderAttribute {
  /** The file, as the project spells it. */
  readonly file: string;
  /** The line, counted from one. */
  readonly line: number;
  /** The column, counted from one. */
  readonly column: number;
  /** The classes, as the author wrote them. */
  readonly classes: readonly string[];
  /** The same classes, in the order the sheet writes them. */
  readonly ordered: readonly string[];
}

/** The class lists of one file that are not in order. */
export interface ClassOrderFile {
  /** The file, as the project spells it. */
  readonly file: string;
  /** The class lists that are not in order. */
  readonly attributes: readonly ClassOrderAttribute[];
}

/** What the corpus holds about the project's source. */
export interface CorpusReport {
  /** The compositions the source repeats. */
  readonly repetition: readonly Repetition[];
  /** The files whose class lists are not in the sheet's order. */
  readonly order: readonly ClassOrderFile[];
}

/** What a fix did. */
export interface FixOutcome {
  /** Whether the file changed. */
  readonly applied: boolean;
  /** Why it did not, when it did not. */
  readonly error: string | null;
  /** The file the fix landed in, as the project spells it. */
  readonly file: string | null;
  /** The file's text after the fix. */
  readonly text: string | null;
}

/** What a shortcut declaration did. */
export interface ShortcutOutcome {
  /** The name the shortcut was declared under. */
  readonly name: string;
  /** Why it was not declared, when it was not. */
  readonly error: string | null;
  /** The file the declaration was written into. */
  readonly file: string | null;
}

/** What the lints say about the project's own source. */
export async function loadFindings(): Promise<FindingsReport> {
  const listed = await (await spinClient()).findings.list({});
  return listed as FindingsReport;
}

/**
 * Applies one finding's edit to the file it is in.
 *
 * The finding is named by where it is and which rule said it: the offsets
 * an edit carries are true only of the text as it stands, and the daemon
 * looks the finding up again before it writes anything.
 */
export async function fixFinding(finding: Finding): Promise<FixOutcome> {
  const fixed = await (await spinClient()).findings.fix({
    file: finding.file,
    ruleId: finding.ruleId,
    line: finding.line,
    column: finding.column,
  });
  return fixed as FixOutcome;
}

/** The corpus: the compositions the source repeats, and what is out of order. */
export async function loadCorpus(): Promise<CorpusReport> {
  const reported = await (await spinClient()).findings.corpus({});
  return reported as CorpusReport;
}

/** Writes a file's class lists in the order the sheet writes them. */
export async function orderClasses(file: string): Promise<FixOutcome> {
  const written = await (await spinClient()).findings.order({ file });
  return written as FixOutcome;
}

/**
 * Declares a shortcut in the project's own configuration.
 *
 * A shortcut is a class the project composes, and the project's
 * compositions live in the file the project's stylesheet is declared in.
 */
export async function declareShortcut(
  name: string,
  classes: readonly string[],
): Promise<ShortcutOutcome> {
  const declared = await (await spinClient()).findings.shortcut({
    name,
    classes: [...classes],
  });
  return declared as ShortcutOutcome;
}
