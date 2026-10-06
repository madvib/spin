import { createAction } from "../directives/use.ts";
import type { ElementAction } from "../directives/use.ts";
import { normalizeProps } from "./adapter/index.ts";

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

export function createZagAction(
  getter: string,
  resolve: (el: Element, param: unknown) => Record<string, unknown> | undefined,
): ElementAction<unknown> {
  return createAction<unknown>((el, param) => {
    const api = resolve(el, param);
    if (api === undefined) return;
    const fn = api[getter];
    if (typeof fn !== "function") return;
    const node = (param as { row?: unknown })?.row ?? param;
    const props = normalize(fn(node as never) as Record<string, unknown>);
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
}
