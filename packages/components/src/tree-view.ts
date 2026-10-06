import { bindFor, bindText, define, on, runAction, signal, text } from "@spin/runtime";
import { useTree, type TreeNodes, type TreeRoot } from "./tree.ts";

const NODES: TreeNodes[] = [
  {
    value: "packages",
    children: [{ value: "packages/runtime" }, { value: "packages/components" }],
  },
  {
    value: "demo",
    children: [{ value: "demo/src" }],
  },
  { value: "PLAN.md" },
];

interface Row {
  node: { value: string };
  indexPath: number[];
}

const hasKids = (value: string): boolean =>
  NODES.some((n) => n.value === value && (n.children?.length ?? 0) > 0);

export const treeView = define("tree-view", {
  build({ el }) {
    const root = signal<TreeRoot | undefined>(undefined);
    const publish = useTree(() => ({ nodes: NODES }))(root);
    const host = document.createElement("div");
    runAction(host, publish as never, undefined);

    const section = document.createElement("section");
    const label = document.createElement("p");
    label.textContent = "Repository";
    section.append(label);

    const list = document.createElement("ul");
    list.setAttribute("role", "tree");
    list.setAttribute("aria-label", "Repository");
    section.append(list);

    const count = document.createElement("p");
    const total = text("");
    count.append(total.node);
    bindText(total.node as unknown as Text, () => {
      const api = root();
      if (api === undefined) return "";
      return `${api.expandedValue.length} expanded`;
    });
    section.append(count);

    const mark = document.createComment("rows");
    list.append(mark);

    const rows = (): readonly Row[] => {
      const api = root();
      if (api === undefined) return [];
      return api.getVisibleNodes() as Row[];
    };

    bindFor<Row>({
      anchor: mark,
      items: rows,
      key: (row) => row.node.value,
      render: (row) => {
        const li = document.createElement("li");
        li.setAttribute("role", "treeitem");
        const depth = row.indexPath.length - 1;
        li.setAttribute("aria-level", String(depth + 1));
        li.style.setProperty("padding-inline-start", `${depth * 16}px`);

        const control = document.createElement("button");
        control.type = "button";
        const chevron = document.createElement("span");
        chevron.setAttribute("aria-hidden", "true");
        const text = document.createElement("span");
        text.textContent = row.node.value;
        control.append(chevron, text);
        li.append(control);

        const paint = (current: Row): void => {
          const api = root();
          const open = api?.expandedValue.includes(current.node.value) ?? false;
          const branch = current.indexPath.length === 1 && hasKids(current.node.value);
          li.setAttribute("aria-expanded", open && branch ? "true" : "false");
          chevron.textContent = open && branch ? "▾" : branch ? "▸" : "•";
        };
        paint(row);

        on(control, "click", () => {
          const current = root();
          if (current === undefined) return;
          if (current.expandedValue.includes(row.node.value)) {
            current.collapse(row.node.value);
          } else {
            current.expand(row.node.value);
          }
        });

        return {
          nodes: [li],
          update: (next) => paint(next as Row),
        };
      },
    });

    el.replaceChildren(section);
    void host;
  },
});
