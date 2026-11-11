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

/** The class a markup's class attribute holds.
 *
 * The attribute takes the shape the markup reads best: a list of parts,
 * where a part is a string of classes or an object of conditions.
 *
 *     class={["mb-4 text-sm text-muted", { "bg-primary": focused }]}
 *
 * A string is the classes themselves — plain text, so the build's
 * extractor sees them as they are. An object's keys are the classes and
 * its values the conditions; a key whose value is truthy is in.
 *
 * The values are live reads, so the class follows the state.
 */
export function classOf(classes: unknown): string {
  // Last-write-wins in evaluation order: a later truthy token evicts an
  // earlier token in the same CSS property family, so `classOf(["px-2",
  // { "px-4": on }])` never strands both paddings in the class list.
  const out: string[] = [];
  const keys: (string | null)[] = [];
  const groupOf = (core: string): string | null => {
    let match: RegExpMatchArray | null;
    if (/^bg-(.+)$/.exec(core) !== null) return "bg";
    if (/^text-(left|center|right|justify|start|end)$/.exec(core) !== null) return "text-align";
    if (/^text-(.+)$/.exec(core) !== null) return "text-color";
    if (/^type-(.+)$/.exec(core) !== null) return "type";
    if (/^opacity-\d+$/.exec(core) !== null) return "opacity";
    if (/^cursor-(.+)$/.exec(core) !== null) return "cursor";
    if (/^-?scale-(.+)$/.exec(core) !== null) return "scale";
    if (/^-?rotate-(.+)$/.exec(core) !== null) return "rotate";
    if (/^shadow(?:-(.+))?$/.exec(core) !== null) return "shadow";
    if (/^rounded(?:-(none|sm|md|lg|xl|2xl|3xl|full))?$/.exec(core) !== null) return "rounded";
    if (/^border(?:-(0|2|4|8))?$/.exec(core) !== null) return "border-width";
    if (/^border-(solid|dashed|dotted|double|none)$/.exec(core) !== null) return "border-style";
    if (/^border-(?!t$|r$|b$|l$|x$|y$|s$|e$|t-|r-|b-|l-|x-|y-|s-|e-)(.+)$/.exec(core) !== null) {
      return "border-color";
    }
    match = /^(p|px|py|pt|pr|pb|pl|ps|pe|m|mx|my|mt|mr|mb|ml|ms|me|gap|gap-x|gap-y|w|h|min-w|max-w|min-h|max-h|z)-(.+)$/.exec(core);
    if (match !== null) return match[1] as string;
    if (/^(block|inline-block|inline|flex|inline-flex|grid|inline-grid|contents|hidden)$/.exec(core) !== null) {
      return "display";
    }
    if (/^(static|relative|absolute|fixed|sticky)$/.exec(core) !== null) return "position";
    return null;
  };
  const push = (text: string): void => {
    for (const token of text.split(/\s+/)) {
      if (token.length === 0) continue;
      const cut = token.lastIndexOf(":");
      const variant = cut === -1 ? "" : token.slice(0, cut + 1);
      const core = cut === -1 ? token : token.slice(cut + 1);
      const group = groupOf(core);
      if (group === null) {
        out.push(token);
        keys.push(null);
        continue;
      }
      const conflictKey = variant + group;
      // Paired surface/ink eviction: overriding `bg-selected
      // text-on-selected` with `bg-surface` must also drop the stranded
      // `text-on-selected` ink, which would sit unreadably on the surface.
      const fill = /^bg-(.+)$/.exec(core)?.[1];
      for (let index = out.length - 1; index >= 0; index--) {
        if (keys[index] === conflictKey) {
          if (fill !== undefined && group === "bg" && (fill === "surface" || fill.startsWith("surface-") || fill === "transparent")) {
            const prevFill = /^bg-(.+)$/.exec((out[index] as string).slice(variant.length))?.[1];
            if (prevFill !== undefined) {
              const inkKey = `${variant}text-on-${prevFill}`;
              const at = out.indexOf(inkKey);
              if (at !== -1) {
                out.splice(at, 1);
                keys.splice(at, 1);
                if (at <= index) index -= 1;
              }
            }
          }
          out.splice(index, 1);
          keys.splice(index, 1);
        }
      }
      out.push(token);
      keys.push(conflictKey);
    }
  };
  const part = (value: unknown): void => {
    if (typeof value === "string") {
      push(value);
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) part(item);
      return;
    }
    if (value !== null && typeof value === "object") {
      for (const [name, condition] of Object.entries(value)) {
        if (!condition) continue;
        push(name);
      }
    }
  };
  part(classes);
  return out.join(" ");
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

export function bindDynamic(
  el: Element,
  name: string,
  get: () => unknown,
): void {
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
    const stop = owner.run(() =>
      effect(() => {
        const next = source() as unknown;
        if (next === last) return;
        last = next;
        if (view["value"] !== next) view["value"] = next;
      })
    );
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

export function bindChecked(
  el: HTMLInputElement,
  source: Writable<boolean>,
): Binding {
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
    owner.run(() =>
      effect(() => {
        const next = source();
        if (next === last) return;
        last = next;
        el.checked = next;
      })
    );
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
// A reconnect rebuilds: `disconnectedCallback` disposes the scope once the
// element stays detached past a microtask (a `<Suspense>` tearing its route
// tree down on refetch), and `connectedCallback` runs `build` again. The
// first build already moved the light-DOM children into the placed output,
// so a naive second projection would regroup the element's own rendered DOM
// as slots. The first projection is cached per element; a reconnect clears
// the stale output and replays the cached groups.
const projectedSlots = new WeakMap<HTMLElement, Map<string, Node[]>>();
export function projectSlots(el: HTMLElement): Map<string, Node[]> {
  const cached = projectedSlots.get(el);
  if (cached !== undefined) {
    for (const node of [...el.childNodes]) {
      if (node.nodeType === 8) continue;
      el.removeChild(node);
    }
    return cached;
  }
  const groups = new Map<string, Node[]>();
  for (const node of [...el.childNodes]) {
    // Comments stay: a host framework parks its block markers as comments
    // among the light DOM, and moving one breaks the reconciliation the
    // host runs on its next update. Comments never render, so leaving them
    // changes nothing the reader sees.
    if (node.nodeType === 8) continue;
    const name = node instanceof Element ? node.getAttribute("slot") ?? "" : "";
    const group = groups.get(name);
    if (group !== undefined) group.push(node);
    else groups.set(name, [node]);
    el.removeChild(node);
  }
  projectedSlots.set(el, groups);
  return groups;
}

/**
 * Places assigned nodes (moved, never cloned — state and listeners travel)
 * before `anchor`, or the fallback nodes when nothing was assigned.
 */
export function placeSlot(
  host: Node,
  anchor: Comment,
  assigned: Node[] | undefined,
  fallback: Node[],
): void {
  const nodes = assigned !== undefined && assigned.length > 0
    ? assigned
    : fallback;
  for (const n of nodes) {
    if (n.parentNode !== host || n.nextSibling !== anchor) {
      host.insertBefore(n, anchor);
    }
  }
}
