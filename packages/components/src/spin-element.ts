/**
 * Host hooks for spin elements: the drop-in surface for framework apps.
 *
 * The elements are framework-agnostic by construction (custom elements,
 * property writes down, CustomEvents up). This package is the typed,
 * ergonomic version of that contract for the frameworks people actually
 * use — one small adapter each, no framework runtime dependency beyond the
 * host itself.
 *
 * What a hook gives you over raw refs:
 * - declared props written as properties on attach, re-written when they
 *   change (so controlled usage is a normal reactive binding);
 * - declared events subscribed with cleanup on unmount — no manual
 *   listener bookkeeping;
 * - the element's imperative commands (`el.show()`, `el.hide()`) typed and
 *   reachable, for the cases events don't cover;
 * - the machine's read-only state (where the machine-def exposes it).
 *
 * The three surface shapes stay identical across adapters on purpose: the
 * day a framework needs something new, the change is one file.
 */
import { writeProp as writePropOf } from "@spinjs/components/runtime";


/** A spin element as hosts see it: props down, events up, commands in. */
export interface SpinElement {
  // Property and command surfaces are per-element; hosts cast to their
  // element's interface (see each component's machine-def).
  [key: string]: unknown;
}

export interface SpinHookOptions<TProps extends object> {
  /** Written as element properties. */
  readonly props?: TProps | undefined;
  /** CustomEvent name -> handler, subscribed for the element's lifetime. */
  readonly on?:
    | Readonly<Record<string, (event: CustomEvent) => void>>
    | undefined;
}

/** Attach-time work shared by every adapter: write props, bind events. */
export function bindSpinElement<TProps extends object>(
  el: Element,
  { props, on }: SpinHookOptions<TProps>,
): () => void {
  for (const [name, value] of Object.entries(props ?? {})) {
    if (writePropOf(el, name, value)) continue;
    (el as unknown as Record<string, unknown>)[name] = value;
  }
  const entries = Object.entries(on ?? {});
  for (const [name, handler] of entries) {
    el.addEventListener(name, handler as EventListener);
  }
  return () => {
    for (const [name, handler] of entries) {
      el.removeEventListener(name, handler as EventListener);
    }
  };
}
