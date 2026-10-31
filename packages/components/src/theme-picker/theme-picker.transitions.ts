import type { AssignFor, GuardFor } from "@spinjs/runtime/fsm";
import type { ThemePickerEvents } from "./theme-picker.events.ts";
import type { ThemePickerContext } from "./theme-picker.state.ts";
import { parseThemes } from "./theme-picker.state.ts";

type ThemePickerAssign<K extends keyof ThemePickerEvents = keyof ThemePickerEvents> =
  AssignFor<ThemePickerContext, ThemePickerEvents, K>;

type ThemePickerGuard<K extends keyof ThemePickerEvents = keyof ThemePickerEvents> =
  GuardFor<ThemePickerContext, ThemePickerEvents, K>;

function enabledItems(ctx: ThemePickerContext): number {
  return ctx.themes.filter((item) => !item.disabled).length;
}

function stepHighlight(ctx: ThemePickerContext, direction: 1 | -1): string {
  const items = ctx.themes;
  if (items.length === 0) return ctx.highlightedValue;
  const at = items.findIndex((item) => item.value === ctx.highlightedValue);
  const start = at < 0 ? (direction === 1 ? -1 : 0) : at;
  for (let i = 1; i <= items.length; i++) {
    const next = items[(start + direction * i + items.length * items.length) % items.length];
    if (next !== undefined && !next.disabled) return next.value;
  }
  return ctx.highlightedValue;
}

export const moveNext: ThemePickerAssign<"HIGHLIGHT.NEXT"> = (ctx) => ({
  highlightedValue: stepHighlight(ctx, 1),
});

export const movePrev: ThemePickerAssign<"HIGHLIGHT.PREV"> = (ctx) => ({
  highlightedValue: stepHighlight(ctx, -1),
});

export const moveFirst: ThemePickerAssign<"HIGHLIGHT.FIRST"> = (ctx) => {
  const first = ctx.themes.find((item) => !item.disabled);
  return first === undefined ? {} : { highlightedValue: first.value };
};

export const moveLast: ThemePickerAssign<"HIGHLIGHT.LAST"> = (ctx) => {
  const rest = [...ctx.themes].reverse().find((item) => !item.disabled);
  return rest === undefined ? {} : { highlightedValue: rest.value };
};

export const setHighlight: ThemePickerAssign<"HIGHLIGHT.SET"> = (_ctx, event) => {
  const value = (event as { value: unknown }).value;
  return typeof value === "string" ? { highlightedValue: value } : {};
};

export const selectItem: ThemePickerAssign<"ITEM.SELECT"> = (ctx, event) => {
  const value = (event as { value: unknown }).value;
  if (typeof value !== "string") return {};
  const item = ctx.themes.find((entry) => entry.value === value);
  if (item === undefined || item.disabled) return {};
  return { value, highlightedValue: value };
};

export const setValue: ThemePickerAssign<"VALUE.SET"> = (_ctx, event) => {
  const value = (event as { value: unknown }).value;
  if (typeof value !== "string" || value.length === 0) return {};
  return { value, highlightedValue: value };
};

export const setThemes: ThemePickerAssign<"THEMES.SET"> = (_ctx, event) => {
  const parsed = parseThemes((event as { themes: unknown }).themes);
  return parsed === null ? {} : { themes: parsed };
};

export const selectEnabled: ThemePickerGuard<"ITEM.SELECT"> = (ctx, event) => {
  const value = (event as { value: unknown }).value;
  if (typeof value !== "string") return false;
  const item = ctx.themes.find((entry) => entry.value === value);
  return item !== undefined && !item.disabled;
};

export const hasEnabled: ThemePickerGuard = (ctx) => enabledItems(ctx) > 0;
