import type { JSX } from "solid-js";

/** A row of quiet controls. Demo layout, not a card part: it renders inside
 * the card's content in every route, and a footer nested in content would
 * close padding the surface never opened. */
export function DemoControls(props: { children: JSX.Element }) {
  return (
    <div class="mt-4 flex flex-wrap items-center gap-2">{props.children}</div>
  );
}
