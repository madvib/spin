import { bindAttr, bindProp } from "./bind.ts";
import { on } from "./use.ts";
import { normalizeProps } from "./adapter/index.ts";
import type { ElementAction } from "./use.ts";

export type ZagGetter = (props?: Record<string, unknown>) => Record<string, unknown>;
export type ZagApi = { [getter: string]: ZagGetter };

const normalize = (
  props: Record<string, unknown>,
): Record<string, unknown> => {
  const element = normalizeProps.element as (
    props: Record<string, unknown>,
  ) => Record<string, unknown>;
  return element(props);
};

const ASSIGNABLE = new Set(["value", "checked", "selected", "tabIndex"]);

export function zag(
  api: () => ZagApi,
  getter: string,
  node: () => Record<string, unknown> | undefined,
): ElementAction<unknown> {
  return (el: Element) => {
    const props = (): Record<string, unknown> =>
      normalize(api()[getter]!(node()) as Record<string, unknown>);
    const attr = (name: string) => bindAttr(el, name, () => props()[name]);
    const prop = (name: string) => bindProp(el, name, () => props()[name]);
    (globalThis as unknown as Record<string, unknown>).__zagFired = false;
    for (const name of Object.keys(props())) {
      if (name.startsWith("on")) {
        const type = name.slice(2).toLowerCase();
        on(el, type, (e: Event) => {
          const fn = props()[name] as ((e: Event) => void) | undefined;
          fn?.(e);
        });
      } else if (ASSIGNABLE.has(name)) {
        prop(name);
      } else {
        attr(name);
      }
      if (name === "data-state") {
        const { effect: eff } = { effect: undefined as never };
        void eff;
      }
    }
  };
}


// Single-effect variant: one effect re-applies all members per change.
export function zagAll(
  api: () => ZagApi,
  getter: string,
  node: () => Record<string, unknown> | undefined,
): ElementAction<unknown> {
  return (el: Element) => {
    const { effect } = { effect: undefined as never };
    void effect;
  };
}
