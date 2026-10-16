/**
 * The numbers behind the motion surface.
 *
 * A duration and an easing are the two halves of a transition, and neither
 * reads as a number on the page: `400ms` beside `150ms` means nothing until
 * something takes that long, and `cubic-bezier(0.2, 0, 0, 1)` is a shape.
 * These helpers turn the authored strings into the two things the surface
 * needs — a rankable duration to compare lanes by, and control points to
 * draw and evaluate a curve — so the markup stays markup and the arithmetic
 * stays here, where it can be tested.
 */

/** `150ms` → 150, `0.25s` → 250. Undefined for anything not a plain duration. */
export function durationMs(value: string): number | undefined {
  const match = value.trim().match(/^([\d.]+)(ms|s)$/);
  if (match === null) return undefined;
  const n = Number(match[1]);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return match[2] === "s" ? n * 1000 : n;
}

/**
 * The four control points of an easing, as `[x1, y1, x2, y2]`.
 *
 * `linear` is spelled as a keyword in every theme and is the identity curve;
 * everything else a theme can author for `transition-timing-function` is a
 * `cubic-bezier(...)`. Keywords like `ease-in-out` have no drawable form here
 * and are refused rather than guessed, because a curve that lies about its
 * easing is worse than no curve.
 */
export function easingControlPoints(
  value: string,
): [number, number, number, number] | undefined {
  const text = value.trim();
  if (text === "linear") return [0, 0, 1, 1];
  const match = text.match(/^cubic-bezier\(([^)]+)\)$/);
  if (match === null) return undefined;
  const parts = match[1].split(",").map((part) => Number(part.trim()));
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) {
    return undefined;
  }
  return [parts[0], parts[1], parts[2], parts[3]];
}

/**
 * The eased progress at time `t`, for a curve's control points.
 *
 * `t` is how far along the x axis the caller has got (0…1); the return is how
 * far along the y axis the curve says it should be. Solved by bisection on
 * the bezier parameter: the curve is monotonic in x for the points a theme
 * ships, so a fixed number of steps is exact to the pixel at any size the
 * surface draws.
 */
export function bezierY(
  [x1, y1, x2, y2]: readonly [number, number, number, number],
  t: number,
): number {
  // The curve's ends are exactly its ends; bisection would return its
  // epsilon instead, and a marker parked a hair off the corner reads as a
  // drawing bug.
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  const at = (
    a: number,
    b: number,
    s: number,
  ): number => 3 * (1 - s) ** 2 * s * a + 3 * (1 - s) * s ** 2 * b + s ** 3;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 24; i++) {
    const s = (lo + hi) / 2;
    if (at(x1, x2, s) < t) lo = s;
    else hi = s;
  }
  return at(y1, y2, (lo + hi) / 2);
}

/** The utility an easing row plays: `motion.easing.standard` → `ease-standard`. */
export function easingUtility(path: string): string {
  return `ease-${path.split(".").slice(2).join("-")}`;
}

/**
 * The four points written back the way a theme spells them.
 *
 * The identity curve becomes `linear`, because a drag that round-trips
 * through the numbers would otherwise rewrite the keyword into
 * `cubic-bezier(0, 0, 1, 1)` and claim a value was edited. Three decimals
 * is the precision a handle drags at; anything finer is pointer noise the
 * document has no business storing.
 */
export function easingValue(
  points: readonly [number, number, number, number],
): string {
  const [x1, y1, x2, y2] = points.map((n) => Number(n.toFixed(3)));
  if (x1 === 0 && y1 === 0 && x2 === 1 && y2 === 1) return "linear";
  return `cubic-bezier(${x1}, ${y1}, ${x2}, ${y2})`;
}
