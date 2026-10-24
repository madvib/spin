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

import { parseForESLint } from "@typescript-eslint/parser";
import {
  type AttrValue,
  classTokensOf,
  type ComponentIr,
  expandVariantGroups,
  type Node as SyntaxNode,
  parse,
} from "@spinjs/runtime";
import {
  type AncestorFacts,
  checkClosedVocabulary,
  checkNoRedundantClass,
  checkNoUnpairedInk,
  checkPreferElement,
  checkPreferThemeValue,
  type ClassFacts,
  type Position,
  type SemanticOptions,
  type TextEdit,
} from "./core.ts";
import { factsForFile } from "./provider.ts";
import {
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
}

/**
 * The tree of a file, as the rules read it.
 *
 * The parser is the one thing the engine needs that a linter brings with
 * it. It reads TypeScript and JavaScript, JSX included, and hands over the
 * same ESTree shape ESLint's own parser produces — which is why the
 * findings land on the same lines and columns a linter's do.
 */
export function parseFile(code: string, filename: string): WalkNode {
  const parsed = parseForESLint(code, { filePath: filename });
  return parsed.ast as unknown as WalkNode;
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
): Diagnostic[] {
  const findings: Diagnostic[] = [];
  const visitors = new Map<string, ((node: GateNode) => void)[]>();

  for (const name of run.rules) {
    const rule = RULES[name];
    const context: GateContext = {
      filename,
      options: [run.semantic],
      report(descriptor) {
        const fix = descriptor.fix?.();
        const position = {
          line: descriptor.node.loc?.start.line ?? 0,
          column: descriptor.node.loc?.start.column ?? 0,
        };
        // The remedy is the rule's own sentence about what to do: a rule
        // that says what is wrong and what to do about it says both in the
        // same vocabulary.
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
          severity: rule.meta.type === "problem" ? "error" : "warning",
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
export function lintMarkup(
  filename: string,
  code: string,
  run: RuleRun,
): Diagnostic[] {
  const stripped = expandVariantGroups(
    code
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/<script(\s[^>]*)?>[\s\S]*?<\/script>\s*/g, "")
      .replace(/<scope>[\s\S]*?<\/scope>\s*/g, ""),
  );
  try {
    return lintComponentIr(filename, stripped, code, run);
  } catch {
    // Not a component (a document, a fragment the parser rejects): the text
    // walk below sees what it can.
    return lintMarkupText(filename, code, run);
  }
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
      severity: meta.type === "problem" ? "error" : "warning",
    });
  }
}

/** Walk a component IR, asking every enabled rule at each element. */
function lintComponentIr(
  filename: string,
  stripped: string,
  code: string,
  run: RuleRun,
): Diagnostic[] {
  const ir: ComponentIr = parse(stripped);
  const facts = factsForFile(filename);
  const out: Diagnostic[] = [];
  const ancestors: AncestorFrame[] = [];
  const visit = (node: SyntaxNode): void => {
    if (node.kind === "text") return;
    if (node.kind === "for") {
      for (const child of node.body) visit(child);
      return;
    }
    const classAttr = node.attrs.find((attr) => attr.name === "class");
    if (classAttr !== undefined) {
      const classes = classTokensOf(classAttr.value as AttrValue);
      if (classes.length > 0) {
        const position = positionOfSpan(code, node.span.start);
        const factsNode: ClassFacts = {
          tag: node.tag,
          classes,
          position,
          ancestors: ancestors.map((frame): AncestorFacts => ({
            tag: frame.tag,
            classes: frame.classes,
          })),
        };
        if (run.rules.includes("closed-vocabulary")) {
          pushFindings(
            out,
            filename,
            "closed-vocabulary",
            position,
            checkClosedVocabulary(facts, factsNode),
          );
        }
        if (run.rules.includes("no-redundant-class")) {
          pushFindings(
            out,
            filename,
            "no-redundant-class",
            position,
            checkNoRedundantClass(facts, factsNode, run.semantic),
          );
        }
        if (run.rules.includes("prefer-theme-value")) {
          pushFindings(
            out,
            filename,
            "prefer-theme-value",
            position,
            checkPreferThemeValue(facts, factsNode, run.semantic),
          );
        }
        if (run.rules.includes("prefer-element")) {
          pushFindings(
            out,
            filename,
            "prefer-element",
            position,
            checkPreferElement(facts, factsNode, run.semantic),
          );
        }
        if (run.rules.includes("no-unpaired-ink")) {
          pushFindings(
            out,
            filename,
            "no-unpaired-ink",
            position,
            checkNoUnpairedInk(facts, factsNode),
          );
        }
      }
    }
    const frame: AncestorFrame = {
      tag: node.tag,
      classes: classAttr === undefined
        ? []
        : classTokensOf(classAttr.value as AttrValue),
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
      const finding of checkClosedVocabulary(factsForFile(filename), {
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
        severity: meta.type === "problem" ? "error" : "warning",
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
