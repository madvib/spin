/**
 * Tags-input connect: the DOM contract plus the view-owned gestures.
 *
 * The machine owns the four states and the tag list; everything a browser
 * can see lives here — the part ids, the keyboard map, the pointer
 * dispositions, the live region and the form plumbing. Four notes on the
 * shape:
 *
 * - Bag memos. A binding re-reads a bag on every machine move, so a fresh
 *   bag per read would detach and re-attach every listener each move and
 *   make the `for` directive re-insert every row. Bags are cached against
 *   the signature of the fields they read, and rows and row handlers are
 *   cached by identity (the menu lesson).
 * - Rows are keyed by `value` + occurrence, never by index: an index key
 *   would leave a surviving `for` cell rendering the row object it
 *   captured at render time — the previous tag at that position — after a
 *   middle delete. The occurrence makes a key mean one logical tag across
 *   every mutation the machine performs, and the index is read live.
 * - The outside-interaction channel is attached to the INPUT, as Zag's
 *   `trackInteractOutside` is, with tag items excluded: a press on the
 *   control's padding is outside the input and blurs, a press on a tag is
 *   not.
 * - Focus is a reflex, not an entry action: the connect focuses the input
 *   or a tag's inline input after the sends that need it.
 */

import type { TagsContext, TagsLog } from "./tags.machine.ts";

export interface TagsRow {
  readonly value: string;
  /** Which instance of `value` this row is; duplicates are allowed. */
  readonly occurrence: number;
}

export interface TagsItemState {
  readonly id: string;
  readonly index: number;
  readonly editing: boolean;
  readonly highlighted: boolean;
  readonly disabled: boolean;
}

export interface TagsTranslations {
  readonly clearTriggerLabel: string;
  readonly deleteTagTriggerLabel: (value: string) => string;
  readonly tagAdded: (value: string) => string;
  readonly tagEdited: (value: string) => string;
  readonly tagUpdated: (value: string) => string;
  readonly tagDeleted: (value: string) => string;
  readonly tagSelected: (value: string) => string;
  readonly tagsPasted: (values: readonly string[]) => string;
  readonly noTagsSelected: string;
}

export interface TagsConnectProps {
  readonly disabled: boolean;
  readonly readOnly: boolean;
  readonly invalid: boolean;
  readonly required: boolean;
  readonly dir: "ltr" | "rtl";
  readonly placeholder: string;
  readonly maxLength: number | undefined;
  readonly name: string | undefined;
  readonly form: string | undefined;
  readonly label: string;
  /** The tag character: splits on type and on paste. */
  readonly delimiter: string;
  /** The seed value a form reset restores. */
  readonly initialValue: readonly string[];
  readonly translations: TagsTranslations;
  readonly onPointerDownOutside: ((event: PointerEvent) => void) | undefined;
  readonly onInteractOutside: ((event: PointerEvent) => void) | undefined;
  readonly onFocusOutside: ((event: FocusEvent) => void) | undefined;
}

export interface TagsApi {
  readonly value: readonly string[];
  readonly inputValue: string;
  readonly valueAsString: string;
  readonly count: number;
  readonly empty: boolean;
  readonly atMax: boolean;
  readonly highlightedIndex: number | null;
  readonly editing: boolean;
  readonly editedIndex: number | null;
  getTags(): readonly TagsRow[];
  getItemState(row: TagsRow): TagsItemState;
  indexOfRow(row: TagsRow): number;
  indexOfId(id: string): number;
  focusInput(): void;
  announceLog(): void;
  getRootProps(): Record<string, unknown>;
  getLabelProps(): Record<string, unknown>;
  getControlProps(): Record<string, unknown>;
  getInputProps(): Record<string, unknown>;
  getHiddenInputProps(): Record<string, unknown>;
  getClearTriggerProps(): Record<string, unknown>;
  getItemProps(row: TagsRow): Record<string, unknown>;
  getItemPreviewProps(row: TagsRow): Record<string, unknown>;
  getItemTextProps(row: TagsRow): Record<string, unknown>;
  getItemInputProps(row: TagsRow): Record<string, unknown>;
  getItemDeleteTriggerProps(row: TagsRow): Record<string, unknown>;
  getLiveRegionProps(): Record<string, unknown>;
}

export interface TagsService {
  readonly state: { readonly value: string };
  readonly context: TagsContext;
  send(event: { type: string } & Record<string, unknown>): void;
}

type Send = (event: { type: string } & Record<string, unknown>) => void;

/** Read the behavioral props on demand: the connect is long-lived, so a
 * snapshot would freeze the first read's props inside cached handlers. */
export type ReadTagsProps = () => TagsConnectProps;

const NAMESPACE = "tags-input";

/** A bag cached until the signature of the fields it reads moves. */
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

interface BagMemo {
  sig: string;
  bag: Record<string, unknown>;
}

/** Zag's `dataAttr`: the attribute is present when the condition holds and
 * absent otherwise, which is what `hidden`-style utilities key on. The
 * runtime renders a boolean `true` the same way, but the sibling ports
 * carry the value rather than the condition, so the bag states its shape. */
function dataAttr(value: boolean): string | undefined {
  return value ? "" : undefined;
}

/** `cached` per owner: rows are stable objects, so the memo dies with the
 * tag it came from. */
function keyed<K extends object>(
  store: WeakMap<K, BagMemo>,
  owner: K,
  sig: string,
  build: () => Record<string, unknown>,
): Record<string, unknown> {
  const hit = store.get(owner);
  if (hit !== undefined && hit.sig === sig) return hit.bag;
  const bag = build();
  store.set(owner, { sig, bag });
  return bag;
}

export function connectRobotTagsInput(
  service: TagsService,
  readProps: ReadTagsProps,
  id: string,
  send: Send,
  root: () => Element,
): TagsApi {
  const ownerId = id.startsWith(`${NAMESPACE}:`) ? id : `${NAMESPACE}:${id}`;
  const rootId = ownerId;
  const labelId = `${ownerId}:label`;
  const controlId = `${ownerId}:control`;
  const inputId = `${ownerId}:input`;
  const hiddenInputId = `${ownerId}:hidden-input`;
  const clearTriggerId = `${ownerId}:clear-btn`;
  const liveRegionId = `${ownerId}:live-region`;
  const tagPartPrefix = `${ownerId}:tag:`;
  const tagId = (row: TagsRow): string => `${ownerId}:tag:${row.value}:${row.occurrence}`;
  const tagInputId = (row: TagsRow): string => `${tagId(row)}:input`;
  const tagDeleteId = (row: TagsRow): string => `${tagId(row)}:delete-btn`;

  const ctx = (): TagsContext => service.context;
  const editing = (): boolean => service.state.value === "editing:tag";
  const focused = (): boolean => service.state.value !== "idle";
  const interactive = (): boolean => {
    const props = readProps();
    return !props.readOnly && !props.disabled;
  };

  const inputEl = (): HTMLInputElement | null =>
    document.getElementById(inputId) as HTMLInputElement | null;

  const focusInput = (): void => {
    inputEl()?.focus();
  };

  /** Whether a node belongs to a tag part: the exclusion that keeps a
   * press on a tag from reading as a press outside the input. */
  const withinTag = (node: EventTarget | null): boolean => {
    if (!(node instanceof Element)) return false;
    const host = root();
    let at: Element | null = node;
    while (at !== null) {
      if (at.id.startsWith(tagPartPrefix)) return true;
      if (at === host) return false;
      at = at.parentElement;
    }
    return false;
  };

  // ---- rows ---------------------------------------------------------------

  const indexOfRow = (row: TagsRow): number => {
    const value = ctx().value;
    let seen = 0;
    for (let i = 0; i < value.length; i++) {
      if (value[i] !== row.value) continue;
      if (seen === row.occurrence) return i;
      seen++;
    }
    return -1;
  };

  /** The index behind a part id, for `clearValue(id)` — the one public
   * entry point that speaks ids rather than indices. */
  const indexOfId = (id: string): number => {
    for (const row of rows()) {
      if (tagId(row) === id || tagDeleteId(row) === id || tagInputId(row) === id) {
        return indexOfRow(row);
      }
    }
    return -1;
  };

  /**
   * One row object per logical tag, reused across value changes. A `for`
   * cell holds the row it captured at render time, so a rebuilt object
   * would leave a surviving cell rendering the previous tag's state; the
   * store is rebuilt each pass so dead keys do not accumulate.
   */
  const rowStore = new Map<string, TagsRow>();
  let rowSource: readonly string[] | undefined;
  let rowCache: readonly TagsRow[] | undefined;
  const rows = (): readonly TagsRow[] => {
    const source = ctx().value;
    if (rowCache !== undefined && source === rowSource) return rowCache;
    rowSource = source;
    const counts = new Map<string, number>();
    const alive = new Map<string, TagsRow>();
    const built: TagsRow[] = [];
    for (const item of source) {
      const occurrence = counts.get(item) ?? 0;
      counts.set(item, occurrence + 1);
      const key = `${occurrence}\u0000${item}`;
      const row: TagsRow = rowStore.get(key) ?? { value: item, occurrence };
      alive.set(key, row);
      built.push(row);
    }
    rowStore.clear();
    for (const [key, row] of alive) rowStore.set(key, row);
    rowCache = built;
    return built;
  };

  const itemState = (row: TagsRow): TagsItemState => {
    const index = indexOfRow(row);
    return {
      id: tagId(row),
      index,
      editing: editing() && ctx().editedIndex === index,
      highlighted: ctx().highlightedIndex === index,
      disabled: readProps().disabled,
    };
  };

  // ---- gestures -----------------------------------------------------------

  /** Row handlers, created once per row: they read the behavioral props
   * live, so a cached closure is never a stale snapshot of one. */
  interface TagHandlers {
    readonly onPointerDown: (event: PointerEvent) => void;
    readonly onDblclick: () => void;
    readonly onDeleteClick: (event: MouseEvent) => void;
    readonly onDeletePointerDown: (event: PointerEvent) => void;
  }
  const tagHandlers = new WeakMap<TagsRow, TagHandlers>();
  const handlersFor = (row: TagsRow): TagHandlers => {
    const hit = tagHandlers.get(row);
    if (hit !== undefined) return hit;
    const made: TagHandlers = {
      onPointerDown: (event: PointerEvent) => {
        if (!interactive()) return;
        if (event.button !== 0) return;
        event.preventDefault();
        const index = indexOfRow(row);
        if (index === -1) return;
        send({ type: "POINTER_DOWN_TAG", index });
        focusInput();
      },
      onDblclick: () => {
        if (!interactive()) return;
        const index = indexOfRow(row);
        if (index === -1) return;
        send({ type: "DOUBLE_CLICK_TAG", index });
        const node = document.getElementById(tagInputId(row));
        if (node instanceof HTMLInputElement) {
          node.focus();
          node.select();
        }
      },
      onDeleteClick: (event: MouseEvent) => {
        if (event.defaultPrevented) return;
        if (!interactive()) return;
        const index = indexOfRow(row);
        if (index === -1) return;
        send({ type: "CLICK_DELETE_TAG", index });
        focusInput();
      },
      // The delete trigger is inside the preview: pressing it must not
      // also highlight the tag. Its only job when inert is to swallow the
      // press so the click that follows never fires.
      onDeletePointerDown: (event: PointerEvent) => {
        if (event.button !== 0) return;
        if (interactive()) return;
        event.preventDefault();
      },
    };
    tagHandlers.set(row, made);
    return made;
  };

  const onInput = (event: InputEvent): void => {
    if (!interactive()) return;
    const target = event.currentTarget;
    if (!(target instanceof HTMLInputElement)) return;
    const value = target.value;
    if (event.inputType === "insertFromPaste") {
      send({ type: "PASTE", value });
      return;
    }
    const delimiter = readProps().delimiter;
    if (delimiter.length > 0 && value.endsWith(delimiter)) {
      send({ type: "DELIMITER_KEY" });
      return;
    }
    send({ type: "TYPE", value });
  };

  const onInputKeydown = (event: KeyboardEvent): void => {
    if (event.defaultPrevented) return;
    if (event.isComposing) return;
    const el = inputEl();
    const caret = el !== null && el.selectionStart === 0 && el.selectionEnd === 0;
    switch (event.key) {
      case "ArrowDown":
        send({ type: "ARROW_DOWN" });
        break;
      case "ArrowLeft":
        send({ type: "ARROW_LEFT", caretAtStart: caret });
        break;
      case "ArrowRight":
        if (ctx().highlightedIndex !== null) event.preventDefault();
        send({ type: "ARROW_RIGHT", caretAtStart: caret });
        break;
      case "Escape":
        event.preventDefault();
        send({ type: "ESCAPE" });
        break;
      case "Backspace":
        send({ type: "BACKSPACE", caretAtStart: caret });
        break;
      case "Delete":
        send({ type: "DELETE", caretAtStart: caret });
        break;
      case "Enter":
        send({ type: "ENTER" });
        event.preventDefault();
        break;
      default:
        return;
    }
  };

  const onTagInput = (event: InputEvent): void => {
    const target = event.currentTarget;
    if (!(target instanceof HTMLInputElement)) return;
    send({ type: "TAG_INPUT_TYPE", value: target.value });
  };

  const onTagKeydown = (event: KeyboardEvent): void => {
    if (event.defaultPrevented) return;
    if (event.isComposing) return;
    switch (event.key) {
      case "Enter":
        send({ type: "TAG_INPUT_ENTER" });
        focusInput();
        break;
      case "Escape":
        send({ type: "TAG_INPUT_ESCAPE" });
        focusInput();
        break;
      default:
        break;
    }
  };

  /**
   * The inline input's blur. Deferred a microtask so a press that moved
   * the highlight has already reported itself and this belongs to the
   * state that press left behind; `relatedToInput` keeps focus moving
   * between the two inputs of one tag from reading as a departure.
   */
  const onTagInputBlur = (event: FocusEvent): void => {
    const input = inputEl();
    const related = event.relatedTarget;
    const relatedToInput = related !== null && input !== null && related === input;
    queueMicrotask(() => {
      send({ type: "TAG_INPUT_BLUR", relatedToInput });
      if (!relatedToInput) send({ type: "EXTERNAL_BLUR" });
    });
  };

  /** Focus leaving the entry input for anything outside the component:
   * the focus half of Zag's interact-outside, which the pointerdown half
   * arrives through `use:dismissable` below.
   *
   * A null relatedTarget — focus landing on the body, which is what a
   * press on a non-focusable part of the page does — is a departure too,
   * as Zag's `isEventOutside` treats it: the target is the document body,
   * which is not inside the component. A window blur is not: the document
   * has dropped focus, so there is no new element to read as outside. */
  const onInputFocusOut = (event: FocusEvent): void => {
    const input = inputEl();
    const related = event.relatedTarget;
    if (related === null || related === undefined) {
      if (typeof document.hasFocus === "function" && !document.hasFocus()) return;
    } else {
      if (!(related instanceof Node)) return;
      if (input !== null && (related === input || input.contains(related))) return;
      if (withinTag(related)) return;
      const host = root();
      if (host.contains(related)) return;
    }
    readProps().onFocusOutside?.(event);
    send({ type: "BLUR" });
  };

  const onOutside = (event: PointerEvent): void => {
    const props = readProps();
    props.onPointerDownOutside?.(event);
    props.onInteractOutside?.(event);
    if (event.defaultPrevented) return;
    if (withinTag(event.target)) return;
    if (!interactive()) return;
    send({ type: "BLUR" });
  };

  // ---- live region --------------------------------------------------------

  /**
   * The announcement text, per mutation type. A selection announced on
   * the heels of a delete or an update carries both sentences, which is
   * what the log's `prev` entry is for.
   */
  const message = (log: TagsLog, prev: TagsLog | null, t: TagsTranslations): string => {
    switch (log.type) {
      case "add":
        return t.tagAdded(log.value);
      case "delete":
        return t.tagDeleted(log.value);
      case "update":
        return t.tagUpdated(log.value);
      case "paste":
        return t.tagsPasted(log.values);
      case "clear":
        return t.noTagsSelected;
      case "select": {
        const head = prev !== null && prev.type === "delete"
          ? t.tagDeleted(prev.value)
          : prev !== null && prev.type === "update"
          ? t.tagUpdated(prev.value)
          : null;
        const body = t.tagSelected(log.value);
        return head === null ? body : `${head}. ${body}`;
      }
    }
  };

  /**
   * Announced by swapping the region node for a fresh clone carrying the
   * text: a new node in the live tree is a mutation a screen reader reads
   * even when the message repeats, which rewriting the same node's text
   * two writes deep in one task would not be.
   */
  const announceLog = (): void => {
    const log = ctx().log;
    if (log === null) return;
    const region = document.getElementById(liveRegionId);
    if (region === null || region.parentNode === null) return;
    const fresh = region.cloneNode(false);
    fresh.textContent = message(log, ctx().logPrev, readProps().translations);
    region.replaceWith(fresh);
  };

  // ---- cached bags --------------------------------------------------------

  const rootBag = cached();
  const labelBag = cached();
  const controlBag = cached();
  const inputBag = cached();
  const hiddenInputBag = cached();
  const clearTriggerBag = cached();
  const liveRegionBag = cached();
  const itemBags = new WeakMap<TagsRow, BagMemo>();
  const previewBags = new WeakMap<TagsRow, BagMemo>();
  const textBags = new WeakMap<TagsRow, BagMemo>();
  const itemInputBags = new WeakMap<TagsRow, BagMemo>();
  const deleteTriggerBags = new WeakMap<TagsRow, BagMemo>();

  return {
    get value(): readonly string[] {
      return ctx().value;
    },
    get inputValue(): string {
      return ctx().inputValue;
    },
    get valueAsString(): string {
      return ctx().value.join(", ");
    },
    get count(): number {
      return ctx().value.length;
    },
    get empty(): boolean {
      return ctx().value.length === 0;
    },
    get atMax(): boolean {
      return ctx().value.length >= ctx().max;
    },
    get highlightedIndex(): number | null {
      return ctx().highlightedIndex;
    },
    get editing(): boolean {
      return editing();
    },
    get editedIndex(): number | null {
      return ctx().editedIndex;
    },
    getTags: rows,
    getItemState: (row: TagsRow): TagsItemState => itemState(row),
    indexOfRow,
    indexOfId,
    focusInput,
    announceLog,
    getRootProps: () => {
      const props = readProps();
      const empty = ctx().value.length === 0;
      return rootBag(
        `${props.dir}\u0000${props.disabled}\u0000${props.readOnly}\u0000${props.invalid}\u0000${empty}\u0000${focused()}`,
        () => ({
          id: rootId,
          dir: props.dir,
          "data-invalid": dataAttr(props.invalid),
          "data-readonly": dataAttr(props.readOnly),
          "data-disabled": dataAttr(props.disabled),
          "data-focus": dataAttr(focused()),
          "data-empty": dataAttr(ctx().value.length === 0),
          onPointerDown: () => {
            if (!interactive()) return;
            send({ type: "POINTER_DOWN" });
          },
        }),
      );
    },
    getLabelProps: () => {
      const props = readProps();
      return labelBag(
        `${props.dir}\u0000${props.disabled}\u0000${props.invalid}\u0000${props.readOnly}\u0000${props.required}`,
        () => ({
          id: labelId,
          dir: props.dir,
          for: inputId,
          "data-disabled": dataAttr(props.disabled),
          "data-invalid": dataAttr(props.invalid),
          "data-readonly": dataAttr(props.readOnly),
          "data-required": dataAttr(props.required),
        }),
      );
    },
    getControlProps: () => {
      const props = readProps();
      return controlBag(
        `${props.dir}\u0000${props.disabled}\u0000${props.readOnly}\u0000${props.invalid}\u0000${focused()}`,
        () => ({
          id: controlId,
          dir: props.dir,
          tabIndex: props.readOnly ? 0 : undefined,
          "data-disabled": dataAttr(props.disabled),
          "data-readonly": dataAttr(props.readOnly),
          "data-invalid": dataAttr(props.invalid),
          "data-focus": dataAttr(focused()),
        }),
      );
    },
    getInputProps: () => {
      const props = readProps();
      const state = ctx();
      const empty = state.value.length === 0;
      return inputBag(
        `${props.dir}\u0000${props.disabled}\u0000${props.readOnly}\u0000${props.invalid}\u0000${empty}\u0000${
          state.inputValue
        }\u0000${props.placeholder}\u0000${props.maxLength}`,
        () => ({
          id: inputId,
          dir: props.dir,
          type: "text",
          autoComplete: "off",
          autoCorrect: "off",
          autoCapitalize: "none",
          enterKeyHint: "done",
          disabled: props.disabled || props.readOnly,
          maxLength: props.maxLength,
          "aria-invalid": props.invalid,
          "data-invalid": dataAttr(props.invalid),
          "data-readonly": dataAttr(props.readOnly),
          "data-empty": dataAttr(empty),
          placeholder: empty ? props.placeholder : undefined,
          value: state.inputValue,
          onInput: onInput,
          onFocus: () => send({ type: "FOCUS" }),
          onFocusOut: onInputFocusOut,
          onKeydown: onInputKeydown,
          "use:dismissable": { onOutside },
        }),
      );
    },
    getHiddenInputProps: () => {
      const props = readProps();
      const joined = ctx().value.join(", ");
      return hiddenInputBag(
        `${props.name}\u0000${props.form}\u0000${props.disabled}\u0000${props.readOnly}\u0000${
          props.required
        }\u0000${joined}`,
        () => ({
          type: "text",
          hidden: true,
          name: props.name,
          form: props.form,
          disabled: props.disabled,
          readOnly: props.readOnly,
          required: props.required,
          id: hiddenInputId,
          value: joined,
          // Zag's trackFormControl: a form reset returns the tags to the
          // seeded value. The rest of that effect (fieldset disabled) has
          // no consumer in this machine — the api's `disabled` is the prop.
          "use:form-control": {
            onFormReset: () => {
              send({ type: "SET_VALUE", value: [...props.initialValue] });
            },
          },
        }),
      );
    },
    getClearTriggerProps: () => {
      const props = readProps();
      const empty = ctx().value.length === 0;
      return clearTriggerBag(
        `${props.disabled}\u0000${props.readOnly}\u0000${empty}\u0000${props.translations.clearTriggerLabel}`,
        () => ({
          id: clearTriggerId,
          type: "button",
          dir: props.dir,
          "data-readonly": dataAttr(props.readOnly),
          disabled: props.disabled,
          "aria-label": props.translations.clearTriggerLabel,
          hidden: empty,
          onClick: () => {
            if (!interactive()) return;
            send({ type: "CLEAR_VALUE" });
            focusInput();
          },
        }),
      );
    },
    getItemProps: (row: TagsRow) =>
      keyed(itemBags, row, `${ctx().editedIndex}\u0000${ctx().highlightedIndex}\u0000${readProps().disabled}`, () => ({
        dir: readProps().dir,
        "data-value": row.value,
        "data-disabled": dataAttr(readProps().disabled),
      })),
    getItemPreviewProps: (row: TagsRow) => {
      const state = itemState(row);
      const handlers = handlersFor(row);
      return keyed(
        previewBags,
        row,
        `${state.editing}\u0000${state.highlighted}\u0000${state.disabled}`,
        () => ({
          id: state.id,
          dir: readProps().dir,
          hidden: state.editing,
          "data-value": row.value,
          "data-disabled": dataAttr(state.disabled),
          "data-highlighted": dataAttr(state.highlighted),
          onPointerDown: handlers.onPointerDown,
          onDblclick: handlers.onDblclick,
        }),
      );
    },
    getItemTextProps: (row: TagsRow) => {
      const state = itemState(row);
      return keyed(textBags, row, `${state.highlighted}\u0000${state.disabled}`, () => ({
        dir: readProps().dir,
        "data-disabled": dataAttr(state.disabled),
        "data-highlighted": dataAttr(state.highlighted),
      }));
    },
    getItemInputProps: (row: TagsRow) => {
      const state = itemState(row);
      const props = readProps();
      return keyed(
        itemInputBags,
        row,
        `${state.editing}\u0000${state.disabled}\u0000${state.index}\u0000${
          state.editing ? ctx().editedValue : ""
        }`,
        () => ({
          id: tagInputId(row),
          dir: props.dir,
          type: "text",
          disabled: state.disabled,
          "aria-label": props.translations.tagEdited(row.value),
          hidden: !state.editing,
          maxLength: props.maxLength,
          tabIndex: -1,
          autoComplete: "off",
          value: state.editing ? ctx().editedValue : "",
          onInput: onTagInput,
          onKeydown: onTagKeydown,
          onBlur: onTagInputBlur,
        }),
      );
    },
    getItemDeleteTriggerProps: (row: TagsRow) => {
      const state = itemState(row);
      const props = readProps();
      const handlers = handlersFor(row);
      return keyed(
        deleteTriggerBags,
        row,
        `${state.highlighted}\u0000${state.disabled}\u0000${row.value}`,
        () => ({
          id: tagDeleteId(row),
          type: "button",
          dir: props.dir,
          "data-disabled": dataAttr(state.disabled),
          "aria-disabled": state.disabled,
          "data-highlighted": dataAttr(state.highlighted),
          "aria-label": props.translations.deleteTagTriggerLabel(row.value),
          tabIndex: -1,
          disabled: state.disabled,
          onPointerDown: handlers.onDeletePointerDown,
          onClick: handlers.onDeleteClick,
        }),
      );
    },
    getLiveRegionProps: () =>
      liveRegionBag("", () => ({
        id: liveRegionId,
        role: "status",
        "aria-live": "assertive",
        "aria-atomic": true,
      })),
  };
}
