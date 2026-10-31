import type { AssignFor } from "@spinjs/runtime/fsm";
import type { ModePickerEvents } from "./mode-picker.events.ts";
import type { ModePickerContext, ModeChoice, ResolvedMode } from "./mode-picker.state.ts";
import { isSingleMode, nextModeChoice } from "./mode-picker.state.ts";

type ModePickerAssign<K extends keyof ModePickerEvents = keyof ModePickerEvents> =
  AssignFor<ModePickerContext, ModePickerEvents, K>;

export const cycle: ModePickerAssign<"CYCLE"> = (ctx) => {
  if (isSingleMode(ctx.modes)) return {};
  return { value: nextModeChoice(ctx.value) };
};

const VALID: readonly string[] = ["light", "dark", "system"];

export const setValue: ModePickerAssign<"VALUE.SET"> = (_ctx, event) => {
  const value = (event as { value: unknown }).value;
  if (typeof value !== "string" || !VALID.includes(value)) return {};
  return { value: value as ModeChoice };
};

export const setModes: ModePickerAssign<"MODES.SET"> = (ctx, event) => {
  const raw = (event as { modes: unknown }).modes;
  const next = typeof raw === "string"
    ? raw.split(/[\s,]+/).filter((m: string) => m.length > 0)
    : Array.isArray(raw)
    ? (raw as readonly unknown[]).filter(
      (m): m is string => typeof m === "string" && m.length > 0,
    )
    : null;
  if (next === null) return {};
  const current = ctx.modes;
  const same = next.length === current.length &&
    next.every((mode, index) => mode === current[index]);
  return same ? {} : { modes: next };
};

export const setSystem: ModePickerAssign<"SYSTEM.SET"> = (_ctx, event) => {
  const mode = (event as { systemMode: unknown }).systemMode;
  if (mode !== "light" && mode !== "dark") return {};
  return { systemMode: mode as ResolvedMode };
};

export const canCycle = (ctx: ModePickerContext): boolean =>
  !isSingleMode(ctx.modes);
