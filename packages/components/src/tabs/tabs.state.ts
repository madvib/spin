import { defaultTwin } from "@spin/runtime";

export interface TabsItem {
  readonly value: string;
  readonly label: string;
  readonly content: string;
  readonly badge?: string;
}

export type TabsState = "idle" | "focused";

export interface TabsContext {
  value: string;
  defaultValue: string;
  /** Configuration-that-never-changes: the shaped rows, supplied once at
   * instantiation. Bags read this for keyboard navigation. */
  items: readonly TabsItem[];
  orientation: "horizontal" | "vertical";
  activationMode: "automatic" | "manual";
  loopFocus: boolean;
  deselectable: boolean;
  composite: boolean;
}

/** A row as the host set it: the fields the host wrote, narrowed to their
 * own types. `label` may be absent — transport does not invent labels,
 * `initial` falls back to the value. */
export interface TabsRow {
  readonly value?: string;
  readonly label?: string;
  readonly content?: string;
  readonly badge?: string;
}

/**
 * The tabs' arguments: the values the host may set.
 *
 * The twin (`defaultValue`) is resolved by the framework before the factory
 * is called, so the machine only ever sees the live value; the machine
 * keeps the twin's own text in its context, so it also reads it when the
 * factory is called on its own.
 */
export interface TabsArgs {
  items?: readonly TabsRow[];
  value?: string;
  defaultValue?: string;
  orientation?: "horizontal" | "vertical";
  activationMode?: "automatic" | "manual";
  loopFocus?: boolean;
  deselectable?: boolean;
  composite?: boolean;
}
/** Shape raw items into rows: label-from-value, content-to-empty, and a row
 * without a usable value drops out. Shared by `initial` and the field
 * contract, so a host write parses exactly like the seed. */
export function parseItems(raw: unknown): TabsItem[] {
  const items: TabsItem[] = [];
  const list: readonly unknown[] = Array.isArray(raw) ? raw : [];
  for (const entry of list) {
    if (typeof entry !== "object" || entry === null) continue;
    const row = entry as Record<string, unknown>;
    const value = row["value"];
    if (typeof value !== "string" || value.length === 0) continue;
    const label = row["label"];
    const content = row["content"];
    const badge = row["badge"];
    items.push({
      value,
      label: typeof label === "string" ? label : value,
      content: typeof content === "string" ? content : "",
      ...(typeof badge === "string" ? { badge } : {}),
    });
  }
  return items;
}
/**
 * Shape the arguments into the machine's initial context.
 * Pure shaping only: the rows (label-from-value, content-to-empty, and a
 * row without a usable value drops out), and the first-selected fallback
 * (the host's write, then `defaultValue`, then the first row).
 *
 * The seed twin (`defaultValue`) is the host's write of the selection —
 * the framework resolved it into the args — so it counts as a write too.
 */
export function initial(
  args: TabsArgs = {},
  authored: (name: string) => boolean,
): TabsContext {
  // A host that wrote `defaultValue` wrote the channel too.
  const written = (field: string): boolean =>
    authored(field) ||
    authored(defaultTwin(field)) ||
    args.defaultValue !== undefined;
  const items = parseItems(args.items ?? []);
  const hostValue = args.value ?? "";
  const defaultValue = args.defaultValue ?? "";
  return {
    // The host's write wins outright; uncontrolled falls back to the first
    // tab, so a value is always selected.
    value: written("value")
      ? hostValue || defaultValue || items[0]?.value || ""
      : items[0]?.value || "",
    defaultValue,
    items,
    orientation: args.orientation ?? "horizontal",
    activationMode: args.activationMode ?? "automatic",
    loopFocus: args.loopFocus ?? true,
    deselectable: args.deselectable ?? false,
    composite: args.composite ?? true,
  };
}
