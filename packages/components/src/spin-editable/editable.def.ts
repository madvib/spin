import {
  defineComponent,
  textProp,
  type ComponentDef,
} from "@spin/runtime";
import {
  config,
  implementations,
  type EditableContext,
  type EditableEvent,
} from "./editable.machine.ts";
import type { InteractOutsideEvent } from "./actions/interact-outside.action.ts";

/**
 * Editable definition: the DOM contract as data. The machine owns the two
 * modes, the value, and the previous value; this file maps props to
 * channels, parts to attribute bags, commands to sends, and value/edit
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

const ACTIVATION_MODES = ["focus", "click", "dblclick", "none"] as const;
const SUBMIT_MODES = ["enter", "blur", "both", "none"] as const;

const pickMode = <T extends string>(raw: unknown, modes: readonly T[], fallback: T): T =>
  typeof raw === "string" && (modes as readonly string[]).includes(raw) ? (raw as T) : fallback;

type Ctx = EditableContext;

const asCtx = (context: Record<string, unknown>): Ctx => context as unknown as Ctx;

type ScopeLike = {
  readonly props: Record<string, unknown>;
  readonly context: Record<string, unknown>;
  readonly state: string;
  readonly root: () => Element;
  readonly id: (part: string, slot?: unknown) => string;
  readonly send: (event: { type: string } & Record<string, unknown>) => void;
  readonly attr: (value: boolean) => string | undefined;
};

const interactive = (scope: ScopeLike): boolean =>
  !(scope.props["disabled"] === true || scope.props["readOnly"] === true);

const editingOf = (scope: ScopeLike): boolean => scope.state === "edit";

// Ids carry `:`, which a CSS selector would need escaped, so elements are
// read by attribute. Many call sites, one lockstep shape.
const byId = (id: string): HTMLElement | null => {
  if (typeof document === "undefined") return null;
  return document.querySelector(`[id="${id}"]`);
};

const def: ComponentDef<EditableContext, EditableEvent> = {
  name: "editable",
  config,
  implementations,
  // The start state is the machine's own initial unless the host authored
  // an open edit.
  start: (props, authored) => {
    const edit = authored("editing")
      ? props["editing"] === true
      : (props["defaultEdit"] as boolean) === true;
    return edit ? "edit" : "preview";
  },
  seed: (props, authored) => {
    const edit = authored("editing")
      ? props["editing"] === true
      : (props["defaultEdit"] as boolean) === true;
    void edit;
    const seeded = authored("value") && typeof props["value"] === "string"
      ? (props["value"] as string)
      : typeof props["defaultValue"] === "string"
        ? (props["defaultValue"] as string)
        : "";
    return {
      maxLength: null,
      editControlled: authored("editing"),
      value: seeded,
    };
  },
  channels: {
    value: {
      controlled: true,
      parse: textProp,
      event: (value: string) => ({ type: "VALUE.SET", value }),
    },
    defaultValue: { parse: textProp },
    editing: {
      controlled: true,
      parse: (raw) => raw === true,
      event: (value: boolean, _context, lastEvent) =>
        value ? { type: "CONTROLLED.EDIT" } : { type: "CONTROLLED.PREVIEW", previousEvent: lastEvent ?? "" },
    },
    defaultEdit: { parse: (raw) => raw === true },
    maxLength: {
      parse: (raw) => (typeof raw === "number" && raw > 0 ? Math.trunc(raw) : null),
    },
    activationMode: {
      parse: (raw) => pickMode(raw, ACTIVATION_MODES, "focus"),
    },
    submitMode: {
      parse: (raw) => pickMode(raw, SUBMIT_MODES, "both"),
    },
    autoResize: { parse: (raw) => raw === true },
    selectOnFocus: { parse: (raw) => raw !== false },
    disabled: { parse: (raw) => raw === true },
    readOnly: { parse: (raw) => raw === true },
    invalid: { parse: (raw) => raw === true },
    required: { parse: (raw) => raw === true },
    dir: { parse: (raw) => (typeof raw === "string" && raw.length > 0 ? raw : "ltr") },
    name: {
      parse: (raw) => (typeof raw === "string" && raw.length > 0 ? raw : undefined),
    },
    form: {
      parse: (raw) => (typeof raw === "string" && raw.length > 0 ? raw : undefined),
    },
    placeholder: { parse: textProp },
    finalFocus: { parse: textProp },
    onFocusOutside: { parse: (raw) => raw },
    onPointerDownOutside: { parse: (raw) => raw },
    onInteractOutside: { parse: (raw) => raw },
  },
  scalars: ["maxLength"],
  scalarsOf: (parsed, authored) => ({
    maxLength: parsed["maxLength"],
    editControlled: authored("editing"),
  }),
  settled: ({ event, before, after, props, id }) => {
    const wasEditing = (before as { readonly state: string }).state === "edit";
    const editing = (after as { readonly state: string }).state === "edit";
    const focusInput = (): void => {
      const el = typeof document === "undefined"
        ? null
        : document.querySelector<HTMLInputElement>(`[id="${id("input")}"]`);
      if (el === null || el === undefined) return;
      if (props["selectOnFocus"] !== false) el.select();
      else el.focus({ preventScroll: true });
    };
    if (!wasEditing && editing) {
      // The frame defers the focus until the input is in the DOM; a host
      // without one (a test document) focuses now.
      if (typeof requestAnimationFrame === "function") requestAnimationFrame(focusInput);
      else focusInput();
      return;
    }
    if (wasEditing && !editing) {
      if (typeof document !== "undefined") {
        document.querySelector<HTMLInputElement>(`[id="${id("input")}"]`)?.blur();
      }
      // An outside interaction that landed on something focusable has
      // already moved focus; taking it back would fight the user.
      const focusable = (event as Record<string, unknown>)["focusable"] === true &&
        (event.type === "SUBMIT" || event.type === "CANCEL");
      if (focusable) return;
      const restore = (): void => {
        const final = props["finalFocus"];
        const target =
          (typeof final === "string" && final.length > 0 ? byId(final) : null) ?? byId(id("editTrigger"));
        target?.focus({ preventScroll: true });
      };
      if (typeof requestAnimationFrame === "function") requestAnimationFrame(restore);
      else restore();
    }
  },
  parts: {
    root: {
      id: "",
      sig: (scope) => [scope.props["dir"]].join(""),
      attrs: (scope) => ({ id: scope.id("root"), dir: scope.props["dir"] }),
    },
    area: {
      sig: (scope) => {
        const ctx = asCtx(scope.context);
        return [scope.props["dir"], editingOf(scope), scope.props["disabled"], scope.props["autoResize"], ctx.value.trim() === ""].join("");
      },
      attrs: (scope) => {
        const focused = editingOf(scope);
        const placeholderShown = (asCtx(scope.context).value as string).trim() === "";
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
            byId(scope.id("preview"))?.focus({ preventScroll: true });
          },
        };
      },
    },
    input: {
      sig: (scope) => {
        const ctx = asCtx(scope.context);
        return [scope.props["dir"], scope.props["name"], scope.props["form"], scope.props["maxLength"], (scope.props["placeholder"] as string), scope.props["disabled"], scope.props["readOnly"], scope.props["required"], scope.props["invalid"], scope.props["autoResize"], editingOf(scope), ctx.value].join("");
      },
      attrs: (scope) => {
        const ctx = asCtx(scope.context);
        const focused = editingOf(scope);
        // Outside the auto-resize stack the inactive part leaves the layout
        // entirely; inside it both parts share one cell so the box never
        // changes size, and the inactive one is only invisible.
        const removed = !focused && scope.props["autoResize"] !== true;
        const placeholderShown = (ctx.value as string).trim() === "";
        const placeholder = scope.props["placeholder"] as string;
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
          maxLength: (scope.props["maxLength"] as number | null) ?? undefined,
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
                const mode = scope.props["submitMode"] as string;
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
            exclude: (): readonly (Element | null)[] => [byId(scope.id("submitTrigger")), byId(scope.id("cancelTrigger"))],
            onPointerDownOutside: (event: InteractOutsideEvent): void => {
              (scope.props["onPointerDownOutside"] as ((event: InteractOutsideEvent) => void) | undefined)?.(event);
              (scope.props["onInteractOutside"] as ((event: InteractOutsideEvent) => void) | undefined)?.(event);
              reportOutside(scope, event);
            },
            onFocusOutside: (event: InteractOutsideEvent): void => {
              (scope.props["onFocusOutside"] as ((event: InteractOutsideEvent) => void) | undefined)?.(event);
              (scope.props["onInteractOutside"] as ((event: InteractOutsideEvent) => void) | undefined)?.(event);
              reportOutside(scope, event);
            },
          },
        };
      },
    },
    preview: {
      sig: (scope) => {
        const ctx = asCtx(scope.context);
        const text = (ctx.value as string).trim() === "" ? (scope.props["placeholder"] as string) : (ctx.value as string);
        return [scope.props["dir"], text, scope.props["disabled"], scope.props["readOnly"], scope.props["invalid"], scope.props["autoResize"], editingOf(scope), interactive(scope), scope.props["activationMode"]].join("");
      },
      attrs: (scope) => {
        const ctx = asCtx(scope.context);
        const focused = editingOf(scope);
        const live = interactive(scope);
        const placeholderShown = (ctx.value as string).trim() === "";
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
            if (scope.props["activationMode"] !== "click") return;
            scope.send({ type: "EDIT", src: "preview.click" });
          },
          onFocus: (): void => {
            if (!live) return;
            if (scope.props["activationMode"] !== "focus") return;
            scope.send({ type: "EDIT", src: "preview.focus" });
          },
          onDoubleClick: (event: MouseEvent): void => {
            if (event.defaultPrevented) return;
            if (!live) return;
            if (scope.props["activationMode"] !== "dblclick") return;
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
    setValue: { event: (args) => ({ type: "VALUE.SET", value: args[0] as string }) },
    clearValue: { event: () => ({ type: "VALUE.SET", value: "" }) },
    edit: { event: () => ({ type: "EDIT" }) },
    cancel: { event: () => ({ type: "CANCEL" }) },
    submit: { event: () => ({ type: "SUBMIT" }) },
  },
  readers: {
    editing: { read: (_context, state) => state === "edit" },
    empty: { read: (context) => (asCtx(context).value as string).trim() === "" },
    value: { read: (context) => asCtx(context).value },
    valueText: {
      read: (context, _state, props) => {
        const value = asCtx(context).value as string;
        if (value.trim() !== "") return value;
        const placeholder = props["placeholder"];
        if (typeof placeholder === "object" && placeholder !== null) {
          return (placeholder as { readonly preview?: string }).preview ?? "";
        }
        return typeof placeholder === "string" ? placeholder : "";
      },
    },
  },
  events: {
    "value-change": {
      prop: "onValueChange",
      watch: (context) => [asCtx(context).value],
      detail: (watched) => ({ value: watched[0] as string }),
    },
    "edit-change": {
      prop: "onEditChange",
      watch: () => [],
      detail: (watched) => ({ edit: watched[0] as boolean }),
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
      detail: (watched) => ({ value: watched[0] as string }),
      select: (event, _before, after, states) => {
        // Leaving edit after a submit commits; a controlled close carries
        // the last event to tell it from a cancel.
        if (states === undefined || states.was !== "edit" || states.is === "edit") return null;
        const committed = event.type === "SUBMIT" ||
          (event.type === "CONTROLLED.PREVIEW" &&
            (event as unknown as { readonly previousEvent?: string }).previousEvent === "SUBMIT");
        if (!committed) return null;
        return { value: (after as unknown as Ctx).value };
      },
    },
    "value-revert": {
      prop: "onValueRevert",
      watch: () => [],
      detail: (watched) => ({ value: watched[0] as string }),
      select: (event, _before, after, states) => {
        if (states === undefined || states.was !== "edit" || states.is === "edit") return null;
        const committed = event.type === "SUBMIT" ||
          (event.type === "CONTROLLED.PREVIEW" &&
            (event as unknown as { readonly previousEvent?: string }).previousEvent === "SUBMIT");
        if (committed) return null;
        if (event.type !== "CONTROLLED.PREVIEW" && event.type !== "CANCEL") return null;
        return { value: (after as unknown as Ctx).previousValue };
      },
    },
  },
};

/** Zag's `trackInteractOutside` callback pair: report to the host, then let
 * the machine decide, unless the host vetoed. */
const reportOutside = (scope: ScopeLike, event: InteractOutsideEvent): void => {
  if (event.defaultPrevented) return;
  if (scope.state !== "edit") return;
  const mode = scope.props["submitMode"] as string;
  scope.send({
    type: mode === "both" || mode === "blur" ? "SUBMIT" : "CANCEL",
    src: "interact-outside",
    focusable: (event as unknown as { readonly detail?: { readonly focusable?: boolean } }).detail?.focusable,
  });
};

export const editable = defineComponent<EditableContext, EditableEvent, EditableApi>(def);
