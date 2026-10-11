import { createSignal } from "solid-js";
import { createSpin } from "@spin/hooks/solid";
import type {
  ComboboxHighlightChange,
  ComboboxInputValueChange,
  ComboboxOpenChange,
  ComboboxSelect,
  ComboboxValueChange,
} from "../../../src/spin-combobox/combobox.bridge.ts";

interface ComboboxCommands {
  syncSelectedItems: () => void;
  setHighlightValue: (value: string) => void;
  clearHighlightValue: () => void;
  selectValue: (value: string) => void;
  setValue: (value: readonly string[]) => void;
  setInputValue: (value: string) => void;
  clearValue: (value?: string) => void;
  focus: () => void;
  setOpen: (open: boolean) => void;
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

const CITIES: Item[] = [
  { value: "amsterdam", label: "Amsterdam" },
  { value: "athens", label: "Athens" },
  { value: "austin", label: "Austin" },
  { value: "berlin", label: "Berlin" },
  { value: "boston", label: "Boston" },
  { value: "cairo", label: "Cairo" },
];

/**
 * Combobox on the forked FSM: the input-plus-listbox machine with four phases.
 *
 * The claim under test: Zag's `closed.{idle,focused}` and
 * `open.{interacting,suggesting}` nest as four flat states, the `open`
 * parent's handlers become the fork's root tier with the two closed states
 * shadowing the entries they do not inherit, and the inline completion is
 * context rather than a DOM write. The collection stays the host's, so the
 * filtering below is a Solid signal — which is exactly the contract Zag's
 * combobox leaves to the application.
 */
export default function ComboboxFsm() {
  const [value, setValue] = createSignal("svelte");
  const [highlighted, setHighlighted] = createSignal("none");
  const [typed, setTyped] = createSignal("");
  const [open, setOpen] = createSignal("closed");
  const [selects, setSelects] = createSignal(0);
  const [opens, setOpens] = createSignal(0);
  const [toppings, setToppings] = createSignal("none");
  const [inline, setInline] = createSignal("");
  const [panelOpen, setPanelOpen] = createSignal(false);

  /** The host owns filtering: the collection is the element's input, and the
   * text that drives it is the machine's, reported up as it changes. */
  const [query, setQuery] = createSignal("");
  const matches = (): Item[] => {
    const needle = query().trim().toLowerCase();
    if (needle.length === 0) return FRAMEWORKS;
    return FRAMEWORKS.filter((item) => item.label.toLowerCase().includes(needle));
  };

  const single = createSpin<
    { items: Item[]; label: string; placeholder: string; defaultValue: string; multiple: boolean },
    ComboboxCommands
  >(
    "spin-combobox-fsm",
    () => ({
      items: matches(),
      label: "Framework",
      placeholder: "Search a framework",
      defaultValue: "svelte",
      multiple: false,
    }),
    {
      "value-change": (event: CustomEvent<ComboboxValueChange>) =>
        setValue(event.detail.value.join(", ") || "none"),
      "highlight-change": (event: CustomEvent<ComboboxHighlightChange>) =>
        setHighlighted(event.detail.highlightedValue ?? "none"),
      "input-value-change": (event: CustomEvent<ComboboxInputValueChange>) => {
        setTyped(event.detail.inputValue);
        setQuery(event.detail.inputValue);
      },
      "open-change": (event: CustomEvent<ComboboxOpenChange>) => {
        setOpen(event.detail.open ? "open" : "closed");
        if (event.detail.open) setOpens((n) => n + 1);
      },
      select: (event: CustomEvent<ComboboxSelect>) => setSelects((n) => n + 1),
    },
  );

  const multiple = createSpin<
    { items: Item[]; label: string; multiple: boolean; closeOnSelect: boolean },
    ComboboxCommands
  >(
    "spin-combobox-fsm",
    () => ({ items: TOPPINGS, label: "Toppings", multiple: true, closeOnSelect: false }),
    {
      "value-change": (event: CustomEvent<ComboboxValueChange>) =>
        setToppings(event.detail.value.join(", ") || "none"),
    },
  );

  const completing = createSpin<
    { items: Item[]; label: string; inputBehavior: string; openOnKeyPress: boolean },
    ComboboxCommands
  >(
    "spin-combobox-fsm",
    () => ({ items: CITIES, label: "City", inputBehavior: "autocomplete", openOnKeyPress: true }),
    {
      "value-change": (event: CustomEvent<ComboboxValueChange>) =>
        setInline(event.detail.value.join(", ") || "none"),
    },
  );

  const controlled = createSpin<
    { items: Item[]; label: string; open: boolean; placeholder: string },
    ComboboxCommands
  >(
    "spin-combobox-fsm",
    () => ({ items: CITIES, label: "Controlled open", open: panelOpen(), placeholder: "Opens from outside" }),
    {
      "open-change": (event: CustomEvent<ComboboxOpenChange>) => setPanelOpen(event.detail.open),
    },
  );

  const button =
    "rounded-lg border border-border bg-surface-raised px-3 py-1.5 text-sm font-medium text-text shadow-sm transition-colors hover:bg-surface";

  return (
    <section>
      <h2 class="text-xl mb-1">Combobox — forked FSM</h2>
      <p class="text-muted mb-4">
        Type to filter the host collection, then drive the panel with the arrows — Down and Up walk the enabled rows
        (wrapping, because <code>loopFocus</code> is on), Home and End jump to the extremes, Enter selects the
        highlight, Escape steps out of a suggestion and an outside press dismisses. The trigger toggles the panel, the
        clear button empties the selection, and the host owns the filtering: the collection is an input, so the text
        that drives it is the machine's own, reported up as it changes.
      </p>

      <div class="grid gap-8 sm:grid-cols-2">
        <div>
          <h3 class="mb-2 text-sm font-medium text-text">Single, grouped, host-filtered</h3>
          <spin-combobox-fsm
            id="frameworks"
            ref={single.ref}
            prop:items={matches()}
            prop:label="Framework"
            prop:placeholder="Search a framework"
            prop:defaultValue="svelte"
          />
          <p class="mt-1 text-xs text-muted">
            {matches().length} of {FRAMEWORKS.length} rows match “{query()}”.
          </p>
        </div>
        <div>
          <h3 class="mb-2 text-sm font-medium text-text">Multiple, stays open</h3>
          <spin-combobox-fsm
            id="toppings"
            ref={multiple.ref}
            prop:items={TOPPINGS}
            prop:label="Toppings"
            prop:multiple={true}
            prop:closeOnSelect={false}
          />
        </div>
        <div>
          <h3 class="mb-2 text-sm font-medium text-text">Inline autocomplete</h3>
          <spin-combobox-fsm
            id="cities"
            ref={completing.ref}
            prop:items={CITIES}
            prop:label="City"
            prop:inputBehavior="autocomplete"
          />
        </div>
        <div>
          <h3 class="mb-2 text-sm font-medium text-text">Controlled open</h3>
          <spin-combobox-fsm
            id="controlled"
            ref={controlled.ref}
            prop:items={CITIES}
            prop:label="Controlled open"
            prop:open={panelOpen()}
            prop:placeholder="Opens from outside"
          />
          <div class="mt-2 flex gap-2">
            <button type="button" class={button} onClick={() => setPanelOpen((v) => !v)}>
              {panelOpen() ? "close from host" : "open from host"}
            </button>
          </div>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-3 mt-8">
        <button type="button" class={button} onClick={() => single.commands().setOpen(true)}>
          el.setOpen(true)
        </button>
        <button type="button" class={button} onClick={() => single.commands().setOpen(false)}>
          el.setOpen(false)
        </button>
        <button type="button" class={button} onClick={() => single.commands().selectValue("deno")}>
          el.selectValue("deno")
        </button>
        <button type="button" class={button} onClick={() => single.commands().setValue(["react", "vue"])}>
          el.setValue([...])
        </button>
        <button type="button" class={button} onClick={() => single.commands().setInputValue("sve")}>
          el.setInputValue("sve")
        </button>
        <button type="button" class={button} onClick={() => single.commands().clearValue()}>
          el.clearValue()
        </button>
        <button type="button" class={button} onClick={() => single.commands().focus()}>
          el.focus()
        </button>
      </div>

      <div class="mt-4 text-sm text-muted font-mono tabular-nums">
        <div>
          value: <span id="combobox-value">{value()}</span> · toppings:{" "}
          <span id="combobox-toppings">{toppings()}</span> · inline:{" "}
          <span id="combobox-inline">{inline()}</span>
        </div>
        <div>
          highlighted: <span id="combobox-highlighted">{highlighted()}</span> · typed:{" "}
          <span id="combobox-typed">{typed()}</span> · panel: <span id="combobox-open">{open()}</span> · selects:{" "}
          <span id="combobox-selects">{selects()}</span> · opens: <span id="combobox-opens">{opens()}</span>
        </div>
      </div>
    </section>
  );
}
