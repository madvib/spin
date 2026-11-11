import type { EventUnion } from "@spinjs/components/fsm";

export interface EditableEvents {
  "VALUE.SET": { value: string };
  "EDIT": { src?: string };
  "SUBMIT": { focusable?: boolean; src?: string };
  "CANCEL": { focusable?: boolean; src?: string };
  "CONTROLLED.EDIT": {};
  "CONTROLLED.PREVIEW": { previousEvent: string };
}

export type EditableEvent = EventUnion<EditableEvents>;

export type EditableEditChange = {
  readonly edit: boolean;
};

export type EditableValueChange = {
  readonly value: string;
};
