import { createSignal, onMount } from "solid-js";
import type { CascadeCommands } from "../../../src/spin-cascade-select/cascade.bridge.ts";

interface CascadeElement extends HTMLElement {
  /** The tree crosses as JSON text: the scope grammar has no recursive type. */
  collection?: string;
  label?: string;
  name?: string;
  multiple?: boolean;
  defaultOpen?: boolean;
  allowParentSelection?: boolean;
}

/** A continent → country → city tree: three levels, one disabled city. */
interface DemoNode {
  value: string;
  label: string;
  disabled?: boolean;
  children?: DemoNode[];
}

const TREE: DemoNode[] = [
  {
    value: "asia",
    label: "Asia",
    children: [
      {
        value: "india",
        label: "India",
        children: [
          { value: "haryana", label: "Haryana" },
          { value: "karnataka", label: "Karnataka" },
          { value: "punjab", label: "Punjab", disabled: true },
        ],
      },
      {
        value: "china",
        label: "China",
        children: [
          { value: "beijing", label: "Beijing" },
          { value: "shanghai", label: "Shanghai" },
        ],
      },
    ],
  },
  {
    value: "europe",
    label: "Europe",
    children: [
      {
        value: "france",
        label: "France",
        children: [
          { value: "paris", label: "Paris" },
          { value: "lyon", label: "Lyon" },
        ],
      },
      {
        value: "germany",
        label: "Germany",
        children: [
          { value: "berlin", label: "Berlin", disabled: true },
          { value: "munich", label: "Munich" },
        ],
      },
    ],
  },
];

const labelOf = (...path: string[]): string => {
  const walk = (nodes: readonly DemoNode[], at: number): string | undefined => {
    for (const node of nodes) {
      if (node.value === path[at]) {
        return at === path.length - 1 ? node.label : walk(node.children ?? [], at + 1);
      }
    }
    return undefined;
  };
  return walk(TREE, 0) ?? path.join(" / ");
};

/**
 * Cascade-select on the forked FSM: the level stack IS the highlight.
 *
 * The claim under test: Zag's machine walks a TreeCollection to answer
 * "what is the next enabled sibling" and "is the highlighted node at the root
 * level". Here the view owns that tree walk and the machine holds two value
 * paths, so the config stays data. Keyboard and mouse run the same machine:
 * arrows drill in and out, Home/End take the edges, Enter commits, Escape
 * returns focus to the trigger. The level stack grows with the highlight, and
 * the highlighted row scrolls itself into view through the scroll reflex.
 */
export default function CascadeFsm() {
  const [value, setValue] = createSignal<string[]>([]);
  const [highlighted, setHighlighted] = createSignal<string[]>([]);
  const [open, setOpen] = createSignal(false);
  const [changes, setChanges] = createSignal(0);
  let el: CascadeElement | undefined;

  onMount(() => {
    if (!el) return;
    el.addEventListener("value-change", (event) => {
      const detail = (event as CustomEvent<{ value: string[][] }>).detail;
      const next = detail.value[0];
      setValue(next === undefined ? [] : next);
      setChanges((n) => n + 1);
    });
    el.addEventListener("highlight-change", (event) => {
      const detail = (event as CustomEvent<{ highlightedValue: string[] }>).detail;
      setHighlighted(detail.highlightedValue);
    });
    el.addEventListener("open-change", (event) => {
      setOpen((event as CustomEvent<{ open: boolean }>).detail.open);
    });
  });

  const button =
    "rounded-lg border border-border bg-surface-raised px-4 py-2 text-sm font-medium text-text shadow-sm transition-colors duration-fast hover:bg-surface";

  return (
    <section>
      <h2 class="text-xl mb-1">Cascade select — forked FSM</h2>
      <p class="text-muted mb-4">
        Click the trigger, or focus it and press ArrowDown. Arrows drill into a branch and back out, Home/End take a level's
        edges, Enter commits a leaf, Escape returns focus to the trigger.
      </p>

      <div class="flex flex-wrap items-center gap-3 mb-4">
        <button
          type="button"
          class={button}
          onClick={() => {
            const commands = el as unknown as CascadeCommands | undefined;
            commands?.setOpen(true);
          }}
        >
          el.setOpen(true)
        </button>
        <button
          type="button"
          class={button}
          onClick={() => {
            const commands = el as unknown as CascadeCommands | undefined;
            commands?.setValue([["asia", "india", "haryana"]]);
          }}
        >
          el.setValue([…])
        </button>
      </div>

      <spin-cascade-select-fsm
        ref={(node: HTMLElement) => {
          el = node as CascadeElement;
          el.collection = JSON.stringify(TREE);
          el.label = "Location";
          el.name = "location";
        }}
      />

      <div class="mt-4 text-sm text-muted font-mono">
        <div>
          value: <span id="cascade-value">{value().length === 0 ? "—" : labelOf(...value())}</span>
        </div>
        <div>
          highlighted: <span id="cascade-highlighted">{highlighted().length === 0 ? "none" : highlighted().join(" / ")}</span>
        </div>
        <div>
          open: <span id="cascade-open">{open() ? "true" : "false"}</span> · value-change:{" "}
          <span id="cascade-changes">{changes()}</span>
        </div>
      </div>
      <p class="mt-4 text-sm text-muted">
        The component carries a hidden input that submits as <code>location</code> when it sits in a form.
      </p>
    </section>
  );
}
