import { A } from "@solidjs/router";
import type { JSX } from "solid-js";

/**
 * The component gallery keeps a side list of links. The landmark carries the
 * labels; the items are an ordered list, so a screen reader can count them.
 */
const ITEMS = [
  ["button", "Button"],
  ["card", "Card"],
  ["field", "Field"],
  ["modal", "Modal"],
] as const;

export default function ComponentsLayout(props: { children?: JSX.Element }) {
  return (
    <div class="flex flex-1 min-h-0">
      <nav
        aria-label="Components"
        class="flex flex-col gap-4 overflow-y-auto p-4 bg-surface-raised"
      >
        <ul>
          {ITEMS.map(([href, label]) => (
            <li>
              <A href={`/components/${href}`}>{label}</A>
            </li>
          ))}
        </ul>
      </nav>
      {props.children}
    </div>
  );
}
