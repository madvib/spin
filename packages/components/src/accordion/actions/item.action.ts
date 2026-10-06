import { createZagAction } from "@spin/runtime";
import { consume } from "@spin/runtime/load";

export interface ItemParam {
  value: string;
  disabled?: boolean;
}

const apiOf = (el: Element) => consume(el, "accordion:api") as Record<string, unknown> | undefined;

const itemOf = (el: Element): ItemParam => {
  const host = el.closest("[value]") ?? el;
  return {
    value: host.getAttribute("value") ?? "",
    disabled: host.hasAttribute("disabled") ? true : undefined,
  };
};

const withItem = (getter: string) =>
  createZagAction(getter, (el: Element) => apiOf(el), (el: Element) => itemOf(el) as unknown as Record<string, unknown>);

export const item = withItem("getItemProps");
export const trigger = withItem("getItemTriggerProps");
export const content = withItem("getItemContentProps");
export const indicator = withItem("getItemIndicatorProps");
