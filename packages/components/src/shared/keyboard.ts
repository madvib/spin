/**
 * Shared keyboard intent vocabulary for roving-selection components.
 *
 * A typed table maps physical keys to a small intent set; the consumer
 * owns neighbor resolution, focus moves, and loop policy. This keeps the
 * machine-agnostic key mapping in one place while component-specific
 * behavior stays in the def.
 *
 * Tabs is the first consumer: both axes, loop wrap, automatic activation.
 * A menu-shaped consumer would additionally need orientation (horizontal
 * vs vertical axis selection), non-looping bounds, and per-key modifiers
 * (e.g. typeahead) — none of which are expressible here yet; record as a
 * gap rather than force-fitting.
 */

/** The intent a key expresses in a roving selection. */
export type KeyIntent =
  | { readonly intent: "next" }
  | { readonly intent: "prev" }
  | { readonly intent: "first" }
  | { readonly intent: "last" };

/** A key → intent table; missing keys are simply not handled. */
export type KeyTable = Readonly<Record<string, KeyIntent | undefined>>;

/** Roving keys on both axes with implicit loop wrap (tabs' model). */
export const ROVING_KEYS: KeyTable = {
  ArrowRight: { intent: "next" },
  ArrowDown: { intent: "next" },
  ArrowLeft: { intent: "prev" },
  ArrowUp: { intent: "prev" },
  Home: { intent: "first" },
  End: { intent: "last" },
};
