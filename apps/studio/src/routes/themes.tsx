import type { JSX } from "solid-js";
/**
 * The token-group side list: six static rows, no grouping, no search.
 *
 * The same split shape the components gallery lays out — a rail beside the
 * page, a strip above it in the drawer or on a narrow window — but six rows
 * need neither the gallery's grouping nor its filter. The links spell their
 * own paths: the groups are children of this route, and a child path is the
 * one thing a table cannot name without becoming the router.
 */
export const GROUPS: ReadonlyArray<
  readonly [path: string, label: string, icon: string, description: string]
> = [
  ["/tokens/colors", "Color", "i-lucide-palette", "Roles, ramps, and contrast floors"],
  ["/tokens/type", "Type", "i-lucide-type", "Faces, styles, and scales"],
  ["/tokens/spacing", "Spacing", "i-lucide-ruler", "Scale steps and breakpoints"],
  ["/tokens/style", "Style", "i-lucide-contrast", "Radius, elevation, borders, and focus"],
  ["/tokens/motion", "Motion", "i-lucide-square-play", "Durations, easings, and transitions"],
  ["/tokens/icons", "Icons", "i-lucide-layers", "Glyph library and saved icons"],
];

export default function ThemesLayout(props: { children?: JSX.Element }) {
  return (
    <div class="flex min-h-0 min-w-0 flex-1 flex-col">
      {props.children}
    </div>
  );
}
