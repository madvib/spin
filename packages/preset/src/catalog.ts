import type { TokenTree } from "@spinjs/theme";
import { themeRef } from "@spinjs/theme";
import { namesIn } from "./utils/lookup.ts";
import { BORDER_NAMES } from "./rules/border.ts";
import { DISPLAY_NAMES, VISIBILITY_NAMES } from "./rules/display.ts";
import { divideNames } from "./rules/divide.ts";
import { GRID_NAMES } from "./rules/grid.ts";
import { INTERACTIVITY_NAMES } from "./rules/interactivity.ts";
import { LAYOUT_NAMES } from "./rules/layout.ts";
import { OPACITY_NAMES } from "./rules/opacity.ts";
import { OVERFLOW_NAMES } from "./rules/overflow.ts";
import { POSITION_NAMES } from "./rules/position.ts";
import { SIZING_NAMES } from "./rules/sizing.ts";
import { GUTTER_NAMES, MARGIN_AUTO_NAMES } from "./rules/spacing.ts";
import {
  TEXT_ALIGN_NAMES,
  TEXT_DECORATION_NAMES,
  WHITESPACE_NAMES,
  WORD_BREAK_NAMES,
} from "./rules/text.ts";

import { TRANSITION_NAMES, transitionDurations } from "./rules/transitions.ts";
import { TYPOGRAPHY_NAMES } from "./rules/typography.ts";
import { FRACTIONS, INSET_KEYWORDS } from "./utils/vocabulary.ts";
import { variantPrefixes } from "./variants/index.ts";

export interface CatalogSection {
  id: string;
  title: string;
  utilities: string[];
}

function prefixed(prefixes: string[], keys: Iterable<string>): string[] {
  const names = [...keys];
  const out: string[] = [];
  for (const prefix of prefixes) {
    for (const key of names) out.push(`${prefix}${key}`);
  }
  return out;
}

/**
 * Every utility the preset can produce, grouped for display.
 *
 * The static names come from the RULES that own them — each rule exports the
 * names it matches, so a utility added to a rule appears here without a second
 * edit. The theme-driven names (`bg-primary`, `p-4`, `max-w-lg` …) are read
 * from the theme, because they are the theme's scale rather than the rule's
 * vocabulary. Neither list is hand-typed: the catalog cannot name a utility
 * the preset does not produce, and a rule cannot produce one the catalog
 * misses.
 */
export function describeCatalog(tree: TokenTree): CatalogSection[] {
  const theme = themeRef(tree);
  return [
    {
      id: "background",
      title: "Background",
      utilities: prefixed(["bg-"], namesIn(theme, "color")),
    },
    {
      id: "text-color",
      title: "Text color",
      utilities: prefixed(["text-"], namesIn(theme, "color")),
    },
    {
      id: "border",
      title: "Border",
      utilities: [
        ...prefixed(["border-"], namesIn(theme, "color")),
        ...BORDER_NAMES,
      ],
    },
    {
      id: "padding",
      title: "Padding",
      utilities: prefixed(
        ["p-", "px-", "py-", "pt-", "pr-", "pb-", "pl-"],
        namesIn(theme, "spacing"),
      ),
    },
    {
      id: "margin",
      title: "Margin",
      utilities: [
        ...prefixed(
          ["m-", "mx-", "my-", "mt-", "mr-", "mb-", "ml-"],
          namesIn(theme, "spacing"),
        ),
        ...MARGIN_AUTO_NAMES,
      ],
    },
    {
      id: "gap",
      title: "Gap",
      utilities: [
        ...prefixed(
          ["gap-", "gap-x-", "gap-y-"],
          namesIn(theme, "spacing"),
        ),
        ...GUTTER_NAMES,
      ],
    },
    {
      id: "type-size",
      title: "Type size",
      utilities: prefixed(["text-"], namesIn(theme, "font-size")),
    },
    {
      id: "font",
      title: "Font family and weight",
      utilities: [
        ...prefixed(["font-"], namesIn(theme, "font-family")),
        ...prefixed(["font-"], namesIn(theme, "font-weight")),
      ],
    },
    {
      id: "radius",
      title: "Radius",
      utilities: prefixed(["rounded-"], namesIn(theme, "radius")),
    },
    {
      id: "shadow",
      title: "Shadow",
      utilities: prefixed(["shadow-"], namesIn(theme, "shadow")),
    },
    {
      id: "layout",
      title: "Layout",
      utilities: [...LAYOUT_NAMES],
    },
    {
      id: "sizing",
      title: "Sizing",
      utilities: [
        ...prefixed(["w-"], namesIn(theme, "spacing")),
        ...prefixed(["h-"], namesIn(theme, "spacing")),
        ...SIZING_NAMES,
        // `max-w-<bp>` is a measure; `max-w-screen-<bp>` is the viewport width
        // AT that breakpoint. Both are real and the catalog names both.
        ...prefixed(["max-w-"], namesIn(theme, "breakpoint")),
        ...prefixed(["max-w-screen-"], namesIn(theme, "breakpoint")),
      ],
    },
    {
      id: "grid",
      title: "Grid",
      utilities: [...GRID_NAMES],
    },
    {
      id: "display",
      title: "Display",
      utilities: [...DISPLAY_NAMES, ...VISIBILITY_NAMES],
    },
    {
      id: "text",
      title: "Text",
      utilities: [
        ...TEXT_ALIGN_NAMES,
        ...WHITESPACE_NAMES,
        ...WORD_BREAK_NAMES,
      ],
    },
    {
      id: "typography",
      title: "Typography",
      utilities: [...TYPOGRAPHY_NAMES],
    },
    {
      id: "transitions",
      title: "Transitions",
      utilities: [
        ...TRANSITION_NAMES,
        ...prefixed(["duration-"], transitionDurations(theme)),
        ...prefixed(["ease-"], namesIn(theme, "motion-easing")),
      ],
    },
    { id: "opacity", title: "Opacity", utilities: [...OPACITY_NAMES] },
    { id: "overflow", title: "Overflow", utilities: [...OVERFLOW_NAMES] },
    {
      id: "position",
      title: "Position",
      utilities: [
        ...POSITION_NAMES,
        ...prefixed(["inset-"], namesIn(theme, "spacing")),
        ...prefixed(["inset-"], Object.keys(FRACTIONS)),
        ...prefixed(["inset-"], Object.keys(INSET_KEYWORDS)),
        ...prefixed(["inset-x-"], namesIn(theme, "spacing")),
        ...prefixed(["inset-x-"], Object.keys(INSET_KEYWORDS)),
        ...prefixed(["inset-y-"], namesIn(theme, "spacing")),
        ...prefixed(["inset-y-"], Object.keys(INSET_KEYWORDS)),
        ...prefixed(["top-"], namesIn(theme, "spacing")),
        ...prefixed(["top-"], Object.keys(FRACTIONS)),
        ...prefixed(["top-"], Object.keys(INSET_KEYWORDS)),
        ...prefixed(["right-"], namesIn(theme, "spacing")),
        ...prefixed(["right-"], Object.keys(INSET_KEYWORDS)),
        ...prefixed(["bottom-"], namesIn(theme, "spacing")),
        ...prefixed(["bottom-"], Object.keys(INSET_KEYWORDS)),
        ...prefixed(["left-"], namesIn(theme, "spacing")),
        ...prefixed(["left-"], Object.keys(FRACTIONS)),
        ...prefixed(["left-"], Object.keys(INSET_KEYWORDS)),
        ...prefixed(["z-"], namesIn(theme, "z-index")),
      ],
    },
    {
      id: "text-decoration",
      title: "Text decoration",
      utilities: [...TEXT_DECORATION_NAMES],
    },
    {
      id: "interactivity",
      title: "Interactivity",
      utilities: [...INTERACTIVITY_NAMES],
    },
    {
      id: "divide",
      title: "Divide",
      utilities: [...divideNames(namesIn(theme, "color"))],
    },
    {
      id: "variants",
      title: "Variants",
      utilities: variantPrefixes(),
    },
  ];
}
