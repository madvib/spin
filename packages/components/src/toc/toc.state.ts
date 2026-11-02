import { defaultTwin } from "@spinjs/runtime";

export interface TocItem {
  readonly value: string;
  readonly label: string;
  readonly depth: number;
}

export interface TocItemState {
  readonly value: string;
  readonly active: boolean;
  readonly depth: number;
  readonly first: boolean;
  readonly last: boolean;
}

export type TocState = "idle" | "focused";

export interface TocContext {
  items: readonly TocItem[];
  activeIds: readonly string[];
  defaultActiveIds: readonly string[];
  multiple: boolean;
  autoScroll: boolean;
  rootMargin: string;
  scrollBehavior: "smooth" | "instant" | "auto";
}

export interface TocRow {
  readonly value?: string;
  readonly label?: string;
  readonly depth?: number;
}

export interface TocArgs {
  items?: readonly TocRow[];
  activeIds?: readonly string[];
  defaultActiveIds?: readonly string[];
  multiple?: boolean;
  autoScroll?: boolean;
  rootMargin?: string;
  scrollBehavior?: "smooth" | "instant" | "auto";
}

export function parseItems(raw: unknown): TocItem[] {
  const items: TocItem[] = [];
  const list: readonly unknown[] = Array.isArray(raw) ? raw : [];
  for (const entry of list) {
    if (typeof entry !== "object" || entry === null) continue;
    const row = entry as Record<string, unknown>;
    const value = row["value"];
    if (typeof value !== "string" || value.length === 0) continue;
    const label = row["label"];
    const rawDepth = row["depth"];
    const depth =
      typeof rawDepth === "number" && Number.isFinite(rawDepth)
        ? Math.max(1, Math.trunc(rawDepth))
        : 2;
    items.push({
      value,
      label: typeof label === "string" && label.length > 0 ? label : value,
      depth,
    });
  }
  return items;
}

export function parseActiveIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item === "string" && item.length > 0 && !out.includes(item)) {
      out.push(item);
    }
  }
  return out;
}

export function clampActiveIds(
  ids: readonly string[],
  multiple: boolean,
): readonly string[] {
  const unique = parseActiveIds(ids);
  if (!multiple && unique.length > 1) return [unique[0]!];
  return unique;
}

export function itemState(
  context: TocContext,
  row: TocItem | string,
): TocItemState {
  const value = typeof row === "string" ? row : row.value;
  const idx = context.items.findIndex((entry) => entry.value === value);
  const found = idx >= 0 ? context.items[idx] : undefined;
  const depth =
    found?.depth ?? (typeof row === "object" && row !== null ? row.depth : 2);
  return {
    value,
    active: context.activeIds.includes(value),
    depth,
    first: idx === 0,
    last: idx >= 0 && idx === context.items.length - 1,
  };
}

export function initial(
  args: TocArgs = {},
  authored: (name: string) => boolean,
): TocContext {
  const written = (field: string): boolean =>
    authored(field) ||
    authored(defaultTwin(field)) ||
    args.defaultActiveIds !== undefined;
  const items = parseItems(args.items ?? []);
  const multiple = args.multiple ?? false;
  const hostIds = parseActiveIds(args.activeIds ?? []);
  const defaultActiveIds = parseActiveIds(args.defaultActiveIds ?? []);
  const fallback = items[0] !== undefined ? [items[0].value] : [];
  const rawActive = written("activeIds")
    ? hostIds.length > 0
      ? hostIds
      : defaultActiveIds.length > 0
      ? defaultActiveIds
      : fallback
    : fallback;
  return {
    items,
    activeIds: clampActiveIds(rawActive, multiple),
    defaultActiveIds,
    multiple,
    autoScroll: args.autoScroll ?? true,
    rootMargin: args.rootMargin ?? "-20px 0px -40% 0px",
    scrollBehavior: args.scrollBehavior ?? "smooth",
  };
}
