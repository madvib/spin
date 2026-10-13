/**
 * One token: its name, what it looks like, and the only control that
 * changes it.
 *
 * A `<Card>`, not a repetition of the classes that draw one: the row spends
 * the theme's own surface, radius, elevation and edge tokens, so editing a
 * theme redraws the tool you are editing it with — you watch a change land
 * on a surface before you scroll to a specimen.
 *
 * A swatch is optional and is the one row-specific thing. Colour rows show
 * the token's own utility applied at its own size; every other row shows the
 * control alone. It lives here rather than in a second component because
 * two components rendering one concept is how the colours page ended up
 * with its own markup and its own spacing while the other routes shared this
 * one, and neither could see the other drift.
 */

import { Show } from "solid-js";
import type { TokenRow } from "../../lib/tokens";
import ValueInput from "./ValueInput.tsx";
import { Card } from "../spin.tsx";

/** `color.neutral.50` → `neutral-50`, the utility suffix a swatch spends. */
function tokenSuffix(path: string): string {
  return path.split(".").slice(1).join("-").toLowerCase();
}

export default function TokenRow_({
  row,
  onEdit,
  swatch = false,
}: {
  row: TokenRow;
  /** Applies an edit. Returns false when the theme refused it. */
  onEdit: (path: string[], value: string) => boolean;
  /** Shows the token's own utility at the head of the row. */
  swatch?: boolean;
}) {
  const id = `token-${row.path}`;
  return (
    <Card class="split p-4">
      <div class="row-sm">
        <Show when={swatch}>
          <div
            class={`h-8 w-16 shrink-0 rounded-sm bg-${tokenSuffix(row.path)}`}
          />
        </Show>
        <label for={id} class="font-mono text-sm">
          {row.path}
        </label>
      </div>
      <div class="row-sm shrink-0">
        <ValueInput
          id={id}
          value={row.value}
          type={row.type}
          onCommit={(value) => onEdit(row.path.split("."), value)}
        />
      </div>
    </Card>
  );
}
