import { defaultTwin } from "@spinjs/runtime";

export type EditableState = "preview" | "edit";

export interface EditableContext {
  value: string;
  previousValue: string;
  maxLength: number | null;
  editControlled: boolean;
  lastEvent: string;
  disabled: boolean;
  readOnly: boolean;
  invalid: boolean | undefined;
  required: boolean;
  placeholder: string | { readonly edit?: string; readonly preview?: string };
  autoResize: boolean;
  dir: "ltr" | "rtl";
  name: string | undefined;
  form: string | undefined;
  submitMode: string;
  activationMode: string;
  selectOnFocus: boolean;
  onInteractOutside?: unknown;
  onPointerDownOutside?: unknown;
  onFocusOutside?: unknown;
}

export interface EditableArgs {
  value?: string;
  maxLength?: number;
  defaultMaxLength?: number;
  disabled?: boolean;
  readOnly?: boolean;
  invalid?: boolean;
  required?: boolean;
  placeholder?: string | { readonly edit?: string; readonly preview?: string };
  autoResize?: boolean;
  dir?: "ltr" | "rtl";
  name?: string;
  form?: string;
  submitMode?: string;
  activationMode?: string;
  selectOnFocus?: boolean;
  editing?: boolean;
  defaultEdit?: boolean;
  onInteractOutside?: unknown;
  onPointerDownOutside?: unknown;
  onFocusOutside?: unknown;
  onEditChange?: unknown;
}

export function initial(
  args: EditableArgs = {},
  authored: (name: string) => boolean,
): EditableContext {
  const written = (field: string): boolean =>
    authored(field) ||
    authored(defaultTwin(field)) ||
    (args as Record<string, unknown>)[defaultTwin(field)] !== undefined;
  const value = written("value") && typeof args.value === "string"
    ? args.value
    : "";
  const cap = args.maxLength;
  return {
    value,
    previousValue: value,
    maxLength: written("maxLength") && typeof cap === "number" &&
        Number.isFinite(cap) && cap > 0
      ? Math.trunc(cap)
      : null,
    editControlled: false,
    lastEvent: "",
    disabled: args.disabled === true,
    readOnly: args.readOnly === true,
    invalid: authored("invalid") ? args.invalid === true : undefined,
    required: args.required === true,
    placeholder: typeof args.placeholder === "string" ||
        (typeof args.placeholder === "object" && args.placeholder !== null)
      ? args.placeholder as string | {
        readonly edit?: string;
        readonly preview?: string;
      }
      : "",
    autoResize: args.autoResize === true,
    dir: args.dir === "rtl" ? "rtl" : "ltr",
    name: typeof args.name === "string" && args.name.length > 0
      ? args.name
      : undefined,
    form: typeof args.form === "string" && args.form.length > 0
      ? args.form
      : undefined,
    submitMode: typeof args.submitMode === "string" ? args.submitMode : "both",
    activationMode: typeof args.activationMode === "string"
      ? args.activationMode
      : "focus",
    selectOnFocus: args.selectOnFocus !== false,
    onInteractOutside: args.onInteractOutside,
    onPointerDownOutside: args.onPointerDownOutside,
    onFocusOutside: args.onFocusOutside,
  };
}
