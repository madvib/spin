import type { TagsContext } from "./tags.state.ts";
import {
  canAdd,
  caretAtStart,
  clampIndex,
  isAtMax,
  uniq,
  valueAtIndex,
  withSelectLog,
} from "./tags.state.ts";
import type { TagsEvent } from "./tags.events.ts";

export const setInputValue = (
  _ctx: TagsContext,
  e: TagsEvent,
): Partial<TagsContext> => {
  if (e.type === "TYPE" || e.type === "SET_INPUT_VALUE" || e.type === "PASTE") {
    return { inputValue: e.value };
  }
  return {};
};

export const addTagFromPaste = (
  ctx: TagsContext,
  e: TagsEvent,
): Partial<TagsContext> => {
  if (e.type !== "PASTE") return {};
  const inputValue = ctx.sanitizeValue(ctx.inputValue);
  const values = ctx.delimiter.length > 0
    ? inputValue.split(ctx.delimiter).map((part) => ctx.sanitizeValue(part))
    : [inputValue];
  if (!ctx.validate({ inputValue, value: ctx.value })) {
    return { refusal: "invalidTag" as const, inputValue: "" };
  }
  const next = ctx.allowDuplicates
    ? [...ctx.value, ...values]
    : uniq([...ctx.value, ...values]);
  return {
    value: next,
    inputValue: "",
    log: { type: "paste", values },
    logPrev: ctx.log,
  };
};

export const deleteTag = (
  ctx: TagsContext,
  e: TagsEvent,
): Partial<TagsContext> => {
  if (e.type !== "CLEAR_TAG" && e.type !== "CLICK_DELETE_TAG") return {};
  const removed = ctx.value[e.index];
  if (removed === undefined) return {};
  return {
    value: ctx.value.filter((_, i) => i !== e.index),
    log: { type: "delete", value: removed },
    logPrev: ctx.log,
  };
};

export const deleteHighlighted = (ctx: TagsContext): Partial<TagsContext> => {
  const index = ctx.highlightedIndex;
  if (index === null) return {};
  const removed = ctx.value[index];
  if (removed === undefined) return {};
  return {
    value: ctx.value.filter((_, i) => i !== index),
    editedIndex: index,
    log: { type: "delete", value: removed },
    logPrev: ctx.log,
  };
};

export const clearInputValue = (): Partial<TagsContext> => ({ inputValue: "" });

export const clearHighlight = (): Partial<TagsContext> => ({
  highlightedIndex: null,
});

export const highlightPrev = (ctx: TagsContext): Partial<TagsContext> => {
  const at = ctx.highlightedIndex;
  if (at === null) return {};
  return withSelectLog(ctx, at > 0 ? at - 1 : null);
};

export const highlightLast = (ctx: TagsContext): Partial<TagsContext> =>
  withSelectLog(ctx, ctx.value.length > 0 ? ctx.value.length - 1 : null);

export const highlightAtIndex = (ctx: TagsContext): Partial<TagsContext> => {
  const index = ctx.editedIndex;
  return withSelectLog(
    ctx,
    index === null ? null : clampIndex(index, ctx.value.length),
  );
};

export const beginEdit = (
  ctx: TagsContext,
  e: TagsEvent,
): Partial<TagsContext> => {
  const index = e.type === "DOUBLE_CLICK_TAG" ? e.index : ctx.highlightedIndex;
  if (index === null) return {};
  const value = valueAtIndex(ctx, index);
  if (value === undefined) return {};
  return { editedIndex: index, editedValue: value };
};

export const finishEdit = (ctx: TagsContext): Partial<TagsContext> => {
  const index = ctx.editedIndex;
  const clamped = index === null ? null : clampIndex(index, ctx.value.length);
  return { ...withSelectLog(ctx, clamped), editedIndex: null, editedValue: "" };
};

export const clearEditAll = (): Partial<TagsContext> => ({
  editedValue: "",
  editedIndex: null,
  highlightedIndex: null,
});

export const hasHighlighted = (ctx: TagsContext): boolean =>
  ctx.highlightedIndex !== null;

export const canInsert = (ctx: TagsContext): boolean =>
  canAdd(ctx) && ctx.sanitizeValue(ctx.inputValue).length > 0;

export const insertOnBlur = (ctx: TagsContext): boolean =>
  ctx.addOnBlur && canAdd(ctx) && ctx.sanitizeValue(ctx.inputValue).length > 0;

export const clearOnBlur = (ctx: TagsContext): boolean => ctx.clearOnBlur;

export const addOnPaste = (ctx: TagsContext): boolean => ctx.addOnPaste;

export const canLeaveInput = (ctx: TagsContext, event: TagsEvent): boolean =>
  ctx.value.length > 0 && caretAtStart(event);

export const caretNotAtStart = (_ctx: TagsContext, event: TagsEvent): boolean =>
  !caretAtStart(event);

export { canAdd, caretAtStart, isAtMax };
export { addFromInput } from "./tags.state.ts";
