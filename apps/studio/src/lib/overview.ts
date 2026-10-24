/**
 * What the overview shows, derived from the document being edited.
 *
 * A chip is painted by a utility; the hex beside it is resolved here and has
 * to agree with that paint. Resolution composes `valuesInMode` and
 * `aliasTarget` — `resolveAliases` alone ignores modes, so a dark override
 * that is itself a reference would read as reference text.
 */

import { aliasTarget, themeModes, valuesInMode } from "@spinjs/theme";
import type { TokenTree } from "@spinjs/theme";
import { analyzeTheme } from "./theme.ts";
import { groupTokens, toPx } from "./tokens.ts";
import type { TokenRow } from "./tokens.ts";

/** `paint` is written out every time: the scanner reads source, not runtime strings. */
interface ChipSpec {
  readonly path: string;
  readonly paint: string;
  readonly label: string;
}

export interface Chip extends ChipSpec {
  /** The value resolved for the mode being shown. */
  readonly value: string;
}

/** The roles an author checks first, in the order a palette reads. */
const PALETTE: readonly ChipSpec[] = [
  { path: "color.primary", paint: "bg-primary", label: "Primary" },
  { path: "color.secondary", paint: "bg-secondary", label: "Secondary" },
  { path: "color.accent", paint: "bg-accent", label: "Accent" },
  { path: "color.link", paint: "bg-link", label: "Link" },
  {
    path: "color.semantic.success",
    paint: "bg-semantic-success",
    label: "Success",
  },
  {
    path: "color.semantic.warning",
    paint: "bg-semantic-warning",
    label: "Warning",
  },
  { path: "color.semantic.error", paint: "bg-semantic-error", label: "Error" },
  {
    path: "color.semantic.info",
    paint: "bg-semantic-info",
    label: "Info",
  },
];

/** The depth ladder in reading order, not theme order: do these separate? */
const SURFACE_STEPS: readonly ChipSpec[] = [
  {
    path: "color.surface-sunken",
    paint: "bg-surface-sunken",
    label: "Sunken",
  },
  { path: "color.surface", paint: "bg-surface", label: "Page" },
  {
    path: "color.surface-raised",
    paint: "bg-surface-raised",
    label: "Raised",
  },
];

/** One face slot the overview can draw, when the theme declares it. */
export interface Face {
  readonly slot: string;
  readonly paint: string;
  readonly role: string;
  /** The stack the theme spends on this slot, as authored. */
  readonly stack: string;
}

/** The face slots in display order; a slot the theme omits is not shown. */
const FACE_SLOTS: readonly Omit<Face, "stack">[] = [
  {
    slot: "heading",
    paint: "font-heading",
    role: "Headings, and anything that leads",
  },
  { slot: "body", paint: "font-body", role: "Paragraphs, and UI copy" },
  { slot: "sans", paint: "font-sans", role: "The default face" },
  { slot: "serif", paint: "font-serif", role: "Long-form editorial text" },
  {
    slot: "mono",
    paint: "font-mono",
    role: "Code, identifiers, tabular figures",
  },
];

/** What a token is worth in a mode, references followed. Undefined on a loop. */
export function tokenValue(
  tree: TokenTree,
  mode: string,
  path: string,
): string | undefined {
  const effective = valuesInMode(tree, mode);
  const seen = new Set<string>();
  let cursor = path;
  for (;;) {
    if (seen.has(cursor)) return undefined;
    seen.add(cursor);
    const raw = effective.get(cursor);
    if (raw === undefined) return undefined;
    const value = typeof raw === "string" || typeof raw === "number"
      ? String(raw)
      : JSON.stringify(raw);
    const target = aliasTarget(value);
    if (target === null) return value;
    cursor = target;
  }
}

/**
 * The theme's acting colour, in the mode being shown.
 *
 * A specimen wears it, and it wears it as a VALUE: the studio's own sheet
 * wears the theme under edit, so a utility paints the right colour by
 * accident — but a specimen is the theme's value, shown, and a value is
 * data. The studio's own rule, and the reason the palette paints its swatches
 * the same way.
 */
export function actingColour(
  tree: TokenTree,
  mode: string,
): string | undefined {
  return tokenValue(tree, mode, "color.primary");
}

/** The specs this theme declares, each with the value it is worth now. */
function resolve(
  text: string,
  mode: string,
  specs: readonly ChipSpec[],
): Chip[] {
  const tree = analyzeTheme(text).tree;
  if (tree === undefined) return [];
  const out: Chip[] = [];
  for (const spec of specs) {
    const value = tokenValue(tree, mode, spec.path);
    if (value !== undefined) out.push({ ...spec, value });
  }
  return out;
}

/** The palette rows this theme declares, in palette order. */
export function paletteChips(text: string, mode: string): Chip[] {
  return resolve(text, mode, PALETTE);
}

/** One mode's worth of the curated palette, as a summary strip shows it. */
export interface SwatchGroup {
  readonly mode: string;
  readonly chips: readonly Chip[];
}

/**
 * One palette per mode the theme declares, in declaration order.
 *
 * The overview shows EVERY theme, and a chip's utility can only paint the
 * ACTIVE theme's token — which is exactly why every summary strip used to
 * show the same colours. So these chips carry their own resolved values: a
 * foreign document's colour is data, and the strip draws the data. The mode
 * groups are the other half of the question: a theme that declares both
 * modes answers `light` and `dark` separately, and a strip per mode is how
 * an author sees what dark mode will be before switching into it.
 *
 * A document that does not parse claims no modes and shows no palette: an
 * empty answer, because the overview keeps rendering while an author is
 * half-way through typing.
 */
export function summarySwatches(text: string): SwatchGroup[] {
  let declared: readonly string[];
  try {
    declared = themeModes(JSON.parse(text) as Record<string, unknown>);
  } catch {
    return [];
  }
  // No `modes` field means no claim; the base values still deserve a strip,
  // and the studio's word for the base is `light`.
  const modes: readonly string[] = declared.length > 0 ? declared : ["light"];
  return modes.map((mode) => ({ mode, chips: paletteChips(text, mode) }));
}

/** The surface ladder this theme declares, from the page down. */
export function surfaceSteps(text: string, mode: string): Chip[] {
  return resolve(text, mode, SURFACE_STEPS);
}

/** How many steps of a long scale a card shows. */
const STEPS_PER_CARD = 3;

/** The spacing scale sampled to its ends and its middle; zero is dropped. */
export function spaceSteps(text: string, mode: string): TokenRow[] {
  const tree = analyzeTheme(text).tree;
  if (tree === undefined) return [];
  const scale = groupTokens(tree, [["spacing"]], mode).filter((row) =>
    (toPx(row.value) ?? 0) > 0
  );
  if (scale.length <= STEPS_PER_CARD) return scale;
  const first = scale[0];
  const middle = scale[Math.floor(scale.length / 2)];
  const last = scale[scale.length - 1];
  return [first, middle, last].filter((row): row is TokenRow =>
    row !== undefined
  );
}

/** The utility a duration row plays: `motion.duration.base` → `duration-base`. */
export function durationUtility(path: string): string {
  return `duration-${path.split(".").slice(2).join("-")}`;
}

/** What one element of the vocabulary looks like, as the RPC sends it. */
interface ExampleSource {
  readonly name: string;
  readonly examples?: {
    readonly note: string;
    readonly rows: readonly { readonly name: string; readonly html: string }[];
  };
}

export interface ElementSample {
  readonly component: string;
  readonly row: { readonly name: string; readonly html: string };
}

/** How many elements the card samples. */
const ELEMENT_SAMPLES = 3;

/** One row from each of the first few components that have examples to give. */
export function elementSamples(
  components: readonly ExampleSource[],
): ElementSample[] {
  const out: ElementSample[] = [];
  for (const component of components) {
    const row = component.examples?.rows[0];
    if (row === undefined) continue;
    out.push({ component: component.name, row });
    if (out.length >= ELEMENT_SAMPLES) break;
  }
  return out;
}

/** The faces this theme declares, leading with the display face. */
export function faceSpecimens(text: string, mode: string): Face[] {
  const tree = analyzeTheme(text).tree;
  if (tree === undefined) return [];
  const out: Face[] = [];
  for (const slot of FACE_SLOTS) {
    const stack = tokenValue(tree, mode, `font.family.${slot.slot}`);
    if (stack !== undefined) out.push({ ...slot, stack });
  }
  return out;
}
