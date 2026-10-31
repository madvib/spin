import { createMemo, For, Show } from "solid-js";
import type { TokenRow } from "../../lib/tokens";
import Row from "./TokenRow.tsx";

/**
 * A group of tokens, one row each.
 *
 * Nothing here draws: the row is the shared component, so a change to how a
 * token is presented reaches the colours page and the spacing page at the
 * same moment. This file exists because eight routes render the same shape
 * and the shape needed a name.
 */
export default function TokenGroupEditor(props: {
  tokens: readonly TokenRow[];
  /** Applies an edit. Returns false when the theme refused it. */
  onEdit: (path: string[], value: string) => boolean;
  /** Shows each token's own utility at the head of its row. */
  swatch?: boolean;
  /** Reports a value a row's control proposes while dragged. */
  onPreview?: (path: string, value: string) => void;
  /** Reports a drag abandoned before it committed. */
  onCancel?: () => void;
  /** Returns the live proposed value for a path while the group is dragged. */
  shown?: (path: string, committed: string) => string;
}) {
  // The whole group rides on every row: the slider's ceiling is the
  // group's top, so the rows' thumbs line up as the ramp they belong to.
  const values = () => props.tokens.map((row) => row.value);
  const paths = createMemo(
    () => props.tokens.map((row) => row.path),
    undefined,
    {
      equals: (a, b) => a.length === b.length && a.every((v, i) => v === b[i]),
    },
  );
  return (
    <div class="stack-sm">
      <For each={paths()}>
        {(path) => {
          const row = createMemo(() =>
            props.tokens.find((token) => token.path === path),
          );
          return (
            <Show when={row()}>
              {(current) => (
                <Row
                  row={current()}
                  onEdit={props.onEdit}
                  swatch={props.swatch}
                  group={values()}
                  variable={current().variable}
                  onPreview={props.onPreview}
                  onCancel={props.onCancel}
                  proposed={props.shown?.(current().path, current().value)}
                />
              )}
            </Show>
          );
        }}
      </For>
    </div>
  );
}
