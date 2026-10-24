import type { AssignFor, GuardFor } from "@spin/runtime/fsm";
import type { SplitterContext } from "./splitter.state.ts";
import {
  defaultSizes,
  fuzzyEqual,
  fuzzySizeEqual,
  parsePanels,
  pivotOf,
  resizeByDelta,
  validateSizes,
} from "./splitter.state.ts";
import type { SplitterEvents } from "./splitter.events.ts";

type SplitterAssign<K extends keyof SplitterEvents = keyof SplitterEvents> =
  AssignFor<
    SplitterContext,
    SplitterEvents,
    K
  >;

export const setFocusedHandle: SplitterAssign<"POINTER_OVER" | "FOCUS"> = (
  _ctx,
  event,
) => ({
  focusedHandle: event.id,
});

export const startDrag: SplitterAssign<"POINTER_DOWN"> = (ctx, event) => {
  const [beforeId, afterId] = event.id.split(":", 2) as [string, string];
  const before = ctx.panels.findIndex((panel) => panel.id === beforeId);
  const after = ctx.panels.findIndex((panel) => panel.id === afterId);
  if (before < 0 || after < 0) return {};
  return {
    focusedHandle: event.id,
    drag: {
      handleId: event.id,
      beforeId,
      afterId,
      startPercent: event.startPercent,
      startSizes: [...ctx.size],
    },
  };
};
export const clearFocus = (): Partial<SplitterContext> => ({
  focusedHandle: null,
});

export const clearDrag = (): Partial<SplitterContext> => ({ drag: null });

export const setSize: SplitterAssign<"SET_SIZE"> = (ctx, event) => {
  const raw: unknown = (event as { size: unknown }).size;
  const parsed: unknown = typeof raw === "string"
    ? (() => {
      try {
        return JSON.parse(raw) as unknown;
      } catch {
        return [];
      }
    })()
    : raw;
  const written = Array.isArray(parsed) &&
      parsed.every((n): n is number =>
        typeof n === "number" && Number.isFinite(n)
      )
    ? [...parsed]
    : null;
  if (written === null) return {};
  try {
    const safe = validateSizes(ctx.panels, written);
    return fuzzySizeEqual(ctx.size, safe) ? {} : { size: safe };
  } catch {
    return {};
  }
};

export const resetSize: SplitterAssign<"RESET_SIZE"> = (ctx) => {
  const safe = validateSizes(ctx.panels, defaultSizes(ctx.panels.length, []));
  return { size: safe };
};

export const collapsePanel: SplitterAssign<"COLLAPSE_PANEL"> = (ctx, event) => {
  const index = ctx.panels.findIndex((panel) => panel.id === event.id);
  const panel = ctx.panels[index];
  if (panel?.collapsible !== true) return {};
  const current = ctx.size[index] ?? 0;
  const collapsedSize = panel.collapsedSize ?? 0;
  if (fuzzyEqual(current, collapsedSize)) return {};
  const pivots = pivotOf(ctx.panels, index);
  const last = index === ctx.panels.length - 1;
  const delta = last ? current - collapsedSize : collapsedSize - current;
  const next = resizeByDelta(
    ctx.panels,
    delta,
    ctx.size,
    pivots,
    ctx.size,
    "imperative-api",
  );
  if (fuzzySizeEqual(ctx.size, next)) return {};
  return {
    size: next,
    beforeCollapse: { ...ctx.beforeCollapse, [panel.id]: current },
  };
};

export const expandPanel: SplitterAssign<"EXPAND_PANEL"> = (ctx, event) => {
  const index = ctx.panels.findIndex((panel) => panel.id === event.id);
  const panel = ctx.panels[index];
  if (panel?.collapsible !== true) return {};
  const current = ctx.size[index] ?? 0;
  const collapsedSize = panel.collapsedSize ?? 0;
  if (!fuzzyEqual(current, collapsedSize)) return {};
  const minSize = event.minSize ?? panel.minSize ?? 0;
  const remembered = ctx.beforeCollapse[panel.id];
  const base = remembered !== undefined && remembered >= minSize
    ? remembered
    : minSize;
  const last = index === ctx.panels.length - 1;
  const delta = last ? current - base : base - current;
  const pivots = pivotOf(ctx.panels, index);
  const next = resizeByDelta(
    ctx.panels,
    delta,
    ctx.size,
    pivots,
    ctx.size,
    "imperative-api",
  );
  return fuzzySizeEqual(ctx.size, next) ? {} : { size: next };
};

export const resizePanel: SplitterAssign<"RESIZE_PANEL"> = (ctx, event) => {
  const index = ctx.panels.findIndex((panel) => panel.id === event.id);
  if (ctx.panels[index] === undefined) return {};
  const current = ctx.size[index] ?? 0;
  const last = index === ctx.panels.length - 1;
  const delta = last ? current - event.size : event.size - current;
  const next = resizeByDelta(
    ctx.panels,
    delta,
    ctx.size,
    pivotOf(ctx.panels, index),
    ctx.size,
    "imperative-api",
  );
  return fuzzySizeEqual(ctx.size, next) ? {} : { size: next };
};

export const setPanels: SplitterAssign<"SET_PANELS"> = (_ctx, event) => ({
  panels: parsePanels((event as { panels: unknown }).panels),
});

export const toggleCollapseOnEnter: SplitterAssign<"ENTER"> = (ctx, event) => {
  const [beforeId] = event.id.split(":", 2);
  const index = ctx.panels.findIndex((panel) => panel.id === beforeId);
  const panel = ctx.panels[index];
  if (panel?.collapsible !== true) return {};
  const collapsedSize = panel.collapsedSize ?? 0;
  const current = ctx.size[index] ?? 0;
  const pivots = pivotOf(ctx.panels, index);
  if (fuzzyEqual(current, collapsedSize)) {
    const minSize = panel.minSize ?? 0;
    const remembered = ctx.beforeCollapse[panel.id];
    const base = remembered !== undefined && remembered >= minSize
      ? remembered
      : minSize;
    const last = index === ctx.panels.length - 1;
    const delta = last ? current - base : base - current;
    const next = resizeByDelta(
      ctx.panels,
      delta,
      ctx.size,
      pivots,
      ctx.size,
      "keyboard",
    );
    return fuzzySizeEqual(ctx.size, next) ? {} : { size: next };
  }
  const next = resizeByDelta(
    ctx.panels,
    index === ctx.panels.length - 1
      ? current - collapsedSize
      : collapsedSize - current,
    ctx.size,
    pivots,
    ctx.size,
    "keyboard",
  );
  if (fuzzySizeEqual(ctx.size, next)) return {};
  return {
    size: next,
    beforeCollapse: { ...ctx.beforeCollapse, [panel.id]: current },
  };
};

export const keyboardMove: SplitterAssign<"KEYBOARD_MOVE"> = (ctx, event) => {
  const [beforeId, afterId] = event.id.split(":", 2) as [string, string];
  const before = ctx.panels.findIndex((panel) => panel.id === beforeId);
  const after = ctx.panels.findIndex((panel) => panel.id === afterId);
  if (before < 0 || after < 0) return {};
  const next = resizeByDelta(
    ctx.panels,
    event.delta,
    ctx.size,
    [before, after],
    ctx.size,
    "keyboard",
  );
  return fuzzySizeEqual(ctx.size, next) ? {} : { size: next };
};

export const pointerMove: SplitterAssign<"POINTER_MOVE"> = (ctx, event) => {
  if (ctx.drag === null) return {};
  const before = ctx.panels.findIndex((panel) =>
    panel.id === ctx.drag?.beforeId
  );
  const after = ctx.panels.findIndex((panel) => panel.id === ctx.drag?.afterId);
  if (before < 0 || after < 0) return {};
  const delta = event.percent - (ctx.drag?.startPercent ?? 0);
  const next = resizeByDelta(
    ctx.panels,
    delta,
    ctx.drag?.startSizes ?? ctx.size,
    [before, after],
    ctx.size,
    "mouse-or-touch",
  );
  return fuzzySizeEqual(ctx.size, next) ? {} : { size: next };
};

export const isHandleFocused: GuardFor<SplitterContext, SplitterEvents> = (
  _ctx,
  event,
) => event.type === "POINTER_UP" ? event.handleFocused : false;
