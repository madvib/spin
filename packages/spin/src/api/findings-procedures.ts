/**
 * The findings procedures: what the lints say about the project's own
 * source, and what to do about it.
 *
 * These are the wire. The rules are the diagnostics' own and the files are
 * the project's own, so a handler here names the root, asks the service,
 * and answers — there is no rule about what a finding is in this file, and
 * no filesystem either.
 *
 * Four things cross the wire:
 *
 *   - `list` — the findings, grouped by the rule that said them, with the
 *     rule's own message and the rule's own remedy.
 *   - `fix` — one finding's edit, applied to the file it is in. The file
 *     is read, the rules are run over it again, and the edit that settles
 *     THIS finding is the one that lands.
 *   - `corpus` — the two facts the corpus holds: the compositions the
 *     source repeats, and the class lists that are not in the order the
 *     stylesheet writes them.
 *   - `shortcut` and `order` — the two ways of putting the corpus's
 *     findings right: a composition the source repeats becomes a shortcut
 *     the project declares, and a class list in the wrong order is written
 *     in the right one.
 *
 * Nothing here writes a file by itself: the writes belong to the service,
 * which owns the project's files, and a caller that cannot be given one
 * says so instead of writing something.
 */

import { oc } from "@orpc/contract";
import { implement } from "@orpc/server";
import * as v from "valibot";
import {
  applyFix,
  applyOrder,
  corpus,
  type CorpusReport,
  declareShortcut,
  type FindingsReport,
  lintSource,
} from "@spinjs/diagnostics";
import { rootFor } from "@spinjs/server/procedures";

/**
 * A project a call is about.
 *
 * Optional for the same reason the project procedures' is: the daemon has a
 * project it was started with, and one process can serve many.
 */
const ProjectInput = v.object({
  root: v.optional(v.string()),
});

/** One finding, as a reader reads it. */
const ProjectFinding = v.object({
  /** The file, as the project spells it. */
  file: v.string(),
  /** The line, counted from one. */
  line: v.number(),
  /** The column, counted from one. */
  column: v.number(),
  /** The rule's name, as a configuration writes it. */
  ruleId: v.string(),
  /** The sentence the rule said it in. */
  message: v.string(),
  /** What to do about it, in the rule's own words. */
  remedy: v.nullable(v.string()),
  /** How bad it is: the rule's own stance. */
  severity: v.picklist(["error", "warning"]),
  /** Whether the rule's edit can be applied mechanically. */
  fixable: v.boolean(),
});

/** The findings one rule has. */
const RuleGroup = v.object({
  /** The rule's name, as a configuration writes it. */
  ruleId: v.string(),
  /** What the rule says about itself. */
  title: v.string(),
  /** The findings, in the order the files were read. */
  findings: v.array(ProjectFinding),
});

/** What the lints say about a project's source. */
const FindingsReport = v.object({
  /** The findings, grouped by the rule that said them. */
  groups: v.array(RuleGroup),
  /** The files the lint could not read, or could not parse. */
  unreadable: v.array(v.string()),
  /** How many files the lint read. */
  files: v.number(),
});

/** Which finding a fix is about. */
const FixInput = v.object({
  /** The file, as the project spells it. */
  file: v.string(),
  /** The rule's name, as a configuration writes it. */
  ruleId: v.string(),
  /** The line the finding was on. */
  line: v.number(),
  /** The column the finding was on. */
  column: v.number(),
  root: v.optional(v.string()),
});

/** What a fix did. */
const FixOutput = v.object({
  /** Whether the file changed. */
  applied: v.boolean(),
  /** Why it did not, when it did not. */
  error: v.nullable(v.string()),
  /** The file the fix landed in, as the project spells it. */
  file: v.nullable(v.string()),
  /** The file's text after the fix. */
  text: v.nullable(v.string()),
});

/** A composition the source repeats. */
const Repetition = v.object({
  /** The classes, as the source writes them. */
  classes: v.array(v.string()),
  /** How many times the source writes that list. */
  count: v.number(),
  /** The files that write it. */
  files: v.array(v.string()),
  /** A name a shortcut for it could take. */
  suggested: v.string(),
});

/** One class list that is not in the order the sheet writes it. */
const ClassOrderAttribute = v.object({
  /** The file, as the project spells it. */
  file: v.string(),
  /** The line, counted from one. */
  line: v.number(),
  /** The column, counted from one. */
  column: v.number(),
  /** The classes, as the author wrote them. */
  classes: v.array(v.string()),
  /** The same classes, in the order the sheet writes them. */
  ordered: v.array(v.string()),
});

/** The class lists of one file that are not in order. */
const ClassOrderFile = v.object({
  /** The file, as the project spells it. */
  file: v.string(),
  /** The class lists that are not in order. */
  attributes: v.array(ClassOrderAttribute),
});

/** What the corpus holds about a project's source. */
const CorpusReport = v.object({
  /** The compositions the source repeats. */
  repetition: v.array(Repetition),
  /** The files whose class lists are not in the sheet's order. */
  order: v.array(ClassOrderFile),
});

/**
 * The name a shortcut is declared under.
 *
 * A shortcut is a class, and a class is a name the vocabulary can hold: the
 * file system will not take a name with a space in it, and neither will a
 * stylesheet.
 */
const ShortcutName = v.pipe(
  v.string(),
  v.regex(/^[a-z0-9][a-z0-9-]*$/i),
  v.description("A class name, e.g. `stack`."),
);

/** A shortcut to declare. */
const ShortcutInput = v.object({
  /** The name the shortcut is declared under. */
  name: ShortcutName,
  /** The classes the shortcut stands for. */
  classes: v.array(v.string()),
  root: v.optional(v.string()),
});

/** What a shortcut declaration did. */
const ShortcutOutput = v.object({
  /** The name the shortcut was declared under. */
  name: v.string(),
  /** Why it was not declared, when it was not. */
  error: v.nullable(v.string()),
  /** The file the declaration was written into. */
  file: v.nullable(v.string()),
});

export const findingsContract = oc.tag("findings").router({
  findings: {
    list: oc
      .input(ProjectInput)
      .output(FindingsReport)
      .route({
        method: "GET",
        path: "/findings/list",
        summary: "What the lints say about the project's own source",
      }),
    fix: oc
      .input(FixInput)
      .output(FixOutput)
      .route({
        method: "POST",
        path: "/findings/fix",
        summary: "Apply one finding's edit to the file it is in",
      }),
    corpus: oc
      .input(ProjectInput)
      .output(CorpusReport)
      .route({
        method: "GET",
        path: "/findings/corpus",
        summary:
          "The corpus: the compositions the source repeats, and the class lists that are out of order",
      }),
    order: oc
      .input(v.object({ file: v.string(), root: v.optional(v.string()) }))
      .output(FixOutput)
      .route({
        method: "POST",
        path: "/findings/order",
        summary:
          "Write a file's class lists in the order the sheet writes them",
      }),
    shortcut: oc
      .input(ShortcutInput)
      .output(ShortcutOutput)
      .route({
        method: "POST",
        path: "/findings/shortcut",
        summary: "Declare a shortcut in the project's own configuration",
      }),
  },
});

const os = implement(findingsContract);

/**
 * The report, in the shape the contract declares.
 *
 * The service answers with lists it does not promise to change; the wire
 * carries lists it does. Nothing is decided here — the findings are the
 * rules' own, and they cross as they are.
 */
function reportOf(report: FindingsReport) {
  return {
    groups: report.groups.map((group) => ({
      ruleId: group.ruleId,
      title: group.title,
      findings: group.findings.map((finding) => ({ ...finding })),
    })),
    unreadable: [...report.unreadable],
    files: report.files,
  };
}

/** The corpus, in the shape the contract declares. */
function corpusOf(report: CorpusReport) {
  return {
    repetition: report.repetition.map((repetition) => ({
      classes: [...repetition.classes],
      count: repetition.count,
      files: [...repetition.files],
      suggested: repetition.suggested,
    })),
    order: report.order.map((file) => ({
      file: file.file,
      attributes: file.attributes.map((attribute) => ({
        file: attribute.file,
        line: attribute.line,
        column: attribute.column,
        classes: [...attribute.classes],
        ordered: [...attribute.ordered],
      })),
    })),
  };
}

export const findingsRouter = os.router({
  findings: {
    list: os.findings.list.handler(async ({ input }) =>
      reportOf(await lintSource(rootFor(input)))
    ),
    fix: os.findings.fix.handler(async ({ input }) =>
      applyFix(rootFor(input), input.file, {
        ruleId: input.ruleId,
        line: input.line,
        column: input.column,
      })
    ),
    corpus: os.findings.corpus.handler(async ({ input }) =>
      corpusOf(await corpus(rootFor(input)))
    ),
    order: os.findings.order.handler(({ input }) =>
      applyOrder(rootFor(input), input.file)
    ),
    shortcut: os.findings.shortcut.handler(({ input }) =>
      declareShortcut(rootFor(input), input.name, input.classes)
    ),
  },
});
