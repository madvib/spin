import { bindAttr, bindProp } from "./bind.ts";
import { effect } from "../core/signal.ts";
import { inserted } from "../core/signal.ts";
import { machineTick } from "../machine/adapter/machine.ts";
import { normalizeProps } from "../machine/adapter/index.ts";
import type { ZagApi } from "../machine/zag-action.ts";

const ASSIGNABLE = new Set(["value", "checked", "selected", "tabIndex"]);

const normalize = (
  props: Record<string, unknown>,
): Record<string, unknown> => {
  const element = normalizeProps.element as (
    props: Record<string, unknown>,
  ) => Record<string, unknown>;
  return element(props);
};

const wired = new WeakSet<Element>();

export function bindZag(
  el: Element,
  api: () => ZagApi | undefined,
  getter: string,
  node: () => Record<string, unknown> | undefined,
): void {
  if (!wired.has(el)) {
    wired.add(el);
    for (const name of ["click", "focusin", "focusout", "keydown", "keyup", "input", "pointerdown"]) {
      el.addEventListener(name, (e: Event) => {
        const current = api();
            if (!current || typeof current[getter] !== "function") return;
        const nv = node();
        const props = normalize(current[getter]!(nv) as Record<string, unknown>);
            const fn = props["on" + name] as ((e: Event) => void) | undefined;
            fn?.(e);
      });
    }
  }
  let last: Record<string, unknown> = {};
  effect(() => {
    inserted();

    const current = api();
    const props = current && typeof current[getter] === "function"
      ? normalize(current[getter]!(node()) as Record<string, unknown>)
      : {};
    for (const name of Object.keys(last)) {
      if (!(name in props) && !name.startsWith("on")) el.removeAttribute(name);
    }
    for (const [name, value] of Object.entries(props)) {
      if (name.startsWith("on")) continue;
      if (Object.is(value, last[name])) continue;
      if (ASSIGNABLE.has(name)) {
        (el as unknown as Record<string, unknown>)[name] = value;
      } else if (value === undefined || value === null || value === false) {
        el.removeAttribute(name);
      } else if (value === true) {
        el.setAttribute(name, "");
      } else {
        el.setAttribute(name, String(value));
      }
    }
    last = props;
  });
}


/**
 * Reactive prop application from a live reader.
 *
 * Loader-owned effect: called from emitted code in build scope. The reader
 * is re-invoked on every machine move (via machineTick) and on insertion.
 * Handlers (on*) are skipped — actions own those.
 */
export function bindActionProps(
  el: Element,
  read: () => Record<string, unknown>,
): void {
  let last: Record<string, unknown> = {};
  effect(() => {
    inserted();
    machineTick();
    const props = read();
    for (const name of Object.keys(last)) {
      if (!(name in props) && !name.startsWith("on")) el.removeAttribute(name);
    }
    for (const [name, value] of Object.entries(props)) {
      if (name.startsWith("on")) continue;
      if (Object.is(value, last[name])) continue;
      if (ASSIGNABLE.has(name)) {
        (el as unknown as Record<string, unknown>)[name] = value;
      } else if (value === undefined || value === null || value === false) {
        el.removeAttribute(name);
      } else if (value === true) {
        el.setAttribute(name, "");
      } else {
        el.setAttribute(name, String(value));
      }
    }
    last = props;
  });
}
