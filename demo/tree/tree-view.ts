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
 * Two decisions carry the behaviour, and both come from the machine rather
 * than from here:
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
 * The subtle case is a boolean, because there are two incompatible conventions
 * and one loop cannot treat them alike:
 *
 * - HTML boolean attributes (`disabled`, `hidden`) are PRESENCE. `false` means
 *   remove the attribute; writing `hidden="false"` leaves the element hidden.
 * - ARIA attributes are ENUMERATED STRINGS. `aria-expanded="false"` is a real,
 *   required value — a collapsed branch that omits it tells a screen reader
 *   nothing, and `getBranchProps` emits exactly `false` for a closed branch.
 *
 * So `aria-*` is decided by whether the key starts with `aria-`, and the
 * distinction is the whole reason this is not a three-line helper.
 */
function apply(el: HTMLElement, props: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(props)) {
    if (key === "style" && value !== null && typeof value === "object") {
      for (const [name, v] of Object.entries(value as Record<string, unknown>)) {
        if (v === undefined || v === null) el.style.removeProperty(name);
        else el.style.setProperty(name, String(v));
      }
      continue;
    }
    if (key.startsWith("on") && typeof value === "function") {
      el.addEventListener(key.slice(2).toLowerCase(), value as EventListener);
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

    /** Renders the tree once, reading every machine field as it writes. */
    const render = (): void => {
      const root = document.createElement("section");

      const label = document.createElement("p");
      label.textContent = "Repository";
      apply(label, api.getLabelProps());
      root.append(label);

      const list = document.createElement("ul");
      for (const [index, child] of (DATA.children ?? []).entries()) {
        list.append(row(child, [index]));
      }
      apply(list, api.getTreeProps());
      root.append(list);

      el.replaceChildren(root);
    };

    /** One node: a branch carries a nested list, a leaf does not. */
    function row(data: TreeNode, indexPath: number[]): HTMLLIElement {
      const li = document.createElement("li");
      const node = api.collection.at(indexPath);

      if (!data.children) {
        const text = document.createElement("span");
        text.textContent = data.label;
        li.append(text);
        apply(li, api.getItemProps({ node, indexPath }));
        apply(text, api.getItemTextProps({ node, indexPath }));
        return li;
      }

      // The control is a real <button>: a whole-row target, focusable by the
      // browser, and already a button to spin because the TAG is claimed. The
      // chevron is a span inside it, which the same primitive claims.
      const control = document.createElement("button");
      control.type = "button";
      const chevron = document.createElement("span");
      chevron.setAttribute("aria-hidden", "true");
      const text = document.createElement("span");
      text.textContent = data.label;
      control.append(chevron, text);
      li.append(control);

      apply(li, api.getBranchProps({ node, indexPath }));
      apply(control, api.getBranchControlProps({ node, indexPath }));
      apply(chevron, api.getBranchIndicatorProps({ node, indexPath }));
      apply(text, api.getBranchTextProps({ node, indexPath }));

      const group = document.createElement("ul");
      for (const [index, child] of data.children.entries()) {
        group.append(row(child, [...indexPath, index]));
      }
      li.append(group);
      // `hidden` rides on this one attribute, and it is the only thing standing
      // between a collapsed branch and a fully expanded-looking tree.
      apply(group, api.getBranchContentProps({ node, indexPath }));
      return li;
    }

    // First paint is synchronous and unconditional: an element that renders
    // only when an effect happens to flush is an element that renders late.
    render();

    // Re-render on every state change. `render` reads `api.expandedValue`
    // through the live view on each pass, so the effect subscribes to exactly
    // the machine state the DOM depends on. Capturing that field into a local
    // before the effect is the bug this arrangement exists to prevent.
    effect(render);
  },
});
