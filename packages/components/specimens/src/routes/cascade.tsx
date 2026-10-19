import { createEffect, createSignal } from "solid-js";
import { createSpinComponent } from "@spin/hooks/solid";
import type { CascadeCommands } from "../../../src/spin-cascade-select/cascade.bindings.ts";
import { DEMO_BUTTON } from "../demo-button.ts";
import { DemoCard } from "../demo-card.tsx";
import { DemoControls } from "../demo-controls.tsx";
import { DemoGrid } from "../demo-grid.tsx";
import { DemoReadout } from "../demo-readout.tsx";

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
  const [cascadeEl, setCascadeEl] = createSignal<HTMLElement>();
  const cascade = createSpinComponent<CascadeCommands>(cascadeEl);

  // The app controller: props down (the collection arrives as JSON text, the
  // scope grammar having no recursive type), events up with cleanup.
  createEffect(() => {
    const ctl = cascade();
    if (ctl === undefined) return undefined;
    return ctl.bind(
      {
        label: "Location",
        name: "location",
      },
      {
        "value-change": (event: CustomEvent<{ value: string[][] }>) =>
          {
            const next = event.detail.value[0];
            setValue(next === undefined ? [] : next);
            setChanges((n) => n + 1);
          },
        "highlight-change": (event: CustomEvent<{ highlightedValue: string[] }>) =>
          setHighlighted(event.detail.highlightedValue),
        "open-change": (event: CustomEvent<{ open: boolean }>) =>
          setOpen(event.detail.open),
      },
    );
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
          setCascadeEl(node);
          // The collection is read during build: it lands before connect.
          (node as CascadeElement).collection = JSON.stringify(TREE);
        }}
      />
      <DemoControls>
        <button
          type="button"
          class={DEMO_BUTTON}
          onClick={() => cascade()?.commands.setOpen(true)}
        >
          el.setOpen(true)
        </button>
        <button
          type="button"
          class={DEMO_BUTTON}
          onClick={() => cascade()?.commands.setValue([["asia", "india", "haryana"]])}
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
