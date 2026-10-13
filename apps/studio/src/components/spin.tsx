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
 * 3. `innerHTML`, which is how the reference app already renders example
 *    markup, and the only one that compiles. Text is escaped on the way in.
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

/** What a bound element accepts: its own attributes plus the tone. */
export interface SpinProps {
  /** `variant` is how alert and badge choose their tone. */
  variant?: string;
  /** Extra classes, the same way a utility class would apply. */
  class?: string;
  /** A body, when it is not passed as `text`. */
  children?: string;
}

/** Escapes text for interpolation into markup. */
function escape(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Renders a spin tag from a text body.
 *
 * A span rather than the tag itself: an `<alert>` in the studio's chrome is
 * a message, and putting the rule's base on a host span keeps the markup
 * valid for the browser's parser either way.
 */
function spinTag(tag: string, props: SpinProps, text: string) {
  const variant = props.variant === undefined
    ? ""
    : ` variant="${escape(props.variant)}"`;
  const classes = props.class === undefined
    ? ""
    : ` class="${escape(props.class)}"`;
  return (
    <span
      class={props.class}
      innerHTML={`<${tag}${variant}${classes}>${escape(text)}</${tag}>`}
    />
  );
}

/** A status message with the alert rule's base and tone. */
export function Alert(props: SpinProps & { text: string }) {
  return spinTag("alert", props, props.text);
}

/** A card surface — the panel a token row or a section sits on. */
export function Card(props: SpinProps & { text?: string }) {
  return spinTag("card", props, props.text ?? "");
}

/** A small tone label — a swatch's role name, a token's type. */
export function Badge(props: SpinProps & { text: string }) {
  return spinTag("badge", props, props.text);
}

export { escape as escapeMarkup };
