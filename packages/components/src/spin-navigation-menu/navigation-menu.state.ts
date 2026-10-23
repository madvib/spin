import { defaultTwin } from "@spin/runtime";

export type NavValue = string;

export interface NavItemRecord {
  readonly value: NavValue;
  readonly label: string;
}

export type NavigationMenuState = "idle" | "open";

export interface NavigationMenuContext {
  value: NavValue;
  previousValue: NavValue;
  openDelay: number;
  closeDelay: number;
  orientation: "horizontal" | "vertical";
  disabled: boolean;
  items: readonly NavItemRecord[];
}

export interface NavigationMenuArgs {
  items?: unknown;
  value?: string;
  openDelay?: number;
  closeDelay?: number;
  orientation?: string;
  disabled?: boolean;
  defaultDisabled?: boolean;
}

export const asText = (raw: unknown): string | null =>
  typeof raw === "string" ? raw : null;

/** Shape raw items into rows, dropping entries without a usable value or
 * label. Shared by `initial` and the field contract, so a host write
 * parses exactly like the seed. */
export function parseItems(raw: unknown): NavItemRecord[] {
  const list: readonly unknown[] = Array.isArray(raw)
    ? raw
    : (typeof raw === "string" && raw.length > 0 ? ((): unknown[] => {
      try { const v = JSON.parse(raw); return Array.isArray(v) ? v : []; } catch { return []; }
    })() : []);
  const items: NavItemRecord[] = [];
  for (const entry of list) {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) continue;
    const bag: Record<string, unknown> = { ...entry };
    const value: unknown = bag["value"];
    const label: unknown = bag["label"];
    if (typeof value !== "string" || typeof label !== "string") continue;
    items.push({ value, label });
  }
  return items;
}

export function initial(args: NavigationMenuArgs = {}, authored: (name: string) => boolean): NavigationMenuContext {
  const written = (field: string): boolean =>
    authored(field) ||
    authored(defaultTwin(field)) ||
    (args as Record<string, unknown>)[defaultTwin(field)] !== undefined;
  const count = (value: unknown, fallback: number): number =>
    typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return {
    value: written("value") ? asText(args.value) ?? "" : "",
    previousValue: "",
    openDelay: written("openDelay") ? count(args.openDelay, 200) : 200,
    closeDelay: written("closeDelay") ? count(args.closeDelay, 300) : 300,
    orientation: written("orientation") && args.orientation === "vertical"
      ? "vertical"
      : "horizontal",
    disabled: written("disabled") ? args.disabled === true : false,
    items: parseItems(args.items),
  };
}

export function startState(args: NavigationMenuArgs = {}): NavigationMenuState {
  return (asText(args.value) ?? "").length > 0 ? "open" : "idle";
}