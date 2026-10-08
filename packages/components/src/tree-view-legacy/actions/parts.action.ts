import { createAction } from "@spin/runtime";
import { normalizeProps } from "@spin/runtime/zag";
import type { TreeApi, TreeRow } from "../machine.ts";

export interface PartParam {
  api: () => TreeApi | undefined;
  row?: () => TreeRow;
}

const normalize = (
  props: Record<string, unknown>,
): Record<string, unknown> => {
  const element = normalizeProps.element as (
    props: Record<string, unknown>,
  ) => Record<string, unknown>;
  return element(props);
};

const read = (
  param: PartParam,
  getter: string,
): Record<string, unknown> => {
  const current = param.api();
  if (current === undefined) return {};
  const fn = (current as unknown as Record<string, (p?: unknown) => Record<string, unknown>>)[getter];
  if (typeof fn !== "function") return {};
  const node = param.row?.();
  return normalize(fn(node as never) as Record<string, unknown>);
};

const handlers = (getter: string) =>
  createAction<PartParam>((el, param) => {
    if (!param) return;
    const stops: Array<() => void> = [];
    for (const [name, value] of Object.entries(read(param, getter))) {
      if (name.startsWith("on") && typeof value === "function") {
        const type = name.slice(2).toLowerCase();
        const fn = value as EventListener;
        el.addEventListener(type, fn);
        stops.push(() => el.removeEventListener(type, fn));
      }
    }
    return { destroy: () => stops.forEach((stop) => stop()) };
  });
export const label = handlers("getLabelProps");
export const tree = handlers("getTreeProps");
export const branch = handlers("getBranchProps");
export const branchControl = handlers("getBranchControlProps");
export const branchIndicator = handlers("getBranchIndicatorProps");
export const branchText = handlers("getBranchTextProps");
export const branchContent = handlers("getBranchContentProps");
export const branchTrigger = handlers("getBranchTriggerProps");
export const item = handlers("getItemProps");
export const itemText = handlers("getItemTextProps");
export const itemIndicator = handlers("getItemIndicatorProps");
