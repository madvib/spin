import { Show } from "solid-js";
import { linkedFor, setLinked } from "../../lib/lockstep.ts";

/**
 * Whether a group's values move together.
 *
 * Linked — the default — one row's track sets that row and every sibling by
 * the same ratio, because a scale is one decision rather than fourteen.
 * Unlinked, a step is wrong on its own and moves alone.
 */
export default function LinkToggle(
  props: { group: string; ratio?: string },
) {
  const linked = () => linkedFor(props.group);
  return (
    <button
      type="button"
      class="secondary s-sm row-sm shrink-0 text-xs text-text-muted"
      classList={{
        "bg-transparent": !linked(),
        "border-primary text-text": linked(),
      }}
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
      <span>{linked() ? "Linked" : "Unlinked"}</span>
      <Show when={linked() && props.ratio}>
        {(factor) => <span class="font-mono text-primary">{factor()}</span>}
      </Show>
    </button>
  );
}
