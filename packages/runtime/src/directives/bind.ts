import { effect, own, scope } from "../core/signal.ts";
export type Signal<T> = { (): T; (value: T): void };

export function bindText(node: Text, get: () => unknown): void {
  let last: unknown;
  effect(() => {
    const v = get();
    if (v !== last) {
      last = v;
      node.data = v == null ? "" : String(v);
    }
  });
}

export function bindAttr(el: Element, name: string, get: () => unknown): void {
  let last: unknown = Symbol("init");
  effect(() => {
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


