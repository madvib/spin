/**
 * Panel examples — the markup a consumer writes, beside the rule that
 * styles it.
 *
 * A bare `<panel>` carries the floating surface; `<panel-list>` is the
 * option column inside it. Every class used here resolves against the
 * preset's own catalog; the self-resolution test fails the suite if an
 * example demonstrates what the package cannot do.
 */
import type { ClassDoc } from "./example.ts";

export const PANEL_CLASSES: readonly ClassDoc[] = [
  {
    name: "<panel>",
    kind: "Component",
    description: "Floating surface: rounded, bordered, raised, elevated, padded",
  },
  {
    name: "<panel-list>",
    kind: "Part",
    description: "Option column: vertical stack with gaps between rows",
  },
];

export interface PanelExample {
  /** What this example is showing. Rendered as the row's label. */
  readonly name: string;
  /** The markup, exactly as a consumer would write it. */
  readonly html: string;
}

export const panelFixtureNote =
  "The surface every dropdown, menu, and popover shares: one rounded bordered raised panel, one spaced option column — not six hand-rolled copies.";

export const PANEL_EXAMPLES: readonly PanelExample[] = [
  {
    name: "Panel · options",
    html: `<panel>
      <panel-list>
        <button class="bare w-full px-2 py-1 text-left">Asia</button>
        <button class="bare w-full px-2 py-1 text-left">Europe</button>
      </panel-list>
    </panel>`,
  },
];
