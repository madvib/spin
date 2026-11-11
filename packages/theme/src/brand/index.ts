/**
 * @spinjs/theme/brand — the brand procedures' pure half.
 *
 * Judgment and generation live here; reads and writes live in
 * `@spinjs/project`. A procedure asks what a seeded palette is, what a
 * pairing suggests, or what diverged — never touching the disk to do it.
 */

export { sparseLayer } from "./sparse.ts";
export { seedPalette } from "./palette.ts";
export type { PaletteSeed, SeededPalette } from "./palette.ts";
export { suggestionFaces, typeSuggestions } from "./type.ts";
export type { TypeSuggestion } from "./type.ts";
