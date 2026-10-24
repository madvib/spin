/**
 * The live edit's arithmetic.
 *
 * Three facts a control needs while an author is dragging it:
 *
 * - **How far along the value is.** The browser knows it — it is the value
 *   the input holds — and CSS cannot read it, so the sheet cannot paint the
 *   fill that says it. The control asks for the share of the travel and
 *   hands it to the sheet as a custom property.
 * - **What the theme declares behind the value being edited.** The document
 *   the studio edits is the author's; the project holds the document the
 *   theme declares, and a reset puts the token back to that.
 * - **Whether the value the gesture proposes may land at all.** The theme
 *   module owns the token language and the rules a document must obey, so
 *   the question "does this document still build?" belongs to it — and the
 *   answer is the same one the stylesheet generator will give.
 *
 * Pure, so all three can be tested without a window: a gesture is a gesture
 * whether or not a browser is watching it.
 */

import {
  aliasTarget,
  contrastRatio,
  indexTree,
  legibilityFloors,
  parseTokens,
  resolveAliases,
  validateTheme,
  validateTokens,
  valuesInMode,
} from "@spinjs/theme";
import type { ValidationIssue } from "@spinjs/theme";
import { isCompositeType, parseComposite } from "./tokens.ts";
import type { Composite } from "./tokens.ts";

/**
 * The share of a track's travel a value has covered, as a percentage.
 *
 * The browser maps the track's bounds onto the travel between the two ends
 * of the groove, so the share is the value's place between the bounds — and
 * the fill the groove paints stops where the thumb is.
 *
 * A track with no travel has no share: the answer is no fill, not a
 * division by nothing. A value outside the bounds is clamped to it, because
 * a fill that runs past the end of the groove is a fill that says something
 * the value does not.
 */
export function rangeProgress(
  value: number,
  min: number,
  max: number,
): string {
  if (!Number.isFinite(value)) return "0%";
  if (!Number.isFinite(min) || !Number.isFinite(max)) return "0%";
  const span = max - min;
  if (span <= 0) return "0%";
  const share = (value - min) / span;
  const clamped = Math.min(1, Math.max(0, share));
  return `${Math.round(clamped * 10_000) / 100}%`;
}

/**
 * The value a document declares for a token, in one mode.
 *
 * The document is read as it stands, so a reset has something to put back.
 * A mode is part of the question: a token may declare a different value in
 * dark, and the value the reset puts back is the one the author is looking
 * at.
 *
 * A document that cannot be read declares nothing: the answer is absent,
 * and a reset with nothing to put back is a reset that stays inert.
 */
export function declaredValue(
  text: string,
  path: string,
  mode: string,
): string | undefined {
  const parsed = parseTokens(text);
  if (!parsed.ok) return undefined;
  const value = valuesInMode(parsed.tree, mode).get(path);
  if (value === undefined || value === null) return undefined;
  return typeof value === "string" ? value : String(value);
}

/**
 * The token a control edits, named by the control.
 *
 * A control is given the token's path as its label, and the row that holds
 * it names the control after the path as well — `token-icon.md` for
 * `icon.md`. Either names the token; a control named for nothing says
 * nothing, and answers that it edits no token at all.
 */
export function tokenPath(
  id: string | undefined,
  label: string | undefined,
): string | undefined {
  if (label !== undefined && label !== "") return label;
  if (id === undefined) return undefined;
  const prefix = "token-";
  return id.startsWith(prefix) ? id.slice(prefix.length) : undefined;
}

/**
 * What is happening to one token in the active mode: its raw spelling in the
 * document, whether that spelling is an alias to another token, whether dark
 * mode restates it, and whether the session has moved it from the project's
 * declared value.
 */
export interface TokenStatus {
  readonly raw: string | undefined;
  readonly aliasOf: string | undefined;
  readonly restatedInDark: boolean;
  readonly modified: boolean;
}

export function tokenStatus(
  currentText: string,
  projectText: string | undefined,
  path: string,
  mode: string,
): TokenStatus {
  const current = declaredValue(currentText, path, mode);
  const declared = projectText === undefined
    ? current
    : declaredValue(projectText, path, mode);
  let restatedInDark = false;
  if (mode === "dark") {
    try {
      const doc = JSON.parse(currentText) as Record<string, unknown>;
      let node: unknown = doc;
      for (const segment of path.split(".")) {
        if (typeof node !== "object" || node === null) {
          node = undefined;
          break;
        }
        node = (node as Record<string, unknown>)[segment];
      }
      if (typeof node === "object" && node !== null && "$modes" in node) {
        const modes = (node as { $modes?: Record<string, unknown> }).$modes;
        restatedInDark = modes !== undefined && modes["dark"] !== undefined;
      }
    } catch {
      restatedInDark = false;
    }
  }
  const target = current !== undefined ? aliasTarget(current) : null;
  return {
    raw: current,
    aliasOf: target ?? undefined,
    restatedInDark,
    modified: current !== declared,
  };
}

/**
 * Every problem the theme module finds in a document.
 *
 * The module's own judgement, asked exactly as the build asks it: the roles
 * a document owes, the values it may hold, and the floors those values must
 * clear. The studio does not judge a theme of its own — a second judge is a
 * second answer, and the day the two disagree the studio would be the one
 * lying.
 *
 * A document that does not parse is one problem, and it is at no token:
 * there is no token to point at when there is no document.
 */
function problemsOf(text: string): readonly ValidationIssue[] {
  const report = validateTheme(text);
  if (report.error !== undefined) {
    return [{ path: "", message: report.error }];
  }
  return report.issues;
}

/**
 * A refusal: what is wrong, and the token it is about.
 */
export interface Refusal {
  /** The token the refusal is about, as the path an author edits it by. */
  readonly path: string;
  /** What is wrong, in the theme module's own words. */
  readonly message: string;
}

/**
 * The theme module's own judgement of a value, as the token of its type.
 *
 * A composite's parts are values of the theme's own types — a border's
 * width is a dimension, its colour a colour, a typography's size a
 * dimension — and the theme module owns the rule for each. So a part is
 * judged by asking the module to judge a document that holds it, and the
 * answer is the module's words rather than a rule written here.
 *
 * A reference is not a value to judge: it is a pointer at another token,
 * and the theme resolves those where it resolves them.
 */
function partIssue(type: string, value: string): string | undefined {
  if (value === "") return undefined;
  if (aliasTarget(value) !== null) return undefined;
  const parsed = parseTokens(JSON.stringify({
    probe: { $type: type, $value: value },
  }));
  if (!parsed.ok) return parsed.error;
  const report = validateTokens(parsed.tree);
  return report.issues[0]?.message;
}

/**
 * The role a composite's colour wears.
 *
 * The theme's floors are declared on roles — a role is read on a surface
 * and owes a ratio — and a composite is not a role. So a composite's
 * colour says which role it wears by its own name: a composite at
 * `border.focus-ring` wears the floor `color.focus-ring` owes, because it
 * is that edge the theme drew. A composite whose name names no role owes
 * none, and the studio says so rather than inventing a floor.
 */
function roleOf(path: string): string {
  return `color.${path.split(".").pop() ?? ""}`;
}

/**
 * The colours a composite carries, one per part that holds one.
 */
function colorsOf(composite: Composite): readonly string[] {
  if (composite.type === "border") return [composite.color];
  if (composite.type === "gradient") {
    return composite.stops.map((stop) => stop.color);
  }
  return [];
}

/**
 * Why a composite's part may not land.
 *
 * Two questions, and both are the theme module's:
 *
 * - **Is the part a value the type accepts?** A width that lost its unit
 *   and a colour the browser cannot read are the theme's rules, so the
 *   module is asked about each part as a token of its own type.
 * - **Does the part's colour clear the floor it owes?** The floors are
 *   declared on roles and measured by the module, so the measurement is
 *   the module's too.
 *
 * The answer is a sentence in the module's words, because the module is
 * what the build will say.
 */
function compositeIssue(
  text: string,
  path: string,
  composite: Composite,
): string | undefined {
  const parts: readonly { type: string; value: string }[] =
    composite.type === "typography"
      ? [
        { type: "fontFamily", value: composite.family },
        { type: "dimension", value: composite.size },
        { type: "fontWeight", value: composite.weight },
        { type: "dimension", value: composite.tracking },
      ]
      : composite.type === "border"
      ? [
        { type: "dimension", value: composite.width },
        { type: "strokeStyle", value: composite.style },
        { type: "color", value: composite.color },
      ]
      : composite.type === "transition"
      ? [
        { type: "duration", value: composite.duration },
        { type: "cubicBezier", value: composite.easing },
        { type: "duration", value: composite.delay },
      ]
      : [
        { type: "color", value: composite.stops[0]?.color ?? "" },
        { type: "color", value: composite.stops[1]?.color ?? "" },
      ];
  for (const part of parts) {
    const issue = partIssue(part.type, part.value);
    if (issue !== undefined) return issue;
  }
  return floorIssue(text, path, composite);
}

/**
 * The floor a composite's colour owes, measured by the theme module.
 */
function floorIssue(
  text: string,
  path: string,
  composite: Composite,
): string | undefined {
  const role = roleOf(path);
  const floors = legibilityFloors().filter((floor) => floor.fg === role);
  if (floors.length === 0) return undefined;
  const parsed = parseTokens(text);
  if (!parsed.ok) return undefined;
  const index = indexTree(resolveAliases(parsed.tree).tree);
  const colors = colorsOf(composite).filter((color) => color !== "");
  if (colors.length === 0) return undefined;
  for (const floor of floors) {
    const surface = index.leaves[floor.bg]?.value;
    if (typeof surface !== "string") continue;
    for (const color of colors) {
      let ratio: number;
      try {
        ratio = contrastRatio(color, surface);
      } catch {
        // A colour the module cannot read is the completeness gate's
        // business, and the part rule has already said so.
        continue;
      }
      if (ratio < floor.min) {
        return `${role} on ${floor.bg} is ${
          ratio.toFixed(2)
        }:1, below the ${floor.min}:1 floor`;
      }
    }
  }
  return undefined;
}

/**
 * Why a composite the author is holding may not land.
 *
 * The document's own problems are the build's business; this is the other
 * half — a composite is more than one value, and each of its values is
 * judged by the theme module's own rule, so a composite that would not
 * build is refused in the module's words.
 */
function compositeRefusal(
  text: string,
  touched: readonly string[],
): Refusal | undefined {
  const parsed = parseTokens(text);
  if (!parsed.ok) return undefined;
  const index = indexTree(parsed.tree);
  for (const path of touched) {
    const leaf = index.leaves[path];
    if (leaf === undefined) continue;
    if (!isCompositeType(leaf.type)) continue;
    if (typeof leaf.value !== "string") continue;
    const composite = parseComposite(leaf.type, leaf.value);
    if (composite === undefined) continue;
    const message = compositeIssue(text, path, composite);
    if (message !== undefined) return { path, message };
  }
  return undefined;
}

/** A problem, read as a sentence: the token first, then what is wrong. */
function said(issue: ValidationIssue): string {
  return issue.path === "" ? issue.message : `${issue.path}: ${issue.message}`;
}

/**
 * Why an edit may not land.
 *
 * The gate is the build's own gate: the theme module's judgement of the
 * proposed document, which is the judgement the stylesheet is generated
 * from. Two rules, and both are about the EDIT rather than the document:
 *
 * - the proposal may not carry a problem the document did not have, so a
 *   value that would not build never lands in the document; and
 * - it may not leave the token the author is holding broken, so a token
 *   that is already wrong is repaired rather than made worse.
 *
 * A document that is broken somewhere ELSE stays editable: the studio is
 * where a broken theme is repaired, and a gate that refused every edit to a
 * broken document would make the repair impossible.
 *
 * The refusal names the token it is about, so the message can be shown
 * where the value is shown — next to the value, not in a console.
 */
export function editRefusal(
  before: string,
  after: string,
  touched: readonly string[] = [],
): Refusal | undefined {
  // The composite under the pointer comes first: it is the value the
  // author is holding, and each of its parts is judged by the theme
  // module's own rule.
  const composite = compositeRefusal(after, touched);
  if (composite !== undefined) return composite;
  const held = new Set(problemsOf(before).map((issue) => issue.path));
  const paths = new Set(touched);
  const introduced = problemsOf(after).filter((issue) =>
    !held.has(issue.path) || paths.has(issue.path)
  );
  if (introduced.length === 0) return undefined;
  // The token under the pointer comes first: it is the one the author can
  // act on, and the one the value they are holding belongs to.
  const issue = introduced.find((candidate) => paths.has(candidate.path)) ??
    introduced[0]!;
  return { path: issue.path, message: said(issue) };
}

/**
 * Why a document does not build, when it does not.
 *
 * The same judgement, asked of the document as it stands: every problem it
 * has, in the module's words. A document that builds has nothing to say.
 */
export function documentFailure(text: string): string | undefined {
  const problems = problemsOf(text);
  if (problems.length === 0) return undefined;
  return problems.map(said).join("; ");
}
