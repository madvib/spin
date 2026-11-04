/**
 * The features: diagnostics, hover, and completion over the same core.
 *
 * The server delivers diagnostics; it never invents them. The findings
 * come from the lint service over staged text — the staged path exists
 * for exactly this — so what an editor shows and what `spin lint` prints
 * are two readings of one decision. Hover reads the preset's own rules
 * through the surfaces the lint reads, and the unknown-class suggestion
 * rides the build error's edit distance. Completion names the project
 * vocabulary the closed-vocabulary rule enforces.
 */

import { lintFiles } from "../diagnostics/service.ts";
import type { Diagnostic } from "../diagnostics/engine.ts";
import { factsForFile } from "../diagnostics/provider.ts";
import { nearestSuggestion, suggestFor } from "../plugin/strict-classes.ts";
import { lintMarkup, lintTree, parseFile } from "../diagnostics/engine.ts";
import { RULE_NAMES } from "../diagnostics/rules.ts";
import { DEFAULT_SEMANTIC_OPTIONS } from "../diagnostics/core.ts";

/* ------------------------------------------------------------ the document -- */

/** A document, as the editor holds it. */
export interface OpenDocument {
  /** The version the editor last named. */
  readonly version: number;
  /** The language the editor claimed. */
  readonly languageId: string;
  /** The text, as it reads on screen. */
  readonly text: string;
}

/** Whether the server reads a document's classes at all. */
export function readableLanguage(languageId: string): boolean {
  return languageId === "javascript" ||
    languageId === "javascriptreact" ||
    languageId === "typescript" ||
    languageId === "typescriptreact" ||
    languageId === "html";
}

/* ---------------------------------------------------------- the diagnostics -- */

/**
 * A finding, in the shape an editor draws.
 *
 * The severity is the finding's own: an error stays an error, a warning
 * stays a warning — the committed judgment travels untouched.
 */
export interface LspDiagnostic {
  readonly range: {
    readonly start: { readonly line: number; readonly character: number };
    readonly end: { readonly line: number; readonly character: number };
  };
  readonly severity: 1 | 2;
  readonly code: string;
  readonly source: "spin";
  readonly message: string;
}

/** A diagnostic over staged text — the same findings the CLI prints. */
export async function diagnosticsFor(
  uri: string,
  document: OpenDocument,
): Promise<LspDiagnostic[]> {
  const path = filePathOf(uri);
  const report = await lintFiles(
    [path],
    { kind: "staged", documents: [{ path, text: document.text }] },
  );
  return report.findings.map(toLsp);
}

/** One service finding, in the shape an editor draws. */
function toLsp(finding: Diagnostic): LspDiagnostic {
  // The positions the service reports count from one; LSP counts from
  // zero. The end reaches past the rule's name so the underline has a
  // body — the span is a drawing aid, and only the start is exact.
  return {
    range: {
      start: { line: Math.max(0, finding.line - 1), character: Math.max(0, finding.column - 1) },
      end: {
        line: Math.max(0, finding.line - 1),
        character: Math.max(0, finding.column - 1 + finding.ruleId.length),
      },
    },
    severity: finding.severity === "warning" ? 2 : 1,
    code: finding.ruleId,
    source: "spin",
    message: finding.remedy === undefined
      ? finding.message
      : `${finding.message} ${finding.remedy}`,
  };
}

/* ------------------------------------------------------------------ the word -- */

/** The class under the cursor, and the classes the line carries. */
export function wordAt(
  text: string,
  line: number,
  character: number,
): { readonly word: string; readonly classes: readonly string[] } | undefined {
  const row = text.split("\n")[line];
  if (row === undefined) return undefined;
  const attribute = attributeAt(row, character);
  if (attribute === undefined) return undefined;
  const offset = character - attribute.start;
  const word = wordAround(attribute.text, offset);
  if (word === undefined) return undefined;
  return { word, classes: attribute.text.split(/\s+/).filter(Boolean) };
}

/** The word the offset sits in, expanded to its spaces. */
function wordAround(
  text: string,
  offset: number,
): string | undefined {
  let from = offset;
  while (from > 0) {
    const before = text[from - 1];
    if (before === undefined || /\s/.test(before)) break;
    from -= 1;
  }
  let to = offset;
  while (to < text.length) {
    const after = text[to];
    if (after === undefined || /\s/.test(after)) break;
    to += 1;
  }
  const word = text.slice(from, to).trim();
  return word === "" ? undefined : word;
}

/** The class-list text the cursor sits inside, if it sits in one. */
function attributeAt(
  row: string,
  character: number,
): { readonly text: string; readonly start: number } | undefined {
  // A class attribute's value: `class="…"` or `className="…"` (bare or
  // wrapped in braces), in any of the three quotes. The search walks
  // backwards to the nearest opener before the cursor and forwards to
  // its closer.
  const pattern = /(?:class|className)\s*=\s*\{?\s*["'`]/g;
  let open: { readonly text: string; readonly start: number } | undefined;
  for (let match = pattern.exec(row); match !== null; match = pattern.exec(row)) {
    const raw = match[0];
    const quote = raw[raw.length - 1];
    if (quote === undefined) continue;
    const start = match.index + raw.length;
    if (start > character) break;
    const end = row.indexOf(quote, start);
    if (end < 0 || end < character) continue;
    open = { text: row.slice(start, end), start };
  }
  return open;
}

/* ------------------------------------------------------------------- the hover -- */

/**
 * The CSS a class sets, for the hover under the cursor.
 *
 * A known class shows what the theme puts behind it. An unknown class
 * says so and names the nearest class the theme can produce — the same
 * suggestion the build error offers, because both read one vocabulary.
 */
export function hoverAt(
  uri: string,
  text: string,
  line: number,
  character: number,
): { readonly contents: { readonly kind: string; readonly value: string } } | undefined {
  const found = wordAt(text, line, character);
  if (found === undefined) return undefined;
  const path = filePathOf(uri);
  const facts = factsForFile(path);
  if (!facts.readable) return undefined;
  const declarations = facts.surfaces.utility(found.word);
  if (declarations.size > 0) {
    const body = [...declarations].map(([property, value]) => `  ${property}: ${value};`).join("\n");
    return {
      contents: {
        kind: "markdown",
        value: `**\`${found.word}\`**\n\n\`\`\`css\n.${found.word} {\n${body}\n}\n\`\`\``,
      },
    };
  }
  const suggestion = suggestFor(
    found.word,
    facts.prefixes,
    new Set([...facts.utilities, ...facts.variants]),
  );
  const offer = suggestion === undefined ? "Drop it." : `Did you mean \`${suggestion}\`?`;
  return {
    contents: {
      kind: "markdown",
      value: `**\`${found.word}\`** is not in the spin vocabulary and generates no CSS. ${offer}`,
    },
  };
}

/* -------------------------------------------------------------- the completion -- */

/** One completion: what to insert, and what it sets. */
export interface LspCompletion {
  readonly label: string;
  readonly detail?: string;
  readonly insertText: string;
}

/**
 * The project vocabulary at the cursor in a class attribute.
 *
 * The list is the vocabulary the closed-vocabulary rule enforces —
 * utilities, primitive variants, and the project's own shortcuts — so
 * completing from it can never complete to a class the lint flags.
 * The filter is what the author typed BEFORE the cursor: an empty
 * start offers the vocabulary, and each letter narrows it. Ranked by
 * use in the file: the classes the file already spends come first,
 * because the next class usually reads like the last one.
 */
export function completionsAt(
  uri: string,
  text: string,
  line: number,
  character: number,
): LspCompletion[] {
  const row = text.split("\n")[line];
  if (row === undefined) return [];
  const attribute = attributeAt(row, character);
  if (attribute === undefined) return [];
  const path = filePathOf(uri);
  const facts = factsForFile(path);
  if (!facts.readable) return [];
  if (facts.shortcuts === null) return [];
  const names = new Set<string>([...facts.utilities, ...facts.variants, ...facts.shortcuts.keys()]);
  const spent = new Set<string>();
  try {
    const run = { rules: RULE_NAMES, semantic: DEFAULT_SEMANTIC_OPTIONS };
    const findings = path.endsWith(".html")
      ? lintMarkup(path, text, run)
      : lintTree(path, parseFile(text, path), run);
    void findings;
    for (const token of text.split(/[^a-zA-Z0-9:_\-./[\]()]+/)) {
      if (names.has(token)) spent.add(token);
    }
  } catch {
    // The completion is a vocabulary list, not a parse result: a file the
    // parser cannot read still completes from the theme.
  }
  // The partial class before the cursor, back to its space: what the
  // author typed is the filter, and nothing after the cursor filters.
  const offset = character - attribute.start;
  let from = offset;
  while (from > 0) {
    const before = attribute.text[from - 1];
    if (before === undefined || /\s/.test(before)) break;
    from -= 1;
  }
  const prefix = attribute.text.slice(from, offset);
  const candidates = [...names].filter((name) => name.startsWith(prefix));
  const used = candidates.filter((name) => spent.has(name)).sort();
  const rest = candidates.filter((name) => !spent.has(name)).sort();
  return [...used, ...rest].slice(0, 200).map((label) => {
    const paint = facts.paints.get(label);
    return {
      label,
      ...(paint === undefined ? {} : { detail: paint }),
      insertText: label,
    };
  });
}

/** The file a document URI names. */
export function filePathOf(uri: string): string {
  try {
    const url = new URL(uri);
    if (url.protocol === "file:") return decodeURIComponent(url.pathname);
  } catch {
    // Not a URI at all — the path, as given.
  }
  return uri;
}

/** The project vocabulary one name away, for tests. */
export function suggestionFor(uri: string, cls: string): string | undefined {
  const facts = factsForFile(filePathOf(uri));
  return nearestSuggestion(cls, new Set([...facts.utilities, ...facts.variants]));
}
