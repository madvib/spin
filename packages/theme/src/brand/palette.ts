/**
 * Seeding a palette from one primary: the hero path of Step 3.
 *
 * The author names one color — the brand's mark — and this builds the whole
 * ink story over the design language the brand already names: the neutral
 * ramp tinted by the seed's hue, the semantic fills darkened out of the
 * seed toward their own hues where they are too close, every fill paired
  * with readable ink in both modes, and the `modes` root declaring both.
  * The result is a sparse `color.*` layer over the language, never a full
  * document: the caller sets `$extends` and writes only what this returns.
 *
 * Floors are validated before write — a seeded palette that fails its own
 * contrast never lands — and the refusal carries the issues in the judge's
 * own words, so the caller can show why instead of writing anyway.
 */

import {
  contrastRatio,
  formatHex,
  oklabToRgb,
  parseColor,
  rgbToOklab,
  type Rgb,
} from "../pipeline/color.ts";
import { generateScale } from "../authoring/color.ts";
import { legibilityFloors } from "../contract/roles.ts";
import { parseTokens } from "../pipeline/parse.ts";
import { indexTree, resolveAliases } from "../pipeline/resolve.ts";
import { mergeThemeDocuments } from "../merge.ts";
import { designLanguages, isDesignLanguage } from "../languages/index.ts";
import { treeInMode } from "../modes.ts";
import type { ThemeDocument } from "../pipeline/types.ts";
import { sparseLayer } from "./sparse.ts";

/** What a seed carries: the primary, and the ramp behind it. */
export interface PaletteSeed {
  /** The brand's mark: primary actions, links, focus rings. */
  readonly primary: string;
  /** The neutral ramp's own seed: paper and charcoal when the primary is loud. */
  readonly neutral?: string;
  /** The modes the palette serves. Defaults to both. */
  readonly modes?: readonly string[];
}

/** What seeding produced: the sparse layer, or why it cannot be written. */
export interface SeededPalette {
  /** The sparse `color.*` layer, present only when it judges clean. */
  readonly layer: ThemeDocument | undefined;
  /** Why the seeded palette cannot be written, in the judge's own words. */
  readonly issues: readonly string[];
}

const INK_LIGHT = "#ffffff";
const INK_DARK = "#111923";
const SURFACE_DARK = "#0d121a";

function clampByte(value: number): number {
  return Math.min(255, Math.max(0, Math.round(value)));
}

function hexOf(color: Rgb): string {
  return formatHex({ r: clampByte(color.r), g: clampByte(color.g), b: clampByte(color.b), a: 1 });
}

const STEP_INDEX: Record<string, number> = {
  // generateScale runs black→white; the ladder runs 50 = lightest.
  "50": 9,
  "100": 8,
  "200": 7,
  "300": 6,
  "400": 5,
  "500": 4,
  "600": 3,
  "700": 2,
  "800": 1,
  "900": 0,
};

/** One ramp step: an 11-step OKLab ramp off `seed`, read at `step`. */
function rampStep(seed: string, step: string): string {
  return generateScale(seed, 11)[STEP_INDEX[step] ?? 5] as string;
}

function labOf(hex: string): { L: number; a: number; b: number } {
  const { r, g, b } = parseColor(hex);
  return rgbToOklab(r, g, b);
}

/**
 * A fill in the seed's family: its chroma, the reference hue, the seed's
 * lightness — so a green primary does not turn the error fill green, and an
 * unreadable seed still seeds readable semantics.
 */
function familyFill(seedHex: string, referenceHex: string, lightness: number, chroma: number): string {
  const seed = labOf(seedHex);
  const reference = labOf(referenceHex);
  const near = Math.hypot(seed.a - reference.a, seed.b - reference.b) < 0.03;
  const hue = Math.atan2(reference.b, reference.a);
  // A seed on the fill's own hue deepens it instead, so the two stay apart.
  const depth = near ? Math.min(0.42, lightness) : lightness;
  const weight = near ? chroma + 0.04 : chroma;
  return hexOf(oklabToRgb(depth, weight * Math.cos(hue), weight * Math.sin(hue)));
}

/** A fill nudged until the better ink clears the floor — or the best miss. */
function clearsFill(seedHex: string, referenceHex: string, lightness: number, chroma: number): string {
  let depth = Math.min(lightness, 0.45);
  let best = familyFill(seedHex, referenceHex, depth, chroma);
  for (let i = 0; i < 20; i++) {
    const ink = inkOn(best);
    if (contrastRatio(ink, best) >= 4.5) return best;
    depth = Math.max(0.05, depth - 0.03);
    const next = familyFill(seedHex, referenceHex, depth, chroma);
    if (contrastRatio(inkOn(next), next) >= contrastRatio(inkOn(best), best)) best = next;
    else break;
  }
  return best;
}

/** A dark-mode ink for a light fill: the fill's own hue, lifted to read on dark. */
function darkInk(lightHex: string): string {
  const lab = labOf(lightHex);
  return hexOf(oklabToRgb(0.82, lab.a * 0.7, lab.b * 0.7));
}

/** The ink on a fill: white unless white itself fails there. */
function inkOn(fill: string): string {
  if (contrastRatio(INK_LIGHT, fill) >= 4.5) return INK_LIGHT;
  if (contrastRatio(INK_DARK, fill) >= 4.5) return INK_DARK;
  return contrastRatio(INK_LIGHT, fill) >= contrastRatio(INK_DARK, fill)
    ? INK_LIGHT
    : INK_DARK;
}

/**
 * The `color.*` layer a primary seeds, judged before write.
 *
 * The neutral ramp follows the neutral seed (or the primary when none is
 * named); the semantics follow the seed's chroma but keep their own hues.
  * Every leaf carries its dark `$modes` value, because the composition serves
  * both modes. The layer is diffed against the language — only diverged leaves
  * are kept — so two brands from one design language leave with different
 * palettes.
 */
export function seedPalette(
  language: string,
  seed: PaletteSeed,
): SeededPalette {
  if (!isDesignLanguage(language)) {
    return {
      layer: undefined,
      issues: [
        `unknown design language "${language}" — expected one of ${Object.keys(designLanguages).join(", ")}`,
      ],
    };
  }
  const parent = designLanguages[language];
  let primary: string;
  try {
    primary = hexOf(parseColor(seed.primary));
  } catch {
    return { layer: undefined, issues: [`"${seed.primary}" is not a color this package can read`] };
  }
  const neutralSeed = seed.neutral ?? seed.primary;
  try {
    parseColor(neutralSeed);
  } catch {
    return { layer: undefined, issues: [`"${neutralSeed}" is not a color this package can read`] };
  }
  const primaryLab = labOf(primary);
  const chroma = Math.hypot(primaryLab.a, primaryLab.b);
  const modes = [...(seed.modes ?? ["light", "dark"])];
  const light: Record<string, string> = {};
  const dark: Record<string, string> = {};
  for (const step of Object.keys(STEP_INDEX)) {
    light[`neutral.${step}`] = rampStep(neutralSeed, step);
    const lab = labOf(light[`neutral.${step}`] as string);
    dark[`neutral.${step}`] = hexOf(oklabToRgb(1 - lab.L * 0.92, lab.a * 0.9, lab.b * 0.9));
  }
  light["primary"] = primary;
  dark["primary"] = darkInk(primary);
  light["secondary"] = light["neutral.800"] as string;
  dark["secondary"] = dark["neutral.800"] as string;
  const accent = clearsFill(primary, "#006974", primaryLab.L, Math.max(chroma * 0.8, 0.08));
  light["accent"] = accent;
  dark["accent"] = darkInk(accent);
  const semantics: Record<string, string> = {
    success: "#26753e",
    warning: "#886108",
    error: "#a6312b",
    info: "#0e629a",
  };
  for (const [name, reference] of Object.entries(semantics)) {
    const fill = clearsFill(primary, reference, primaryLab.L, Math.max(chroma * 0.8, 0.08));
    light[`semantic.${name}`] = fill;
    dark[`semantic.${name}`] = darkInk(fill);
  }
  light["on-primary"] = inkOn(light["primary"] as string);
  dark["on-primary"] = inkOn(dark["primary"] as string);
  // Links and rings are text on surface, not fills: they wear the brand ink
  // deepened until it reads, rather than the fill itself.
  const linkLight = clearsFill(primary, primary, primaryLab.L, chroma);
  const linkDark = darkInk(linkLight);
  const color: Record<string, unknown> = {
    $type: "color",
    primary: { $value: light["primary"], $modes: { dark: dark["primary"] } },
    secondary: { $value: light["neutral.800"], $modes: { dark: dark["neutral.800"] } },
    accent: { $value: light["accent"], $modes: { dark: dark["accent"] } },
    neutral: Object.fromEntries(
      Object.keys(STEP_INDEX).map((step) => [
        step,
        { $value: light[`neutral.${step}`], $modes: { dark: dark[`neutral.${step}`] } },
      ]),
    ),
    semantic: Object.fromEntries(
      Object.keys(semantics).map((name) => [
        name,
        { $value: light[`semantic.${name}`], $modes: { dark: dark[`semantic.${name}`] } },
      ]),
    ),
    surface: { $value: "{color.neutral.50}", $modes: { dark: SURFACE_DARK } },
    "surface-sunken": { $value: "{color.neutral.100}", $modes: { dark: "{color.neutral.200}" } },
    "surface-raised": { $value: "#ffffff", $modes: { dark: "#18202a" } },
    text: { $value: "{color.neutral.900}", $modes: { dark: "#f3f5f8" } },
    "text-muted": { $value: "{color.neutral.600}", $modes: { dark: "#999fa7" } },
    border: { $value: "{color.neutral.200}", $modes: { dark: "#1d242f" } },
    scrim: { $value: "rgb(15 19 30 / 45%)", $modes: { dark: "rgb(15 19 30 / 60%)" } },
    "on-primary": { $type: "color", $value: light["on-primary"], $modes: { dark: dark["on-primary"] } },
    "focus-ring": { $value: linkLight, $modes: { dark: linkDark } },
    link: { $value: linkLight, $modes: { dark: linkDark } },
    "on-secondary": { $type: "color", $value: inkOn(light["secondary"] as string), $modes: { dark: inkOn(dark["secondary"] as string) } },
    "on-accent": { $type: "color", $value: inkOn(light["accent"] as string), $modes: { dark: inkOn(dark["accent"] as string) } },
    selected: { $type: "color", $value: "{color.text}" },
    "on-selected": { $type: "color", $value: "{color.surface}" },
    "on-semantic-success": { $type: "color", $value: inkOn(light["semantic.success"] as string), $modes: { dark: inkOn(dark["semantic.success"] as string) } },
    "on-semantic-warning": { $type: "color", $value: inkOn(light["semantic.warning"] as string), $modes: { dark: inkOn(dark["semantic.warning"] as string) } },
    "on-semantic-error": { $type: "color", $value: inkOn(light["semantic.error"] as string), $modes: { dark: inkOn(dark["semantic.error"] as string) } },
    "on-semantic-info": { $type: "color", $value: inkOn(light["semantic.info"] as string), $modes: { dark: inkOn(dark["semantic.info"] as string) } },
    field: { $type: "color", $value: "#ffffff", $modes: { dark: "#1d242f" } },
    "border-strong": {
      $value: light["neutral.400"],
      $modes: { dark: dark["neutral.400"] },
    },
    disabled: { $value: "{color.neutral.200}", $modes: { dark: "{color.neutral.200}" } },
    "on-disabled": { $type: "color", $value: "{color.neutral.600}", $modes: { dark: "{color.neutral.600}" } },
  };
  // The disabled pair is ramp positions, not derived fills: if the seeded
  // ramp compresses them below the floor in either mode, resolve each mode's
  // pair to the ink it can hold rather than writing a failing one.
  {
    const trial = mergeThemeDocuments(parent, { color, modes } as ThemeDocument);
    const parsed = parseTokens(trial);
    if (parsed.ok) {
      for (const mode of ["base", "dark"] as const) {
        const tree = mode === "base" ? parsed.tree : treeInMode(parsed.tree, "dark");
        const idx = indexTree(resolveAliases(tree).tree);
        const dis = idx.leaves["color.disabled"]?.value;
        const onDis = idx.leaves["color.on-disabled"]?.value;
        if (typeof dis !== "string" || typeof onDis !== "string") continue;
        try {
          if (contrastRatio(onDis, dis) < 4.5) {
            const fixed = inkOn(dis);
            const leaf = color["on-disabled"] as Record<string, unknown>;
            if (mode === "base") leaf["$value"] = fixed;
            else leaf["$modes"] = { dark: fixed };
          }
        } catch { /* unparseable: the judge names it below */ }
      }
    }
  };
  const full = mergeThemeDocuments(parent, { color, modes } as ThemeDocument);
  const issues = seedIssues(full);
  if (issues.length > 0) return { layer: undefined, issues };
  const kept = sparseLayer(full, parent);
  return { layer: { color: kept["color"], modes } as ThemeDocument, issues: [] };
}

/** Every floor the contract owes, in the base and in dark — the judge's own words. */
function seedIssues(document: ThemeDocument): string[] {
  const issues: string[] = [];
  const parsed = parseTokens(document);
  if (!parsed.ok) return [parsed.error];
  for (const mode of ["base", "dark"]) {
    const tree = mode === "base" ? parsed.tree : treeInMode(parsed.tree, mode);
    const index = indexTree(resolveAliases(tree).tree);
    for (const { fg, bg, min } of legibilityFloors()) {
      const fgValue = index.leaves[fg]?.value;
      const bgValue = index.leaves[bg]?.value;
      if (typeof fgValue !== "string" || typeof bgValue !== "string") continue;
      let ratio: number;
      try {
        ratio = contrastRatio(fgValue, bgValue);
      } catch {
        continue;
      }
      if (ratio < min) {
        const fgShort = fg.startsWith("color.") ? fg.slice("color.".length) : fg;
        const bgShort = bg.startsWith("color.") ? bg.slice("color.".length) : bg;
        issues.push(`${fgShort} on ${bgShort} is ${ratio.toFixed(2)}:1 — text needs ${min}:1`);
      }
    }
  }
  return [...new Set(issues)];
}
