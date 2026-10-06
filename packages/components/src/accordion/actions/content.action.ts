import { createAction } from "@spin/runtime";
import { normalizeProps } from "@spin/runtime/zag";
import { itemOf, machineOf } from "./shared.ts";

export const content = createAction((el) => {
  const api = machineOf(el);
  if (!api) return;
  const props = api.getItemContentProps(itemOf(el));
  const stops: Array<() => void> = [];
  for (const [name, value] of Object.entries(props)) {
    if (name.startsWith("on") && typeof value === "function") {
      const type = name.slice(2).toLowerCase();
      const listener = value as EventListener;
      el.addEventListener(type, listener);
      stops.push(() => el.removeEventListener(type, listener));
    }
  }
  return { destroy: () => stops.forEach((stop) => stop()) };
});

const normalize = (
  props: Record<string, unknown>,
): Record<string, unknown> => {
  const element = normalizeProps.element as (
    props: Record<string, unknown>,
  ) => Record<string, unknown>;
  return element(props);
};

export const contentProps = (el: Element): Record<string, unknown> => {
  const api = machineOf(el);
  if (!api) return {};
  return normalize(api.getItemContentProps(itemOf(el)));
};
