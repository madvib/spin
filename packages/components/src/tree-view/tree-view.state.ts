import { coerceJsonArray, defaultTwin, isRecord } from "@spinjs/runtime";

export interface TreeExpandedChange {
  readonly expandedValue: readonly string[];
}
export interface TreeSelectionChange {
  readonly selectedValue: readonly string[];
}
export interface TreeFocusChange {
  readonly focusedValue: string | null;
}
export interface TreeCheckedChange {
  readonly checkedValue: readonly string[];
}
export interface TreeLoadComplete {
  readonly value: string;
}

export interface TreeArgs {
  readonly nodes?: unknown;
  readonly expandedValue?: readonly string[];
  readonly selectedValue?: readonly string[];
  readonly checkedValue?: readonly string[];
  readonly selectionMode?: string;
  readonly expandOnClick?: boolean;
  readonly rename?: boolean;
  readonly typeahead?: boolean;
  readonly loadChildren?: unknown;
}

export interface TreeNodeShape {
  readonly value: string;
  readonly label: string;
  readonly children?: readonly TreeNodeShape[] | undefined;
}

/** Malformed entries drop. */
const shapeNode = (entry: unknown): TreeNodeShape | null => {
  if (!isRecord(entry)) return null;
  const value: unknown = entry["value"];
  if (typeof value !== "string") return null;
  const label: unknown = entry["label"];
  const node: { value: string; label: string; children?: TreeNodeShape[] } = {
    value,
    label: typeof label === "string" ? label : "",
  };
  const kids: unknown = entry["children"];
  if (kids !== undefined) {
    if (!Array.isArray(kids)) return null;
    const shaped: TreeNodeShape[] = [];
    for (const kid of kids) {
      const child = shapeNode(kid);
      if (child === null) return null;
      shaped.push(child);
    }
    node.children = shaped;
  }
  return node;
};

/** The scope grammar has no recursive shape, so the collection parses here. */
export function nodesOf(raw: unknown): TreeNodeShape[] {
  const list: readonly unknown[] = typeof raw === "string"
    ? coerceJsonArray(raw, [])
    : Array.isArray(raw)
    ? raw
    : [];
  const out: TreeNodeShape[] = [];
  for (const entry of list) {
    const shaped = shapeNode(entry);
    if (shaped !== null) out.push(shaped);
  }
  return out;
}

const keysOf = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
};

export type TreeState = "idle" | "renaming";

export interface TreeContext {
  nodes: TreeNodeShape[];
  expandedValue: string[];
  selectedValue: string[];
  checkedValue: string[];
  focusedValue: string | null;
  renamingValue: string | null;
  loadingStatus: Record<string, "loading" | "loaded" | "error">;
  typeahead: string;
  typeaheadEnabled: boolean;
  selectionMode: "single" | "multiple";
  expandOnClick: boolean;
  rename: boolean;
  loadChildren: unknown;
}

export function initial(
  args: TreeArgs = {},
  authored: (name: string) => boolean = () => true,
): TreeContext {
  const written = (field: string): boolean =>
    authored(field) ||
    authored(defaultTwin(field)) ||
    (args as Record<string, unknown>)[defaultTwin(field)] !== undefined;
  return {
    nodes: nodesOf(args.nodes),
    expandedValue: written("expandedValue") ? keysOf(args.expandedValue) : [],
    selectedValue: written("selectedValue") ? keysOf(args.selectedValue) : [],
    checkedValue: written("checkedValue") ? keysOf(args.checkedValue) : [],
    focusedValue: null,
    renamingValue: null,
    loadingStatus: {},
    typeahead: "",
    typeaheadEnabled: written("typeahead") ? args.typeahead !== false : true,
    selectionMode: written("selectionMode")
      ? (args.selectionMode === "multiple" ? "multiple" : "single")
      : "single",
    expandOnClick: written("expandOnClick")
      ? args.expandOnClick !== false
      : true,
    rename: written("rename") ? args.rename !== false : true,
    loadChildren: args.loadChildren,
  };
}

export const sameSet = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((v) => b.includes(v));

export { keysOf };
