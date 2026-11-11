/**
 * The battery: every mechanical gate a theme document is held to.
 *
 * A theme is judged in one place, so the answer is the same whoever asks —
 * the studio's issues panel, the daemon's analysis, an agent following the
 * house skill, and this package's own tests. The battery IS that place: it
 * takes a document and answers with what is wrong with it, gate by gate.
 *
 * The gates, and what each one is about:
 *
 * - **completeness** — the document declares what it owes, and every value
 *   is one a browser will accept.
 * - **legibility** — every floor the contract declares holds, in every mode
 *   the theme serves. A fill without a readable foreground is an error.
 * - **scales** — the scales are ladders: a spacing step that goes down, or a
 *   radius ladder that descends, is a scale with no shape.
 * - **motion** — the loop holds the strobe floor. An endless animation under
 *   the floor is a defect, not a character choice.
 * - **modes** — every mode a theme serves is a mode it has. A theme that
 *   serves a dark mode and restates nothing for it renders the light mode
 *   twice, which is a promise nothing keeps.
 * - **invariance** — a mode changes ink and focus, and nothing else. The
 *   scales and the loop are judged once, on the base document, so a mode that
 *   restates them is a second set of scales nobody checked.
 *
 * The battery is runnable against ANY document — a starter, a project's own
 * theme, a half-written file in an editor — because that is what the house
 * skill tells an author to do: the gates are the battery's entry points, and
 * the battery does not care where the document came from.
 */

import { parseDocument } from "../pipeline/parse.ts";
import { indexTree, resolveAliases } from "../pipeline/resolve.ts";
import type { TokenIndex } from "../pipeline/resolve.ts";
import type {
  TokenLeaf,
  TokenTree,
  ValidationIssue,
} from "../pipeline/types.ts";
import { validateTokens } from "../pipeline/validate.ts";
import { isColor, relativeLuminance } from "../pipeline/color.ts";
import { type Mode, treeInMode } from "../modes.ts";
import { LOOP_DURATION, LOOP_FALLBACK, STROBE_FLOOR_MS } from "./motion.ts";
import { requiredPaths } from "./roles.ts";
import { validateLegibility, validateStateLegibility } from "./schema.ts";

/** The gates the battery runs, in the order the skill lists them. */
export const GATES = [
  "completeness",
  "legibility",
  "scales",
  "motion",
  "modes",
  "invariance",
] as const;

/** The name of one gate. */
export type GateName = (typeof GATES)[number];

/** What one gate found. */
export interface GateResult {
  /** The gate's name, as the skill names it. */
  readonly gate: GateName;
  /** Everything the gate found, in the module's own words. */
  readonly issues: readonly ValidationIssue[];
}

/** What the battery found, gate by gate. */
export interface BatteryReport {
  /** One entry per gate, in the order the gates run. */
  readonly gates: readonly GateResult[];
  /** Every issue the battery found, gates in order. */
  readonly issues: readonly ValidationIssue[];
  /** Whether the document owes nothing. */
  readonly valid: boolean;
}

/** What a caller may state about the document it is judging. */
export interface BatteryOptions {
  /**
   * The dotted paths the document must declare.
   *
   * Absent: the base roles — the palette, the contrast floors that make the
   * palette usable, and the focus ring every interactive element shares.
   * Composed documents are judged with this default; fragments are judged
   * with `required: []` — a layer is read for what it says, never for what
   * the parent beside it already declares.
   */
  readonly required?: readonly string[];

  /**
   * The modes the document SERVES.
   *
   * A claim, and only a claim: a value written for a mode the theme does not
   * serve is never shown, so the declaration is a promise nothing keeps.
   * Absent: the document's own root `modes` field is read.
   */
  readonly modes?: readonly Mode[];

  /**
   * The mode to judge the document IN.
   *
   * Absent: every mode the document serves, and the document's own base
   * values. A theme is a different document in dark, so a floor that holds in
   * the base may not hold there — and the dark palette is where palettes
   * quietly fail.
   */
  readonly mode?: Mode;
}

/**
 * The battery, over one document.
 *
 * The report is per gate, so a caller can say which gate a failure belongs
 * to: the skill's gates are the battery's gates, and an author reading
 * "the loop is a strobe" should not have to work out which check said so.
 */
export function themeGates(
  text: string,
  options: BatteryOptions = {},
): BatteryReport {
  const parsed = parseDocument(text);
  if (!parsed.ok) {
    // A document that does not parse has no gates to run: the parse error is
    // the finding, and it is reported once, under completeness.
    const issue: ValidationIssue = { path: "", message: parsed.error };
    return {
      gates: GATES.map((gate) => ({
        gate,
        issues: gate === "completeness" ? [issue] : [],
      })),
      issues: [issue],
      valid: false,
    };
  }

  const served = options.modes ?? [...(parsed.modes ?? [])];
  const judged = judgedModes(parsed.tree, served, options.mode);

  const gates: GateResult[] = [
    {
      gate: "completeness",
      issues: validateTokens(parsed.tree, {
        required: options.required ?? requiredPaths(),
        ...(served.length > 0 ? { modes: served } : {}),
      }).issues,
    },
    { gate: "legibility", issues: legibilityIssues(parsed.tree, judged) },
    { gate: "scales", issues: scaleIssues(parsed.tree) },
    { gate: "motion", issues: motionIssues(parsed.tree) },
    { gate: "modes", issues: modeIssues(parsed.tree, served) },
    { gate: "invariance", issues: invarianceIssues(parsed.tree) },
  ];
  const issues = gates.flatMap((gate) => gate.issues);
  return { gates, issues, valid: issues.length === 0 };
}

/**
 * One gate, over one document.
 *
 * The single-gate form, for a caller that wants one answer: the studio's
 * issue panel shows the legibility gate, a script wants the motion gate, and
 * neither wants to filter a whole report to get it.
 */
export function themeGate(
  gate: GateName,
  text: string,
  options: BatteryOptions = {},
): GateResult {
  const report = themeGates(text, options);
  return report.gates.find((entry) => entry.gate === gate) ?? {
    gate,
    issues: [],
  };
}

/* ------------------------------------------------------------------ helpers -- */

/**
 * The modes a document is judged in.
 *
 * The base is always judged — it is what a reader sees before any mode is
 * asked for — and every served mode that the document actually varies. A
 * served mode the document does not vary renders as the base, so judging it
 * again would measure the same rendering twice.
 */
function judgedModes(
  tree: TokenTree,
  served: readonly Mode[],
  only: Mode | undefined,
): readonly string[] {
  if (only !== undefined) return [only];
  const modes = ["base"];
  for (const mode of served) {
    if (!variesIn(tree, mode)) continue;
    modes.push(mode);
  }
  return modes;
}

/** Whether any leaf carries a value for the mode. */
function variesIn(tree: TokenTree, mode: string): boolean {
  return leavesOf(tree).some((leaf) => leaf.modes?.[mode] !== undefined);
}

/** Every leaf in a tree, depth-first. */
function leavesOf(tree: TokenTree): TokenLeaf[] {
  const out: TokenLeaf[] = [];
  const walk = (node: TokenTree[number]): void => {
    if (node.kind === "token") {
      out.push(node);
      return;
    }
    for (const child of node.children) walk(child);
  };
  for (const node of tree) walk(node);
  return out;
}

/** The document's leaves as they read in one mode, aliases followed. */
function resolvedIn(tree: TokenTree, mode: string): TokenIndex {
  const wearing = mode === "base" ? tree : treeInMode(tree, mode);
  return indexTree(resolveAliases(wearing).tree);
}

/* ------------------------------------------------------------------- gates -- */

/**
 * The legibility gate: every floor the contract declares, in every mode.
 *
 * The floors are the contract's own list, so the gate and the contract cannot
 * disagree about what a theme owes. A mode is judged with the values it
 * wears: the dark palette's own fills and inks, not the light ones.
 */
function legibilityIssues(
  tree: TokenTree,
  judged: readonly string[],
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const mode of judged) {
    for (const issue of validateLegibility(treeFor(tree, mode))) {
      issues.push({ ...issue, message: `${mode}: ${issue.message}` });
    }
    for (const issue of validateStateLegibility(treeFor(tree, mode))) {
      issues.push({ ...issue, message: `${mode}: ${issue.message}` });
    }
  }
  return issues;
}

/** The tree as it reads in one mode — the base when the mode is the base. */
function treeFor(tree: TokenTree, mode: string): TokenTree {
  return mode === "base" ? tree : treeInMode(tree, mode);
}

/**
 * The scales gate: the ladders are ladders.
 *
 * A scale is a set of steps, and the steps have to grow. A spacing scale
 * whose fourth step is smaller than its third has no rhythm to spend, and a
 * radius ladder that descends reads as a mistake rather than a character.
 *
 * The elevation ladder is checked by weight — how far a shadow moves the
 * sheet — and two steps may spell the same weight only where the tied step
 * declares no elevation at all: a theme that separates with air and hairlines
 * says `none` twice on purpose, and a theme that spends one shadow under two
 * names does not.
 *
 * The scales are judged once, on the base document: a mode changes ink and
 * surface, not space and type, so there is no second ladder to read.
 */
function scaleIssues(tree: TokenTree): ValidationIssue[] {
  const index = resolvedIn(tree, "base");
  return [
    ...ladderIssues(index, "spacing", spacingOrder),
    ...ladderIssues(index, "radius", radiusOrder),
    ...elevationIssues(index),
  ];
}

/** The canonical order of the radius steps, smallest first. */
const RADIUS_ORDER = ["none", "sm", "md", "lg", "full"] as const;

/**
 * The order of the radius steps: the ladder's own names.
 *
 * A radius step is named for how round it is, so the names are the order.
 * A step the ladder does not name — a theme's own extra step — is left out
 * rather than guessed at.
 */
function radiusOrder(steps: readonly string[]): readonly string[] {
  return RADIUS_ORDER.filter((step) => steps.includes(step));
}

/**
 * The order of the spacing steps: by their number.
 *
 * A spacing step is named by the number it stands for, because that is the
 * name the utilities spend (`p-4` is `spacing.4`), so the number is the step's
 * order. A step named something else cannot be spent and cannot be ordered,
 * so it is left out of the ladder rather than guessed at.
 */
function spacingOrder(steps: readonly string[]): readonly string[] {
  return steps
    .filter((step) => /^\d+$/.test(step))
    .sort((a, b) => Number(a) - Number(b));
}

/** One ladder's steps, in the order the ladder reads. */
function ladderIssues(
  index: TokenIndex,
  group: string,
  order: (steps: readonly string[]) => readonly string[],
): ValidationIssue[] {
  const steps = Object.keys(index.leaves)
    .filter((path) => path.startsWith(`${group}.`))
    .map((path) => path.slice(group.length + 1));
  const issues: ValidationIssue[] = [];
  let previous: { step: string; value: number; text: string } | undefined;
  for (const step of order(steps)) {
    const leaf = index.leaves[`${group}.${step}`];
    if (leaf === undefined) continue;
    const value = lengthOf(leaf.value);
    if (value === undefined) continue;
    if (previous !== undefined && value < previous.value) {
      issues.push({
        path: `${group}.${step}`,
        message:
          `the ${group} ladder descends: ${group}.${previous.step} is ${previous.text} and ${group}.${step} is ${leaf.value}`,
      });
    }
    previous = { step, value, text: String(leaf.value) };
  }
  return issues;
}

/**
 * A length as a number of pixels, so two steps of one ladder can be
 * compared.
 *
 * `rem` and `em` are read at the root's font size — sixteen pixels, the
 * browser's default — so a ladder written in rems and a ladder written in
 * pixels are both measured on the same scale.
 */
function lengthOf(value: unknown): number | undefined {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value !== "string") return undefined;
  const match = /^(-?\d*\.?\d+)(rem|px|em)?$/.exec(value.trim());
  if (match === null) return undefined;
  const amount = Number(match[1]);
  const unit = match[2] ?? "px";
  return unit === "px" ? amount : amount * 16;
}

/**
 * The elevation ladder: the steps do not get quieter as they go up, and no
 * two steps spell one elevation under two names.
 */
function elevationIssues(index: TokenIndex): ValidationIssue[] {
  const steps = ["sm", "md", "lg"];
  const values = steps.map((step) => index.leaves[`shadow.${step}`]?.value);
  const issues: ValidationIssue[] = [];
  let previous: { step: string; weight: number; value: string } | undefined;
  for (let at = 0; at < steps.length; at++) {
    const step = steps[at] as string;
    const raw = values[at];
    if (typeof raw !== "string") continue;
    const weight = shadowWeight(raw);
    if (previous !== undefined) {
      if (previous.weight > weight) {
        issues.push({
          path: `shadow.${step}`,
          message:
            `the elevation ladder descends: shadow.${previous.step} weighs ${previous.weight} and shadow.${step} weighs ${weight}`,
        });
      } else if (
        previous.weight === weight && previous.value.trim() !== "none"
      ) {
        issues.push({
          path: `shadow.${step}`,
          message:
            `shadow.${previous.step} and shadow.${step} are one elevation under two names`,
        });
      }
    }
    previous = { step, weight, value: raw };
  }
  return issues;
}

/** A shadow's weight: the px lengths it moves, summed. `none` weighs nothing. */
function shadowWeight(value: string): number {
  let total = 0;
  for (const [, length] of value.matchAll(/(-?\d*\.?\d+)px/g)) {
    total += Math.abs(Number(length));
  }
  return total;
}

/**
 * The motion gate: the loop holds the strobe floor.
 *
 * The loop is `motion.duration.loop`, the step every endless animation
 * spends. A theme that declares no loop of its own falls back to its
 * slowest transition, so that is what the floor is measured on — the rule
 * follows the animation, not the name.
 *
 * The loop is judged once, on the base document: a mode changes ink and
 * surface, not the pace of time.
 */
function motionIssues(tree: TokenTree): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const index = resolvedIn(tree, "base");
  const loop = index.leaves[LOOP_DURATION];
  const fallback = index.leaves[LOOP_FALLBACK];
  const source = loop ?? fallback;
  if (source === undefined) return issues;
  const value = source.value;
  if (typeof value !== "string") return issues;
  const ms = durationMs(value);
  if (ms === undefined) {
    issues.push({
      path: source.path.join("."),
      message: `the loop duration must be a duration, got ${
        JSON.stringify(value)
      }`,
    });
    return issues;
  }
  if (ms < STROBE_FLOOR_MS) {
    issues.push({
      path: source.path.join("."),
      message: `a ${ms}ms loop is a strobe; the floor is ${STROBE_FLOOR_MS}ms`,
    });
  }
  return issues;
}

/** A CSS duration as milliseconds, or undefined when it is not a duration. */
function durationMs(value: string): number | undefined {
  const match = /^(\d*\.?\d+)(ms|s)$/.exec(value.trim());
  if (match === null) return undefined;
  const amount = Number(match[1]);
  return match[2] === "s" ? amount * 1000 : amount;
}

/**
 * The modes gate: every mode a theme serves is one it has.
 *
 * A theme that serves a mode it never restates renders the base twice. That
 * is right for a theme whose base IS that mode — a terminal palette serves
 * dark and has nothing to restate — and wrong for every other theme: the
 * reader asks for the dark mode and gets the light one, which is a promise
 * nothing keeps.
 *
 * The test is whether the base already reads as the mode: a page whose
 * surface is darker than its ink is already a dark page.
 */
function modeIssues(
  tree: TokenTree,
  served: readonly Mode[],
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (served.length === 0) return issues;
  const index = resolvedIn(tree, "base");
  for (const mode of served) {
    if (variesIn(tree, mode)) continue;
    if (baseReadsAs(index, mode)) continue;
    issues.push({
      path: "modes",
      message:
        `the theme serves "${mode}" but restates nothing for it, so the ${mode} mode is the base rendering`,
    });
  }
  return issues;
}

/** Whether the base rendering already reads as the mode. */
function baseReadsAs(index: TokenIndex, mode: Mode): boolean {
  const surface = index.leaves["color.surface"]?.value;
  const ink = index.leaves["color.text"]?.value;
  if (typeof surface !== "string" || typeof ink !== "string") return true;
  let surfaceLuminance: number;
  let inkLuminance: number;
  try {
    surfaceLuminance = relativeLuminance(surface);
    inkLuminance = relativeLuminance(ink);
  } catch {
    // A colour this package cannot read is the completeness gate's business.
    return true;
  }
  return mode === "dark"
    ? surfaceLuminance < inkLuminance
    : surfaceLuminance > inkLuminance;
}

/**
 * The invariance gate: a mode changes ink and focus, and nothing else.
 *
 * A mode is a variant of a token, and the variant is a change of INK: the
 * page goes dark, the ink goes light, the focus ring follows. Everything
 * else — the spacing, the type scale, the radius, the loop — is the theme's
 * one decision, and the battery judges it once, on the base document. A mode
 * that restates them is a second set of decisions that nobody measured: a
 * dark mode with its own spacing is a layout the scales gate never saw.
 *
 * So the rule is about WHAT a mode may change, not which group a token
 * happens to sit in. Two things are allowed:
 *
 * - the focus ring, whose width and offset are lengths and not ink, and
 * - an INK: a colour, or a colour with a blur — a shadow, whose offsets and
 *   blur are the theme's decision and whose colour follows the surface.
 *
 * A restatement that changes nothing is not a change: a theme that restates
 * `primary` as itself in dark has said nothing, and the gate says nothing
 * about it.
 */
function invarianceIssues(tree: TokenTree): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const before = indexTree(resolveAliases(tree).tree);
  for (const mode of modesIn(tree)) {
    const resolved = indexTree(resolveAliases(treeInMode(tree, mode)).tree);
    for (const leaf of leavesOf(tree)) {
      const override = leaf.modes?.[mode];
      if (override === undefined) continue;
      const path = leaf.path.join(".");
      const value = resolved.leaves[path]?.value;
      // A restatement that changes nothing is not a change.
      if (value === before.leaves[path]?.value) continue;
      // The focus ring: the one thing besides the ink a mode may restate.
      if (leaf.path[0] === "focus") continue;
      if (isInk(value)) continue;
      issues.push({
        path,
        message:
          `the ${mode} mode restates ${path}, and a mode changes ink and focus, not ${
            leaf.path[0]
          }`,
      });
    }
  }
  return issues;
}

/** Every mode a document says anything about. */
function modesIn(tree: TokenTree): readonly string[] {
  const out = new Set<string>();
  for (const leaf of leavesOf(tree)) {
    for (const mode of Object.keys(leaf.modes ?? {})) out.add(mode);
  }
  return [...out];
}

/**
 * Whether a value is an ink: a colour, or a colour with a blur.
 *
 * A shadow is the awkward one: the offsets and the blur are the theme's
 * decision and the colour inside it is the mode's, so a shadow whose ink
 * follows the surface is still colour. The geometry is not checked here —
 * what a mode may change is the ink, and the ink is what this reads.
 */
function isInk(value: unknown): boolean {
  if (typeof value !== "string") return false;
  if (isColor(value)) return true;
  return /\b(?:rgb|rgba|oklch|oklab|hsla?|color)\(|#[0-9a-f]{3,8}\b|var\(--color-/i
    .test(value);
}
