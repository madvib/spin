/**
 * The faces a theme declares, used to read an element's default.
 *
 * An element that does not carry its own override reads a family. The family
 * it reads is the theme's name for that role, so the default has to be a
 * family the theme actually declares — "heading" and "body" are studio words
 * for families that may not exist. A `blockquote` reads `serif` when the
 * theme has one, a `code` reads `mono` when it has one, everything else reads
 * the first declared family, which is the theme's base face.
 */

/** The family an element claims when it does not override one itself. */
export function defaultFaceFor(
  tag: string,
  declared: readonly string[],
): string {
  const first = declared.length > 0 ? declared[0]! : "sans";
  if (tag === "blockquote") {
    return declared.includes("serif") ? "serif" : first;
  }
  // `kbd` is platform text; `code`/`pre` belong to mono when the theme has one.
  if (tag === "code" || tag === "pre" || tag === "kbd") {
    return declared.includes("mono") ? "mono" : first;
  }
  return first;
}
