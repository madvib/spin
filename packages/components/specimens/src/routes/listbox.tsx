import { createEffect, createSignal } from "solid-js";
import { createSpinComponent } from "@spin/hooks/solid";
import type {
  ListboxHighlightChange,
  ListboxSelect,
  ListboxValueChange,
} from "../../../src/spin-listbox/listbox.bindings.ts";
import { DEMO_BUTTON } from "../demo-button.ts";
import { DemoCard } from "../demo-card.tsx";
import { DemoControls } from "../demo-controls.tsx";
import { DemoGrid } from "../demo-grid.tsx";
import { DemoReadout } from "../demo-readout.tsx";
import "./spin-listbox.html";

interface ListboxCommands {
  syncSelectedItems: () => void;
  setHighlightValue: (value: string) => void;
  clearHighlightValue: () => void;
  selectValue: (value: string) => void;
  setValue: (value: readonly string[]) => void;
  selectAll: () => void;
  clearValue: (value?: string) => void;
  highlightFirst: () => void;
  highlightLast: () => void;
  highlightNext: () => void;
  highlightPrevious: () => void;
}

/** Items as the element's object-array scope type carries them. */
interface Item {
  readonly value: string;
  readonly label: string;
  readonly disabled?: boolean;
  readonly group?: string;
}

const FRAMEWORKS: Item[] = [
  { value: "react", label: "React", group: "Libraries" },
  { value: "vue", label: "Vue", group: "Libraries" },
  { value: "svelte", label: "Svelte", group: "Libraries" },
  { value: "angular", label: "Angular", disabled: true, group: "Libraries" },
  { value: "deno", label: "Deno", group: "Runtimes" },
  { value: "bun", label: "Bun", group: "Runtimes" },
  { value: "node", label: "Node", group: "Runtimes" },
];

const TOPPINGS: Item[] = [
  { value: "cheese", label: "Cheese" },
  { value: "olives", label: "Olives" },
  { value: "anchovy", label: "Anchovy" },
  { value: "pineapple", label: "Pineapple", disabled: true },
  { value: "basil", label: "Basil" },
];

/**
 * Listbox on the forked FSM: a single idle state with guards.
 *
 * The claim under test: Zag's one-state machine ports as one flat state,
 * the CONTENT.FOCUS guard defaults the highlight to the selection when
 * there is one and the first item when there is not, and navigation
 * computes its target in the view while the machine commits it.
 */
export default function ListboxFsm() {
  const [value, setValue] = createSignal("none");
  const [highlighted, setHighlighted] = createSignal("none");
  const [selects, setSelects] = createSignal(0);
  const [toppings, setToppings] = createSignal("none");

  const [singleEl, setSingle] = createSignal<HTMLElement>();
  const single = createSpinComponent<ListboxCommands>(singleEl);
  createEffect(() => {
    const ctl = single();
    if (ctl === undefined) return undefined;
    return ctl.bind({
      items: FRAMEWORKS,
      label: "Framework",
      defaultValue: "svelte",
    }, {
      "value-change": (event: CustomEvent<ListboxValueChange>) =>
        setValue(event.detail.value.join(", ") || "none"),
      "highlight-change": (event: CustomEvent<ListboxHighlightChange>) =>
        setHighlighted(event.detail.highlightedValue ?? "none"),
      select: (_event: CustomEvent<ListboxSelect>) => setSelects((n) => n + 1),
    });
  });

  const [multipleEl, setMultiple] = createSignal<HTMLElement>();
  const multiple = createSpinComponent<ListboxCommands>(multipleEl);
  createEffect(() => {
    const ctl = multiple();
    if (ctl === undefined) return undefined;
    return ctl.bind({
      items: TOPPINGS,
      label: "Toppings",
      multiple: true,
      selectionBehavior: "preserve",
    }, {
      "value-change": (event: CustomEvent<ListboxValueChange>) =>
        setToppings(event.detail.value.join(", ") || "none"),
    });
  });

  return (
    <DemoGrid>
      <DemoCard
        title="Single, grouped"
        width="md"
        note="The commands below drive this instance."
      >
        <spin-listbox
          id="frameworks"
          ref={setSingle}
          prop:items={FRAMEWORKS}
          prop:label="Framework"
          prop:defaultValue="svelte"
        />
        <DemoControls>
          <button
            type="button"
            class={DEMO_BUTTON}
            onClick={() => single()?.commands.highlightFirst()}
          >
            el.highlightFirst()
          </button>
          <button
            type="button"
            class={DEMO_BUTTON}
            onClick={() => single()?.commands.highlightLast()}
          >
            el.highlightLast()
          </button>
          <button
            type="button"
            class={DEMO_BUTTON}
            onClick={() => single()?.commands.selectValue("deno")}
          >
            el.selectValue("deno")
          </button>
          <button
            type="button"
            class={DEMO_BUTTON}
            onClick={() => single()?.commands.clearValue()}
          >
            el.clearValue()
          </button>
        </DemoControls>
        <DemoReadout>
          value: {value()} · highlighted: {highlighted()} · selects: {selects()}
        </DemoReadout>
      </DemoCard>

      <DemoCard
        title="Multiple"
        width="md"
        note="Shift-click extends the range; ctrl+A selects all enabled."
      >
        <spin-listbox
          id="toppings"
          ref={setMultiple}
          prop:items={TOPPINGS}
          prop:label="Toppings"
          prop:multiple={true}
          prop:selectionBehavior="preserve"
        />
        <DemoControls>
          <button
            type="button"
            class={DEMO_BUTTON}
            onClick={() => multiple()?.commands.selectAll()}
          >
            el.selectAll()
          </button>
          <button
            type="button"
            class={DEMO_BUTTON}
            onClick={() => multiple()?.commands.clearValue()}
          >
            el.clearValue()
          </button>
        </DemoControls>
        <DemoReadout>
          toppings: {toppings()}
        </DemoReadout>
      </DemoCard>
    </DemoGrid>
  );
}
