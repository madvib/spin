import type { Rule } from "@unocss/core";
import { staticRules } from "../utils/factories.ts";
import { GRID_DECLS } from "../utils/declarations.ts";
import { GRID_FLOW, GRID_SPANS, GRID_TRACKS } from "../utils/vocabulary.ts";

export const GRID_NAMES: readonly string[] = [
  ...GRID_TRACKS,
  ...GRID_SPANS,
  ...GRID_FLOW,
  "col-auto",
  "col-span-min",
  "row-auto",
  "row-span-min",
  "col-min",
  "col-max",
  "row-min",
  "row-max",
];

/**
 * Track sizing: counts, spans, and flow.
 *
 * The one thing a theme owns about a layout grid is the gutter — the gap
 * between cells — and that arrives through the container's `--grid-gutter`
 * rather than through any of these utilities. Everything here is track shape:
 * how many, how wide, how they flow. None of it is a decision a theme should
 * answer, which is why there is no column scale to configure.
 *
 * `grid-cols-none`, `subgrid` and the `repeat()` escape hatches exist because
 * the twelve fixed counts are a floor, not a ceiling. Their declarations sit
 * in `utils/declarations.ts` with every other static utility's, so a grid name
 * and what it emits are read from the same place as the rest.
 */
export function gridRules(): Rule[] {
  return staticRules(GRID_NAMES, GRID_DECLS);
}
