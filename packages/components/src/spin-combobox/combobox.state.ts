import { defaultTwin } from "@spin/runtime";

export interface ComboboxRow {
  readonly value: string;
  readonly label: string;
  readonly disabled?: boolean;
  readonly group?: string;
  readonly index?: number;
}

export type ComboboxState = "idle" | "focused" | "interacting" | "suggesting";

export interface ComboboxContext {
  value: string[];
  inputValue: string;
  highlightedValue: string | null;
  autofill: string | null;
  order: string[];
  labels: Record<string, string>;
  multiple: boolean;
  closeOnSelect: boolean;
  allowCustomValue: boolean;
  inputBehavior: "none" | "autocomplete" | "autohighlight";
  selectionBehavior: "replace" | "preserve" | "clear";
  openOnChange: boolean;
  openOnKeyPress: boolean;
  alwaysSubmitOnEnter: boolean;
  items: readonly ComboboxRow[];
  disabled: boolean;
  readOnly: boolean;
  invalid: boolean;
  required: boolean;
  composite: boolean;
  placement: string;
  name: string;
  form: string;
  placeholder: string;
  triggerLabel: string;
  clearTriggerLabel: string;
  openOnClick: boolean;
  loopFocus: boolean;
  dir: "ltr" | "rtl";
}

export interface ComboboxArgs {
  items?: readonly ComboboxRow[];
  value?: string;
  inputValue?: string;
  highlightedValue?: string;
  multiple?: boolean;
  closeOnSelect?: boolean;
  allowCustomValue?: boolean;
  inputBehavior?: string;
  selectionBehavior?: string;
  openOnChange?: boolean;
  openOnKeyPress?: boolean;
  alwaysSubmitOnEnter?: boolean;
  defaultOpenOnChange?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  invalid?: boolean;
  required?: boolean;
  composite?: boolean;
  placement?: string;
  name?: string;
  form?: string;
  placeholder?: string;
  triggerLabel?: string;
  clearTriggerLabel?: string;
  openOnClick?: boolean;
  loopFocus?: boolean;
  dir?: "ltr" | "rtl";
}

/** Shape raw items the way `initial` does: arrays pass through, anything
 * else becomes empty. Shared by `initial` and the field contract, so a
 * host write parses exactly like the seed. */
export function parseItems(raw: unknown): readonly ComboboxRow[] {
  return Array.isArray(raw) ? raw : [];
}
const parseKeys = (raw: unknown): string[] => {
  if (Array.isArray(raw)) return raw.filter((v): v is string => typeof v === "string");
  if (typeof raw !== "string") return [];
  return raw.length > 0 ? raw.split(",").map((s) => s.trim()).filter(Boolean) : [];
};
const textProp = (raw: unknown): string => (typeof raw === "string" ? raw : "");
const nullableProp = (raw: unknown): string | null => (typeof raw === "string" && raw.length > 0 ? raw : null);

export function initial(args: ComboboxArgs, authored: (name: string) => boolean): ComboboxContext {
  const written = (field: string): boolean =>
    authored(field) ||
    authored(defaultTwin(field)) ||
    (args as Record<string, unknown>)[defaultTwin(field)] !== undefined;
  const multiple = written("multiple") ? args.multiple === true : false;
  const selectionRaw = args.selectionBehavior;
  const selectionBehavior = written("selectionBehavior")
    ? (selectionRaw === "preserve" || selectionRaw === "clear"
      ? selectionRaw
      : multiple
      ? "clear"
      : "replace")
    : (multiple ? "clear" : "replace");
  const behaviorRaw = args.inputBehavior;
  const inputBehavior = written("inputBehavior")
    ? (behaviorRaw === "autocomplete" || behaviorRaw === "autohighlight"
      ? behaviorRaw
      : "none")
    : "none";
  const rows = parseItems(args.items);
  const order = rows.map((r) => (typeof r.value === "string" ? r.value : "")).filter(Boolean);
  const labels = Object.fromEntries(rows.map((r) => [String(r.value), typeof r.label === "string" ? r.label : String(r.value)] as const));
  const value = parseKeys(args.value as unknown);
  const highlighted = nullableProp(args.highlightedValue);
  const closeOnSelect = written("closeOnSelect") ? args.closeOnSelect === true : !multiple;
  const allowCustomValue = written("allowCustomValue") ? args.allowCustomValue === true : false;
  const openOnChange = written("openOnChange") ? args.openOnChange !== false : true;
  const seedCtx: ComboboxContext = {
    value,
    inputValue: "",
    highlightedValue: highlighted,
    autofill: null,
    order,
    labels,
    multiple,
    closeOnSelect,
    allowCustomValue,
    inputBehavior,
    selectionBehavior,
    openOnChange,
    openOnKeyPress: written("openOnKeyPress") ? args.openOnKeyPress !== false : true,
    alwaysSubmitOnEnter: written("alwaysSubmitOnEnter") ? args.alwaysSubmitOnEnter === true : false,
    items: rows,
    disabled: args.disabled === true,
    readOnly: args.readOnly === true,
    invalid: args.invalid === true,
    required: args.required === true,
    composite: args.composite !== false,
    placement: typeof args.placement === "string" && args.placement.length > 0 ? args.placement : "bottom",
    name: typeof args.name === "string" ? args.name : "",
    form: typeof args.form === "string" ? args.form : "",
    placeholder: typeof args.placeholder === "string" ? args.placeholder : "",
    triggerLabel: typeof args.triggerLabel === "string" ? args.triggerLabel : "",
    clearTriggerLabel: typeof args.clearTriggerLabel === "string" ? args.clearTriggerLabel : "",
    openOnClick: args.openOnClick !== false,
    loopFocus: args.loopFocus === true,
    dir: args.dir === "rtl" ? "rtl" : "ltr",
  };
  const valueAsString = value.map((v) => labels[v] ?? v).join(", ");
  const seeded = textProp(args.inputValue);
  const inputValue = seeded.trim().length > 0 || multiple ? seeded : (selectionBehavior === "clear" ? "" : valueAsString);
  return { ...seedCtx, inputValue };
}

// Pure helpers
export const stringifyValues = (ctx: ComboboxContext, values: readonly string[]): string =>
  values.map((value) => ctx.labels[value]).filter((l): l is string => l !== undefined).join(", ");

export const pickOutcome = (ctx: ComboboxContext, value: string): string[] =>
  ctx.multiple ? (ctx.value.includes(value) ? ctx.value.filter((v) => v !== value) : [...ctx.value, value]) : [value];

export const isCustomValue = (ctx: ComboboxContext): boolean =>
  ctx.inputValue !== stringifyValues(ctx, ctx.value);

export { parseKeys };