/**
 * The Phase 4 claim, as a component: a Zag machine rendered as bare semantic
 * tags that spin already styles.
 *
 * Not one element below carries a `class` attribute. That is the whole claim,
 * and this file is where it either holds or does not: spin's primitives claim
 * tags rather than class names (`:is(button, [role="button"])` for a control,
 * `ul, ol` for indent, `li + li` for list rhythm), so a machine rendered as
 * semantic DOM arrives already styled. The moment this file needed a class,
 * spin and Zag would be disagreeing about what an element IS — and the proof
 * would be over.
 *
 * Three decisions carry the behaviour:
 *
 * 1. The toggle lives on the branch CONTROL, which is the whole row rather
 *    than a 12px chevron. Zag routes that click to `BRANCH_NODE.CLICK`, whose
 *    `expandOnClick` guard runs `toggleBranchNode`, so expand and collapse are
 *    one handler reading machine state — the earlier version called `expand()`
 *    and nothing else, which opened once and then never again.
 * 2. Every field is read THROUGH `machine.api` at the moment it is written to
 *    the DOM, never captured. `connect` closes over a snapshot, so a captured
 *    `expandedValue` is stale forever; the bridge's `api` is a Proxy over a
 *    computed, so a read re-reads and a render inside an `effect` re-runs.
 * 3. The DOM is built ONCE and re-painted, never rebuilt — see the note on
 *    `parts` below. It reads like an optimisation and is not one: rebuilding
 *    on a state change destroys elements between the events that are acting
 *    on them, and the first click on a branch was swallowed because of it.
 */
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
 * Zag emits attribute names, `on*` handlers, and occasionally a style object.
 * Two cases carry the whole subtlety.
 *
 * **Booleans**, because there are two incompatible conventions and one loop
 * cannot treat them alike:
 *
 * - HTML boolean attributes (`disabled`, `hidden`) are PRESENCE. `false` means
 *   remove the attribute; writing `hidden="false"` leaves the element hidden.
 * - ARIA attributes are ENUMERATED STRINGS. `aria-expanded="false"` is a real,
 *   required value — a collapsed branch that omits it tells a screen reader
 *   nothing, and `getBranchProps` emits exactly `false` for a closed branch.
 *
 * So `aria-*` is decided by whether the key starts with `aria-`.
 *
 * **Handlers**, because this is called repeatedly on the same element rather
 * than once at creation. Zag hands out a fresh closure on every `connect`, so
 * a paint that only ever adds leaves one stale handler per state change. The
 * element still works, which is what makes it hard to notice — until a single
 * click fires three of them.
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
      // Zag resolves ids against this node, so the machine finds the tree it
      // is rendering rather than reaching for the whole document.
      getRootNode: () => el,
      props: {
        collection: collection({ rootNode: DATA }),
        expandOnClick: true,
      },
    });

    const api = tree.api;

    /**
     * Every element paired with the props it wants, in the order it was built.
     *
     * The tree is constructed ONCE and re-painted, never rebuilt. That is not
     * an optimisation — it is the difference between working and not. Zag's
     * `getBranchControlProps` emits `onFocus` as well as `onClick`, and focus
     * fires on mousedown, before click. A rebuild on the focus-driven state
     * change replaces the button between those two events, so the click lands
     * on a detached node and is swallowed: the first click on any branch did
     * nothing, and the second worked, because by then the node was focused and
     * `NODE.FOCUS` was a no-op. Stable elements, updated props.
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
