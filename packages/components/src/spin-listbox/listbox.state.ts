import { defaultTwin } from "@spin/runtime";

export interface ListboxArgsItem {
  readonly value: string;
  readonly label?: string | undefined;
  readonly disabled?: boolean | undefined;
  readonly group?: string | undefined;
}

export interface ListboxRowData {
  value: string;
  label: string;
  disabled: boolean;
  group: string;
}

export interface ListboxContext {
  value: string[];
  highlightedValue: string | null;
  focused: boolean;
  items: readonly ListboxArgsItem[];
  disabled: boolean;
  readOnly: boolean;
  multiple: boolean;
  selectOnHighlight: boolean;
  loopFocus: boolean;
  selectionBehavior: "replace" | "preserve" | "clear";
  orientation: string;
  dir: string;
  order: readonly string[];
  disabledValues: readonly string[];
  labels: Record<string, string>;
}

export interface ListboxArgs {
  items?: readonly ListboxArgsItem[];
  value?: string | readonly string[];
  highlightedValue?: string;
  multiple?: boolean;
  selectOnHighlight?: boolean;
  loopFocus?: boolean;
  selectionBehavior?: string;
  defaultHighlightedValue?: string;
  disabled?: boolean;
  readOnly?: boolean;
  orientation?: string;
  dir?: string;
}

export type ListboxState = "idle";

const rowsOf = (items: unknown): ListboxRowData[] => {
  const rows: ListboxRowData[] = [];
  for (const entry of Array.isArray(items) ? items : []) {
    if (typeof entry !== "object" || entry === null) continue;
    const record: Record<string, unknown> = entry;
    const value = record["value"];
    if (typeof value !== "string" || value.length === 0) continue;
    const label = typeof record["label"] === "string" && record["label"].length > 0
      ? record["label"]
      : value;
    rows.push({
      value,
      label,
      disabled: record["disabled"] === true,
      group: typeof record["group"] === "string" ? record["group"] : "",
    });
  }
  return rows;
};

/** Shape raw items the way `initial` does: arrays pass through, anything
 * else becomes empty. Shared by `initial` and the field contract, so a
 * host write parses exactly like the seed. */
export function parseItems(raw: unknown): readonly ListboxArgsItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((entry): entry is ListboxArgsItem =>
    typeof entry === "object" && entry !== null && typeof (entry as Record<string, unknown>)["value"] === "string");
}

export const parseKeys = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === "string");
  if (typeof value !== "string") return [];
  const list = value.startsWith("[") && value.endsWith("]") ? value.slice(1, -1) : value;
  return list.split(",").map((part) => part.trim()).filter((part) => part.length > 0);
};

export function initial(args: ListboxArgs = {}, authored: (name: string) => boolean): ListboxContext {
  const written = (field: string): boolean =>
    authored(field) ||
    authored(defaultTwin(field)) ||
    (args as Record<string, unknown>)[defaultTwin(field)] !== undefined;
  const multiple = args.multiple === true;
  const selection = args.selectionBehavior;
  const selectionBehavior: ListboxContext["selectionBehavior"] =
    selection === "preserve" || selection === "clear"
      ? selection
      : multiple
        ? "clear"
        : "replace";
  return {
    value: parseKeys(args.value),
    items: parseItems(args.items),
    disabled: args.disabled === true,
    readOnly: args.readOnly === true,
    highlightedValue: written("highlightedValue") &&
        typeof args.highlightedValue === "string" &&
        args.highlightedValue.length > 0
      ? args.highlightedValue
      : null,
    focused: false,
    multiple,
    selectOnHighlight: args.selectOnHighlight === true,
    loopFocus: args.loopFocus !== false,
    selectionBehavior,
    orientation: args.orientation ?? "vertical",
    dir: args.dir ?? "ltr",
    order: [],
    disabledValues: [],
    labels: {},
  };
}
export { rowsOf };
export const hasValue = (ctx: ListboxContext): boolean => ctx.value.length > 0;

export const stringifyValues = (ctx: ListboxContext): string => ctx.value.join(",");