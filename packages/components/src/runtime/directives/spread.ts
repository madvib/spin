import { effect, signal, untrack } from "../core/signal.ts";
import { ACTIONS, runAction } from "../actions/index.ts";
import { runInElement } from "../scope/element.ts";
import { toStyleString } from "../core/style.ts";

/**
 * Properties written through the IDL rather than as content attributes.
 */
const ASSIGNABLE = new Set(["value", "checked", "selected", "tabIndex"]);

/**
 * Whether the element declares the name as a writable property. A
 * declared prop crosses through its accessor — an array or an object
 * cannot travel as an attribute, and the element's grammar owns the
 * coercion. A getter-only property (the DOM's `form`, say) stays on the
 * attribute path: writing it would throw.
 */
const hasAccessor = (el: Element, name: string): boolean => {
  let target: object | null = el;
  while (target !== null) {
    const desc = Object.getOwnPropertyDescriptor(target, name);
    if (desc !== undefined) return typeof desc.set === "function";
    target = Object.getPrototypeOf(target);
  }
  return false;
};

/**
 * Reactive prop application from a live reader.
 *
 * Loader-owned effect: called from emitted code in build scope. The reader
 * re-runs when a signal it reads moves, plus on insertion. Handlers (on*)
 * are skipped — actions own those.
 */
export function bindActionProps(
  el: Element,
  read: () => Record<string, unknown>,
): void {
  let last: Record<string, unknown> = {};
  effect(() => {
    const props = read();
    for (const name of Object.keys(last)) {
      if (!(name in props) && !name.startsWith("on")) el.removeAttribute(name);
    }
    for (const [name, value] of Object.entries(props)) {
      if (name.startsWith("on")) continue;
      // Assignable IDL props always write: user typing bypasses this
      // cache, so a machine revert to the cached value (editable cancel)
      // would otherwise skip and leave stale text. Same-value assignment
      // is caret-safe.
      if (!ASSIGNABLE.has(name) && Object.is(value, last[name])) continue;
      if (ASSIGNABLE.has(name)) {
        (el as unknown as Record<string, unknown>)[name] = value;
      } else if (
        name.startsWith("aria-") &&
        (value === true || value === false)
      ) {
        // ARIA states are not HTML booleans (see bindActionProps above):
        // both render explicitly, and this writes the string form itself
        // instead of relying on IDL reflection, which linkedom does not
        // implement — so unit DOM and Chromium agree.
        el.setAttribute(name, value === true ? "true" : "false");
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
 * Same lifecycle as bindActionProps (signal-driven), but `on*`
 * function values attach as event listeners instead of being skipped —
 * the bag owns its handlers. Listener names are the lowercased slice(2)
 * of the key; a camelCase name (`onFocus`) is already the DOM spelling.
 */
export function bindSpread(
  el: Element,
  read: () => Record<string, unknown>,
): () => void {
  let last: Record<string, unknown> = {};
  const attached = new Map<string, EventListener>();
  // The most recent bag, published for action param thunks to read through
  // a tracked signal — that is what makes `update` fire on machine moves.
  const latest = signal<Record<string, unknown>>({});
  const attachedActions = new Set<string>();
  effect(() => {
    const props = read();
    for (const name of Object.keys(last)) {
      // `use:name` entries are directives the attach pass below owns, so this
      // pass neither writes nor removes them as attributes.
      const directive = name.startsWith("use:");
      if (!(name in props) && !name.startsWith("on") && !directive) {
        el.removeAttribute(name);
      }
    }
    const seen = new Set<string>();
    // DOM spellings that lowercasing the bag key misses: `dblclick`
    // arrives as `onDoubleClick`, never as `ondblclick`.
    const EVENT_ALIASES: Record<string, string> = { doubleclick: "dblclick" };
    for (const [name, value] of Object.entries(props)) {
      if (name.startsWith("on") && typeof value === "function") {
        const type = EVENT_ALIASES[name.slice(2).toLowerCase()] ??
          name.slice(2).toLowerCase();
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
      // A bag-carried action is a directive, not an attribute: the attach
      // pass below consumes it. Writing it here would leak its stringified
      // param (`use:form-control="[object Object]"`) into the DOM.
      if (name.startsWith("use:")) continue;
      if (Object.is(value, last[name])) continue;
      if (name === "style") {
        // The style attribute carries the custom properties the geometry
        // rides; the IDL property takes a string, not a bag.
        el.setAttribute(
          "style",
          toStyleString(value as Record<string, unknown>),
        );
      } else if (ASSIGNABLE.has(name) || hasAccessor(el, name)) {
        (el as unknown as Record<string, unknown>)[name] = value;
      } else if (name.startsWith("aria-") && typeof value === "boolean") {
        // ARIA states are not HTML booleans: `aria-selected=""` parses as
        // unset, not true, and a removed `aria-selected` reads as a third
        // state rather than false. Render both explicitly, matching React.
        el.setAttribute(name, String(value));
      } else if (value === undefined || value === null || value === false) {
        el.removeAttribute(name);
      } else if (value === true) {
        el.setAttribute(name, "");
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
    // Publish for action param thunks (see the attach pass below).
    latest(props);
    // Bag-carried actions: a `use:name` key attaches the named registry
    // action ONCE, with the bag entry as its reactive param. Created inside
    // untrack for the same reason `for.ts` wraps row renders: an effect
    // created during this effect's run would be unlinked and disposed the
    // next time it re-runs, restarting the action on every machine move.
    for (const name of Object.keys(props)) {
      if (!name.startsWith("use:") || name.length <= 4) continue;
      if (attachedActions.has(name)) continue;
      const action = (ACTIONS as Record<string, unknown>)[name.slice(4)];
      if (typeof action !== "function") continue;
      attachedActions.add(name);
      // Re-enter the element's scope: this effect can re-run long after the
      // build (a host prop write, a machine move), and a bag that first
      // carries its `use:` key on that later run would attach its action
      // with no active scope — which `own` (inside runAction) refuses.
      runInElement(
        el,
        () =>
          untrack(() =>
            runAction(el, action as never, () => {
              const entry = latest()[name];
              // A function entry is a live read the machine wants re-evaluated;
              // anything else is the param itself.
              return typeof entry === "function" ? entry() : entry;
            })
          ),
      );
    }
  });
  return () => {};
}
