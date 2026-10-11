import { createSignal } from "solid-js";
import { createSpin } from "@spin/hooks/solid";

interface SelectCommands {
  open(): void;
  close(): void;
  toggle(): void;
  selectValue(value: string): void;
  setValue(value: string[]): void;
  clearValue(): void;
  focus(): void;
}

/** The item tree crosses the property channel as JSON text: the scope
 * grammar has no recursive type, and a label-less item is its own label. */
const ITEMS = [
  { value: "deno", label: "Deno" },
  { value: "bun", label: "Bun" },
  { value: "node", label: "Node.js" },
  { value: "porter", label: "Porter", disabled: true },
];

/**
 * Select on the owned machine: three modes (closed, closed-and-focused,
 * open), the selection and the highlight on the root tier, and every reflex
 * an action — dismissable outside, scroll-into-view on the list, form-control
 * on the hidden select.
 */
export default function Select() {
  const [selected, setSelected] = createSignal<string[]>([]);
  const [openCount, setOpenCount] = createSignal(0);

  const single = createSpin<{ items: typeof ITEMS }, SelectCommands>(
    "spin-select",
    () => ({ items: ITEMS, label: "Runtime" }),
    {
      "value-change": (e: CustomEvent<{ value: string[] }>) => setSelected(e.detail.value),
      "open-change": (e: CustomEvent<{ open: boolean }>) => {
        if (e.detail.open) setOpenCount((n) => n + 1);
      },
    },
  );

  return (
    <section>
      <div class="grid gap-8 sm:grid-cols-2">
        <div>
          <h3 class="mb-2 text-sm font-medium text-text">Single select</h3>
          <spin-select id="single" ref={single.ref} prop:items={ITEMS} prop:label="Runtime" prop:name="runtime" />
        </div>
        <div>
          <h3 class="mb-2 text-sm font-medium text-text">Multiple select</h3>
          <spin-select
            id="multi"
            prop:items={ITEMS}
            prop:label="Runtimes"
            prop:multiple={true}
            prop:defaultValue={["deno", "bun"]}
          />
        </div>
      </div>
      <div class="mt-4 flex flex-wrap items-center gap-3 text-sm text-muted">
        <button
          type="button"
          class="rounded-lg border border-border bg-surface-raised px-4 py-2 text-sm font-medium text-text shadow-sm transition-colors hover:bg-surface"
          onClick={() => single.commands().selectValue("bun")}
        >
          el.selectValue("bun")
        </button>
        <button
          type="button"
          class="rounded-lg border border-border bg-surface-raised px-4 py-2 text-sm font-medium text-text shadow-sm transition-colors hover:bg-surface"
          onClick={() => single.commands().open()}
        >
          el.open()
        </button>
        <button
          type="button"
          class="rounded-lg border border-border bg-surface-raised px-4 py-2 text-sm font-medium text-text shadow-sm transition-colors hover:bg-surface"
          onClick={() => single.commands().clearValue()}
        >
          el.clearValue()
        </button>
        <span>
          value: <span id="select-value">{selected().join(", ") || "none"}</span> · opens:{" "}
          <span id="select-opens">{openCount()}</span>
        </span>
      </div>
    </section>
  );
}
