import { connect, machine } from "@zag-js/tree-view";
import { TreeCollection } from "@zag-js/collection";
import { own } from "@spin/runtime";

export type Signal<T> = { (): T; (value: T): void };
import { normalizeProps } from "@spin/runtime/zag";
import { createMachine } from "@spin/runtime/zag";
import type { ElementAction } from "@spin/runtime";

export interface TreeNodes {
  value: string;
  children?: TreeNodes[];
}

export interface TreeOptions {
  nodes: TreeNodes[];
  expandOnClick?: boolean;
  id?: string;
}

export interface TreeRoot {
  getVisibleNodes(): { node: { value: string }; indexPath: number[] }[];
  expandedValue: string[];
  expand(value: string): void;
  collapse(value: string): void;
  select(value: string): void;
}

export function useTree(
  options: () => TreeOptions,
): (root: Signal<TreeRoot | undefined>) => ElementAction<TreeOptions> {
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

    const publish = (): void => {
      const api = bridge.api as unknown as {
        getVisibleNodes(): TreeRoot["getVisibleNodes"];
        expandedValue: string[];
        expand(value: string): void;
        collapse(value: string): void;
        select(value: string): void;
      };
      type Visible = ReturnType<TreeRoot["getVisibleNodes"]>;
      const shaped: TreeRoot = {
        getVisibleNodes: () => (bridge.api as unknown as { getVisibleNodes(): Visible }).getVisibleNodes(),
        get expandedValue() {
          return (bridge.api as unknown as { expandedValue: string[] }).expandedValue;
        },
        expand: (value) => api.expand(value),
        collapse: (value) => api.collapse(value),
        select: (value) => api.select(value),
      };
      root(shaped);
    };
    publish();

    return (_node: Element, _param?: TreeOptions) => {
      own(() => {
        bridge.dispose();
      });
    };
  };
}

