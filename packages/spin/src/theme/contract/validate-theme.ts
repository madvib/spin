/**
 * A theme document, judged.
 *
 * The module owns the token language, the documents, and the rules a document
 * must obey — so the question "what is wrong with this theme?" belongs here
 * and not in a client that would otherwise have to know the required roles,
 * the value rules and the contrast floors all at once. Two clients that each
 * knew them would be two answers, and a studio that said a theme was fine
 * while the daemon refused to build it would be one of them lying.
 *
 * `validateTheme` asks the question of a document's text and answers with
 * everything a caller needs: the tree (when the document parses), the
 * problems, and the verdict. It never throws and never refuses a document: a
 * theme that does not parse is reported, because the studio's job is to say
 * what is wrong, and a theme it refuses to load is one it cannot help fix.
 */

import { parseTokens } from "../pipeline/parse.ts";
import type { TokenTree, ValidationIssue } from "../pipeline/types.ts";
import { validateTokens } from "../pipeline/validate.ts";
import { type Mode, treeInMode } from "../modes.ts";
import { themeGates } from "./battery.ts";
import { requiredPaths } from "./roles.ts";
import { validateLegibility } from "./schema.ts";

/** What a caller may state about the document it is judging. */
export interface ValidateThemeOptions {
  /**
   * The DTCG dotted paths the document must declare.
   *
   * Absent: the base roles — the palette, the contrast floors that make the
   * palette usable, and the focus ring every interactive element shares. A
   * caller that judges a theme against more than the base surface (the
   * component tokens, say) states them; the module owns the base list, and
   * nothing else.
   */
  readonly required?: readonly string[];

  /**
   * The modes the document SERVES.
   *
   * A claim, and only a claim: existence cannot say what is served, so a
   * caller that states nothing has made no claim, and no override is judged
   * dead. A caller that states the modes gets the check that follows — a
   * value written for a mode the theme does not serve is never shown, so the
   * declaration is a promise nothing keeps.
   */
  readonly modes?: readonly Mode[];

  /**
   * The mode the document is judged IN.
   *
   * A mode is a variant of a token, so a theme is a different document in
   * dark: the values it carries there are the ones a reader sees. Judged in
   * a mode, the document is judged as it reads there — the dark palette's
   * floors and the dark values' soundness. Absent: the base document's own
   * values.
   */
  readonly mode?: Mode;
}

/** What a theme document is, once it has been judged. */
export interface ThemeReport {
  /** The parsed tree, when the document parses. */
  readonly tree: TokenTree | undefined;
  /** Why the document did not parse, when it did not. */
  readonly error: string | undefined;
  /** Every problem the document has, in the module's own words. */
  readonly issues: readonly ValidationIssue[];
  /** Whether the document parses and owes nothing. */
  readonly valid: boolean;
}

/**
 * Judge a theme document, and say what is wrong with it.
 *
 * The one operation over a document: it parses the text, checks the tree
 * against the roles the document owes, and measures the contrast floors. The
 * answer is the same whoever asks — a studio's issues panel, the daemon's
 * analysis procedure, an agent's report — because there is one judge.
 *
 * The problems come back in the module's own words, and they come back all
 * at once: a token file is edited by a human, and one error per round trip
 * turns a six-line fix into six round trips.
 */
export function validateTheme(
  input: string | Record<string, unknown>,
  options: ValidateThemeOptions = {},
): ThemeReport {
  const text = typeof input === "string" ? input : JSON.stringify(input);
  const parsed = parseTokens(text);
  if (!parsed.ok) {
    return { tree: undefined, error: parsed.error, issues: [], valid: false };
  }

  // The tree the judgement reads: the document as it reads in the mode asked
  // for, and the document's own values otherwise. The tree the caller gets
  // back is the document either way — the shape is the document's, and the
  // modes ride on it.
  const judged = options.mode === undefined
    ? parsed.tree
    : treeInMode(parsed.tree, options.mode);

  const report = validateTokens(judged, {
    required: options.required ?? requiredPaths(),
    // The claim is the caller's: without one, no override is judged dead.
    ...(options.modes !== undefined ? { modes: options.modes } : {}),
  });
  const issues = [...report.issues, ...validateLegibility(judged)];

  // A full theme owes the whole battery: the ladders, the loop, and the
  // modes' restraint, on top of the roles and the floors. A caller that
  // states what the document owes (or the mode it is read in) judges a
  // fragment, so only the stated judgement runs there.
  if (options.required === undefined && options.mode === undefined) {
    const battery = themeGates(text, {
      ...(options.modes !== undefined ? { modes: options.modes } : {}),
    });
    const seen = new Set(issues.map((issue) => `${issue.path}|${issue.message}`));
    for (const gate of battery.gates) {
      if (gate.gate === "completeness" || gate.gate === "legibility") continue;
      for (const extra of gate.issues) {
        const key = `${extra.path}|${extra.message}`;
        if (!seen.has(key)) {
          issues.push(extra);
          seen.add(key);
        }
      }
    }
  }

  return {
    tree: parsed.tree,
    error: undefined,
    issues,
    valid: issues.length === 0,
  };
}
