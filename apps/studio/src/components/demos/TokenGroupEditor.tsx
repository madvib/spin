import { For } from "solid-js";
import type { TokenRow } from "../../lib/tokens";
import ValueInput from "./ValueInput";

export default function TokenGroupEditor(props: {
  tokens: TokenRow[];
  /** Applies an edit. Returns false when the theme refused it. */
  onEdit: (path: string[], value: string) => boolean;
}) {
  return (
    <div class="flex flex-col gap-4">
      <For each={props.tokens}>
        {(row) => (
          <div class="flex items-center gap-4 bg-surface-raised rounded-lg shadow-sm p-4 border border-border">
            <code>{row.path}</code>
            <ValueInput
              value={row.value}
              onCommit={(value) => props.onEdit(row.path.split("."), value)}
            />
          </div>
        )}
      </For>
    </div>
  );
}
