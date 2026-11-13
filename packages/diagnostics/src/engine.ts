/**
 * The engine: the rules, over a tree.
 *
 * The decisions live in `./core.ts` and know nothing about a linter. This
 * module is the asking: a tree in, findings out. The oxlint plugin and
 * the ESLint plugin ask their own way — they walk the tree and hand each
 * rule the node it is on — and the CLI and the service ask this way.
 *
 * The findings carry the edit that settles them: the decision about what
 * to change belongs to the core, and the change itself belongs to whoever
 * is holding the file. So a finding is data all the way out, and the
 * writer — the CLI's, the editor's — is the caller's.
 */

import { parseSync } from "oxc-parser";
import type {
  AttrValue,
  ComponentIr,
  Node as SyntaxNode,
} from "@spinjs/components/runtime";
import { checkClosedVocabulary } from "./closed-vocabulary.ts";
import type {
  AncestorFacts,
  ClassFacts,
  Position,
  SemanticOptions,
  TextEdit,
} from "./core.ts";
import { checkNoUnpairedInk } from "./pairing.ts";
import { checkNoRedundantClass } from "./no-redundant-class.ts";
import { checkPreferElement } from "./prefer-element.ts";
import { checkPreferThemeValue, checkTypeStyleClashes } from "./prefer-theme-value.ts";
import type { EngineAnswers } from "./engine-types.ts";
import { ParseBudgetError } from "./generated.ts";
import { factsForFile } from "./provider.ts";
import { THEME_STYLE_PROPERTIES } from "./vocabulary.ts";
import {
  collectExpressionBranches,
  type GateContext,
  type GateNode,
  renderMessage,
  type RuleName,
  RULES,
} from "./rules.ts";
import { walk, type WalkNode } from "./walk.ts";

/**
 * One finding, as the engine reports it.
 *
 * The shape every delivery agrees on: where it is, which rule said it,
 * the sentence it was said in, how bad it is, and the edit that settles
 * it when there is one. The rule's own stance decides the severity — a
 * problem is an error, a suggestion is a warning.
 */
export interface Diagnostic {
  /** The file the finding is in. */
  readonly file: string;
  /** The line, counted from one. */
  readonly line: number;
  /** The column, counted from one — the convention every linter prints. */
  readonly column: number;
  /** The rule's name, as a configuration writes it. */
  readonly ruleId: string;
  /** The message id the rule reported under. */
  readonly messageId: string;
  /** The sentence the message id stands for. */
  readonly message: string;
  /**
   * What to do about the finding, in the rule's own words.
   *
   * A finding that says only what is wrong leaves the reader to work out the
   * repair; the remedy is the way out, and it belongs to the rule that found
   * the thing — so the wording lives where the decision lives.
   */
  readonly remedy?: string;
  /** How bad it is: the rule's own stance. */
  readonly severity: "error" | "warning";
  /** The edit that settles the finding, when the finding has one. */
  readonly fix?: TextEdit;
}

/**
 * The rules that run, and the dials they read.
 *
 * Resolved: the service answers with these, the engine runs them.
 */
export interface RuleRun {
  /** The rules to run. */
  readonly rules: readonly RuleName[];
  /** The dials the semantic rules read. */
  readonly semantic: SemanticOptions;
  /** What the style engine answers. The caller fills it; the engine owns the filling. */
  readonly answers: EngineAnswers;
}

/**
 * The tree of a file, as the rules read it.
 *
 * The parser is the one thing the engine needs that a linter brings with
 * it. It reads TypeScript and JavaScript, JSX included, and hands over the
 * same ESTree shape ESLint's own parser produces — which is why the
 * findings land on the same lines and columns a linter's do.
 */
/**
 * The parser is Babel's, not a TypeScript-API parser.
 *
 * A linter's parser is the one dependency that binds the engine to a
 * TypeScript version: `@typescript-eslint/parser` refuses to load on TS 7,
 * which takes the CLI, the lint plugins' CLI half, and the MCP findings
 * tool down in a consumer's workspace. Babel parses the same TS/JSX syntax
 * without loading the project's TypeScript. Its node names differ only in
 * the places the rules read, so the tree is normalized to the ESTree names
 * the rules are written against.
 */
function lineStarts(code: string): number[] {
  const starts = [0];
  for (let i = 0; i < code.length; i++) {
    if (code.charCodeAt(i) === 10) starts.push(i + 1);
  }
  return starts;
}

function locationAt(
  starts: readonly number[],
  offset: number,
): { line: number; column: number } {
  let lo = 0;
  let hi = starts.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if ((starts[mid] as number) <= offset) lo = mid + 1;
    else hi = mid - 1;
  }
  const lineIdx = Math.max(0, lo - 1);
  return { line: lineIdx + 1, column: offset - (starts[lineIdx] as number) };
}

function attachLocations(value: unknown, starts: readonly number[]): unknown {
  if (Array.isArray(value)) {
    for (const item of value) attachLocations(item, starts);
    return value;
  }
  if (typeof value !== "object" || value === null) return value;
  const node = value as Record<string, unknown>;
  const start = node["start"];
  if (typeof start === "number" && node["loc"] === undefined) {
    node["loc"] = { start: locationAt(starts, start) };
  }
  for (const key of Object.keys(node)) {
    if (key === "loc" || key === "range") continue;
    attachLocations(node[key], starts);
  }
  return value;
}

export function parseFile(code: string, filename: string): WalkNode {
  const lang = filename.endsWith(".tsx")
    ? "tsx"
    : filename.endsWith(".jsx")
      ? "jsx"
      : filename.endsWith(".js") || filename.endsWith(".mjs") || filename.endsWith(".cjs")
        ? "js"
        : "ts";
  const parsed = parseSync(filename, code, {
    lang,
    sourceType: "module",
    range: true,
  });
  if (parsed.errors.length > 0) {
    throw new SyntaxError(parsed.errors[0]?.message ?? "Unable to parse file");
  }
  return attachLocations(parsed.program, lineStarts(code)) as WalkNode;
}

/**
 * The findings in one tree.
 *
 * The rules run exactly as a linter runs them: each is given its own
 * context, with the file's name and the dials, and each reports what the
 * core decided. The edit is offered as a fixer offers it — the engine
 * asks for the pair, exactly as ESLint and oxlint do.
 */
export function lintTree(
  filename: string,
  ast: WalkNode,
  run: RuleRun,
  code?: string,
): Diagnostic[] {
  const findings: Diagnostic[] = [];
  const visitors = new Map<string, ((node: GateNode) => void)[]>();

  for (const name of run.rules) {
    const rule = RULES[name];
    const context: GateContext = {
      filename,
      options: [run.semantic],
      answers: run.answers,
      ...(code === undefined ? {} : { sourceCode: { text: code } }),
      report(descriptor) {
        const fix = descriptor.fix?.();
        const position = {
          line: descriptor.node.loc?.start.line ?? 0,
          column: descriptor.node.loc?.start.column ?? 0,
        };
        // The remedy is the rule's own sentence about what to do: a rule
        // that says what is wrong and what to do about it says both in the
        // same vocabulary. The severity is the finding's when the finding
        // carries one, else the rule's type: problems are errors,
        // suggestions are warnings.
        const remedy = descriptor.remedy;
        findings.push({
          file: filename,
          line: position.line,
          column: position.column + 1,
          ruleId: `spin/${name}`,
          messageId: descriptor.messageId,
          message: renderMessage(rule.meta, {
            messageId: descriptor.messageId,
            data: descriptor.data ?? {},
            position,
          }),
          ...(remedy === undefined ? {} : { remedy }),
          severity: descriptor.severity ??
            (rule.meta.type === "problem" ? "error" : "warning"),
          ...(fix === undefined ? {} : { fix }),
        });
      },
    };
    for (const [type, visitor] of Object.entries(rule.create(context))) {
      const list = visitors.get(type) ?? [];
      list.push(visitor);
      visitors.set(type, list);
    }
  }

  walk(ast, (node) => {
    for (const visitor of visitors.get(node.type) ?? []) visitor(node);
  });
  return findings;
}

/**
 * The closed-vocabulary and semantic findings in markup no parser reads.
 *
 * An `.html` example is a fragment, not a module: the module parser cannot
 * read it, so it is walked through the syntax the components are compiled
 * with instead. Each element's classes are read with the same expression
 * reader the generator uses, and every enabled rule is asked — the same
 * decisions the JSX rules make, over the same facts. Findings carry no edit
 * (without a tree there are no token offsets) and positions are the tag's
 * own line and column; the author drops the class by hand.
 */
export async function lintMarkup(
  filename: string,
  code: string,
  run: RuleRun,
): Promise<Diagnostic[]> {
  const blank = (match: string): string => match.replace(/[^\n]/g, " ");
  // A `<style>` block is found before the strip below blanks it: the
  // strip exists so the parser never sees the block, but the rule that
  // forbids the block has to see it first.
  const out: Diagnostic[] = run.rules.includes("no-handwritten-tokens")
    ? styleTagFindings(filename, code)
    : [];
  let prepared = code;
  if (filename.endsWith(".astro")) {
    prepared = prepared.replace(/^---[\s\S]*?---/, blank);
  }
  prepared = prepared
    .replace(/<!--[\s\S]*?-->/g, blank)
    .replace(/<script(\s[^>]*)?>[\s\S]*?<\/script>/g, blank)
    .replace(/<style(\s[^>]*)?>[\s\S]*?<\/style>/g, blank)
    .replace(/<scope>[\s\S]*?<\/scope>/g, blank);
  if (filename.endsWith(".vue")) {
    prepared = prepared
      .replace(/<\/?template(\s[^>]*)?>/g, blank)
      .replace(/(?:v-bind)?:class\s*=\s*"([^"]*)"/g, "class={$1}")
      .replace(/(?:v-bind)?:class\s*=\s*'([^']*)'/g, "class={$1}");
  }
  if (filename.endsWith(".svelte")) {
    prepared = prepared
      .replace(/\{[#/:@][a-zA-Z][^}]*\}/g, blank)
      .replace(/\bclass:([a-zA-Z0-9_:/-]+)=\{([^}]+)\}/g, 'class={$2 ? "$1" : ""}')
      .replace(/(?<=\s)class:([a-zA-Z_$][a-zA-Z0-9_$]*)(?=\s|\/?>)/g, 'class={$1 ? "$1" : ""}');
  }
  const runtime = await import("@spinjs/components/runtime").catch(() => undefined);
  if (runtime === undefined) {
    return [...out, ...lintMarkupText(filename, prepared, run)];
  }
  const stripped = runtime.expandVariantGroups(prepared);
  try {
    return [...out, ...lintComponentIr(filename, stripped, code, run, runtime)];
  } catch {
    // Not a component (a document, a fragment the parser rejects): the text
    // walk below sees what it can.
    return [...out, ...lintMarkupText(filename, prepared, run)];
  }
}

/** The `<style>` blocks in markup, before the strip blanks them. */
function styleTagFindings(filename: string, code: string): Diagnostic[] {
  // A document shell owns its own head: `<!doctype html>` plus `<html>`
  // means this is the page, not a component in it, and the page's own
  // shell styles are not a component smuggling paint past the theme.
  if (/<!doctype html/i.test(code) && /<html[\s>]/.test(code)) return [];
  const out: Diagnostic[] = [];
  const pattern = /<style(\s[^>]*)?>/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(code)) !== null) {
    const attrs = match[1] ?? "";
    // A style block the framework owns (a scoped `id` the compiler reads)
    // is not a component smuggling paint past the theme.
    if (/\bid\s*=/.test(attrs)) continue;
    pushFindings(out, filename, "no-handwritten-tokens", positionOfSpan(code, match.index), [
      {
        messageId: "styleTag",
        data: {},
        remedy: "Move styles into theme tokens or utility classes.",
      },
    ]);
  }
  return out;
}

/**
 * The theme-owned properties an inline `style` must not set, in the case
 * markup speaks: an inline style is CSS text, so `background-color`, never
 * `backgroundColor`. The oracle holds the one spelling; this module only
 * lowercases at the boundary, the way the JSX side decamelizes at its own.
 */

/** The theme-owned properties an inline `style` value sets. */
function inlineThemeProps(value: string): string[] {
  const out: string[] = [];
  for (const declaration of value.split(";")) {
    const name = declaration.slice(0, declaration.indexOf(":")).trim().toLowerCase();
    if (name !== "" && THEME_STYLE_PROPERTIES.has(name)) out.push(name);
  }
  return out;
}

type AncestorFrame = { readonly tag?: string; readonly classes: string[] };

/** The line and column of a span's start in the source. */
function positionOfSpan(code: string, offset: number): Position {
  const before = code.slice(0, offset);
  return {
    line: before.split("\n").length,
    column: offset - (before.lastIndexOf("\n") + 1) + 1,
  };
}

/** Push one diagnostic per finding, at the element's own position. */
function pushFindings(
  out: Diagnostic[],
  filename: string,
  ruleId: RuleName,
  position: Position,
  findings: readonly {
    messageId: string;
    data: Record<string, string>;
    remedy?: string;
    severity?: "error" | "warning";
  }[],
): void {
  const meta = RULES[ruleId].meta;
  for (const finding of findings) {
    const remedy = finding.remedy;
    out.push({
      file: filename,
      line: position.line,
      column: position.column,
      ruleId: `spin/${ruleId}`,
      messageId: finding.messageId,
      message: renderMessage(meta, {
        messageId: finding.messageId,
        data: finding.data ?? {},
        position,
      }),
      ...(remedy === undefined ? {} : { remedy }),
      severity: finding.severity ??
        (meta.type === "problem" ? "error" : "warning"),
    });
  }
}

/** Walk a component IR, asking every enabled rule at each element. */
function lintComponentIr(
  filename: string,
  stripped: string,
  code: string,
  run: RuleRun,
  runtime: typeof import("@spinjs/components/runtime"),
): Diagnostic[] {
  const parseStart = Date.now();
  const ir: ComponentIr = runtime.parse(stripped);
  // A parse past budget is pathological input, not a large file: throwing
  // lands in the caller's fallback, so the file degrades to the text walk
  // rather than hanging the lint.
  if (Date.now() - parseStart > 2000) throw new ParseBudgetError(filename);
  const facts = factsForFile(filename, run.answers);
  const out: Diagnostic[] = [];
  const ancestors: AncestorFrame[] = [];
  const visit = (node: SyntaxNode): void => {
    if (node.kind === "text") return;
    if (node.kind === "for") {
      for (const child of node.body) visit(child);
      return;
    }
    const classAttrs = node.attrs.filter(
      (attr) =>
        attr.name === "class" ||
        attr.name === "className" ||
        attr.name === "classList",
    );
    const variantAttr = node.attrs.find((attr) => attr.name === "variant");
    const variantResting: string[] = [];
    if (variantAttr !== undefined && variantAttr.value.kind === "static") {
      for (const token of runtime.classTokensOf(variantAttr.value)) {
        if (facts.variants.has(token)) {
          variantResting.push(token);
        } else if (facts.variants.has(`${node.tag}-${token}`)) {
          variantResting.push(`${node.tag}-${token}`);
        }
      }
    }
    const classResting: string[] = [];
    const conditional: string[][] = [];
    const elementGuarded = new Map<string, string[]>();
    for (const attr of classAttrs) {
      const val = (attr as { readonly value: AttrValue }).value;
      if (val.kind === "static") {
        classResting.push(...runtime.classTokensOf(val));
        continue;
      }
      try {
        const parsed = parseSync("expr.ts", `(${val.expr})`, {
          lang: "ts",
          sourceType: "module",
        });
        const stmt = parsed.program.body[0] as { expression?: unknown } | undefined;
        collectExpressionBranches(
          stmt?.expression,
          classResting,
          conditional,
          true,
          elementGuarded,
        );
      } catch {
        classResting.push(...runtime.classTokensOf(val));
      }
    }
    const resting: string[] = [...variantResting, ...classResting];
    const all: string[] = [];
    const seenAll = new Set<string>();
    for (const cls of [...classResting, ...conditional.flat()]) {
      if (seenAll.has(cls)) continue;
      seenAll.add(cls);
      all.push(cls);
    }
    const parsedBranches = { resting, conditional, all };
    const position = positionOfSpan(code, node.span.start);
    if (run.rules.includes("no-handwritten-tokens")) {
      const style = node.attrs.find((attr) => attr.name === "style");
      if (style !== undefined && style.value.kind === "static") {
        for (const property of inlineThemeProps(style.value.value)) {
          pushFindings(out, filename, "no-handwritten-tokens", position, [
            {
              messageId: "inlineStyle",
              data: { property },
              remedy: "Replace inline theme values with Spin utility classes.",
            },
          ]);
        }
      }
    }
    if (parsedBranches.all.length > 0 || variantResting.length > 0) {
      const ancestorFacts = ancestors.map((frame): AncestorFacts => ({
        tag: frame.tag,
        classes: frame.classes,
      }));
      const allNode: ClassFacts = {
        tag: node.tag,
        classes: parsedBranches.all,
        position,
        ancestors: ancestorFacts,
      };
      const restingNode: ClassFacts = {
        tag: node.tag,
        classes: parsedBranches.resting,
        position,
        ancestors: ancestorFacts,
      };
      const branches = [
        parsedBranches.resting,
        ...parsedBranches.conditional.map((b) => [...parsedBranches.resting, ...b]),
      ];
      const pushDeduped = (
        ruleName: RuleName,
        check: (probe: ClassFacts) => readonly {
          messageId: string;
          data: Record<string, string>;
          remedy?: string;
          severity?: "error" | "warning";
        }[],
      ): void => {
        const seen = new Set<string>();
        for (const branch of branches) {
          for (const finding of check({ ...restingNode, classes: branch })) {
            const cls = finding.data["cls"];
            if (cls !== undefined && !seenAll.has(cls)) continue;
            const key = `${finding.messageId}:${JSON.stringify(finding.data)}`;
            if (seen.has(key)) continue;
            seen.add(key);
            pushFindings(out, filename, ruleName, position, [finding]);
          }
        }
      };
      if (run.rules.includes("closed-vocabulary") && parsedBranches.all.length > 0) {
        pushFindings(
          out,
          filename,
          "closed-vocabulary",
          position,
          checkClosedVocabulary(facts, allNode),
        );
      }
      if (run.rules.includes("no-redundant-class")) {
        pushFindings(
          out,
          filename,
          "no-redundant-class",
          position,
          checkNoRedundantClass(facts, restingNode, run.semantic).filter(
            (f) => f.data["cls"] === undefined || seenAll.has(f.data["cls"]),
          ),
        );
      }
      if (run.rules.includes("prefer-theme-value")) {
        const restingFindings = checkPreferThemeValue(
          facts,
          restingNode,
          run.semantic,
        ).filter((f) => f.data["cls"] === undefined || seenAll.has(f.data["cls"]));
        const seen = new Set(
          restingFindings.map((f) => `${f.messageId}:${JSON.stringify(f.data)}`),
        );
        pushFindings(out, filename, "prefer-theme-value", position, restingFindings);
        for (const branch of branches) {
          for (const clash of checkTypeStyleClashes(facts, { ...restingNode, classes: branch }, parsedBranches.resting)) {
            const cls = clash.data["cls"];
            if (cls !== undefined && !seenAll.has(cls)) continue;
            const key = `${clash.messageId}:${JSON.stringify(clash.data)}`;
            if (seen.has(key)) continue;
            seen.add(key);
            pushFindings(out, filename, "prefer-theme-value", position, [clash]);
          }
        }
      }
      if (run.rules.includes("prefer-element")) {
        pushFindings(
          out,
          filename,
          "prefer-element",
          position,
          checkPreferElement(facts, restingNode, run.semantic).filter(
            (f) => f.data["cls"] === undefined || seenAll.has(f.data["cls"]),
          ),
        );
      }
      if (run.rules.includes("no-unpaired-ink") && node.children.length > 0) {
        pushDeduped("no-unpaired-ink", (probe) =>
          checkNoUnpairedInk(facts, probe),
        );
      }
    }
    const frame: AncestorFrame = {
      tag: node.tag,
      classes: parsedBranches.resting,
    };
    ancestors.push(frame);
    for (const child of node.children) visit(child);
    ancestors.pop();
  };
  for (const node of ir.nodes) visit(node);
  return out;
}

/**
 * The regex fallback: the closed-vocabulary findings in text no parser
 * reads.
 *
 * A document or a fragment the component parser rejects still carries
 * `class="..."` lists worth checking — the same list whatever file it sits
 * in — so this reads the lists straight from the text and asks the core's
 * own decision. No positions inside the list: without a tree there are no
 * token offsets, so the findings carry no edit, and the author drops the
 * class by hand.
 */
function lintMarkupText(
  filename: string,
  code: string,
  run: RuleRun,
): Diagnostic[] {
  if (!run.rules.includes("closed-vocabulary")) return [];
  const meta = RULES["closed-vocabulary"].meta;
  const out: Diagnostic[] = [];
  const pattern = /class\s*=\s*("([^"]*)"|'([^']*)')/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(code)) !== null) {
    const list = match[2] ?? match[3] ?? "";
    const classes = list.split(/\s+/).filter(Boolean);
    if (classes.length === 0) continue;
    const position = positionOfSpan(code, match.index);
    for (
      const finding of checkClosedVocabulary(factsForFile(filename, run.answers), {
        tag: undefined,
        classes,
        position,
      })
    ) {
      const remedy = finding.remedy;
      out.push({
        file: filename,
        line: position.line,
        column: position.column,
        ruleId: "spin/closed-vocabulary",
        messageId: finding.messageId,
        message: renderMessage(meta, {
          messageId: finding.messageId,
          data: finding.data ?? {},
          position,
        }),
        ...(remedy === undefined ? {} : { remedy }),
        severity: finding.severity ??
          (meta.type === "problem" ? "error" : "warning"),
      });
    }
  }
  return out;
}

/**
 * The edits of a set of findings, applied to a source.
 *
 * The edits are applied from the end of the file backwards, so an edit's
 * offsets stay true as the text before them changes — and two edits that
 * overlap are not both applied: the first one wins, and the second is left
 * for the next run, because applying both would change the text neither one
 * was decided against.
 */
export function applyFixes(
  code: string,
  fixes: readonly TextEdit[],
): { code: string; applied: number } {
  const sorted = [...fixes].toSorted((a, b) => a.range[0] - b.range[0]);
  let out = "";
  let cursor = 0;
  let applied = 0;
  for (const fix of sorted) {
    if (fix.range[0] < cursor) continue;
    out += code.slice(cursor, fix.range[0]) + fix.text;
    cursor = fix.range[1];
    applied += 1;
  }
  return { code: out + code.slice(cursor), applied };
}
