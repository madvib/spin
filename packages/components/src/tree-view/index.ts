import { bindFor, bindText, define, runAction, signal } from "@spin/runtime";
import { useTree, type TreeNodes, type TreeRoot } from "./tree.ts";
import { zagPart, type ZagApi } from "./parts.ts";
import markup from "./tree-view.html?raw";

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

export const treeView = define("tree-view", {
  build({ el }) {
    const root = signal<TreeRoot | undefined>(undefined);
    const publish = useTree(() => ({ nodes: NODES }))(root);

    const host = document.createElement("div");
    host.innerHTML = markup;
    runAction(host, publish as never, undefined);

    const api = (): ZagApi => root() as unknown as ZagApi;
    const apply = (selector: string, getter: string): void => {
      const target = host.querySelector(selector);
      if (target) runAction(target, zagPart(api, getter, () => undefined));
    };
    apply("section", "getRootProps");
    apply("section > p", "getLabelProps");
    apply("section > ul", "getTreeProps");

    const rows = (): readonly Row[] => {
      const current = root();
      if (current === undefined) return [];
      return current.getVisibleNodes() as Row[];
    };

    const proto = host.querySelector("template")!;
    const anchor = document.createComment("rows");
    proto.replaceWith(anchor);

    bindFor<Row>({
      anchor,
      items: rows,
      key: (row) => row.node.value,
      render: (row) => {
        const li = (proto.content.firstElementChild as HTMLElement).cloneNode(true) as HTMLElement;
        const depth = row.indexPath.length - 1;
        li.setAttribute("aria-level", String(depth + 1));
        li.style.setProperty("padding-inline-start", `${depth * 16}px`);

        const props = () => ({ node: row.node, indexPath: row.indexPath });
        runAction(li, zagPart(api, "getBranchProps", props));
        const control = li.querySelector("button")!;
        runAction(control, zagPart(api, "getBranchControlProps", props));
        const chevron = li.querySelector("[data-chevron]")!;
        runAction(chevron, zagPart(api, "getBranchIndicatorProps", props));
        const label = li.querySelector("[data-label]")!;
        runAction(label, zagPart(api, "getBranchTextProps", props));
        label.textContent = row.node.value;

        return { nodes: [li] };
      },
    });

    const count = host.querySelector("[data-count]")!;
    bindText(count.firstChild as Text, () => {
      const current = root();
      if (current === undefined) return "";
      return `${current.expandedValue.length} expanded`;
    });

    const section = host.querySelector("section")!;
    el.replaceChildren(section);
  },
});
