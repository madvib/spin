import { createSignal, onMount } from "solid-js";

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
  {
    value: "src",
    label: "src",
    children: [
      { value: "accordion", label: "accordion.tsx" },
      { value: "tabs", label: "tabs.tsx" },
    ],
  },
  { value: "repo", label: "repo (lazy)" },
  { value: "readme", label: "README.md", children: [] },
];

const loadChildren = async (value: string): Promise<TreeNode[]> => {
  await new Promise((resolve) => setTimeout(resolve, 400));
  if (value !== "repo") return [];
  return [
    { value: "repo/pkg", label: "packages" },
    { value: "repo/cfg", label: "deno.json" },
  ];
};

const TREE: TreeNode[] = LAZY;

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
  const [status, setStatus] = createSignal("focus a row and use arrows / * / typeahead");
  // Controlled alternation: writing this property is a host write (the
  // authored-prop predicate sees it), so the machine follows it.
  const [controlled, setControlled] = createSignal(false);
  const [multi, setMulti] = createSignal(false);
  let el: TreeElement | undefined;

  onMount(() => {
    if (!el) return;
    el.addEventListener("expanded-change", (e) => {
      setExpanded([...(e as CustomEvent<{ expandedValue: string[] }>).detail.expandedValue]);
    });
    el.addEventListener("selection-change", (e) => {
      setSelected([...(e as CustomEvent<{ selectedValue: string[] }>).detail.selectedValue]);
    });
    // The status line reports the last key the machine answered, so a
    // reader sees the keyboard path they are exercising.
    el.addEventListener("keydown", (e) => {
      setStatus(`key: ${(e as KeyboardEvent).key}`);
    });
  });

  return (
    <section>
      <button
        type="button"
        class="rounded-lg border border-border bg-surface-raised px-4 py-2 text-sm font-medium text-text shadow-sm transition-colors hover:bg-surface"
        onClick={() => setMulti((m) => !m)}
      >
        {multi() ? "selectionMode: multiple" : "selectionMode: single"}
      </button>

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

      <spin-tree-view
        prop:selectionMode={multi() ? "multiple" : "single"}
        ref={(node) => {
          el = node as TreeElement;
          el.nodes = JSON.stringify(TREE);
          el.loadChildren = loadChildren;
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
