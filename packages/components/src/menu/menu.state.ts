import { coerceJsonArray, isRecord } from "@spinjs/runtime";

export interface MenuItemData {
  readonly value: string;
  readonly label: string;
  readonly shortcut?: string | undefined;
  readonly disabled?: boolean | undefined;
  readonly checked?: boolean | undefined;
  readonly children?: readonly MenuEntry[] | undefined;
}
export interface MenuSeparatorData {
  readonly separator: true;
}

export interface MenuGroupData {
  readonly group: string;
  readonly items: readonly MenuEntry[];
}

export type MenuEntry = MenuItemData | MenuSeparatorData | MenuGroupData;

export interface MenuRow {
  readonly value: string;
  readonly label: string;
  readonly shortcut: string;
  readonly disabled: boolean;
  readonly checked: boolean | undefined;
  readonly children: readonly MenuEntry[];
}

export interface MenuBlock {
  readonly id: string;
  readonly label: string | null;
  readonly rows: readonly MenuRow[];
  readonly separator: boolean;
}

export interface MenuArgs {
  items?: string | readonly MenuEntry[];
  submenu?: boolean;
  loopFocus?: boolean;
  closeOnSelect?: boolean;
  typeahead?: boolean;
  composite?: boolean;
}

export type MenuState = "closed" | "open";

export interface MenuContext {
  highlightedValue: string | null;
  openSubmenu: string | null;
  anchorPoint: { x: number; y: number } | null;
  isSubmenu: boolean;
  loopFocus: boolean;
  closeOnSelect: boolean;
  typeahead: boolean;
  composite: boolean;
  readonly entries: readonly MenuEntry[];
}

function parseEntry(raw: unknown): MenuEntry | undefined {
  if (!isRecord(raw)) return undefined;
  const record = raw;
  if (record["separator"] === true) return { separator: true };
  const group = record["group"];
  const items = record["items"];
  if (typeof group === "string" && Array.isArray(items)) {
    return {
      group,
      items: items.flatMap((item) => {
        const entry = parseEntry(item);
        return entry === undefined ? [] : [entry];
      }),
    };
  }
  const value = record["value"];
  const label = record["label"];
  if (typeof value !== "string" || typeof label !== "string") return undefined;
  const row: {
    value: string;
    label: string;
    shortcut?: string;
    disabled?: boolean;
    checked?: boolean;
    children?: readonly MenuEntry[];
  } = { value, label };
  if (typeof record["shortcut"] === "string") row.shortcut = record["shortcut"];
  if (typeof record["disabled"] === "boolean") {
    row.disabled = record["disabled"];
  }
  if (typeof record["checked"] === "boolean") row.checked = record["checked"];
  if (Array.isArray(record["children"])) {
    row.children = record["children"].flatMap((child) => {
      const entry = parseEntry(child);
      return entry === undefined ? [] : [entry];
    });
  }
  return row;
}

export function entriesOf(raw: unknown): readonly MenuEntry[] {
  const source: readonly unknown[] = Array.isArray(raw)
    ? raw
    : typeof raw === "string"
    ? coerceJsonArray(raw, [])
    : [];
  const entries: MenuEntry[] = [];
  for (const item of source) {
    const entry = parseEntry(item);
    if (entry !== undefined) entries.push(entry);
  }
  return entries;
}

export function initial(
  args: MenuArgs = {},
  _authored: (name: string) => boolean = () => false,
): MenuContext {
  void _authored;
  return {
    highlightedValue: null,
    openSubmenu: null,
    anchorPoint: null,
    isSubmenu: args.submenu === true,
    loopFocus: args.loopFocus === true,
    closeOnSelect: args.closeOnSelect ?? true,
    typeahead: args.typeahead ?? true,
    composite: args.composite ?? true,
    entries: entriesOf(args.items),
  };
}
