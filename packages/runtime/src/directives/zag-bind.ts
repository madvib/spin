import { effect } from "../core/signal.ts";
import { inserted } from "../core/signal.ts";
import { machineTick } from "../machine/adapter/machine.ts";
import { toStyleString } from "../machine/adapter/normalize-props.ts";

const ASSIGNABLE = new Set(["value", "checked", "selected", "tabIndex"]);


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

/**
 * Reactive spread application from a live reader.
 *
 * Same lifecycle as bindActionProps (inserted + machineTick), but `on*`
 * function values attach as event listeners instead of being skipped —
 * the bag owns its handlers. Listener names are the lowercased slice(2)
 * of the key; zag-normalized names (onFocus) are already correct.
 */
export function bindSpread(
  el: Element,
  read: () => Record<string, unknown>,
): () => void {
  let last: Record<string, unknown> = {};
  const attached = new Map<string, EventListener>();
  effect(() => {
    inserted();
    machineTick();
    const props = read();
    for (const name of Object.keys(last)) {
      if (!(name in props) && !name.startsWith("on")) el.removeAttribute(name);
    }
    const seen = new Set<string>();
    for (const [name, value] of Object.entries(props)) {
      if (name.startsWith("on") && typeof value === "function") {
        const type = name.slice(2).toLowerCase();
        const listener = value as EventListener;
        seen.add(type);
        if (attached.get(type) !== listener) {
          const prev = attached.get(type);
          if (prev !== undefined) el.removeEventListener(type, prev);
          el.addEventListener(type, listener);
          attached.set(type, listener);
        }
        continue;
      }
      if (Object.is(value, last[name])) continue;
      if (ASSIGNABLE.has(name)) {
        (el as unknown as Record<string, unknown>)[name] = value;
      } else if (value === undefined || value === null || value === false) {
        el.removeAttribute(name);
      } else if (value === true) {
        el.setAttribute(name, "");
      } else if (name === "style" && typeof value === "object") {
        el.setAttribute("style", toStyleString(value as Record<string, unknown>));
      } else {
        el.setAttribute(name, String(value));
      }
    }
    for (const [type, fn] of attached) {
      if (!seen.has(type)) {
        el.removeEventListener(type, fn);
        attached.delete(type);
      }
    }
    last = props;
  });
  return () => {};
}

