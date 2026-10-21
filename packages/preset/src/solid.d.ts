/**
 * The spin element vocabulary, for TypeScript.
 *
 * A spin primitive is an element, not a class: `<card>` carries the base the
 * way `<button>` does, and a consumer writing one in TSX needs the name in
 * `JSX.IntrinsicElements` or the compiler rejects the tag while the runtime
 * happily creates it.
 *
 * `export {}` is load-bearing. It is what makes this a module augmentation
 * rather than an ambient module declaration — without it TypeScript reads
 * `declare module "solid-js"` as shadowing the resolved module, which took
 * the framework's exports with it and surfaced as 48 errors on
 * `createResource`. With it, the two declarations merge and both the
 * framework's and ours are visible.
 *
 * The upward direction is declared but unused: this file augments, never
 * imports, so the preset stays renderer-neutral and the file needs
 * `solid-js` nowhere. It is placed in the preset because it augments
 * whatever framework a consumer has picked, and pointing here from any
 * app's own `.d.ts` chain is enough.
 *
 * The authoritative list is the rules' `ctx.symbols.selector` — the same
 * source the manifest reads. If a primitive is added there and not here, the
 * compiler says so at the call site, which is the right way to learn.
 */

/** What every spin element accepts: the element's own attributes. */
interface SpinElementAttributes {
  /** Standard element attributes the framework passes through. */
  class?: string;
  id?: string;
  role?: string;
  title?: string;
  hidden?: boolean;
  /** `variant` is how alert and badge choose their tone. */
  variant?: string;
  /** `open` on a details, `disabled` where the element has it. */
  open?: boolean;
  disabled?: boolean;
  /** Whatever the element carries. */
  [attribute: string]: unknown;
}

export {};

declare module "solid-js" {
  namespace JSX {
    interface IntrinsicElements {
      alert: SpinElementAttributes;
      avatar: SpinElementAttributes;
      "avatar-group": SpinElementAttributes;
      badge: SpinElementAttributes;
      breadcrumbs: SpinElementAttributes;
      card: SpinElementAttributes;
      details: SpinElementAttributes;
      dialog: SpinElementAttributes;
      fieldset: SpinElementAttributes;
      group: SpinElementAttributes;
      icon: SpinElementAttributes;
      join: SpinElementAttributes;
      label: SpinElementAttributes;
      meter: SpinElementAttributes;
      popover: SpinElementAttributes;
      progress: SpinElementAttributes;
      prose: SpinElementAttributes;
      radio: SpinElementAttributes;
      rating: SpinElementAttributes;
      skeleton: SpinElementAttributes;
      stat: SpinElementAttributes;
      tooltip: SpinElementAttributes;
    }
  }
}
