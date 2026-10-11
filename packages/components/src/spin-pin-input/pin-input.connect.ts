/**
 * Pin-input connect: the DOM contract, the keyboard map and the pointer-less
 * cell flows.
 *
 * The machine holds the characters and the focused index; everything that
 * needs the DOM lives here. That includes the three reflexes Zag runs from
 * its watch blocks, all of them keyed off what a send just did:
 *
 *   - the focused index moved → the cell it names takes focus (and selects
 *     itself under `selectOnFocus`);
 *   - the value completed → the focused cell blurs and the form the hidden
 *     input names submits, when `blurOnComplete`/`autoSubmit` ask for it;
 *   - the value moved → each cell's bag carries its character, and the
 *     spread machinery writes it, which is the sync Zag's `syncInputElements`
 *     does by hand.
 *
 * A paste into a cell is distributed by the machine; the view's job is the
 * validity gate before it (Zag's `isValidValue`), because that is a
 * statement about what the keystroke means, not about state.
 *
 * Parts are `pin-input:<element id>:<part>`, as everywhere in this library.
 */

import {
  pinView,
  type PinInputContext,
  type PinInputEvent,
} from "./pin-input.machine.ts";

export type PinInputType = "numeric" | "alphabetic" | "alphanumeric";

/** Zag's `sanitizeValue`: a host transform on the pasted string. */
export type PinInputSanitize = (value: string) => string;

/** Zag's `translations.inputLabel`, with the English default beside it. */
export interface PinInputTranslations {
  inputLabel(index: number, length: number): string;
}

export interface PinInputConnectProps {
  readonly count: number;
  readonly type: PinInputType;
  readonly pattern: string;
  readonly mask: boolean;
  readonly otp: boolean;
  readonly placeholder: string;
  readonly disabled: boolean;
  readonly readOnly: boolean;
  readonly invalid: boolean;
  readonly required: boolean;
  readonly name: string | undefined;
  readonly form: string | undefined;
  readonly dir: "ltr" | "rtl";
  readonly autoFocus: boolean;
  readonly autoSubmit: boolean;
  readonly blurOnComplete: boolean;
  readonly selectOnFocus: boolean;
  readonly sanitize: PinInputSanitize;
  readonly translations: PinInputTranslations;
}

/** The element's imperative surface — Zag's api methods, declared here so
 * hosts (and tests) call them without a cast. Every one is a send through
 * the view's wrapper, so a command's reflexes run too. */
export interface PinInputCommands {
  focus(): void;
  setValue(value: readonly string[]): void;
  clearValue(): void;
  setValueAtIndex(index: number, value: string): void;
}

export interface PinInputApi extends PinInputCommands {
  readonly count: number;
  readonly items: readonly number[];
  readonly value: readonly string[];
  readonly valueAsString: string;
  readonly complete: boolean;
  /** Whether a cell holds DOM focus — Zag's `focused` state, read for the
   * host (and for tests) the way the listbox reports it. */
  readonly focused: boolean;
  getRootProps(): Record<string, unknown>;
  getLabelProps(): Record<string, unknown>;
  getControlProps(): Record<string, unknown>;
  getHiddenInputProps(): Record<string, unknown>;
  getInputProps(props: { index: number }): Record<string, unknown>;
  /** The cell indices the markup iterates, memoized on the count. */
  getItems(): readonly number[];
}

export interface PinInputService {
  readonly context: PinInputContext;
  readonly focused: boolean;
  send(event: PinInputEvent): void;
}

/** The behavioural props, read on demand: the connect lives as long as the
 * element does, so a snapshot would freeze the first read's values inside
 * the handlers it caches. */
export type ReadPinInputProps = () => PinInputConnectProps;

/** A bag cached until the signature of the fields it reads moves. */
interface BagMemo {
  sig: string;
  bag: Record<string, unknown>;
}

/** A binding re-reads the bag on every machine move, so a fresh bag per read
 * would detach and re-attach every listener each move. */
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

/** `cached` per owner: the cells are stable indices, so the memo dies with
 * the cell count it came from. */
function keyed(
  store: Map<number, BagMemo>,
  owner: number,
  sig: string,
  build: () => Record<string, unknown>,
): Record<string, unknown> {
  const hit = store.get(owner);
  if (hit !== undefined && hit.sig === sig) return hit.bag;
  const bag = build();
  store.set(owner, { sig, bag });
  return bag;
}

/** Zag's `dataAttr`: the attribute is present when the condition holds and
 * absent otherwise. */
function dataAttr(value: boolean): string | undefined {
  return value ? "" : undefined;
}

/** Zag's `REGEX` table, keyed by `type`; `pattern` overrides it wholesale. */
const TYPE_PATTERNS: Readonly<Record<PinInputType, RegExp>> = {
  numeric: /^[0-9]+$/,
  alphabetic: /^[A-Za-z]+$/,
  alphanumeric: /^[a-zA-Z0-9]+$/i,
};

/** Zag's `isValidValue`. The pattern path compiles without Zag's `g` flag: a
 * global regex's `lastIndex` makes a repeated test of the same value report
 * differently the second time. */
function isValidValue(value: string, type: PinInputType, pattern: string): boolean {
  if (pattern.length > 0) return new RegExp(pattern).test(value);
  const regex = TYPE_PATTERNS[type];
  return regex !== undefined && regex.test(value);
}

/** Zag's rtl flip: in a right-to-left pin, ArrowLeft walks forward. */
function eventKey(event: KeyboardEvent, dir: "ltr" | "rtl"): string {
  if (dir !== "rtl") return event.key;
  if (event.key === "ArrowLeft") return "ArrowRight";
  if (event.key === "ArrowRight") return "ArrowLeft";
  return event.key;
}

/** The part-id namespace. */
const NAMESPACE = "pin-input";

export function connectRobotPinInput(
  service: PinInputService,
  readProps: ReadPinInputProps,
  id: string,
  root: () => Element,
): PinInputApi {
  const ownerId = id.startsWith(`${NAMESPACE}:`) ? id : `${NAMESPACE}:${id}`;
  const labelId = `${ownerId}:label`;
  const controlId = `${ownerId}:control`;
  const hiddenInputId = `${ownerId}:hidden`;
  const inputId = (index: number): string => `${ownerId}:input:${index}`;
  const inputPrefix = `${ownerId}:input:`;
  const ctx = (): PinInputContext => service.context;
  const view = () => pinView(ctx().value, ctx().count);
  const complete = (): boolean => view().complete;
  const interactive = (): boolean => !readProps().disabled && !readProps().readOnly;

  // ---- the cells as the DOM holds them ------------------------------------

  /**
   * The cell inputs under the root, in document order. The hidden input is
   * excluded by the id prefix, which is what Zag's `data-ownedby` selector
   * does for it.
   */
  const cellInputs = (): HTMLInputElement[] => {
    const found: HTMLInputElement[] = [];
    for (const node of root().querySelectorAll("input")) {
      if (node instanceof HTMLInputElement && node.id.startsWith(inputPrefix)) found.push(node);
    }
    return found;
  };

  const hiddenInput = (): HTMLInputElement | null => {
    for (const node of root().querySelectorAll("input")) {
      if (node instanceof HTMLInputElement && node.id === hiddenInputId) return node;
    }
    return null;
  };

  const focusAt = (index: number): void => {
    cellInputs()[index]?.focus({ preventScroll: true });
  };

  /** linkedom's inputs carry no selection API; the browser's do. */
  const selectAt = (index: number): void => {
    const cell = cellInputs()[index];
    if (cell !== undefined && typeof cell.select === "function") cell.select();
  };

  /** Zag's `requestFormSubmit`: the hidden input's form, when the host named
   * the pin and the value is complete. */
  const requestSubmit = (): void => {
    const props = readProps();
    if (props.name === undefined || !complete()) return;
    const input = hiddenInput();
    const form = input === null ? null : input.form;
    if (form !== null) form.requestSubmit();
  };

  /**
   * Zag's watch on `isValueComplete`: the completion is an edge, so each of
   * the three consequences (the event, the blur, the submit) happens once,
   * on the way in.
   */
  const completeReflex = (): void => {
    const props = readProps();
    if (!complete()) return;
    if (props.blurOnComplete) cellInputs()[ctx().focusedIndex]?.blur();
    if (props.autoSubmit) requestSubmit();
  };

  /**
   * Every event the view sends. The bridge's funnel (behind `service.send`)
   * fires the change callbacks; what is left is the view's own reflexes,
   * read off the context the move just produced.
   */
  const send = (event: PinInputEvent): void => {
    const before = { index: ctx().focusedIndex, complete: complete() };
    service.send(event);
    const index = ctx().focusedIndex;
    if (index !== before.index && index >= 0) {
      focusAt(index);
      if (readProps().selectOnFocus) selectAt(index);
    }
    if (!before.complete && complete()) completeReflex();
  };

  // ---- per-cell handlers --------------------------------------------------

  interface CellHandlers {
    readonly onFocus: () => void;
    readonly onBlur: (event: FocusEvent) => void;
    readonly onKeyDown: (event: KeyboardEvent) => void;
    readonly onPaste: (event: ClipboardEvent) => void;
    readonly onBeforeInput: (event: InputEvent) => void;
    readonly onInput: (event: InputEvent) => void;
  }

  const cellHandlers = new Map<number, CellHandlers>();
  const handlersFor = (index: number): CellHandlers => {
    const hit = cellHandlers.get(index);
    if (hit !== undefined) return hit;
    const made: CellHandlers = {
      onFocus: () => send({ type: "INPUT.FOCUS", index }),
      onBlur: (event: FocusEvent) => {
        // Focus moving to another cell of this pin is not a blur: the
        // machine would drop to idle and back on every arrow step.
        const target = event.relatedTarget;
        if (target instanceof Element && root().contains(target)) return;
        send({ type: "INPUT.BLUR", index });
      },
      onKeyDown: (event: KeyboardEvent) => {
        if (event.defaultPrevented) return;
        if (event.isComposing === true || event.keyCode === 229) return;
        if (event.ctrlKey || event.altKey || event.metaKey) return;
        // A re-typed character does not rewrite the cell: it advances, which
        // is what makes a filled pin retypeable from the top.
        const focusedValue = view().chars[ctx().focusedIndex] ?? "";
        if (event.key.length === 1 && focusedValue === event.key) {
          event.preventDefault();
          send({ type: "INPUT.ADVANCE" });
          return;
        }
        switch (eventKey(event, readProps().dir)) {
          case "Backspace":
            send({ type: "INPUT.BACKSPACE" });
            break;
          case "Delete":
            send({ type: "INPUT.DELETE" });
            break;
          case "ArrowLeft":
            send({ type: "INPUT.ARROW_LEFT" });
            break;
          case "ArrowRight":
            send({ type: "INPUT.ARROW_RIGHT" });
            break;
          case "Enter":
            requestSubmit();
            break;
          case "Home":
            send({ type: "INPUT.HOME" });
            break;
          case "End":
            send({ type: "INPUT.END" });
            break;
          default:
            return;
        }
        event.preventDefault();
      },
      onPaste: (event: ClipboardEvent) => {
        if (!interactive()) return;
        const raw = event.clipboardData?.getData("text/plain");
        if (raw === undefined || raw.length === 0) return;
        const pasted = readProps().sanitize(raw);
        if (!isValidValue(pasted, readProps().type, readProps().pattern)) {
          // An invalid paste is refused AND reported: the host shows why.
          send({ type: "VALUE.INVALID", value: pasted });
          event.preventDefault();
          return;
        }
        event.preventDefault();
        send({ type: "INPUT.PASTE", value: pasted });
      },
      onBeforeInput: (event: InputEvent) => {
        if (!interactive()) return;
        const target = event.currentTarget;
        if (!(target instanceof HTMLInputElement)) return;
        if ((event.inputType ?? "").startsWith("delete")) return;
        // The cell as the keystroke would leave it: the character is valid
        // or the keystroke never lands.
        const from = target.selectionStart ?? 0;
        const to = target.selectionEnd ?? from;
        const value = target.value.slice(0, from) + (event.data ?? "") + target.value.slice(to);
        const props = readProps();
        if (!isValidValue(value, props.type, props.pattern)) {
          send({ type: "VALUE.INVALID", value });
          event.preventDefault();
        }
        // Two characters in one cell can only be the first: keep the second
        // selected so the next keystroke replaces it.
        if (value.length > 1 && typeof target.setSelectionRange === "function") {
          target.setSelectionRange(0, 1, "forward");
        }
      },
      onInput: (event: InputEvent) => {
        if (!interactive()) return;
        const target = event.currentTarget;
        if (!(target instanceof HTMLInputElement)) return;
        const value = target.value;
        if (event.inputType === "insertFromPaste") {
          // The paste was distributed by INPUT.PASTE already; the cell keeps
          // its first character and no event is sent.
          target.value = value[0] ?? "";
          return;
        }
        if (value.length > 2) {
          // A multi-character insertion that did not come from the clipboard
          // (a drop, an autofill) is a paste for the machine's purposes.
          send({ type: "INPUT.PASTE", value });
          target.value = value[0] ?? "";
          event.preventDefault();
          return;
        }
        if (event.inputType === "deleteContentBackward") {
          send({ type: "INPUT.BACKSPACE" });
          return;
        }
        if (event.inputType === "deleteByCut") {
          send({ type: "INPUT.DELETE" });
          return;
        }
        // The browser reports the character the machine already holds (a
        // selection replaced with the same character): nothing to write.
        const focusedValue = view().chars[ctx().focusedIndex] ?? "";
        if (value === focusedValue) return;
        send({ type: "INPUT.CHANGE", index, value });
      },
    };
    cellHandlers.set(index, made);
    return made;
  };

  // ---- items ---------------------------------------------------------------

  /** The cell indices, memoized on the count: the `for` directive iterates
   * this array, and a fresh one per read would re-sync every cell on every
   * machine move. */
  let itemsCount = -1;
  let itemsCache: readonly number[] = [];
  const items = (): readonly number[] => {
    const count = ctx().count;
    if (count !== itemsCount) {
      itemsCount = count;
      itemsCache = Array.from({ length: count }, (_unused, at) => at);
    }
    return itemsCache;
  };

  // ---- cached bags ---------------------------------------------------------

  const rootBag = cached();
  const labelBag = cached();
  const controlBag = cached();
  const hiddenBag = cached();
  const inputBags = new Map<number, BagMemo>();

  const connect: PinInputApi = {
    get count(): number {
      return ctx().count;
    },
    get items(): readonly number[] {
      return items();
    },
    getItems: (): readonly number[] => items(),
    get value(): readonly string[] {
      // The raw characters, as Zag's api reports them: every assign fills to
      // the count, so the only way to see a shorter array is a host that
      // changed the count after seeding.
      return [...ctx().value];
    },
    get valueAsString(): string {
      return view().asString;
    },
    get complete(): boolean {
      return complete();
    },
    get focused(): boolean {
      return service.focused;
    },
    focus: (): void => {
      cellInputs()[0]?.focus({ preventScroll: true });
    },
    setValue: (value: readonly string[]): void => send({ type: "VALUE.SET", value: [...value] }),
    clearValue: (): void => send({ type: "VALUE.CLEAR" }),
    setValueAtIndex: (index: number, value: string): void =>
      send({ type: "VALUE.SET", value, index }),
    getRootProps: () => {
      const props = readProps();
      return rootBag(
        [
          props.dir,
          props.invalid,
          props.disabled,
          props.readOnly,
          complete(),
        ].join("\u0000"),
        () => ({
          id: ownerId,
          dir: props.dir,
          "data-invalid": dataAttr(props.invalid),
          "data-disabled": dataAttr(props.disabled),
          "data-complete": dataAttr(complete()),
          "data-readonly": dataAttr(props.readOnly),
        }),
      );
    },
    getLabelProps: () => {
      const props = readProps();
      return labelBag(
        [
          props.dir,
          props.invalid,
          props.disabled,
          props.readOnly,
          props.required,
          complete(),
        ].join("\u0000"),
        () => ({
          id: labelId,
          dir: props.dir,
          for: hiddenInputId,
          "data-invalid": dataAttr(props.invalid),
          "data-disabled": dataAttr(props.disabled),
          "data-complete": dataAttr(complete()),
          "data-required": dataAttr(props.required),
          "data-readonly": dataAttr(props.readOnly),
          onClick: (event: MouseEvent) => {
            // The label's control is the hidden input, which cannot take
            // focus; the first cell can.
            event.preventDefault();
            cellInputs()[0]?.focus({ preventScroll: true });
          },
        }),
      );
    },
    getControlProps: () => {
      const props = readProps();
      return controlBag(props.dir, () => ({
        id: controlId,
        dir: props.dir,
      }));
    },
    getHiddenInputProps: () => {
      const props = readProps();
      const joined = pinView(ctx().value, ctx().count);
      return hiddenBag(
        [
          joined.asString,
          joined.length,
          props.name,
          props.form,
          props.disabled,
          props.readOnly,
          props.required,
        ].join("\u0000"),
        () => ({
          id: hiddenInputId,
          "aria-hidden": true,
          type: "text",
          tabIndex: -1,
          hidden: true,
          disabled: props.disabled,
          readOnly: props.readOnly,
          required: props.required,
          name: props.name,
          form: props.form,
          maxLength: joined.length,
          // The value rides the assignable path, so a machine move writes it
          // without a hand-rolled sync.
          value: joined.asString,
        }),
      );
    },
    getInputProps: (props: { index: number }) => {
      const index = props.index;
      const current = readProps();
      const filled = pinView(ctx().value, ctx().count);
      const char = filled.chars[index] ?? "";
      const focused = ctx().focusedIndex;
      // One tab stop: the focused cell, or the first cell a value has not
      // reached yet.
      const tabbable = focused !== -1 ? focused : Math.min(filled.filled, filled.length - 1);
      const label = current.translations.inputLabel(index, filled.length);
      return keyed(
        inputBags,
        index,
        [
          char,
          filled.complete,
          current.invalid,
          current.disabled,
          current.readOnly,
          current.dir,
          current.mask,
          current.otp,
          current.type,
          current.placeholder,
          current.required,
          label,
          index === tabbable,
          focused === index,
          filled.length,
        ].join("\u0000"),
        () => ({
          id: inputId(index),
          dir: current.dir,
          disabled: current.disabled,
          tabIndex: index === tabbable ? 0 : -1,
          "data-index": index,
          "data-disabled": dataAttr(current.disabled),
          "data-complete": dataAttr(filled.complete),
          "data-filled": dataAttr(char !== ""),
          "data-invalid": dataAttr(current.invalid),
          "aria-invalid": current.invalid ? true : undefined,
          "aria-label": label,
          inputMode: current.otp || current.type === "numeric" ? "numeric" : "text",
          enterKeyHint: index === filled.length - 1 ? "done" : "next",
          type: current.mask ? "password" : current.type === "numeric" ? "tel" : "text",
          // The assignable path: a machine move writes the character here.
          value: char,
          readOnly: current.readOnly,
          autoCapitalize: "none",
          autoComplete: current.otp ? "one-time-code" : "off",
          placeholder: focused === index ? "" : current.placeholder,
          ...handlersFor(index),
        }),
      );
    },
  };

  // Zag's entry `choose(autoFocus)`: the index starts on the first cell and
  // that cell takes focus. One microtask out, exactly as the form-control
  // action is: the connect is built while the markup renders, so the cells
  // exist but are not in the document yet.
  if (readProps().autoFocus && ctx().count > 0) {
    const at = ctx().focusedIndex >= 0 ? ctx().focusedIndex : 0;
    queueMicrotask(() => focusAt(at));
  }

  return connect;
}
