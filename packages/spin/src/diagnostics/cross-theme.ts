/**
 * The cross-theme scale report: which worn classes resolve under which themes.
 *
 * Rules resolve against the union of every theme, so a step one theme
 * declares resolves everywhere — until the project switches to a theme
 * that never declared it, and the class silently styles nothing. This
 * module answers the per-theme question the union hides: generate once
 * per theme, judge the same corpus with each answer, and list the
 * classes that resolve under some shipped themes but not others.
 *
 * The scan and the judgement are the build error's own
 * (`deadClasses`/`candidatesInFile`): one scanner, one vocabulary
 * source, no divergent answers. A class dead under every theme is the
 * single-theme build error's answer, not this report's, so it is left
 * out here.
 */

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createGenerator } from "@unocss/core";
import { spinPreset } from "../compiler/index.ts";
import { joinContent, type ContentMap } from "../plugin/content.ts";
import { candidatesInFile, deadClasses } from "../plugin/strict-classes.ts";
import type { ThemeDocument } from "../theme/index.ts";
import { filesUnder } from "./service.ts";

/** One class the corpus wears that some shipped theme cannot produce. */
export interface CrossThemeGap {
  /** The wearing file, project-relative. */
  readonly file: string;
  /** The class that drops out. */
  readonly cls: string;
  /** The themes that resolve it. */
  readonly resolves: readonly string[];
  /** The themes it styles nothing under. */
  readonly missing: readonly string[];
}

/** The report: divergent classes, or clean. */
export interface CrossThemeReport {
  /** Every compared theme, sorted. */
  readonly themes: readonly string[];
  /** The classes that resolve under some themes but not others. */
  readonly gaps: readonly CrossThemeGap[];
  /** The corpus the report judged. */
  readonly corpus: { readonly files: number; readonly classes: number };
  /** True when every worn class resolves under every shipped theme. */
  readonly clean: boolean;
}

/** The report's opening line: what clean means, in the reader's terms. */
export const CROSS_THEME_DEFINITION =
  "Cross-theme: every class your project wears must resolve under every shipped theme — switching themes never unstyles markup.";

/**
 * Judge the project's corpus once per theme.
 *
 * `themes` are the parsed documents behind the project's shipped theme
 * names; `shortcuts` are the project's own compositions, as read from
 * its configuration. A theme that fails to generate throws: callers
 * compare only themes that already validate.
 */
export async function analyzeCrossTheme(options: {
  readonly root: string;
  readonly themes: Record<string, unknown>;
  readonly shortcuts?: Record<string, readonly string[]>;
}): Promise<CrossThemeReport> {
  const root = resolve(options.root);
  const names = Object.keys(options.themes).sort();
  const shortcuts: Record<string, string> = {};
  for (const [name, classes] of Object.entries(options.shortcuts ?? {})) {
    shortcuts[name] = [...classes].join(" ");
  }

  // The corpus: every readable source under the root, keyed by path.
  const files: ContentMap = new Map();
  for (const path of await filesUnder(root)) {
    try {
      files.set(path, await readFile(path, "utf8"));
    } catch {
      // Unreadable is not worn: outside the corpus, outside the report.
    }
  }
  const corpus = new Set<string>();
  let corpusFiles = 0;
  for (const [path, text] of files) {
    const worn = candidatesInFile(path, text);
    if (worn.length > 0) corpusFiles += 1;
    for (const cls of worn) corpus.add(cls);
  }

  // Once per theme: generate the corpus against that theme alone, and
  // judge the same files with that theme's answer.
  const deadByTheme = new Map<string, Set<string>>();
  for (const name of names) {
    const document = options.themes[name] as ThemeDocument;
    const generator = await createGenerator({
      presets: [spinPreset({ themes: { [name]: document }, shortcuts })],
    });
    const { matched } = await generator.generate(joinContent(files));
    const dead = deadClasses({
      files,
      matched,
      themes: { [name]: document },
      shortcuts,
      root,
    });
    deadByTheme.set(
      name,
      new Set(dead.map((entry) => `${entry.file}|${entry.cls}`)),
    );
  }

  const keys = new Set<string>();
  for (const dead of deadByTheme.values()) {
    for (const key of dead) keys.add(key);
  }
  const gaps: CrossThemeGap[] = [];
  for (const key of [...keys].sort()) {
    const tab = key.indexOf("|");
    const file = key.slice(0, tab);
    const cls = key.slice(tab + 1);
    const missing = names.filter((name) => deadByTheme.get(name)?.has(key));
    const resolves = names.filter((name) => !deadByTheme.get(name)?.has(key));
    if (resolves.length === 0) continue;
    gaps.push({ file, cls, resolves, missing });
  }
  return {
    themes: names,
    gaps,
    corpus: { files: corpusFiles, classes: corpus.size },
    clean: gaps.length === 0,
  };
}

/** The report as text lines: the definition first, then the gaps or clean. */
export function formatCrossThemeText(report: CrossThemeReport): string[] {
  const lines = [CROSS_THEME_DEFINITION];
  if (report.clean) {
    const files = report.corpus.files;
    const classes = report.corpus.classes;
    lines.push(
      `Clean: ${classes} class${classes === 1 ? "" : "es"} across ${files} file${
        files === 1 ? "" : "s"
      } — every one resolves under ${report.themes.join(", ")}.`,
    );
    return lines;
  }
  for (const gap of report.gaps) {
    lines.push(
      `${gap.file}: \`${gap.cls}\` generates no CSS under ${
        gap.missing.join(", ")
      } — it resolves under ${gap.resolves.join(", ")}.`,
    );
  }
  return lines;
}

/** The report as a JSON pintura: the shape CI pins. */
export function crossThemeJson(report: CrossThemeReport): {
  readonly status: "ok";
  readonly clean: boolean;
  readonly themes: readonly string[];
  readonly gaps: readonly {
    readonly file: string;
    readonly class: string;
    readonly resolves: readonly string[];
    readonly missing: readonly string[];
  }[];
  readonly corpus: { readonly files: number; readonly classes: number };
} {
  return {
    status: "ok",
    clean: report.clean,
    themes: [...report.themes],
    gaps: report.gaps.map((gap) => ({
      file: gap.file,
      class: gap.cls,
      resolves: [...gap.resolves],
      missing: [...gap.missing],
    })),
    corpus: { ...report.corpus },
  };
}
