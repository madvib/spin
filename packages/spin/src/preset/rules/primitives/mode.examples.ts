/**
 * Mode examples — the markup a consumer writes, beside the rule that
 * styles it.
 *
 * A mode switch is `class="mode"` on a button: the button's own rule gives
 * it the box, the edge and the hover lift, and the `mode` class adds the
 * icon-step face and the disabled statement. There are three states a host
 * cycles and one disabled shape: enabled (what the app shows when there are
 * modes to cycle), disabled with `disabled`, and disabled with
 * `aria-disabled="true"` for a host that cannot disable the element itself
 * but can still say it does nothing.
 */

export interface ModeExample {
  /** What this example is showing. Rendered as the row's label. */
  readonly name: string;
  /** The markup, exactly as a consumer would write it. */
  readonly html: string;
}

export const modeFixtureNote =
  'One button that cycles a theme\'s modes: `class="mode"` adds the icon-step face to the button base and dims the control when there is nothing to cycle.';

export const MODE_EXAMPLES: readonly ModeExample[] = [
  {
    name: "Enabled",
    html: `<button type="button" class="mode" aria-label="Use dark mode">
  <i class="i-lucide-moon icon-md"></i>
</button>`,
  },
  {
    name: "Disabled",
    html:
      `<button type="button" class="mode" disabled aria-label="Use dark mode">
  <i class="i-lucide-moon icon-md"></i>
</button>`,
  },
  {
    name: "Aria-disabled",
    html:
      `<button type="button" class="mode" aria-disabled="true" aria-label="Use dark mode">
  <i class="i-lucide-moon icon-md"></i>
</button>`,
  },
];
