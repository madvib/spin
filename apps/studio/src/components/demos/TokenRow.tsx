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

/** `color.neutral.50` → `neutral-50`, the utility suffix a swatch spends. */
function tokenSuffix(path: string): string {
  return path.split(".").slice(1).join("-").toLowerCase();
}

export default function TokenRow_({
  row,
  onEdit,
  swatch = false,
  group,
  variable,
  onPreview,
  onCancel,
}: {
  row: TokenRow;
  /** Applies an edit. Returns false when the theme refused it. */
  onEdit: (path: string[], value: string) => boolean;
  /** Shows the token's own utility at the head of the row. */
  swatch?: boolean;
  /** Every value in the token's group, for the slider's ceiling. */
  group?: readonly string[];
  /** The token's custom property, painted on the preview surface while dragging. */
  variable?: string;
  /** Reports a value this row's control proposes while dragged. */
  onPreview?: (path: string, value: string) => void;
  /** Reports a drag abandoned before it committed. */
  onCancel?: () => void;
}) {
  const id = `token-${row.path}`;
  return (
    <card class="split p-2">
      <div class="row-sm min-w-0">
        <Show when={swatch}>
          <div
            class={`h-8 w-16 shrink-0 rounded-sm bg-${tokenSuffix(row.path)}`}
          />
        </Show>
        <label for={id} class="truncate font-mono text-sm">
          {row.path}
        </label>
      </div>
      <div class="row-sm min-w-0 flex-1 flex-wrap justify-end gap-2">
        <ValueInput
          id={id}
          value={row.value}
          type={row.type}
          onCommit={(value) => onEdit(row.path.split("."), value)}
          group={group}
          variable={variable}
          onPreview={onPreview === undefined
            ? undefined
            : (value) => onPreview(row.path, value)}
          onCancel={onCancel}
        />
      </div>
    </card>
  );
}
