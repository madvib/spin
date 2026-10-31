import type { ClassDoc } from "./example.ts";

export interface SwatchExample {
  readonly name: string;
  readonly html: string;
}

const row = (inner: string): string =>
  `<div class="flex flex-wrap items-center gap-2">
${inner}
        </div>`;

export const swatchFixtureNote =
  "A bordered dot painted from --swatch; size via s-sm/s-md/s-lg.";

export const SWATCH_CLASSES: readonly ClassDoc[] = [
  {
    name: "<swatch>",
    kind: "Component",
    description: "Color dot; bordered shape painted from the --swatch variable",
  },
  {
    name: ".s-sm",
    kind: "Size",
    description: "Small dot for inline rows and legends",
  },
  {
    name: ".s-md",
    kind: "Size",
    description: "Default dot size",
  },
  {
    name: ".s-lg",
    kind: "Size",
    description: "Large dot for palettes and pickers",
  },
];

export const SWATCH_EXAMPLES: readonly SwatchExample[] = [
  {
    name: "Dot in a list row",
    html: row(
      `          <swatch style="--swatch: #3b82f6" class="s-md" aria-label="blue"></swatch>
          <span>Primary</span>`,
    ),
  },
  {
    name: "Palette",
    html: row(
      `          <swatch style="--swatch: #3b82f6" class="s-lg" aria-label="blue"></swatch>
          <swatch style="--swatch: #22c55e" class="s-lg" aria-label="green"></swatch>
          <swatch style="--swatch: #eab308" class="s-lg" aria-label="yellow"></swatch>
          <swatch style="--swatch: #ef4444" class="s-lg" aria-label="red"></swatch>
          <swatch style="--swatch: #a855f7" class="s-lg" aria-label="purple"></swatch>`,
    ),
  },
  {
    name: "Sized variants",
    html: row(
      `          <swatch style="--swatch: #ef4444" class="s-sm" aria-label="small"></swatch>
          <swatch style="--swatch: #22c55e" class="s-md" aria-label="medium"></swatch>
          <swatch style="--swatch: #eab308" class="s-lg" aria-label="large"></swatch>`,
    ),
  },
];
