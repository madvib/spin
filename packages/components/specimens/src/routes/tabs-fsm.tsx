import { createSignal } from "solid-js";
import { createSpin } from "@spin/hooks/solid";

interface TabsCommands {
  select: (value: string | null) => void;
  focus: (value: string) => void;
}

const ITEMS = [
  { value: "one", label: "One", content: "First panel body." },
  { value: "two", label: "Two", content: "Second panel body." },
  { value: "three", label: "Three", content: "Third panel body." },
  { value: "off", label: "Off", content: "Fourth panel body.", disabled: true },
];

/**
 * Tabs on the forked FSM: selection + focus, two states, keyboard wired in
 * the connect. Automatic activation (the default) selects as focus moves;
 * arrows, Home, End and the disabled row all behave per the WAI-ARIA tabs
 * pattern the Zag machine implements.
 */
export default function TabsFsm() {
  const [selected, setSelected] = createSignal<string | null>(null);
  const [focused, setFocused] = createSignal<string | null>(null);
  const tabs = createSpin<{ items: typeof ITEMS }, TabsCommands>(
    "spin-tabs-fsm",
    () => ({ items: ITEMS }),
    {
      "value-change": (e) => setSelected(e.detail.value),
      "focus-change": (e) => setFocused(e.detail.focusedValue),
    },
  );

  return (
    <section>
      <h2 class="text-xl mb-1">Tabs — forked FSM</h2>
      <p class="text-muted mb-4">
        Arrows move and select (automatic activation), Home/End jump, the disabled tab is skipped.
      </p>
      <spin-tabs-fsm ref={tabs.ref} />
      <div class="mt-4 flex items-center gap-3 text-sm text-muted">
        <button
          type="button"
          class="rounded-lg border border-border bg-surface-raised px-4 py-2 text-sm font-medium text-text shadow-sm transition-colors hover:bg-surface"
          onClick={() => tabs.commands().select("three")}
        >
          el.select("three")
        </button>
        <span>
          selected: <span id="tabs-selected">{selected() ?? "none"}</span> · focused:{" "}
          <span id="tabs-focused">{focused() ?? "none"}</span>
        </span>
      </div>
    </section>
  );
}
