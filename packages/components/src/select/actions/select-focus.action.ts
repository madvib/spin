import { createAction, type ElementAction } from "@spin/runtime";

/**
 * select-focus — move focus into the panel when it opens.
 *
 * The `setInitialFocus` behaviour: a keyboard user who opened the panel with
 * the trigger expects the arrow keys to move the highlight next, and the
 * trigger's own keys stop applying once the panel is open. The content is
 * the panel's tab stop, so opening hands it focus (unless focus already
 * moved inside — a pointer that landed on a row must not be yanked away).
 *
 * A reflex, so an action: it runs at attach and again whenever the open flag
 * moves, and it focuses only the node it is given.
 */

export interface SelectFocusParam {
  readonly open: boolean;
}

export const selectFocus: ElementAction<SelectFocusParam | undefined> =
  createAction(
    (node, param) => {
      if (param === undefined) return;
      const apply = (current: SelectFocusParam): void => {
        if (!current.open) return;
        const active = node.getRootNode() instanceof ShadowRoot
          ? null
          : document.activeElement;
        // Already inside: a click that landed on a row keeps its focus.
        if (active instanceof Node && node.contains(active)) return;
        (node as HTMLElement).focus?.();
      };
      apply(param);
      return { update: apply };
    },
  );
