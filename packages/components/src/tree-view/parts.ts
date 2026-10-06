import { bindAttr, bindProp, on } from "@spin/runtime";

const normalize = (
  bag: Record<string, unknown>,
): Record<string, unknown> => {
  const element = (
    normalizeProps as unknown as {
      element: (props: Record<string, unknown>) => Record<string, unknown>;
    }
  ).element;
  return element(bag);
};
import { normalizeProps } from "@spin/runtime/zag";
import type { ElementAction } from "@spin/runtime";

export type ZagGetter = (props?: Record<string, unknown>) => Record<string, unknown>;
export type ZagApi = { [getter: string]: ZagGetter };

const ASSIGNABLE = new Set(["value", "checked", "selected", "tabIndex"]);

export function zagPart(
  api: () => ZagApi,
  getter: string,
  node: () => Record<string, unknown> | undefined,
): ElementAction<unknown> {
  return (el: Element) => {
    const bag = (): Record<string, unknown> =>
      normalize(api()[getter]!(node()) as Record<string, unknown>);
    const names = Object.keys(bag());
    for (const name of names) {
      if (name.startsWith("on")) {
        on(el, name.slice(2).toLowerCase(), (e: Event) => {
          const fn = bag()[name] as ((e: Event) => void) | undefined;
          fn?.(e);
        });
      } else if (ASSIGNABLE.has(name)) {
        bindProp(el, name, () => bag()[name]);
      } else {
        bindAttr(el, name, () => bag()[name]);
      }
    }
  };
}
