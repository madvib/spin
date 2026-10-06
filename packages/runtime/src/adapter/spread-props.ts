/**
 * Applies a zag prop bag to an element, and removes what disappears.
 *
 * Zag hands a bag per part per state change. Applying it is not `Object.assign`:
 * a value that vanished must be removed, a handler must replace rather than
 * stack, and four cases are not attributes at all — `class`, `style`, the
 * assignable form properties, and `children`.
 *
 * Booleans are presence, except `aria-*`. `aria-expanded="false"` is a required
 * enumerated value; `hidden="false"` leaves the element visible.
 */

import { SVG_CASE_SENSITIVE, toStyleString } from "./normalize-props.ts";

/** Set as a property, not an attribute: the attribute is the default value. */
const ASSIGNABLE = new Set(["value", "checked", "selected"]);

/** Previous bag per node per machine, so removals can be computed. */
const previous = new WeakMap<Element, Map<string, Record<string, unknown>>>();

function isSvg(el: Element): boolean {
  return el.namespaceURI === "http://www.w3.org/2000/svg";
}

function attrName(el: Element, name: string): string {
  return isSvg(el) && SVG_CASE_SENSITIVE.has(name) ? name : name.toLowerCase();
}

function cssProperty(key: string): string {
  return key.startsWith("--") ? key : key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}

function applyStyle(el: Element, before: unknown, after: unknown): void {
  const style = (el as HTMLElement).style;
  if (typeof after === "string") {
    el.setAttribute("style", after);
    return;
  }
  if (after == null) {
    if (typeof before === "string") el.removeAttribute("style");
    else for (const key in before as object) style.removeProperty(cssProperty(key));
    return;
  }
  for (const key in before as object) {
    if ((after as Record<string, unknown>)[key] == null) style.removeProperty(cssProperty(key));
  }
  for (const [key, value] of Object.entries(after as Record<string, unknown>)) {
    if (value == null) style.removeProperty(cssProperty(key));
    else style.setProperty(cssProperty(key), String(value));
  }
}

function clear(el: Element, name: string, value: unknown): void {
  if (name === "class") (el as HTMLElement).className = "";
  else if (name === "style") applyStyle(el, value, undefined);
  else if (ASSIGNABLE.has(name)) (el as unknown as Record<string, unknown>)[name] = "";
  else el.removeAttribute(attrName(el, name));
}

function set(el: Element, name: string, value: unknown): void {
  if (name === "class") {
    (el as HTMLElement).className = value == null ? "" : String(value);
  } else if (name === "style") {
    if (typeof value === "string") el.setAttribute("style", value);
    else applyStyle(el, undefined, value);
  } else if (name === "children") {
    el.innerHTML = String(value);
  } else if (ASSIGNABLE.has(name)) {
    (el as unknown as Record<string, unknown>)[name] = value ?? "";
  } else if (typeof value === "boolean" && !name.startsWith("aria-")) {
    el.toggleAttribute(attrName(el, name), value);
  } else if (value == null) {
    el.removeAttribute(attrName(el, name));
  } else {
    el.setAttribute(attrName(el, name), String(value));
  }
}

const isEvent = (name: string): boolean => name.startsWith("on");

/**
 * Applies `props` to `el` and returns a disposer.
 *
 * `scope` names the machine, so two machines can drive one element — zag
 * composes them, and a tree branch is a disclosure.
 */
export function spreadProps(
  el: Element,
  props: Record<string, unknown>,
  scope = "default",
): () => void {
  let scopes = previous.get(el);
  if (!scopes) previous.set(el, (scopes = new Map()));
  const before = scopes.get(scope) ?? {};

  for (const [name, value] of Object.entries(before)) {
    if (props[name] == null) clear(el, name, value);
  }
  for (const name of Object.keys(before)) {
    if (isEvent(name) && props[name] !== before[name]) {
      el.removeEventListener(name.slice(2).toLowerCase(), before[name] as EventListener);
    }
  }

  for (const [name, value] of Object.entries(props)) {
    if (isEvent(name)) {
      if (before[name] !== value && typeof value === "function") {
        el.addEventListener(name.slice(2).toLowerCase(), value as EventListener);
      }
      continue;
    }
    if (before[name] === value) continue;
    set(el, name, value);
  }

  scopes.set(scope, props);

  return () => {
    for (const name of Object.keys(props)) {
      if (isEvent(name)) {
        el.removeEventListener(name.slice(2).toLowerCase(), props[name] as EventListener);
      }
    }
    scopes.delete(scope);
    if (scopes.size === 0) previous.delete(el);
  };
}

export { toStyleString };
