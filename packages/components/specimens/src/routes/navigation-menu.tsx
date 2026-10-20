import { createEffect, createSignal } from "solid-js";
import { createSpinComponent } from "@spin/hooks/solid";
import { DemoCard } from "../demo-card.tsx";
import { DemoGrid } from "../demo-grid.tsx";
import { DemoReadout } from "../demo-readout.tsx";
import "./spin-navigation-menu.html";

interface NavCommands {
  show(value: string): void;
  hide(): void;
  toggle(value: string): void;
}

const NAV_ITEMS = [
  { value: "docs", label: "Docs" },
  { value: "guides", label: "Guides" },
  { value: "reference", label: "Reference" },
];

/**
 * Navigation-menu: the closed/open modes with the dwell clocks, and the
 * value channel that drives the slide. The panel lives inside its item's
 * row, so moving from the link into the panel never leaves the hover.
 */
export default function NavigationMenu() {
  const [value, setValue] = createSignal("");

  const [navEl, setNav] = createSignal<HTMLElement>();
  const nav = createSpinComponent<NavCommands>(navEl);
  createEffect(() => {
    const ctl = nav();
    if (ctl === undefined) return undefined;
    return ctl.bind({ items: JSON.stringify(NAV_ITEMS) }, {
      "value-change": (e: CustomEvent<{ value: string }>) => setValue(e.detail.value),
    });
  });

  return (
    <DemoGrid>
      <DemoCard
        title="Hover navigation"
        width="lg"
        note="Hover an item to open its panel after the dwell; moving between items swaps; leaving both closes after the grace."
      >
        <spin-navigation-menu
          id="nav"
          ref={setNav}
          prop:items={JSON.stringify(NAV_ITEMS)}
        />
        <DemoReadout>
          value: <span id="nav-value">{value()}</span>
        </DemoReadout>
      </DemoCard>
    </DemoGrid>
  );
}
