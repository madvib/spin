import { createSignal, onMount } from "solid-js";
import type { CascadeCommands } from "../../../src/spin-cascade-select/cascade.bridge.ts";
import { DEMO_BUTTON, DemoCard, DemoControls, DemoGrid, DemoReadout } from "../demo.tsx";

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
        return at === path.length - 1
          ? node.label
          : walk(node.children ?? [], at + 1);
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
      const detail =
        (event as CustomEvent<{ highlightedValue: string[] }>).detail;
      setHighlighted(detail.highlightedValue);
    });
    el.addEventListener("open-change", (event) => {
      setOpen((event as CustomEvent<{ open: boolean }>).detail.open);
    });
  });

  return (
    <DemoGrid>
      <DemoCard
      title="Location"
      width="md"
      note="The component carries a hidden input that submits as location when it sits in a form."
    >
      <spin-cascade-select
        ref={(node: HTMLElement) => {
          el = node as CascadeElement;
          el.collection = JSON.stringify(TREE);
          el.label = "Location";
          el.name = "location";
        }}
      />
      <DemoControls>
        <button
          type="button"
          class={DEMO_BUTTON}
          onClick={() => {
            const commands = el as unknown as CascadeCommands | undefined;
            commands?.setOpen(true);
          }}
        >
          el.setOpen(true)
        </button>
        <button
          type="button"
          class={DEMO_BUTTON}
          onClick={() => {
            const commands = el as unknown as CascadeCommands | undefined;
            commands?.setValue([["asia", "india", "haryana"]]);
          }}
        >
          el.setValue([…])
        </button>
      </DemoControls>
      <DemoReadout>
        <div>
          value:{" "}
          <span id="cascade-value">
            {value().length === 0 ? "—" : labelOf(...value())}
          </span>
        </div>
        <div>
          highlighted:{" "}
          <span id="cascade-highlighted">
            {highlighted().length === 0 ? "none" : highlighted().join(" / ")}
          </span>
        </div>
        <div>
          open: <span id="cascade-open">{open() ? "true" : "false"}</span>{" "}
          · value-change: <span id="cascade-changes">{changes()}</span>
        </div>
      </DemoReadout>
    </DemoCard>
    </DemoGrid>
  );
}
