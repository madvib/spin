import { createSignal } from "solid-js";
import { createSpin } from "@spin/hooks/solid";
import type {
  ListboxHighlightChange,
  ListboxSelect,
  ListboxValueChange,
} from "../../../src/spin-listbox/listbox.bridge.ts";

interface ListboxCommands {
  selectValue: (value: string) => void;
  setValue: (value: readonly string[]) => void;
  selectAll: () => void;
  clearValue: (value?: string) => void;
  highlightValue: (value: string) => void;
  clearHighlightedValue: () => void;
  highlightFirst: () => void;
  highlightLast: () => void;
  highlightNext: () => void;
  highlightPrevious: () => void;
  focus: () => void;
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
];

const TOPPINGS: Item[] = [
  { value: "cheese", label: "Cheese" },
  { value: "olives", label: "Olives" },
  { value: "anchovy", label: "Anchovy" },
  { value: "pineapple", label: "Pineapple", disabled: true },
];

const COLORS: Item[] = [
  { value: "red", label: "Red" },
  { value: "amber", label: "Amber" },
  { value: "green", label: "Green" },
  { value: "teal", label: "Teal" },
  { value: "blue", label: "Blue" },
  { value: "violet", label: "Violet" },
  { value: "pink", label: "Pink" },
];

/**
 * Listbox on the forked FSM: the low-level selection machine behind a custom
 * select.
 *
 * The claim under test: Zag's single `idle` state becomes this fork's root
 * tier plus a `focused` state, the selection arithmetic is a table of pure
 * assigns, and the keyboard map — including a grid's column walk — is a view
 * concern that computes its target and sends an event.
 */
export default function ListboxFsm() {
  const [value, setValue] = createSignal("svelte");
  const [highlighted, setHighlighted] = createSignal("none");
  const [selects, setSelects] = createSignal(0);
  const [toppings, setToppings] = createSignal("none");
  const [disabled, setDisabled] = createSignal(false);
  const [gridValue, setGridValue] = createSignal("red");

  const single = createSpin<
    {
      items: Item[];
      label: string;
      defaultValue: string;
      selectionMode: string;
      disabled: boolean;
    },
    ListboxCommands
  >(
    "spin-listbox-fsm",
    () => ({ items: FRAMEWORKS, label: "Pick a framework", defaultValue: "svelte", selectionMode: "single", disabled: disabled() }),
    {
      "value-change": (event: CustomEvent<ListboxValueChange>) => setValue(event.detail.value.join(", ") || "none"),
      "highlight-change": (event: CustomEvent<ListboxHighlightChange>) =>
        setHighlighted(event.detail.highlightedValue ?? "none"),
      select: (event: CustomEvent<ListboxSelect>) => setSelects((n) => n + 1),
    },
  );

  const multiple = createSpin<
    { items: Item[]; label: string; selectionMode: string },
    ListboxCommands
  >(
    "spin-listbox-fsm",
    () => ({ items: TOPPINGS, label: "Pick your toppings", selectionMode: "multiple" }),
    {
      "value-change": (event: CustomEvent<ListboxValueChange>) =>
        setToppings(event.detail.value.join(", ") || "none"),
      select: (event: CustomEvent<ListboxSelect>) => setSelects((n) => n + 1),
    },
  );

  const grid = createSpin<{ items: Item[]; label: string; columnCount: number }, ListboxCommands>(
    "spin-listbox-fsm",
    () => ({ items: COLORS, label: "Pick a color", columnCount: 3 }),
    {
      "value-change": (event: CustomEvent<ListboxValueChange>) => setGridValue(event.detail.value.join(", ") || "none"),
    },
  );

  const button =
    "rounded-lg border border-border bg-surface-raised px-4 py-2 text-sm font-medium text-text shadow-sm transition-colors hover:bg-surface";

  return (
    <section>
      <h2 class="text-xl mb-1">Listbox — forked FSM</h2>
      <p class="text-muted mb-4">
        Click a row, or focus the list and use the arrows — Up and Down walk the enabled rows, Home and End jump to
        the extremes, printable letters typeahead, Enter and Space select, ctrl/cmd+a selects all in a multi mode
        and Escape clears. Shift extends a range in the multi modes; the grid walks a column with Up and Down.
      </p>

      <div class="grid gap-6 sm:grid-cols-2">
        <div>
          <h3 class="mb-2 text-sm font-medium text-text">Single, grouped</h3>
          <spin-listbox-fsm
            id="frameworks"
            ref={single.ref}
            prop:items={FRAMEWORKS}
            prop:label="Pick a framework"
            prop:defaultValue="svelte"
            prop:selectionMode="single"
            prop:disabled={disabled()}
          />
        </div>
        <div>
          <h3 class="mb-2 text-sm font-medium text-text">Multiple</h3>
          <spin-listbox-fsm
            id="toppings"
            ref={multiple.ref}
            prop:items={TOPPINGS}
            prop:label="Pick your toppings"
            prop:selectionMode="multiple"
          />
        </div>
        <div>
          <h3 class="mb-2 text-sm font-medium text-text">Grid, three columns</h3>
          <spin-listbox-fsm
            id="colors"
            ref={grid.ref}
            prop:items={COLORS}
            prop:label="Pick a color"
            prop:columnCount={3}
            prop:defaultValue="red"
          />
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-3 mt-6">
        <button type="button" class={button} onClick={() => single.commands().highlightFirst()}>
          el.highlightFirst()
        </button>
        <button type="button" class={button} onClick={() => single.commands().selectAll()}>
          el.selectAll()
        </button>
        <button type="button" class={button} onClick={() => single.commands().setValue(["react", "vue"])}>
          el.setValue(["react", "vue"])
        </button>
        <button type="button" class={button} onClick={() => single.commands().clearValue()}>
          el.clearValue()
        </button>
        <button type="button" class={button} onClick={() => single.commands().focus()}>
          el.focus()
        </button>
        <button type="button" class={button} onClick={() => setDisabled((d) => !d)}>
          {disabled() ? "enable" : "disable"}
        </button>
      </div>

      <div class="mt-4 text-sm text-muted font-mono tabular-nums">
        <div>
          value: <span id="listbox-value">{value()}</span> · toppings:{" "}
          <span id="listbox-toppings-value">{toppings()}</span>
        </div>
        <div>
          highlighted: <span id="listbox-highlighted">{highlighted()}</span> · selects:{" "}
          <span id="listbox-selects">{selects()}</span>
        </div>
        <div>
          grid value: <span id="listbox-grid-value">{gridValue()}</span>
        </div>
      </div>
    </section>
  );
}
