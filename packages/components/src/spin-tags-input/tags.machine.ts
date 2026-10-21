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
import { createMachine, type Machine, type EventUnion, type MachineSpec } from "@spin/runtime/fsm";
const setInputValue = (_ctx: TagsContext, e: TagsEvent) : Partial<TagsContext> => {
      if (e.type === "TYPE" || e.type === "SET_INPUT_VALUE" || e.type === "PASTE") {
        return { inputValue: e.value };
      }
      return {};
    };

const addTagFromPaste = (ctx: TagsContext, e: TagsEvent) : Partial<TagsContext> => {
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

const deleteTag = (ctx: TagsContext, e: TagsEvent) : Partial<TagsContext> => {
      if (e.type !== "CLEAR_TAG" && e.type !== "CLICK_DELETE_TAG") return {};
      const removed = ctx.value[e.index];
      if (removed === undefined) return {};
      return {
        value: ctx.value.filter((_, i) => i !== e.index),
        log: { type: "delete", value: removed },
        logPrev: ctx.log,
      };
    };

const deleteHighlighted = (ctx: TagsContext) : Partial<TagsContext> => {
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

const clearInputValue = () : Partial<TagsContext> => { return ({ inputValue: "" }); };

const clearHighlight = () : Partial<TagsContext> => { return ({ highlightedIndex: null }); };

const highlightPrev = (ctx: TagsContext) : Partial<TagsContext> => {
      const at = ctx.highlightedIndex;
      if (at === null) return {};
      return withSelectLog(ctx, at > 0 ? at - 1 : null);
    };

const highlightLast = (ctx: TagsContext) : Partial<TagsContext> => { return withSelectLog(ctx, ctx.value.length > 0 ? ctx.value.length - 1 : null); };

const highlightAtIndex = (ctx: TagsContext) : Partial<TagsContext> => {
      const index = ctx.editedIndex;
      return withSelectLog(ctx, index === null ? null : clampIndex(index, ctx.value.length));
    };

const beginEdit = (ctx: TagsContext, e: TagsEvent) : Partial<TagsContext> => {
      const index = e.type === "DOUBLE_CLICK_TAG" ? e.index : ctx.highlightedIndex;
      if (index === null) return {};
      const value = valueAtIndex(ctx, index);
      if (value === undefined) return {};
      return { editedIndex: index, editedValue: value };
    };

const finishEdit = (ctx: TagsContext) : Partial<TagsContext> => {
      const index = ctx.editedIndex;
      const clamped = index === null ? null : clampIndex(index, ctx.value.length);
      return { ...withSelectLog(ctx, clamped), editedIndex: null, editedValue: "" };
    };

const clearEditAll = () : Partial<TagsContext> => { return ({
      editedValue: "",
      editedIndex: null,
      highlightedIndex: null,
    }); };

const hasHighlighted = (ctx: TagsContext) : boolean => { return ctx.highlightedIndex !== null; };

const canInsert = (ctx: TagsContext) : boolean => { return canAdd(ctx) && ctx.sanitizeValue(ctx.inputValue).length > 0; };

const insertOnBlur = (ctx: TagsContext) : boolean => { return ctx.addOnBlur && canAdd(ctx)
      && ctx.sanitizeValue(ctx.inputValue).length > 0; };

const clearOnBlur = (ctx: TagsContext) : boolean => { return ctx.clearOnBlur; };

const addOnPaste = (ctx: TagsContext) : boolean => { return ctx.addOnPaste; };

const canLeaveInput = (ctx: TagsContext, event: EventUnion<TagsEvents>) : boolean => { return ctx.value.length > 0 && caretAtStart(event); };

const caretNotAtStart = (_ctx: TagsContext, event: EventUnion<TagsEvents>) : boolean => { return !caretAtStart(event); };



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

export interface TagsEvents {
  "FOCUS": {};
  "POINTER_DOWN": {};
  "TYPE": { value: string };
  "BLUR": {};
  "ENTER": {};
  "DELIMITER_KEY": {};
  "ARROW_LEFT": { caretAtStart: boolean };
  "ARROW_RIGHT": { caretAtStart: boolean };
  "ARROW_DOWN": {};
  "ESCAPE": {};
  "BACKSPACE": { caretAtStart: boolean };
  "DELETE": { caretAtStart: boolean };
  "PASTE": { value: string };
  "DOUBLE_CLICK_TAG": { index: number };
  "POINTER_DOWN_TAG": { index: number };
  "CLICK_DELETE_TAG": { index: number };
  "SET_INPUT_VALUE": { value: string };
  "SET_VALUE": { value: readonly string[] };
  "SET_VALUE_AT_INDEX": { index: number; value: string };
  "CLEAR_TAG": { index: number };
  "CLEAR_VALUE": {};
  "ADD_TAG": { value?: string };
  "EXTERNAL_BLUR": {};
  "TAG_INPUT_TYPE": { value: string };
  "TAG_INPUT_ESCAPE": {};
  "TAG_INPUT_BLUR": { relatedToInput: boolean };
  "TAG_INPUT_ENTER": {};
}

export type TagsEvent = EventUnion<TagsEvents>;


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
    authored(field) ||
    authored(defaultTwin(field)) ||
    (args as Record<string, unknown>)[defaultTwin(field)] !== undefined;
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

/** An exact count rather than a ceiling: a list already past the cap is not
 * "at" it, so the insert still goes through — which is why `api.atMax`
 * reports `>=` while this guard reports equality. */
const isAtMax = (ctx: TagsContext): boolean => ctx.value.length === ctx.max;

/** The INSERT_TAG overflow guard: at the cap the input text survives. */
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

/** The selection is announced from a watch on the highlight; here it is
 * written wherever the highlight moves. */
const withSelectLog = (ctx: TagsContext, index: number | null): Partial<TagsContext> => {
  if (index === null || ctx.log === null) return { highlightedIndex: index };
  const value = ctx.value[index];
  if (value === undefined) return { highlightedIndex: index };
  return { highlightedIndex: index, logPrev: ctx.log, log: { type: "select", value } };
};

const valueAtIndex = (ctx: TagsContext, index: number): string | undefined => ctx.value[index];

/** Append the sanitized input text, then clear it. Guarded by `canInsert`
 * at every call site. */
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

const config: MachineSpec<TagsContext, TagsEvents> = {
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
      { cond: (ctx) => { return ctx.editable; }, target: "editing:tag", assign: beginEdit },
    ],
    POINTER_DOWN_TAG: { target: "navigating:tag", assign: (ctx, e) => {
      if (e.type !== "POINTER_DOWN_TAG") return {};
      return withSelectLog(ctx, clampIndex(e.index, ctx.value.length));
    } },
    CLICK_DELETE_TAG: {
      target: "focused:input",
      assign: [deleteTag, clearHighlight],
    },
    SET_INPUT_VALUE: { assign: setInputValue },
    SET_VALUE: { assign: (_ctx, e) => { return e.type === "SET_VALUE" ? { value: [...e.value] } : {}; } },
    CLEAR_TAG: { assign: deleteTag },
    SET_VALUE_AT_INDEX: { assign: (ctx, e) => {
      if (e.type !== "SET_VALUE_AT_INDEX") return {};
      if (e.value.length === 0) return {};
      if (e.index < 0 || e.index >= ctx.value.length) return {};
      const hasDuplicate = ctx.value.some((item, i) => i !== e.index && item === e.value);
      if (!ctx.allowDuplicates && hasDuplicate) return {};
      if (ctx.value[e.index] === e.value) return {};
      const value = [...ctx.value];
      value[e.index] = e.value;
      return { value, log: { type: "update", value: e.value }, logPrev: ctx.log };
    } },
    CLEAR_VALUE: { assign: [(ctx) => { return ({
      value: [],
      log: { type: "clear" },
      logPrev: ctx.log,
    }); }, clearInputValue] },
    ADD_TAG: { assign: (ctx, e) => {
      const raw = e.type === "ADD_TAG" && typeof e.value === "string" ? e.value : ctx.inputValue;
      const inputValue = ctx.sanitizeValue(raw);
      if (!ctx.validate({ inputValue, value: ctx.value })) return { refusal: "invalidTag" as const };
      const next = ctx.allowDuplicates ? [...ctx.value, inputValue] : uniq([...ctx.value, inputValue]);
      return { value: next, log: { type: "add", value: inputValue }, logPrev: ctx.log };
    } },
    EXTERNAL_BLUR: [
      { cond: insertOnBlur, assign: addFromInput },
      { cond: clearOnBlur, assign: clearInputValue },
    ],
  },
  states: {
    idle: {
      on: {
        FOCUS: { target: "focused:input", assign: clearHighlight },
        POINTER_DOWN: [
          { cond: (ctx) => { return ctx.highlightedIndex === null; }, target: "focused:input", assign: clearHighlight },
        ],
      },
    },
    // `clearHighlightedId` runs as this state's entry action upstream, but
    // here it is composed into the transitions that reach it: the fork
    // folds exit -> actions -> entry, so an entry action would wipe the
    // highlight a transition's own assigns just set.
    "focused:input": {
      on: {
        TYPE: { assign: setInputValue },
        BLUR: [
          { cond: insertOnBlur, target: "idle", assign: addFromInput },
          { cond: (ctx) => { return ctx.addOnBlur; }, target: "idle" },
          { cond: clearOnBlur, target: "idle", assign: clearInputValue },
          { target: "idle" },
        ],
        ENTER: [{ cond: canInsert, assign: addFromInput }],
        DELIMITER_KEY: [{ cond: canInsert, assign: addFromInput }],
        ARROW_LEFT: [
          { cond: canLeaveInput, target: "navigating:tag", assign: highlightLast },
        ],
        BACKSPACE: [
          { cond: canLeaveInput, target: "navigating:tag", assign: highlightLast },
        ],
        DELETE: [
          {
            cond: hasHighlighted,
            assign: [deleteHighlighted, highlightAtIndex],
          },
        ],
        PASTE: [
          {
            cond: addOnPaste,
            assign: [setInputValue, addTagFromPaste],
          },
          { assign: setInputValue },
        ],
      },
    },
    "navigating:tag": {
      on: {
        ARROW_RIGHT: [
          { cond: (ctx, event) => { return ctx.value.length > 0 && caretAtStart(event) && ctx.highlightedIndex !== ctx.value.length - 1; }, assign: (ctx) => {
      const at = ctx.highlightedIndex;
      if (at === null) return {};
      return withSelectLog(ctx, at + 1 < ctx.value.length ? at + 1 : null);
    } },
          { target: "focused:input", assign: clearHighlight },
        ],
        ARROW_LEFT: [
          { cond: caretNotAtStart, target: "focused:input", assign: clearHighlight },
          { assign: highlightPrev },
        ],
        BLUR: { target: "idle", assign: clearHighlight },
        ENTER: [
          { cond: (ctx) => { return ctx.editable && ctx.highlightedIndex !== null; }, target: "editing:tag", assign: beginEdit },
        ],
        ARROW_DOWN: { target: "focused:input", assign: clearHighlight },
        ESCAPE: { target: "focused:input", assign: clearHighlight },
        TYPE: { target: "focused:input", assign: [setInputValue, clearHighlight] },
        BACKSPACE: [
          { cond: caretNotAtStart, target: "focused:input", assign: clearHighlight },
          {
            cond: (ctx) => { return ctx.highlightedIndex === 0; },
            assign: [deleteHighlighted, (ctx) => { return withSelectLog(ctx, ctx.value.length > 0 ? 0 : null); }],
          },
          {
            cond: hasHighlighted,
            assign: [deleteHighlighted, highlightPrev],
          },
          { assign: highlightLast },
        ],
        DELETE: [
          { cond: caretNotAtStart, target: "focused:input", assign: clearHighlight },
          {
            target: "focused:input",
            assign: [deleteHighlighted, highlightAtIndex],
          },
        ],
        PASTE: [
          {
            cond: addOnPaste,
            target: "focused:input",
            assign: [setInputValue, clearHighlight, addTagFromPaste],
          },
          {
            target: "focused:input",
            assign: [setInputValue, clearHighlight],
          },
        ],
      },
    },
    "editing:tag": {
      on: {
        TAG_INPUT_TYPE: { assign: (_ctx, e) => { return e.type === "TAG_INPUT_TYPE" ? { editedValue: e.value } : {}; } },
        TAG_INPUT_ESCAPE: {
          target: "navigating:tag",
          assign: [() => { return ({ editedValue: "" }); }, finishEdit],
        },
        TAG_INPUT_BLUR: [
          { cond: (_ctx, event) => { return event.type === "TAG_INPUT_BLUR" && event.relatedToInput === true; }, target: "navigating:tag", assign: clearEditAll },
          { target: "idle", assign: clearEditAll },
        ],
        TAG_INPUT_ENTER: [
          {
            cond: (ctx) => { return ctx.sanitizeValue(ctx.editedValue).length === 0; },
            target: "navigating:tag",
            assign: [deleteHighlighted, finishEdit],
          },
          {
            target: "navigating:tag",
            assign: [(ctx) => {
      const index = ctx.editedIndex;
      if (index === null) return {};
      const editedValue = ctx.editedValue;
      const hasDuplicate = ctx.value.some((item, i) => i !== index && item === editedValue);
      if (!ctx.allowDuplicates && hasDuplicate) return {};
      if (ctx.value[index] === editedValue) return {};
      const value = [...ctx.value];
      value[index] = editedValue;
      return { value, log: { type: "update", value: editedValue }, logPrev: ctx.log };
    }, finishEdit],
          },
        ],
      },
    },
  },
};

const implementations = {};

export function tags(
  args: TagsArgs = {},
  authored: (name: string) => boolean,
): Machine<TagsContext, TagsEvents> {
  return createMachine<TagsContext, TagsEvents>({
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
  });
}
