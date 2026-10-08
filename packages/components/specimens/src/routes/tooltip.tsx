import { SpinTooltip } from "../components/SpinTooltip.tsx";

export default function TooltipSpecimen() {
  return (
    <section>
      <h2 class="text-xl mb-1">Tooltip</h2>
      <p class="text-muted mb-4">
        Hover the trigger to open the tooltip; the Zag machine owns open/close state.
      </p>

      <div class="flex items-center gap-3 mb-4">
        <SpinTooltip openDelay={200} closeDelay={100} />
      </div>
    </section>
  );
}
