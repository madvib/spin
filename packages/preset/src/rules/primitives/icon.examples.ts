/**
 * Icon examples — the markup a consumer writes, beside the rule that
 * styles it.
 *
 * An icon's size is a token a theme decides, not a number someone wrote
 * down: `icon-sm`, `icon-md` and `icon-lg` spend `icon.sm`, `icon.md` and
 * `icon.lg` from the theme's `icon` group — dimensions a theme states in `em`,
 * so a size step scales with the control it sits in rather than pinning the
 * glyph to one absolute length. The size is a font-size, and that is forced
 * by the layers: the glyph these classes size is an icon class from
 * `@unocss/preset-icons`, which sizes itself `1em` in the `icons` layer — a
 * layer the `primitives` layer cannot beat at equal specificity, so a width
 * or height stated here would be dead the moment an icon class is present.
 * `font-size` is the one lever that reaches it. `icon-md` is the default
 * restated as a class: the button's slot already spends `icon.md`, so
 * writing it changes nothing until a theme says otherwise. Every class used
 * here resolves against the preset's own catalog; the self-resolution test
 * fails the suite if an example demonstrates what the package cannot do.
 */

export interface IconExample {
  /** What this example is showing. Rendered as the row's label. */
  readonly name: string;
  /** The markup, exactly as a consumer would write it. */
  readonly html: string;
}

const row = (inner: string): string =>
  `<div class="flex flex-wrap items-center gap-2">
${inner}
        </div>`;

export const iconFixtureNote =
  "Glyph sizes from the theme's icon ladder, in `em`, so a size step scales with the control it sits in.";

export const ICON_EXAMPLES: readonly IconExample[] = [
  {
    name: "Sizes",
    html: row(
      `          <i class="i-lucide-plus icon-sm"></i>
          <i class="i-lucide-plus icon-md"></i>
          <i class="i-lucide-plus icon-lg"></i>`,
    ),
  },
  {
    name: "In a button",
    html: row(
      `          <button><i class="i-lucide-plus button-icon icon-sm"></i>Save</button>
          <button><i class="i-lucide-plus button-icon icon-md"></i>Save</button>
          <button><i class="i-lucide-plus button-icon icon-lg"></i>Save</button>`,
    ),
  },
  {
    name: "In a button · icon-only",
    html: row(
      `          <button class="icon"><i class="i-lucide-plus button-icon icon-sm"></i></button>
          <button class="icon"><i class="i-lucide-plus button-icon icon-md"></i></button>
          <button class="icon"><i class="i-lucide-plus button-icon icon-lg"></i></button>`,
    ),
  },
  {
    name: "In a badge",
    html: row(
      `          <badge><i class="i-lucide-bell icon-sm"></i>Notifications</badge>
          <badge><i class="i-lucide-bell icon-md"></i>Notifications</badge>
          <badge><i class="i-lucide-bell icon-lg"></i>Notifications</badge>`,
    ),
  },
  {
    name: "In text",
    html:
      `<p>Press the <i class="i-lucide-plus icon-sm"></i> button to continue.</p>
        <p>Press the <i class="i-lucide-plus icon-md"></i> button to continue.</p>
        <p>Press the <i class="i-lucide-plus icon-lg"></i> button to continue.</p>`,
  },
];
