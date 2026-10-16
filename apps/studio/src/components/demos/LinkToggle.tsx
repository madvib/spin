import { linkedFor, setLinked } from "../../lib/lockstep.ts";

/**
 * Whether a group's values move together.
 *
 * Linked — the default — one row's track sets that row and every sibling by
 * the same ratio, because a scale is one decision rather than fourteen.
 * Unlinked, a step is wrong on its own and moves alone.
 */
export default function LinkToggle(props: { group: string }) {
  const linked = () => linkedFor(props.group);
  return (
    <button
      type="button"
      class="row-sm shrink-0 rounded-md border border-border px-2 py-1 text-xs text-text-muted"
      classList={{ "bg-surface-raised": linked() }}
      aria-pressed={linked()}
      title={linked()
        ? "Linked: one step's track moves every step by the same ratio"
        : "Unlinked: each step moves alone"}
      onClick={() => setLinked(props.group, !linked())}
    >
      <span
        class={`inline-block icon-sm shrink-0 ${
          linked() ? "i-lucide-link-2" : "i-lucide-unlink"
        }`}
        aria-hidden="true"
      />
      {linked() ? "Linked" : "Unlinked"}
    </button>
  );
}
