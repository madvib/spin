import { define } from "./element.ts";
import { runAction } from "../directives/use.ts";
import { bindAttr, bindProp } from "../directives/bind.ts";
import { load, type LoaderActions, type LoaderScope } from "../directives/load.ts";

const ASSIGNABLE = new Set(["value", "checked", "selected", "tabIndex"]);

export interface HostAction {
  readonly action: string;
  readonly param?: (el: HTMLElement, values: LoaderScope) => unknown;
  readonly props?: (el: HTMLElement, values: LoaderScope) => Record<string, () => unknown>;
}

export interface ComponentSpec {
  readonly tag: string;
  readonly markup: string;
  readonly actions: LoaderActions;
  readonly values?: (el: HTMLElement) => LoaderScope;
  readonly host?: readonly HostAction[];
}

export function component(spec: ComponentSpec): void {
  define(spec.tag, {
    build({ el }) {
      const values = spec.values?.(el) ?? {};
      for (const { action, param, props } of spec.host ?? []) {
        const fn = spec.actions[action];
        if (typeof fn === "function") {
          runAction(el, fn, param ? () => param(el, values) : undefined);
        }
        if (props) {
          for (const [name, get] of Object.entries(props(el, values))) {
            if (name.startsWith("on")) continue;
            if (ASSIGNABLE.has(name)) bindProp(el, name, get);
            else bindAttr(el, name, get);
          }
        }
      }
      const { nodes, dispose } = load(spec.markup, spec.actions, values);
      for (const node of nodes) el.appendChild(node as unknown as Node);
      void dispose;
    },
  });
}
