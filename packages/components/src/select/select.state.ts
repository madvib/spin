import { defaultTwin } from "@spin/runtime";

export type SelectState = "idle" | "focused" | "open";

export interface SelectRow {
  readonly value: string;
  readonly label: string;
  readonly disabled?: boolean;
}

export interface SelectContext {
  value: string[];
  highlightedValue: string | null;
  /** The collection's rows. */
  items: readonly SelectRow[];
  /** The collection's values in order — derived sync over `items`. */
  order: string[];
  /** The collection's labels by value — derived sync over `items`. */
  labels: Record<string, string>;
  multiple: boolean;
  closeOnSelect: boolean;
  loopFocus: boolean;
  disabled: boolean;
  readOnly: boolean;
  required: boolean;
  invalid: boolean | undefined;
  dir: string;
  placement: unknown;
  name: string | undefined;
  form: string | undefined;
  clearTriggerLabel: string | undefined;
}

export interface SelectArgs {
  value?: string | readonly string[];
  highlightedValue?: string;
  items?: string | readonly SelectRow[] | readonly unknown[];
  multiple?: boolean;
  closeOnSelect?: boolean;
  loopFocus?: boolean;
  defaultCloseOnSelect?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  required?: boolean;
  invalid?: boolean;
  dir?: string;
  placement?: unknown;
  name?: string;
  form?: string;
  clearTriggerLabel?: string;
}

const parseKeys = (raw: unknown): string[] => {
  if (Array.isArray(raw)) {
    return raw.filter((v): v is string => typeof v === "string");
  }
  if (typeof raw !== "string") return [];
  const trimmed = raw.trim();
  if (trimmed === "") return [];
  return trimmed.split(",").map((s) => s.trim()).filter((s) => s.length > 0);
};

const nullableProp = (raw: unknown): string | null =>
  typeof raw === "string" && raw.length > 0 ? raw : null;

export const rowsOf = (raw: unknown): SelectRow[] => {
  const rows: SelectRow[] = [];
  if (typeof raw === "string") {
    // items as comma string? keep minimal: try parse keys
    const keys = parseKeys(raw);
    for (const k of keys) rows.push({ value: k, label: k });
    return rows;
  }
  const arr = Array.isArray(raw) ? raw : [];
  for (const entry of arr) {
    if (typeof entry !== "object" || entry === null) continue;
    const record = entry as Record<string, unknown>;
    const value = record["value"];
    if (typeof value !== "string" || value.length === 0) continue;
    rows.push({
      value,
      label: typeof record["label"] === "string" ? record["label"] : value,
      disabled: record["disabled"] === true,
    });
  }
  return rows;
};

export function initial(
  args: SelectArgs,
  authored: (name: string) => boolean = () => false,
): SelectContext {
  const written = (field: string): boolean =>
    authored(field) ||
    authored(defaultTwin(field)) ||
    (args as Record<string, unknown>)[defaultTwin(field)] !== undefined;
  const rows = rowsOf(args.items);
  const multiple = args.multiple === true;
  const closeOnSelect = written("closeOnSelect")
    ? args.closeOnSelect === true
    : !multiple;
  const loopFocus = args.loopFocus === true;
  const value = parseKeys(args.value);
  const highlightedValue = written("highlightedValue")
    ? nullableProp(args.highlightedValue)
    : null;
  const order = rows.map((row) => row.value);
  const labels: Record<string, string> = Object.fromEntries(
    rows.map((row) => [row.value, row.label]),
  );
  return {
    value,
    highlightedValue,
    items: rows,
    order,
    labels,
    multiple,
    closeOnSelect,
    loopFocus,
    disabled: args.disabled === true,
    readOnly: args.readOnly === true,
    required: args.required === true,
    invalid: authored("invalid") ? args.invalid === true : undefined,
    dir: typeof args.dir === "string" && args.dir.length > 0 ? args.dir : "ltr",
    placement: args.placement,
    name: typeof args.name === "string" && args.name.length > 0
      ? args.name
      : undefined,
    form: typeof args.form === "string" && args.form.length > 0
      ? args.form
      : undefined,
    clearTriggerLabel: typeof args.clearTriggerLabel === "string" &&
        args.clearTriggerLabel.length > 0
      ? args.clearTriggerLabel
      : undefined,
  };
}

export const selectLabel = (ctx: SelectContext): string => {
  if (ctx.value.length === 0) return "";
  if (!ctx.multiple) return ctx.labels[ctx.value[0]!] ?? "";
  return ctx.value.map((value) => ctx.labels[value] ?? value).join(", ");
};

export const inCollection = (
  ctx: SelectContext,
  value: string | null,
): value is string => value !== null && ctx.order.includes(value);
