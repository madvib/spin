export type ModeChoice = "light" | "dark" | "system";
export type ResolvedMode = "light" | "dark";

export interface ModePickerArgs {
  readonly value?: ModeChoice;
  readonly defaultValue?: ModeChoice;
  readonly modes?: readonly string[] | string;
  readonly systemMode?: ResolvedMode;
  readonly hideWhenSingle?: boolean;
  readonly storageKey?: string;
  readonly syncDocument?: boolean;
}

export interface ModePickerContext {
  readonly value: ModeChoice;
  readonly modes: readonly string[];
  readonly systemMode: ResolvedMode;
  readonly hideWhenSingle: boolean;
  readonly storageKey: string;
  readonly syncDocument: boolean;
}

export type ModePickerState = "idle";

export const CYCLE_ORDER: readonly ModeChoice[] = ["light", "dark", "system"];

export function nextModeChoice(current: ModeChoice): ModeChoice {
  if (current === "light") return "dark";
  if (current === "dark") return "system";
  return "light";
}

export function isSingleMode(modes: readonly string[]): boolean {
  return modes.length <= 1;
}

export function resolveEffectiveMode(
  value: ModeChoice,
  modes: readonly string[],
  systemMode: ResolvedMode,
): ResolvedMode {
  if (isSingleMode(modes)) {
    return modes[0] === "dark" ? "dark" : "light";
  }
  if (value === "system") return systemMode;
  return value;
}

function parseModes(raw: readonly string[] | string | undefined): string[] | null {
  if (raw === undefined) return null;
  if (typeof raw === "string") return raw.split(/[\s,]+/).filter((m: string) => m.length > 0);
  return [...raw].filter((m) => m.length > 0);
}

export function readRuntimeModes(root?: Element): readonly string[] {
  if (typeof document === "undefined") return ["light", "dark"];
  const node = root ?? document.documentElement;
  const raw = getComputedStyle(node).getPropertyValue("--spin-modes").trim();
  if (raw.length === 0) return [];
  return raw.split(/\s+/).filter((m) => m.length > 0);
}

const VALID: readonly ModeChoice[] = ["light", "dark", "system"];

function parseChoice(raw: unknown): ModeChoice | null {
  return typeof raw === "string" && (VALID as readonly string[]).includes(raw)
    ? (raw as ModeChoice)
    : null;
}

export function initial(
  args: ModePickerArgs,
  authored: (name: string) => boolean,
): ModePickerContext {
  const written = (field: string): boolean =>
    authored(field) || args[field as keyof ModePickerArgs] !== undefined;
  const value = written("value")
    ? (parseChoice(args.value) ?? "system")
    : (parseChoice(args.defaultValue) ?? "system");
  const authoredModes = parseModes(args.modes);
  const systemMode: ResolvedMode =
    args.systemMode === "dark" ? "dark" : "light";
  return {
    value,
    modes: authoredModes ?? [],
    systemMode,
    hideWhenSingle: written("hideWhenSingle") ? args.hideWhenSingle === true : false,
    storageKey: typeof args.storageKey === "string" && args.storageKey.length > 0
      ? args.storageKey
      : "spin:mode",
    syncDocument: written("syncDocument") ? args.syncDocument !== false : true,
  };
}
