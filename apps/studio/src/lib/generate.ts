import { analyzeTheme } from "./theme.ts";
import { paletteChips, surfaceSteps, tokenValue } from "./overview.ts";
import type { SpinFontDeclaration } from "./fonts.ts";
import {
  contrastRatio,
  scaffoldTheme,
  treeToJson,
} from "@spinjs/spin/theme";
export interface DraftChoices {
  primary: string;
  secondary: string;
  accent: string;
  /** Stack strings as the theme stores them; "" leaves the starter's slot. */
  bodyFont: string;
  headingFont: string;
  /** @font-face declarations for the chosen stacks, appended once each. */
  faces?: readonly SpinFontDeclaration[];
  starter: string | null;
  name: string;
}

function deriveInk(fill: string): string {
  const candidates = ["#ffffff", "#111111"];
  let best = candidates[0] as string;
  let bestRatio = -1;
  for (const candidate of candidates) {
    const ratio = contrastRatio(candidate, fill);
    if (ratio > bestRatio) {
      bestRatio = ratio;
      best = candidate;
    }
  }
  return best;
}

function setColour(
  color: Record<string, unknown>,
  name: string,
  value: string,
): void {
  const token = (color[name] ?? { $type: "color" }) as Record<string, unknown>;
  if (token.$type === undefined) token.$type = "color";
  token.$value = value;
  color[name] = token;

  const inkName = `on-${name}`;
  const ink = deriveInk(value);
  const inkToken = (color[inkName] ?? { $type: "color" }) as Record<
    string,
    unknown
  >;
  if (inkToken.$type === undefined) inkToken.$type = "color";
  inkToken.$value = ink;
  color[inkName] = inkToken;
}

function setFontStack(
  family: Record<string, unknown>,
  slot: string,
  stack: string,
): void {
  if (stack === "") return;
  const token = (family[slot] ?? { $type: "fontFamily" }) as Record<
    string,
    unknown
  >;
  if (token.$type === undefined) token.$type = "fontFamily";
  token.$value = stack;
  family[slot] = token;
}

export function composeDraft(
  starterText: string | null,
  choices: DraftChoices,
): string {
  const baseText = starterText ?? treeToJson(scaffoldTheme());
  const doc = JSON.parse(baseText) as Record<string, unknown>;
  const color = (doc.color ?? {}) as Record<string, unknown>;
  doc.color = color;

  setColour(color, "primary", choices.primary);
  setColour(color, "secondary", choices.secondary);
  setColour(color, "accent", choices.accent);

  const font = (doc.font ?? {}) as Record<string, unknown>;
  doc.font = font;
  const family = (font.family ?? {}) as Record<string, unknown>;
  if (font.family === undefined || typeof font.family !== "object") {
    font.family = family;
  }
  if (family.$type === undefined) family.$type = "fontFamily";
  // remove $type if children? keep harmless

  const extensions = (doc.$extensions ?? {}) as Record<string, unknown>;
  doc.$extensions = extensions;
  const spin = (extensions.spin ?? {}) as Record<string, unknown>;
  extensions.spin = spin;
  const fonts = Array.isArray(spin.fonts)
    ? (spin.fonts as Array<Record<string, unknown>>)
    : [];
  spin.fonts = fonts;

  setFontStack(family, "body", choices.bodyFont);
  setFontStack(family, "sans", choices.bodyFont);
  setFontStack(family, "heading", choices.headingFont);
  for (const face of choices.faces ?? []) {
    if (fonts.some((entry) => entry.family === face.family)) continue;
    fonts.push({
      family: face.family,
      src: face.src,
      weight: face.weight,
      style: face.style,
      display: face.display,
    });
  }

  const text = JSON.stringify(doc, null, 2);

  const report = analyzeTheme(text);
  if (!report.valid) {
    throw new Error(
      report.error ?? report.issues.map((issue) => issue.message).join("; "),
    );
  }
  return text;
}

export function draftPreview(
  text: string,
  mode: string,
): {
  swatches: ReturnType<typeof paletteChips>;
  surfaces: ReturnType<typeof surfaceSteps>;
  headingStack: string;
  bodyStack: string;
  primary: string;
  onPrimary: string;
} {
  let tree: ReturnType<typeof analyzeTheme>["tree"] | undefined;
  try {
    tree = analyzeTheme(text).tree;
  } catch {
    tree = undefined;
  }
  const swatches = tree === undefined ? [] : paletteChips(text, mode);
  const surfaces = tree === undefined ? [] : surfaceSteps(text, mode);
  const headingStack =
    tree === undefined
      ? ""
      : (tokenValue(tree, mode, "font.family.heading") ?? "");
  const bodyStack =
    tree === undefined
      ? ""
      : (tokenValue(tree, mode, "font.family.body") ??
        tokenValue(tree, mode, "font.family.sans") ??
        "");
  const primary =
    tree === undefined ? "" : (tokenValue(tree, mode, "color.primary") ?? "");
  const onPrimary =
    tree === undefined
      ? ""
      : (tokenValue(tree, mode, "color.on-primary") ?? "");
  return { swatches, surfaces, headingStack, bodyStack, primary, onPrimary };
}
