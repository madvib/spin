/**
 * Tags-input machine: four states, one flat config.
 *
 * What Zag models as `idle` / `focused:input` / `navigating:tag` /
 * `editing:tag` survives here unchanged — they are genuine interaction
 * modes, not timer holders. What leaves is every effect: the live region,
 * the form-control tracking, the input sync and the focus reflexes are
 * view work (connect + stdlib actions), and the raf-wrapped action
 * helpers Zag needs (its sends are async) collapse into synchronous
 * context writes.
 *
 * Two deliberate shape changes from the Zag original:
 *
 * 1. Tags are tracked by INDEX, not by element id. Zag's context carries
 *    `highlightedTagId` / `editedTagId` because its guards read the DOM
 *    (`getIndexOfId`, `getTagElAtIndex`). Here the machine owns the value
 *    list, so an index is the honest key and the connect derives part ids
 *    (`tags-input:<id>:tag:<value>:<index>`) for the DOM.
 * 2. The two behavioral host functions (`sanitizeValue`, `validate`) are
 *    context fields, synced like the scalars. They are transforms the
 *    assigns apply, not out-side callbacks, so they belong with the state
 *    they govern rather than behind a prop read the machine cannot see.
 *
 * Caret position and blur targets are DOM facts: the view puts them on
 * the events it sends (`caretAtStart`, `relatedToInput`) and the guards
 * read them there, exactly as the guards read a click's modifier keys.
 */

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
  /** Index of the keyboard/pointer-highlighted tag; null when none. */
  highlightedIndex: number | null;
  editedValue: string;
  editedIndex: number | null;
  /** The last mutation and the one before it, for the live region. */
  log: TagsLog | null;
  logPrev: TagsLog | null;
  /** Set when an add was refused for validity; the bridge reports and clears. */
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

export interface TagsInitial {
  readonly value?: unknown;
  readonly inputValue?: unknown;
  readonly defaultValue?: unknown;
  readonly defaultInputValue?: unknown;
  readonly max?: unknown;
  readonly allowOverflow?: unknown;
  readonly allowDuplicates?: unknown;
  readonly editable?: unknown;
  readonly addOnPaste?: unknown;
  readonly blurBehavior?: unknown;
  readonly delimiter?: unknown;
  readonly sanitizeValue?: unknown;
  readonly validate?: unknown;
  readonly autoFocus?: unknown;
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

/** Two tag lists are one selection when every tag matches in order. */
export function sameTags(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

/** Seed shaping: the seeded value and input plus every scalar the
 * assigns read — the seed merges over the config, so absent fields would
 * keep the config defaults instead of the authored props. */
export function initial(raw: TagsInitial): Pick<TagsContext, "value" | "inputValue" | "max" | "allowOverflow" | "allowDuplicates" | "editable" | "addOnPaste" | "addOnBlur" | "clearOnBlur" | "delimiter" | "sanitizeValue" | "validate"> {
  const input: unknown = raw.defaultInputValue;
  const count = (value: unknown): number => typeof value === "number" && Number.isFinite(value) ? value : Infinity;
  const flag = (value: unknown): boolean => value === true;
  const text = (value: unknown, fallback: string): string => typeof value === "string" ? value : fallback;
  const fn = <T>(value: unknown, fallback: T): T => (typeof value === "function" ? value as T : fallback);
  const behavior: unknown = raw.blurBehavior;
  return {
    value: stringsOf(raw.defaultValue),
    inputValue: typeof input === "string" ? input : "",
    max: count(raw.max),
    allowOverflow: flag(raw.allowOverflow),
    allowDuplicates: flag(raw.allowDuplicates),
    editable: raw.editable !== false,
    addOnPaste: flag(raw.addOnPaste),
    addOnBlur: behavior === "add",
    clearOnBlur: behavior === "clear",
    delimiter: text(raw.delimiter, ","),
    sanitizeValue: fn(raw.sanitizeValue, sanitizeDefault),
    validate: fn(raw.validate, validateDefault),
  };
}

/** Zag's `isAtMax`, an exact count rather than a ceiling: a list already
 * past the cap (the overflow that makes the root invalid) is not "at" it,
 * so the insert still goes through. The cap blocks only the count that
 * equals it, which is why `api.atMax` below reports `>=` while the insert
 * guard reports equality — they answer different questions. */
const isAtMax = (ctx: TagsContext): boolean => ctx.value.length === ctx.max;

/** The overflow guard Zag's INSERT_TAG carries: at the cap the input text
 * survives the event rather than being cleared away with the tag. */
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

/**
 * A highlight move, announced as a selection when a mutation left a log.
 * Zag emits this from a watch on `highlightedTagId`; the equivalent here
 * is to write it wherever the highlight moves.
 */
const withSelectLog = (ctx: TagsContext, index: number | null): Partial<TagsContext> => {
  if (index === null || ctx.log === null) return { highlightedIndex: index };
  const value = ctx.value[index];
  if (value === undefined) return { highlightedIndex: index };
  return { highlightedIndex: index, logPrev: ctx.log, log: { type: "select", value } };
};

const valueAtIndex = (ctx: TagsContext, index: number): string | undefined => ctx.value[index];

/** The insert Zag's `raiseInsertTagEvent` performs: append the sanitized
 * input text, then clear it. Guarded by `canInsert` at every call site. */
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

export const config = {
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
  // Root tier: the tag gestures and the programmatic commands Zag also
  // answers in every state.
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
    // Zag runs `clearHighlightedId` as this state's entry action. Composed
    // into the transitions that reach it rather than written as `entry`,
    // because the one transition whose own assigns set a highlight (the
    // navigating:tag Delete that lands on the tag that slid in) must win:
    // the fork folds exit -> actions -> entry, so an entry action would
    // wipe what its own transition just set.
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

export const implementations = {
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
    // Zag's highlightTagAtIndex: the index the delete or the edit left
    // behind, clamped to what the removal left in the list.
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
