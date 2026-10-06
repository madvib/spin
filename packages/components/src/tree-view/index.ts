import { bindAttr, bindFor, bindText, define, runAction, signal, zag } from "@spin/runtime";
import { normalizeProps } from "@spin/runtime/zag";
import { useTree, type TreeApi, type TreeNodes } from "./machine.ts";
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

interface Row {
  node: TreeNodes;
  indexPath: number[];
}

type Props = () => { node: { value: string }; indexPath: number[] } | undefined;

export const treeView = define("tree-view", {
  build({ el }) {
    const root = signal<TreeApi | undefined>(undefined);
    const publish = useTree(() => ({ nodes: NODES }))(root);

    const host = document.createElement("div");
    host.innerHTML = markup;
    runAction(host, publish as never, undefined);

    const api = () => root() as never;
    const apply = (selector: string, getter: string): void => {
      const target = host.querySelector(selector);
      if (target) runAction(target, zag(api, getter, () => undefined));
    };
    apply("section", "getRootProps");
    apply("section > p", "getLabelProps");
    apply("section > ul", "getTreeProps");

    const rows = (): readonly Row[] => {
      const current = root();
      if (current === undefined) return [];
      return current.getVisibleNodes().filter((row) => row.indexPath.length === 1);
    };

    const proto = host.querySelector("template")!;
    const anchor = document.createComment("rows");
    proto.replaceWith(anchor);

    const renderRow = (row: Row): HTMLElement => {
      const li = (proto.content.firstElementChild as HTMLElement).cloneNode(true) as HTMLElement;
      const props: Props = () => ({ node: row.node, indexPath: row.indexPath });
      const kids = row.node.children ?? [];

      if (kids.length > 0) {
        runAction(li, zag(api, "getBranchProps", props));
        const control = li.querySelector("button")!;
        runAction(control, zag(api, "getBranchControlProps", props));
        const chevron = li.querySelector("[data-chevron]")!;
        runAction(chevron, zag(api, "getBranchIndicatorProps", props));
        const label = li.querySelector("[data-label]")!;
        runAction(label, zag(api, "getBranchTextProps", props));
        label.textContent = row.node.label;
        const group = li.querySelector("[data-children]")!;
        runAction(group, zag(api, "getBranchContentProps", props));
        for (const [index, child] of kids.entries()) {
          group.append(renderRow({ node: child, indexPath: [...row.indexPath, index] }));
        }
      } else {
        runAction(li, zag(api, "getItemProps", props));
        li.querySelector("[data-children]")?.remove();
        const text = li.querySelector("[data-label]")!;
        runAction(text, zag(api, "getItemTextProps", props));
        text.textContent = row.node.label;
        li.querySelector("[data-chevron]")!.textContent = "•";
      }
      return li;
    };

    bindFor<Row>({
      anchor,
      items: rows,
      key: (row) => row.node.value,
      render: (row) => ({ nodes: [renderRow(row)] }),
    });
