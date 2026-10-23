/**
 * @spin/theme/base — the document a theme makes before any component exists.
 *
 * Everything here spends a token the theme owns, so this is identity rather
 * than taste. Stage-setting that spends nothing — reset, the reduced-motion
 * clamp — is not here; that ships with the preset machinery, because no theme
 * can change it and a theme module that carries it is claiming a decision it
 * does not get to make.
 */

import { documentDefaults } from "./css.ts";
import { fontFaces, readFonts } from "./fonts.ts";

export { documentDefaults } from "./css.ts";
export { fontFaces, readFonts } from "./fonts.ts";
export type { FontDeclaration, FontResult } from "./fonts.ts";

/**
 * One CSS layer a module contributes to the assembled document.
 *
 * `order` is a number, not a position in an array: UnoCSS re-sorts preflights
 * it does not recognise, so declared order is not a reliable statement of
 * intent. Utilities resolve at 0 and everything below loses to them, which is
 * the property the system leans on — a component is a default, a utility is a
 * decision.
 *
 * There is no `requires`. Modules do not declare what they need from each
 * other; they occupy an order and the cascade arbitrates. The one overlap the
 * cascade cannot arbitrate is two components claiming one element, and that is
 * a uniqueness constraint on the manifest rather than a dependency.
 */
export interface PreflightProvider {
  /** Module-scoped name, used for ordering ties and identification. */
  readonly name: string;
  /** Lower numbers emit first. Utilities are 0; theme is -90. */
  readonly order: number;
  getCSS(): string;
}

/**
 * The theme's own document layers.
 *
 * @param doc The theme as raw JSON. `parseTokens` keeps tokens and drops
 * `$extensions`, and the font declarations live there.
 */
export function basePreflights(
  doc: Record<string, unknown>,
): PreflightProvider[] {
  return [
    {
      name: "theme/document-defaults",
      order: -90,
      getCSS: () => documentDefaults(),
    },
    {
      name: "theme/fonts",
      order: -90,
      getCSS: () => fontFaces(readFonts(doc)),
    },
  ];
}
