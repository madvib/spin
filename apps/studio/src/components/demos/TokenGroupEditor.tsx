import { For } from "solid-js";
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
  tokens: TokenRow[];
  /** Applies an edit. Returns false when the theme refused it. */
  onEdit: (path: string[], value: string) => boolean;
  /** Shows each token's own utility at the head of its row. */
  swatch?: boolean;
}) {
  // The whole group rides on every row: the slider's ceiling is the
  // group's top, so the rows' thumbs line up as the ramp they belong to.
  const values = () => props.tokens.map((row) => row.value);
  return (
    <div class="stack-sm">
      <For each={props.tokens}>
        {(row) => (
          <Row
            row={row}
            onEdit={props.onEdit}
            swatch={props.swatch}
            group={values()}
            variable={row.variable}
          />
        )}
      </For>
    </div>
  );
}
