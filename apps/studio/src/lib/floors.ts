/**
 * What a failing contrast floor can be cleared with.
 *
 * The theme module owns the floors and the measurement: it declares what a
 * role owes, it measures the pair, and it says what is wrong. What it does
 * not say is HOW to put it right — and a finding that names a ratio and a
 * floor and stops there leaves the author to solve a contrast problem by
 * hand, one guess at a time, with no way to tell a near miss from a wild
 * one.
 *
 * So this module answers the second half, in the theme module's own
 * vocabulary: the value the token would have to take to clear the floor
 * against that surface, and which way it has to move to get there. The
 * measurement is the module's (`contrastRatio`, `relativeLuminance`) and the
 * mixing is the module's (`mixColors`) — so the number the studio offers is
 * the number the module will measure again once the author applies it.
 *
 * The maths of a contrast ratio, in one line: a pair clears a floor when the
 * lighter of the two is at least `floor` times the darker, with a fifth of
 * the way in from black at each end. That makes the luminance a token has to
 * reach an answer rather than a search — a token that is darker than the
 * surface has to get darker still, and one that is lighter has to get
 * lighter, until it lands on the luminance the floor names.
 */

import {
  contrastRatio,
  indexTree,
  legibilityFloors,
  mixColors,
  parseTokens,
  relativeLuminance,
  resolveAliases,
  validateTheme,
} from "@spin/theme";

/** Which way a colour has to move to clear a floor. */
export type Direction = "darker" | "lighter";

/** The edit that clears a floor. */
export interface Remedy {
  /** The token to edit, as the path the author edits it by. */
  readonly path: string;
  /** The value it holds now. */
  readonly from: string;
  /** The value it would take. */
  readonly value: string;
  /** Which way it moves. */
  readonly direction: Direction;
  /** The ratio the value reaches against the surface. */
  readonly ratio: number;
  /** The surface it is measured on, as a path. */
  readonly bg: string;
}

/** A floor the document does not clear, and what would clear it. */
export interface FloorFinding {
  /** The token that fails, as a path. */
  readonly path: string;
  /** The token that fails, as the floor names it. */
  readonly fg: string;
  /** The surface it is read on, as a path. */
  readonly bg: string;
  /** The floor the pair owes. */
  readonly min: number;
  /** What the pair measures now. */
  readonly ratio: number;
  /** The edit that clears it. */
  readonly remedy: Remedy;
}

/**
 * The floors a document breaks, with the edit that clears each.
 *
 * The floors are the contract's own list and the measurement is the
 * contract's own function, so a finding here says what the module says. The
 * document is judged as it stands — the base values, which is what the
 * studio's own checks read — and a floor the document keeps is not a
 * finding at all.
 */
export function floorFindings(text: string): readonly FloorFinding[] {
  const parsed = parseTokens(text);
  if (!parsed.ok) return [];
  const index = indexTree(resolveAliases(parsed.tree).tree);
  const findings: FloorFinding[] = [];
  for (const floor of legibilityFloors()) {
    const fgValue = index.leaves[floor.fg]?.value;
    const bgValue = index.leaves[floor.bg]?.value;
    if (typeof fgValue !== "string" || typeof bgValue !== "string") continue;
    let ratio: number;
    try {
      ratio = contrastRatio(fgValue, bgValue);
    } catch {
      // A colour this package cannot read is the completeness gate's
      // business; there is no ratio to remedy.
      continue;
    }
    if (ratio >= floor.min) continue;
    const remedy = clearingValue(
      floor.fg,
      fgValue,
      floor.bg,
      bgValue,
      floor.min,
    );
    if (remedy === undefined) continue;
    findings.push({
      path: floor.fg,
      fg: floor.fg,
      bg: floor.bg,
      min: floor.min,
      ratio,
      remedy,
    });
  }
  return findings;
}

/**
 * The edit that clears a floor, or nothing when there is none.
 *
 * A pair fails when the lighter of the two is not `min` times the darker. So
 * the token has one of two destinations: a luminance dark enough to be the
 * darker of the pair, or one light enough to be the lighter. Which of the
 * two is nearer is the question, and it is answered in luminance — the
 * module's own measure of how bright a colour is — so the remedy is the
 * smallest move that clears the floor.
 */
function clearingValue(
  path: string,
  fg: string,
  bgPath: string,
  bg: string,
  min: number,
): Remedy | undefined {
  const fgLuminance = relativeLuminance(fg);
  const bgLuminance = relativeLuminance(bg);

  // The luminances that clear the floor, one on each side of the surface.
  const dark = (bgLuminance + 0.05) / min - 0.05;
  const light = min * (bgLuminance + 0.05) - 0.05;

  const moves: {
    readonly target: number;
    readonly toward: "black" | "white";
    readonly direction: Direction;
  }[] = [];
  // Darker: only a token that ends up below the surface counts, and only a
  // surface bright enough for black to clear it has a darker answer at all.
  if (dark >= 0 && dark <= bgLuminance && dark <= fgLuminance) {
    moves.push({ target: dark, toward: "black", direction: "darker" });
  }
  // Lighter: a token that ends up above the surface, which is always a
  // possible answer unless white itself falls short.
  if (light <= 1 && light >= fgLuminance) {
    moves.push({ target: light, toward: "white", direction: "lighter" });
  }
  if (moves.length === 0) return undefined;

  // The nearer move: the one that travels less far in luminance.
  moves.sort((a, b) =>
    Math.abs(a.target - fgLuminance) - Math.abs(b.target - fgLuminance)
  );
  const move = moves[0]!;

  const end = move.toward === "black" ? "#000000" : "#ffffff";
  const amount = amountAtLuminance(fg, end, move.target);
  let value = mixColors(fg, end, amount);
  let ratio = contrastRatio(value, bg);
  // The mix lands on eight bits a colour, and a hair short of the floor is
  // still short of it: step further the same way, which can only raise the
  // ratio.
  for (let step = 1; ratio < min && step <= 24; step++) {
    value = mixColors(fg, end, Math.min(1, amount + step * 0.01));
    ratio = contrastRatio(value, bg);
  }
  if (ratio < min) return undefined;

  return {
    path,
    from: fg,
    value,
    direction: move.direction,
    ratio,
    bg: bgPath,
  };
}

/**
 * How far along the way from a colour to an end its luminance reaches a
 * target.
 *
 * The luminance along the path is monotonic — every channel moves one way and
 * the luminance is a sum of them — so the amount is found by bisection rather
 * than by stepping.
 */
function amountAtLuminance(
  from: string,
  end: string,
  target: number,
): number {
  let low = 0;
  let high = 1;
  for (let step = 0; step < 48; step++) {
    const middle = (low + high) / 2;
    const luminance = relativeLuminance(mixColors(from, end, middle));
    if (end === "#000000" ? luminance > target : luminance < target) {
      low = middle;
    } else {
      high = middle;
    }
  }
  return high;
}

/**
 * What a remedy says, in a sentence.
 *
 * The finding names what is wrong; this names what to do about it: the
 * direction, the value, and the ratio the value reaches.
 */
export function remedyText(remedy: Remedy): string {
  const verb = remedy.direction === "darker" ? "Darken" : "Lighten";
  return `${verb} ${remedy.path} to ${remedy.value} — ${
    remedy.ratio.toFixed(2)
  }:1 on ${remedy.bg}.`;
}

/** One thing the checks found about a document. */
export interface Check {
  /** The token the finding is about, as the path an author edits it by. */
  readonly path: string;
  /** What the theme module says is wrong. */
  readonly message: string;
  /** What would put it right, when the finding is a floor. */
  readonly remedy: Remedy | undefined;
}

/**
 * What the checks found about a document, and what to do about each.
 *
 * The findings are the theme module's — it owns the roles a theme owes, the
 * values it must declare and the floors those values must clear, and the
 * studio asks it rather than judging a theme of its own. What the studio
 * adds is the second half of a finding: the edit that clears it, so the
 * panel can offer the fix rather than only describe the failure.
 *
 * A finding carries its path either way, because the path is what an author
 * edits by — it is how the panel links to the token's editor, and how the
 * remedy knows where to write.
 */
export function checks(text: string): readonly Check[] {
  const report = validateTheme(text);
  const remedies = new Map(
    floorFindings(text).map((finding) => [finding.path, finding.remedy]),
  );
  const issues = [
    ...(report.error === undefined
      ? []
      : [{ path: "", message: report.error }]),
    ...report.issues,
  ];
  return issues.map((issue) => ({
    path: issue.path,
    message: issue.message,
    remedy: remedies.get(issue.path),
  }));
}
