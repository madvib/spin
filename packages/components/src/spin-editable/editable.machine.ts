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
 * read them; the machine's contract writes the cap, and the element keeps
 * the controlled channel's fact in step with the host's authorship.
 */

import { defaultTwin } from "@spin/runtime";
import { createMachine, type Machine } from "@spin/runtime/fsm";

export interface EditableContext {
  value: string;
  /** The value a cancel returns to — set when editing opens and on submit. */
  previousValue: string;
  /** The host's cap on the value, or null when uncapped. */
  maxLength: number | null;
  /** True when the host authors `editing`, which is the controlled channel. */
  editControlled: boolean;
  /** The type of the last gesture sent, for controlled-close commit/revert. */
  lastEvent: string;
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

/**
 * The editable's arguments: the values the host may set.
 *
 * The names are the element's prop names — the machine is instantiated
 * with the element's prop bag and picks what it wants. The twin
 * (`defaultValue`) is resolved by the framework before the factory is
 * called, so the machine only ever sees the live value.
 */
export interface EditableArgs {
  /** The value, as the host wrote it. */
  value?: string;
  /** The host's cap on the value; zero or none leaves it uncapped. */
  maxLength?: number;
  defaultMaxLength?: number;
}

/** The machine's context, built from the arguments: the value, and the
 * cap the assigns read. */
export function initial(args: EditableArgs = {}, authored: (name: string) => boolean): EditableContext {
  // A channel: the host's write, or the machine's own default. The twin
  // is the framework's convention — a host that wrote `defaultValue`
  // wrote the channel too — and the framework has already resolved it
  // into the argument.
  const written = (field: string): boolean =>
    authored(field) || authored(defaultTwin(field));
  const value = written("value") && typeof args.value === "string" ? args.value : "";
  const cap = args.maxLength;
  return {
    value,
    previousValue: value,
    maxLength: written("maxLength") && typeof cap === "number" &&
        Number.isFinite(cap) && cap > 0
      ? Math.trunc(cap)
      : null,
    // The controlled channel's fact is the host's authorship of `editing`,
    // not a value: the element keeps it in step, and the machine's own
    // default stands until it does.
    editControlled: false,
    lastEvent: "",
  };
}

const config = {
  id: "editable",
  initial: "preview",
  context: {
    value: "",
    previousValue: "",
    maxLength: null as number | null,
    editControlled: false,
    lastEvent: "",
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
          { cond: "isEditControlled", actions: [{ assign: "setLastEvent" }] },
          { target: "preview", actions: [{ assign: "revertValue" }, { assign: "setLastEvent" }] },
        ],
        SUBMIT: [
          { cond: "isEditControlled", actions: [{ assign: "setLastEvent" }] },
          { target: "preview", actions: [{ assign: "setPreviousValue" }, { assign: "setLastEvent" }] },
        ],
      },
    },
  },
};

const implementations = {
  conds: {
    isEditControlled: (ctx: EditableContext): boolean => ctx.editControlled,
    isSubmitEvent: (_ctx: EditableContext, e: EditableEvent): boolean =>
      e.type === "CONTROLLED.PREVIEW" && e.previousEvent === "SUBMIT",
  },
  assigns: {
    setValue: (ctx: EditableContext, e: EditableEvent): Partial<EditableContext> => {
      if (e.type !== "VALUE.SET") return {};
      // The value arrives the way the host wrote it; the machine shapes
      // it, wherever it came from.
      const raw = typeof e.value === "string" ? e.value : "";
      const max = ctx.maxLength;
      const value = max === null || max <= 0 ? raw : raw.slice(0, max);
      return value === ctx.value ? {} : { value };
    },
    setPreviousValue: (ctx: EditableContext): Partial<EditableContext> => ({
      previousValue: ctx.value,
    }),
    setLastEvent: (_ctx: EditableContext, e: EditableEvent): Partial<EditableContext> => ({
      lastEvent: e.type,
    }),
    /** Zag's revert: a field that started empty is never reverted to empty,
     * so a cancel on a blank field keeps what was typed. */
    revertValue: (ctx: EditableContext): Partial<EditableContext> =>
      ctx.previousValue === "" ? {} : { value: ctx.previousValue },
  },
};

/**
 * The editable machine: state and nothing else. It is headless — it
 * knows its own arguments, and nothing about props, markup, or the DOM.
 */
export function editable(
  args: EditableArgs = {},
  authored: (name: string) => boolean,
): Machine<EditableContext, EditableEvent> {
  return createMachine<EditableContext, EditableEvent>({
    ...config,
    ...implementations,
    context: initial(args, authored),
    /**
     * The machine's contract with its hosts: the context fields a host
     * may write, and the event each write carries.
     *
     * A field with an event is REPORTED: the host's write is an event,
     * the machine decides, and the change reaches the host. A field
     * without one is SILENT: the host's write lands in the field, and
     * nothing reports.
     */
    fields: {
      value: { event: "VALUE.SET" },
      editControlled: {},
      maxLength: {},
    },
  });
}
