import type { TokenTree } from "@spin/theme";
import { themeRef } from "@spin/theme";
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
        Object.keys(theme.spacing ?? {}),
      ),
    },
    {
      id: "margin",
      title: "Margin",
      utilities: prefixed(
        ["m-", "mx-", "my-", "mt-", "mr-", "mb-", "ml-"],
        Object.keys(theme.spacing ?? {}),
      ),
    },
    {
      id: "gap",
      title: "Gap",
      utilities: prefixed(
        ["gap-", "gap-x-", "gap-y-"],
        Object.keys(theme.spacing ?? {}),
      ),
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
      utilities: [...STATIC_UTILITIES, ...FLEX_UTILITIES, ...ORDER_UTILITIES],
    },
    {
      id: "sizing",
      title: "Sizing",
      utilities: [
        ...prefixed(["w-"], Object.keys(theme.spacing ?? {})),
        ...prefixed(["w-"], Object.keys(FRACTIONS)),
        ...prefixed(["w-"], Object.keys(WIDTH_KEYWORDS)),
        ...prefixed(["h-"], Object.keys(theme.spacing ?? {})),
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
        ...prefixed(["max-w-screen-"], Object.keys(theme.breakpoint ?? {})),
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
        ...prefixed(["duration-"], Object.keys(theme.motionDuration ?? {})),
        ...prefixed(["ease-"], Object.keys(theme.motionEasing ?? {})),
      ],
    },
    { id: "opacity", title: "Opacity", utilities: [...OPACITY_UTILITIES] },
    { id: "overflow", title: "Overflow", utilities: [...OVERFLOW_UTILITIES] },
    {
      id: "position",
      title: "Position",
      utilities: [
        ...Object.keys(POSITION_UTILITIES),
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
        ...prefixed(["divide-"], Object.keys(theme.colors ?? {})),
      ],
    },
  ];
}
