/**
 * This app's markup uses the spin element vocabulary directly, so it needs
 * the names in `JSX.IntrinsicElements` or the compiler rejects the tags the
 * runtime happily creates.
 *
 * `import "solid-js"` is load-bearing: without it the augmentation is a
 * declaration in search of a module.
 */
import "solid-js";

/** What every spin element accepts: the element's own attributes. */
interface SpinElementAttributes {
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

declare module "solid-js" {
  namespace JSX {
    interface IntrinsicElements {
      alert: SpinElementAttributes;
      avatar: SpinElementAttributes;
      "avatar-group": SpinElementAttributes;
      badge: SpinElementAttributes;
      breadcrumbs: SpinElementAttributes;
      card: SpinElementAttributes;
      group: SpinElementAttributes;
      icon: SpinElementAttributes;
      join: SpinElementAttributes;
      popover: SpinElementAttributes;
      prose: SpinElementAttributes;
      rating: SpinElementAttributes;
      skeleton: SpinElementAttributes;
      stat: SpinElementAttributes;
      tooltip: SpinElementAttributes;
    }
  }
}
