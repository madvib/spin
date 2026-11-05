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

import { createMemo, Show } from "solid-js";
import type { TokenRow } from "../../lib/tokens";
import { tokenStatus } from "../../lib/live-edit.ts";
import {
  activeMode,
  activeName,
  refusalFor,
  registry,
  themeText,
} from "../../lib/store.ts";
import ValueInput from "./ValueInput.tsx";

/** `color.neutral.50` → `neutral-50`, the utility suffix a swatch spends. */
function tokenSuffix(path: string): string {
  return path.split(".").slice(1).join("-").toLowerCase();
}

export default function TokenRow_(props: {
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
  /** Live proposed value when a linked sibling in the group is being dragged. */
  proposed?: string;
}) {
  const id = () => `token-${props.row.path}`;
  const projectText = () =>
    registry()?.find((theme) => theme.name === activeName())?.text;
  const status = createMemo(() =>
    tokenStatus(themeText(), projectText(), props.row.path, activeMode())
  );
  return (
    <>
      <card class="min-h-12 flex-row items-center justify-between gap-4 px-3 py-2">
        <div class="row-sm min-w-0">
          <Show when={props.swatch ?? false}>
            <div
              class={`h-8 w-16 shrink-0 rounded-sm bg-${tokenSuffix(props.row.path)}`}
            />
          </Show>
          <label for={id()} class="truncate">
            {props.row.path}
          </label>
          <Show when={status().aliasOf}>
            {(target) => (
              <span
                class="rounded-sm bg-surface-sunken px-1 py-0 type-code text-text-muted"
                title={`Points at ${target()}`}
              >
                → {target()}
              </span>
            )}
          </Show>
          <Show when={activeMode() === "dark" && status().restatedInDark}>
            <span
                class="rounded-sm bg-surface-sunken px-1 py-0 text-accent"
              title="Overridden in dark mode"
            >
              dark
            </span>
          </Show>
          <Show when={status().modified}>
            <span
                class="rounded-sm bg-surface-sunken px-1 py-0 text-primary"
              title="Modified in this session"
            >
              edited
            </span>
          </Show>
        </div>
        <div class="row-sm min-w-0 shrink-0 items-center justify-end gap-2">
          <ValueInput
            id={id()}
            value={props.row.value}
            type={props.row.type}
            label={props.row.path}
            onCommit={(value) => props.onEdit(props.row.path.split("."), value)}
            group={props.group}
            variable={props.variable ?? props.row.variable}
            onPreview={props.onPreview === undefined
              ? undefined
              : (value) => props.onPreview!(props.row.path, value)}
            onCancel={props.onCancel}
            proposed={props.proposed}
          />
        </div>
      </card>
      {
        /* The refusal belongs beside the control that asked for the value:
          the banner at the top of the work is a different line of sight. */
      }
      <Show when={refusalFor(props.row.path)}>
        {(message) => (
          <p class="text-semantic-error" role="alert">
            {message()}
          </p>
        )}
      </Show>
    </>
  );
}
