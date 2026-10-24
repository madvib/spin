import type { AssignFor, GuardFor } from "@spinjs/runtime/fsm";
import type { CascadeEvents } from "./cascade.events.ts";
import type { CascadeContext } from "./cascade.state.ts";
import { parsePath, parsePaths } from "./cascade.state.ts";

type CascadeAssign<K extends keyof CascadeEvents = keyof CascadeEvents> =
  AssignFor<CascadeContext, CascadeEvents, K>;
type CascadeGuard<K extends keyof CascadeEvents = keyof CascadeEvents> =
  GuardFor<CascadeContext, CascadeEvents, K>;

const samePath = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((v, i) => v === b[i]);
const samePaths = (a: readonly string[][], b: readonly string[][]): boolean =>
  a.length === b.length && a.every((path, i) => samePath(path, b[i] ?? []));
const clonePath = (path: readonly string[]): string[] => [...path];
const clonePaths = (paths: readonly string[][]): string[][] =>
  paths.map((path) => [...path]);
const related = (a: readonly string[], b: readonly string[]): boolean => {
  const short = a.length <= b.length ? a : b;
  const long = a.length <= b.length ? b : a;
  return long.slice(0, short.length).every((v, i) => v === short[i]);
};
const withoutRelated = (
  paths: readonly string[][],
  path: readonly string[],
): string[][] =>
  paths.filter((candidate) => !related(candidate, path)).map((
    candidate,
  ) => [...candidate]);

export const restoresFocus: CascadeGuard = (_ctx, event) => {
  if (!("restoreFocus" in event)) return true;
  const value = (event as { restoreFocus?: unknown }).restoreFocus;
  return value !== false;
};

export const setValue: CascadeAssign<"VALUE_SET"> = (ctx, event) => {
  const paths = parsePaths(event.value);
  return samePaths(ctx.value, paths) ? {} : { value: clonePaths(paths) };
};

export const clearValue: CascadeAssign<"VALUE_CLEAR"> = () => ({ value: [] });

export const setHighlightedValue: CascadeAssign<"HIGHLIGHTED_VALUE_SET"> = (
  ctx,
  event,
) => {
  const raw = event.highlightedValue !== undefined
    ? event.highlightedValue
    : event.value;
  const path = parsePath(raw);
  return samePath(ctx.highlightedValue, path)
    ? {}
    : { highlightedValue: clonePath(path) };
};

export const clearHighlightedValue: CascadeAssign = (ctx) =>
  ctx.highlightedValue.length === 0 ? {} : { highlightedValue: [] };

const selectPath = (
  ctx: CascadeContext,
  path: readonly string[],
  hasChildren: boolean,
): Partial<CascadeContext> => {
  if (ctx.allowParentSelection) {
    return {
      value: [...withoutRelated(ctx.value, path), clonePath(path)],
      ...(hasChildren ? { highlightedValue: clonePath(path) } : {}),
    };
  }
  if (hasChildren) {
    return {
      value: ctx.multiple && ctx.value.length > 0
        ? [...ctx.value.slice(0, -1).map((p) => [...p]), clonePath(path)]
        : [clonePath(path)],
      highlightedValue: clonePath(path),
    };
  }
  if (ctx.multiple) {
    return {
      value: ctx.value.some((candidate) => samePath(candidate, path))
        ? ctx.value.filter((candidate) => !samePath(candidate, path)).map((
          candidate,
        ) => [...candidate])
        : [...ctx.value.map((candidate) => [...candidate]), clonePath(path)],
    };
  }
  return { value: [clonePath(path)] };
};

export const selectItem: CascadeAssign<"ITEM_SELECT" | "ITEM_CLICK"> = (
  ctx,
  event,
) => selectPath(ctx, event.value, event.hasChildren);

export const openWithHighlight: CascadeAssign<"TRIGGER_OPEN"> = (
  _ctx,
  event,
) => ({
  highlightedValue: clonePath(event.highlight),
});

export const highlightSelected: CascadeAssign<"TRIGGER_CLICK"> = (ctx) => {
  const last = ctx.value[ctx.value.length - 1];
  if (last === undefined || samePath(ctx.highlightedValue, last)) return {};
  return { highlightedValue: clonePath(last) };
};

export const itemClickCloseGuard: CascadeGuard<"ITEM_CLICK"> = (ctx, event) =>
  ctx.closeOnSelect && !event.hasChildren && !ctx.multiple;

export const itemClickSelectableGuard: CascadeGuard<"ITEM_CLICK"> = (
  ctx,
  event,
) => ctx.allowParentSelection || !event.hasChildren;

export const hoverHighlightGuard: CascadeGuard = (ctx) =>
  ctx.highlightTrigger === "hover";

export const hoverHighlightAssign: CascadeAssign<"ITEM_POINTER_ENTER"> = (
  _ctx,
  event,
) => ({
  highlightedValue: event.hasChildren
    ? clonePath(event.value)
    : event.value.slice(0, -1),
});

export const itemClearAssign: CascadeAssign<"ITEM_CLEAR"> = (ctx, event) =>
  ctx.value.some((path) => samePath(path, event.value))
    ? {
      value: ctx.value.filter((path) => !samePath(path, event.value)).map((
        path,
      ) => [...path]),
    }
    : {};

export const clearTriggerAssign: CascadeAssign<"CLEAR_TRIGGER_CLICK"> = () => ({
  value: [],
});
