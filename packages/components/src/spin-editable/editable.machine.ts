/**
 * Editable machine: whether the field is being edited, the value, and the
 * value a cancel returns to.
 *
 * Two states — `preview` and `edit` — with every event on one of them and
 * `VALUE.SET` on the root tier, so the config is a root `on` plus the two
 * states.
 *
 * Nothing here touches the DOM. The `focusInput`, `restoreFocus` and
 * `blurInput` actions are the view's job in this port — the bridge reports
 * the transition and the connect performs the reflex.
 *
 * `editControlled` and `maxLength` live in the context because the assigns
 * read them; the machine's contract writes the cap, and the element keeps
 * the controlled channel's fact in step with the host's authorship.
 */

import { defaultTwin } from "@spin/runtime";
import { createMachine, type Machine, type EventUnion, type MachineSpec } from "@spin/runtime/fsm";
const setPreviousValue = (ctx: EditableContext) : Partial<EditableContext> => { return ({
      previousValue: ctx.value,
    }); };

const setLastEvent = (_ctx: EditableContext, e: EditableEvent) : Partial<EditableContext> => { return ({
      lastEvent: e.type,
    }); };

const revertValue = (ctx: EditableContext) : Partial<EditableContext> => { return ctx.previousValue === "" ? {} : { value: ctx.previousValue }; };

const isEditControlled = (ctx: EditableContext) : boolean => { return ctx.editControlled; };



export interface EditableContext {
  value: string;
  previousValue: string;
  maxLength: number | null;
  editControlled: boolean;
  lastEvent: string;
}

export interface EditableEvents {
  "VALUE.SET": { value: string };
  "EDIT": { src?: string };
  "SUBMIT": { focusable?: boolean; src?: string };
  "CANCEL": { focusable?: boolean; src?: string };
  "CONTROLLED.EDIT": {};
  "CONTROLLED.PREVIEW": { previousEvent: string };
}

export type EditableEvent = EventUnion<EditableEvents>;


/**
 * The editable's arguments: the values the host may set. The names are
 * the element's prop names. The twin (`defaultValue`) is resolved by the
 * framework before the factory is called, so the machine only ever sees
 * the live value.
 */
export interface EditableArgs {
  value?: string;
  maxLength?: number;
  defaultMaxLength?: number;
}

export function initial(args: EditableArgs = {}, authored: (name: string) => boolean): EditableContext {
  // The twin counts as the host's write: a host that wrote `defaultValue`
  // wrote the channel too.
  const written = (field: string): boolean =>
    authored(field) ||
    authored(defaultTwin(field)) ||
    (args as Record<string, unknown>)[defaultTwin(field)] !== undefined;
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

const config: MachineSpec<EditableContext, EditableEvents> = {
  id: "editable",
  initial: "preview",
  context: {
    value: "",
    previousValue: "",
    maxLength: null as number | null,
    editControlled: false,
    lastEvent: "",
  },
  // Root tier: the value is set wherever the machine is, so a host's
  // imperative `setValue` reaches a previewing field.
  on: {
    "VALUE.SET": { assign: (ctx, e) => {
      if (e.type !== "VALUE.SET") return {};
      const raw = typeof e.value === "string" ? e.value : "";
      const max = ctx.maxLength;
      const value = max === null || max <= 0 ? raw : raw.slice(0, max);
      return value === ctx.value ? {} : { value };
    } },
  },
  states: {
    preview: {
      on: {
        "CONTROLLED.EDIT": { target: "edit", assign: setPreviousValue },
        EDIT: [
          // Controlled: the host owns the state, so the machine only reports
          // that an edit was asked for. The host's own write brings it back
          // as CONTROLLED.EDIT.
          { cond: isEditControlled },
          { target: "edit", assign: setPreviousValue },
        ],
      },
    },
    edit: {
      on: {
        "CONTROLLED.PREVIEW": [
          { cond: (_ctx, e) => { return e.type === "CONTROLLED.PREVIEW" && e.previousEvent === "SUBMIT"; }, target: "preview", assign: setPreviousValue },
          { target: "preview", assign: revertValue },
        ],
        CANCEL: [
          { cond: isEditControlled, assign: setLastEvent },
          { target: "preview", assign: [revertValue, setLastEvent] },
        ],
        SUBMIT: [
          { cond: isEditControlled, assign: setLastEvent },
          { target: "preview", assign: [setPreviousValue, setLastEvent] },
        ],
      },
    },
  },
};

const implementations = {};

export function editable(
  args: EditableArgs = {},
  authored: (name: string) => boolean,
): Machine<EditableContext, EditableEvents> {
  return createMachine<EditableContext, EditableEvents>({
    ...config,
    context: initial(args, authored),
    /**
     * The machine's contract with its hosts: the context fields a host
     * may write, and the event each write carries. A field with an event
     * is REPORTED — the machine decides, and the change reaches the host;
     * a field without one is SILENT — the write lands and nothing reports.
     */
    fields: {
      value: { event: "VALUE.SET" },
      editControlled: {},
      maxLength: {},
    },
  });
}
