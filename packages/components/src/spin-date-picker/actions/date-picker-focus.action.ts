import { createAction, type ElementAction } from "@spin/runtime";

/**
 * date-picker-focus — move focus to the focused day when the panel opens.
 *
 * Zag's `setInitialFocus`: a keyboard user who opened the calendar
 * expects the arrow keys to move the focused day, and the trigger's own
 * keys stop applying once the panel is up. The focused cell is the
 * panel's tab stop, so opening hands it focus (unless focus already
 * moved inside — a pointer that landed on a cell must not be yanked
 * away).
 *
 * A reflex, so an action: it runs at attach and again whenever the
 * open flag moves, and it focuses only the cell it is given.
 */

export interface DatePickerFocusParam {
  readonly open: boolean;
  readonly cellId: string;
}

export const datePickerFocus: ElementAction<DatePickerFocusParam | undefined> =
  createAction(
    (node, param) => {
      if (param === undefined) return;
      const apply = (current: DatePickerFocusParam): void => {
        if (!current.open) return;
        const active = document.activeElement;
        if (active instanceof Node && node.contains(active)) return;
        document.getElementById(current.cellId)?.focus?.();
      };
      apply(param);
      return { update: apply };
    },
  );
