/**
 * Editable connect: the DOM contract plus the reflexes the parts carry.
 *
 * What the machine owns stays there: the two states, the value, and the
 * value a cancel returns to. Everything else lives here — the preview's
 * activation modes, the input's key map, the focus reflexes Zag's machine
 * ran as actions, and the submit-on-blur report from `use:interact-outside`.
 *
 * The focus reflexes are the one seam with the bridge: the machine reports
 * that the state moved, and the view performs the focus. Zag does this
 * inside the machine (`focusInput`, `restoreFocus`, `blurInput`), which this
 * port cannot — the machine is pure — so the bridge fills `hooks` on the way
 * past and this connect assigns the two reflexes into it.
 */

import type { EditableContext } from "./editable.machine.ts";
import type { InteractOutsideEvent } from "./actions/interact-outside.action.ts";
import { machineTick } from "@spin/runtime";

const NAMESPACE = "editable";

/** Zag's default translations. The `translations` prop is an object, and the
 * scope grammar types no object props, so the labels are fixed here. */
const TRANSLATIONS = {
  input: "editable input",
  edit: "edit",
  submit: "submit",
  cancel: "cancel",
} as const;

export interface EditableConnectProps {
  readonly activationMode: "focus" | "click" | "dblclick" | "none";
  readonly submitMode: "enter" | "blur" | "both" | "none";
  readonly autoResize: boolean;
  readonly selectOnFocus: boolean;
  readonly disabled: boolean;
  readonly readOnly: boolean;
  readonly invalid: boolean;
  readonly required: boolean;
  readonly maxLength: number | null;
  readonly dir: string;
  readonly name: string | undefined;
  readonly form: string | undefined;
  readonly placeholder: { readonly edit: string | undefined; readonly preview: string | undefined };
  /** The id of the element focus returns to on close, when not the trigger. */
  readonly finalFocus: string | undefined;
  readonly onFocusOutside: ((event: InteractOutsideEvent) => void) | undefined;
  readonly onPointerDownOutside: ((event: InteractOutsideEvent) => void) | undefined;
  readonly onInteractOutside: ((event: InteractOutsideEvent) => void) | undefined;
}

/** The element's imperative surface — Zag's api methods. */
export interface EditableCommands {
  setValue(value: string): void;
  clearValue(): void;
  edit(): void;
  cancel(): void;
  submit(): void;
}

export interface EditableApi extends EditableCommands {
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

export interface EditableService {
  readonly context: EditableContext;
  readonly editing: boolean;
  send(event: { type: string } & Record<string, unknown>): void;
}

/** The reflexes the bridge asks for on a transition, filled by the connect. */
export interface EditableHooks {
  onEnterEdit?: () => void;
  onEnterPreview?: (focusable: boolean) => void;
}

export type ReadEditableProps = () => EditableConnectProps;

/** What the input's `input` event carries: the field's current value. */
interface InputChangeEvent {
  readonly currentTarget: { readonly value: string };
}

/** A bag cached until the signature of the fields it reads moves. */
interface BagMemo {
  sig: string;
  bag: Record<string, unknown>;
}

function cached(): (sig: string, build: () => Record<string, unknown>) => Record<string, unknown> {
  let sig = "";
  let bag: Record<string, unknown> | undefined;
  return (next: string, build: () => Record<string, unknown>): Record<string, unknown> => {
    if (bag !== undefined && sig === next) return bag;
    sig = next;
    bag = build();
    return bag;
  };
}

/** Zag's `dataAttr`: present when the condition holds, absent otherwise. */
function dataAttr(value: boolean): string | undefined {
  return value ? "" : undefined;
}

export function connectRobotEditable(
  service: EditableService,
  readProps: ReadEditableProps,
  id: string,
  hooks: EditableHooks,
): EditableApi {
  const ownerId = id.startsWith(`${NAMESPACE}:`) ? id : `${NAMESPACE}:${id}`;
  const rootId = ownerId;
  const areaId = `${ownerId}:area`;
  const labelId = `${ownerId}:label`;
  const previewId = `${ownerId}:preview`;
  const inputId = `${ownerId}:input`;
  const controlId = `${ownerId}:control`;
  const editTriggerId = `${ownerId}:edit`;
  const submitTriggerId = `${ownerId}:submit`;
  const cancelTriggerId = `${ownerId}:cancel`;

  const ctx = (): EditableContext => service.context;

  // Ids carry `:`, which a CSS selector would need escaped, so elements are
  // read by attribute. Many call sites, one lockstep shape.
  const byId = (partId: string): HTMLElement | null => document.querySelector(`[id="${partId}"]`);
  const inputSelector = `[id="${inputId}"]`;

  /** Read at every call: the connect outlives the move that changed any of
   * these, so a cached snapshot would arm a gesture with stale props. */
  const interactive = (): boolean => {
    const props = readProps();
    return !(props.disabled || props.readOnly);
  };

  // ---- the focus reflexes ------------------------------------------------

  hooks.onEnterEdit = (): void => {
    // The frame defers the focus until the input is in the DOM; a host
    // without one (a test document) focuses now.
    const focus = (): void => {
      const el = document.querySelector<HTMLInputElement>(inputSelector);
      if (el === null) return;
      if (readProps().selectOnFocus) el.select();
      else el.focus({ preventScroll: true });
    };
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(focus);
    else focus();
  };

  hooks.onEnterPreview = (focusable: boolean): void => {
    document.querySelector<HTMLInputElement>(inputSelector)?.blur();
    // An outside interaction that landed on something focusable has already
    // moved focus; taking it back would fight the user.
    if (focusable) return;
    const restore = (): void => {
      const final = readProps().finalFocus;
      const target =
        (final !== undefined && final.length > 0 ? byId(final) : null) ?? byId(editTriggerId);
      target?.focus({ preventScroll: true });
    };
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(restore);
    else restore();
  };

  // ---- submit on blur ----------------------------------------------------

  /** Zag's `trackInteractOutside` callback pair: report to the host, then let
   * the machine decide, unless the host vetoed. */
  const reportOutside = (event: InteractOutsideEvent): void => {
    if (event.defaultPrevented) return;
    if (!service.editing) return;
    const mode = readProps().submitMode;
    send({ type: mode === "both" || mode === "blur" ? "SUBMIT" : "CANCEL", src: "interact-outside", focusable: event.detail.focusable });
  };

  const outside = {
    exclude: (): readonly (Element | null)[] => [byId(submitTriggerId), byId(cancelTriggerId)],
    onPointerDownOutside: (event: InteractOutsideEvent): void => {
      readProps().onPointerDownOutside?.(event);
      readProps().onInteractOutside?.(event);
      reportOutside(event);
    },
    onFocusOutside: (event: InteractOutsideEvent): void => {
      readProps().onFocusOutside?.(event);
      readProps().onInteractOutside?.(event);
      reportOutside(event);
    },
  };

  // ---- the key maps ------------------------------------------------------

  const onPreviewKeydown = (event: KeyboardEvent): void => {
    if (event.defaultPrevented) return;
    if (event.key !== "Enter" && event.key !== " ") return;
    if (!interactive()) return;
    event.preventDefault();
    send({ type: "EDIT", src: "preview.keydown" });
  };

  const onInputKeydown = (event: KeyboardEvent): void => {
    if (event.defaultPrevented) return;
    if (event.isComposing === true) return;
    switch (event.key) {
      case "Escape": {
        if (!interactive()) return;
        event.preventDefault();
        send({ type: "CANCEL", src: "input.escape" });
        return;
      }
      case "Enter": {
        const mode = readProps().submitMode;
        if (mode !== "both" && mode !== "enter") return;
        // The part is an input, so Enter submits unless a modifier turns the
        // press into something else — Zag's textarea branch has nothing to
        // branch on here.
        if (event.shiftKey || event.metaKey) return;
        if (!interactive()) return;
        event.preventDefault();
        send({ type: "SUBMIT", src: "input.enter" });
        return;
      }
      default:
    }
  };

  const send = (event: { type: string } & Record<string, unknown>): void => {
    service.send(event);
  };

  // ---- cached bags --------------------------------------------------------

  const rootBag = cached();
  const areaBag = cached();
  const labelBag = cached();
  const previewBag = cached();
  const inputBag = cached();
  const controlBag = cached();
  const editTriggerBag = cached();
  const submitTriggerBag = cached();
  const cancelTriggerBag = cached();

  return {
    get editing(): boolean {
      return service.editing;
    },
    get empty(): boolean {
      return ctx().value.trim() === "";
    },
    get value(): string {
      // Template text bindings re-run only on signals they read: the tick
      // is the subscription that refreshes the preview after a move.
      machineTick();
      return ctx().value;
    },
    get valueText(): string {
      machineTick();
      const props = readProps();
      return ctx().value.trim() === "" ? props.placeholder.preview ?? "" : ctx().value;
    },
    setValue: (value: string): void => send({ type: "VALUE.SET", value, src: "setValue" }),
    clearValue: (): void => send({ type: "VALUE.SET", value: "", src: "clearValue" }),
    edit: (): void => {
      if (!interactive()) return;
      send({ type: "EDIT", src: "api.edit" });
    },
    cancel: (): void => {
      if (!interactive()) return;
      send({ type: "CANCEL", src: "api.cancel" });
    },
    submit: (): void => {
      if (!interactive()) return;
      send({ type: "SUBMIT", src: "api.submit" });
    },
    getRootProps: () => {
      const props = readProps();
      return rootBag(props.dir, () => ({ id: rootId, dir: props.dir }));
    },
    getAreaProps: () => {
      const props = readProps();
      const focused = service.editing;
      const placeholderShown = ctx().value.trim() === "";
      return areaBag(
        [props.dir, focused, props.disabled, props.autoResize, placeholderShown].join("\u0000"),
        () => ({
          id: areaId,
          dir: props.dir,
          "data-state": focused ? "edit" : "preview",
          "data-focus": dataAttr(focused),
          "data-disabled": dataAttr(props.disabled),
          "data-placeholder-shown": dataAttr(placeholderShown),
          // Zag renders the auto-resize stack with an inline style; ours keys
          // a static utility on the same fact.
          "data-autoresize": dataAttr(props.autoResize),
        }),
      );
    },
    getLabelProps: () => {
      const props = readProps();
      const focused = service.editing;
      return labelBag(
        [props.dir, focused, props.invalid, props.required, props.disabled].join("\u0000"),
        () => ({
          id: labelId,
          dir: props.dir,
          for: inputId,
          "data-state": focused ? "edit" : "preview",
          "data-focus": dataAttr(focused),
          "data-invalid": dataAttr(props.invalid),
          "data-required": dataAttr(props.required),
          "data-disabled": dataAttr(props.disabled),
          onClick: (): void => {
            if (service.editing) return;
            byId(previewId)?.focus({ preventScroll: true });
          },
        }),
      );
    },
    getInputProps: () => {
      const props = readProps();
      const focused = service.editing;
      // Outside the auto-resize stack the inactive part leaves the layout
      // entirely; inside it both parts share one cell so the box never
      // changes size, and the inactive one is only invisible. The bag
      // resolves the two cases into the one flag the utilities key on.
      const removed = !focused && !props.autoResize;
      const placeholderShown = ctx().value.trim() === "";
      return inputBag(
        [
          props.dir,
          props.name,
          props.form,
          props.maxLength,
          props.placeholder.edit,
          props.disabled,
          props.readOnly,
          props.required,
          props.invalid,
          props.autoResize,
          focused,
          ctx().value,
        ].join("\u0000"),
        () => ({
          id: inputId,
          dir: props.dir,
          type: "text",
          name: props.name,
          form: props.form,
          // The bag carries the machine's value, so the platform's own value
          // setter keeps the field in step — including the caret, which a
          // same-value assignment leaves alone.
          value: ctx().value,
          placeholder: props.placeholder.edit,
          maxLength: props.maxLength ?? undefined,
          required: props.required,
          disabled: props.disabled,
          readOnly: props.readOnly,
          "aria-label": TRANSLATIONS.input,
          "aria-invalid": props.invalid ? true : undefined,
          "data-state": focused ? "edit" : "preview",
          "data-disabled": dataAttr(props.disabled),
          "data-readonly": dataAttr(props.readOnly),
          "data-invalid": dataAttr(props.invalid),
          "data-autoresize": dataAttr(props.autoResize),
          "data-placeholder-shown": dataAttr(placeholderShown),
          "data-hidden": dataAttr(removed),
          "aria-controls": controlId,
          // A size of 1 is what makes the field content-sized in the
          // auto-resize stack.
          size: props.autoResize ? 1 : undefined,
          onInput: (event: InputChangeEvent): void =>
            send({ type: "VALUE.SET", value: event.currentTarget.value, src: "input.change" }),
          onKeydown: onInputKeydown,
          "use:interact-outside": outside,
        }),
      );
    },
    getPreviewProps: () => {
      const props = readProps();
      const focused = service.editing;
      const live = interactive();
      const placeholderShown = ctx().value.trim() === "";
      const text = placeholderShown ? props.placeholder.preview ?? "" : ctx().value;
      const removed = focused && !props.autoResize;
      return previewBag(
        [
          props.dir,
          text,
          props.disabled,
          props.readOnly,
          props.invalid,
          props.autoResize,
          focused,
          live,
          props.activationMode,
        ].join("\u0000"),
        () => ({
          id: previewId,
          dir: props.dir,
          "data-state": focused ? "edit" : "preview",
          "data-placeholder-shown": dataAttr(placeholderShown),
          "data-readonly": dataAttr(props.readOnly),
          "data-disabled": dataAttr(props.disabled),
          "data-invalid": dataAttr(props.invalid),
          "data-autoresize": dataAttr(props.autoResize),
          "data-hidden": dataAttr(removed),
          "aria-readonly": props.readOnly ? true : undefined,
          "aria-disabled": props.disabled ? true : undefined,
          "aria-invalid": props.invalid ? true : undefined,
          "aria-label": TRANSLATIONS.edit,
          "aria-controls": controlId,
          tabIndex: live ? 0 : undefined,
          onClick: (): void => {
            if (!live) return;
            if (props.activationMode !== "click") return;
            send({ type: "EDIT", src: "preview.click" });
          },
          onFocus: (): void => {
            if (!live) return;
            if (props.activationMode !== "focus") return;
            send({ type: "EDIT", src: "preview.focus" });
          },
          onDoubleClick: (event: MouseEvent): void => {
            if (event.defaultPrevented) return;
            if (!live) return;
            if (props.activationMode !== "dblclick") return;
            send({ type: "EDIT", src: "preview.dblclick" });
          },
          onKeydown: onPreviewKeydown,
        }),
      );
    },
    getEditTriggerProps: () => {
      const props = readProps();
      const focused = service.editing;
      return editTriggerBag(`${props.dir}\u0000${focused}\u0000${props.disabled}`, () => ({
        id: editTriggerId,
        dir: props.dir,
        type: "button",
        "data-state": focused ? "edit" : "preview",
        "data-disabled": dataAttr(props.disabled),
        "aria-label": TRANSLATIONS.edit,
        "aria-controls": controlId,
        disabled: props.disabled,
        onClick: (event: MouseEvent): void => {
          if (event.defaultPrevented) return;
          if (!interactive()) return;
          send({ type: "EDIT", src: "edit.click" });
        },
      }));
    },
    getControlProps: () => {
      const props = readProps();
      return controlBag(props.dir, () => ({ id: controlId, dir: props.dir }));
    },
    getSubmitTriggerProps: () => {
      const props = readProps();
      const focused = service.editing;
      return submitTriggerBag(`${props.dir}\u0000${focused}\u0000${props.disabled}`, () => ({
        id: submitTriggerId,
        dir: props.dir,
        type: "button",
        "data-state": focused ? "edit" : "preview",
        "data-disabled": dataAttr(props.disabled),
        "aria-label": TRANSLATIONS.submit,
        "aria-controls": controlId,
        disabled: props.disabled,
        onClick: (event: MouseEvent): void => {
          if (event.defaultPrevented) return;
          if (!interactive()) return;
          send({ type: "SUBMIT", src: "submit.click" });
        },
      }));
    },
    getCancelTriggerProps: () => {
      const props = readProps();
      const focused = service.editing;
      return cancelTriggerBag(`${props.dir}\u0000${focused}\u0000${props.disabled}`, () => ({
        id: cancelTriggerId,
        dir: props.dir,
        type: "button",
        "data-state": focused ? "edit" : "preview",
        "data-disabled": dataAttr(props.disabled),
        "aria-label": TRANSLATIONS.cancel,
        "aria-controls": controlId,
        disabled: props.disabled,
        onClick: (event: MouseEvent): void => {
          if (event.defaultPrevented) return;
          if (!interactive()) return;
          send({ type: "CANCEL", src: "cancel.click" });
        },
      }));
    },
  };
}
