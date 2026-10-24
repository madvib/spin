import type { AssignFor, GuardFor } from "@spin/runtime/fsm";
import type { EditableContext } from "./editable.state.ts";
import type { EditableEvents } from "./editable.events.ts";

type EditableAssign<K extends keyof EditableEvents = keyof EditableEvents> =
  AssignFor<
    EditableContext,
    EditableEvents,
    K
  >;

export const setPreviousValue: EditableAssign = (ctx) => ({
  previousValue: ctx.value,
});

export const setLastEvent: EditableAssign<"CANCEL" | "SUBMIT"> = (_ctx, e) => ({
  lastEvent: e.type,
});

export const revertValue = (ctx: EditableContext): Partial<EditableContext> =>
  ctx.previousValue === "" ? {} : { value: ctx.previousValue };

export const isEditControlled: GuardFor<EditableContext, EditableEvents> = (
  ctx,
) => ctx.editControlled;

export const controlledPreviewIsSubmit: GuardFor<
  EditableContext,
  EditableEvents
> = (_ctx, e) =>
  e.type === "CONTROLLED.PREVIEW" && e.previousEvent === "SUBMIT";
