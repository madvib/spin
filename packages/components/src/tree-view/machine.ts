import { connect, machine } from "@zag-js/tree-view";
import { TreeCollection } from "@zag-js/collection";
import { own } from "@spin/runtime";
import { normalizeProps } from "@spin/runtime/zag";
import { createMachine } from "@spin/runtime/zag";
import type { ElementAction } from "@spin/runtime";

export type Signal<T> = { (): T; (value: T): void };

export interface TreeNodes {
  value: string;
  label: string;
  children?: TreeNodes[];
}

export interface TreeOptions {
  nodes: TreeNodes[];
  expandOnClick?: boolean;
  id?: string;
}

export type NodeProps = { node: { value: string }; indexPath: number[] };

export interface TreeRow {
  node: { value: string; label?: string; children?: { value: string }[] };
  indexPath: number[];
}

export interface TreeApi {
  getRootProps(): Record<string, unknown>;
  getLabelProps(): Record<string, unknown>;
  getTreeProps(): Record<string, unknown>;
  getBranchProps(props: NodeProps): Record<string, unknown>;
  getBranchControlProps(props: NodeProps): Record<string, unknown>;
  getBranchIndicatorProps(props: NodeProps): Record<string, unknown>;
  getBranchTextProps(props: NodeProps): Record<string, unknown>;
  getBranchTriggerProps(props: NodeProps): Record<string, unknown>;
  getBranchContentProps(props: NodeProps): Record<string, unknown>;
  getBranchIndentGuideProps(props: NodeProps): Record<string, unknown>;
  getItemProps(props: NodeProps): Record<string, unknown>;
  getItemTextProps(props: NodeProps): Record<string, unknown>;
  getItemIndicatorProps(props: NodeProps): Record<string, unknown>;
  getVisibleNodes(): { node: TreeNodes; indexPath: number[] }[];
  expandedValue: string[];
  expand(value: string): void;
  collapse(value: string): void;
  select(value: string): void;
}

export function useTree(
  options: () => TreeOptions,
): (root: Signal<TreeApi | undefined>) => ElementAction<TreeOptions> {
  return (root) => {
    const opts = options();
    const bridge = createMachine(machine as never, {
      connect: connect as never,
      normalize: normalizeProps,
      props: {
        collection: new TreeCollection({ rootNode: { children: opts.nodes } }),
        expandOnClick: opts.expandOnClick ?? true,
        id: opts.id,
      },
    } as never);

    root(bridge.api as unknown as TreeApi);



    return (_node: Element, _param?: TreeOptions) => {
      own(() => {
        bridge.dispose();
      });
    };
  };
}
