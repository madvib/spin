/**
 * Tags-input machine: four states, one flat config.
 *
 * Tags are tracked by index, not element id: the machine owns the value
 * list, so the connect derives the part ids.
 *
 * Caret position and blur targets are DOM facts: the view puts them on
 * the events it sends (`caretAtStart`, `relatedToInput`) and the guards
 * read them there.
 */

import { defaultTwin } from "@spin/runtime";
import { createMachine, type Machine } from "@spin/runtime/fsm";

export interface TagsValidateArgs {
  readonly inputValue: string;
  readonly value: readonly string[];
}

export type SanitizeValue = (value: string) => string;

export type ValidateTag = (details: TagsValidateArgs) => boolean;

/** The mutation log: the connect turns each entry into an announcement. */
export type TagsLog =
  | { readonly type: "add"; readonly value: string }
  | { readonly type: "delete"; readonly value: string }
  | { readonly type: "update"; readonly value: string }
  | { readonly type: "paste"; readonly values: readonly string[] }
  | { readonly type: "select"; readonly value: string }
  | { readonly type: "clear" };

export interface TagsContext {
  value: string[];
  inputValue: string;
  highlightedIndex: number | null;
  editedValue: string;
  editedIndex: number | null;
  log: TagsLog | null;
  logPrev: TagsLog | null;
  /** Set when an add was refused; the bridge reports and clears it. */
  refusal: "invalidTag" | null;
  max: number;
  allowOverflow: boolean;
  allowDuplicates: boolean;
  editable: boolean;
  addOnPaste: boolean;
  addOnBlur: boolean;
  clearOnBlur: boolean;
  delimiter: string;
  sanitizeValue: SanitizeValue;
  validate: ValidateTag;
}

export interface TagsValueChange {
  readonly value: readonly string[];
}

export interface TagsInputValueChange {
  readonly inputValue: string;
}

export interface TagsHighlightChange {
  readonly highlightedValue: number | null;
}

export interface TagsValueInvalid {
  readonly reason: "invalidTag" | "rangeOverflow";
}

export type TagsEvent =
  | { type: "FOCUS" }
  | { type: "POINTER_DOWN" }
  | { type: "TYPE"; value: string }
  | { type: "BLUR" }
  | { type: "ENTER" }
  | { type: "DELIMITER_KEY" }
  | { type: "ARROW_LEFT"; caretAtStart: boolean }
  | { type: "ARROW_RIGHT"; caretAtStart: boolean }
  | { type: "ARROW_DOWN" }
  | { type: "ESCAPE" }
  | { type: "BACKSPACE"; caretAtStart: boolean }
  | { type: "DELETE"; caretAtStart: boolean }
  | { type: "PASTE"; value: string }
  | { type: "DOUBLE_CLICK_TAG"; index: number }
  | { type: "POINTER_DOWN_TAG"; index: number }
  | { type: "CLICK_DELETE_TAG"; index: number }
  | { type: "SET_INPUT_VALUE"; value: string }
  | { type: "SET_VALUE"; value: readonly string[] }
  | { type: "SET_VALUE_AT_INDEX"; index: number; value: string }
  | { type: "CLEAR_TAG"; index: number }
  | { type: "CLEAR_VALUE" }
  | { type: "ADD_TAG"; value?: string }
  | { type: "EXTERNAL_BLUR" }
  | { type: "TAG_INPUT_TYPE"; value: string }
  | { type: "TAG_INPUT_ESCAPE" }
  | { type: "TAG_INPUT_BLUR"; relatedToInput: boolean }
  | { type: "TAG_INPUT_ENTER" };

const uniq = (values: readonly string[]): string[] => [...new Set(values)];

const clampIndex = (index: number, length: number): number | null =>
  index < 0 || index >= length ? null : index;

const sanitizeDefault: SanitizeValue = (value: string): string => value.trim();

const validateDefault: ValidateTag = (): boolean => true;

/**
 * The tags-input's arguments: the values the host may set.
 *
 * The twins are resolved by the framework before the factory runs, so a
 * written twin already rides the live value; the twin stays in the bag as
 * the machine's fallback for the channel it seeds.
 *
 * A function cannot cross the scope channel, so the host's sanitizer and
 * validator ride the element: the machine's defaults stand until the
 * element installs the host's own.
 */
export interface TagsArgs {
  readonly value?: string;
  readonly defaultValue?: string;
  readonly inputValue?: string;
  readonly defaultInputValue?: string;
  readonly max?: number;
  readonly allowOverflow?: boolean;
  readonly allowDuplicates?: boolean;
  readonly editable?: boolean;
  readonly addOnPaste?: boolean;
  /** The blur behavior: `add` commits, `clear` empties, neither does. */
  readonly blurBehavior?: string;
  readonly delimiter?: string;
  readonly sanitizeValue?: SanitizeValue;
  readonly validate?: ValidateTag;
}

/** Strings off the transport: JSON text or arrays, well-shaped only.
 * The scope grammar coerces `= []` to `["[]"]` — the lone artifact entry
 * drops here, once, for every reader. */
export function stringsOf(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    const clean = raw.filter((item): item is string => typeof item === "string");
    return clean.some((item) => item === "[]") && clean.length === 1 ? [] : clean;
  }
  if (typeof raw !== "string") return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.every((item): item is string => typeof item === "string")
      ? [...parsed]
      : [];
  } catch {
    return [];
  }
}

export function sameTags(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

export function initial(args: TagsArgs, authored: (name: string) => boolean): Pick<TagsContext, "value" | "inputValue" | "max" | "allowOverflow" | "allowDuplicates" | "editable" | "addOnPaste" | "addOnBlur" | "clearOnBlur" | "delimiter" | "sanitizeValue" | "validate"> {
  const count = (value: unknown): number => typeof value === "number" && Number.isFinite(value) ? value : Infinity;
  const flag = (value: unknown): boolean => value === true;
  const text = (value: unknown, fallback: string): string => typeof value === "string" ? value : fallback;
  const fn = <T>(value: unknown, fallback: T): T => (typeof value === "function" ? value as T : fallback);
  const behavior: unknown = args.blurBehavior;
  const written = (field: string): boolean =>
    authored(field) || authored(defaultTwin(field));
  return {
    value: written("value")
      ? stringsOf(args.value)
      : stringsOf(args.defaultValue),
    inputValue: written("inputValue")
      ? text(args.inputValue, "")
      : text(args.defaultInputValue, ""),
    max: count(args.max),
    allowOverflow: flag(args.allowOverflow),
    allowDuplicates: flag(args.allowDuplicates),
    editable: args.editable !== false,
    addOnPaste: flag(args.addOnPaste),
    addOnBlur: behavior === "add",
    clearOnBlur: behavior === "clear",
    delimiter: text(args.delimiter, ","),
    sanitizeValue: fn(args.sanitizeValue, sanitizeDefault),
    validate: fn(args.validate, validateDefault),
  };
}

/** Zag's `isAtMax`, an exact count rather than a ceiling: a list already
 * past the cap is not "at" it, so the insert still goes through — which is
 * why `api.atMax` reports `>=` while this guard reports equality. */
const isAtMax = (ctx: TagsContext): boolean => ctx.value.length === ctx.max;

/** Zag's INSERT_TAG overflow guard: at the cap the input text survives. */
const canAdd = (ctx: TagsContext): boolean => ctx.allowOverflow || !isAtMax(ctx);

const caretAtStart = (event: TagsEvent): boolean => {
  switch (event.type) {
    case "ARROW_LEFT":
    case "ARROW_RIGHT":
    case "BACKSPACE":
    case "DELETE":
      return event.caretAtStart === true;
    default:
      return false;
  }
};

/** Zag announces the selection from a watch on the highlight; here it is
 * written wherever the highlight moves. */
const withSelectLog = (ctx: TagsContext, index: number | null): Partial<TagsContext> => {
  if (index === null || ctx.log === null) return { highlightedIndex: index };
  const value = ctx.value[index];
  if (value === undefined) return { highlightedIndex: index };
  return { highlightedIndex: index, logPrev: ctx.log, log: { type: "select", value } };
};

const valueAtIndex = (ctx: TagsContext, index: number): string | undefined => ctx.value[index];

/** Zag's `raiseInsertTagEvent`: append the sanitized input text, then
 * clear it. Guarded by `canInsert` at every call site. */
const addFromInput = (ctx: TagsContext): Partial<TagsContext> => {
  const inputValue = ctx.sanitizeValue(ctx.inputValue);
  if (!ctx.validate({ inputValue, value: ctx.value })) return { refusal: "invalidTag" as const };
  const next = ctx.allowDuplicates ? [...ctx.value, inputValue] : uniq([...ctx.value, inputValue]);
  return {
    value: next,
    inputValue: "",
    log: { type: "add", value: inputValue },
    logPrev: ctx.log,
  };
};

const config = {
  id: "tags-input",
  initial: "idle",
  context: {
    value: [] as string[],
    inputValue: "",
    highlightedIndex: null as number | null,
    editedValue: "",
    editedIndex: null as number | null,
    log: null as TagsLog | null,
    logPrev: null as TagsLog | null,
    refusal: null as "invalidTag" | null,
    max: Infinity,
    allowOverflow: false,
    allowDuplicates: false,
    editable: true,
    addOnPaste: false,
    addOnBlur: false,
    clearOnBlur: false,
    delimiter: ",",
    sanitizeValue: sanitizeDefault,
    validate: validateDefault,
  },
  on: {
    DOUBLE_CLICK_TAG: [
      { cond: "isTagEditable", target: "editing:tag", actions: [{ assign: "beginEdit" }] },
    ],
    POINTER_DOWN_TAG: { target: "navigating:tag", actions: [{ assign: "highlightTag" }] },
    CLICK_DELETE_TAG: {
      target: "focused:input",
      actions: [{ assign: "deleteTag" }, { assign: "clearHighlight" }],
    },
    SET_INPUT_VALUE: { actions: [{ assign: "setInputValue" }] },
    SET_VALUE: { actions: [{ assign: "setValue" }] },
    CLEAR_TAG: { actions: [{ assign: "deleteTag" }] },
    SET_VALUE_AT_INDEX: { actions: [{ assign: "setValueAtIndex" }] },
    CLEAR_VALUE: { actions: [{ assign: "clearTags" }, { assign: "clearInputValue" }] },
    ADD_TAG: { actions: [{ assign: "addTag" }] },
    EXTERNAL_BLUR: [
      { cond: "insertOnBlur", actions: [{ assign: "addFromInput" }] },
      { cond: "clearOnBlur", actions: [{ assign: "clearInputValue" }] },
    ],
  },
  states: {
    idle: {
      on: {
        FOCUS: { target: "focused:input", actions: [{ assign: "clearHighlight" }] },
        POINTER_DOWN: [
          { cond: "noHighlight", target: "focused:input", actions: [{ assign: "clearHighlight" }] },
        ],
      },
    },
    // Zag runs `clearHighlightedId` as this state's entry action, but it
    // is composed into the transitions that reach it: the fork folds
    // exit -> actions -> entry, so an entry action would wipe the
    // highlight a transition's own assigns just set.
    "focused:input": {
      on: {
        TYPE: { actions: [{ assign: "setInputValue" }] },
        BLUR: [
          { cond: "insertOnBlur", target: "idle", actions: [{ assign: "addFromInput" }] },
          { cond: "addOnBlur", target: "idle" },
          { cond: "clearOnBlur", target: "idle", actions: [{ assign: "clearInputValue" }] },
          { target: "idle" },
        ],
        ENTER: [{ cond: "canInsert", actions: [{ assign: "addFromInput" }] }],
        DELIMITER_KEY: [{ cond: "canInsert", actions: [{ assign: "addFromInput" }] }],
        ARROW_LEFT: [
          { cond: "canLeaveInput", target: "navigating:tag", actions: [{ assign: "highlightLast" }] },
        ],
        BACKSPACE: [
          { cond: "canLeaveInput", target: "navigating:tag", actions: [{ assign: "highlightLast" }] },
        ],
        DELETE: [
          {
            cond: "hasHighlighted",
            actions: [{ assign: "deleteHighlighted" }, { assign: "highlightAtIndex" }],
          },
        ],
        PASTE: [
          {
            cond: "addOnPaste",
            actions: [{ assign: "setInputValue" }, { assign: "addTagFromPaste" }],
          },
          { actions: [{ assign: "setInputValue" }] },
        ],
      },
    },
    "navigating:tag": {
      on: {
        ARROW_RIGHT: [
          { cond: "canAdvance", actions: [{ assign: "highlightNext" }] },
          { target: "focused:input", actions: [{ assign: "clearHighlight" }] },
        ],
        ARROW_LEFT: [
          { cond: "caretNotAtStart", target: "focused:input", actions: [{ assign: "clearHighlight" }] },
          { actions: [{ assign: "highlightPrev" }] },
        ],
        BLUR: { target: "idle", actions: [{ assign: "clearHighlight" }] },
        ENTER: [
          { cond: "canEditTag", target: "editing:tag", actions: [{ assign: "beginEdit" }] },
        ],
        ARROW_DOWN: { target: "focused:input", actions: [{ assign: "clearHighlight" }] },
        ESCAPE: { target: "focused:input", actions: [{ assign: "clearHighlight" }] },
        TYPE: { target: "focused:input", actions: [{ assign: "setInputValue" }, { assign: "clearHighlight" }] },
        BACKSPACE: [
          { cond: "caretNotAtStart", target: "focused:input", actions: [{ assign: "clearHighlight" }] },
          {
            cond: "isFirstHighlighted",
            actions: [{ assign: "deleteHighlighted" }, { assign: "highlightFirst" }],
          },
          {
            cond: "hasHighlighted",
            actions: [{ assign: "deleteHighlighted" }, { assign: "highlightPrev" }],
          },
          { actions: [{ assign: "highlightLast" }] },
        ],
        DELETE: [
          { cond: "caretNotAtStart", target: "focused:input", actions: [{ assign: "clearHighlight" }] },
          {
            target: "focused:input",
            actions: [{ assign: "deleteHighlighted" }, { assign: "highlightAtIndex" }],
          },
        ],
        PASTE: [
          {
            cond: "addOnPaste",
            target: "focused:input",
            actions: [{ assign: "setInputValue" }, { assign: "clearHighlight" }, { assign: "addTagFromPaste" }],
          },
          {
            target: "focused:input",
            actions: [{ assign: "setInputValue" }, { assign: "clearHighlight" }],
          },
        ],
      },
    },
    "editing:tag": {
      on: {
        TAG_INPUT_TYPE: { actions: [{ assign: "setEditedValue" }] },
        TAG_INPUT_ESCAPE: {
          target: "navigating:tag",
          actions: [{ assign: "clearEditedValue" }, { assign: "finishEdit" }],
        },
        TAG_INPUT_BLUR: [
          { cond: "isInputRelatedTarget", target: "navigating:tag", actions: [{ assign: "clearEditAll" }] },
          { target: "idle", actions: [{ assign: "clearEditAll" }] },
        ],
        TAG_INPUT_ENTER: [
          {
            cond: "isEditedTagEmpty",
            target: "navigating:tag",
            actions: [{ assign: "deleteHighlighted" }, { assign: "finishEdit" }],
          },
          {
            target: "navigating:tag",
            actions: [{ assign: "submitEdit" }, { assign: "finishEdit" }],
          },
        ],
      },
    },
  },
};

const implementations = {
  conds: {
    isTagEditable: (ctx: TagsContext): boolean => ctx.editable,
    hasTags: (ctx: TagsContext): boolean => ctx.value.length > 0,
    hasHighlighted: (ctx: TagsContext): boolean => ctx.highlightedIndex !== null,
    noHighlight: (ctx: TagsContext): boolean => ctx.highlightedIndex === null,
    isFirstHighlighted: (ctx: TagsContext): boolean => ctx.highlightedIndex === 0,
    isLastHighlighted: (ctx: TagsContext): boolean =>
      ctx.highlightedIndex !== null && ctx.highlightedIndex === ctx.value.length - 1,
    canInsert: (ctx: TagsContext): boolean =>
      canAdd(ctx) && ctx.sanitizeValue(ctx.inputValue).length > 0,
    insertOnBlur: (ctx: TagsContext): boolean => ctx.addOnBlur && canAdd(ctx)
      && ctx.sanitizeValue(ctx.inputValue).length > 0,
    addOnBlur: (ctx: TagsContext): boolean => ctx.addOnBlur,
    clearOnBlur: (ctx: TagsContext): boolean => ctx.clearOnBlur,
    addOnPaste: (ctx: TagsContext): boolean => ctx.addOnPaste,
    canAdvance: (ctx: TagsContext, event: TagsEvent): boolean =>
      ctx.value.length > 0 && caretAtStart(event) && ctx.highlightedIndex !== ctx.value.length - 1,
    canLeaveInput: (ctx: TagsContext, event: TagsEvent): boolean =>
      ctx.value.length > 0 && caretAtStart(event),
    caretNotAtStart: (_ctx: TagsContext, event: TagsEvent): boolean => !caretAtStart(event),
    isInputRelatedTarget: (_ctx: TagsContext, event: TagsEvent): boolean =>
      event.type === "TAG_INPUT_BLUR" && event.relatedToInput === true,
    canEditTag: (ctx: TagsContext): boolean => ctx.editable && ctx.highlightedIndex !== null,
    isEditedTagEmpty: (ctx: TagsContext): boolean => ctx.sanitizeValue(ctx.editedValue).length === 0,
  },
  assigns: {
    setInputValue: (_ctx: TagsContext, e: TagsEvent): Partial<TagsContext> => {
      if (e.type === "TYPE" || e.type === "SET_INPUT_VALUE" || e.type === "PASTE") {
        return { inputValue: e.value };
      }
      return {};
    },
    setEditedValue: (_ctx: TagsContext, e: TagsEvent): Partial<TagsContext> =>
      e.type === "TAG_INPUT_TYPE" ? { editedValue: e.value } : {},
    setValue: (_ctx: TagsContext, e: TagsEvent): Partial<TagsContext> =>
      e.type === "SET_VALUE" ? { value: [...e.value] } : {},
    setValueAtIndex: (ctx: TagsContext, e: TagsEvent): Partial<TagsContext> => {
      if (e.type !== "SET_VALUE_AT_INDEX") return {};
      if (e.value.length === 0) return {};
      if (e.index < 0 || e.index >= ctx.value.length) return {};
      const hasDuplicate = ctx.value.some((item, i) => i !== e.index && item === e.value);
      if (!ctx.allowDuplicates && hasDuplicate) return {};
      if (ctx.value[e.index] === e.value) return {};
      const value = [...ctx.value];
      value[e.index] = e.value;
      return { value, log: { type: "update", value: e.value }, logPrev: ctx.log };
    },
    addTag: (ctx: TagsContext, e: TagsEvent): Partial<TagsContext> => {
      const raw = e.type === "ADD_TAG" && typeof e.value === "string" ? e.value : ctx.inputValue;
      const inputValue = ctx.sanitizeValue(raw);
      if (!ctx.validate({ inputValue, value: ctx.value })) return { refusal: "invalidTag" as const };
      const next = ctx.allowDuplicates ? [...ctx.value, inputValue] : uniq([...ctx.value, inputValue]);
      return { value: next, log: { type: "add", value: inputValue }, logPrev: ctx.log };
    },
    addFromInput,
    addTagFromPaste: (ctx: TagsContext, e: TagsEvent): Partial<TagsContext> => {
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
    },
    deleteTag: (ctx: TagsContext, e: TagsEvent): Partial<TagsContext> => {
      if (e.type !== "CLEAR_TAG" && e.type !== "CLICK_DELETE_TAG") return {};
      const removed = ctx.value[e.index];
      if (removed === undefined) return {};
      return {
        value: ctx.value.filter((_, i) => i !== e.index),
        log: { type: "delete", value: removed },
        logPrev: ctx.log,
      };
    },
    deleteHighlighted: (ctx: TagsContext): Partial<TagsContext> => {
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
    },
    clearTags: (ctx: TagsContext): Partial<TagsContext> => ({
      value: [],
      log: { type: "clear" },
      logPrev: ctx.log,
    }),
    clearInputValue: (): Partial<TagsContext> => ({ inputValue: "" }),
    clearHighlight: (): Partial<TagsContext> => ({ highlightedIndex: null }),
    highlightTag: (ctx: TagsContext, e: TagsEvent): Partial<TagsContext> => {
      if (e.type !== "POINTER_DOWN_TAG") return {};
      return withSelectLog(ctx, clampIndex(e.index, ctx.value.length));
    },
    highlightNext: (ctx: TagsContext): Partial<TagsContext> => {
      const at = ctx.highlightedIndex;
      if (at === null) return {};
      return withSelectLog(ctx, at + 1 < ctx.value.length ? at + 1 : null);
    },
    highlightPrev: (ctx: TagsContext): Partial<TagsContext> => {
      const at = ctx.highlightedIndex;
      if (at === null) return {};
      return withSelectLog(ctx, at > 0 ? at - 1 : null);
    },
    highlightFirst: (ctx: TagsContext): Partial<TagsContext> =>
      withSelectLog(ctx, ctx.value.length > 0 ? 0 : null),
    highlightLast: (ctx: TagsContext): Partial<TagsContext> =>
      withSelectLog(ctx, ctx.value.length > 0 ? ctx.value.length - 1 : null),
    highlightAtIndex: (ctx: TagsContext): Partial<TagsContext> => {
      const index = ctx.editedIndex;
      return withSelectLog(ctx, index === null ? null : clampIndex(index, ctx.value.length));
    },
    beginEdit: (ctx: TagsContext, e: TagsEvent): Partial<TagsContext> => {
      const index = e.type === "DOUBLE_CLICK_TAG" ? e.index : ctx.highlightedIndex;
      if (index === null) return {};
      const value = valueAtIndex(ctx, index);
      if (value === undefined) return {};
      return { editedIndex: index, editedValue: value };
    },
    submitEdit: (ctx: TagsContext): Partial<TagsContext> => {
      const index = ctx.editedIndex;
      if (index === null) return {};
      const editedValue = ctx.editedValue;
      const hasDuplicate = ctx.value.some((item, i) => i !== index && item === editedValue);
      if (!ctx.allowDuplicates && hasDuplicate) return {};
      if (ctx.value[index] === editedValue) return {};
      const value = [...ctx.value];
      value[index] = editedValue;
      return { value, log: { type: "update", value: editedValue }, logPrev: ctx.log };
    },
    finishEdit: (ctx: TagsContext): Partial<TagsContext> => {
      const index = ctx.editedIndex;
      const clamped = index === null ? null : clampIndex(index, ctx.value.length);
      return { ...withSelectLog(ctx, clamped), editedIndex: null, editedValue: "" };
    },
    clearEditedValue: (): Partial<TagsContext> => ({ editedValue: "" }),
    clearEditAll: (): Partial<TagsContext> => ({
      editedValue: "",
      editedIndex: null,
      highlightedIndex: null,
    }),
  },
};

export function tags(
  args: TagsArgs = {},
  authored: (name: string) => boolean,
): Machine<TagsContext, TagsEvent> {
  return createMachine<TagsContext, TagsEvent>({
    ...config,
    context: { ...config.context, ...initial(args, authored) },
    fields: {
      value: { parse: stringsOf },
      inputValue: {},
      max: {},
      allowOverflow: {},
      allowDuplicates: {},
      editable: {},
      addOnPaste: {},
      delimiter: {},
    },
    assigns: implementations.assigns,
    conds: implementations.conds,
  });
}
