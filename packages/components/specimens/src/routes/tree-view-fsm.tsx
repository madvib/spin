import { createSignal, onMount } from "solid-js";

type TreeElement = HTMLElement & { nodes?: string; expandedValue?: string[] };

interface TreeNode {
  value: string;
  label: string;
  children?: TreeNode[];
}

const TREE: TreeNode[] = [
  {
    value: "src",
    label: "src",
    children: [
      {
        value: "src/components",
        label: "components",
        children: [
          { value: "accordion", label: "accordion.tsx" },
          { value: "tabs", label: "tabs.tsx" },
        ],
      },
      {
        value: "src/runtime",
        label: "runtime",
        children: [{ value: "signal", label: "signal.ts" }],
      },
    ],
  },
  {
    value: "packages",
    label: "packages",
    children: [
      { value: "core", label: "core" },
      { value: "preset", label: "preset" },
    ],
  },
  { value: "readme", label: "README.md" },
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
  const [status, setStatus] = createSignal("focus a row and use arrows / * / typeahead");
  const [expanded, setExpanded] = createSignal<string[]>([]);
  const [selected, setSelected] = createSignal<string[]>([]);
  // Controlled alternation: writing this property is a host write (the
  // authored-prop predicate sees it), so the machine follows it.
  const [controlled, setControlled] = createSignal(false);
  let el: TreeElement | undefined;

  onMount(() => {
    if (!el) return;
    el.addEventListener("expanded-change", (e) => {
      setExpanded([...(e as CustomEvent<{ expandedValue: string[] }>).detail.expandedValue]);
    });
    el.addEventListener("selection-change", (e) => {
      setSelected([...(e as CustomEvent<{ selectedValue: string[] }>).detail.selectedValue]);
    });
  });

  return (
    <section>
      <h2 class="text-xl mb-1">Tree view — forked FSM</h2>
      <p class="text-muted mb-4">
        Config-first machine, view-owned flattening. Arrows move, <kbd>*</kbd> expands all, typeahead jumps,
        Enter selects.
      </p>
      <button
        type="button"
        class="rounded-lg border border-border bg-surface-raised px-4 py-2 text-sm font-medium text-text shadow-sm transition-colors hover:bg-surface"
        onClick={() => {
          const next = !controlled();
          setControlled(next);
          // A real host write: property, not attribute.
          if (el) el.expandedValue = next ? ["src", "packages"] : [];
        }}
      >
        {controlled() ? "clear controlled expandedValue" : "control expandedValue = [src, packages]"}
      </button>

      <spin-tree-view-fsm
        ref={(node) => {
          el = node as TreeElement;
          el.nodes = JSON.stringify(TREE);
        }}
      />
      <div class="mt-4 text-sm text-muted font-mono">
        <div>expanded: {expanded().join(", ") || "—"}</div>
        <div>selected: {selected().join(", ") || "—"}</div>
        <div>{status()}</div>
      </div>
    </section>
  );
}
