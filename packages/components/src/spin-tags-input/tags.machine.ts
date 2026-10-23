/**
 * Tags-input machine: four states, one flat config.
 */
import { createMachine, type Machine, type MachineSpec } from "@spin/runtime/fsm";
import type { TagsContext, TagsArgs, TagsLog, TagsState } from "./tags.state.ts";
import { initial, stringsOf, sameTags, withSelectLog, clampIndex, uniq } from "./tags.state.ts";
import type { TagsEvents } from "./tags.events.ts";
import {
  setInputValue,
  addTagFromPaste,
  addFromInput,
  deleteTag,
  deleteHighlighted,
  clearInputValue,
  clearHighlight,
  highlightPrev,
  highlightLast,
  highlightAtIndex,
  beginEdit,
  finishEdit,
  clearEditAll,
  hasHighlighted,
  canInsert,
  caretAtStart,
  insertOnBlur,
  clearOnBlur,
  addOnPaste,
  canLeaveInput,
  caretNotAtStart,
} from "./tags.transitions.ts";

export type {
  TagsValidateArgs,
  SanitizeValue,
  ValidateTag,
  TagsLog,
  TagsContext,
  TagsArgs,
} from "./tags.state.ts";

export type { TagsEvents, TagsEvent } from "./tags.events.ts";

export { stringsOf, sameTags, initial };

const config: MachineSpec<TagsContext, TagsEvents, TagsState> = {
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
    sanitizeValue: (value: string) => value.trim(),
    validate: () => true,
    initialValue: [],
    dir: "ltr" as const,
    disabled: false,
    readOnly: false,
    invalid: undefined as boolean | undefined,
    required: false,
    name: undefined as string | undefined,
    form: undefined as string | undefined,
    maxLength: null as number | null,
    placeholder: "",
    translations: undefined as unknown,
  },
  on: {
    DOUBLE_CLICK_TAG: [
      { cond: (ctx) => ctx.editable, target: "editing:tag", assign: beginEdit },
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
    SET_VALUE: { assign: (_ctx, e) => (e.type === "SET_VALUE" ? { value: [...e.value] } : {}) },
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
    CLEAR_VALUE: { assign: [(ctx) => ({
      value: [],
      log: { type: "clear" },
      logPrev: ctx.log,
    }), clearInputValue] },
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
          { cond: (ctx) => ctx.highlightedIndex === null, target: "focused:input", assign: clearHighlight },
        ],
      },
    },
    "focused:input": {
      on: {
        TYPE: { assign: setInputValue },
        BLUR: [
          { cond: insertOnBlur, target: "idle", assign: addFromInput },
          { cond: (ctx) => ctx.addOnBlur, target: "idle" },
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
          { cond: (ctx, event) => ctx.value.length > 0 && caretAtStart(event) && ctx.highlightedIndex !== ctx.value.length - 1, assign: (ctx) => {
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
          { cond: (ctx) => ctx.editable && ctx.highlightedIndex !== null, target: "editing:tag", assign: beginEdit },
        ],
        ARROW_DOWN: { target: "focused:input", assign: clearHighlight },
        ESCAPE: { target: "focused:input", assign: clearHighlight },
        TYPE: { target: "focused:input", assign: [setInputValue, clearHighlight] },
        BACKSPACE: [
          { cond: caretNotAtStart, target: "focused:input", assign: clearHighlight },
          {
            cond: (ctx) => ctx.highlightedIndex === 0,
            assign: [deleteHighlighted, (ctx) => withSelectLog(ctx, ctx.value.length > 0 ? 0 : null)],
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
        TAG_INPUT_TYPE: { assign: (_ctx, e) => (e.type === "TAG_INPUT_TYPE" ? { editedValue: e.value } : {}) },
        TAG_INPUT_ESCAPE: {
          target: "navigating:tag",
          assign: [() => ({ editedValue: "" }), finishEdit],
        },
        TAG_INPUT_BLUR: [
          { cond: (_ctx, event) => event.type === "TAG_INPUT_BLUR" && event.relatedToInput === true, target: "navigating:tag", assign: clearEditAll },
          { target: "idle", assign: clearEditAll },
        ],
        TAG_INPUT_ENTER: [
          {
            cond: (ctx) => ctx.sanitizeValue(ctx.editedValue).length === 0,
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

export function tags(
  args: TagsArgs = {},
  authored: (name: string) => boolean = () => false,
): Machine<TagsContext, TagsEvents, TagsState> {
  return createMachine<TagsContext, TagsEvents, TagsState>({
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
      dir: {},
      disabled: {},
      readOnly: {},
      invalid: {},
      required: {},
      name: {},
      form: {},
      maxLength: {},
      placeholder: {},
      translations: {},
    },
  });
}