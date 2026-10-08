import type { TokenTree } from "@spin/theme";
import { themeRef } from "@spin/theme";
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
import { toneNames } from "./rules/tones.ts";
import { TRANSITION_NAMES } from "./rules/transitions.ts";
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
      utilities: prefixed(["bg-"], Object.keys(theme.colors ?? {})),
    },
    {
      id: "text-color",
      title: "Text color",
      utilities: prefixed(["text-"], Object.keys(theme.colors ?? {})),
    },
    {
      id: "border",
      title: "Border",
      utilities: [
        ...prefixed(["border-"], Object.keys(theme.colors ?? {})),
        ...BORDER_NAMES,
      ],
    },
    {
      id: "padding",
      title: "Padding",
      utilities: prefixed(
        ["p-", "px-", "py-", "pt-", "pr-", "pb-", "pl-"],
        Object.keys(theme.spacing ?? {}),
      ),
    },
    {
      id: "margin",
      title: "Margin",
      utilities: [
        ...prefixed(
          ["m-", "mx-", "my-", "mt-", "mr-", "mb-", "ml-"],
          Object.keys(theme.spacing ?? {}),
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
          Object.keys(theme.spacing ?? {}),
        ),
        ...GUTTER_NAMES,
      ],
    },
    {
      id: "type-size",
      title: "Type size",
      utilities: prefixed(["text-"], Object.keys(theme.fontSize ?? {})),
    },
    {
      id: "font",
      title: "Font family and weight",
      utilities: [
        ...prefixed(["font-"], Object.keys(theme.fontFamily ?? {})),
        ...prefixed(["font-"], Object.keys(theme.fontWeight ?? {})),
      ],
    },
    {
      id: "radius",
      title: "Radius",
      utilities: prefixed(["rounded-"], Object.keys(theme.radius ?? {})),
    },
    {
      id: "shadow",
      title: "Shadow",
      utilities: prefixed(["shadow-"], Object.keys(theme.shadow ?? {})),
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
        ...prefixed(["w-"], Object.keys(theme.spacing ?? {})),
        ...prefixed(["h-"], Object.keys(theme.spacing ?? {})),
        ...SIZING_NAMES,
        // `max-w-<bp>` is a measure; `max-w-screen-<bp>` is the viewport width
        // AT that breakpoint. Both are real and the catalog names both.
        ...prefixed(["max-w-"], Object.keys(theme.breakpoint ?? {})),
        ...prefixed(["max-w-screen-"], Object.keys(theme.breakpoint ?? {})),
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
        ...prefixed(["duration-"], Object.keys(theme.motionDuration ?? {})),
        ...prefixed(["ease-"], Object.keys(theme.motionEasing ?? {})),
      ],
    },
    { id: "opacity", title: "Opacity", utilities: [...OPACITY_NAMES] },
    { id: "overflow", title: "Overflow", utilities: [...OVERFLOW_NAMES] },
    {
      id: "position",
      title: "Position",
      utilities: [
        ...POSITION_NAMES,
        ...prefixed(["inset-"], Object.keys(theme.spacing ?? {})),
        ...prefixed(["inset-"], Object.keys(FRACTIONS)),
        ...prefixed(["inset-"], Object.keys(INSET_KEYWORDS)),
        ...prefixed(["inset-x-"], Object.keys(theme.spacing ?? {})),
        ...prefixed(["inset-x-"], Object.keys(INSET_KEYWORDS)),
        ...prefixed(["inset-y-"], Object.keys(theme.spacing ?? {})),
        ...prefixed(["inset-y-"], Object.keys(INSET_KEYWORDS)),
        ...prefixed(["top-"], Object.keys(theme.spacing ?? {})),
        ...prefixed(["top-"], Object.keys(FRACTIONS)),
        ...prefixed(["top-"], Object.keys(INSET_KEYWORDS)),
        ...prefixed(["right-"], Object.keys(theme.spacing ?? {})),
        ...prefixed(["right-"], Object.keys(INSET_KEYWORDS)),
        ...prefixed(["bottom-"], Object.keys(theme.spacing ?? {})),
        ...prefixed(["bottom-"], Object.keys(INSET_KEYWORDS)),
        ...prefixed(["left-"], Object.keys(theme.spacing ?? {})),
        ...prefixed(["left-"], Object.keys(FRACTIONS)),
        ...prefixed(["left-"], Object.keys(INSET_KEYWORDS)),
        ...prefixed(["z-"], Object.keys(theme.zIndex ?? {})),
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
      utilities: [...divideNames(Object.keys(theme.colors ?? {}))],
    },
    {
      id: "tones",
      title: "Tones",
      utilities: toneNames(),
    },
    {
      id: "variants",
      title: "Variants",
      utilities: variantPrefixes(),
    },
  ];
}
