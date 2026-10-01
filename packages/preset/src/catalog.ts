import type { TokenTree } from "@spin/theme";
import { buildSets } from "./sets.ts";
import {
  BORDER_STYLES,
  DISPLAY_UTILITIES,
  FLEX_UTILITIES,
  FRACTIONS,
  HEIGHT_KEYWORDS,
  INSET_KEYWORDS,
  INTERACTIVITY_UTILITIES,
  OPACITY_UTILITIES,
  ORDER_UTILITIES,
  OVERFLOW_UTILITIES,
  POSITION_UTILITIES,
  STATIC_UTILITIES,
  TEXT_ALIGN,
  TEXT_DECORATION,
  TRANSITION_PROPERTY,
  VISIBILITY,
  WHITESPACE,
  WIDTH_KEYWORDS,
  WORD_BREAK,
} from "./utils/vocabulary.ts";

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

export function describeCatalog(tree: TokenTree): CatalogSection[] {
  const sets = buildSets(tree);
  return [
    {
      id: "background",
      title: "Background",
      utilities: prefixed(["bg-"], sets.colors.keys()),
    },
    {
      id: "text-color",
      title: "Text color",
      utilities: prefixed(["text-"], sets.colors.keys()),
    },
    {
      id: "border",
      title: "Border",
      utilities: [
        ...prefixed(["border-"], sets.colors.keys()),
        "border",
        "border-0",
        "border-2",
        "border-4",
        "border-8",
        ...Object.keys(BORDER_STYLES),
      ],
    },
    {
      id: "padding",
      title: "Padding",
      utilities: prefixed(
        ["p-", "px-", "py-", "pt-", "pr-", "pb-", "pl-"],
        sets.spacing.keys(),
      ),
    },
    {
      id: "margin",
      title: "Margin",
      utilities: prefixed(
        ["m-", "mx-", "my-", "mt-", "mr-", "mb-", "ml-"],
        sets.spacing.keys(),
      ),
    },
    {
      id: "gap",
      title: "Gap",
      utilities: prefixed(["gap-", "gap-x-", "gap-y-"], sets.spacing.keys()),
    },
    {
      id: "type-size",
      title: "Type size",
      utilities: prefixed(["text-"], sets.fontSize.keys()),
    },
    {
      id: "font",
      title: "Font family and weight",
      utilities: [
        ...prefixed(["font-"], sets.fontFamily.keys()),
        ...prefixed(["font-"], sets.fontWeight.keys()),
      ],
    },
    {
      id: "radius",
      title: "Radius",
      utilities: prefixed(["rounded-"], sets.radius.keys()),
    },
    {
      id: "shadow",
      title: "Shadow",
      utilities: prefixed(["shadow-"], sets.shadow.keys()),
    },
    {
      id: "layout",
      title: "Layout",
      utilities: [...STATIC_UTILITIES, ...FLEX_UTILITIES, ...ORDER_UTILITIES],
    },
    {
      id: "sizing",
      title: "Sizing",
      utilities: [
        ...prefixed(["w-"], sets.spacing.keys()),
        ...prefixed(["w-"], Object.keys(FRACTIONS)),
        ...prefixed(["w-"], Object.keys(WIDTH_KEYWORDS)),
        ...prefixed(["h-"], sets.spacing.keys()),
        ...prefixed(["h-"], Object.keys(FRACTIONS)),
        ...prefixed(["h-"], Object.keys(HEIGHT_KEYWORDS)),
        "min-w-0",
        "min-w-full",
        "min-w-min",
        "min-w-max",
        "min-w-fit",
        "max-w-0",
        "max-w-full",
        "max-w-min",
        "max-w-max",
        "max-w-fit",
        ...prefixed(["max-w-screen-"], sets.breakpoint.keys()),
        "min-h-0",
        "min-h-full",
        "min-h-screen",
        "min-h-min",
        "min-h-max",
        "min-h-fit",
        "max-h-0",
        "max-h-full",
        "max-h-screen",
        "max-h-min",
        "max-h-max",
        "max-h-fit",
      ],
    },
    {
      id: "display",
      title: "Display",
      utilities: [...DISPLAY_UTILITIES, ...Object.keys(VISIBILITY)],
    },
    {
      id: "text",
      title: "Text",
      utilities: [
        ...Object.keys(TEXT_ALIGN),
        ...Object.keys(WHITESPACE),
        ...Object.keys(WORD_BREAK),
      ],
    },
    {
      id: "transitions",
      title: "Transitions",
      utilities: [
        ...Object.keys(TRANSITION_PROPERTY),
        ...prefixed(["duration-"], sets.motionDuration.keys()),
        ...prefixed(["ease-"], sets.motionEasing.keys()),
      ],
    },
    { id: "opacity", title: "Opacity", utilities: [...OPACITY_UTILITIES] },
    { id: "overflow", title: "Overflow", utilities: [...OVERFLOW_UTILITIES] },
    {
      id: "position",
      title: "Position",
      utilities: [
        ...Object.keys(POSITION_UTILITIES),
        ...prefixed(["inset-"], sets.spacing.keys()),
        ...prefixed(["inset-"], Object.keys(FRACTIONS)),
        ...prefixed(["inset-"], Object.keys(INSET_KEYWORDS)),
        ...prefixed(["inset-x-"], sets.spacing.keys()),
        ...prefixed(["inset-x-"], Object.keys(INSET_KEYWORDS)),
        ...prefixed(["inset-y-"], sets.spacing.keys()),
        ...prefixed(["inset-y-"], Object.keys(INSET_KEYWORDS)),
        ...prefixed(["top-"], sets.spacing.keys()),
        ...prefixed(["top-"], Object.keys(FRACTIONS)),
        ...prefixed(["top-"], Object.keys(INSET_KEYWORDS)),
        ...prefixed(["right-"], sets.spacing.keys()),
        ...prefixed(["right-"], Object.keys(INSET_KEYWORDS)),
        ...prefixed(["bottom-"], sets.spacing.keys()),
        ...prefixed(["bottom-"], Object.keys(INSET_KEYWORDS)),
        ...prefixed(["left-"], sets.spacing.keys()),
        ...prefixed(["left-"], Object.keys(FRACTIONS)),
        ...prefixed(["left-"], Object.keys(INSET_KEYWORDS)),
        ...prefixed(["z-"], sets.zIndex.keys()),
      ],
    },
    {
      id: "text-decoration",
      title: "Text decoration",
      utilities: [...Object.keys(TEXT_DECORATION)],
    },
    {
      id: "interactivity",
      title: "Interactivity",
      utilities: [...INTERACTIVITY_UTILITIES],
    },
    {
      id: "divide",
      title: "Divide",
      utilities: [
        "divide-x",
        "divide-x-0",
        "divide-x-2",
        "divide-x-4",
        "divide-x-8",
        "divide-y",
        "divide-y-0",
        "divide-y-2",
        "divide-y-4",
        "divide-y-8",
        ...prefixed(["divide-"], sets.colors.keys()),
      ],
    },
  ];
}
