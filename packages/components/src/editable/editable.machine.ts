import { createMachine, type Machine } from "@spinjs/runtime/fsm";
import type {
  EditableArgs,
  EditableContext,
  EditableState,
} from "./editable.state.ts";
import { initial } from "./editable.state.ts";
import type { EditableEvents } from "./editable.events.ts";
import {
  controlledPreviewIsSubmit,
  isEditControlled,
  revertValue,
  setLastEvent,
  setPreviousValue,
} from "./editable.transitions.ts";

export function editable(
  args: EditableArgs = {},
  authored: (name: string) => boolean = () => false,
): Machine<EditableContext, EditableEvents, EditableState> {
  return createMachine<EditableContext, EditableEvents, EditableState>({
    id: "editable",
    initial: "preview",
    context: initial(args, authored),
    on: {
      "VALUE.SET": {
        assign: (ctx, e) => {
          const raw = typeof e.value === "string" ? e.value : "";
          const max = ctx.maxLength;
          const value = max === null || max <= 0 ? raw : raw.slice(0, max);
          return value === ctx.value ? {} : { value };
        },
      },
    },
    states: {
      preview: {
        on: {
          "CONTROLLED.EDIT": { target: "edit", assign: setPreviousValue },
          EDIT: [
            { cond: isEditControlled },
            { target: "edit", assign: setPreviousValue },
          ],
        },
      },
      edit: {
        on: {
          "CONTROLLED.PREVIEW": [
            {
              cond: controlledPreviewIsSubmit,
              target: "preview",
              assign: setPreviousValue,
            },
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
      disabled: {},
      readOnly: {},
      invalid: {},
      required: {},
      placeholder: {},
      autoResize: {},
      dir: {},
      name: {},
      form: {},
      submitMode: {},
      activationMode: {},
      selectOnFocus: {},
      onInteractOutside: {},
      onPointerDownOutside: {},
      onFocusOutside: {},
    },
  });
}
