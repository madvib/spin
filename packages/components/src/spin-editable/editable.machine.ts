/**
 * Editable machine: whether the field is being edited, the value, and the
 * value a cancel returns to.
 *
 * Zag's editable is two states — `preview` and `edit` — with every event
 * on one of them and `VALUE.SET` on the root tier. The fork's root tier is
 * exactly that, so the config is a root `on` plus the two states.
 *
 * Nothing here touches the DOM. Zag's `focusInput`, `restoreFocus` and
 * `blurInput` actions are the view's job in this port — the bridge reports
 * the transition and the connect performs the reflex. The four host
 * callbacks (`onValueChange`, `onEditChange`, `onValueCommit`,
 * `onValueRevert`) are reported by the bridge from the same transition,
 * exactly as the listbox reports `onValueChange`.
 *
 * `editControlled` and `maxLength` live in the context because the assigns
 * read them, and the bridge syncs them from scope.
 */

export interface EditableContext {
  value: string;
  /** The value a cancel returns to — set when editing opens and on submit. */
  previousValue: string;
  /** The host's cap on the value, or null when uncapped. */
  maxLength: number | null;
  /** True when the host authors `editing`, which is the controlled channel. */
  editControlled: boolean;
}

export type EditableEvent =
  | { type: "VALUE.SET"; value: string }
  | { type: "EDIT" }
  | { type: "SUBMIT"; focusable?: boolean }
  | { type: "CANCEL"; focusable?: boolean }
  | { type: "CONTROLLED.EDIT" }
  /** `previousEvent` is the type of the last event sent: a controlled close
   * right after a submit commits, anything else reverts. */
  | { type: "CONTROLLED.PREVIEW"; previousEvent: string };

export const config = {
  id: "editable",
  initial: "preview",
  context: {
    value: "",
    previousValue: "",
    maxLength: null as number | null,
    editControlled: false,
  },
  // Zag's root tier: the value is set wherever the machine is, which is how
  // a host's imperative `setValue` reaches a previewing field.
  on: {
    "VALUE.SET": { actions: [{ assign: "setValue" }] },
  },
  states: {
    preview: {
      on: {
        "CONTROLLED.EDIT": { target: "edit", actions: [{ assign: "setPreviousValue" }] },
        EDIT: [
          // Controlled: the host owns the state, so the machine only reports
          // that an edit was asked for. The host's own write brings it back
          // as CONTROLLED.EDIT.
          { cond: "isEditControlled" },
          { target: "edit", actions: [{ assign: "setPreviousValue" }] },
        ],
      },
    },
    edit: {
      on: {
        "CONTROLLED.PREVIEW": [
          { cond: "isSubmitEvent", target: "preview", actions: [{ assign: "setPreviousValue" }] },
          { target: "preview", actions: [{ assign: "revertValue" }] },
        ],
        CANCEL: [
          { cond: "isEditControlled" },
          { target: "preview", actions: [{ assign: "revertValue" }] },
        ],
        SUBMIT: [
          { cond: "isEditControlled" },
          { target: "preview", actions: [{ assign: "setPreviousValue" }] },
        ],
      },
    },
  },
};

export const implementations = {
  conds: {
    isEditControlled: (ctx: EditableContext): boolean => ctx.editControlled,
    isSubmitEvent: (_ctx: EditableContext, e: EditableEvent): boolean =>
      e.type === "CONTROLLED.PREVIEW" && e.previousEvent === "SUBMIT",
  },
  assigns: {
    setValue: (ctx: EditableContext, e: EditableEvent): Partial<EditableContext> => {
      if (e.type !== "VALUE.SET") return {};
      const max = ctx.maxLength;
      const value = max === null ? e.value : e.value.slice(0, max);
      return value === ctx.value ? {} : { value };
    },
    setPreviousValue: (ctx: EditableContext): Partial<EditableContext> => ({
      previousValue: ctx.value,
    }),
    /** Zag's revert: a field that started empty is never reverted to empty,
     * so a cancel on a blank field keeps what was typed. */
    revertValue: (ctx: EditableContext): Partial<EditableContext> =>
      ctx.previousValue === "" ? {} : { value: ctx.previousValue },
  },
};
