/** Zag tree-view as semantic tags the preset already styles. */
import { collection, connect, machine } from "@zag-js/tree-view";
import { define, effect } from "@spin/runtime";
import { createMachine } from "@spin/runtime/zag";

/** The tree, in the shape zag's collection reads. */
interface TreeNode {
  value: string;
  label: string;
  children?: TreeNode[];
}

const DATA: TreeNode = {
  value: "spin-runtime",
  label: "spin-runtime",
  children: [
    {
      value: "packages",
      label: "packages",
      children: [
        { value: "runtime", label: "runtime" },
        { value: "preset", label: "preset" },
        { value: "primitives", label: "primitives" },
      ],
    },
    {
      value: "demo",
      label: "demo",
      children: [
        { value: "build.ts", label: "build.ts" },
        { value: "index.html", label: "index.html" },
      ],
    },
    { value: "PLAN.md", label: "PLAN.md" },
  ],
};

/**
 * Writes a zag prop bag onto an element.
 *
 * `aria-*` booleans are enumerated strings, not presence: `aria-expanded="false"`
 * is a required value. Every other boolean is presence. Handlers replace rather
 * than stack, because this runs on every paint.
 */
const bound = new WeakMap<EventTarget, Map<string, EventListener>>();

function apply(el: HTMLElement, props: Record<string, unknown>): void {
  let handlers = bound.get(el);
  if (!handlers) {
    handlers = new Map();
    bound.set(el, handlers);
  }
  for (const [key, value] of Object.entries(props)) {
    if (key === "style" && value !== null && typeof value === "object") {
      for (const [name, v] of Object.entries(value as Record<string, unknown>)) {
        if (v === undefined || v === null) el.style.removeProperty(name);
        else el.style.setProperty(name, String(v));
      }
      continue;
    }
    if (key.startsWith("on") && typeof value === "function") {
      const type = key.slice(2).toLowerCase();
      const previous = handlers.get(key);
      if (previous) el.removeEventListener(type, previous);
      el.addEventListener(type, value as EventListener);
      handlers.set(key, value as EventListener);
      continue;
    }
    // An absent value removes the attribute in every convention.
    if (value === undefined || value === null) {
      el.removeAttribute(key);
    } else if (typeof value === "boolean") {
      if (key.startsWith("aria-")) el.setAttribute(key, String(value));
      else if (value) el.setAttribute(key, "");
      else el.removeAttribute(key);
    } else {
      el.setAttribute(key, String(value));
    }
  }
}

export const treeView = define("tree-view", {
  build({ el, scope }) {
    const tree = createMachine(machine, {
      connect,
      scope,
      id: "spin-tree",
      // Zag resolves ids against this node, not the document.
      getRootNode: () => el,
      props: {
        collection: collection({ rootNode: DATA }),
        expandOnClick: true,
      },
    });

    const api = tree.api;

    /**
     * Elements paired with their props, built once and repainted in place.
     *
     * A rebuild on a state change replaces the control between `focus` (which
     * zag emits on mousedown) and `click`, so the click lands on a detached
     * node and is swallowed.
     */
    const parts: Array<{ el: HTMLElement; props: () => Record<string, unknown> }> = [];

    /** Registers an element and how to ask for its props. Returns the element. */
    function part<T extends HTMLElement>(element: T, props: () => Record<string, unknown>): T {
      parts.push({ el: element, props });
      return element;
    }

    const root = document.createElement("section");

    const label = part(document.createElement("p"), () => api.getLabelProps());
    label.textContent = "Repository";
    root.append(label);

    const list = part(document.createElement("ul"), () => api.getTreeProps());
    for (const [index, child] of (DATA.children ?? []).entries()) {
      list.append(row(child, [index]));
    }
    root.append(list);

    el.replaceChildren(root);

    /** One node: a branch carries a nested list, a leaf does not. */
    function row(data: TreeNode, indexPath: number[]): HTMLLIElement {
      const li = document.createElement("li");
      const node = api.collection.at(indexPath);

      if (!data.children) {
        const text = part(document.createElement("span"), () => api.getItemTextProps({ node, indexPath }));
        text.textContent = data.label;
        li.append(text);
        part(li, () => api.getItemProps({ node, indexPath }));
        return li;
      }

      // The control is a real <button>: a whole-row target, focusable by the
      // browser, and already a button to spin because the TAG is claimed. The
      // chevron is a span inside it, which the same primitive claims.
      const control = document.createElement("button");
      control.type = "button";
      const chevron = document.createElement("span");
      chevron.setAttribute("aria-hidden", "true");
      const text = part(document.createElement("span"), () => api.getBranchTextProps({ node, indexPath }));
      text.textContent = data.label;
      control.append(chevron, text);
      li.append(control);

      part(li, () => api.getBranchProps({ node, indexPath }));
      part(control, () => api.getBranchControlProps({ node, indexPath }));
      part(chevron, () => api.getBranchIndicatorProps({ node, indexPath }));

      const group = part(document.createElement("ul"), () => api.getBranchContentProps({ node, indexPath }));
      for (const [index, child] of data.children.entries()) {
        group.append(row(child, [...indexPath, index]));
      }
      li.append(group);
      return li;
    }

    /**
     * Writes every part's current props. Each thunk reads `machine.api` at the
     * moment it runs, and `api` is a Proxy over a computed, so a paint inside
     * an `effect` subscribes to exactly the state the DOM depends on — and a
     * captured field, which would be stale forever, cannot be written here.
     */
    const paint = (): void => {
      for (const { el: element, props } of parts) apply(element, props());
    };

    // First paint is synchronous and unconditional: an element that renders
    // only when an effect happens to flush is an element that renders late.
    paint();
    effect(paint);
  },
});
