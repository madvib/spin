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
    <span class="inline-flex items-center">
      <button
        type="button"
        class="secondary s-sm row-sm shrink-0 type-caption text-text-muted"
        classList={{
          "bg-transparent": !linked(),
          "border-primary": linked(),
        }}
        aria-pressed={linked()}
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
          {(factor) => <span class="type-code text-primary">{factor()}</span>}
        </Show>
      </button>
      <tooltip class="end-0 start-auto translate-none">
        {linked()
          ? "Linked: one step moves every step by the same ratio"
          : "Unlinked: each step moves alone"}
      </tooltip>
    </span>
  );
}
