import { createEffect, createSignal, onCleanup } from "solid-js";
import type { TreeExpandedChange } from "../../../src/spin-tree-view/treeView.machine-def.ts";

export interface TreeNode {
  readonly value: string;
  readonly label: string;
  readonly children?: readonly TreeNode[];
}

type TreeElement = HTMLElement & { nodes?: readonly TreeNode[] };

const NODES: readonly TreeNode[] = [
  {
    value: "src",
    label: "src",
    children: [
      { value: "src/index.ts", label: "index.ts" },
      { value: "src/elements.ts", label: "elements.ts" },
    ],
  },
  {
    value: "tests",
    label: "tests",
    children: [{ value: "tests/accordion.e2e.ts", label: "accordion.e2e.ts" }],
  },
  { value: "readme", label: "README.md" },
];

export default function TreeViewSpecimen() {
  const [last, setLast] = createSignal("nothing expanded yet");
  let el: TreeElement | undefined;

  // Down: property writes. Up: the expanded-change CustomEvent. No wrapper.
  createEffect(() => {
    if (el) el.nodes = NODES;
  });
  createEffect(() => {
    if (!el) return;
    const onExpandedChange = (event: Event) => {
      const change = (event as CustomEvent<TreeExpandedChange>).detail;
      setLast(
        change.expandedValue.length > 0 ? change.expandedValue.join(", ") : "all collapsed",
      );
    };
    el.addEventListener("expanded-change", onExpandedChange);
    onCleanup(() => el?.removeEventListener("expanded-change", onExpandedChange));
  });

  return (
    <section>
      <h2 class="text-xl mb-1">TreeView</h2>
      <p class="text-muted mb-4">
        Solid owns the nodes and passes them down; the element's expanded-change event comes back up.
      </p>

      <div class="flex items-center gap-3 mb-4">
        <span class="text-sm text-muted">
          expanded: <span id="last-expanded">{last()}</span>
        </span>
      </div>

      <spin-tree-view
        ref={(node) => {
          el = node as TreeElement;
          el.nodes = NODES;
        }}
      />
    </section>
  );
}
