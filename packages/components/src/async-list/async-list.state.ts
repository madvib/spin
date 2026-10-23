import { defaultTwin } from "@spin/runtime";

export type AsyncListState = "idle" | "loading" | "sorting";

export interface SortDescriptor {
  readonly column: string;
  readonly direction: "ascending" | "descending";
}

export interface AsyncListArgs {
  initialItems?: readonly unknown[];
  initialFilterText?: string;
  initialSortDescriptor?: SortDescriptor;
  sortFn?: unknown;
  load?: unknown;
}

export interface AsyncListContext {
  items: readonly unknown[];
  cursor: unknown;
  filterText: string;
  sortDescriptor: SortDescriptor | null;
  error: unknown;
  hasSortFn: boolean;
  dependenciesHash: string | undefined;
  load?: unknown;
  sortFn?: unknown;
}

export const isSortDescriptor = (value: unknown): value is SortDescriptor => {
  if (typeof value !== "object" || value === null) return false;
  const column: unknown = Reflect.get(value, "column");
  const direction: unknown = Reflect.get(value, "direction");
  return typeof column === "string" &&
    (direction === "ascending" || direction === "descending");
};

export function itemsOf(raw: unknown): readonly unknown[] {
  if (!Array.isArray(raw)) return [];
  if (raw.length === 1 && raw[0] === "[]") return [];
  return [...raw];
}

export function initial(args: AsyncListArgs = {}, authored: (name: string) => boolean = () => false): AsyncListContext {
  const written = (field: string): boolean =>
    authored(field) ||
    authored(defaultTwin(field)) ||
    (args as Record<string, unknown>)[defaultTwin(field)] !== undefined;
  const sortFn = written("sortFn") ? args.sortFn : undefined;
  return {
    items: itemsOf(args.initialItems),
    cursor: null,
    filterText: typeof args.initialFilterText === "string"
      ? args.initialFilterText
      : "",
    sortDescriptor: isSortDescriptor(args.initialSortDescriptor)
      ? args.initialSortDescriptor
      : null,
    error: undefined,
    hasSortFn: typeof sortFn === "function",
    dependenciesHash: undefined,
    load: args.load,
    sortFn: args.sortFn,
  };
}
