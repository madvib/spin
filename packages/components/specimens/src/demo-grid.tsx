import type { JSX } from "solid-js";

/** The examples grid: cards wrap, so a lone example fills its row and a
 * pair sits two-up. The card grows; the component inside stays bounded. */
export function DemoGrid(props: { children: JSX.Element }) {
  return <div class="grid gap-6 md:grid-cols-2">{props.children}</div>;
}
