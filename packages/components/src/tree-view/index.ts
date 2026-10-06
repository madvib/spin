import { define, signal } from "@spin/runtime";
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
        label: parts.label,
        tree: parts.tree,
        branch: parts.branch,
        "branch-control": parts.branchControl,
        "branch-indicator": parts.branchIndicator,
        "branch-text": parts.branchText,
        "branch-content": parts.branchContent,
        count: parts.label,
      },
      { api, visible },
    );
    void dispose;

    const section = nodes.find((n) => (n as Element).tagName === "SECTION");
    el.replaceChildren(section ?? nodes[0]!);
  },
});
