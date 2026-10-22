import { effect, machineTick, own, scope } from "../core/signal.ts";
export type Signal<T> = { (): T; (value: T): void };

// Binding effects subscribe to the machine tick the way spreads do: bag
// reads are raw (no per-field signals), so the tick is the invalidation
// bus. Without it a binding renders its seed value and never moves again.
export function bindText(node: Text, get: () => unknown): void {
  let last: unknown;
  effect(() => {
    machineTick();
    const v = get();
    if (v !== last) {
      last = v;
      node.data = v == null ? "" : String(v);
    }
  });
}

/** The class a markup's class object holds: the keys whose value is
 * truthy, in the source's order. A key may name several utilities — the
 * classes that belong together.
 *
 * The keys are static strings, so the utilities are the build's to see;
 * the values are live reads, so the class follows the state.
 */
export function classOf(classes: Record<string, unknown>): string {
  const out: string[] = [];
  for (const [name, value] of Object.entries(classes)) {
    if (!value) continue;
    for (const token of name.split(/\s+/)) {
      if (token.length > 0) out.push(token);
    }
  }
  return out.join(" ");
}

export function bindAttr(el: Element, name: string, get: () => unknown): void {
  let last: unknown = Symbol("init");
  effect(() => {
    machineTick();
    const v = get();
    if (Object.is(v, last)) return;
    last = v;
    if (v === undefined || v === null || v === false) {
      el.removeAttribute(name);
    } else if (v === true) {
      el.setAttribute(name, "");
    } else {
      el.setAttribute(name, String(v));
    }
  });
}

export function bindProp(el: Element, name: string, get: () => unknown): void {
  const view = el as unknown as Record<string, unknown>;
  effect(() => {
    view[name] = get();
  });
}

export function bindDynamic(el: Element, name: string, get: () => unknown): void {
  const isCustom = el.tagName.includes("-");
  if (isCustom) bindProp(el, name, get);
  else bindAttr(el, name, get);
}

export interface Writable<T> {
  (): T;
  set(next: T): void;
}

export interface Binding {
  pull(): void;
  stop(): void;
}

export function bindValue(el: Element, source: Writable<string>): Binding {
  const view = el as unknown as Record<string, unknown>;
  let last = source() as unknown;
  view["value"] = last;
  const onInput = (): void => {
    const next = view["value"];
    if (next === last) return;
    last = next;
    source.set(next as string);
  };
  el.addEventListener("input", onInput);
  const stopInput = () => el.removeEventListener("input", onInput);
  let stopEffect: () => void = () => {};
  {
    const owner = scope();
    const stop = owner.run(() => effect(() => {
      const next = source() as unknown;
      if (next === last) return;
      last = next;
      if (view["value"] !== next) view["value"] = next;
    }));
    void stop;
    const dispose = () => owner.dispose();
    stopEffect = dispose;
  }
  const stop = () => {
    stopInput();
    stopEffect();
  };
  try {
    own(stop);
  } catch {
    // No scope is active. The caller owns the binding.
  }
  return {
    pull() {
      const next = source() as unknown;
      if (next === last) return;
      last = next;
      if (view["value"] !== next) view["value"] = next;
    },
    stop,
  };
}

export function bindChecked(el: HTMLInputElement, source: Writable<boolean>): Binding {
  let last = source();
  el.checked = last;
  const onInput = (): void => {
    const next = el.checked;
    if (next === last) return;
    last = next;
    source.set(next);
  };
  el.addEventListener("input", onInput);
  const stopInput = () => el.removeEventListener("input", onInput);
  let stopEffect: () => void = () => {};
  {
    const owner = scope();
    owner.run(() => effect(() => {
      const next = source();
      if (next === last) return;
      last = next;
      el.checked = next;
    }));
    stopEffect = () => owner.dispose();
  }
  const stop = () => {
    stopInput();
    stopEffect();
  };
  try {
    own(stop);
  } catch {
    // No scope is active. The caller owns the binding.
  }
  return {
    pull() {
      const next = source();
      if (next === last) return;
      last = next;
      el.checked = next;
    },
    stop,
  };
}



/**
 * Light-DOM transclusion. At build start the element's existing children are
 * moved out and grouped by their `slot` attribute (`""` = default). A
 * `<slot name="x">` in markup resolves to its group; unmatched groups are
 * dropped (native slot behavior — unassigned nodes render nowhere).
 *
 * Why manual instead of shadow DOM: the preset styles light DOM, and every
 * selector in the system assumes it. Shadow would isolate correctly and
 * break everything else.
 */
export function projectSlots(el: HTMLElement): Map<string, Node[]> {
  const groups = new Map<string, Node[]>();
  for (const node of [...el.childNodes]) {
    const name = node instanceof Element ? node.getAttribute("slot") ?? "" : "";
    const group = groups.get(name);
    if (group !== undefined) group.push(node);
    else groups.set(name, [node]);
    el.removeChild(node);
  }
  return groups;
}

/**
 * Places assigned nodes (moved, never cloned — state and listeners travel)
 * before `anchor`, or the fallback nodes when nothing was assigned.
 */
export function placeSlot(host: Node, anchor: Comment, assigned: Node[] | undefined, fallback: Node[]): void {
  const nodes = assigned !== undefined && assigned.length > 0 ? assigned : fallback;
  for (const n of nodes) {
    if (n.parentNode !== host || n.nextSibling !== anchor) host.insertBefore(n, anchor);
  }
}
