import { createSignal, onMount } from "solid-js";
import { DEMO_BUTTON, DemoCard, DemoControls, DemoReadout } from "../demo.tsx";

type TreeElement = HTMLElement & {
  nodes?: string;
  expandedValue?: string[];
  loadChildren?: (value: string) => Promise<TreeNode[]>;
};

interface TreeNode {
  value: string;
  label: string;
  children?: TreeNode[];
}

/** Lazy branches declare no children; the host loads them on first expand. */
const LAZY: TreeNode[] = [
  { value: "repo", label: "spin-runtime" },
];

const loadChildren = async (value: string): Promise<TreeNode[]> => {
  await new Promise((resolve) => setTimeout(resolve, 400));
  if (value !== "repo") return [];
  return [
    { value: "repo/src", label: "src" },
    { value: "repo/cfg", label: "deno.json" },
  ];
};

/** A realistic tree: three levels, a branch that starts expanded, leaves at
 * every depth — the hierarchy is the point of the demo. */
const TREE: TreeNode[] = [
  {
    value: "src",
    label: "packages",
    children: [
      {
        value: "components",
        label: "components",
        children: [
          { value: "combobox", label: "combobox", children: [] },
          { value: "select", label: "select", children: [] },
          {
            value: "dialog",
            label: "dialog",
            children: [
              { value: "dialog-def", label: "machine-def.ts", children: [] },
              { value: "dialog-bridge", label: "bridge.ts", children: [] },
              { value: "dialog-connect", label: "connect.ts", children: [] },
            ],
          },
        ],
      },
      { value: "runtime", label: "runtime", children: [] },
      { value: "preset", label: "preset", children: [] },
    ],
  },
  { value: "readme", label: "README.md", children: [] },
  ...LAZY,
];

/**
 * Tree-view on the forked FSM: the hard Zag machine, ported.
 *
 * The claim under test: a component with per-node state, ~30 events,
 * keyboard navigation, and lazy loading is *smaller and more legible* as
 * config + pure assigns + a view layer that owns flattening — than as a
 * Zag machine with its collection, refs, and DOM-query helpers.
 */
export default function TreeViewFsm() {
  const [expanded, setExpanded] = createSignal<string[]>([]);
  const [selected, setSelected] = createSignal<string[]>([]);
  const [status, setStatus] = createSignal(
    "focus a row and use arrows / * / typeahead",
  );
  // Controlled alternation: writing this property is a host write (the
  // authored-prop predicate sees it), so the machine follows it.
  const [controlled, setControlled] = createSignal(false);
  const [multi, setMulti] = createSignal(false);
  let el: TreeElement | undefined;

  onMount(() => {
    if (!el) return;
    el.addEventListener("expanded-change", (e) => {
      setExpanded([
        ...(e as CustomEvent<{ expandedValue: string[] }>).detail.expandedValue,
      ]);
    });
    el.addEventListener("selection-change", (e) => {
      setSelected([
        ...(e as CustomEvent<{ selectedValue: string[] }>).detail.selectedValue,
      ]);
    });
    // The status line reports the last key the machine answered, so a
    // reader sees the keyboard path they are exercising.
    el.addEventListener("keydown", (e) => {
      setStatus(`key: ${(e as KeyboardEvent).key}`);
    });
  });

  return (
    <DemoCard
      title="Per-node state, ~30 events, lazy branches"
      width="lg"
      note="A hard machine as config plus pure assigns and a view layer that owns flattening. The status line is the last key the machine answered."
    >
      <div class="mb-2 flex items-center gap-2 px-1">
        <span class="text-xs font-semibold uppercase tracking-wider text-text-muted">
          Explorer
        </span>
        <span class="text-xs text-text-muted">spin-runtime</span>
      </div>
      <spin-tree-view
        prop:selectionMode={multi() ? "multiple" : "single"}
        prop:defaultExpandedValue={["src", "components"]}
        ref={(node) => {
          el = node as TreeElement;
          el.nodes = JSON.stringify(TREE);
          el.loadChildren = loadChildren;
        }}
      />
      <DemoControls>
        <button
          type="button"
          class={DEMO_BUTTON}
          onClick={() => setMulti((m) => !m)}
        >
          {multi() ? "selectionMode: multiple" : "selectionMode: single"}
        </button>
        <button
          type="button"
          class={DEMO_BUTTON}
          onClick={() => {
            const next = !controlled();
            setControlled(next);
            // A real host write: property, not attribute.
            if (el) el.expandedValue = next ? ["src", "components"] : [];
          }}
        >
          {controlled()
            ? "clear controlled expandedValue"
            : "control expandedValue = [src, components]"}
        </button>
      </DemoControls>
      <DemoReadout>
        <div>expanded: {expanded().join(", ") || "—"}</div>
        <div>selected: {selected().join(", ") || "—"}</div>
        <div>{status()}</div>
      </DemoReadout>
    </DemoCard>
  );
}
