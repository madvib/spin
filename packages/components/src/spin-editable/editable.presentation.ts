import { ariaControls, ariaDisabled, ariaInvalid, ariaReadOnly, defineComponent, type ApiOf, type ComponentDef, type ScopeFor, type SlotScopeFor } from "@spin/runtime";
import { editable as editableMachine } from "./editable.machine.ts";
import type { EditableArgs, EditableContext } from "./editable.state.ts";
import type { EditableEvents } from "./editable.events.ts";
import type { EditableState } from "./editable.state.ts";
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


const TRANSLATIONS = {
  input: "editable input",
  edit: "edit",
  submit: "submit",
  cancel: "cancel",
} as const;


type ScopeLike = ScopeFor<EditableContext, EditableEvents, EditableState>;
const interactive = (scope: ScopeLike): boolean =>
  !(scope.context.disabled === true || scope.context.readOnly === true);

const editingOf = (scope: ScopeLike): boolean => scope.state === "edit";

/** Host callbacks arrive untyped on props: narrow once, call if callable. */
type OutsideHandler = (event: InteractOutsideEvent) => void;
const isOutsideHandler = (value: unknown): value is OutsideHandler => typeof value === "function";
const callHandler = (scope: ScopeLike, name: string, event: InteractOutsideEvent): void => {
  const fn: unknown = (scope.context as unknown as Record<string, unknown>)[name];
  if (isOutsideHandler(fn)) fn(event);
};


export const def = {
  name: "editable",
  machine: (args: EditableArgs, authored: (name: string) => boolean) => editableMachine(args, authored),
  start: (props: Record<string, unknown>) => (props["editing"] === true || props["defaultEdit"] === true ? "edit" : "preview"),
  reconcile: ({ context, state, parsed, authored, send }: {
    readonly context: EditableContext;
    readonly state: EditableState;
    readonly parsed: Record<string, unknown>;
    readonly authored: (name: string) => boolean;
    readonly send: (event: { type: string } & Record<string, unknown>) => void;
  }) => {
    // The controlled channel: the host owns the editing state, so the
    // machine asks and waits for the host's own write. That write drives
    // the STATE, not a context field, and its close carries the last
    // gesture — so the contract cannot carry it, and it stays here.
    if (context.editControlled !== authored("editing")) {
      context.editControlled = authored("editing");
    }
    if (!authored("editing")) return false;
    if (parsed["editing"] === true && state !== "edit") {
      send({ type: "CONTROLLED.EDIT" });
    }
    if (parsed["editing"] !== true && state === "edit") {
      send({ type: "CONTROLLED.PREVIEW", previousEvent: context.lastEvent });
    }
    return false;
  },
  settled: ({ event, before, after, focus }: {
    readonly event: { readonly type: string } & Record<string, unknown>;
    readonly before: { readonly context: EditableContext; readonly state: EditableState };
    readonly after: { readonly context: EditableContext; readonly state: EditableState };
    readonly focus: (part: string, slot?: unknown) => void;
  }) => {
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
      attrs: (scope: ScopeLike) => ({ id: scope.id(""), dir: scope.context.dir }),
    },
    area: {
      attrs: (scope: ScopeLike) => {
        const focused = editingOf(scope);
        const placeholderShown = scope.context.value.trim() === "";
        return {
          id: scope.id("area"),
          dir: scope.context.dir,
          "data-state": focused ? "edit" : "preview",
          "data-focus": scope.attr(focused),
          "data-placeholder-shown": scope.attr(placeholderShown),
          // Zag renders the auto-resize stack with an inline style; ours keys
          // a static utility on the same fact.
          "data-autoresize": scope.attr(scope.context.autoResize === true),
          "data-disabled": scope.attr(scope.context.disabled),
        };
      },
    },
    label: {
      attrs: (scope: ScopeLike) => {
        const focused = editingOf(scope);
        return {
          id: scope.id("label"),
          dir: scope.context.dir,
          for: scope.id("input"),
          "data-state": focused ? "edit" : "preview",
          "data-focus": scope.attr(focused),
          "data-disabled": scope.attr(scope.context.disabled),
          "data-invalid": scope.attr(scope.context.invalid === true),
          "data-required": scope.attr(scope.context.required),
          onClick: (): void => {
            if (editingOf(scope)) return;
            // Focus management recorded as a gap: label-click focus on the
            // preview is not reimplemented in the banked shape.
          },
        };
      },
    },
    input: {
      attrs: (scope: ScopeLike) => {
        const ctx = scope.context;
        const focused = editingOf(scope);
        // Outside the auto-resize stack the inactive part leaves the layout
        // entirely; inside it both parts share one cell so the box never
        // changes size, and the inactive one is only invisible.
        const removed = !focused && scope.context.autoResize !== true;
        const placeholderShown = ctx.value.trim() === "";
        const raw = scope.context.placeholder;
        const placeholder = typeof raw === "string" ? raw : raw.edit ?? "";
        return {
          id: scope.id("input"),
          dir: scope.context.dir,
          type: "text",
          name: scope.context.name,
          form: scope.context.form,
          // The bag carries the machine's value, so the platform's own value
          // setter keeps the field in step — including the caret, which a
          // same-value assignment leaves alone.
          value: ctx.value,
          placeholder: placeholder.length > 0 ? placeholder : undefined,
          maxLength: typeof scope.context.maxLength === "number" ? scope.context.maxLength : undefined,
          required: scope.context.required,
          disabled: scope.context.disabled,
          readOnly: scope.context.readOnly,
          "aria-label": TRANSLATIONS.input,
          ...ariaInvalid(scope.context.invalid === true ? true : undefined),
          "data-state": focused ? "edit" : "preview",
          "data-placeholder-shown": scope.attr(placeholderShown),
          "data-hidden": scope.attr(removed),
          "data-disabled": scope.attr(scope.context.disabled),
          "data-autoresize": scope.attr(scope.context.autoResize === true),
          "data-invalid": scope.attr(scope.context.invalid === true),
          "data-readonly": scope.attr(scope.context.readOnly),
          ...ariaControls(scope, { part: "control" }),
          // A size of 1 is what makes the field content-sized in the
          // auto-resize stack.
          size: scope.context.autoResize === true ? 1 : undefined,
          onInput: (event: { readonly currentTarget: { readonly value: string } }): void =>
            scope.send({ type: "VALUE.SET", value: event.currentTarget.value }),
          // Focus selects the whole value: the next keystroke replaces it,
          // which is what the field is for.
          onFocus: (event: FocusEvent): void => {
            if (scope.context.selectOnFocus === false) return;
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
                const mode = typeof scope.context.submitMode === "string" ? scope.context.submitMode : "both";
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
              // The id carries a colon, so it is not a CSS selector: the
              // node is found by the framework's id path.
              scope.root().querySelector(`[id="${scope.id("cancelTrigger")}"]`),
              scope.root().querySelector(`[id="${scope.id("editTrigger")}"]`),
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
      attrs: (scope: ScopeLike) => {
        const ctx = scope.context;
        const focused = editingOf(scope);
        const live = interactive(scope);
        const placeholderShown = ctx.value.trim() === "";
        const removed = focused && scope.context.autoResize !== true;
        return {
          id: scope.id("preview"),
          dir: scope.context.dir,
          "data-state": focused ? "edit" : "preview",
          "data-placeholder-shown": scope.attr(placeholderShown),
          "data-hidden": scope.attr(removed),
          "data-disabled": scope.attr(scope.context.disabled),
          "data-autoresize": scope.attr(scope.context.autoResize === true),
          "data-invalid": scope.attr(scope.context.invalid === true),
          "data-readonly": scope.attr(scope.context.readOnly),
          ...ariaReadOnly(scope.context.readOnly === true ? true : undefined),
          ...ariaDisabled(scope.context.disabled === true ? true : undefined),
          ...ariaInvalid(scope.context.invalid === true ? true : undefined),
          "aria-label": TRANSLATIONS.edit,
          ...ariaControls(scope, { part: "control" }),
          tabIndex: live ? 0 : undefined,
          onClick: (): void => {
            if (!live) return;
            if ((typeof scope.context.activationMode === "string" ? scope.context.activationMode : "focus") !== "click") return;
            scope.send({ type: "EDIT", src: "preview.click" });
          },
          onFocus: (): void => {
            if (!live) return;
            if ((typeof scope.context.activationMode === "string" ? scope.context.activationMode : "focus") !== "focus") return;
            scope.send({ type: "EDIT", src: "preview.focus" });
          },
          onDoubleClick: (event: MouseEvent): void => {
            if (event.defaultPrevented) return;
            if (!live) return;
            if ((typeof scope.context.activationMode === "string" ? scope.context.activationMode : "focus") !== "dblclick") return;
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
      attrs: (scope: ScopeLike) => {
        const focused = editingOf(scope);
        return {
          id: scope.id("editTrigger"),
          dir: scope.context.dir,
          type: "button",
          "data-state": focused ? "edit" : "preview",
          "data-disabled": scope.attr(scope.context.disabled),
          "aria-label": TRANSLATIONS.edit,
          ...ariaControls(scope, { part: "control" }),
          disabled: scope.context.disabled,
          onClick: (event: MouseEvent): void => {
            if (event.defaultPrevented) return;
            if (!interactive(scope)) return;
            scope.send({ type: "EDIT", src: "edit.click" });
          },
        };
      },
    },
    control: {
      attrs: (scope: ScopeLike) => ({ id: scope.id("control"), dir: scope.context.dir }),
    },
    submitTrigger: {
      id: "submit",
      attrs: (scope: ScopeLike) => {
        const focused = editingOf(scope);
        return {
          id: scope.id("submitTrigger"),
          dir: scope.context.dir,
          type: "button",
          "data-state": focused ? "edit" : "preview",
          "data-disabled": scope.attr(scope.context.disabled),
          "aria-label": TRANSLATIONS.submit,
          ...ariaControls(scope, { part: "control" }),
          disabled: scope.context.disabled,
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
      attrs: (scope: ScopeLike) => {
        const focused = editingOf(scope);
        return {
          id: scope.id("cancelTrigger"),
          dir: scope.context.dir,
          type: "button",
          "data-state": focused ? "edit" : "preview",
          "data-disabled": scope.attr(scope.context.disabled),
          "aria-label": TRANSLATIONS.cancel,
          ...ariaControls(scope, { part: "control" }),
          disabled: scope.context.disabled,
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
    setValue: { event: ([value]: [value: string]) => ({ type: "VALUE.SET" as const, value }) },
    clearValue: { event: () => ({ type: "VALUE.SET" as const, value: "" }) },
    edit: { event: () => ({ type: "EDIT" as const }) },
    cancel: { event: () => ({ type: "CANCEL" as const }) },
    submit: { event: () => ({ type: "SUBMIT" as const }) },
  },
  readers: {
    editing: { read: (_context: EditableContext, state: EditableState) => state === "edit" },
    empty: { read: (context: EditableContext) => context.value.trim() === "" },
    value: { read: (context: EditableContext) => context.value },
    valueText: {
      read: (context: EditableContext) => {
        const value = context.value;
        if (value.trim() !== "") return value;
        const placeholder = context.placeholder;
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
      // controlled field waits for the host). A controlled close reports
      // nothing: the host wrote the prop, so it already knows.
      select: (event: { readonly type: string } & Record<string, unknown>, _before: EditableContext, _after: EditableContext) => {
        if (event.type === "EDIT") return { edit: true };
        if (event.type === "SUBMIT" || event.type === "CANCEL") return { edit: false };
        return null;
      },
    },
    "value-commit": {
      prop: "onValueCommit",
      watch: () => [],
      detail: (watched: readonly [string]) => ({ value: watched[0] }),
      select: (event: { readonly type: string } & Record<string, unknown>, _before: EditableContext, after: EditableContext, states?: { readonly was: string; readonly is: string }) => {
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
      select: (event: { readonly type: string } & Record<string, unknown>, _before: EditableContext, after: EditableContext, states?: { readonly was: string; readonly is: string }) => {
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
  const mode = typeof scope.context.submitMode === "string" ? scope.context.submitMode : "both";
  const focusable = typeof event === "object" && event !== null && "detail" in event && typeof event.detail === "object" && event.detail !== null && "focusable" in event.detail ? event.detail.focusable === true : undefined;
  if (mode === "both" || mode === "blur") {
    scope.send(focusable === undefined
      ? { type: "SUBMIT", src: "interact-outside" }
      : { type: "SUBMIT", src: "interact-outside", focusable });
  } else {
    scope.send(focusable === undefined
      ? { type: "CANCEL", src: "interact-outside" }
      : { type: "CANCEL", src: "interact-outside", focusable });
  }
};

export type EditableApi = ApiOf<typeof def>;
export const editable = defineComponent<EditableContext, EditableEvents, EditableApi, EditableArgs, EditableState>(def);