/**
 * The faces a theme declares, used to read an element's face.
 *
 * An element reads a face the system decides for it, and the system decides
 * it from the theme's own family slots: a heading reads the display face, a
 * quotation the editorial one, the code family the mono one, and everything
 * else the body face. The slot has to be a family the theme actually
 * declares — "heading" and "body" are studio words for families that may not
 * exist — so a theme that declares none of them answers with the first
 * family it does declare, which is the theme's base face.
 */

/** The headings, which read the theme's display face. */
const HEADINGS = new Set(["h1", "h2", "h3", "h4", "h5", "h6"]);

/** The machine text, which reads the theme's mono face. */
const MONO = new Set(["code", "pre", "samp", "kbd"]);

/** The family an element claims when the theme declares no slot for it. */
export function defaultFaceFor(
  tag: string,
  declared: readonly string[],
): string {
  const first = declared.length > 0 ? declared[0]! : "sans";
  const pick = (slot: string) => declared.includes(slot) ? slot : first;
  if (HEADINGS.has(tag)) return pick("heading");
  if (tag === "blockquote") return pick("serif");
  if (MONO.has(tag)) return pick("mono");
  return pick("body");
}
