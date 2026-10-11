import { For } from "solid-js";
import type { TokenRow } from "../../lib/tokens";
import ValueInput from "./ValueInput";

/** `color.neutral.50` -> `neutral-50`, the utility suffix the swatch needs. */
function tokenSuffix(path: string): string {
  return path.split(".").slice(1).join("-").toLowerCase();
}

export default function ColorEditor(props: {
  tokens: TokenRow[];
  /** Applies an edit. Returns false when the theme refused it. */
  onEdit: (path: string[], value: string) => boolean;
}) {
  return (
    <div class="flex flex-col gap-4">
      <For each={props.tokens}>
        {(row) => (
          <div class="flex items-center gap-4 bg-surface-raised rounded-lg shadow-sm p-4 border border-border">
            <div class={`h-8 w-16 shrink-0 bg-${tokenSuffix(row.path)}`} />
            <div class="flex flex-col gap-4">
              <code class="text-sm">{row.path}</code>
              <div class="flex items-center gap-4">
                <ValueInput
                  value={row.value}
                  type={row.type}
                  onCommit={(value) => props.onEdit(row.path.split("."), value)}
                />
              </div>
            </div>
          </div>
        )}
      </For>
    </div>
  );
}
