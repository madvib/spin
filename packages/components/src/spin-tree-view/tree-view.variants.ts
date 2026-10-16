/**
 * Tree-view variants — consumer-ready examples vendored from the tark
 * surface, translated into spin.
 *
 * We do not publish a component library. We publish machines, the
 * framework, and these examples per machine; users discover them over RPC
 * and copy them into their projects at a known location (mini-shadcn).
 * Each variant is complete markup a consumer pastes: the element, its
 * props, and the data it renders — no imports beyond the element itself.
 *
 * The two variants mirror tark's registry for this component: `basic` (a
 * file tree with folder icons and a selected leaf) and `async-loading`
 * (a lazy branch that loads children on first expand).
 */

export interface ComponentVariant {
  /** The file stem, e.g. `basic`. Copied to `spin/<component>/<name>.html`. */
  readonly name: string;
  /** What this variant is showing. Rendered as the row's label. */
  readonly title: string;
  /** The markup, exactly as a consumer would write it. */
  readonly html: string;
}

const NODES = `[{"value":"src","label":"src","children":[{"value":"src/app","label":"App.svelte"},{"value":"src/main","label":"main.ts"}]},{"value":"readme","label":"README.md","children":[]}]`;

const basicHtml = `<spin-tree-view nodes='${NODES}' defaultExpandedValue='["src"]' defaultSelectedValue='["src/app"]'>
  <template for={treeView.getVisibleRows()} as={row} key={row.node.value}>
    <div class="relative" {...treeView.getItemProps(row)}>
      <button
        class="relative flex min-h-0 w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-text transition-colors duration-fast ease-standard hover:bg-surface data-[highlighted]:bg-surface data-[selected]:bg-surface-sunken"
        {...treeView.getBranchControlProps(row)}
      >
        <span class="hidden size-4 shrink-0 items-center justify-center text-muted data-[branch]:inline-flex" {...treeView.getBranchIndicatorProps(row)}>
          <span class="i-lucide-chevron-right text-xs" aria-hidden="true"></span>
        </span>
        <span class="i-lucide-folder shrink-0 text-sm text-primary data-[kind=leaf]:hidden data-[kind=branch-open]:hidden" aria-hidden="true" {...treeView.getItemIconProps(row)}></span>
        <span class="i-lucide-folder-open shrink-0 text-sm text-primary data-[kind=leaf]:hidden data-[kind=branch-closed]:hidden" aria-hidden="true" {...treeView.getItemIconProps(row)}></span>
        <span class="i-lucide-file shrink-0 text-sm text-muted data-[kind=branch-open]:hidden data-[kind=branch-closed]:hidden" aria-hidden="true" {...treeView.getItemIconProps(row)}></span>
        <span class="min-w-0 flex-1 truncate" {...treeView.getBranchTextProps(row)}>{row.node.label}</span>
      </button>
    </div>
  </template>
</spin-tree-view>`;

const asyncHtml = `<spin-tree-view id="async-tree" selectionMode="single">
  <template for={treeView.getVisibleRows()} as={row} key={row.node.value}>
    <div class="relative" {...treeView.getItemProps(row)}>
      <button
        class="relative flex min-h-0 w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-text transition-colors duration-fast ease-standard hover:bg-surface data-[highlighted]:bg-surface data-[selected]:bg-surface-sunken"
        {...treeView.getBranchControlProps(row)}
      >
        <span class="hidden size-4 shrink-0 items-center justify-center text-muted data-[branch]:inline-flex" {...treeView.getBranchIndicatorProps(row)}>
          <span class="i-lucide-chevron-right text-xs" aria-hidden="true"></span>
        </span>
        <span class="min-w-0 flex-1 truncate" {...treeView.getBranchTextProps(row)}>{row.node.label}</span>
        <span class="ms-auto shrink-0 text-xs text-muted" {...treeView.getLoadingProps(row)}>…</span>
      </button>
    </div>
  </template>
</spin-tree-view>
<script>
  // Lazy branches declare no children; the host loads them on first expand.
  const tree = document.getElementById("async-tree");
  tree.nodes = JSON.stringify([{ value: "repo", label: "spin-runtime" }]);
  tree.loadChildren = async (value) => {
    await new Promise((resolve) => setTimeout(resolve, 400));
    if (value !== "repo") return [];
    return [
      { value: "repo/src", label: "src" },
      { value: "repo/deno", label: "deno.json" },
    ];
  };
</script>`;

export const TREE_VIEW_VARIANTS: readonly ComponentVariant[] = [
  { name: "basic", title: "Basic", html: basicHtml },
  { name: "async-loading", title: "Async Loading", html: asyncHtml },
];
