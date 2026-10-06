import { createZagAction } from "@spin/runtime";
import { consume } from "@spin/runtime/load";

export interface ItemParam {
  value: string;
  disabled?: boolean;
}

const apiOf = (el: Element) => consume(el, "accordion:api") as Record<string, unknown> | undefined;

const withItem = (getter: string) => createZagAction(getter, (el: Element) => apiOf(el));

export const item = withItem("getItemProps");
export const trigger = withItem("getItemTriggerProps");
export const content = withItem("getItemContentProps");
export const indicator = withItem("getItemIndicatorProps");
