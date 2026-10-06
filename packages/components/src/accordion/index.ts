import { component } from "@spin/runtime";
import type { ElementAction } from "@spin/runtime";
import { consume } from "@spin/runtime/load";
import { normalizeProps } from "@spin/runtime/zag";

const liveProps = (getter: string) => (el: HTMLElement, values: Record<string, unknown>) => {
  const api = consume(el, "accordion:api") as Record<string, (p?: unknown) => Record<string, unknown>> | undefined;
  const item = values["item"];
  const out: Record<string, () => unknown> = {};
  const read = (): Record<string, unknown> => {
    if (!api || typeof api[getter] !== "function") return {};
    const normalize = normalizeProps.element as (b: Record<string, unknown>) => Record<string, unknown>;
    return normalize(api[getter]!(item) as Record<string, unknown>);
  };
  for (const name of ["role", "id", "aria-expanded", "aria-disabled", "aria-controls", "aria-labelledby", "data-state", "data-disabled", "hidden", "disabled", "tabIndex"]) {
    out[name] = () => read()[name];
  }
  return out;
};
import { root } from "./actions/root.action.ts";
import { content, indicator, item, trigger } from "./actions/item.action.ts";

const ITEMS = "items";

export function registerAccordion(): void {
  component({
    tag: "accordion-root",
    markup: `<slot></slot>`,
    host: [{
      action: "root",
      param: (el, values) => values["options"],
      props: (el) => {
        void el;
        return {};
      },
    }],
    actions: { root: root as ElementAction<unknown> },
    values: (el) => ({
      options: {
        multiple: el.hasAttribute("multiple"),
        collapsible: !el.hasAttribute("non-collapsible"),
        defaultValue: el.getAttribute("default-value")?.split(","),
      },
    }),
  });

  component({
    tag: "accordion-item",
    markup: `<slot></slot>`,
    host: [{
      action: "item",
      param: (el, values) => values["item"],
      props: liveProps("getItemProps"),
    }],
    actions: { item: item as ElementAction<unknown> },
    values: (el) => ({
      item: {
        value: el.getAttribute("value") ?? "",
        disabled: el.hasAttribute("disabled"),
      },
    }),
  });

  component({
    tag: "accordion-trigger",
    markup: `<span use:indicator={item}></span>`,
    host: [{
      action: "trigger",
      param: (el, values) => values["item"],
      props: liveProps("getItemTriggerProps"),
    }],
    actions: { trigger: trigger as ElementAction<unknown>, indicator: indicator as ElementAction<unknown> },
    values: (el) => ({
      item: {
        value: (el.closest("[value]")?.getAttribute("value")) ?? "",
      },
    }),
  });
  void ITEMS;

  component({
    tag: "accordion-content",
    markup: `<slot></slot>`,
    host: [{
      action: "content",
      param: (el, values) => values["item"],
      props: liveProps("getItemContentProps"),
    }],
    actions: { content: content as ElementAction<unknown> },
    values: (el) => ({
      item: {
        value: (el.closest("[value]")?.getAttribute("value")) ?? "",
      },
    }),
  });
}

export { content, indicator, item, trigger, root };
