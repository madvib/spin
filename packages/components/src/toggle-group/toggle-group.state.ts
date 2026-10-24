import { defaultTwin } from "@spinjs/runtime";

export interface ToggleGroupItem {
  readonly value: string;
  readonly label: string;
  readonly disabled?: boolean;
}

export type ToggleGroupState = "idle" | "focused";

export interface ToggleGroupContext {
  value: string[];
  items: readonly ToggleGroupItem[];
  focusedId: string | null;
  multiple: boolean;
  deselectable: boolean;
  rovingFocus: boolean;
  loopFocus: boolean;
  orientation: "horizontal" | "vertical";
  disabled: boolean;
  /** A mousedown preceded the focus: don't steal it. The upstream uses a
   * ref; this fork has no ref tier, so it is a flag. */
  clickFocus: boolean;
  tabbingBackward: boolean;
}

export interface ToggleGroupRow {
  readonly value?: unknown;
  readonly label?: unknown;
  readonly disabled?: unknown;
}

/**
 * The toggle-group's arguments: the values the host may set.
 */
export interface ToggleGroupArgs {
  readonly value?: readonly string[] | string;
  readonly defaultValue?: readonly string[] | string;
  readonly items?: readonly ToggleGroupRow[] | string;
  readonly multiple?: boolean;
  readonly deselectable?: boolean;
  readonly rovingFocus?: boolean;
  readonly loopFocus?: boolean;
  readonly orientation?: "horizontal" | "vertical";
  readonly disabled?: boolean;
}

const parseItems = (raw: string): readonly unknown[] => {
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};
export const parseValues = (raw: unknown): string[] | null => {
  const list: unknown = typeof raw === "string"
    ? ((): unknown => {
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    })()
    : raw;
  if (!Array.isArray(list)) return null;
  return list.every((item) => typeof item === "string")
    ? [...(list as string[])]
    : null;
};
/** A string twin coerces through the scope grammar, so `"[]"` arrives as
 * text: parse it back, and pass arrays through. */
const coerceStrings = (raw: readonly string[] | string | undefined): string[] =>
  typeof raw === "string" ? parseValues(raw) ?? [] : [...(raw ?? [])];

export function initial(
  args: ToggleGroupArgs,
  authored: (name: string) => boolean,
): ToggleGroupContext {
  const list: readonly unknown[] = typeof args.items === "string"
    ? parseItems(args.items)
    : (args.items ?? []);
  const items: ToggleGroupItem[] = [];
  if (Array.isArray(list)) {
    for (const entry of list) {
      if (typeof entry === "object" && entry !== null) {
        const record = entry as Record<string, unknown>;
        const value = record["value"];
        if (typeof value !== "string" || value.length === 0) continue;
        const label = record["label"];
        items.push({
          value,
          label: typeof label === "string" && label.length > 0 ? label : value,
          ...(record["disabled"] === true ? { disabled: true as const } : {}),
        });
      } else if (typeof entry === "string" && entry.length > 0) {
        items.push({ value: entry, label: entry });
      }
    }
  }
  const written = (field: string): boolean =>
    authored(field) ||
    authored(defaultTwin(field)) ||
    (args as Record<string, unknown>)[defaultTwin(field)] !== undefined;
  return {
    value: written("value")
      ? coerceStrings(args.value)
      : coerceStrings(args.defaultValue),
    items,
    focusedId: null,
    multiple: written("multiple") ? args.multiple === true : false,
    deselectable: written("deselectable") ? args.deselectable !== false : true,
    rovingFocus: written("rovingFocus") ? args.rovingFocus !== false : true,
    loopFocus: written("loopFocus") ? args.loopFocus !== false : true,
    orientation: args.orientation === "vertical" ? "vertical" : "horizontal",
    disabled: written("disabled") ? args.disabled === true : false,
    clickFocus: false,
    tabbingBackward: false,
  };
}

export function isInteractive(ctx: ToggleGroupContext): boolean {
  return !ctx.disabled;
}

export function isPressed(ctx: ToggleGroupContext, value: string): boolean {
  return ctx.value.includes(value);
}
