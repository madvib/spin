/**
 * The spin element vocabulary, bound for TSX.
 *
 * A spin primitive is an element, not a class: `<card>` carries the base the
 * way `<button>` does. Three ways of writing one, and why this file uses the
 * third:
 *
 * 1. Literal JSX (`<alert>`) works at runtime — Solid's transform creates any
 *    tag — but TypeScript rejects the name, and augmenting `solid-js`'s
 *    `JSX.IntrinsicElements` does not merge under this project's resolution:
 *    it redeclares the module and takes the framework's exports with it,
 *    which showed up as 48 errors on `createResource` for one added tag.
 * 2. `createElement` is not exported by solid-js 1.9 at all — neither typed
 *    nor at runtime — so a wrapper around it is not available.
 * 3. `Dynamic`, which renders the tag properly and keeps children. The
 *    earlier attempt used `innerHTML`, which dropped them and silently
 *    emptied every card.
 *
 * Native elements — `button`, `select`, `label`, `input`, `details`, `table`,
 * `meter`, `progress`, `kbd`, `hr` — need none of this and are used directly
 * throughout the chrome.
 *
 * Worth naming as a gap: a consumer hand-writing our markup in TSX needs the
 * same escape. A generated `@spin/primitives/jsx` package, driven off the
 * rules' `ctx.symbols.selector` — the same source the manifest reads — is the
 * fix, and it is a follow-up rather than something to fold into a chrome pass.
 */

import { Dynamic } from "solid-js/web";

/** What a bound element accepts: its own attributes plus the tone. */
export interface SpinProps {
  /** `variant` is how alert and badge choose their tone. */
  variant?: string;
  /** Extra classes, the same way a utility class would apply. */
  class?: string;
  /** The element's contents. */
  children?: unknown;
}

function spinTag(tag: string, props: SpinProps) {
  // `Dynamic` is the honest escape: it renders an arbitrary tag with the
  // props and children it was given, so a spin element behaves exactly like
  // the native one it stands beside. The earlier attempt went through
  // `innerHTML`, which could not carry children and therefore could not
  // carry a card's contents.
  return (
    <Dynamic component={tag} {...props}>
      {props.children}
    </Dynamic>
  );
}

/** A status message with the alert rule's base and tone. */
export function Alert(props: SpinProps) {
  return spinTag("alert", props);
}

/** A card surface — the panel a section sits on. */
export function Card(props: SpinProps) {
  return spinTag("card", props);
}

/** A small tone label — a process, a ratio, a token's type. */
export function Badge(props: SpinProps) {
  return spinTag("badge", props);
}
