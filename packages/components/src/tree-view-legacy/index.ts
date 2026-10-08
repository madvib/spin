import { define, signal, type ElementAction } from "@spin/runtime";
import { load } from "@spin/runtime/load";
import { useTree, type TreeApi, type TreeNodes } from "./machine.ts";
import * as parts from "./actions/parts.action.ts";
import markup from "./markup.html?raw";

const NODES: TreeNodes[] = [
  {
    value: "packages",
    label: "packages",
    children: [
      { value: "packages/runtime", label: "runtime" },
      { value: "packages/components", label: "components" },
    ],
  },
  {
    value: "demo",
    label: "demo",
    children: [{ value: "demo/src", label: "src" }],
  },
  { value: "PLAN.md", label: "PLAN.md" },
];

export const treeView = define("tree-view", {
  build({ el }) {
    const root = signal<TreeApi | undefined>(undefined);
    void useTree(() => ({ nodes: NODES }))(root);

    const api = () => root();
    const visible = () => api()?.getVisibleNodes() ?? [];

    const { nodes, dispose } = load(
      markup,
      {
        label: parts.label as ElementAction<unknown>,
        tree: parts.tree as ElementAction<unknown>,
        branch: parts.branch as ElementAction<unknown>,
        "branch-control": parts.branchControl as ElementAction<unknown>,
        "branch-indicator": parts.branchIndicator as ElementAction<unknown>,
        "branch-text": parts.branchText as ElementAction<unknown>,
        "branch-content": parts.branchContent as ElementAction<unknown>,
        count: parts.label as ElementAction<unknown>,
      },
      { api, visible },
    );
    void dispose;

    const section = nodes.find((n) => (n as unknown as Element).tagName === "SECTION");
    el.replaceChildren((section ?? nodes[0]!) as unknown as Node);
  },
});
