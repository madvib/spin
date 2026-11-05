/**
 * Full-width workspace layout for `/studio` and `/playground`.
 */
import type { JSX } from "solid-js";

export function WorkspaceLayout(props: { children: JSX.Element }): JSX.Element {
  return (
    <div class="flex h-full min-h-0 flex-col overflow-y-auto bg-surface font-sans text-md">
      <div class="min-h-0 flex-1">{props.children}</div>
    </div>
  );
}
