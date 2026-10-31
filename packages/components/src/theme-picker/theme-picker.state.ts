export interface ThemePickerItem {
  readonly value: string;
  readonly label: string;
  readonly modes: readonly string[];
  readonly disabled: boolean;
  readonly index: number;
}

export type ThemePickerThemeArg =
  | string
  | {
    readonly value: string;
    readonly label?: string;
    readonly modes?: readonly string[];
    readonly disabled?: boolean;
  };

export interface ThemePickerArgs {
  readonly value?: string;
  readonly defaultValue?: string;
  readonly themes?: readonly ThemePickerThemeArg[] | string;
  readonly open?: boolean;
  readonly storageKey?: string;
  readonly syncDocument?: boolean;
}

export interface ThemePickerContext {
  readonly value: string;
  readonly themes: readonly ThemePickerItem[];
  readonly highlightedValue: string;
  readonly storageKey: string;
  readonly syncDocument: boolean;
}

export type ThemePickerState = "closed" | "open";

function parseThemeArg(raw: unknown, index: number): ThemePickerItem | null {
  if (typeof raw === "string" && raw.length > 0) {
    return { value: raw, label: raw, modes: ["light", "dark"], disabled: false, index };
  }
  if (typeof raw === "object" && raw !== null) {
    const record = raw as Record<string, unknown>;
    const value = record["value"];
    if (typeof value !== "string" || value.length === 0) return null;
    const label = record["label"];
    const modes = record["modes"];
    return {
      value,
      label: typeof label === "string" && label.length > 0 ? label : value,
      modes: Array.isArray(modes)
        ? (modes as readonly unknown[]).filter(
          (m): m is string => typeof m === "string" && m.length > 0,
        )
        : ["light", "dark"],
      disabled: record["disabled"] === true,
      index,
    };
  }
  return null;
}
export function parseThemes(raw: unknown): ThemePickerItem[] | null {
  if (typeof raw === "string") {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const out: ThemePickerItem[] = [];
        parsed.forEach((entry, index) => {
          const item = parseThemeArg(entry, index);
          if (item !== null) out.push(item);
        });
        return out;
      }
    } catch {
      // Not JSON: fall through to the name list.
    }
    const names = raw.split(/[\s,]+/).filter((n) => n.length > 0);
    return names.map((value, index) => ({
      value,
      label: value,
      modes: ["light", "dark"] as readonly string[],
      disabled: false,
      index,
    }));
  }
  if (!Array.isArray(raw)) return null;
  const out: ThemePickerItem[] = [];
  raw.forEach((entry, index) => {
    const item = parseThemeArg(entry, index);
    if (item !== null) out.push(item);
  });
  return out;
}

/**
 * The themes the stylesheet serves, read from the CSS the app generated.
 * `--spin-themes` names them; each `[data-theme="<name>"]` block carries
 * its own `--spin-modes`. A stylesheet the preset did not generate (or one
 * the browser cannot read) answers nothing, and the caller falls back to
 * the authored themes.
 */
export function discoverRuntimeThemes(root?: Element): ThemePickerItem[] {
  if (typeof document === "undefined") return [];
  const node = root ?? document.documentElement;
  const computed = getComputedStyle(node);
  const named = computed.getPropertyValue("--spin-themes").trim().split(/\s+/).filter(
    (n) => n.length > 0,
  );
  if (named.length === 0) return [];
  return named.map((value, index) => {
    const probe = document.createElement("div");
    probe.setAttribute("data-theme", value);
    probe.style.position = "absolute";
    probe.style.visibility = "hidden";
    node.appendChild(probe);
    const modes = getComputedStyle(probe).getPropertyValue("--spin-modes")
      .trim().split(/\s+/).filter((m) => m.length > 0);
    probe.remove();
    return {
      value,
      label: value,
      modes: modes.length > 0 ? modes : (["light", "dark"] as readonly string[]),
      disabled: false,
      index,
    };
  });
}

function readStored(storageKey: string): string | null {
  try {
    const raw = localStorage.getItem(storageKey);
    return typeof raw === "string" && raw.length > 0 ? raw : null;
  } catch {
    return null;
  }
}

export function initial(
  args: ThemePickerArgs,
  authored: (name: string) => boolean,
): ThemePickerContext {
  const written = (field: string): boolean =>
    authored(field) || args[field as keyof ThemePickerArgs] !== undefined;
  const parsed = parseThemes(args.themes) ?? [];
  const value = written("value") || written("defaultValue")
    ? (typeof args.value === "string" && args.value.length > 0
      ? args.value
      : typeof args.defaultValue === "string" && args.defaultValue.length > 0
      ? args.defaultValue
      : "")
    : "";
  const storageKey =
    typeof args.storageKey === "string" && args.storageKey.length > 0
      ? args.storageKey
      : "spin:theme";
  const stored = typeof localStorage !== "undefined" ? readStored(storageKey) : null;
  const seeded = stored ?? value;
  return {
    value: seeded,
    themes: parsed,
    highlightedValue: seeded,
    storageKey,
    syncDocument: written("syncDocument") ? args.syncDocument !== false : true,
  };
}
