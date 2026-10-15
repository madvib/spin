import { createEffect, createSignal } from "solid-js";
import { createSpinComponent } from "@spin/hooks/solid";
import { DemoCard, DemoControls, DEMO_BUTTON, DemoGrid, DemoReadout } from "../demo.tsx";

interface TooltipCommands {
  show(): void;
  hide(): void;
}

/**
 * Tooltip on the platform: a native popover panel opened by hover dwell
 * and focus, positioned against the trigger. The dwell clocks are the
 * `hover-delay` action and the geometry is the `anchor` action — the
 * attach only maps both onto the native methods. No machine, no bridge.
 */
export default function Tooltip() {
  const [open, setOpen] = createSignal(false);

  const [tooltipEl, setTooltipEl] = createSignal<HTMLElement>();
  const tooltip = createSpinComponent<TooltipCommands>(tooltipEl);
  createEffect(() => {
    const ctl = tooltip();
    if (ctl === undefined) return undefined;
    return ctl.bind({ label: "Hover me", tip: "A tip that arrives after the dwell." }, {
      "open-change": (event: CustomEvent<{ open: boolean }>) => setOpen(event.detail.open),
    });
  });

  return (
    <DemoGrid>
      <DemoCard
        title="Platform-owned: native tooltip"
        width="sm"
        note="Dwell opens, leaving closes, focus opens at once. The browser owns the panel."
      >
        <spin-tooltip
          id="demo-tooltip"
          ref={(node: HTMLElement) => {
            setTooltipEl(node);
            node.setAttribute("label", "Hover me");
            node.setAttribute("tip", "A tip that arrives after the dwell.");
          }}
        />
        <DemoControls>
          <button type="button" class={DEMO_BUTTON} onClick={() => tooltip()?.commands.show()}>
            el.show()
          </button>
          <button type="button" class={DEMO_BUTTON} onClick={() => tooltip()?.commands.hide()}>
            el.hide()
          </button>
        </DemoControls>
        <DemoReadout>
          open: <span id="tooltip-open">{open() ? "true" : "false"}</span>
        </DemoReadout>
      </DemoCard>
    </DemoGrid>
  );
}
