import { defineComponent, type ComponentDef, type PartScope, type SlotScope } from "@spin/runtime";
import {
  config,
  implementations,
  initial,
  type EditableContext,
  type EditableEvent,
  type EditableInitial,
} from "./editable.machine.ts";
import type { InteractOutsideEvent } from "./actions/interact-outside.action.ts";

/**
 * Editable definition: the DOM contract as data. The machine owns the two
 * modes, the value, and the previous value; this file maps parts to
 * attribute bags, commands to sends, and value/edit
 * transitions to their events. Entering edit focuses the input (selecting
 * when asked); leaving it blurs and restores focus unless the outside
 * interaction already moved it.
 */

export interface EditableEditChange {
  readonly edit: boolean;
}

export interface EditableValueChange {
  readonly value: string;
}

export interface EditableApi {
  setValue(value: string): void;
  clearValue(): void;
  edit(): void;
  cancel(): void;
  submit(): void;
  readonly editing: boolean;
  readonly empty: boolean;
  readonly value: string;
  readonly valueText: string;
  getRootProps(): Record<string, unknown>;
  getAreaProps(): Record<string, unknown>;
  getLabelProps(): Record<string, unknown>;
  getInputProps(): Record<string, unknown>;
  getPreviewProps(): Record<string, unknown>;
  getEditTriggerProps(): Record<string, unknown>;
  getControlProps(): Record<string, unknown>;
  getSubmitTriggerProps(): Record<string, unknown>;
  getCancelTriggerProps(): Record<string, unknown>;
}

const TRANSLATIONS = {
  input: "editable input",
  edit: "edit",
  submit: "submit",
  cancel: "cancel",
} as const;


type Ctx = EditableContext;

interface ScopeLike extends PartScope<unknown, EditableContext> {}
interface SlotLike<R> extends SlotScope<R, EditableContext> {}

const interactive = (scope: ScopeLike): boolean =>
  !(scope.props["disabled"] === true || scope.props["readOnly"] === true);

const editingOf = (scope: ScopeLike): boolean => scope.state === "edit";

// Ids carry `:`, which a CSS selector would need escaped, so elements are
// read by attribute. Many call sites, one lockstep shape.
// byId removed in banked shape: focus uses the runtime focuser.

/** Transport guarantees the raw prop bag is an EditableInitial-shaped object. */
const isEditableInitial = (raw: unknown): raw is EditableInitial =>
  raw !== null && typeof raw === "object";

/** Host callbacks arrive untyped on props: narrow once, call if callable. */
type OutsideHandler = (event: InteractOutsideEvent) => void;
const isOutsideHandler = (value: unknown): value is OutsideHandler => typeof value === "function";
const callHandler = (scope: ScopeLike, name: string, event: InteractOutsideEvent): void => {
  const fn: unknown = scope.props[name];
  if (isOutsideHandler(fn)) fn(event);
};

const def: ComponentDef<EditableContext, EditableEvent> = {
  name: "editable",
  config,
  implementations,
  // The start state follows the authored/default edit flags.
  start: (props) => (props["editing"] === true || props["defaultEdit"] === true ? "edit" : "preview"),
  seed: (raw, authored) => ({ ...initial(isEditableInitial(raw) ? raw : {}), editControlled: authored("editing") }),
  scalarsOf: (parsed, authored) => ({
    maxLength: (typeof parsed["maxLength"] === "number" && parsed["maxLength"] > 0 ? Math.trunc(parsed["maxLength"]) : null),
    editControlled: authored("editing"),
  }),
  reconcile: ({ context, state, parsed, authored, send }) => {
    const ctx = context;
    // `value` is the CONTROLLED channel: it alternates only when the host
    // authored it. An unauthored `value` is the empty default, and
    // alternating it would wipe the `defaultValue` seed.
    if (authored("value")) {
      const nextValue = parsed["value"];
      if (typeof nextValue === "string" && nextValue !== ctx.value) {
        send({ type: "VALUE.SET", value: nextValue });
      }
    }
    if (authored("editing") && parsed["editing"] === true && state !== "edit") {
      send({ type: "CONTROLLED.EDIT" });
    }
    if (authored("editing") && parsed["editing"] !== true && state === "edit") {
      send({ type: "CONTROLLED.PREVIEW", previousEvent: ctx.lastEvent });
    }
    return false;
  },
  settled: ({ event, before, after, focus }) => {
    const wasEditing = before.state === "edit";
    const editing = after.state === "edit";
    if (!wasEditing && editing) {
      // Focus follows the settled focuser; text selection on focus is a
      // recorded gap (runtime focuser focuses only).
      focus("input");
      return;
    }
    if (wasEditing && !editing) {
      const focusable = (typeof event["focusable"] === "boolean" ? event["focusable"] : false) === true &&
        (event.type === "SUBMIT" || event.type === "CANCEL");
      if (focusable) return;
      focus("editTrigger");
    }
  },
  parts: {
    root: {
      id: "",
      sig: (scope) => [scope.props["dir"]].join(""),
      attrs: (scope) => ({ id: scope.id(""), dir: scope.props["dir"] }),
    },
    area: {
      sig: (scope) => {
        const ctx = scope.context;
        return [scope.props["dir"], editingOf(scope), scope.props["disabled"], scope.props["autoResize"], ctx.value.trim() === ""].join("");
      },
      attrs: (scope) => {
        const focused = editingOf(scope);
        const placeholderShown = scope.context.value.trim() === "";
        return {
          id: scope.id("area"),
            "data-scope": "editable",
            "data-part": "area",
          dir: scope.props["dir"],
          "data-state": focused ? "edit" : "preview",
          "data-focus": scope.attr(focused),
          "data-disabled": scope.attr(scope.props["disabled"] === true),
          "data-placeholder-shown": scope.attr(placeholderShown),
          // Zag renders the auto-resize stack with an inline style; ours keys
          // a static utility on the same fact.
          "data-autoresize": scope.attr(scope.props["autoResize"] === true),
        };
      },
    },
    label: {
      sig: (scope) => [scope.props["dir"], editingOf(scope), scope.props["invalid"], scope.props["required"], scope.props["disabled"]].join(""),
      attrs: (scope) => {
        const focused = editingOf(scope);
        return {
          id: scope.id("label"),
            "data-scope": "editable",
            "data-part": "label",
          dir: scope.props["dir"],
          for: scope.id("input"),
          "data-state": focused ? "edit" : "preview",
          "data-focus": scope.attr(focused),
          "data-invalid": scope.attr(scope.props["invalid"] === true),
          "data-required": scope.attr(scope.props["required"] === true),
          "data-disabled": scope.attr(scope.props["disabled"] === true),
          onClick: (): void => {
            if (editingOf(scope)) return;
            // Focus management recorded as a gap: label-click focus on the
            // preview is not reimplemented in the banked shape.
          },
        };
      },
    },
    input: {
      sig: (scope) => {
        const ctx = scope.context;
        return [scope.props["dir"], scope.props["name"], scope.props["form"], scope.props["maxLength"], typeof scope.props["placeholder"] === "string" ? scope.props["placeholder"] : "", scope.props["disabled"], scope.props["readOnly"], scope.props["required"], scope.props["invalid"], scope.props["autoResize"], editingOf(scope), ctx.value].join("");
      },
      attrs: (scope) => {
        const ctx = scope.context;
        const focused = editingOf(scope);
        // Outside the auto-resize stack the inactive part leaves the layout
        // entirely; inside it both parts share one cell so the box never
        // changes size, and the inactive one is only invisible.
        const removed = !focused && scope.props["autoResize"] !== true;
        const placeholderShown = ctx.value.trim() === "";
        const placeholder = typeof scope.props["placeholder"] === "string" ? scope.props["placeholder"] : "";
        return {
          id: scope.id("input"),
            "data-scope": "editable",
            "data-part": "input",
          dir: scope.props["dir"],
          type: "text",
          name: scope.props["name"],
          form: scope.props["form"],
          // The bag carries the machine's value, so the platform's own value
          // setter keeps the field in step — including the caret, which a
          // same-value assignment leaves alone.
          value: ctx.value,
          placeholder: placeholder.length > 0 ? placeholder : undefined,
          maxLength: typeof scope.props["maxLength"] === "number" ? scope.props["maxLength"] : undefined,
          required: scope.props["required"],
          disabled: scope.props["disabled"],
          readOnly: scope.props["readOnly"],
          "aria-label": TRANSLATIONS.input,
          "aria-invalid": scope.props["invalid"] === true ? true : undefined,
          "data-state": focused ? "edit" : "preview",
          "data-disabled": scope.attr(scope.props["disabled"] === true),
          "data-readonly": scope.attr(scope.props["readOnly"] === true),
          "data-invalid": scope.attr(scope.props["invalid"] === true),
          "data-autoresize": scope.attr(scope.props["autoResize"] === true),
          "data-placeholder-shown": scope.attr(placeholderShown),
          "data-hidden": scope.attr(removed),
          "aria-controls": scope.id("control"),
          // A size of 1 is what makes the field content-sized in the
          // auto-resize stack.
          size: scope.props["autoResize"] === true ? 1 : undefined,
          onInput: (event: { readonly currentTarget: { readonly value: string } }): void =>
            scope.send({ type: "VALUE.SET", value: event.currentTarget.value }),
          // Focus selects the whole value: the next keystroke replaces it,
          // which is what the field is for.
          onFocus: (event: FocusEvent): void => {
            if (scope.props["selectOnFocus"] === false) return;
            const target = event.currentTarget;
            if (!(target instanceof HTMLInputElement)) return;
            target.select();
          },
          onKeydown: (event: KeyboardEvent): void => {
            if (event.defaultPrevented) return;
            if (event.isComposing === true) return;
            switch (event.key) {
              case "Escape": {
                if (!interactive(scope)) return;
                event.preventDefault();
                scope.send({ type: "CANCEL", src: "input.escape" });
                return;
              }
              case "Enter": {
                const mode = typeof scope.props["submitMode"] === "string" ? scope.props["submitMode"] : "both";
                if (mode !== "both" && mode !== "enter") return;
                // The part is an input, so Enter submits unless a modifier turns the
                // press into something else — Zag's textarea branch has nothing to
                // branch on here.
                if (event.shiftKey || event.metaKey) return;
                if (!interactive(scope)) return;
                event.preventDefault();
                scope.send({ type: "SUBMIT", src: "input.enter" });
                return;
              }
              default:
            }
          },
          "use:interact-outside": {
            // The field's own controls are inside: a press on the cancel
            // trigger is the cancel, not a walk-away that submits.
            exclude: (): readonly (Element | null)[] => [
              document.getElementById(scope.id("cancelTrigger")),
              document.getElementById(scope.id("editTrigger")),
            ],
            onPointerDownOutside: (event: InteractOutsideEvent): void => {
              callHandler(scope, "onPointerDownOutside", event);
              callHandler(scope, "onInteractOutside", event);
              reportOutside(scope, event);
            },
            onFocusOutside: (event: InteractOutsideEvent): void => {
              callHandler(scope, "onFocusOutside", event);
              callHandler(scope, "onInteractOutside", event);
              reportOutside(scope, event);
            },
          },
        };
      },
    },
    preview: {
      sig: (scope) => {
        const ctx = scope.context;
        const text = ctx.value.trim() === "" ? typeof scope.props["placeholder"] === "string" ? scope.props["placeholder"] : "" : ctx.value;
        return [scope.props["dir"], text, scope.props["disabled"], scope.props["readOnly"], scope.props["invalid"], scope.props["autoResize"], editingOf(scope), interactive(scope), scope.props["activationMode"]].join("");
      },
      attrs: (scope) => {
        const ctx = scope.context;
        const focused = editingOf(scope);
        const live = interactive(scope);
        const placeholderShown = ctx.value.trim() === "";
        const removed = focused && scope.props["autoResize"] !== true;
        return {
          id: scope.id("preview"),
            "data-scope": "editable",
            "data-part": "preview",
          dir: scope.props["dir"],
          "data-state": focused ? "edit" : "preview",
          "data-placeholder-shown": scope.attr(placeholderShown),
          "data-readonly": scope.attr(scope.props["readOnly"] === true),
          "data-disabled": scope.attr(scope.props["disabled"] === true),
          "data-invalid": scope.attr(scope.props["invalid"] === true),
          "data-autoresize": scope.attr(scope.props["autoResize"] === true),
          "data-hidden": scope.attr(removed),
          "aria-readonly": scope.props["readOnly"] === true ? true : undefined,
          "aria-disabled": scope.props["disabled"] === true ? true : undefined,
          "aria-invalid": scope.props["invalid"] === true ? true : undefined,
          "aria-label": TRANSLATIONS.edit,
          "aria-controls": scope.id("control"),
          tabIndex: live ? 0 : undefined,
          onClick: (): void => {
            if (!live) return;
            if ((typeof scope.props["activationMode"] === "string" ? scope.props["activationMode"] : "focus") !== "click") return;
            scope.send({ type: "EDIT", src: "preview.click" });
          },
          onFocus: (): void => {
            if (!live) return;
            if ((typeof scope.props["activationMode"] === "string" ? scope.props["activationMode"] : "focus") !== "focus") return;
            scope.send({ type: "EDIT", src: "preview.focus" });
          },
          onDoubleClick: (event: MouseEvent): void => {
            if (event.defaultPrevented) return;
            if (!live) return;
            if ((typeof scope.props["activationMode"] === "string" ? scope.props["activationMode"] : "focus") !== "dblclick") return;
            scope.send({ type: "EDIT", src: "preview.dblclick" });
          },
          onKeydown: (event: KeyboardEvent): void => {
            if (event.defaultPrevented) return;
            if (event.key !== "Enter" && event.key !== " ") return;
            if (!interactive(scope)) return;
            event.preventDefault();
            scope.send({ type: "EDIT", src: "preview.keydown" });
          },
        };
      },
    },
    editTrigger: {
      id: "edit",
      sig: (scope) => [scope.props["dir"], editingOf(scope), scope.props["disabled"]].join(""),
      attrs: (scope) => {
        const focused = editingOf(scope);
        return {
          id: scope.id("editTrigger"),
            "data-scope": "editable",
            "data-part": "edit-trigger",
          dir: scope.props["dir"],
          type: "button",
          "data-state": focused ? "edit" : "preview",
          "data-disabled": scope.attr(scope.props["disabled"] === true),
          "aria-label": TRANSLATIONS.edit,
          "aria-controls": scope.id("control"),
          disabled: scope.props["disabled"],
          onClick: (event: MouseEvent): void => {
            if (event.defaultPrevented) return;
            if (!interactive(scope)) return;
            scope.send({ type: "EDIT", src: "edit.click" });
          },
        };
      },
    },
    control: {
      sig: (scope) => [scope.props["dir"]].join(""),
      attrs: (scope) => ({ id: scope.id("control"), dir: scope.props["dir"] }),
    },
    submitTrigger: {
      id: "submit",
      sig: (scope) => [scope.props["dir"], editingOf(scope), scope.props["disabled"]].join(""),
      attrs: (scope) => {
        const focused = editingOf(scope);
        return {
          id: scope.id("submitTrigger"),
            "data-scope": "editable",
            "data-part": "submit-trigger",
          dir: scope.props["dir"],
          type: "button",
          "data-state": focused ? "edit" : "preview",
          "data-disabled": scope.attr(scope.props["disabled"] === true),
          "aria-label": TRANSLATIONS.submit,
          "aria-controls": scope.id("control"),
          disabled: scope.props["disabled"],
          onClick: (event: MouseEvent): void => {
            if (event.defaultPrevented) return;
            if (!interactive(scope)) return;
            scope.send({ type: "SUBMIT", src: "submit.click" });
          },
        };
      },
    },
    cancelTrigger: {
      id: "cancel",
      sig: (scope) => [scope.props["dir"], editingOf(scope), scope.props["disabled"]].join(""),
      attrs: (scope) => {
        const focused = editingOf(scope);
        return {
          id: scope.id("cancelTrigger"),
            "data-scope": "editable",
            "data-part": "cancel-trigger",
          dir: scope.props["dir"],
          type: "button",
          "data-state": focused ? "edit" : "preview",
          "data-disabled": scope.attr(scope.props["disabled"] === true),
          "aria-label": TRANSLATIONS.cancel,
          "aria-controls": scope.id("control"),
          disabled: scope.props["disabled"],
          onClick: (event: MouseEvent): void => {
            if (event.defaultPrevented) return;
            if (!interactive(scope)) return;
            scope.send({ type: "CANCEL", src: "cancel.click" });
          },
        };
      },
    },
  },
  commands: {
    setValue: { event: (args: readonly unknown[]) => { const v = args[0]; return { type: "VALUE.SET", value: typeof v === "string" ? v : "" }; } },
    clearValue: { event: () => ({ type: "VALUE.SET", value: "" }) },
    edit: { event: () => ({ type: "EDIT" }) },
    cancel: { event: () => ({ type: "CANCEL" }) },
    submit: { event: () => ({ type: "SUBMIT" }) },
  },
  readers: {
    editing: { read: (_context, state) => state === "edit" },
    empty: { read: (context) => context.value.trim() === "" },
    value: { read: (context: EditableContext) => context.value },
    valueText: {
      read: (context: EditableContext, _state, props) => {
        const value = context.value;
        if (value.trim() !== "") return value;
        const placeholder = props["placeholder"];
        if (typeof placeholder === "object" && placeholder !== null && "preview" in placeholder && typeof placeholder.preview === "string") {
          return placeholder.preview;
        }
        return typeof placeholder === "string" ? placeholder : "";
      },
    },
  },
  events: {
    "value-change": {
      prop: "onValueChange",
      watch: (context: EditableContext) => [context.value],
      detail: (watched: readonly [string]) => ({ value: watched[0] }),
    },
    "edit-change": {
      prop: "onEditChange",
      watch: () => [],
      detail: (watched: readonly [boolean]) => ({ edit: watched[0] }),
      // Every edit request reports, whether or not the machine moved (a
      // controlled field waits for the host); submits and cancels report
      // the close. A controlled close reports nothing: the host wrote the
      // prop, so it already knows.
      select: (event, _before, _after) => {
        if (event.type === "EDIT") return { edit: true };
        if (event.type === "SUBMIT" || event.type === "CANCEL") return { edit: false };
        return null;
      },
    },
    "value-commit": {
      prop: "onValueCommit",
      watch: () => [],
      detail: (watched: readonly [string]) => ({ value: watched[0] }),
      select: (event, _before, after, states) => {
        // Leaving edit after a submit commits; a controlled close carries
        // the last event to tell it from a cancel.
        if (states === undefined || states.was !== "edit" || states.is === "edit") return null;
        const committed = event.type === "SUBMIT" ||
          (event.type === "CONTROLLED.PREVIEW" &&
            typeof event["previousEvent"] === "string" && event["previousEvent"] === "SUBMIT");
        if (!committed) return null;
        return { value: after.value };
      },
    },
    "value-revert": {
      prop: "onValueRevert",
      watch: () => [],
      detail: (watched: readonly [string]) => ({ value: watched[0] }),
      select: (event, _before, after, states) => {
        if (states === undefined || states.was !== "edit" || states.is === "edit") return null;
        const committed = event.type === "SUBMIT" ||
          (event.type === "CONTROLLED.PREVIEW" &&
            typeof event["previousEvent"] === "string" && event["previousEvent"] === "SUBMIT");
        if (committed) return null;
        if (event.type !== "CONTROLLED.PREVIEW" && event.type !== "CANCEL") return null;
        return { value: after.previousValue };
      },
    },
  },
};

/** Zag's `trackInteractOutside` callback pair: report to the host, then let
 * the machine decide, unless the host vetoed. */
const reportOutside = (scope: ScopeLike, event: InteractOutsideEvent): void => {
  if (event.defaultPrevented) return;
  if (scope.state !== "edit") return;
  const mode = typeof scope.props["submitMode"] === "string" ? scope.props["submitMode"] : "both";
  scope.send({
    type: mode === "both" || mode === "blur" ? "SUBMIT" : "CANCEL",
    src: "interact-outside",
    focusable: typeof event === "object" && event !== null && "detail" in event && typeof event.detail === "object" && event.detail !== null && "focusable" in event.detail ? event.detail.focusable === true : undefined,
  });
};

export const editable = defineComponent<EditableContext, EditableEvent, EditableApi>(def);
